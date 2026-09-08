import { GradeLevel, QuestionType, UserProfile } from "../types";
import { dueForReview, weakestSkills, recordAttempt } from "./masteryEngine";
import {
  applyXpGain,
  calculateStreakWithFreeze,
  localDayKey,
} from "./engagement";
import type { ActivityResult, StudySet, StudySprint } from "./studyTypes";

export const isYoung = (grade: GradeLevel) =>
  [
    GradeLevel.KINDER,
    GradeLevel.ELEMENTARY_1_3,
    GradeLevel.ELEMENTARY_4_6,
    GradeLevel.GRADE_1,
    GradeLevel.GRADE_2,
    GradeLevel.GRADE_3,
    GradeLevel.GRADE_4,
    GradeLevel.GRADE_5,
    GradeLevel.GRADE_6,
  ].includes(grade);
export function recommendedSkill(user: UserProfile) {
  return (
    dueForReview(user.skillMap ?? {})[0] ??
    weakestSkills(user.skillMap ?? {}, 1)[0]
  );
}
export function createSprint(
  set: StudySet,
  minutes: 5 | 10 | 15,
  user: UserProfile,
  history: StudySprint[] = [],
): StudySprint {
  const preferred = recommendedSkill(user)?.skillTag;
  const lastSeen = new Map<string, number>();
  history
    .filter((s) => s.setId === set.id)
    .forEach((s) =>
      s.results.forEach((r) =>
        lastSeen.set(
          r.activityId,
          Math.max(lastSeen.get(r.activityId) ?? 0, Date.parse(r.ts)),
        ),
      ),
    );
  const questions = [...set.questions].sort(
    (a, b) =>
      (lastSeen.get(a.id) ?? 0) - (lastSeen.get(b.id) ?? 0) ||
      Number(b.skillTag === preferred) - Number(a.skillTag === preferred),
  );
  // Include a different response format early, even in a five-minute session.
  const alternate = questions.findIndex(
    (q) => q.questionType !== questions[0]?.questionType,
  );
  if (alternate > 2) questions.splice(2, 0, questions.splice(alternate, 1)[0]);
  return {
    id: crypto.randomUUID(),
    ownerId: user.id,
    setId: set.id,
    minutes,
    createdAt: new Date().toISOString(),
    step: 0,
    questionIds: questions
      .slice(0, minutes === 5 ? 3 : minutes === 10 ? 5 : 7)
      .map((q) => q.id),
    results: [],
    drafts: {},
    hints: {},
    reveals: {},
    messages: [],
  };
}
export function addResult(
  sprint: StudySprint,
  result: ActivityResult,
): StudySprint {
  return sprint.results.some((r) => r.activityId === result.activityId)
    ? sprint
    : { ...sprint, results: [...sprint.results, result] };
}
// A durable result ID is replay-safe when restoring a saved session after a crash.
export function applyStudyResults(
  user: UserProfile,
  results: ActivityResult[],
): UserProfile {
  const seen = new Set(user.studyResultIds ?? []);
  if (results.every((r) => seen.has(r.id))) return user;
  let next = user;
  for (const result of results) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    if (result.kind === "question" && !result.revealed) {
      next = {
        ...next,
        skillMap: recordAttempt(next.skillMap ?? {}, {
          skillTag: result.skillTag,
          subject: result.subject,
          correct: result.correct,
          questionType: result.questionType,
          difficulty: result.difficulty,
          hintsUsed: result.hintsUsed,
          ts: result.ts,
        }),
      };
    }
    const reward = result.kind === "teach" ? 5 : result.revealed ? 0 : 10;
    if (reward) {
      const streak = calculateStreakWithFreeze(next);
      next = applyXpGain(
        {
          ...next,
          streakDays: streak.streakDays,
          bestStreak: streak.bestStreak,
          streakFreezes: streak.streakFreezes,
          lastActivityDate: localDayKey(),
        },
        reward,
      ).user;
    }
  }
  return { ...next, studyResultIds: [...seen] };
}
export function sprintSummary(sprint: StudySprint) {
  const independent = sprint.results.filter(
    (r) => r.kind === "question" && r.correct && !r.hintsUsed && !r.revealed,
  );
  const retry = sprint.results.filter(
    (r) =>
      r.kind === "question" && (!r.correct || r.hintsUsed > 0 || r.revealed),
  );
  return {
    independent,
    retry,
    skills: [...new Set(independent.map((r) => r.skillTag))],
  };
}
