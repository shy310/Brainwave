import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  GradeLevel,
  Language,
  QuestionType,
  Subject,
  UserProfile,
} from "../types";
import {
  addResult,
  applyStudyResults,
  createSprint,
  isYoung,
  recommendedSkill,
  sprintSummary,
} from "../services/studyEngine";
import { loadLibrary, saveLibrary, legacyNotes } from "../services/studyStore";
import { emptyRecord, recordAttempt } from "../services/masteryEngine";
import { validateStudySet, generateStudySet } from "../services/studyAI";
import { studyCopy } from "../services/studyCopy";
import type { ActivityResult, StudySet } from "../services/studyTypes";

const user = {
  id: "alice",
  name: "Alice",
  username: "alice",
  gradeLevel: GradeLevel.GRADE_9,
  totalXp: 0,
  streakDays: 0,
  progressMap: {},
  skillMap: {},
  enrolledCourses: [],
  preferredLanguage: "en",
  isRegistered: true,
} as UserProfile;
const source: StudySet["source"] = {
  id: "source",
  kind: "text",
  name: "Fractions",
  reviewed: true,
  pages: [{ number: 1, text: "One half is equal to two quarters." }],
};
const generated = {
  title: "Fractions",
  subject: "MATH",
  notes: "One half is two quarters. [Page 1]",
  cards: Array.from({ length: 4 }, (_, i) => ({
    front: `Card ${i}`,
    back: "Half",
    pages: [1],
  })),
  questions: Array.from({ length: 8 }, (_, i) => ({
    questionType: QuestionType.NUMERIC,
    question: `What is ${i + 1} divided by two?`,
    options: [],
    sampleAnswer: String((i + 1) / 2),
    answerExpression: String((i + 1) / 2),
    skillTag: "fractions",
    difficulty: 1,
    hint: "Split it into two equal groups.",
    explanation: `Divide by two to get ${(i + 1) / 2}.`,
    sourcePages: [1],
  })),
};
const set: StudySet = {
  ...validateStudySet(generated, source),
  id: "set",
  ownerId: user.id,
  source,
  grade: user.gradeLevel,
  language: "en",
  createdAt: new Date().toISOString(),
};
// Providers commonly omit choices for free-response questions, as instructed.
const withoutOptions = { ...generated, questions: generated.questions.map(({ options, ...q }) => q) };
assert.equal(validateStudySet(withoutOptions, source).questions.length, 8);
assert(validateStudySet(withoutOptions, source).questions.every(q => q.options.length === 0));
const missingChoiceOptions = { ...generated, questions: generated.questions.map(q => ({ ...q, questionType: QuestionType.MULTIPLE_CHOICE, options: undefined })) };
assert.throws(() => validateStudySet(missingChoiceOptions, source));
const originalFetch = globalThis.fetch;
let generationCalls = 0;
globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(++generationCalls === 1 ? missingChoiceOptions : withoutOptions) }] }), { status: 200 });
try {
  const repaired = await generateStudySet(source, user, 'en');
  assert.equal(repaired.questions.length, 8);
  assert.equal(generationCalls, 2);
  generationCalls = 0;
  globalThis.fetch = async () => { generationCalls++; return new Response(JSON.stringify({content:[{type:'text',text:'invalid'}]}), {status:200}); };
  await assert.rejects(generateStudySet(source, user, 'en'), /STUDY_INVALID_RESPONSE/);
  assert.equal(generationCalls, 2, 'repair is bounded, not an endless loop');
} finally { globalThis.fetch = originalFetch; }
const sprint = createSprint(set, 5, user);
assert.equal(sprint.questionIds.length, 3);
assert.equal(createSprint(set, 10, user).questionIds.length, 5);
assert.equal(createSprint(set, 15, user).questionIds.length, 7);
assert.equal(new Set(sprint.questionIds).size, 3);
assert(isYoung(GradeLevel.GRADE_2));
assert(!isYoung(GradeLevel.COLLEGE_ADVANCED));
const result: ActivityResult = {
  id: "sprint:1",
  activityId: sprint.questionIds[0],
  skillTag: "fractions",
  subject: Subject.MATH,
  questionType: QuestionType.NUMERIC,
  difficulty: 1,
  correct: true,
  hintsUsed: 0,
  revealed: false,
  answer: "0.5",
  feedback: "Correct",
  kind: "question",
  ts: new Date().toISOString(),
};
const updated = addResult(sprint, result);
assert.equal(addResult(updated, result).results.length, 1);
const rewarded = applyStudyResults(user, [result]);
assert.equal(rewarded.skillMap?.fractions.attemptsTotal, 1);
assert(rewarded.totalXp > 0);
assert.strictEqual(applyStudyResults(rewarded, [result]), rewarded);
const hinted = applyStudyResults(user, [{ ...result, hintsUsed: 1 }]);
assert.equal(hinted.skillMap?.fractions.successDays.length, 0);
assert.equal(hinted.skillMap?.fractions.formatsCorrect.length, 0);
assert.equal(hinted.skillMap?.fractions.reviewIntervalDays, 0);
const revealed = applyStudyResults(user, [{ ...result, revealed: true }]);
assert.equal(Object.keys(revealed.skillMap ?? {}).length, 0);
assert.equal(revealed.totalXp, 0);
const taught = applyStudyResults(user, [{ ...result, kind: "teach" }]);
assert.equal(Object.keys(taught.skillMap ?? {}).length, 0);
assert(taught.totalXp > 0);
assert.equal(sprintSummary(updated).independent.length, 1);
assert.equal(
  sprintSummary({ ...updated, results: [{ ...result, hintsUsed: 1 }] }).retry
    .length,
  1,
);
const weak = {
  ...emptyRecord("fractions"),
  masteryScore: 15,
  attemptsTotal: 1,
  reviewDue: "2020-01-01T00:00:00Z",
};
assert.equal(
  recommendedSkill({ ...user, skillMap: { fractions: weak } })?.skillTag,
  "fractions",
);
const later = recordAttempt(
  { fractions: weak },
  {
    skillTag: "fractions",
    correct: true,
    hintsUsed: 2,
    questionType: QuestionType.NUMERIC,
    difficulty: 1,
  },
);
assert.equal(later.fractions.reviewDue, weak.reviewDue);
assert.throws(() =>
  validateStudySet(
    { ...generated, notes: "Wrong reference [Page 99]" },
    source,
  ),
);
assert.throws(() =>
  validateStudySet(
    {
      ...generated,
      questions: generated.questions.map((q) => ({ ...q, sourcePages: [99] })),
    },
    source,
  ),
);
assert.throws(() =>
  validateStudySet(
    {
      ...generated,
      questions: generated.questions.map(() => generated.questions[0]),
    },
    source,
  ),
);
assert.throws(() => validateStudySet({ title: "Broken" }, source));
const library = {
  version: 1 as const,
  sets: [set],
  sprints: [{ ...updated, drafts: { x: "unfinished work" }, hints: { x: 1 } }],
  importedLegacyIds: [],
};
await saveLibrary(user.id, library);
const restored = await loadLibrary(user.id);
assert.equal(restored.sprints[0].drafts.x, "unfinished work");
assert.equal(restored.sprints[0].results[0].id, result.id);
assert.equal((await loadLibrary("bob")).sets.length, 0);
await assert.rejects(() => saveLibrary("bob", library));
const old = JSON.stringify([
  {
    id: "legacy",
    title: "Old lesson",
    note: { sections: [{ title: "Basics", content: "Some old notes." }] },
  },
]);
Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: () => old },
});
assert.equal(legacyNotes()[0].id, "legacy");
assert.equal(
  (await loadLibrary("bob")).sets.length,
  0,
  "legacy notes must never be silently imported",
);
for (const lang of ["en", "ru", "he", "ar"] as Language[]) {
  assert(Object.values(studyCopy(lang)).every((s) => s.trim().length));
}
console.log(
  "Study tests passed: validation, source references, adaptive priority, assisted mastery, rewards, recovery, profile isolation, legacy opt-in, and translations.",
);
