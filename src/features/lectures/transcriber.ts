import { callAi } from '@/lib/api';
import { ApiError } from '@/lib/api';
import type { LectureLanguage } from '@shared/lectures';
import { bytesToBase64, encodeWav, isSilent } from './audio';

export interface Piece { index: number; start: number; samples: Float32Array }

interface Options {
  language: LectureLanguage;
  topic?: string;
  /** Called when a piece is done. Empty text means silence or a piece that failed. */
  onPiece: (piece: Piece, text: string, failed: boolean) => void;
  concurrency?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends audio pieces for transcription, a few at a time, with retries. */
export class Transcriber {
  private queue: Piece[] = [];
  private active = 0;
  private waiters: (() => void)[] = [];
  private stopped = false;
  /** Set when the account can't transcribe (no credit, signed out) — retrying won't help. */
  fatal: ApiError | null = null;

  constructor(private o: Options) {}

  add(piece: Piece) {
    this.queue.push(piece);
    this.pump();
  }

  get pending() { return this.queue.length + this.active; }

  private pump() {
    const limit = this.o.concurrency ?? 3;
    while (!this.stopped && this.active < limit && this.queue.length) {
      const piece = this.queue.shift()!;
      this.active++;
      void this.run(piece).finally(() => {
        this.active--;
        if (!this.pending) this.waiters.splice(0).forEach((w) => w());
        this.pump();
      });
    }
  }

  private async run(piece: Piece) {
    if (isSilent(piece.samples)) { this.o.onPiece(piece, '', false); return; }
    if (this.fatal) { this.o.onPiece(piece, '', true); return; }
    const audio = bytesToBase64(encodeWav(piece.samples));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { text } = await callAi<{ text: string }>('transcribe', { audio, language: this.o.language, topic: this.o.topic });
        this.o.onPiece(piece, text.trim(), false);
        return;
      } catch (err) {
        if (err instanceof ApiError && [401, 402, 503].includes(err.status)) { this.fatal = err; break; }
        if (this.stopped) break;
        await sleep(attempt === 0 ? 2000 : 6000);
      }
    }
    this.o.onPiece(piece, '', true);
  }

  /** Resolves when every queued piece is finished. */
  idle(): Promise<void> {
    return this.pending ? new Promise((r) => this.waiters.push(r)) : Promise.resolve();
  }

  stop() { this.stopped = true; this.queue = []; }
}
