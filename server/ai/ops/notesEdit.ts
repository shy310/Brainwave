import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { DEPTH_POINTS, NotesEditInputSchema, NotesEditOutputSchema, type NotesEditInput } from '../../../shared/notesEdit.js';

const TASK: Record<NotesEditInput['action'], string> = {
  expand: 'Expand on the selected part: explain it more fully — what it means, why it is true or matters, and how it connects to the rest.',
  simplify: 'Say the selected part more simply, in plain words a struggling student would understand at once. Keep it correct.',
  example: 'Give a concrete example of the selected part: a worked example, a real-world case or a short calculation that makes it click.',
  custom: 'Do what the student asks with the selected part.',
};

const DEPTH: Record<NotesEditInput['depth'], string> = {
  brief: 'Brief: one short point, one or two sentences.',
  detailed: 'Detailed: up to 3 points, each a few sentences at most.',
  deep: 'Deep dive: up to 6 points that go well beyond the notes — reasons, details, examples, edge cases.',
};

/** Expand, simplify or add an example to part of a lecture's notes, written to slot straight into them. */
export const notesEditOp = defineOp({
  name: 'notesEdit',
  input: NotesEditInputSchema,
  output: NotesEditOutputSchema,
  cost: 1,
  maxTokens: 2000,
  temperature: 0.4,
  build: (input, ctx) => {
    const replace = input.place === 'replace';
    return [
      {
        role: 'system',
        content: `You edit a student's lecture notes. They selected part of the notes and asked for a change; your text goes straight into the notes.

${audience(ctx)}
Exception to the language rule: write in the same language as the notes themselves, matching their style.

Task: ${TASK[input.action]}
${replace
    ? `Your text REPLACES the selected words inside the point, so it must read naturally in their place in the sentence: write only the words that go where the selection was, never repeating the words just before or after it. Return it as the only item of "points". ${input.depth === 'brief' ? 'Keep it short: at most a few words longer than the selection.' : input.depth === 'detailed' ? 'It may be a few sentences.' : 'It may be a full paragraph.'}`
    : `Your points are ADDED to the notes as new bullet points. ${DEPTH[input.depth]} Each point stands on its own (no "As mentioned above"), no leading "-" or numbering.`}
- Don't repeat what the notes already say. Keep the notes' formatting style (**bold** for key words, $...$ for maths).
- Be accurate; if the notes are wrong about something, gently correct it.
- "points": at most ${replace ? 1 : DEPTH_POINTS[input.depth]} item(s).`,
      },
      {
        role: 'user',
        content: [
          input.title ? `Lecture: ${input.title}` : '',
          input.notes ? `The notes so far:\n"""\n${input.notes}\n"""` : '',
          input.heading ? `Section: ${input.heading}` : '',
          `The point it is in:\n"""\n${input.block}\n"""`,
          `Selected: "${input.quote}"`,
          input.instruction ? `What the student asks: ${input.instruction}` : '',
        ].filter(Boolean).join('\n\n'),
      },
    ];
  },
  post: (out, input) => ({ points: out.points.slice(0, input.place === 'replace' ? 1 : DEPTH_POINTS[input.depth]) }),
});
