package com.brainwave.app.recorder;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import com.brainwave.app.MainActivity;
import com.brainwave.app.R;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Records a lecture in the background, with the screen off, as a foreground
 * service of type "microphone" with a persistent notification.
 *
 * Audio is 16 kHz mono 16-bit PCM, the same as the web recorder. It is cut into
 * pieces that end at the quietest moment between 50 and 70 seconds and written
 * to app storage as files named {@code seg-<startSample>.pcm}. The audio since
 * the last cut is appended to {@code tail-<startSample>.part} as it is
 * recorded, so if the app or phone dies, at most a fraction of a second is
 * lost. The web app picks the files up, saves them in its own queue and
 * deletes them (see LectureRecorderPlugin).
 */
public class RecorderService extends Service {
    public static final String ACTION_START = "com.brainwave.app.recorder.START";
    public static final String ACTION_PAUSE = "com.brainwave.app.recorder.PAUSE";
    public static final String ACTION_RESUME = "com.brainwave.app.recorder.RESUME";
    public static final String ACTION_STOP = "com.brainwave.app.recorder.STOP";
    public static final String EXTRA_SESSION = "sessionId";
    public static final String EXTRA_TITLE = "title";

    public static final int RATE = 16_000;
    private static final int FRAME = RATE / 10; // 100 ms
    private static final String CHANNEL = "lecture-recording";
    private static final int NOTIFICATION_ID = 4101;

    /** Where a piece may end, in seconds. */
    static int minSec = 50, targetSec = 60, maxSec = 70;

    /** The running service, if any. Read by the plugin. */
    @Nullable static volatile RecorderService instance;
    /** Told when a piece is written. */
    @Nullable static volatile Listener listener;

    interface Listener {
        void onSegment(String sessionId, String name, double start, double duration);
        void onStopped(String sessionId, @Nullable String error);
    }

    private volatile boolean running;
    private volatile boolean paused;
    private volatile float level;
    private String sessionId = "";
    private String title = "";
    private Thread thread;
    private AudioRecord record;

    /** Samples recorded since the start (pauses excluded). */
    private volatile long totalSamples;
    /** Start (in samples) of the audio not yet written as a piece. */
    private long pieceStart;
    private short[] buffer = new short[RATE * 75];
    private int buffered;
    private RandomAccessFile tail;
    private File tailFile;

