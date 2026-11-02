import { z } from 'zod';
import type { AiOp, OpContext } from './ops.js';
import { AiError, completeText, type ChatMessage } from './openrouter.js';
import { parseJson } from './jsonRepair.js';

const hasPdf = (messages: ChatMessage[]) =>
  messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'file'));

/** JSON Schema for the model, stripped of keywords providers commonly reject. */
const toModelSchema = (schema: z.ZodType): Record<string, unknown> => {
  const js = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
};

/**
 * Run a structured operation: ask for JSON matching the op's schema, validate
 * with zod, and retry once with the validation errors if the reply is off.
 */
export const runStructured = async <I, O>(op: AiOp<I, O>, input: I, ctx: OpContext): Promise<O> => {
  if (!op.output) throw new Error(`${op.name} has no output schema`);
  const messages = op.build(input, ctx);
  const schema = { name: op.name.replace(/\W/g, '_'), schema: toModelSchema(op.output) };
  const pdf = hasPdf(messages);

  const ask = async (msgs: ChatMessage[], useSchema: boolean) => {
    try {
      return await completeText({
        messages: msgs, maxTokens: op.maxTokens, temperature: op.temperature,
        jsonSchema: useSchema ? schema : undefined, hasPdf: pdf,
      });
    } catch (err) {
      // Some providers reject strict schemas; fall back to prompt-only JSON.
      if (useSchema && err instanceof AiError && err.upstreamStatus === 400) {
        return completeText({ messages: msgs, maxTokens: op.maxTokens, temperature: op.temperature, hasPdf: pdf });
      }
      throw err;
    }
  };

  let lastError = '';
  let msgs = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask(msgs, true);
    let parsed: unknown;
    try { parsed = parseJson(text); } catch (e) { lastError = (e as Error).message; parsed = undefined; }
    if (parsed !== undefined) {
      const result = op.output.safeParse(parsed);
      if (result.success) return op.post ? op.post(result.data, input) : result.data;
      lastError = result.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    }
    msgs = [
      ...messages,
      { role: 'assistant', content: text.slice(0, 4000) },
      { role: 'user', content: `That reply was not valid (${lastError}). Reply again with ONLY valid JSON matching the schema.` },
    ];
  }
  throw new AiError('The AI returned something unexpected. Please try again.', 502);
};
