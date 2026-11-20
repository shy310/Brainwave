import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// A speech-like test recording for Chrome's fake microphone: "syllables" of a
// voice-like tone (a 160 Hz buzz with harmonics and a soft envelope) in
// "words", with short pauses between words. Pauses are where a recorder
// should cut. Chrome loops the file.

export const SAMPLE_RATE = 48_000;
/** Word lengths in seconds; each word is followed by a pause. */
export const WORDS = [0.55, 0.8, 0.45, 0.9, 0.6, 0.7, 0.5, 0.85];
export const PAUSE = 0.32;

export const lectureAudio = (): Buffer => {
  const parts: number[] = [];
  let t = 0;
  for (const len of WORDS) {
    const n = Math.round(len * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 0.5; // soft attack and release
      const x = i / SAMPLE_RATE + t;
      const v = 0.5 * Math.sin(2 * Math.PI * 160 * x) + 0.25 * Math.sin(2 * Math.PI * 320 * x) + 0.12 * Math.sin(2 * Math.PI * 480 * x);
      parts.push(0.6 * env * v);
    }
    t += len;
    for (let i = 0; i < Math.round(PAUSE * SAMPLE_RATE); i++) parts.push(0); // a pause between words
    t += PAUSE;
  }
  const buf = Buffer.alloc(44 + parts.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + parts.length * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SAMPLE_RATE, 24); buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(parts.length * 2, 40);
  parts.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return buf;
};

export const writeLectureAudio = (path: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lectureAudio());
  return path;
};
