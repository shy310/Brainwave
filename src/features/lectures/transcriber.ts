import { ApiError, callAi } from '@/lib/api';
import type { LectureLanguage, Segment } from '@shared/lectures';
import { bytesToBase64, encodeWav, fromPcm16, isSilent } from './audio';
import type { AudioStore, PieceMeta } from './audioStore';

/**
 * Why transcription is paused. Pieces are never dropped: they wait in local
 * storage and are sent again when the reason goes away.
 *  - offline: no connection; resumes on the `online` event.
 *  - limit: the student's AI limit or a rate limit (429); retried with backoff.
 *  - credits: the AI account is out of credit (402).
 *  - signedOut: the session expired (401); resumes after signing in again.
 *  - unavailable: transcription is not configured or is down (503).
 *  - error: something else failed several times in a row.
 */
export type Blocked = 'offline' | 'limit' | 'credits' | 'signedOut' | 'unavailable' | 'error';

export interface QueueStatus {
  /** Pieces still waiting for text (including ones in flight). */
  pending: number;
  /** Seconds of audio still waiting. */
  pendingSeconds: number;
  blocked: Blocked | null;
  /** When the next automatic retry happens (ms since epoch), if one is scheduled. */
  retryAt: number | null;
}

/** A transcribed piece: text, and paragraph times (seconds into the piece) when available. */
export interface PieceText { text: string; segments?: Segment[] }
export type TranscribeFn = (wavBase64: string, o: { language: LectureLanguage; topic?: string }) => Promise<string | PieceText>;

export const transcribeWithAi: TranscribeFn = async (audio, { language, topic }) =>
  callAi<PieceText>('transcribe', { audio, language, topic });

interface Options {
  draftId: string;
  store: AudioStore;
  language: LectureLanguage;
  topic?: string;
  /** A piece got its text and the text is saved locally. `parts` are its paragraphs with lecture times, if any. */
  onSegment: (index: number, segment: Segment, parts?: Segment[]) => void;
  onStatus?: (status: QueueStatus) => void;
  transcribe?: TranscribeFn;
  concurrency?: number;
  isOnline?: () => boolean;
  /** Short waits between attempts of one piece, in ms. */
  retryDelays?: number[];
}

/** How long to wait before trying again automatically, by reason, in ms. */
export const backoff = (reason: Blocked, streak: number): number | null => {
  const grow = (base: number, cap: number) => Math.min(cap, base * 2 ** Math.max(0, streak - 1));
  switch (reason) {
    case 'offline': return grow(15_000, 120_000); // the online event usually comes first
    case 'limit': return grow(30_000, 15 * 60_000);
    case 'credits':
    case 'unavailable': return grow(5 * 60_000, 30 * 60_000);
    case 'error': return grow(30_000, 10 * 60_000);
    case 'signedOut': return null; // only after signing in again or tapping Retry
  }
};

