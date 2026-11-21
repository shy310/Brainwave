import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { ConceptMapInputSchema, ConceptMapSchema, cleanMap } from '../../../shared/conceptMap.js';

/** A concept map of a lecture: its main idea, the key concepts, and how they connect. */
export const conceptMapOp = defineOp({
  name: 'conceptMap',
  input: ConceptMapInputSchema,
  output: ConceptMapSchema,
  cost: 1,
  maxTokens: 3000,
  temperature: 0.4,
  build: ({ title, text }, ctx) => [
    {
      role: 'system',
      content: `You draw concept maps that help students see how the ideas of a lecture fit together.

${audience(ctx)}

Rules:
- Exactly one node with kind "main": the lecture's central topic.
- 6–16 "concept" nodes for the key ideas, and up to 6 "detail" nodes for important examples, formulas or facts.
- Labels: 1–5 words (a formula may be written in $...$). Ids: short lowercase words, unique.
- "note": one short sentence explaining the idea, from the lecture.
- Edges connect related nodes; "label" says how in 1–4 words ("is a", "causes", "measured by", "example of"), read from "from" to "to".
- Every node must connect to the map. Prefer a clear tree from the main idea, plus a few cross-links where ideas really relate.
- Use only what the lecture covers.`,
    },
    { role: 'user', content: `${title ? `Lecture: ${title}\n\n` : ''}"""\n${text}\n"""` },
  ],
  post: (map) => {
    const clean = cleanMap(map);
    if (clean.nodes.length < 3) throw new AiError('Could not draw a map of this lecture. Please try again.', 502);
    return clean;
  },
});
