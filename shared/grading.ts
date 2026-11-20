import { z } from 'zod';

// "Grade my answer": an answer (a quiz question, homework or an essay) is
// scored against a model answer and/or the marking criteria, with feedback.

export const MAX_GRADED_ANSWER = 8000;

export const GradeAnswerInputSchema = z.object({
  question: z.string().trim().min(3).max(4000),
  answer: z.string().trim().min(1).max(MAX_GRADED_ANSWER),
  /** A model answer or the key points expected. */
  reference: z.string().max(4000).optional(),
  /** Marking criteria from the teacher, if any. */
  rubric: z.string().max(3000).optional(),
  /** Lecture text to grade against (e.g. the lecture a quiz came from). */
  context: z.string().max(20_000).optional(),
  /** A short quiz answer or a longer piece of work. */
  kind: z.enum(['quiz', 'essay']).default('essay'),
});
export type GradeAnswerInput = z.infer<typeof GradeAnswerInputSchema>;

export const GradeAnswerSchema = z.object({
  /** 0–100 overall. */
  score: z.number().int().min(0).max(100),
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  /** One tile per criterion, each scored out of 10. */
  criteria: z.array(z.object({
    name: z.string().min(1).max(80),
    score: z.number().int().min(0).max(10),
    comment: z.string().max(500),
  })).min(1).max(6),
  strengths: z.array(z.string().max(400)).max(4),
  improvements: z.array(z.string().max(400)).max(5),
  feedback: z.string().min(1).max(1500),
  /** A better answer to learn from: the model answer for quizzes, an improved version for longer work. */
  improved: z.string().max(6000),
});
export type GradeAnswer = z.infer<typeof GradeAnswerSchema>;

/** A score of at least this counts as correct in a quiz. */
export const PASS_SCORE = 70;
