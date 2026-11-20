// Local, durable storage for lecture audio that has not been transcribed yet.
//
// Every recorded or uploaded piece is written here before it is sent for
// transcription, and is deleted only in the same transaction that saves its
// transcript text. If the tab is closed, the browser crashes, the network
// drops or the AI quota runs out, nothing is lost: the next visit can recover
// the recording and transcribe what is left. Audio never leaves this device
// except to be transcribed.

import type { LectureLanguage, Segment } from '@shared/lectures';

export type DraftSource = 'record' | 'upload';

export interface Draft {
  id: string;
  /** Who made it (user id, or the demo student id). Other accounts never see it. */
  owner: string;
  /** The lecture on the server, once it has been created. */
  lectureId: string | null;
  source: DraftSource;
  title: string;
  language: LectureLanguage;
  slidesText: string | null;
  /** Folder for the new lecture (from the class schedule). */
  folderId?: string | null;
  /** 'recording' until the recorder is stopped on purpose. */
  state: 'recording' | 'stopped';
  /** Seconds of audio so far. */
  duration: number;
  /** Index for the next piece. */
  nextIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface PieceMeta { draftId: string; index: number; start: number; duration: number }
export interface SavedSegment extends Segment { draftId: string; index: number; /** Paragraphs with lecture times, when the transcriber gave them. */ parts?: Segment[] }

const DB_NAME = 'bw-lecture-audio';
const VERSION = 1;
const DRAFTS = 'drafts';
const PIECES = 'pieces'; // PieceMeta, small
const AUDIO = 'audio'; // { draftId, index, pcm: Int16Array }
const SEGMENTS = 'segments'; // SavedSegment
const CHECKPOINTS = 'checkpoints'; // { draftId, start, pcm }

type Key = [string, number];
const range = (draftId: string) => IDBKeyRange.bound([draftId, -Infinity], [draftId, Infinity]);

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  tx.onerror = () => reject(tx.error);
});

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, VERSION);
    open.onupgradeneeded = () => {
      const d = open.result;
      d.createObjectStore(DRAFTS, { keyPath: 'id' });
      d.createObjectStore(PIECES, { keyPath: ['draftId', 'index'] });
      d.createObjectStore(AUDIO, { keyPath: ['draftId', 'index'] });
      d.createObjectStore(SEGMENTS, { keyPath: ['draftId', 'index'] });
      d.createObjectStore(CHECKPOINTS, { keyPath: 'draftId' });
    };
    open.onsuccess = () => {
      open.result.onversionchange = () => { open.result.close(); dbPromise = null; };
      resolve(open.result);
    };
    open.onerror = () => { dbPromise = null; reject(open.error); };
  });
  return dbPromise;
};

const tx = async (stores: string[], mode: IDBTransactionMode) => (await db()).transaction(stores, mode);

