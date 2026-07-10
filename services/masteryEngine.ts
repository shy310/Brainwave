// ─── ADAPTIVE LEARNING ENGINE ─────────────────────────────────────────────────
// Pure, deterministic skill-mastery tracking. Every answered question flows
// through recordAttempt(); status is derived from evidence, never set by hand.
//
// Design principles (per product spec):
// - Mastery is NEVER granted for one correct answer: it requires successful
//   recall across multiple distinct days AND multiple question formats, plus a
//   successful review after a real time gap.
// - Skills decay: once secure/mastered, a skill whose review date passes
//   without practice flips to "needs review".
// - Everything here also powers adaptive generation (difficulty, weak-skill
//   targeting) and future review features.

import {
  SkillMap, SkillRecord, SkillStatus, SkillAttemptEvent, SkillAttempt, MistakeKind,
  QuestionType, Exercise,
} from '../types';
import { parseAnswer, looksNumeric } from './mathEngine';
import { localDayKey } from './engagement';

// Spaced-repetition ladder (days). Success on a due review advances one rung;
// a failure drops back to the start.
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];
const RECENT_CAP = 10;
const SUCCESS_DAYS_CAP = 12;
const FORMATS_CAP = 8;
// EMA weight per attempt (harder questions move the needle more)
const BASE_ALPHA = 0.25;

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const emptyRecord = (skillTag: string, ev?: Partial<SkillAttemptEvent>): SkillRecord => ({
  skillTag,
  subject: ev?.subject,
  topicId: ev?.topicId ?? null,
  status: 'new',
  masteryScore: 0,
  attemptsTotal: 0,
  attemptsCorrect: 0,
  streak: 0,
  lastPracticed: '',
  lastReviewed: '',
  reviewDue: '',
  reviewIntervalDays: 0,
  successDays: [],
  formatsCorrect: [],
  hintsTotal: 0,
  mistakeCounts: {},
  mistakesTotal: 0,
  correctedCount: 0,
  canExplain: false,
  confidenceSum: 0,
  confidenceCount: 0,
  recent: [],
});

// ─── STATUS LADDER ────────────────────────────────────────────────────────────

/**
 * Derive the display status from the evidence in a record.
 * `now` is injectable for tests.
 */
export const computeStatus = (r: SkillRecord, now: Date = new Date()): SkillStatus => {
  if (r.attemptsTotal === 0) return 'new';

  const recent = r.recent.slice(-3);
  const recentFails = recent.filter(a => !a.correct).length;
  const overdue = r.reviewDue && now.getTime() > new Date(r.reviewDue).getTime();

  // A previously strong skill that is overdue for review, or is suddenly
  // failing, needs attention before anything else. "Was strong" is judged by
  // durable evidence (multi-day, multi-format success) rather than the current
  // score, which failures have already dragged down.
  const wasStrong = r.successDays.length >= 2 && r.formatsCorrect.length >= 2;
  if (wasStrong && ((overdue && r.masteryScore >= 70) || (recent.length >= 2 && recentFails >= 2))) return 'needs_review';

  // Mastered: high score + recall on 3+ distinct days + 2+ formats + at least
  // one successful review that happened after a real gap (interval ≥ 3 days).
  if (
    r.masteryScore >= 85 &&
    r.successDays.length >= 3 &&
    r.formatsCorrect.length >= 2 &&
    r.reviewIntervalDays >= 3 &&
    r.streak >= 2
  ) return 'mastered';

  // Secure: solid score + recall on 2+ distinct days + 2+ formats.
  if (r.masteryScore >= 70 && r.successDays.length >= 2 && r.formatsCorrect.length >= 2) return 'secure';

  if (r.masteryScore >= 40) return 'developing';
  return 'learning';
};

// ─── RECORDING ────────────────────────────────────────────────────────────────

