import { z } from 'zod';
import { defineOp, type OpContext } from '../ops.js';
import { audience, QUESTION_RULES } from '../prompts.js';
import { findTopic } from '../../../shared/curriculum.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import {
  DIFFICULTIES, GradeSchema, LessonSchema, QuestionSchema, QuizSchema, StepsSchema, type Question,
} from '../../../shared/learn.js';
import { sanitizeQuestion, sanitizeQuestions } from '../../../shared/math/validate.js';
import { AiError } from '../openrouter.js';

const topicId = z.string().min(1).max(60).refine((id) => Boolean(findTopic(id)), 'Unknown topic');

/** Describe a curriculum topic for a prompt, in English (the model answers in the student's language). */
const describeTopic = (id: string) => {
  const ref = findTopic(id)!;
  return `Subject: ${ref.course.subject}. Unit: ${ref.unit.title.en}. Topic: ${ref.topic.title.en} — ${ref.topic.description.en}`;
};

const system = (ctx: OpContext, role: string) => ({ role: 'system' as const, content: `${role}\n\n${audience(ctx)}` });

export const lessonOp = defineOp({
  name: 'lesson',
  input: z.object({ topicId }),
  output: LessonSchema,
  cost: 2,
  maxTokens: 6000,
  temperature: 0.6,
  build: ({ topicId }, ctx) => [
    system(ctx, 'You are BrainWave, an expert teacher who writes short, vivid, interactive lessons.'),
    {
      role: 'user',
      content: `${describeTopic(topicId)}

Write a lesson that takes about 5 minutes to read.
- "title": the topic title.
- "hook": 1–2 sentences that make the student curious (a question, surprising fact or everyday situation).
- "sections": 2–4 short sections, each with a "heading" and a "body" of 1–3 short paragraphs or a list. Build from intuition to the precise idea. Bold the key terms.
- "example": one fully worked example — "problem", 2–5 "steps" (each a short sentence or line of math), and the final "answer". For non-math subjects use a short scenario or source and reason through it.
- "keyPoints": 3–5 one-line takeaways.
- "checkpoint": one quick question to check understanding.

${QUESTION_RULES}`,
    },
  ],
  post: (lesson) => {
    const checkpoint = sanitizeQuestion(lesson.checkpoint);
    if (!checkpoint) throw new AiError('The lesson came back incomplete. Please try again.', 502);
    return { ...lesson, checkpoint };
  },
});

export const quizOp = defineOp({
  name: 'quiz',
  input: z.object({
    topicId,
    count: z.number().int().min(3).max(10).default(5),
    difficulty: z.enum(DIFFICULTIES).default('normal'),
  }),
  output: QuizSchema,
  cost: 2,
  maxTokens: 7000,
  temperature: 0.7,
  build: ({ topicId, count, difficulty }, ctx) => [
    system(ctx, 'You are BrainWave, an expert teacher who writes fair, accurate quiz questions.'),
    {
      role: 'user',
      content: `${describeTopic(topicId)}

Write ${count + 2} quiz questions on this topic (a few extra so any flawed ones can be dropped).
Difficulty: ${difficulty === 'easier' ? 'gentle — build confidence with the basics' : difficulty === 'harder' ? 'challenging — multi-step and applied' : 'on level for the grade'}.
Mix kinds: about half "choice" and half "input". Order from easier to harder.

${QUESTION_RULES}`,
    },
  ],
  post: (quiz, { count }) => {
    const questions = sanitizeQuestions(quiz.questions).slice(0, count);
    if (questions.length < Math.min(3, count)) throw new AiError('Could not build a good quiz this time. Please try again.', 502);
    return { questions };
  },
});

export const practiceOp = defineOp({
  name: 'practice',
  input: z.object({
    question: QuestionSchema,
    mode: z.enum(['similar', 'easier', 'harder']),
    topicId: topicId.optional(),
  }),
  output: z.object({ question: QuestionSchema }),
  cost: 1,
  maxTokens: 2500,
  temperature: 0.8,
  build: ({ question, mode, topicId }, ctx) => [
    system(ctx, 'You are BrainWave, an expert teacher who writes practice questions.'),
    {
      role: 'user',
      content: `${topicId ? describeTopic(topicId) + '\n\n' : ''}The student just worked on this question:
${JSON.stringify({ kind: question.kind, prompt: question.prompt, options: question.options, answer: question.answer })}

Write ONE new question of the same kind that practises the same skill${
        mode === 'easier' ? ', but one step easier (smaller numbers, fewer steps, more scaffolding)'
          : mode === 'harder' ? ', but one step harder' : ' at the same difficulty'
      }. Change the numbers and context; do not reuse the original wording.
Return {"question": {...}}.

${QUESTION_RULES}`,
    },
  ],
  post: (out) => {
    const question = sanitizeQuestion(out.question);
    if (!question) throw new AiError('Could not make a practice question. Please try again.', 502);
    return { question };
  },
});

export const stepsOp = defineOp({
  name: 'steps',
  input: z.object({
    problem: z.string().min(1).max(2000),
    answer: z.string().max(300).optional(),
    topicId: topicId.optional(),
  }),
  output: StepsSchema,
  cost: 1,
  maxTokens: 4000,
  temperature: 0.3,
  build: ({ problem, answer, topicId }, ctx) => [
    system(ctx, 'You are BrainWave, a patient teacher who explains solutions one clear step at a time.'),
    {
      role: 'user',
      content: `${topicId ? describeTopic(topicId) + '\n\n' : ''}Solve this step by step:
"""${problem}"""
${answer ? `The verified correct answer is: ${answer}. Your solution must reach exactly this answer.` : ''}

Return 2–8 "steps". Each has a short "title" naming the rule or idea used (e.g. "Isolate x") and a "body" showing the work for that step only. Then the final "answer".`,
    },
  ],
});

export const gradeOp = defineOp({
  name: 'grade',
  input: z.object({
    prompt: z.string().min(1).max(1200),
    expected: z.string().max(300),
    accepted: z.array(z.string().max(300)).max(6).default([]),
    given: z.string().min(1).max(600),
  }),
  output: GradeSchema,
  cost: 1,
  maxTokens: 800,
  temperature: 0,
  build: ({ prompt, expected, accepted, given }, ctx) => [
    {
      role: 'system',
      content: `You grade short answers fairly. Accept answers that mean the same as the expected answer, including synonyms, small spelling mistakes, translations between English and Hebrew, and equivalent forms. Reject answers that are vague, partly wrong or answer a different question.
Write "feedback" in ${LOCALE_NAME[ctx.locale]}: one or two encouraging sentences saying what was right or what is missing. Do not reveal the expected answer when the student is wrong.`,
    },
    {
      role: 'user',
      content: `Question: ${prompt}\nExpected answer: ${expected}${accepted.length ? `\nAlso acceptable: ${accepted.join(' | ')}` : ''}\nStudent's answer: ${given}`,
    },
  ],
});

export type { Question };
