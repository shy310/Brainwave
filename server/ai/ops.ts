import type { ZodType } from 'zod';
import type { ChatMessage } from './openrouter.js';
import type { Grade } from '../../shared/grades.js';
import type { Locale } from '../../shared/locales.js';

/** Who is asking, used to tailor prompts. */
export interface OpContext {
  userId: string;
  demo: boolean;
  locale: Locale;
  grade: Grade;
}

/**
 * A named AI operation. Prompts live on the server; the browser only sends the
 * operation name and validated parameters — never raw prompts.
 */
export interface AiOp<I = unknown, O = unknown> {
  name: string;
  input: ZodType<I>;
  /** When set, the reply must be JSON matching this schema. */
  output?: ZodType<O>;
  /** Quota units this call costs. */
  cost: number;
  maxTokens: number;
  temperature?: number;
  /** Stream plain text back as Server-Sent Events (tutor chat). */
  stream?: boolean;
  build: (input: I, ctx: OpContext) => ChatMessage[];
  /** Optional deterministic post-processing (e.g. drop invalid quiz items). */
  post?: (output: O, input: I) => O;
}

const registry = new Map<string, AiOp<any, any>>();

export const defineOp = <I, O>(op: AiOp<I, O>): AiOp<I, O> => {
  registry.set(op.name, op as AiOp<any, any>);
  return op;
};

export const getOp = (name: string) => registry.get(name);
export const listOps = () => [...registry.keys()];
