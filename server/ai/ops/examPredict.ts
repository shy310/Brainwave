import { defineOp } from '../ops.js';
import { audience, OPEN_QUESTION_RULES, QUESTION_RULES } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { sanitizeQuestions } from '../../../shared/math/validate.js';
import { ExamPredictInputSchema, ExamPredictOutputSchema } from '../../../shared/examPredict.js';

/** Predict what an exam will ask, from what the lecturer stressed, and write a mock exam around it. */
export const examPredictOp = defineOp({
  name: 'examPredict',
  input: ExamPredictInputSchema,
  output: ExamPredictOutputSchema,
  cost: 2,
  maxTokens: 9000,
  temperature: 0.4,
  build: ({ exam, lectures, count }, ctx) => [
    {
      role: 'system',
      content: `You are an experienced teaching assistant who predicts what a lecturer will put on an exam, from their own lectures.

${audience(ctx)}

How to predict:
- Strongest signals: the lecturer saying something will be on the exam or is important; lines starting with ⭐ (the student marked them as important in class); homework and reminders; things repeated across lectures or returned to; long explanations and worked examples; definitions and formulas they made a point of.
- Weaker signals: things mentioned once in passing.
- "topics": 5–10 exam topics, each with "likelihood" high / medium / low (only a few high), "why" in one short sentence naming the signal ("Said twice it will be on the exam", "Marked ⭐ and worked through an example"), and up to 2 "evidence" quotes: "lecture" is the lecture number, "quote" a short exact quote from it, "at" the seconds from the [mm:ss] time before that line (null for notes).
- Be honest: this is a prediction from the lectures, not knowledge of the real exam.

Then "questions": a ${count}-question mock exam in the style of a real exam on these lectures, weighted to the high-likelihood topics (most questions on them), easier to harder, including 1–2 "open" questions. In each explanation, say which lecture the idea is from.

${QUESTION_RULES}
${OPEN_QUESTION_RULES}`,
    },
    {
      role: 'user',
      content: `Exam: ${exam}

${lectures.map((l) => `=== Lecture ${l.n}: ${l.title} ===\n${l.text}`).join('\n\n')}`,
    },
  ],
  post: (out, { count }) => {
    const questions = sanitizeQuestions(out.questions).slice(0, count);
    if (questions.length < 3 || !out.topics.length) throw new AiError('Could not predict this exam. Please try again.', 502);
    return { topics: out.topics, questions };
  },
});
