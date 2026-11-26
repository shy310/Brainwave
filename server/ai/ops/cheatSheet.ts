import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { CheatSheetInputSchema, CheatSheetSchema, cleanSheet, type CheatFormat } from '../../../shared/cheatSheet.js';

const SHAPE: Record<CheatFormat, string> = {
  bullets: 'Dense bullets: every block is a list of short "items". Leave "table" null.',
  columns: 'Dense bullets laid out in two narrow columns: keep every item very short (one line). Leave "table" null.',
  tables: 'Tables: wherever ideas compare or pair up (term → meaning → example, cause → effect, formula → when to use), put them in a "table" with 2–4 columns and a short header. Use "items" only for blocks that really are lists.',
};

/** A one-to-two page exam cheat sheet of a lecture. */
export const cheatSheetOp = defineOp({
  name: 'cheatSheet',
  input: CheatSheetInputSchema,
  output: CheatSheetSchema,
  cost: 1,
  maxTokens: 4000,
  temperature: 0.3,
  build: ({ title, text, format }, ctx) => [
    {
      role: 'system',
      content: `You make exam cheat sheets: everything a student needs from a lecture, squeezed onto 1–2 printed pages.

${audience(ctx)}

Rules:
- Telegraphic style: fragments, not sentences. No filler ("This lecture covers…"). Abbreviate where clear.
- Cover every key idea, definition, formula, rule, date and common trap — nothing else.
- 4–10 blocks with short headings, in a logical order. Up to 8 items per block.
- Each item is one complete fact. No numbering ("1."), no sub-lists, no items that are only a label ending in ":".
- **Bold** the word to remember in each item. Write maths in LaTeX ($...$).
- "formulas": the formulas or one-line definitions most worth memorising (may be empty).
- ${SHAPE[format]}
- Use only what the lecture covers.`,
    },
    { role: 'user', content: `${title ? `Lecture: ${title}\n\n` : ''}"""\n${text}\n"""` },
  ],
  post: (sheet, { format }) => {
    const clean = cleanSheet(sheet, format);
    if (!clean.blocks.length) throw new AiError('Could not make a cheat sheet of this lecture. Please try again.', 502);
    return clean;
  },
});
