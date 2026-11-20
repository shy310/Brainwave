import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/api';
import { audioStore } from '../../src/features/lectures/audioStore';
import { LectureSession, recoverableDrafts } from '../../src/features/lectures/session';
import { TranscriptionQueue, backoff, classify, type TranscribeFn } from '../../src/features/lectures/transcriber';
import type { Segment } from '../../shared/lectures';

const RATE = 16000;
const tone = (seconds: number) => {
  const s = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < s.length; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return s;
};

/** A fake server lecture table. */
const fakeRepo = () => {
  const rows = new Map<string, { segments: Segment[]; status: string; duration_sec: number }>();
  let n = 0;
  let down = false;
  return {
    rows,
    setDown: (v: boolean) => { down = v; },
    create: vi.fn(async () => {
      if (down) throw new TypeError('Failed to fetch');
      const id = `lecture-${++n}`;
      rows.set(id, { segments: [], status: 'transcribing', duration_sec: 0 });
      return { id } as never;
    }),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      if (down) throw new TypeError('Failed to fetch');
      rows.set(id, { ...rows.get(id)!, ...patch } as never);
    }),
  };
};

/** Transcribes by reporting which piece it heard (by length), with a switch to fail. */
const fakeAi = () => {
  let fail: unknown = null;
  let calls = 0;
  const fn: TranscribeFn = async (wav) => {
    calls++;
    if (fail) throw fail;
    return `heard ${wav.length}`;
  };
  return { fn, setFail: (e: unknown) => { fail = e; }, get calls() { return calls; } };
};

const NEW = { owner: 'student-1', source: 'record' as const, title: 'Calculus', language: 'en' as const, slidesText: null };
const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  for (const d of await audioStore.listDrafts('student-1')) await audioStore.deleteDraft(d.id);
});
afterEach(() => { vi.useRealTimers(); });

describe('local audio queue', () => {
  it('keeps a piece until its text is saved, then deletes the audio', async () => {
    const repo = fakeRepo();
    const ai = fakeAi();
    const s = await LectureSession.start(NEW, {}, { repo, transcribe: ai.fn, isOnline: () => true });
    ai.setFail(new TypeError('Failed to fetch'));
    await s.addPiece(tone(2), 0);
    await flush();
    expect(await audioStore.listPieces(s.draft.id)).toHaveLength(1); // still there
    expect(s.status.blocked).toBe('offline');

    ai.setFail(null);
    s.queue.retryNow();
    await s.queue.idle();
    expect(await audioStore.listPieces(s.draft.id)).toHaveLength(0);
    expect(await audioStore.getAudio(s.draft.id, 0)).toBeUndefined();
    expect((await audioStore.listSegments(s.draft.id)).map((x) => x.text)).toEqual([expect.stringMatching(/^heard/)]);
    s.close();
  });

  it('skips silent pieces without sending them', async () => {
    const ai = fakeAi();
    const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe: ai.fn, isOnline: () => true });
    await s.addPiece(new Float32Array(RATE * 2), 0);
    await s.queue.idle();
    expect(ai.calls).toBe(0);
    expect(s.draft.nextIndex).toBe(1);
    expect(s.draft.duration).toBe(2);
    s.close();
  });

  it('pauses on an AI limit and keeps every piece; resumes later', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const ai = fakeAi();
    const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe: ai.fn, isOnline: () => true });
    ai.setFail(new ApiError('limit', 429));
    for (let i = 0; i < 4; i++) await s.addPiece(tone(1), i);
    await flush();
    expect(s.status.blocked).toBe('limit');
    expect(s.status.pending).toBe(4);
    expect(await audioStore.listPieces(s.draft.id)).toHaveLength(4);

    ai.setFail(null); // the limit resets
    await vi.advanceTimersByTimeAsync(31_000);
    await s.queue.idle();
    expect(s.status).toMatchObject({ pending: 0, blocked: null });
    expect(await audioStore.listSegments(s.draft.id)).toHaveLength(4);
    s.close();
  });

  it('treats sign-in, credit and outage errors as pauses, never as gaps', async () => {
    for (const [status, reason] of [[401, 'signedOut'], [402, 'credits'], [503, 'unavailable']] as const) {
      const ai = fakeAi();
      const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe: ai.fn, isOnline: () => true });
      ai.setFail(new ApiError('x', status));
      await s.addPiece(tone(1), 0);
      await flush();
      expect(s.status.blocked).toBe(reason);
      expect(await audioStore.listPieces(s.draft.id)).toHaveLength(1);
      ai.setFail(null);
      s.queue.retryNow();
      await s.queue.idle();
      expect(await audioStore.listSegments(s.draft.id)).toHaveLength(1);
      s.close();
    }
  });

  it('retries a flaky server quickly before pausing', async () => {
    let n = 0;
    const transcribe: TranscribeFn = async () => { if (n++ < 2) throw new ApiError('bad gateway', 502); return 'ok'; };
    const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe, isOnline: () => true, retryDelays: [1, 1] });
    await s.addPiece(tone(1), 0);
    await s.queue.idle();
    expect(n).toBe(3);
    expect(s.status.blocked).toBeNull();
    s.close();
  });
});

