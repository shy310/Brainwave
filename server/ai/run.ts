import { z } from 'zod';
import type { AiOp, OpContext } from './ops.js';
import { AiError, completeText, type ChatMessage } from './openrouter.js';
import { parseJson } from './jsonRepair.js';

const hasPdf = (messages: ChatMessage[]) =>
  messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'file'));

// Keywords some providers (notably Gemini) reject in response_format schemas.
// Limits are still enforced by zod after the reply arrives.
const DROP = new Set(['$schema', 'maxLength', 'minLength', 'maxItems', 'minItems', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'pattern', 'format', 'default', 'additionalProperties']);

const simplify = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(simplify);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) if (!DROP.has(k)) out[k] = simplify(v);
  return out;
};

/** JSON Schema for the model: plain types, required fields and enums only. */
export const toModelSchema = (schema: z.ZodType): Record<string, unknown> =>
  simplify(z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' })) as Record<string, unknown>;

/** Upstream errors that mean "this request shape is not supported" — worth retrying without a schema. */
const schemaRejected = (err: unknown) =>
  err instanceof AiError && err.upstreamStatus !== undefined && err.upstreamStatus >= 400 && err.upstreamStatus < 500
  && ![401, 402, 403, 429].includes(err.upstreamStatus);

/**
 * Run a structured operation: ask for JSON matching the op's schema, validate
 * with zod, and retry once with the validation errors if the reply is off.
 */
export const runStructured = async <I, O>(op: AiOp<I, O>, input: I, ctx: OpContext): Promise<O> => {
  if (!op.output) throw new Error(`${op.name} has no output schema`);
  const modelSchema = toModelSchema(op.output);
  // The schema also goes in the prompt, so the reply has the right shape even
  // when a provider ignores or rejects response_format.
  const shape = `Reply with ONLY one JSON object (no Markdown fences, no commentary) matching this JSON Schema:\n${JSON.stringify(modelSchema)}`;
  const built = op.build(input, ctx);
  const first = built[0];
  const messages: ChatMessage[] = first?.role === 'system' && typeof first.content === 'string'
    ? [{ role: 'system', content: `${first.content}\n\n${shape}` }, ...built.slice(1)]
    : [{ role: 'system', content: shape }, ...built];
  const schema = { name: op.name.replace(/\W/g, '_'), schema: modelSchema };
  const pdf = hasPdf(messages);

  const ask = async (msgs: ChatMessage[], useSchema: boolean) => {
    try {
      return await completeText({
        messages: msgs, maxTokens: op.maxTokens, temperature: op.temperature,
        jsonSchema: useSchema ? schema : undefined, hasPdf: pdf,
      });
    } catch (err) {
      // Some providers reject strict schemas; fall back to prompt-only JSON.
      if (useSchema && schemaRejected(err)) {
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
  console.error(`AI reply for ${op.name} failed validation:`, lastError);
  throw new AiError('The AI returned something unexpected. Please try again.', 502, 422);
};
