import {
  recordAttempt, computeStatus, classifyMistake, dueForReview, weakestSkills,
  dominantMistake, averageConfidence, REVIEW_INTERVALS, mergeSkillMaps,
} from '../services/masteryEngine';
import { SkillMap, SkillAttemptEvent, QuestionType } from '../types';

let pass = 0, fail = 0;
const t = (label: string, got: any, want: any = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) console.log(`FAIL: ${label} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  else console.log(`PASS: ${label}`);
  ok ? pass++ : fail++;
};

const ev = (over: Partial<SkillAttemptEvent> = {}): SkillAttemptEvent => ({
  skillTag: 'fractions',
  correct: true,
  questionType: QuestionType.MULTIPLE_CHOICE,
  difficulty: 4,
  hintsUsed: 0,
  timeMs: 8000,
  ...over,
});
// Local-noon timestamps so day keys are stable regardless of timezone
const day = (d: number, hour = 12) => `2026-07-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;

// ── Basic recording ───────────────────────────────────────────────────────────
let map: SkillMap = {};
map = recordAttempt(map, ev({ ts: day(1) }));
let r = map['fractions'];
t('first attempt recorded', [r.attemptsTotal, r.attemptsCorrect, r.streak], [1, 1, 1]);
t('one correct answer is NOT mastered', computeStatus(r, new Date(day(1))) !== 'mastered');
t('one correct answer is NOT secure either', ['learning', 'developing'].includes(computeStatus(r, new Date(day(1)))));
t('review scheduled after first success', r.reviewDue.length > 0);
t('first review interval is the shortest rung', r.reviewIntervalDays, REVIEW_INTERVALS[0]);

// Same-day extra corrects do NOT advance the review ladder (no cramming)
map = recordAttempt(map, ev({ ts: day(1, 13) }));
map = recordAttempt(map, ev({ ts: day(1, 14) }));
r = map['fractions'];
t('same-day repeats do not advance review interval', r.reviewIntervalDays, REVIEW_INTERVALS[0]);
t('success days deduplicated', r.successDays.length, 1);

// ── Multi-session, multi-format path to mastery ──────────────────────────────
map = recordAttempt(map, ev({ ts: day(2), questionType: QuestionType.NUMERIC })); // due review passed → advance
r = map['fractions'];
t('review after due date advances the ladder', r.reviewIntervalDays, REVIEW_INTERVALS[1]);
t('second format recorded', r.formatsCorrect.length, 2);
t('still not mastered after 2 days', computeStatus(r, new Date(day(2))) !== 'mastered');

map = recordAttempt(map, ev({ ts: day(5), questionType: QuestionType.TRUE_FALSE })); // next due passed
map = recordAttempt(map, ev({ ts: day(5, 13) }));
r = map['fractions'];
t('mastered after 3 success days + 2 formats + spaced reviews + high score',
  computeStatus(r, new Date(day(5, 14))), 'mastered');
t('mastery score is high', r.masteryScore >= 85);

// ── Decay: mastered skill overdue → needs review ─────────────────────────────
t('overdue mastered skill flips to needs_review',
  computeStatus(r, new Date('2026-09-01T12:00:00')), 'needs_review');
t('dueForReview surfaces the overdue skill',
  dueForReview(map, new Date('2026-09-01T12:00:00')).map(x => x.skillTag), ['fractions']);

// ── Failure handling ─────────────────────────────────────────────────────────
map = recordAttempt(map, ev({ ts: day(6), correct: false, mistakeKind: 'sign' }));
r = map['fractions'];
t('failure resets streak', r.streak, 0);
t('failure resets review ladder', r.reviewIntervalDays, REVIEW_INTERVALS[0]);
t('mistake kind counted', r.mistakeCounts['sign'], 1);
map = recordAttempt(map, ev({ ts: day(6, 13), correct: false, mistakeKind: 'sign' }));
map = recordAttempt(map, ev({ ts: day(6, 14), correct: false, mistakeKind: 'concept' }));
r = map['fractions'];
t('dominant mistake is the most frequent', dominantMistake(r), 'sign');
t('repeated failures pull status to needs_review',
  computeStatus(r, new Date(day(6, 15))), 'needs_review');

// Corrected-after-mistake tracking
map = recordAttempt(map, ev({ ts: day(7), corrected: true }));
r = map['fractions'];
t('corrected mistakes counted', r.correctedCount, 1);

// ── Hints, time, confidence, explain evidence ────────────────────────────────
let m2: SkillMap = {};
m2 = recordAttempt(m2, ev({ skillTag: 'algebra', ts: day(1), hintsUsed: 2 }));
m2 = recordAttempt(m2, ev({ skillTag: 'algebra', ts: day(1, 13), hintsUsed: 0 }));
t('hints accumulate', m2['algebra'].hintsTotal, 2);
const withHints = m2['algebra'].masteryScore;
let m3: SkillMap = {};
m3 = recordAttempt(m3, ev({ skillTag: 'algebra', ts: day(1), hintsUsed: 0 }));
m3 = recordAttempt(m3, ev({ skillTag: 'algebra', ts: day(1, 13), hintsUsed: 0 }));
t('hinted correct answers earn less mastery than clean ones', withHints < m3['algebra'].masteryScore);
t('avg time tracked', m2['algebra'].avgTimeMs! > 0);

m3 = recordAttempt(m3, ev({ skillTag: 'algebra', ts: day(2), confidence: 3 }));
m3 = recordAttempt(m3, ev({ skillTag: 'algebra', ts: day(2, 13), confidence: 1 }));
t('average confidence computed', averageConfidence(m3['algebra']), 2);

m3 = recordAttempt(m3, ev({ skillTag: 'algebra', ts: day(3), questionType: QuestionType.SHORT_ANSWER, explainEvidence: true }));
t('open-format correct answer marks canExplain', m3['algebra'].canExplain, true);
t('choice-only answers never mark canExplain', m2['algebra'].canExplain, false);

// ── weakestSkills ────────────────────────────────────────────────────────────
let m4: SkillMap = {};
for (let i = 0; i < 3; i++) m4 = recordAttempt(m4, ev({ skillTag: 'strong', ts: day(1, 10 + i) }));
for (let i = 0; i < 3; i++) m4 = recordAttempt(m4, ev({ skillTag: 'weak', ts: day(1, 10 + i), correct: false, mistakeKind: 'concept' }));
t('weakestSkills ranks the failing skill first', weakestSkills(m4, 1)[0].skillTag, 'weak');

// ── Mistake classification ───────────────────────────────────────────────────
const numEx = { questionType: QuestionType.NUMERIC, answerExpression: '30', sampleAnswer: '30', unitRequired: false } as any;
t('classify: sign flip', classifyMistake(numEx, '-30'), 'sign');
t('classify: order-of-magnitude slip', classifyMistake(numEx, '300'), 'magnitude');
t('classify: near-miss arithmetic', classifyMistake(numEx, '29'), 'arithmetic');
t('classify: unrelated numeric answer is a concept gap', classifyMistake(numEx, '7'), 'concept');
t('classify: gibberish is a recall gap', classifyMistake(numEx, 'i dont know'), 'recall');
const unitEx = { questionType: QuestionType.NUMERIC, answerExpression: '5 cm', sampleAnswer: '5 cm', unitRequired: true } as any;
t('classify: missing unit', classifyMistake(unitEx, '5'), 'units');
t('classify: MC wrong option is concept', classifyMistake({ questionType: QuestionType.MULTIPLE_CHOICE } as any, '9'), 'concept');
t('classify: multi-select miss is incomplete', classifyMistake({ questionType: QuestionType.MULTI_SELECT } as any, ''), 'incomplete');

// ── mergeSkillMaps: stale server data cannot clobber fresh local records ─────
let localMap: SkillMap = {};
localMap = recordAttempt(localMap, ev({ skillTag: 'geometry', correct: true, mistakeKind: undefined, ts: day(10) }));
localMap = recordAttempt(localMap, ev({ skillTag: 'geometry', correct: true, mistakeKind: undefined, ts: day(10, 13) }));
let serverMap: SkillMap = {};
serverMap = recordAttempt(serverMap, ev({ skillTag: 'geometry', correct: true, mistakeKind: undefined, ts: day(2) })); // older
serverMap = recordAttempt(serverMap, ev({ skillTag: 'algebra basics', correct: true, mistakeKind: undefined, ts: day(3) })); // only on server
const merged = mergeSkillMaps(localMap, serverMap);
t('merge keeps the fresher local record', merged['geometry'].attemptsTotal, 2);
t('merge adopts server-only skills', 'algebra basics' in merged, true);
t('merge prefers newer server record over older local',
  mergeSkillMaps(serverMap, localMap)['geometry'].attemptsTotal, 2);
t('merge handles empty inputs', Object.keys(mergeSkillMaps(undefined as any, undefined as any)).length, 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
