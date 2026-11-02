import { z } from 'zod';

// ── Questions ──────────────────────────────────────────────────────────────
// One flat shape for every question so the AI's structured output stays simple:
//  - kind "choice": `options` + `correctIndex`
//  - kind "input":  typed answer in `answer`, alternatives in `accepted`
// `check` is an optional plain-arithmetic expression for the right answer; the
// server evaluates it to verify (and fix) what the AI marked as correct.

export const QuestionSchema = z.object({
  kind: z.enum(['choice', 'input']),
  prompt: z.string().min(3).max(1200),
  options: z.array(z.string().max(300)).max(6),
  correctIndex: z.number().int().min(-1).max(5),
  answer: z.string().max(300),
  accepted: z.array(z.string().max(300)).max(6),
  check: z.string().max(200),
  hint: z.string().max(600),
  explanation: z.string().min(1).max(2000),
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuizSchema = z.object({ questions: z.array(QuestionSchema).min(1).max(12) });
export type Quiz = z.infer<typeof QuizSchema>;

export const DIFFICULTIES = ['easier', 'normal', 'harder'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// ── Lessons ────────────────────────────────────────────────────────────────

export const LessonSchema = z.object({
  title: z.string().min(1).max(160),
  hook: z.string().min(1).max(600),
  sections: z.array(z.object({ heading: z.string().max(160), body: z.string().min(1).max(4000) })).min(1).max(6),
  example: z.object({
    problem: z.string().max(1200),
    steps: z.array(z.string().max(1200)).max(8),
    answer: z.string().max(600),
  }),
  keyPoints: z.array(z.string().max(400)).min(1).max(6),
  checkpoint: QuestionSchema,
});
export type Lesson = z.infer<typeof LessonSchema>;

// ── Worked solutions & grading ─────────────────────────────────────────────

export const StepsSchema = z.object({
  steps: z.array(z.object({ title: z.string().max(200), body: z.string().min(1).max(2000) })).min(1).max(10),
  answer: z.string().max(600),
});
export type Steps = z.infer<typeof StepsSchema>;

export const GradeSchema = z.object({ correct: z.boolean(), feedback: z.string().min(1).max(800) });
export type GradeResult = z.infer<typeof GradeSchema>;

// ── Tutor ──────────────────────────────────────────────────────────────────

export const TUTOR_MODES = ['tutor', 'explain', 'custom'] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

/** ~3 MB of base64 — keeps requests under the server's 4 MB body limit. */
export const MAX_ATTACHMENT_CHARS = 3_000_000;

export const AttachmentSchema = z.object({
  kind: z.enum(['image', 'pdf']),
  name: z.string().max(200),
  dataUrl: z.string().max(MAX_ATTACHMENT_CHARS).regex(/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const TutorInputSchema = z.object({
  messages: z.array(ChatTurnSchema).min(1).max(40),
  mode: z.enum(TUTOR_MODES).default('tutor'),
  custom: z.string().max(500).optional(),
  topicId: z.string().max(60).optional(),
  /** Topics the student is struggling with (from their progress). */
  weakTopicIds: z.array(z.string().max(60)).max(5).optional(),
  attachment: AttachmentSchema.optional(),
});
export type TutorInput = z.input<typeof TutorInputSchema>;
