import {
  comebackEligible, selectComebackSkills, recordComebackQuestions, buildComebackSummary,
  COMEBACK_MIN_QUESTIONS, COMEBACK_MAX_QUESTIONS, ComebackOutcome,
} from '../services/comebackEngine';
import { recordAttempt } from '../services/masteryEngine';
import { SkillMap, SkillAttemptEvent, QuestionType } from '../types';

let pass = 0, fail = 0;
const t = (label: string, got: any, want: any = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) console.log(`FAIL: ${label} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  else console.log(`PASS: ${label}`);
  ok ? pass++ : fail++;
};

const ev = (over: Partial<SkillAttemptEvent> = {}): SkillAttemptEvent => ({
  skillTag: 'fractions', correct: true, questionType: QuestionType.MULTIPLE_CHOICE,
  difficulty: 3, hintsUsed: 0, timeMs: 6000, ...over,
});
const day = (d: number, hour = 12) => `2026-07-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;
const NOW = new Date(day(31, 12));

// Build a varied map: a recent skill, a ~1-week-old skill, an old skill, and a
// struggled skill (repeated wrong answers).
let map: SkillMap = {};
map = recordAttempt(map, ev({ skillTag: 'recent skill', ts: day(30) }));                 // 1 day ago
map = recordAttempt(map, ev({ skillTag: 'week skill', ts: day(24) }));                    // ~7 days ago
map = recordAttempt(map, ev({ skillTag: 'old skill', ts: day(1) }));                      // 30 days ago
map = recordAttempt(map, ev({ skillTag: 'shaky skill', correct: false, mistakeKind: 'sign', ts: day(29) }));
map = recordAttempt(map, ev({ skillTag: 'shaky skill', correct: false, mistakeKind: 'sign', ts: day(29, 13) }));

// ── Eligibility ───────────────────────────────────────────────────────────────
t('eligible once enough skills are practiced', comebackEligible(map, undefined, NOW));
t('not eligible again the same day it was offered',
  comebackEligible(map, '2026-07-31', NOW), false);
t('eligible again on a later day', comebackEligible(map, '2026-07-30', NOW));
t('not eligible with too few skills', comebackEligible({}, undefined, NOW), false);

// ── Selection ─────────────────────────────────────────────────────────────────
const alwaysMastered = () => 0; // rand < 0.35 → include a mastered slot when available
const neverMastered = () => 0.99;

const sel = selectComebackSkills(map, NOW, { rand: neverMastered });
t('selects between MIN and MAX questions',
  sel.length >= COMEBACK_MIN_QUESTIONS && sel.length <= COMEBACK_MAX_QUESTIONS);
t('never selects the same skill twice',
  new Set(sel.map(s => s.skillTag)).size, sel.length);
t('a struggled skill is included', sel.some(s => s.skillTag === 'shaky skill'));
t('the struggled skill is labelled struggled',
  sel.find(s => s.skillTag === 'shaky skill')?.reason, 'struggled');

// Spread across time buckets when nothing is due for review yet
const reasons = new Set(sel.map(s => s.reason));
t('selection spans multiple reason categories', reasons.size >= 3);

// Respects a smaller requested count
t('honours a requested count of 3', selectComebackSkills(map, NOW, { count: 3, rand: neverMastered }).length, 3);

// Empty map → nothing to review
t('empty map yields no selection', selectComebackSkills({}, NOW).length, 0);

// Mastered slot only appears when the dice allow it AND a mastered skill exists
let mmap: SkillMap = {};
// Drive one skill all the way to mastered across days/formats.
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(1) }));
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(2), questionType: QuestionType.NUMERIC }));
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(5), questionType: QuestionType.TRUE_FALSE }));
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(5, 13) }));
// A few more clean reps to push the difficulty-weighted EMA past the 85 gate.
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(5, 14) }));
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(5, 15) }));
mmap = recordAttempt(mmap, ev({ skillTag: 'star', ts: day(5, 16) }));
mmap = recordAttempt(mmap, ev({ skillTag: 'plain', ts: day(30) }));
mmap = recordAttempt(mmap, ev({ skillTag: 'plain2', ts: day(24) }));
t('star skill reached mastered', mmap['star'].status, 'mastered');
const withM = selectComebackSkills(mmap, new Date(day(6)), { rand: alwaysMastered });
t('mastered skill can be surfaced when the dice allow', withM.some(s => s.reason === 'mastered'));

// ── Avoid-repeat history ────────────────────────────────────────────────────
const h1 = recordComebackQuestions([], ['What is 1/2 + 1/4?', 'What is  1/2 + 1/4?']);
t('history de-dupes normalized question text', h1.length, 1);
const h2 = recordComebackQuestions(h1, ['A brand new question']);
t('history appends new questions', h2.length, 2);
const big = recordComebackQuestions([], Array.from({ length: 60 }, (_, i) => `q${i}`));
t('history is capped at 40', big.length, 40);
t('history cap keeps the most recent', big[big.length - 1], 'q59');

// ── Summary ──────────────────────────────────────────────────────────────────
const before: SkillMap = JSON.parse(JSON.stringify(map));
let after: SkillMap = JSON.parse(JSON.stringify(map));
// The student recalls two skills correctly and misses one.
after = recordAttempt(after, ev({ skillTag: 'recent skill', ts: day(31) }));
after = recordAttempt(after, ev({ skillTag: 'week skill', ts: day(31) }));
after = recordAttempt(after, ev({ skillTag: 'shaky skill', correct: false, mistakeKind: 'sign', ts: day(31) }));

const outcomes: ComebackOutcome[] = [
  { selection: { skillTag: 'recent skill', record: after['recent skill'], reason: 'recent' }, correct: true },
  { selection: { skillTag: 'week skill', record: after['week skill'], reason: 'week' }, correct: true },
  { selection: { skillTag: 'shaky skill', record: after['shaky skill'], reason: 'struggled' }, correct: false },
];
const summary = buildComebackSummary(outcomes, before, after, NOW);
t('summary counts total questions', summary.total, 3);
t('summary counts correct answers', summary.correctCount, 2);
t('remembered lists the recalled skills', summary.remembered.sort(), ['recent skill', 'week skill']);
t('missed skill is not in remembered', summary.remembered.includes('shaky skill'), false);
t('summary schedules one future review', !!summary.nextReview);
t('summary never reduces to only a score',
  summary.remembered.length > 0 || summary.gettingStronger.length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
