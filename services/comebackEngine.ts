// ─── TWO-MINUTE COMEBACK ──────────────────────────────────────────────────────
// A short, optional warm-up offered at the start of a visit. It pulls 3–5 skills
// from the Mastery Map using spaced repetition, spanning:
//   • something learned recently
//   • something studied ~1 week ago
//   • something from weeks/months back
//   • a skill the student previously struggled with
//   • occasionally, a skill already mastered (to keep it warm)
// Everything here is pure and deterministic (an injectable `rand` keeps the
// "occasionally mastered" choice and tests reproducible). The actual questions
// are AI-generated (aiService.generateComebackQuestions) from the skills picked
// here; this file never writes question text.

import { SkillMap, SkillRecord, SkillStatus, Subject } from '../types';
import { computeStatus, dueForReview } from './masteryEngine';
import { localDayKey } from './engagement';

const DAY_MS = 86_400_000;

export const COMEBACK_MIN_QUESTIONS = 3;
export const COMEBACK_MAX_QUESTIONS = 5;
// Fewer practiced skills than this and a comeback isn't worth offering yet.
export const COMEBACK_MIN_SKILLS = 2;
// How likely a dedicated "mastered" slot is included (kept occasional per spec).
const MASTERED_SLOT_CHANCE = 0.35;
const HISTORY_CAP = 40;

// Why a skill was chosen — drives the per-question label and the summary copy.
export type ComebackReason = 'review' | 'struggled' | 'recent' | 'week' | 'older' | 'mastered';

export interface ComebackSelection {
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
  record: SkillRecord;
  reason: ComebackReason;
}

const ageDays = (r: SkillRecord, now: Date): number =>
  r.lastPracticed ? (now.getTime() - new Date(r.lastPracticed).getTime()) / DAY_MS : Infinity;

// ─── ELIGIBILITY ──────────────────────────────────────────────────────────────

/**
 * Whether to offer the comeback right now. Offered at most once per local day
 * (whether the student completes OR skips it), and only once there's enough
 * practiced history to review.
 */
export const comebackEligible = (
  map: SkillMap = {},
  lastComebackDate?: string,
  now: Date = new Date()
): boolean => {
  if (lastComebackDate && lastComebackDate === localDayKey(now)) return false;
  const practiced = Object.values(map).filter(r => r.attemptsTotal > 0);
  return practiced.length >= COMEBACK_MIN_SKILLS;
};

// ─── SELECTION ────────────────────────────────────────────────────────────────

const classify = (r: SkillRecord, now: Date): ComebackReason => {
  const st = computeStatus(r, now);
  const age = ageDays(r, now);
  if (st === 'mastered') return 'mastered';
  // "Struggled" = genuine difficulty: needs review, a repeated mistake, or a
  // real accuracy problem once there's enough evidence. A brand-new skill with
  // one correct answer has a low EMA score but hasn't "struggled" — don't
  // conflate the two, or every fresh skill floods the struggled bucket.
  const poorAccuracy = r.attemptsTotal >= 3 && r.attemptsCorrect / r.attemptsTotal < 0.5;
  if (st === 'needs_review' || r.mistakesTotal >= 2 || poorAccuracy) return 'struggled';
  if (age <= 2) return 'recent';
  if (age > 21) return 'older';
  if (age > 4) return 'week';
  return 'recent';
};

/**
 * Pick 3–5 skills for the comeback. Spaced-repetition-due skills lead, then the
 * category spread fills in for variety. Deterministic given `rand`.
 */
