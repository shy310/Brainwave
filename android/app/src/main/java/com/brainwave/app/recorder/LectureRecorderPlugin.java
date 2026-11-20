package com.brainwave.app.recorder;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.util.Base64;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

/**
 * Bridge between the web app and RecorderService. The web app starts and stops
 * the recording, and moves finished pieces into its own transcription queue:
 * list → read → (save in IndexedDB) → remove.
 */
@CapacitorPlugin(
    name = "LectureRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
        @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications"),
    }
)
public class LectureRecorderPlugin extends Plugin {

    @Override
    public void load() {
        RecorderService.listener = new RecorderService.Listener() {
            @Override public void onSegment(String sessionId, String name, double start, double duration) {
                JSObject o = new JSObject();
                o.put("sessionId", sessionId);
                o.put("name", name);
                o.put("start", start);
                o.put("duration", duration);
                notifyListeners("segment", o, true);
            }
            @Override public void onStopped(String sessionId, @Nullable String error) {
                JSObject o = new JSObject();
                o.put("sessionId", sessionId);
                if (error != null) o.put("error", error);
                notifyListeners("stopped", o, true);
            }
        };
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMicrophone");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) {
            // The notification shows the recording is running; recording works without it.
            requestPermissionForAlias("notifications", call, "afterNotifications");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterMicrophone(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission was denied.", "NotAllowedError");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void afterNotifications(PluginCall call) { begin(call); }

    private void begin(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) { call.reject("sessionId is required"); return; }
        RecorderService running = RecorderService.instance;
        if (running != null && running.isRunning()) { call.reject("Already recording.", "InvalidStateError"); return; }
        JSObject limits = call.getObject("limits");
        if (limits != null) {
            RecorderService.minSec = limits.getInteger("min", 50);
            RecorderService.targetSec = limits.getInteger("target", 60);
            RecorderService.maxSec = limits.getInteger("max", 70);
        }
        Intent i = new Intent(getContext(), RecorderService.class)
            .setAction(RecorderService.ACTION_START)
            .putExtra(RecorderService.EXTRA_SESSION, sessionId)
            .putExtra(RecorderService.EXTRA_TITLE, call.getString("title", ""));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) { send(RecorderService.ACTION_PAUSE); call.resolve(); }

    @PluginMethod
    public void resume(PluginCall call) { send(RecorderService.ACTION_RESUME); call.resolve(); }

    /** Stop and write the last piece. Resolves once everything is on disk. */
    @PluginMethod
    public void stop(PluginCall call) {
        new Thread(() -> {
            RecorderService s = RecorderService.instance;
            if (s != null) s.finish();
            call.resolve();
        }).start();
    }

    @PluginMethod
    public void status(PluginCall call) {
        RecorderService s = RecorderService.instance;
        JSObject o = new JSObject();
        boolean on = s != null && s.isRunning();
        o.put("recording", on);
        o.put("paused", on && s.isPaused());
        o.put("sessionId", on ? s.sessionId() : null);
        o.put("elapsed", on ? s.elapsedMs() / 1000.0 : 0);
        o.put("level", on ? s.level() : 0);
        call.resolve(o);
    }

    /** Saved pieces of a session, oldest first. The growing tail of a live recording is left out. */
    @PluginMethod
    public void list(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        RecorderService s = RecorderService.instance;
        boolean live = s != null && s.isRunning() && sessionId.equals(s.sessionId());
        JSArray items = new JSArray();
        for (Segments.Item it : Segments.list(RecorderService.dirFor(getContext(), sessionId))) {
            if (it.tail && live) continue;
            JSObject o = new JSObject();
            o.put("name", it.name);
            o.put("start", it.startSample / (double) RecorderService.RATE);
            o.put("duration", it.samples / (double) RecorderService.RATE);
            o.put("tail", it.tail);
            items.put(o);
        }
        JSObject out = new JSObject();
        out.put("items", items);
        call.resolve(out);
    }

    /** One piece as base64 16-bit little-endian PCM at 16 kHz. */
    @PluginMethod
    public void read(PluginCall call) {
        File f = file(call);
        if (f == null) return;
        try {
            byte[] bytes = Files.readAllBytes(f.toPath());
            JSObject o = new JSObject();
            o.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(o);
        } catch (IOException e) {
            call.reject("Could not read " + f.getName());
        }
    }

    /** Delete a piece once the web app has saved it. */
    @PluginMethod
    public void remove(PluginCall call) {
        File f = file(call);
        if (f == null) return;
        //noinspection ResultOfMethodCallIgnored
        f.delete();
        File dir = f.getParentFile();
        String[] left = dir != null ? dir.list() : null;
        if (left != null && left.length == 0) //noinspection ResultOfMethodCallIgnored
            dir.delete();
        call.resolve();
    }

    @Nullable
    private File file(PluginCall call) {
        String name = call.getString("name");
        if (!Segments.validName(name)) { call.reject("Bad piece name"); return null; }
        return new File(RecorderService.dirFor(getContext(), call.getString("sessionId", "")), name);
    }

    private void send(String action) {
        if (RecorderService.instance == null) return;
        getContext().startService(new Intent(getContext(), RecorderService.class).setAction(action));
    }
}
