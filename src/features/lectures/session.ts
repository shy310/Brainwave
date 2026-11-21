import type { LectureLanguage, Segment } from '@shared/lectures';
import { SAMPLE_RATE, isSilent, toPcm16 } from './audio';
import { audioStore as defaultStore, type AudioStore, type Draft, type DraftSource } from './audioStore';
import { lectureRepo as defaultRepo } from './repo';
import { TranscriptionQueue, type QueueStatus, type TranscribeFn } from './transcriber';
import { RecordingError, recordingRepo } from './recording';
import { addMark } from '@shared/marks';

type Repo = Pick<typeof defaultRepo, 'create' | 'update'>;

export interface SessionEvents {
  onTranscript?: (segments: Segment[]) => void;
  onStatus?: (status: QueueStatus) => void;
}

interface Deps {
  store?: AudioStore;
  repo?: Repo;
  transcribe?: TranscribeFn;
  isOnline?: () => boolean;
  retryDelays?: number[];
  /** Keep the compressed recording with the lecture. */
  saveRecording?: (lectureId: string, blob: Blob) => Promise<void>;
}

export interface NewSession {
  owner: string;
  source: DraftSource;
  title: string;
  language: LectureLanguage;
  slidesText: string | null;
  folderId?: string | null;
}

const LOCK = (id: string) => `bw-lecture-draft:${id}`;

/**
 * One lecture being recorded or uploaded. Audio pieces go to local storage
 * first, then to transcription; the transcript is mirrored to the server
 * lecture whenever possible. If anything goes wrong, the draft stays on this
 * device and can be resumed with `LectureSession.resume`.
 */
export class LectureSession {
  readonly queue: TranscriptionQueue;
  /** Transcribed pieces by index; `parts` are paragraphs with their own times. */
  private segments = new Map<number, Segment & { parts?: Segment[] }>();
  private syncing: Promise<void> = Promise.resolve();
  private syncAgain = false;
  private releaseLock: (() => void) | null = null;
  private store: AudioStore;
  private repo: Repo;
  private saveRecording: (lectureId: string, blob: Blob) => Promise<void>;
  /** Why the kept recording couldn't be saved, after `finalize`. */
  recordingProblem: RecordingError['reason'] | null = null;

  private constructor(public draft: Draft, private events: SessionEvents, deps: Deps) {
    this.store = deps.store ?? defaultStore;
    this.repo = deps.repo ?? defaultRepo;
    this.saveRecording = deps.saveRecording ?? ((id, blob) => recordingRepo.save(id, blob));
    this.queue = new TranscriptionQueue({
      draftId: draft.id,
      store: this.store,
      language: draft.language,
      topic: draft.title || undefined,
      transcribe: deps.transcribe,
      isOnline: deps.isOnline,
      retryDelays: deps.retryDelays,
      onSegment: (index, segment, parts) => {
        if (segment.text) this.segments.set(index, parts?.length ? { ...segment, parts } : segment);
        this.events.onTranscript?.(this.transcript());
        this.sync();
      },
      onStatus: (s) => this.events.onStatus?.(s),
    });
  }

  static async start(input: NewSession, events: SessionEvents = {}, deps: Deps = {}) {
    const now = Date.now();
    const draft: Draft = {
      id: crypto.randomUUID(), lectureId: null, state: input.source === 'record' ? 'recording' : 'stopped',
      duration: 0, nextIndex: 0, createdAt: now, updatedAt: now, ...input,
    };
    await (deps.store ?? defaultStore).createDraft(draft);
    const session = new LectureSession(draft, events, deps);
    await session.lock();
    session.sync(); // create the server lecture now if we can; recording doesn't wait for it
    return session;
  }

  /**
   * Pick up a draft left behind (closed tab, crash, no connection, AI limit).
   * The last few seconds saved as a checkpoint become a final piece, the saved
   * transcript is restored, and the remaining pieces are queued.
   */
  static async resume(draftId: string, events: SessionEvents = {}, deps: Deps = {}) {
    const store = deps.store ?? defaultStore;
    let draft = await store.getDraft(draftId);
    if (!draft) return null;
    await store.promoteCheckpoint(draftId, draft.nextIndex);
    draft = await store.updateDraft(draftId, { state: 'stopped' }) ?? draft;
    const session = new LectureSession(draft, events, deps);
    await session.lock();
    for (const s of await store.listSegments(draftId)) session.segments.set(s.index, { start: s.start, text: s.text, ...(s.parts ? { parts: s.parts } : {}) });
    session.events.onTranscript?.(session.transcript());
    await session.queue.loadSaved();
    session.sync();
    return session;
  }

  /** Hold a Web Lock while this tab works on the draft, so the recovery prompt skips it. */
  private async lock() {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return;
    await new Promise<void>((acquired) => {
      void locks.request(LOCK(this.draft.id), () => new Promise<void>((release) => {
        this.releaseLock = release;
        acquired();
      })).catch(() => acquired());
    });
  }

  /** The transcript so far: a paragraph per time when available, else one per piece. */
  transcript(): Segment[] {
    return [...this.segments.values()].sort((a, b) => a.start - b.start)
      .flatMap((s) => s.parts?.length ? s.parts : [{ start: s.start, text: s.text }]);
  }

