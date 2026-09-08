import { QuestionType, Subject } from '../types';
import type { StudySet, StudySource } from './studyTypes';
import { validateExercise } from './questionValidator';
const text = (s: unknown): s is string => typeof s === 'string' && !!s.trim();
export function validateStudySet(
  raw: unknown,
  source: StudySource,
): {
  title: string;
  notes: string;
  cards: StudySet["cards"];
  questions: StudySet["questions"];
  subject: Subject;
} {
  const r = raw as any;
  if (
    !r ||
    !text(r.title) ||
    !text(r.notes) ||
    !Array.isArray(r.cards) ||
    !Array.isArray(r.questions)
  )
    throw new Error("Invalid study response");
  const pages = new Set(source.pages.map((p) => p.number));
  for (const match of r.notes.matchAll(/\[Page\s+(\d+)\]/g)) {
    if (!pages.has(Number(match[1])))
      throw new Error("Unknown source page in notes");
  }
  const refs = (v: unknown): v is number[] =>
    Array.isArray(v) &&
    (source.kind === "topic" || v.length > 0) &&
    v.every((p) => Number.isInteger(p) && pages.has(p));
  // A topic has no uploaded source to cite. Normalize only absent references;
  // never erase explicit invalid references or invent citations for uploads.
  const cards = r.cards.map((c: any) => c && source.kind === 'topic' && c.pages == null ? {...c, pages: []} : c).filter(
    (c: any) => text(c?.front) && text(c?.back) && refs(c.pages),
  );
  const seen = new Set<string>();
  const questions = r.questions
    .map((q: any) => q && source.kind === 'topic' && q.sourcePages == null ? {...q, sourcePages: []} : q)
    .map((q: any) => q && q.questionType !== QuestionType.MULTIPLE_CHOICE && q.options == null
      ? { ...q, options: [] }
      : q)
    .filter((q: any) => {
      if (
        !q ||
        !text(q.question) ||
        !text(q.explanation) ||
        !text(q.hint) ||
        !text(q.skillTag) ||
        !refs(q.sourcePages)
      )
        return false;
      if (
        ![
          QuestionType.MULTIPLE_CHOICE,
          QuestionType.NUMERIC,
          QuestionType.SHORT_ANSWER,
        ].includes(q.questionType)
      )
        return false;
      const fingerprint = q.question.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(fingerprint)) return false;
      if (
        !Array.isArray(q.options) ||
        q.options.some((o: any) => !text(o?.id) || !text(o?.text))
      )
        return false;
      if (
        q.questionType === QuestionType.MULTIPLE_CHOICE &&
        (new Set(q.options.map((o: any) => o.id)).size !== q.options.length ||
          !q.options.some((o: any) => o.id === q.correctOptionId))
      )
        return false;
      if (
        q.questionType !== QuestionType.MULTIPLE_CHOICE &&
        !text(q.sampleAnswer) &&
        !text(q.answerExpression)
      )
        return false;
      if (!validateExercise({ ...q, id: "validate" }).ok) return false;
      seen.add(fingerprint);
      return true;
    })
    .map((q: any) => ({
      ...q,
      ...validateExercise({ ...q, id: 'validate' }).exercise,
      id: crypto.randomUUID(),
      difficulty: Math.max(1, Math.min(5, Number(q.difficulty) || 1)),
    }));
  if (cards.length < 3 || questions.length < 7)
    throw new Error(
      `Not enough valid study activities (${cards.length} cards, ${questions.length} questions). Each question needs questionType, question, explanation, hint, skillTag and sourcePages. Validation issues: ${r.questions.filter(Boolean).flatMap((q: any) => validateExercise({ ...q, id: 'validate' }).reasons).slice(0, 12).join('; ')}`,
    );
  return {
    title: r.title,
    notes: r.notes,
    cards: cards.slice(0, 12),
    questions: questions.slice(0, 10),
    subject: Object.values(Subject).includes(r.subject)
      ? r.subject
      : Subject.SCIENCE,
  };
}