export const recordAttempt = (map: SkillMap, ev: SkillAttemptEvent): SkillMap => {
  const tag = (ev.skillTag || 'general').trim().toLowerCase();
  const prev = map[tag] ?? emptyRecord(tag, ev);
  const ts = ev.ts ?? new Date().toISOString();
  const day = localDayKey(new Date(ts));
  const r: SkillRecord = { ...prev, mistakeCounts: { ...prev.mistakeCounts } };

  // Keep origin metadata fresh
  if (ev.subject) r.subject = ev.subject;
  if (ev.topicId !== undefined) r.topicId = ev.topicId;

  r.attemptsTotal += 1;
  r.lastPracticed = ts;
  r.hintsTotal += ev.hintsUsed;

  // Rolling average time
  if (ev.timeMs && ev.timeMs > 0) {
    r.avgTimeMs = r.avgTimeMs ? Math.round(r.avgTimeMs * 0.7 + ev.timeMs * 0.3) : ev.timeMs;
  }

  // Confidence (only when the student volunteered it)
  if (ev.confidence) {
    r.confidenceSum += ev.confidence;
    r.confidenceCount += 1;
  }

  // EMA mastery score, weighted by difficulty (hard questions move it more)
  // and dampened when the answer needed hints.
  const diffWeight = 0.7 + 0.15 * Math.max(1, Math.min(5, ev.difficulty)); // 0.85–1.45
  const hintDamp = ev.correct && ev.hintsUsed > 0 ? 0.6 : 1;
  const alpha = Math.min(0.5, BASE_ALPHA * diffWeight);
  const target = ev.correct ? 100 * hintDamp : 0;
  r.masteryScore = Math.round(r.masteryScore * (1 - alpha) + target * alpha);

  if (ev.correct) {
    r.attemptsCorrect += 1;
    r.streak += 1;
    if (!r.successDays.includes(day)) {
      r.successDays = [...r.successDays, day].slice(-SUCCESS_DAYS_CAP);
    }
    if (!r.formatsCorrect.includes(ev.questionType)) {
      r.formatsCorrect = [...r.formatsCorrect, ev.questionType].slice(-FORMATS_CAP);
    }
    if (ev.explainEvidence) r.canExplain = true;
    if (ev.corrected) {
      r.correctedCount += 1;
      // A corrected answer still started as a mistake — profile it so the
      // Mastery Map shows what kind of slip the student tends to make.
      if (ev.mistakeKind) {
        r.mistakeCounts[ev.mistakeKind] = (r.mistakeCounts[ev.mistakeKind] ?? 0) + 1;
        r.mistakesTotal += 1;
      }
    }

    // Spaced repetition: answering correctly ON or AFTER the due date is a
    // successful review — advance the ladder. Early correct answers keep the
    // current schedule (no cramming shortcut).
    const due = r.reviewDue ? new Date(r.reviewDue).getTime() : 0;
    if (!r.reviewDue || new Date(ts).getTime() >= due) {
      const idx = REVIEW_INTERVALS.indexOf(r.reviewIntervalDays);
      const next = REVIEW_INTERVALS[Math.min(idx + 1, REVIEW_INTERVALS.length - 1)] ?? REVIEW_INTERVALS[0];
      r.reviewIntervalDays = r.reviewDue ? next : REVIEW_INTERVALS[0];
      r.reviewDue = addDays(ts, r.reviewIntervalDays);
      r.lastReviewed = ts;
    }
  } else {
    r.streak = 0;
    const kind: MistakeKind = ev.mistakeKind ?? 'other';
    r.mistakeCounts[kind] = (r.mistakeCounts[kind] ?? 0) + 1;
    r.mistakesTotal += 1;
    // Failure resets the review ladder — the skill must be re-earned.
    r.reviewIntervalDays = REVIEW_INTERVALS[0];
    r.reviewDue = addDays(ts, REVIEW_INTERVALS[0]);
  }

  r.recent = [
    ...r.recent,
    {
      ts, correct: ev.correct, questionType: ev.questionType, difficulty: ev.difficulty,
      timeMs: ev.timeMs, hintsUsed: ev.hintsUsed, mistakeKind: ev.mistakeKind,
      corrected: ev.corrected, confidence: ev.confidence,
    },
  ].slice(-RECENT_CAP);

  r.status = computeStatus(r, new Date(ts));
  return { ...map, [tag]: r };
};

