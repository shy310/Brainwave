import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import { AskLecturesInputSchema, AskLecturesOutputSchema } from '../../../shared/search.js';

/** Answer a question from the student's own lectures, citing the passages it used. */
export const askLecturesOp = defineOp({
  name: 'askLectures',
  input: AskLecturesInputSchema,
  output: AskLecturesOutputSchema,
  cost: 1,
  maxTokens: 1500,
  temperature: 0.3,
  build: ({ question, passages }, ctx) => [
    {
      role: 'system',
      content: `You answer a student's question using ONLY passages from their own lecture transcripts and notes.

${audience(ctx)}
Answer in ${LOCALE_NAME[ctx.locale]}.

Rules:
- Use only what the passages say. Do not add outside facts.
- After each sentence that uses a passage, cite it like [2] (several: [1][3]).
- Keep it short: 2–6 sentences, or a few bullet points if that is clearer.
- "cited": the numbers of the passages you actually used.
- If the passages don't answer the question, set "found" to false and say in one or two sentences that the lectures don't seem to cover it (and what they do mention nearby, if anything). Never invent an answer.`,
    },
    {
      role: 'user',
      content: `Question: ${question}

Passages:
${passages.map((p) => `[${p.n}] (${p.lecture}) ${p.text}`).join('\n\n')}`,
    },
  ],
  post: (out, { passages }) => {
    const valid = new Set(passages.map((p) => p.n));
    return { ...out, cited: [...new Set(out.cited)].filter((n) => valid.has(n)) };
  },
});
