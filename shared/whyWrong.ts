// "Why is my answer wrong?" after a wrong quiz answer: the AI looks at what
// the student actually answered and explains the mistake, from the lecture
// when there is one. Follow-up questions continue the same conversation.
import { z } from 'zod';
import { ChatTurnSchema } from './learn.js';

export const WhyWrongInputSchema = z.object({
  question: z.string().min(1).max(4000),
  /** For multiple choice: every option, so the AI can compare. */
  options: z.array(z.string().max(1000)).max(8).optional(),
  correct: z.string().min(1).max(4000),
  given: z.string().min(1).max(4000),
  explanation: z.string().max(4000).optional(),
  /** The lecture (or course text) the question came from. */
  context: z.string().max(20_000).optional(),
  /** Earlier turns of this conversation, then the student's follow-up last. */
  followUps: z.array(ChatTurnSchema).max(12).default([]),
});
export type WhyWrongInput = z.input<typeof WhyWrongInputSchema>;