export const audioStore = {
  available: () => typeof indexedDB !== 'undefined',

  async createDraft(draft: Draft) {
    const t = await tx([DRAFTS], 'readwrite');
    t.objectStore(DRAFTS).put(draft);
    await done(t);
  },

  async getDraft(id: string): Promise<Draft | undefined> {
    const t = await tx([DRAFTS], 'readonly');
    return req(t.objectStore(DRAFTS).get(id));
  },

  async updateDraft(id: string, patch: Partial<Omit<Draft, 'id'>>): Promise<Draft | undefined> {
    const t = await tx([DRAFTS], 'readwrite');
    const store = t.objectStore(DRAFTS);
    let next: Draft | undefined;
    // Read and write in the same callback: awaiting between requests can let the transaction commit early.
    const get = store.get(id);
    get.onsuccess = () => {
      const current = get.result as Draft | undefined;
      if (!current) return;
      next = { ...current, ...patch, updatedAt: Date.now() };
      store.put(next);
    };
    await done(t);
    return next;
  },

  async listDrafts(owner: string): Promise<Draft[]> {
    const t = await tx([DRAFTS], 'readonly');
    const all = await req<Draft[]>(t.objectStore(DRAFTS).getAll());
    return all.filter((d) => d.owner === owner).sort((a, b) => b.createdAt - a.createdAt);
  },

  /** Save a piece's audio. It stays until `commitPiece` saves its text. */
  async putPiece(meta: PieceMeta, pcm: Int16Array) {
    const t = await tx([PIECES, AUDIO], 'readwrite');
    t.objectStore(PIECES).put(meta);
    t.objectStore(AUDIO).put({ draftId: meta.draftId, index: meta.index, pcm });
    await done(t);
  },

  async listPieces(draftId: string): Promise<PieceMeta[]> {
    const t = await tx([PIECES], 'readonly');
    const all = await req<PieceMeta[]>(t.objectStore(PIECES).getAll(range(draftId)));
    return all.sort((a, b) => a.index - b.index);
  },

  async getAudio(draftId: string, index: number): Promise<Int16Array | undefined> {
    const t = await tx([AUDIO], 'readonly');
    const row = await req<{ pcm: Int16Array } | undefined>(t.objectStore(AUDIO).get([draftId, index] as Key));
    return row?.pcm;
  },

  /**
   * A piece was transcribed: save its text and delete its audio in one
   * transaction, so the audio can't disappear without the text being saved.
   * `text` may be empty (no speech) — then only the audio is removed.
   */
  async commitPiece(draftId: string, index: number, segment: Segment, parts?: Segment[]) {
    const t = await tx([PIECES, AUDIO, SEGMENTS], 'readwrite');
    if (segment.text) t.objectStore(SEGMENTS).put({ draftId, index, ...segment, ...(parts?.length ? { parts } : {}) } satisfies SavedSegment);
    t.objectStore(PIECES).delete([draftId, index] as Key);
    t.objectStore(AUDIO).delete([draftId, index] as Key);
    await done(t);
  },

  async listSegments(draftId: string): Promise<SavedSegment[]> {
    const t = await tx([SEGMENTS], 'readonly');
    const all = await req<SavedSegment[]>(t.objectStore(SEGMENTS).getAll(range(draftId)));
    return all.sort((a, b) => a.index - b.index);
  },

  /** The latest few seconds of a live recording that are not a piece yet. */
  async putCheckpoint(draftId: string, start: number, pcm: Int16Array) {
    const t = await tx([CHECKPOINTS], 'readwrite');
    t.objectStore(CHECKPOINTS).put({ draftId, start, pcm });
    await done(t);
  },

  async getCheckpoint(draftId: string): Promise<{ start: number; pcm: Int16Array } | undefined> {
    const t = await tx([CHECKPOINTS], 'readonly');
    return req(t.objectStore(CHECKPOINTS).get(draftId));
  },

  async clearCheckpoint(draftId: string) {
    const t = await tx([CHECKPOINTS], 'readwrite');
    t.objectStore(CHECKPOINTS).delete(draftId);
    await done(t);
  },

  /**
   * Turn a leftover checkpoint into a regular piece (after a crash). Done in
   * one transaction so the audio is never in neither place.
   */
  async promoteCheckpoint(draftId: string, index: number): Promise<PieceMeta | null> {
    const t = await tx([CHECKPOINTS, PIECES, AUDIO, DRAFTS], 'readwrite');
    let meta: PieceMeta | null = null;
    const cpReq = t.objectStore(CHECKPOINTS).get(draftId);
    cpReq.onsuccess = () => {
      const cp = cpReq.result as { start: number; pcm: Int16Array } | undefined;
      const draftReq = t.objectStore(DRAFTS).get(draftId);
      draftReq.onsuccess = () => {
        const draft = draftReq.result as Draft | undefined;
        if (cp && cp.pcm.length && draft) {
          meta = { draftId, index, start: cp.start, duration: cp.pcm.length / 16_000 };
          t.objectStore(PIECES).put(meta);
          t.objectStore(AUDIO).put({ draftId, index, pcm: cp.pcm });
          t.objectStore(DRAFTS).put({
            ...draft, nextIndex: Math.max(draft.nextIndex, index + 1),
            duration: Math.max(draft.duration, meta.start + meta.duration), updatedAt: Date.now(),
          });
        }
        t.objectStore(CHECKPOINTS).delete(draftId);
      };
    };
    await done(t);
    return meta;
  },

  async deleteDraft(draftId: string) {
    const t = await tx([DRAFTS, PIECES, AUDIO, SEGMENTS, CHECKPOINTS], 'readwrite');
    t.objectStore(DRAFTS).delete(draftId);
    t.objectStore(PIECES).delete(range(draftId));
    t.objectStore(AUDIO).delete(range(draftId));
    t.objectStore(SEGMENTS).delete(range(draftId));
    t.objectStore(CHECKPOINTS).delete(draftId);
    await done(t);
  },

  /** For tests: forget the open connection. */
  _reset() { dbPromise = null; },
};

export type AudioStore = typeof audioStore;

/** Ask the browser not to evict our data, and report how many minutes of audio fit. */
export const checkStorage = async (bytesPerMinute: number): Promise<{ persisted: boolean; minutesFree: number | null }> => {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s) return { persisted: false, minutesFree: null };
  const persisted = await s.persist?.().catch(() => false) ?? false;
  const est = await s.estimate?.().catch(() => null);
  if (!est?.quota) return { persisted, minutesFree: null };
  return { persisted, minutesFree: Math.floor(Math.max(0, est.quota - (est.usage ?? 0)) / bytesPerMinute) };
};