    public static File dirFor(Context ctx, String sessionId) {
        return new File(new File(ctx.getFilesDir(), "lecture-audio"), sessionId.replaceAll("[^A-Za-z0-9_-]", ""));
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START.equals(action) && !running) {
            sessionId = intent.getStringExtra(EXTRA_SESSION);
            title = intent.getStringExtra(EXTRA_TITLE);
            if (sessionId == null || sessionId.isEmpty()) { stopSelf(); return START_NOT_STICKY; }
            startInForeground();
            begin();
        } else if (ACTION_PAUSE.equals(action)) {
            setPaused(true);
        } else if (ACTION_RESUME.equals(action)) {
            setPaused(false);
        } else if (ACTION_STOP.equals(action)) {
            new Thread(this::finish).start();
        }
        // Not restarted automatically: the web app recovers what was saved instead.
        return START_NOT_STICKY;
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.recording_channel), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type);
    }

    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, RecorderService.class).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_recording)
            .setContentTitle(getString(paused ? R.string.recording_paused : R.string.recording_lecture))
            .setContentText(title == null || title.isEmpty() ? getString(R.string.recording_hint) : title)
            .setUsesChronometer(!paused)
            .setWhen(System.currentTimeMillis() - elapsedMs())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(open)
            .addAction(0, getString(R.string.recording_stop), stop)
            .build();
    }

    private void refreshNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, notification());
    }

    public long elapsedMs() { return totalSamples * 1000L / RATE; }
    public boolean isPaused() { return paused; }
    public boolean isRunning() { return running; }
    public String sessionId() { return sessionId; }
    public float level() { return level; }

    private void begin() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            fail("Microphone permission was not granted.");
            return;
        }
        File dir = dirFor(this, sessionId);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        // Continue after earlier pieces of this session (e.g. recording restarted).
        pieceStart = totalSamples = Segments.endOf(dir);
        try {
            openTail();
        } catch (IOException e) {
            fail("Could not save audio: " + e.getMessage());
            return;
        }
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        try {
            record = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, Math.max(min, FRAME * 2 * 4));
            record.startRecording();
        } catch (SecurityException | IllegalStateException e) {
            fail("The microphone could not be started.");
            return;
        }
        running = true;
        instance = this;
        thread = new Thread(this::loop, "lecture-recorder");
        thread.start();
    }

    private void loop() {
        short[] frame = new short[FRAME];
        ByteBuffer bytes = ByteBuffer.allocate(FRAME * 2).order(ByteOrder.LITTLE_ENDIAN);
        while (running) {
            if (paused) { SystemClock.sleep(50); continue; }
            int n = record.read(frame, 0, FRAME);
            if (n <= 0) {
                if (n == AudioRecord.ERROR_DEAD_OBJECT) { running = false; break; }
                SystemClock.sleep(10);
                continue;
            }
            double sum = 0;
            bytes.clear();
            for (int i = 0; i < n; i++) { sum += (double) frame[i] * frame[i]; bytes.putShort(frame[i]); }
            level = (float) Math.min(1.0, Math.sqrt(sum / n) / 32768.0 * 8);
            try {
                tail.write(bytes.array(), 0, n * 2);
            } catch (IOException e) {
                running = false;
                break;
            }
            if (buffered + n > buffer.length) buffer = java.util.Arrays.copyOf(buffer, buffer.length * 2);
            System.arraycopy(frame, 0, buffer, buffered, n);
            buffered += n;
            totalSamples += n;
            if (buffered >= maxSec * RATE) cut(Segments.quietCut(buffer, buffered, RATE, minSec, targetSec, maxSec));
        }
    }

    /** Write samples [0, at) as a piece and keep the rest as the new tail. */
    private void cut(int at) {
        try {
            File dir = dirFor(this, sessionId);
            String name = "seg-" + pieceStart + ".pcm";
            Segments.write(new File(dir, name), buffer, 0, at);
            double start = pieceStart / (double) RATE, duration = at / (double) RATE;
            int rest = buffered - at;
            System.arraycopy(buffer, at, buffer, 0, rest);
            buffered = rest;
            pieceStart += at;
            closeTail();
            //noinspection ResultOfMethodCallIgnored
            tailFile.delete();
            openTail();
            if (rest > 0) {
                ByteBuffer b = ByteBuffer.allocate(rest * 2).order(ByteOrder.LITTLE_ENDIAN);
                for (int i = 0; i < rest; i++) b.putShort(buffer[i]);
                tail.write(b.array());
            }
            Listener l = listener;
            if (l != null) l.onSegment(sessionId, name, start, duration);
        } catch (IOException e) {
            running = false;
        }
    }

    private void openTail() throws IOException {
        tailFile = new File(dirFor(this, sessionId), "tail-" + pieceStart + ".part");
        tail = new RandomAccessFile(tailFile, "rw");
        tail.seek(tail.length());
    }

    private void closeTail() {
        try { if (tail != null) tail.close(); } catch (IOException ignored) { }
        tail = null;
    }

    private void setPaused(boolean p) {
        if (!running || paused == p) return;
        paused = p;
        try { if (p) record.stop(); else record.startRecording(); } catch (IllegalStateException ignored) { }
        refreshNotification();
    }

    /** Stop recording and write what's left as the last piece. Blocks until done. */
    public synchronized void finish() {
        if (!running && record == null) { stopSelf(); return; }
        running = false;
        try { if (thread != null) thread.join(2000); } catch (InterruptedException ignored) { }
        try { record.stop(); } catch (IllegalStateException ignored) { }
        record.release();
        record = null;
        if (buffered > 0) cut(buffered);
        closeTail();
        if (tailFile != null && tailFile.length() == 0) //noinspection ResultOfMethodCallIgnored
            tailFile.delete();
        instance = null;
        Listener l = listener;
        if (l != null) l.onStopped(sessionId, null);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void fail(String message) {
        running = false;
        instance = null;
        Listener l = listener;
        if (l != null) l.onStopped(sessionId, message);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (running) finish();
        super.onDestroy();
    }
}