// ─── MISTAKE CLASSIFICATION ───────────────────────────────────────────────────

/**
 * Classify what KIND of mistake a wrong answer was, deterministically.
 * Used for the mistake-profile on the Mastery Map and targeted feedback.
 */
export const classifyMistake = (
  exercise: Pick<Exercise, 'questionType' | 'answerExpression' | 'sampleAnswer' | 'unitRequired'>,
  studentAnswer: string
): MistakeKind => {
  const type = exercise.questionType;
  if (type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.TRUE_FALSE) return 'concept';
  if (type === QuestionType.MULTI_SELECT) return 'incomplete';

  const expectedStr = exercise.answerExpression || exercise.sampleAnswer || '';
  const exp = parseAnswer(expectedStr);
  const giv = parseAnswer(studentAnswer);

  if (!giv.ok) {
    // Couldn't produce anything parseable for a numeric question → recall gap
    return looksNumeric(studentAnswer) ? 'other' : 'recall';
  }
  if (exp.ok && giv.ok) {
    const e = exp.value!, g = giv.value!;
    if (exercise.unitRequired && exp.unit && !giv.unit) return 'units';
    if (e !== 0 && Math.abs(g + e) <= 1e-9 * Math.max(Math.abs(e), 1)) return 'sign';
    if (e !== 0 && g !== 0) {
      const ratio = Math.abs(g / e);
      // Off by a clean power of ten → decimal/magnitude slip
      for (const p of [10, 100, 1000, 0.1, 0.01, 0.001]) {
        if (Math.abs(ratio - p) < 1e-6) return 'magnitude';
      }
      // Within 25% of the right answer → calculation slip, not a concept gap
      if (Math.abs(g - e) / Math.max(Math.abs(e), 1) <= 0.25) return 'arithmetic';
    }
    return 'concept';
  }
  return 'recall';
};

// ─── QUERIES (power the Mastery Map + adaptive features) ─────────────────────

export const skillsByStatus = (map: SkillMap, now: Date = new Date()): Record<SkillStatus, SkillRecord[]> => {
  const out: Record<SkillStatus, SkillRecord[]> = {
    new: [], learning: [], developing: [], secure: [], mastered: [], needs_review: [],
  };
  for (const r of Object.values(map)) {
    // Status can drift with time (reviews come due) — recompute on read.
    out[computeStatus(r, now)].push(r);
  }
  return out;
};

/** Skills whose spaced review is due (or overdue), most overdue first. */
export const dueForReview = (map: SkillMap, now: Date = new Date()): SkillRecord[] =>
  Object.values(map)
    .filter(r => r.attemptsTotal > 0 && r.reviewDue && now.getTime() >= new Date(r.reviewDue).getTime())
    .sort((a, b) => new Date(a.reviewDue).getTime() - new Date(b.reviewDue).getTime());

/** Weakest skills for targeted practice (low mastery, frequent mistakes). */
export const weakestSkills = (map: SkillMap, n = 5): SkillRecord[] =>
  Object.values(map)
    .filter(r => r.attemptsTotal >= 2)
    .sort((a, b) => (a.masteryScore - b.masteryScore) || (b.mistakesTotal - a.mistakesTotal))
    .slice(0, n);

/** The most frequent mistake kind for a skill, if any. */
export const dominantMistake = (r: SkillRecord): MistakeKind | null => {
  let best: MistakeKind | null = null, max = 0;
  for (const [k, v] of Object.entries(r.mistakeCounts)) {
    if ((v ?? 0) > max) { max = v!; best = k as MistakeKind; }
  }
  return best;
};

export const averageConfidence = (r: SkillRecord): number | null =>
  r.confidenceCount > 0 ? r.confidenceSum / r.confidenceCount : null;