describe('recovery after the tab was closed', () => {
  it('restores the transcript, turns the last checkpoint into a piece and transcribes the rest', async () => {
    const repo = fakeRepo();
    const ai = fakeAi();
    const first = await LectureSession.start(NEW, {}, { repo, transcribe: ai.fn, isOnline: () => true });
    // Minutes 0–2 were transcribed…
    await first.addPiece(tone(1), 0);
    await first.addPiece(tone(1), 60);
    await first.queue.idle();
    // …then the network dropped for minutes 2–3, and the tab was killed with 1.5 s unsaved in a checkpoint.
    ai.setFail(new TypeError('Failed to fetch'));
    await first.addPiece(tone(1), 120);
    await first.checkpoint(tone(1.5), 180);
    await flush();
    first.close(); // the tab is gone; nothing else runs

    const drafts = await recoverableDrafts('student-1');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].pendingSeconds).toBeCloseTo(2.5, 1);
    expect(await recoverableDrafts('someone-else')).toHaveLength(0);

    ai.setFail(null);
    const seen: Segment[][] = [];
    const again = (await LectureSession.resume(first.draft.id, { onTranscript: (s) => seen.push(s) }, { repo, transcribe: ai.fn, isOnline: () => true }))!;
    expect(seen[0].map((s) => s.start)).toEqual([0, 60]); // restored straight away
    await again.queue.idle();
    expect(again.transcript().map((s) => s.start)).toEqual([0, 60, 120, 180]); // no gaps
    expect(again.draft.duration).toBeCloseTo(181.5, 1);

    const id = await again.finalize();
    expect(repo.rows.get(id)).toMatchObject({ status: 'ready', duration_sec: 182 });
    expect(repo.rows.get(id)!.segments).toHaveLength(4);
    expect(await audioStore.getDraft(first.draft.id)).toBeUndefined(); // cleaned up only after saving
  });

  it('records without a connection and creates the lecture once back online', async () => {
    const repo = fakeRepo();
    repo.setDown(true);
    const ai = fakeAi();
    const s = await LectureSession.start(NEW, {}, { repo, transcribe: ai.fn, isOnline: () => true });
    await s.addPiece(tone(1), 0);
    await s.queue.idle();
    expect(s.lectureId).toBeNull();
    await expect(s.finalize()).rejects.toThrow();
    expect(await audioStore.getDraft(s.draft.id)).toBeDefined(); // nothing lost

    repo.setDown(false);
    const id = await s.finalize();
    expect(repo.rows.get(id)!.segments).toHaveLength(1);
  });

  it('a stopped recording leaves no checkpoint behind', async () => {
    const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe: fakeAi().fn, isOnline: () => true });
    await s.checkpoint(tone(1), 0);
    await s.addPiece(tone(1), 0);
    await s.stopRecording();
    expect(await audioStore.getCheckpoint(s.draft.id)).toBeUndefined();
    s.close();
  });
});

describe('retry rules', () => {
  it('classifies failures', () => {
    expect(classify(new TypeError('Failed to fetch'), true)).toBe('offline');
    expect(classify(new ApiError('x', 500), false)).toBe('offline');
    expect(classify(new ApiError('x', 429), true)).toBe('limit');
    expect(classify(new ApiError('x', 402), true)).toBe('credits');
    expect(classify(new ApiError('x', 401), true)).toBe('signedOut');
    expect(classify(new ApiError('x', 503), true)).toBe('unavailable');
    expect(classify(new ApiError('x', 502), true)).toBeNull();
  });

  it('backs off and caps the wait', () => {
    expect(backoff('limit', 1)).toBe(30_000);
    expect(backoff('limit', 2)).toBe(60_000);
    expect(backoff('limit', 20)).toBe(15 * 60_000);
    expect(backoff('signedOut', 1)).toBeNull();
  });

  it('a queue built directly picks up pieces saved earlier', async () => {
    const s = await LectureSession.start(NEW, {}, { repo: fakeRepo(), transcribe: fakeAi().fn, isOnline: () => true });
    s.close();
    await audioStore.putPiece({ draftId: s.draft.id, index: 0, start: 0, duration: 1 }, new Int16Array(RATE).fill(5000));
    const got: number[] = [];
    const q = new TranscriptionQueue({ draftId: s.draft.id, store: audioStore, language: 'en', onSegment: (i) => got.push(i), transcribe: async () => 'x', isOnline: () => true });
    await q.loadSaved();
    await q.idle();
    expect(got).toEqual([0]);
    q.stop();
  });
});

describe('lecture library', async () => {
  const { arrangeLectures } = await import('../../src/features/lectures/folders');
  const L = (title: string, day: number, folder_id: string | null = null) => ({ title, created_at: `2026-11-${String(day).padStart(2, '0')}T10:00:00Z`, folder_id });
  const items = [L('Calculus week 2', 3, 'math'), L('', 5), L('calculus week 10', 9, 'math'), L('אלגברה לינארית', 7, 'math'), L('History', 1, 'hist')];
  const arrange = (o: Partial<Parameters<typeof arrangeLectures>[1]>) =>
    arrangeLectures(items, { query: '', folder: 'all', sort: 'newest', untitled: () => 'Untitled', locale: 'en', ...o }).map((l) => l.title || 'Untitled');

  it('sorts newest, oldest and by title (numbers in order, any case)', () => {
    expect(arrange({})).toEqual(['calculus week 10', 'אלגברה לינארית', 'Untitled', 'Calculus week 2', 'History']);
    expect(arrange({ sort: 'oldest' })[0]).toBe('History');
    expect(arrange({ sort: 'title' }).slice(0, 2)).toEqual(['Calculus week 2', 'calculus week 10']);
  });

  it('filters by folder and by search, in English and Hebrew', () => {
    expect(arrange({ folder: 'math' })).toHaveLength(3);
    expect(arrange({ folder: 'none' })).toEqual(['Untitled']);
    expect(arrange({ query: 'CALCULUS' })).toEqual(['calculus week 10', 'Calculus week 2']);
    expect(arrange({ query: 'לינארית' })).toEqual(['אלגברה לינארית']);
    expect(arrange({ query: 'untitled' })).toEqual(['Untitled']);
  });
});
