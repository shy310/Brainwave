// ─── MEMORY DUNGEON ENGINE ────────────────────────────────────────────────────
// Plans a dungeon of short recall "rooms" from the student's Mastery Map,
// recurring mistakes and current courses, and runs the spaced-repetition +
// layered-hint economics. Pure and deterministic (injectable rng/now); the
// AI only fills room CONTENT (dungeonEngine never writes questions), and every
// room it returns is checked by validateDungeonRooms before the student sees it.

import {
  SkillMap, SkillRecord, Subject, DungeonRoom, DungeonRoomType, Dungeon, Language,
} from '../types';
import { weakestSkills, dueForReview, computeStatus } from './masteryEngine';

export const DEFAULT_DUNGEON_ROOMS = 8;
// Four escalating hint tiers: general reminder → strategic clue → partial step →
// full explanation. Each tier taken shrinks the reward and the mastery credit.
export const HINT_LEVELS = 4;
const HINT_REWARD = [1, 0.8, 0.55, 0.3, 0.12];
const DUNGEON_HISTORY_CAP = 60;

export interface DungeonSkillSeed {
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
}

export interface RoomPlan {
  type: DungeonRoomType;
  skillTag: string;
  subject?: Subject;
  topicId?: string | null;
  difficulty: number;
  revisit: boolean;              // spaced return of an earlier/weak skill (altered example)
  relatedSkills?: string[];      // boss rooms connect several skills
}

// ─── SEED POOLS ───────────────────────────────────────────────────────────────

const isWeak = (r: SkillRecord, now: Date): boolean => {
  const st = computeStatus(r, now);
  return st === 'needs_review' || r.masteryScore < 60 || r.mistakesTotal >= 2;
};

const seedOf = (r: SkillRecord): DungeonSkillSeed => ({ skillTag: r.skillTag, subject: r.subject, topicId: r.topicId });

const roomDifficulty = (tag: string, map: SkillMap, base: number, now: Date): number => {
  const r = map[tag.trim().toLowerCase()];
  if (!r) return base;
  const st = computeStatus(r, now);
  if (st === 'needs_review' || st === 'learning') return Math.max(2, base - 1);
  if (st === 'mastered' || st === 'secure') return Math.min(5, base + 1);
  return base;
};

// Cyclic picker: hands out seeds in order, wrapping around, skipping undefined.
const picker = (seeds: DungeonSkillSeed[]) => {
  let i = 0;
  return (): DungeonSkillSeed | undefined => {
    if (!seeds.length) return undefined;
    const s = seeds[i % seeds.length];
    i += 1;
    return s;
  };
};