export const selectComebackSkills = (
  map: SkillMap = {},
  now: Date = new Date(),
  opts: { count?: number; rand?: () => number } = {}
): ComebackSelection[] => {
  const rand = opts.rand ?? Math.random;
  const practiced = Object.values(map).filter(r => r.attemptsTotal > 0);
  if (practiced.length === 0) return [];

  const target = Math.max(
    Math.min(COMEBACK_MIN_QUESTIONS, practiced.length),
    Math.min(opts.count ?? COMEBACK_MAX_QUESTIONS, COMEBACK_MAX_QUESTIONS, practiced.length)
  );

  const buckets: Record<ComebackReason, SkillRecord[]> = {
    review: [], struggled: [], recent: [], week: [], older: [], mastered: [],
  };
  const due = new Set(dueForReview(map, now).map(r => r.skillTag));
  for (const r of practiced) {
    if (due.has(r.skillTag)) buckets.review.push(r);
    buckets[classify(r, now)].push(r);
  }
  // Freshest-first within each bucket keeps picks feeling relevant.
  for (const key of Object.keys(buckets) as ComebackReason[]) {
    buckets[key].sort((a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime());
  }

  const chosen: ComebackSelection[] = [];
  const used = new Set<string>();
  const take = (r: SkillRecord, reason: ComebackReason) => {
    if (used.has(r.skillTag) || chosen.length >= target) return;
    used.add(r.skillTag);
    chosen.push({ skillTag: r.skillTag, subject: r.subject, topicId: r.topicId, record: r, reason });
  };

  const includeMastered = rand() < MASTERED_SLOT_CHANCE;

  // Round 1 — one from each priority bucket for a genuine spread.
  const primary: ComebackReason[] = ['review', 'struggled', 'week', 'older', 'recent'];
  if (includeMastered) primary.push('mastered');
  for (const reason of primary) {
    if (chosen.length >= target) break;
    const r = buckets[reason].find(x => !used.has(x.skillTag));
    if (r) take(r, reason);
  }

  // Round 2 — fill remaining slots, spaced-review and struggled skills first.
  const fillOrder: ComebackReason[] = ['review', 'struggled', 'week', 'older', 'recent', 'mastered'];
  for (const reason of fillOrder) {
    for (const r of buckets[reason]) take(r, reason);
    if (chosen.length >= target) break;
  }

  return chosen.slice(0, target);
};

// ─── AVOID-REPEAT HISTORY ─────────────────────────────────────────────────────

const normQ = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Merge freshly-asked question texts into the capped avoid-list. */
export const recordComebackQuestions = (history: string[] = [], asked: string[] = []): string[] => {
  const merged = [...history, ...asked.map(normQ).filter(Boolean)];
  // De-dupe while keeping the most recent occurrences.
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = merged.length - 1; i >= 0; i--) {
    if (seen.has(merged[i])) continue;
    seen.add(merged[i]);
    out.unshift(merged[i]);
  }
  return out.slice(-HISTORY_CAP);
};

// ─── SUMMARY (meaningful feedback, never just a score) ───────────────────────

export interface ComebackOutcome {
  selection: ComebackSelection;
  correct: boolean;
}

export interface ComebackSummary {
  total: number;
  correctCount: number;
  remembered: string[];       // skills recalled correctly
  gettingStronger: string[];  // skills whose status/score climbed this session
  nextReview?: { skillTag: string; reviewDue: string }; // one skill queued ahead
}

const STATUS_RANK: Record<SkillStatus, number> = {
  new: 0, learning: 1, needs_review: 1, developing: 2, secure: 3, mastered: 4,
};

const dedupe = (xs: string[]): string[] => Array.from(new Set(xs));
const lookup = (map: SkillMap, tag: string): SkillRecord | undefined =>
  map[tag] ?? map[tag.toLowerCase()];

/**
 * Turn the answered outcomes into human feedback by comparing the skill map
 * before and after the comeback's attempts were recorded.
 */
export const buildComebackSummary = (
  outcomes: ComebackOutcome[],
  before: SkillMap = {},
  after: SkillMap = {},
  now: Date = new Date()
): ComebackSummary => {
  const remembered: string[] = [];
  const gettingStronger: string[] = [];

  for (const o of outcomes) {
    const tag = o.selection.skillTag;
    if (o.correct) remembered.push(tag);
    const b = lookup(before, tag);
    const a = lookup(after, tag);
    if (a) {
      const rankUp = b ? STATUS_RANK[computeStatus(a, now)] > STATUS_RANK[computeStatus(b, now)] : false;
      const scoreUp = b ? a.masteryScore - b.masteryScore >= 5 : o.correct;
      if (rankUp || scoreUp) gettingStronger.push(tag);
    }
  }

  const nextReview = outcomes
    .map(o => lookup(after, o.selection.skillTag))
    .filter((r): r is SkillRecord => !!r && !!r.reviewDue && new Date(r.reviewDue).getTime() > now.getTime())
    .sort((x, y) => new Date(x.reviewDue).getTime() - new Date(y.reviewDue).getTime())[0];

  return {
    total: outcomes.length,
    correctCount: outcomes.filter(o => o.correct).length,
    remembered: dedupe(remembered),
    gettingStronger: dedupe(gettingStronger),
    nextReview: nextReview ? { skillTag: nextReview.skillTag, reviewDue: nextReview.reviewDue } : undefined,
  };
};