  get status() { return this.queue.status; }
  get lectureId() { return this.draft.lectureId; }

  private async patchDraft(patch: Partial<Draft>) {
    this.draft = { ...this.draft, ...patch };
    await this.store.updateDraft(this.draft.id, patch);
  }

  /** Save a new piece of audio and queue it. Silent pieces are skipped. */
  async addPiece(samples: Float32Array, start: number) {
    const index = this.draft.nextIndex;
    const duration = samples.length / SAMPLE_RATE;
    const meta = { draftId: this.draft.id, index, start, duration };
    if (!isSilent(samples)) await this.store.putPiece(meta, toPcm16(samples));
    await this.patchDraft({ nextIndex: index + 1, duration: Math.max(this.draft.duration, start + duration) });
    if (!isSilent(samples)) this.queue.add(meta);
  }

  /** The audio recorded since the last piece, saved every few seconds. */
  async checkpoint(samples: Float32Array, start: number) {
    await this.store.putCheckpoint(this.draft.id, start, toPcm16(samples));
  }

  /** The recorder was stopped on purpose; everything is in pieces now. */
  async stopRecording() {
    await this.store.clearCheckpoint(this.draft.id);
    await this.patchDraft({ state: 'stopped' });
    this.sync();
  }

  /** The compressed copy of the recording, if one was made and not deleted. */
  recording(): Promise<Blob | null> {
    return this.store.recording(this.draft.id).catch(() => null);
  }

  /** The student chose to keep the recording with the lecture, or to delete it now. */
  async setKeepAudio(keep: boolean) {
    await this.patchDraft({ keepAudio: keep });
    if (!keep) await this.store.clearRecording(this.draft.id);
  }

  /** Mark the moment at `seconds` as important (saved with the draft, so it survives a crash). */
  async addMark(seconds: number) {
    const marks = addMark(this.draft.marks ?? [], seconds);
    if (marks === this.draft.marks) return;
    await this.patchDraft({ marks });
  }

  setSlides(text: string | null) {
    void this.patchDraft({ slidesText: text });
    if (this.draft.lectureId) void this.repo.update(this.draft.lectureId, { slides_text: text }).catch(() => {});
  }

  /** Create the server lecture if needed, then save the transcript so far. Never throws. */
  sync(): Promise<void> {
    this.syncAgain = true;
    this.syncing = this.syncing.then(async () => {
      if (!this.syncAgain) return;
      this.syncAgain = false;
      try { await this.push(); } catch (err) { console.warn('Lecture not saved yet; will retry', err); }
    });
    return this.syncing;
  }

  private async push(status?: 'ready') {
    if (!this.draft.lectureId) {
      const lecture = await this.repo.create({
        title: this.draft.title, source: this.draft.source, language: this.draft.language, slides_text: this.draft.slidesText,
        ...(this.draft.folderId ? { folder_id: this.draft.folderId } : {}),
      });
      await this.patchDraft({ lectureId: lecture.id });
    }
    await this.repo.update(this.draft.lectureId!, {
      segments: this.transcript(), duration_sec: Math.round(this.draft.duration), ...(status ? { status } : {}),
      ...(this.draft.marks?.length ? { marks: this.draft.marks } : {}),
    });
  }

  /**
   * Save the final transcript and mark the lecture ready, and upload the
   * recording if the student kept it. Only then is the local draft deleted.
   * Throws if the server can't be reached; the draft stays. A recording that
   * can't be kept at all (too big, too many kept) is reported in
   * `recordingProblem` and doesn't stop the lecture from being saved.
   */
  async finalize(): Promise<string> {
    await this.syncing;
    await this.push('ready');
    if (this.draft.keepAudio) {
      const blob = await this.store.recording(this.draft.id);
      if (blob?.size) {
        try {
          await this.saveRecording(this.draft.lectureId!, blob);
        } catch (err) {
          if (!(err instanceof RecordingError)) throw err;
          this.recordingProblem = err.reason;
        }
      }
    }
    this.close();
    await this.store.deleteDraft(this.draft.id);
    return this.draft.lectureId!;
  }

  /** Throw the draft away (the student chose Discard). */
  async discard() {
    this.close();
    await this.store.deleteDraft(this.draft.id);
  }

  /** Stop working on the draft in this tab; it stays saved for later. */
  close() {
    this.queue.stop();
    this.releaseLock?.();
    this.releaseLock = null;
  }
}

/** Drafts that no open tab is working on: offered as "Recover recording". */
export const recoverableDrafts = async (owner: string, store: AudioStore = defaultStore): Promise<(Draft & { pendingSeconds: number })[]> => {
  if (!store.available()) return [];
  const drafts = await store.listDrafts(owner);
  if (!drafts.length) return [];
  const held = new Set<string>();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks) {
    const q = await locks.query().catch(() => null);
    q?.held?.forEach((l) => l.name && held.add(l.name));
  }
  const out: (Draft & { pendingSeconds: number })[] = [];
  for (const d of drafts) {
    if (held.has(LOCK(d.id))) continue;
    const pieces = await store.listPieces(d.id);
    const cp = await store.getCheckpoint(d.id);
    out.push({ ...d, pendingSeconds: pieces.reduce((s, p) => s + p.duration, 0) + (cp ? cp.pcm.length / SAMPLE_RATE : 0) });
  }
  return out;
};