const uniqueByTag = (seeds: DungeonSkillSeed[]): DungeonSkillSeed[] => {
  const seen = new Set<string>();
  const out: DungeonSkillSeed[] = [];
  for (const s of seeds) {
    const k = s.skillTag.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
};

// ─── PLANNING ─────────────────────────────────────────────────────────────────

/**
 * Order a dungeon's rooms. Follows the intended arc — warm recall → a related
 * concept → a weak-skill revisit → a mistake investigation → a mini-boss →
 * more revisits with fresh examples → a final boss that combines several
 * important skills — degrading gracefully when the Mastery Map is thin (course
 * topics fill the gaps).
 */
export const planDungeon = (
  map: SkillMap = {},
  fallbackTopics: DungeonSkillSeed[] = [],
  opts: { count?: number } = {},
  now: Date = new Date()
): RoomPlan[] => {
  const records = Object.values(map).filter(r => r.attemptsTotal > 0);
  const weak = uniqueByTag(weakestSkills(map, 8).filter(r => isWeak(r, now)).map(seedOf));
  const due = uniqueByTag(dueForReview(map, now).map(seedOf));
  const recent = uniqueByTag([...records].sort((a, b) =>
    new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime()).map(seedOf));
  const strong = uniqueByTag(records.filter(r => ['secure', 'mastered'].includes(computeStatus(r, now))).map(seedOf));
  const any = uniqueByTag([...recent, ...fallbackTopics]);
  if (any.length === 0) return [];

  const pool = (primary: DungeonSkillSeed[], ...fallbacks: DungeonSkillSeed[][]): DungeonSkillSeed[] => {
    for (const p of [primary, ...fallbacks]) if (p.length) return p;
    return any;
  };
  const pickStrong = picker(pool(strong, recent));
  const pickRecent = picker(pool(recent));
  const pickWeak = picker(pool(weak, due, recent));
  const pickDue = picker(pool(due, weak, recent));
  const pickAny = picker(any);

  type Slot = { type: DungeonRoomType; pick: 'strong' | 'recent' | 'weak' | 'due' | 'any' | 'boss'; revisit: boolean; diff: number };
  const template: Slot[] = [
    { type: 'recall', pick: 'strong', revisit: false, diff: 2 },
    { type: 'mc-trap', pick: 'recent', revisit: false, diff: 3 },
    { type: 'explanation', pick: 'weak', revisit: true, diff: 3 },
    { type: 'mistake-detective', pick: 'weak', revisit: false, diff: 3 },
    { type: 'mini-boss', pick: 'boss', revisit: false, diff: 3 },
    { type: 'matching', pick: 'any', revisit: false, diff: 2 },
    { type: 'recall', pick: 'due', revisit: true, diff: 3 },
    { type: 'final-boss', pick: 'boss', revisit: false, diff: 4 },
  ];

  const count = Math.max(3, Math.min(opts.count ?? DEFAULT_DUNGEON_ROOMS, template.length));
  // Always end on the final boss; take the leading slots for everything before it.
  const chosenSlots = count >= template.length
    ? template
    : [...template.filter(s => s.type !== 'final-boss').slice(0, count - 1), template[template.length - 1]];

  const pickFor = (kind: Slot['pick']): DungeonSkillSeed | undefined => {
    switch (kind) {
      case 'strong': return pickStrong();
      case 'recent': return pickRecent();
      case 'weak': return pickWeak();
      case 'due': return pickDue();
      default: return pickAny();
    }
  };

  const plan: RoomPlan[] = [];
  const seenTags: string[] = [];
  for (const slot of chosenSlots) {
    if (slot.pick === 'boss') {
      // Connect several already-seen (or weak) skills.
      const related = uniqueByTag([...seenTags.map(t => ({ skillTag: t })), ...weak, ...due])
        .slice(0, slot.type === 'final-boss' ? 4 : 3);
      const primary = related[0] ?? pickAny();
      if (!primary) continue;
      plan.push({
        type: slot.type, skillTag: primary.skillTag, subject: primary.subject, topicId: primary.topicId,
        difficulty: slot.diff, revisit: slot.revisit,
        relatedSkills: related.map(s => s.skillTag),
      });
      continue;
    }
    const seed = pickFor(slot.pick) ?? pickAny();
    if (!seed) continue;
    plan.push({
      type: slot.type, skillTag: seed.skillTag, subject: seed.subject, topicId: seed.topicId,
      difficulty: roomDifficulty(seed.skillTag, map, slot.diff, now), revisit: slot.revisit,
    });
    seenTags.push(seed.skillTag);
  }
  return plan;
};

// ─── HINT ECONOMICS ───────────────────────────────────────────────────────────

/** Reward/mastery multiplier after taking `hintsUsed` hint tiers (0–4). */
export const hintRewardMultiplier = (hintsUsed: number): number =>
  HINT_REWARD[Math.max(0, Math.min(hintsUsed, HINT_REWARD.length - 1))];

/**
 * XP for a cleared room: base scaled by how many hints were taken and whether
 * it took more than one attempt. Rewards shrink with help — they never vanish,
 * so a struggling student who gets there still earns something.
 */
export const roomXp = (baseXp: number, hintsUsed: number, attempts: number): number => {
  const mult = hintRewardMultiplier(hintsUsed);
  const attemptFactor = attempts <= 1 ? 1 : attempts === 2 ? 0.7 : 0.5;
  return Math.max(2, Math.round(baseXp * mult * attemptFactor));
};

// Confidence level (1–3) to attach to the mastery event, softened by hints.
export const confidenceFromRun = (hintsUsed: number, firstTry: boolean): 1 | 2 | 3 => {
  if (hintsUsed >= 2) return 1;
  if (!firstTry || hintsUsed === 1) return 2;
  return 3;
};

// ─── SPACED RETURN (in-run) ──────────────────────────────────────────────────

/**
 * A concept the student just missed should come back later in an ALTERED form.
 * If the AI supplied a spare (alternate-example) room for that skill, splice it
 * a couple of rooms ahead — but never after the final boss. Returns the same
 * dungeon untouched when there's no matching unused spare.
 */
export const injectSpareOnMiss = (dungeon: Dungeon, skillTag: string): Dungeon => {
  const tag = skillTag.trim().toLowerCase();
  const usedIds = new Set(dungeon.rooms.map(r => r.id));
  const spare = dungeon.spares.find(s => !usedIds.has(s.id) && s.skillTag.trim().toLowerCase() === tag);
  if (!spare) return dungeon;

  const rooms = [...dungeon.rooms];
  const bossAt = rooms.findIndex(r => r.type === 'final-boss');
  // A couple of rooms ahead, but before the final boss and never behind us.
  const insertAt = Math.max(
    dungeon.roomIndex + 1,
    Math.min(dungeon.roomIndex + 2, bossAt >= 0 ? bossAt : rooms.length)
  );
  rooms.splice(insertAt, 0, { ...spare, revisit: true });
  return { ...dungeon, rooms };
};

// ─── VALIDATION (AI output gate) ─────────────────────────────────────────────

const BANNED = /you keep failing|you failed|you always get this wrong|stupid|idiot/i;
const CHOICE_TYPES: Set<DungeonRoomType> = new Set(['mc-trap', 'explanation', 'mistake-detective']);
const BOSS_TYPES: Set<DungeonRoomType> = new Set(['mini-boss', 'final-boss']);

const validOptions = (opts: string[] | undefined, correctIndex: number | undefined): boolean => {
  const o = opts ?? [];
  if (o.length < 2) return false;
  if (new Set(o.map(x => x.trim().toLowerCase())).size !== o.length) return false;
  return correctIndex !== undefined && correctIndex >= 0 && correctIndex < o.length;
};

/** Keep only rooms that are structurally sound and non-punitive. */
export const validateDungeonRooms = (rooms: DungeonRoom[]): { valid: DungeonRoom[]; discarded: { title: string; reason: string }[] } => {
  const valid: DungeonRoom[] = [];
  const discarded: { title: string; reason: string }[] = [];
  const push = (room: DungeonRoom, reason: string) => discarded.push({ title: room?.title ?? '(untitled)', reason });

  for (const room of rooms) {
    if (!room || typeof room !== 'object') { discarded.push({ title: '(none)', reason: 'not an object' }); continue; }
    if (!room.skillTag?.trim() || !room.title?.trim()) { push(room, 'missing title/skillTag'); continue; }
    if (BANNED.test(`${room.title} ${room.explanation ?? ''} ${room.question ?? ''}`)) { push(room, 'punitive wording'); continue; }
    if (!room.explanation?.trim()) { push(room, 'missing explanation'); continue; }

    let ok = true;
    if (CHOICE_TYPES.has(room.type)) {
      if (!room.question?.trim() || !validOptions(room.options, room.correctIndex)) ok = false;
    } else if (room.type === 'recall') {
      if (!room.question?.trim() || !(room.answerExpression?.trim() || room.sampleAnswer?.trim())) ok = false;
    } else if (room.type === 'matching') {
      const p = room.pairs ?? [];
      if (p.length < 2 || p.some(x => !x.left?.trim() || !x.right?.trim())) ok = false;
    } else if (BOSS_TYPES.has(room.type)) {
      const sq = room.subQuestions ?? [];
      if (sq.length < 2 || sq.some(s => !s.question?.trim() || !validOptions(s.options, s.correctIndex))) ok = false;
    }
    if (!ok) { push(room, `invalid ${room.type} content`); continue; }

    // Normalize hints to exactly HINT_LEVELS: pad the last (full explanation) if short.
    let hints = (room.hints ?? []).filter(h => typeof h === 'string' && h.trim());
    if (hints.length === 0) hints = [room.explanation];
    while (hints.length < HINT_LEVELS) hints.push(hints[hints.length - 1] || room.explanation);
    valid.push({ ...room, hints: hints.slice(0, HINT_LEVELS) });
  }
  return { valid, discarded };
};

// ─── HISTORY (avoid identical repeats across dungeons) ───────────────────────

const normQ = (s: string): string => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const dungeonQuestionTexts = (rooms: DungeonRoom[]): string[] => {
  const out: string[] = [];
  for (const r of rooms) {
    if (r.question) out.push(r.question);
    (r.subQuestions ?? []).forEach(s => out.push(s.question));
    (r.pairs ?? []).forEach(p => out.push(`${p.left}=${p.right}`));
  }
  return out;
};

export const recordDungeonHistory = (history: string[] = [], asked: string[] = []): string[] => {
  const merged = [...history, ...asked.map(normQ).filter(Boolean)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = merged.length - 1; i >= 0; i--) {
    if (seen.has(merged[i])) continue;
    seen.add(merged[i]);
    out.unshift(merged[i]);
  }
  return out.slice(-DUNGEON_HISTORY_CAP);
};

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

export interface DungeonRoomOutcome {
  skillTag: string;
  type: DungeonRoomType;
  cleared: boolean;        // eventually answered correctly
  firstTry: boolean;
  hintsUsed: number;
}

export interface DungeonSummary {
  roomsTotal: number;
  roomsCleared: number;
  flawless: number;        // cleared first try, no hints
  strengthened: string[];  // skills cleared this run
  returning: string[];     // missed skills scheduled to come back
  earnedXp: number;
}

const dedupe = (xs: string[]): string[] => Array.from(new Set(xs));

export const buildDungeonSummary = (outcomes: DungeonRoomOutcome[], earnedXp: number): DungeonSummary => ({
  roomsTotal: outcomes.length,
  roomsCleared: outcomes.filter(o => o.cleared).length,
  flawless: outcomes.filter(o => o.cleared && o.firstTry && o.hintsUsed === 0).length,
  strengthened: dedupe(outcomes.filter(o => o.cleared).map(o => o.skillTag)),
  returning: dedupe(outcomes.filter(o => !o.cleared || o.hintsUsed >= 3).map(o => o.skillTag)),
  earnedXp,
});
