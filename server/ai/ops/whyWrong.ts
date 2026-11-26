import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import type { ChatMessage } from '../openrouter.js';
import { WhyWrongInputSchema } from '../../../shared/whyWrong.js';

/** Explain why the student's quiz answer is wrong, streamed; follow-ups continue the conversation. */
export const whyWrongOp = defineOp({
  name: 'whyWrong',
  input: WhyWrongInputSchema,
  cost: 1,
  maxTokens: 1200,
  temperature: 0.4,
  stream: true,
  build: (input, ctx) => {
    const system = [
      'You are BrainWave, a kind and honest tutor. A student just got a quiz question wrong and asked why.',
      audience(ctx),
      `How to answer:
- Start from what THEY answered: say what is right about their thinking (if anything), then pinpoint the exact mistake or misconception behind their answer.
- Then explain why the correct answer is right, simply.
- If the lecture covers it, ground your explanation in it ("In the lecture, …").
- End with one short tip to avoid this mistake next time.
- Be brief: 3–6 sentences, or a few bullets. Never scold.
- Follow-up questions: answer them directly and briefly.`,
      input.context ? `The lecture the question is about:\n"""\n${input.context}\n"""` : '',
    ].filter(Boolean).join('\n\n');
    const facts = [
      `Question: ${input.question}`,
      input.options?.length ? `Options:\n${input.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}` : '',
      `Correct answer: ${input.correct}`,
      `The student answered: ${input.given}`,
      input.explanation ? `The quiz's own explanation: ${input.explanation}` : '',
      'Why is my answer wrong?',
    ].filter(Boolean).join('\n\n');
    const messages: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: facts }];
    for (const turn of input.followUps.slice(-12)) messages.push({ role: turn.role, content: turn.content });
    return messages;
  },
});
