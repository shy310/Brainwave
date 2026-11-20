package com.brainwave.app.recorder;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Pieces of a recording on disk, and where to cut them. Pure Java, unit-tested. */
public final class Segments {
    private Segments() { }

    /** A saved piece: a finished {@code seg-*.pcm} or a leftover {@code tail-*.part}. */
    public static final class Item {
        public final String name;
        public final long startSample;
        public final long samples;
        public final boolean tail;

        Item(String name, long startSample, long samples, boolean tail) {
            this.name = name;
            this.startSample = startSample;
            this.samples = samples;
            this.tail = tail;
        }
    }

    /**
     * The middle of the quietest 0.3 s window between {@code min} and {@code max}
     * seconds. Windows within 1% of the quietest count as equally quiet; then the
     * one nearest {@code target} wins. Same rule as the web recorder (audio.ts).
     */
    public static int quietCut(short[] s, int length, int rate, int min, int target, int max) {
        int hi = max * rate;
        if (length <= hi) return length;
        int lo = min * rate, goal = target * rate;
        int win = Math.max(1, rate * 3 / 10), hop = Math.max(1, win / 6), half = win / 2;
        int from = Math.max(0, lo - half), to = Math.min(length, hi + half);
        double[] prefix = new double[to - from + 1];
        for (int i = from; i < to; i++) {
            double v = s[i] / 32768.0;
            prefix[i - from + 1] = prefix[i - from] + v * v;
        }
        List<int[]> centres = new ArrayList<>();
        List<Double> energies = new ArrayList<>();
        double quietest = Double.MAX_VALUE;
        for (int c = lo; c <= hi; c += hop) {
            int a = Math.max(from, c - half), b = Math.min(to, a + win);
            double e = (prefix[b - from] - prefix[a - from]) / Math.max(1, b - a);
            centres.add(new int[] { c });
            energies.add(e);
            quietest = Math.min(quietest, e);
        }
        double limit = quietest * 1.01 + 1e-10;
        int best = -1;
        for (int i = 0; i < centres.size(); i++) {
            int c = centres.get(i)[0];
            if (energies.get(i) <= limit && (best < 0 || Math.abs(c - goal) < Math.abs(best - goal))) best = c;
        }
        return best < 0 ? hi : best;
    }

    /** Write 16-bit little-endian PCM atomically (temp file, then rename). */
    public static void write(File file, short[] s, int from, int to) throws IOException {
        File tmp = new File(file.getPath() + ".tmp");
        ByteBuffer b = ByteBuffer.allocate((to - from) * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = from; i < to; i++) b.putShort(s[i]);
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(b.array());
            out.getFD().sync();
        }
        if (!tmp.renameTo(file)) throw new IOException("Could not save " + file.getName());
    }

    /** Saved pieces in a session folder, oldest first. */
    public static List<Item> list(File dir) {
        List<Item> out = new ArrayList<>();
        File[] files = dir.listFiles();
        if (files == null) return out;
        for (File f : files) {
            String n = f.getName();
            boolean seg = n.startsWith("seg-") && n.endsWith(".pcm");
            boolean tail = n.startsWith("tail-") && n.endsWith(".part");
            if (!seg && !tail) continue;
            try {
                long start = Long.parseLong(n.substring(seg ? 4 : 5, n.length() - (seg ? 4 : 5)));
                long samples = f.length() / 2;
                if (samples > 0) out.add(new Item(n, start, samples, tail));
            } catch (NumberFormatException ignored) { }
        }
        Collections.sort(out, (x, y) -> Long.compare(x.startSample, y.startSample));
        return out;
    }

    /** The sample where the saved audio ends, so a restarted recording continues after it. */
    public static long endOf(File dir) {
        long end = 0;
        for (Item i : list(dir)) end = Math.max(end, i.startSample + i.samples);
        return end;
    }

    /** Only safe names inside the session folder. */
    public static boolean validName(String name) {
        return name != null && name.matches("(seg-\\d+\\.pcm|tail-\\d+\\.part)");
    }
}
