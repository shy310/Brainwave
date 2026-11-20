import { describe, expect, it } from 'vitest';
import {
  bytesToBase64, downsample, encodeWav, formatTime, fromPcm16, isSilent, quietCut, splitAtQuietPoints, splitIntoChunks, toPcm16,
} from '../../src/features/lectures/audio';
import { MAX_AUDIO_BASE64, TranscribeInputSchema } from '../../shared/lectures';

const tone = (seconds: number, rate = 16000) => {
  const s = new Float32Array(seconds * rate);
  for (let i = 0; i < s.length; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate);
  return s;
};

describe('lecture audio', () => {
  it('writes a valid 16 kHz mono WAV header', () => {
    const wav = encodeWav(tone(1));
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(32000);
    expect(wav.length).toBe(44 + 32000);
  });

  it('keeps a full one-minute piece under the request size limit', () => {
    const b64 = bytesToBase64(encodeWav(tone(60)));
    expect(b64.length).toBeLessThan(MAX_AUDIO_BASE64);
    expect(TranscribeInputSchema.safeParse({ audio: b64 }).success).toBe(true);
  });

  it('downsamples and splits into one-minute pieces', () => {
    expect(downsample(tone(1, 48000), 48000)).toHaveLength(16000);
    expect(downsample(tone(1, 44100), 44100).length).toBe(16000);
    const pieces = splitIntoChunks(tone(150));
    expect(pieces.map((p) => p.length / 16000)).toEqual([60, 60, 30]);
  });

  it('detects silence', () => {
    expect(isSilent(new Float32Array(16000))).toBe(true);
    expect(isSilent(tone(1))).toBe(false);
  });

  it('formats times', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

describe('cutting at quiet moments', () => {
  const RATE = 16000;
  /** Steady "speech" with a short pause at `pauseAt` seconds. */
  const speechWithPause = (seconds: number, pauses: number[], pauseLen = 0.4) => {
    const s = tone(seconds);
    for (const at of pauses) s.fill(0.001, Math.floor(at * RATE), Math.floor((at + pauseLen) * RATE));
    return s;
  };

  it('ends a piece in the pause between 50 and 70 seconds', () => {
    const at = quietCut(speechWithPause(90, [57.3]));
    expect(at / RATE).toBeGreaterThan(57.3);
    expect(at / RATE).toBeLessThan(57.7);
  });

  it('ignores pauses outside the 50–70 second range', () => {
    const at = quietCut(speechWithPause(90, [20, 45, 75])) / RATE;
    expect(at).toBeGreaterThanOrEqual(50);
    expect(at).toBeLessThanOrEqual(70);
    expect(Math.abs(at - 60)).toBeLessThan(0.5); // no pause in range: as close to a minute as possible
  });

  it('picks the quietest of several pauses', () => {
    const s = speechWithPause(90, [52, 66]);
    s.fill(0, 66 * RATE, Math.floor(66.4 * RATE)); // the second pause is fully silent
    expect(quietCut(s) / RATE).toBeCloseTo(66.2, 0);
  });

  it('does not cut audio shorter than the maximum', () => {
    expect(quietCut(tone(65))).toBe(65 * RATE);
  });

  it('splits a long recording into pieces of 50–70 seconds that cover everything', () => {
    const s = speechWithPause(300, [55, 123, 190, 251]);
    const pieces = splitAtQuietPoints(s);
    expect(pieces.reduce((n, p) => n + p.samples.length, 0)).toBe(s.length);
    pieces.slice(0, -1).forEach((p) => {
      expect(p.samples.length / RATE).toBeGreaterThanOrEqual(50);
      expect(p.samples.length / RATE).toBeLessThanOrEqual(70);
    });
    expect(pieces.map((p) => Math.round(p.start))).toEqual([0, 55, 123, 190, 251]);
    const b64 = bytesToBase64(encodeWav(tone(70)));
    expect(TranscribeInputSchema.safeParse({ audio: b64 }).success).toBe(true); // the longest piece still fits
  });

  it('honours custom limits', () => {
    const pieces = splitAtQuietPoints(tone(10), RATE, { min: 2, target: 3, max: 4 });
    expect(pieces.map((p) => p.samples.length / RATE)).toEqual([3, 3, 4]); // the last 4 s fit in one piece
  });

  it('stores audio as 16-bit PCM without changing the WAV', () => {
    const s = tone(1);
    expect(encodeWav(toPcm16(s))).toEqual(encodeWav(s));
    const back = fromPcm16(toPcm16(s));
    expect(Math.max(...back.map((v, i) => Math.abs(v - s[i])))).toBeLessThan(1e-4);
  });
});

describe('transcript tools', async () => {
  const { findMatches, transcriptText } = await import('../../src/features/lectures/TranscriptPanel');
  it('finds every match, ignoring case, in English and Hebrew', () => {
    expect(findMatches('The derivative. A derivative!', 'DERIVATIVE')).toEqual([[4, 14], [18, 28]]);
    expect(findMatches('הנגזרת של פונקציה היא נגזרת', 'נגזרת')).toEqual([[1, 6], [22, 27]]);
    expect(findMatches('anything', '   ')).toEqual([]);
  });
  it('exports with times for recordings and without for pasted text', () => {
    const segs = [{ start: 0, text: 'Hello.' }, { start: 61, text: ' ' }, { start: 75, text: 'Second part.' }];
    expect(transcriptText(segs, true)).toBe('[0:00] Hello.\n\n[1:15] Second part.');
    expect(transcriptText(segs, false)).toBe('Hello.\n\nSecond part.');
  });
});
