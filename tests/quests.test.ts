import {
  findQuestCandidates, buildQuest, validateQuestStages, scheduleQuestFollowUp,
  recordQuestCompletion, MIN_MISTAKES_FOR_QUEST, QUEST_COOLDOWN_DAYS, FOLLOW_UP_DAYS,
} from '../services/questEngine';
import { recordAttempt } from '../services/masteryEngine';
import { SkillMap, SkillAttemptEvent, QuestionType, QuestStage, ErrorQuest } from '../types';

let pass = 0, fail = 0;
const t = (label: string, got: any, want: any = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) console.log(`FAIL: ${label} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  else console.log(`PASS: ${label}`);
  ok ? pass++ : fail++;
};

const ev = (over: Partial<SkillAttemptEvent> = {}): SkillAttemptEvent => ({
  skillTag: 'adding fractions',
  correct: false,
  questionType: QuestionType.NUMERIC,
  difficulty: 3,
  hintsUsed: 0,
  mistakeKind: 'concept',
  ts: '2026-07-01T12:00:00',
  ...over,
});

// ── Candidate detection ───────────────────────────────────────────────────────
let map: SkillMap = {};
map = recordAttempt(map, ev());
t('one mistake is noise — no quest yet', findQuestCandidates(map).length, 0);

map = recordAttempt(map, ev({ ts: '2026-07-01T13:00:00' }));
const cands = findQuestCandidates(map);
t(`${MIN_MISTAKES_FOR_QUEST} same-kind mistakes create a candidate`, cands.length, 1);
t('candidate carries the mistake kind', cands[0].mistakeKind, 'concept');
t('candidate carries the skill', cands[0].skillTag, 'adding fractions');

// Active quest for the same pattern suppresses duplicates
const quest = buildQuest(cands[0], 'en');
t('active quest suppresses the same candidate', findQuestCandidates(map, [quest]).length, 0);

// Cooldown after completion
const completed = recordQuestCompletion([], { ...quest, completedAt: '2026-07-02T12:00:00' } as ErrorQuest, new Date('2026-07-02T12:00:00'));
t('cooldown suppresses recently repaired pattern',
  findQuestCandidates(map, [], completed, new Date('2026-07-03T12:00:00')).length, 0);
t('cooldown expires after the window',
  findQuestCandidates(map, [], completed, new Date(`2026-07-${2 + QUEST_COOLDOWN_DAYS + 1}T13:00:00`)).length, 1);

// ── Quest metadata: encouraging, informative ─────────────────────────────────
t('title is adventurous, not clinical', quest.title.length > 3);
t('reason uses repair framing', /repair|repair|nearly mastered/i.test(quest.reason));
t('reason never says "failing"', !/fail|failing|wrong again/i.test(quest.reason));
t('quest has estimated time', quest.estimatedMinutes > 0);
t('quest has XP reward', quest.xpReward > 0);
t('quest has a collectible badge', quest.badgeReward.length > 0);
t('difficulty within range', quest.difficulty >= 1 && quest.difficulty <= 5);
t('localized reason (ru)', /почти освоил/i.test(buildQuest(cands[0], 'ru').reason));

// ── Stage validation gate ─────────────────────────────────────────────────────
const goodStages: QuestStage[] = [
  { type: 'reminder', heading: 'The rule', body: 'To add fractions, first match the denominators.', bullets: ['Match bottoms first', 'Then add tops'] },
  { type: 'example', heading: 'Watch one', body: '1/2 + 1/4 → 2/4 + 1/4 = 3/4', bullets: ['Convert', 'Add'] },
  { type: 'spot-mistake', heading: 'Find it', body: '1/2 + 1/3 = 2/5', question: 'Where did this go wrong?', options: ['Added tops and bottoms directly', 'Forgot to simplify', 'Multiplied instead'], correctIndex: 0, explanation: 'Denominators must match before adding.' },
  { type: 'guided-fix', heading: 'Fix it together', body: 'Hint: the common denominator of 2 and 3 is 6.', question: 'What is 1/2 + 1/3?', options: ['5/6', '2/5', '3/6'], correctIndex: 0, explanation: '3/6 + 2/6 = 5/6.' },
  { type: 'independent', heading: 'Your turn', body: '', question: 'What is 1/4 + 1/3?', options: ['7/12', '2/7', '4/12'], correctIndex: 0, explanation: '3/12 + 4/12 = 7/12.' },
  { type: 'challenge', heading: 'Stretch', body: 'Optional twist.', question: 'What is 2/3 + 3/4?', options: ['17/12', '5/7', '6/12'], correctIndex: 0, explanation: '8/12 + 9/12 = 17/12.' },
  { type: 'reflection', heading: 'Teach it', body: '', question: 'Which explains the rule best?', options: ['Fractions need equal-size pieces before adding', 'Always add everything you see', 'Bigger denominators win'], correctIndex: 0, explanation: 'Equal pieces is exactly right.' },
];
t('valid 7-stage quest passes', validateQuestStages(goodStages).ok);
t('too few stages rejected', validateQuestStages(goodStages.slice(0, 2)).ok, false);
t('punitive wording rejected',
  validateQuestStages(goodStages.map((s, i) => i === 0 ? { ...s, body: 'You keep failing this topic.' } : s)).ok, false);
t('interactive stage without question rejected',
  validateQuestStages(goodStages.map((s, i) => i === 4 ? { ...s, question: '' } : s)).ok, false);
t('correctIndex out of range rejected',
  validateQuestStages(goodStages.map((s, i) => i === 3 ? { ...s, correctIndex: 9 } : s)).ok, false);
t('duplicate options rejected',
  validateQuestStages(goodStages.map((s, i) => i === 4 ? { ...s, options: ['7/12', '7/12', '4/12'] } : s)).ok, false);
t('all-passive quest rejected',
  validateQuestStages(goodStages.slice(0, 2).concat([{ type: 'reminder', heading: 'x', body: 'y' }])).ok, false);

// ── Spaced follow-up after completion ────────────────────────────────────────
let m2: SkillMap = {};
m2 = recordAttempt(m2, ev({ correct: true, mistakeKind: undefined })); // reviewDue = +1d
// Push the review far out to simulate an advanced ladder
m2 = { ...m2, 'adding fractions': { ...m2['adding fractions'], reviewDue: '2026-08-30T12:00:00.000Z', reviewIntervalDays: 30 } };
const after = scheduleQuestFollowUp(m2, 'adding fractions', new Date('2026-07-02T12:00:00'));
const dueMs = new Date(after['adding fractions'].reviewDue).getTime() - new Date('2026-07-02T12:00:00').getTime();
t(`follow-up pins review ~${FOLLOW_UP_DAYS} days out`, Math.round(dueMs / 86_400_000), FOLLOW_UP_DAYS);
t('follow-up shrinks the interval ladder', after['adding fractions'].reviewIntervalDays <= FOLLOW_UP_DAYS);

// A review already sooner than the follow-up stays untouched
let m3: SkillMap = {};
m3 = recordAttempt(m3, ev({ correct: true, mistakeKind: undefined, ts: '2026-07-02T12:00:00' })); // due +1d = Jul 3
const before3 = m3['adding fractions'].reviewDue;
const after3 = scheduleQuestFollowUp(m3, 'adding fractions', new Date('2026-07-02T13:00:00'));
t('sooner existing review is kept', after3['adding fractions'].reviewDue, before3);

// ── Completion bookkeeping ───────────────────────────────────────────────────
const many = Array.from({ length: 25 }, (_, i) =>
  recordQuestCompletion([], quest, new Date(`2026-06-${String((i % 28) + 1).padStart(2, '0')}T12:00:00`))[0]);
t('completion history is capped', recordQuestCompletion(many, quest).length <= 20);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
