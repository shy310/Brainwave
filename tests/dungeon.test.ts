import {
  planDungeon, hintRewardMultiplier, roomXp, confidenceFromRun, injectSpareOnMiss,
  validateDungeonRooms, recordDungeonHistory, dungeonQuestionTexts, buildDungeonSummary,
  DEFAULT_DUNGEON_ROOMS, HINT_LEVELS, DungeonRoomOutcome,
} from '../services/dungeonEngine';
import { recordAttempt } from '../services/masteryEngine';
import { SkillMap, SkillAttemptEvent, QuestionType, Dungeon, DungeonRoom } from '../types';

let pass = 0, fail = 0;
const t = (label: string, got: any, want: any = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) console.log(`FAIL: ${label} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  else console.log(`PASS: ${label}`);
  ok ? pass++ : fail++;
};

const ev = (over: Partial<SkillAttemptEvent> = {}): SkillAttemptEvent => ({
  skillTag: 'x', correct: true, questionType: QuestionType.MULTIPLE_CHOICE,
  difficulty: 3, hintsUsed: 0, timeMs: 6000, ...over,
});
const day = (d: number, hour = 12) => `2026-07-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;
const NOW = new Date(day(31));

// Build a varied map: strong, recent, and a genuinely weak (repeatedly missed) skill.
let map: SkillMap = {};
for (let i = 0; i < 4; i++) map = recordAttempt(map, ev({ skillTag: 'strong skill', ts: day(20 + i, 10) }));
map = recordAttempt(map, ev({ skillTag: 'recent skill', ts: day(30) }));
map = recordAttempt(map, ev({ skillTag: 'weak skill', correct: false, mistakeKind: 'sign', ts: day(29) }));
map = recordAttempt(map, ev({ skillTag: 'weak skill', correct: false, mistakeKind: 'sign', ts: day(29, 13) }));

// ── Planning ─────────────────────────────────────────────────────────────────
const plan = planDungeon(map, [], {}, NOW);
t('plans the default number of rooms', plan.length, DEFAULT_DUNGEON_ROOMS);
t('the last room is the final boss', plan[plan.length - 1].type, 'final-boss');
t('there is a mistake-detective room', plan.some(p => p.type === 'mistake-detective'));
t('there is a mini-boss room', plan.some(p => p.type === 'mini-boss'));
t('at least one room is a spaced revisit', plan.some(p => p.revisit));
t('the weak skill is targeted somewhere', plan.some(p => p.skillTag === 'weak skill'));
t('the final boss connects several skills', (plan[plan.length - 1].relatedSkills?.length ?? 0) >= 2);

// Short dungeon still ends on a boss
const short = planDungeon(map, [], { count: 4 }, NOW);
t('a short dungeon has the requested room count', short.length, 4);
t('a short dungeon still ends on the final boss', short[short.length - 1].type, 'final-boss');

// Thin map falls back to course topics
const thin = planDungeon({}, [{ skillTag: 'photosynthesis' }, { skillTag: 'cell division' }], { count: 3 }, NOW);
t('a blank map uses fallback course topics', thin.length >= 3 && thin.every(p => !!p.skillTag));
t('no rooms at all when there is nothing to draw from', planDungeon({}, [], {}, NOW).length, 0);

// ── Hint economics ───────────────────────────────────────────────────────────
t('no hints keeps full reward', hintRewardMultiplier(0), 1);
t('each hint tier lowers the reward', hintRewardMultiplier(1) < 1 && hintRewardMultiplier(3) < hintRewardMultiplier(1));
t('reward never drops to zero even with every hint', hintRewardMultiplier(HINT_LEVELS) > 0);
t('clean clear earns full base XP', roomXp(20, 0, 1), 20);
t('hints reduce earned XP', roomXp(20, 2, 1) < 20);
t('a retried clear earns less than a first-try clear', roomXp(20, 0, 2) < roomXp(20, 0, 1));
t('XP never goes below the floor', roomXp(20, 4, 3) >= 2);
t('clean first try is high confidence', confidenceFromRun(0, true), 3);
t('needing hints lowers confidence', confidenceFromRun(2, true), 1);

// ── Spaced return (spare injection) ──────────────────────────────────────────
const room = (id: string, type: any, skillTag: string): DungeonRoom => ({
  id, type, title: id, skillTag, difficulty: 3, revisit: false,
  question: `q ${id}`, options: ['a', 'b'], correctIndex: 0,
  hints: ['h1', 'h2', 'h3', 'h4'], explanation: 'because', xpValue: 20,
});
const dungeon: Dungeon = {
  id: 'd1', title: 'Test', createdAt: NOW.toISOString(), language: 'en' as any,
  rooms: [room('r1', 'recall', 'weak skill'), room('r2', 'mc-trap', 'other'), room('boss', 'final-boss', 'weak skill')],
  spares: [room('spare-weak', 'recall', 'weak skill')],
  roomIndex: 0, clearedRooms: 0, earnedXp: 0,
};
const after = injectSpareOnMiss(dungeon, 'weak skill');
t('a missed skill re-injects its spare room', after.rooms.some(r => r.id === 'spare-weak'));
t('the spare lands before the final boss',
  after.rooms.findIndex(r => r.id === 'spare-weak') < after.rooms.findIndex(r => r.type === 'final-boss'));
t('the re-injected room is marked as a revisit', after.rooms.find(r => r.id === 'spare-weak')?.revisit, true);
t('no spare for an unknown skill leaves the dungeon unchanged',
  injectSpareOnMiss(dungeon, 'nope').rooms.length, dungeon.rooms.length);

// ── Validation ───────────────────────────────────────────────────────────────
const rawRooms: any[] = [
  { id: 'ok-mc', type: 'mc-trap', title: 'Vault', skillTag: 'algebra', difficulty: 3, question: 'x?', options: ['1', '2', '3'], correctIndex: 1, hints: ['a'], explanation: 'e' },
  { id: 'bad-idx', type: 'mc-trap', title: 'Bad', skillTag: 'algebra', question: 'x?', options: ['1', '2'], correctIndex: 5, hints: ['a'], explanation: 'e' },
  { id: 'dup-opt', type: 'mc-trap', title: 'Dup', skillTag: 'algebra', question: 'x?', options: ['1', '1'], correctIndex: 0, hints: ['a'], explanation: 'e' },
  { id: 'ok-recall', type: 'recall', title: 'Echo', skillTag: 'facts', question: 'name it', sampleAnswer: 'mitochondria', hints: ['a'], explanation: 'e' },
  { id: 'bad-recall', type: 'recall', title: 'Empty', skillTag: 'facts', question: 'name it', hints: ['a'], explanation: 'e' },
  { id: 'ok-match', type: 'matching', title: 'Pairs', skillTag: 'terms', pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }], hints: ['a'], explanation: 'e' },
  { id: 'ok-boss', type: 'final-boss', title: 'Dragon', skillTag: 'mix', subQuestions: [{ question: 'q1', options: ['a', 'b'], correctIndex: 0 }, { question: 'q2', options: ['a', 'b'], correctIndex: 1 }], hints: ['a'], explanation: 'e' },
  { id: 'punitive', type: 'recall', title: 'You keep failing this', skillTag: 'facts', question: 'q', sampleAnswer: 'x', hints: ['a'], explanation: 'e' },
];
const { valid, discarded } = validateDungeonRooms(rawRooms as DungeonRoom[]);
const ids = valid.map(r => r.id);
t('valid rooms of every kind pass', ['ok-mc', 'ok-recall', 'ok-match', 'ok-boss'].every(id => ids.includes(id)));
t('out-of-range correctIndex is discarded', !ids.includes('bad-idx'));
t('duplicate options are discarded', !ids.includes('dup-opt'));
t('a recall room with no answer is discarded', !ids.includes('bad-recall'));
t('punitive wording is discarded', !ids.includes('punitive'));
t('some rooms were discarded', discarded.length, 4);
t('hints are padded to the full four tiers', valid.find(r => r.id === 'ok-mc')!.hints.length, HINT_LEVELS);

// ── History ──────────────────────────────────────────────────────────────────
const texts = dungeonQuestionTexts(valid);
t('question texts are extracted from rooms', texts.length > 0);
const h = recordDungeonHistory(['old q'], ['New Q', 'new q']);
t('history de-dupes normalized text and appends', h.length, 2);

// ── Summary ──────────────────────────────────────────────────────────────────
const outcomes: DungeonRoomOutcome[] = [
  { skillTag: 'a', type: 'recall', cleared: true, firstTry: true, hintsUsed: 0 },
  { skillTag: 'b', type: 'mc-trap', cleared: true, firstTry: false, hintsUsed: 1 },
  { skillTag: 'c', type: 'recall', cleared: false, firstTry: false, hintsUsed: 4 },
];
const sum = buildDungeonSummary(outcomes, 46);
t('summary counts cleared rooms', sum.roomsCleared, 2);
t('summary counts flawless rooms', sum.flawless, 1);
t('summary lists strengthened skills', sum.strengthened.sort(), ['a', 'b']);
t('summary schedules the missed skill to return', sum.returning.includes('c'));
t('summary carries earned XP', sum.earnedXp, 46);
t('summary is more than a score', sum.strengthened.length > 0 && sum.returning.length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
