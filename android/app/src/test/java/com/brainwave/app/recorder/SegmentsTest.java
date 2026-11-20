package com.brainwave.app.recorder;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.nio.file.Files;
import java.util.List;

import org.junit.Test;

public class SegmentsTest {
    private static final int RATE = 16_000;

    private static short[] speech(int seconds, double... pausesAt) {
        short[] s = new short[seconds * RATE];
        for (int i = 0; i < s.length; i++) s[i] = (short) (9000 * Math.sin(2 * Math.PI * 220 * i / RATE));
        for (double p : pausesAt) {
            int from = (int) (p * RATE), to = (int) ((p + 0.4) * RATE);
            for (int i = from; i < to; i++) s[i] = 20;
        }
        return s;
    }

    @Test public void cutsInThePauseBetween50And70Seconds() {
        int at = Segments.quietCut(speech(90, 57.3), 90 * RATE, RATE, 50, 60, 70);
        assertTrue(at / (double) RATE > 57.3 && at / (double) RATE < 57.7);
    }

    @Test public void ignoresPausesOutsideTheRangeAndAimsForAMinute() {
        double at = Segments.quietCut(speech(90, 20, 45, 75), 90 * RATE, RATE, 50, 60, 70) / (double) RATE;
        assertTrue(Math.abs(at - 60) < 0.5);
    }

    @Test public void doesNotCutShortAudio() {
        assertEquals(65 * RATE, Segments.quietCut(speech(65), 65 * RATE, RATE, 50, 60, 70));
    }

    @Test public void listsPiecesInOrderAndFindsTheEnd() throws Exception {
        File dir = Files.createTempDirectory("seg").toFile();
        short[] s = speech(3);
        Segments.write(new File(dir, "seg-0.pcm"), s, 0, RATE);
        Segments.write(new File(dir, "seg-16000.pcm"), s, 0, RATE);
        Files.write(new File(dir, "tail-32000.part").toPath(), new byte[RATE]); // half a second
        Files.write(new File(dir, "notes.txt").toPath(), new byte[10]);
        List<Segments.Item> items = Segments.list(dir);
        assertEquals(3, items.size());
        assertEquals("seg-0.pcm", items.get(0).name);
        assertTrue(items.get(2).tail);
        assertEquals(32_000 + 8_000, Segments.endOf(dir));
        assertFalse(new File(dir, "seg-0.pcm.tmp").exists());
    }

    @Test public void onlyAcceptsSafeNames() {
        assertTrue(Segments.validName("seg-123.pcm"));
        assertTrue(Segments.validName("tail-0.part"));
        assertFalse(Segments.validName("../secret"));
        assertFalse(Segments.validName("seg-1.pcm/../../x"));
    }
}