/** Map a failed request to a pause reason, or null when one more quick retry makes sense. */
export const classify = (err: unknown, online: boolean): Blocked | null => {
  if (!online) return 'offline';
  if (err instanceof ApiError) {
    if (err.status === 429) return 'limit';
    if (err.status === 402) return 'credits';
    if (err.status === 401) return 'signedOut';
    if (err.status === 503) return 'unavailable';
    if (err.status === 400 || err.status === 413) return 'error'; // the same piece will fail again
    return null;
  }
  if (err instanceof TypeError) return 'offline'; // fetch failed: no connection
  return null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends saved audio pieces for transcription, a few at a time. A piece is
 * removed from local storage only after its text is saved there.
 */
export class TranscriptionQueue {
  private waiting: PieceMeta[] = [];
  private inFlight = new Map<number, PieceMeta>();
  private blocked: Blocked | null = null;
  private streak = 0;
  private retryAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private idleWaiters: (() => void)[] = [];
  private onOnline = () => { if (this.blocked) this.retryNow(); };

  constructor(private o: Options) {
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  get status(): QueueStatus {
    const all = [...this.waiting, ...this.inFlight.values()];
    return {
      pending: all.length,
      pendingSeconds: all.reduce((s, p) => s + p.duration, 0),
      blocked: this.blocked,
      retryAt: this.retryAt,
    };
  }

  private emit() {
    this.o.onStatus?.(this.status);
    if (!this.waiting.length && !this.inFlight.size) this.idleWaiters.splice(0).forEach((w) => w());
  }

  /** Queue a piece that is already saved in the store. */
  add(meta: PieceMeta) {
    if (this.inFlight.has(meta.index) || this.waiting.some((p) => p.index === meta.index)) return;
    this.waiting.push(meta);
    this.waiting.sort((a, b) => a.index - b.index);
    this.emit();
    this.pump();
  }

  /** Queue every piece of this draft that is still in the store. */
  async loadSaved() {
    for (const meta of await this.o.store.listPieces(this.o.draftId)) this.add(meta);
  }

  /** Try again now (the Retry button, coming back online, signing in again). */
  retryNow() {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.blocked = null;
    this.retryAt = null;
    this.emit();
    this.pump();
  }

  private pause(reason: Blocked) {
    if (this.stopped) return;
    if (this.blocked) return; // another piece already paused the queue
    this.blocked = reason;
    this.streak++;
    const wait = backoff(reason, this.streak);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.retryAt = wait == null ? null : Date.now() + wait;
    if (wait != null) this.timer = setTimeout(() => this.retryNow(), wait);
    this.emit();
  }

  private pump() {
    const limit = this.o.concurrency ?? 3;
    while (!this.stopped && !this.blocked && this.inFlight.size < limit && this.waiting.length) {
      const meta = this.waiting.shift()!;
      this.inFlight.set(meta.index, meta);
      void this.run(meta).then((ok) => {
        this.inFlight.delete(meta.index);
        if (!ok) { this.waiting.push(meta); this.waiting.sort((a, b) => a.index - b.index); }
        this.emit();
        this.pump();
      });
    }
  }

  /** True when the piece is done (text saved). False puts it back in the queue. */
  private async run(meta: PieceMeta): Promise<boolean> {
    const pcm = await this.o.store.getAudio(meta.draftId, meta.index).catch(() => undefined);
    if (!pcm) return true; // already committed (another tab finished it)
    const samples = fromPcm16(pcm);
    let text = '';
    let parts: Segment[] | undefined;
    if (!isSilent(samples)) {
      const audio = bytesToBase64(encodeWav(pcm));
      const delays = this.o.retryDelays ?? [2000, 6000];
      for (let attempt = 0; ; attempt++) {
        if (this.stopped || this.blocked) return false;
        try {
          const got = await (this.o.transcribe ?? transcribeWithAi)(audio, { language: this.o.language, topic: this.o.topic });
          const piece = typeof got === 'string' ? { text: got } : got;
          text = piece.text.trim();
          // Paragraph times are relative to the piece: make them lecture times.
          parts = piece.segments?.filter((p) => p.text.trim()).map((p) => ({ start: Math.round((meta.start + p.start) * 10) / 10, text: p.text.trim() }));
          if (parts && parts.length < 2) parts = undefined;
          break;
        } catch (err) {
          const online = this.o.isOnline?.() ?? (typeof navigator === 'undefined' || navigator.onLine);
          const reason = classify(err, online);
          if (reason) { this.pause(reason); return false; }
          if (attempt >= delays.length) { this.pause('error'); return false; }
          await sleep(delays[attempt]);
        }
      }
    }
    const segment = { start: meta.start, text };
    try {
      await this.o.store.commitPiece(meta.draftId, meta.index, segment, parts);
    } catch {
      this.pause('error'); // could not save the text locally: keep the audio and try later
      return false;
    }
    this.streak = 0;
    this.o.onSegment(meta.index, segment, parts);
    return true;
  }

  /** Resolves when nothing is waiting. Never resolves while paused with pieces left. */
  idle(): Promise<void> {
    return this.waiting.length || this.inFlight.size ? new Promise((r) => this.idleWaiters.push(r)) : Promise.resolve();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
  }
}
