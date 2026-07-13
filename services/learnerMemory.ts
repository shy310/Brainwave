// ─── CROSS-SESSION LEARNER MEMORY ─────────────────────────────────────────────
// Distills the durable per-user signals the app already tracks (Mastery Map,
// recurring mistakes, recent focus, preferred help style) into a compact English
// summary that is injected into the tutor's system prompt so it personalizes
// over time. Pure and cheap — recomputed from the user object, nothing new stored
// beyond `preferredExplanationStyle`.

import { UserProfile, SkillRecord } from '../types';
import { weakestSkills, dominantMistake, computeStatus } from './masteryEngine';

const MISTAKE_PHRASE: Record<string, string> = {
  sign: 'sign errors', magnitude: 'decimal/place-value slips', arithmetic: 'small calculation slips',
  units: 'missing or wrong units', concept: 'mixing up related concepts', incomplete: 'stopping a step early',
  recall: 'recalling facts/rules', other: 'a recurring small slip',
};

const MODE_STYLE: Record<string, string> = {
  tutor: 'prefers Socratic guidance (hints, not answers)',
  explain: 'prefers full step-by-step explanations',
};

/**
 * Build a short (a few lines) profile summary, or '' when there isn't enough
 * signal yet. Injected verbatim into the tutor prompt.
 */
export const buildLearnerSummary = (user: UserProfile): string => {
  const map = user.skillMap ?? {};
  const records = Object.values(map).filter(r => r.attemptsTotal > 0);
  const lines: string[] = [];

  // Recent focus — the 3 most recently practiced skills.
  const recent = [...records]
    .sort((a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime())
    .slice(0, 3)
    .map(r => r.skillTag);
  if (recent.length) lines.push(`- Recently working on: ${recent.join(', ')}.`);

  // Mastery gaps — weakest skills that still need work.
  const now = new Date();
  const weak = weakestSkills(map, 3).filter(r => {
    const st = computeStatus(r, now);
    return st === 'needs_review' || r.masteryScore < 60;
  });
  if (weak.length) lines.push(`- Still shaky on: ${weak.map(r => r.skillTag).join(', ')}.`);

  // Common mistakes — aggregate the dominant mistake kinds across weak skills.
  const kinds = new Map<string, number>();
  for (const r of records as SkillRecord[]) {
    const k = dominantMistake(r);
    if (k) kinds.set(k, (kinds.get(k) ?? 0) + (r.mistakeCounts[k] ?? 0));
  }
  const topKinds = [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([k]) => MISTAKE_PHRASE[k] ?? k);
  if (topKinds.length) lines.push(`- Tends to make: ${topKinds.join(' and ')}.`);

  // Preferred explanation style.
  const style = user.preferredExplanationStyle;
  if (style) {
    const known = MODE_STYLE[style];
    lines.push(`- Preferred help style: ${known ?? `"${style.slice(0, 160)}"`}.`);
  }

  // Grade anchor is always useful.
  if (lines.length === 0) return '';
  return lines.join('\n');
};
