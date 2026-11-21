import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { audioStore } from '../../src/features/lectures/audioStore';
import { LectureSession } from '../../src/features/lectures/session';
import { KeepRecorder, RecordingError } from '../../src/features/lectures/recording';
import { megabytes } from '../../src/features/lectures/KeepRecordingDialog';

const repo = () => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    create: vi.fn(async () => { rows.set('lecture-1', {}); return { id: 'lecture-1' } as never; }),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => { rows.set(id, { ...rows.get(id), ...patch }); }),
  };
};
const NEW = { owner: 'keeper', source: 'record' as const, title: 'Biology', language: 'en' as const, slidesText: null };
const clip = (text: string) => new Blob([text], { type: 'audio/webm;codecs=opus' });

describe('keeping the recording', () => {
  it('joins the saved slices in order', async () => {
    await audioStore.putClip('d1', 1, clip('B'));
    await audioStore.putClip('d1', 0, clip('A'));
    await audioStore.putClip('other', 0, clip('X'));
    const blob = await audioStore.recording('d1');
    expect(await blob!.text()).toBe('AB');
    expect(blob!.type).toBe('audio/webm;codecs=opus');
    expect(await audioStore.recording('none')).toBeNull();
    await audioStore.clearRecording('d1');
    expect(await audioStore.recording('d1')).toBeNull();
    expect(await audioStore.recording('other')).not.toBeNull();
  });

  it('uploads a kept recording when the lecture is saved, then deletes the local copy', async () => {
    const saveRecording = vi.fn(async () => {});
    const s = await LectureSession.start(NEW, {}, { repo: repo(), saveRecording });
    await audioStore.putClip(s.draft.id, 0, clip('audio'));
    await s.stopRecording();
    expect((await s.recording())?.size).toBe(5);
    await s.setKeepAudio(true);
    expect((await audioStore.getDraft(s.draft.id))?.keepAudio).toBe(true);
    expect(await s.finalize()).toBe('lecture-1');
    expect(saveRecording).toHaveBeenCalledWith('lecture-1', expect.any(Blob));
    expect(await audioStore.recording(s.draft.id)).toBeNull();
  });

  it('deletes the copy straight away when the student says delete', async () => {
    const saveRecording = vi.fn(async () => {});
    const s = await LectureSession.start(NEW, {}, { repo: repo(), saveRecording });
    await audioStore.putClip(s.draft.id, 0, clip('audio'));
    await s.setKeepAudio(false);
    expect(await s.recording()).toBeNull();
    await s.finalize();
    expect(saveRecording).not.toHaveBeenCalled();
  });

  it('a recording that can\'t be kept doesn\'t stop the lecture; a network error does', async () => {
    const tooBig = await LectureSession.start(NEW, {}, { repo: repo(), saveRecording: async () => { throw new RecordingError('limit'); } });
    await audioStore.putClip(tooBig.draft.id, 0, clip('audio'));
    await tooBig.setKeepAudio(true);
    await tooBig.finalize();
    expect(tooBig.recordingProblem).toBe('limit');

    const offline = await LectureSession.start(NEW, {}, { repo: repo(), saveRecording: async () => { throw new TypeError('Failed to fetch'); } });
    await audioStore.putClip(offline.draft.id, 0, clip('audio'));
    await offline.setKeepAudio(true);
    await expect(offline.finalize()).rejects.toThrow('Failed to fetch');
    // The draft and its recording stay, to try again.
    expect(await audioStore.recording(offline.draft.id)).not.toBeNull();
    await offline.discard();
  });

  it('records slices with the browser encoder and waits for the last one on stop', async () => {
    const saved: [number, string][] = [];
    class FakeRecorder {
      static isTypeSupported = (t: string) => t === 'audio/mp4';
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      private stopFns: (() => void)[] = [];
      constructor(_s: unknown, public o: { mimeType: string; audioBitsPerSecond: number }) {}
      start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob(['one']) }); }
      pause() { this.state = 'paused'; }
      resume() { this.state = 'recording'; }
      addEventListener(_: string, fn: () => void) { this.stopFns.push(fn); }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['two']) }); this.stopFns.forEach((f) => f()); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const k = new KeepRecorder('d2', async (_d, seq, blob) => { await new Promise((r) => setTimeout(r, 5)); saved.push([seq, await blob.text()]); });
    expect(k.start({} as MediaStream)).toBe(true);
    k.pause();
    k.resume();
    await k.stop();
    expect(saved).toEqual([[0, 'one'], [1, 'two']]);
    vi.unstubAllGlobals();
    // No encoder in this browser: the lecture is recorded without a copy.
    expect(new KeepRecorder('d3').start({} as MediaStream)).toBe(false);
  });

  it('shows sizes in MB', () => {
    expect(megabytes(5 * 1024 * 1024)).toBe(5);
    expect(megabytes(1)).toBe(0.1);
    expect(megabytes(1.26 * 1024 * 1024)).toBe(1.3);
  });
});
