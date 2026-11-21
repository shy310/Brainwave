// The compressed copy of a recording that the student can keep with the lecture.
//
// While a lecture is recorded, the browser's own encoder (MediaRecorder) makes
// a small copy of the same microphone stream: about 0.25 MB a minute, against
// about 2 MB a minute for the audio sent to transcription. It is saved on this
// device every few seconds, like the transcription pieces. When recording
// stops, the student chooses to keep it or delete it. A kept recording goes to
// Supabase Storage (private, in the student's own folder), or stays in this
// browser for demo lectures.

import { supabase } from '@/lib/supabase';
import { audioStore } from './audioStore';
import { lectureRepo, type Lecture } from './repo';

export const AUDIO_BUCKET = 'lecture-audio';
/** Matches the bucket's size limit (migration 0016): about three hours at the bitrate below. */
export const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
/** Kept recordings per student (migration 0016 enforces it too). */
export const MAX_KEPT_RECORDINGS = 30;
const BITRATE = 32_000;
const SLICE_MS = 5_000;

/** Formats the browser can record, best first. Safari records MP4/AAC, the others WebM/Opus. */
const TYPES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

export const recordingType = (): string | null => {
  if (typeof MediaRecorder === 'undefined') return null;
  return TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? null;
};

/** Records a compressed copy of `stream`, saving a slice every few seconds. Never throws: without it the lecture is still recorded. */
export class KeepRecorder {
  private rec: MediaRecorder | null = null;
  private seq = 0;
  private writes: Promise<void> = Promise.resolve();

  constructor(private draftId: string, private save: (draftId: string, seq: number, blob: Blob) => Promise<void> = (d, s, b) => audioStore.putClip(d, s, b)) {}

  start(stream: MediaStream): boolean {
    const mimeType = recordingType();
    if (!mimeType) return false;
    try {
      const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
      rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        const seq = this.seq++;
        this.writes = this.writes.then(() => this.save(this.draftId, seq, e.data)).catch((err) => console.warn('Could not save the recording copy', err));
      };
      rec.start(SLICE_MS);
      this.rec = rec;
      return true;
    } catch (err) {
      console.warn('This browser cannot keep a copy of the recording', err);
      return false;
    }
  }

  pause() { if (this.rec?.state === 'recording') this.rec.pause(); }
  resume() { if (this.rec?.state === 'paused') this.rec.resume(); }

  /** Stop and wait until the last slice is saved. */
  async stop() {
    const rec = this.rec;
    this.rec = null;
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.addEventListener('stop', () => resolve(), { once: true });
        rec.stop();
      });
    }
    await this.writes;
  }
}

export class RecordingError extends Error {
  constructor(public reason: 'too-big' | 'limit') { super(reason); }
}

const extension = (type: string) => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm');

export type KeptAudio = Pick<Lecture, 'id'> & Partial<Pick<Lecture, 'audio_path' | 'audio_type' | 'audio_bytes'>>;

/** Kept recordings: Supabase Storage for accounts, this browser for demo lectures. */
export const recordingRepo = {
  /** Keep `blob` with the lecture. Throws RecordingError when it can't be kept, other errors when it should be tried again. */
  async save(lectureId: string, blob: Blob): Promise<void> {
    if (blob.size > MAX_RECORDING_BYTES) throw new RecordingError('too-big');
    // Storage checks the bare type ("audio/webm", not "audio/webm;codecs=opus").
    const type = (blob.type || 'audio/webm').split(';')[0].trim();
    if (!supabase) {
      await audioStore.putKept(lectureId, blob);
      await lectureRepo.update(lectureId, { audio_path: `local:${lectureId}`, audio_type: type, audio_bytes: blob.size });
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('signed-out');
    const path = `${auth.user.id}/${lectureId}.${extension(type)}`;
    const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, { contentType: type, upsert: true });
    if (error) {
      const status = Number((error as { statusCode?: string | number }).statusCode ?? 0);
      // Row-level security said no: the student keeps the most recordings allowed. 413: too big.
      if (status === 413 || /maximum allowed size|too large/i.test(error.message)) throw new RecordingError('too-big');
      if (status === 403 || /row-level security|policy/i.test(error.message)) throw new RecordingError('limit');
      throw error;
    }
    await lectureRepo.update(lectureId, { audio_path: path, audio_type: type, audio_bytes: blob.size });
  },

  /** Something an <audio> element can play, or null. Signed links last an hour. */
  async url(lecture: KeptAudio): Promise<string | null> {
    if (!lecture.audio_path) return null;
    if (lecture.audio_path.startsWith('local:')) {
      const blob = await audioStore.getKept(lecture.id).catch(() => undefined);
      return blob ? URL.createObjectURL(blob) : null;
    }
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(lecture.audio_path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  /** Delete the recording file. The lecture itself is left alone. */
  async removeFile(lecture: KeptAudio): Promise<void> {
    if (!lecture.audio_path) return;
    if (lecture.audio_path.startsWith('local:')) { await audioStore.deleteKept(lecture.id).catch(() => {}); return; }
    if (!supabase) return;
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([lecture.audio_path]);
    if (error) throw error;
  },

  /** Delete the recording and forget it on the lecture. */
  async remove(lecture: KeptAudio): Promise<void> {
    await this.removeFile(lecture);
    await lectureRepo.update(lecture.id, { audio_path: null, audio_type: null, audio_bytes: null });
  },
};
