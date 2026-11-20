import { describe, expect, it } from 'vitest';
import { bytesToBase64, downsample, encodeWav, formatTime, isSilent, splitIntoChunks } from '../../src/features/lectures/audio';
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
