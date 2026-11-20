import { gradeBand, type Grade } from '../../shared/grades.js';
import { LOCALE_NAME } from '../../shared/locales.js';
import type { OpContext } from './ops.js';

const GRADE_LABEL = (g: Grade) => (g === 'k' ? 'kindergarten' : g === 'college' ? 'college' : `grade ${g}`);

const TONE: Record<ReturnType<typeof gradeBand>, string> = {
  early: 'Use very short sentences, everyday words and friendly concrete examples (toys, snacks, animals). No jargon.',
  elementary: 'Use simple, warm language and concrete examples. Introduce new terms one at a time and explain them.',
  middle: 'Be clear and encouraging. Use correct terms but explain them; relate ideas to real life.',
  high: 'Be precise and direct, at a high-school level. Use proper terminology and notation.',
  college: 'Be rigorous and concise, at an introductory university level. Use standard notation and terminology.',
};

/** Shared rules for every learning prompt: audience, language and formatting. */
export const audience = (ctx: OpContext): string => [
  `The student is in ${GRADE_LABEL(ctx.grade)}. ${TONE[gradeBand(ctx.grade)]}`,
  `Write ALL student-facing text in ${LOCALE_NAME[ctx.locale]}.` +
    (ctx.locale === 'he' ? ' Use natural modern Hebrew without niqqud. Keep math, code and formulas in standard Latin notation.' : ''),
  'Formatting: Markdown is allowed (bold, lists, `code`, fenced code blocks). Write math in LaTeX: $...$ inline, $$...$$ on its own line.',
  'Be accurate. If something is uncertain or debated, say so briefly instead of inventing facts.',
].join('\n');

/** Shared rules for generated questions. */
export const QUESTION_RULES = `Question rules:
- kind "choice": 3–4 short, distinct, plausible options in "options"; "correctIndex" is the 0-based index of the ONLY correct one. Set "answer" to the correct option text, "accepted" to [].
- kind "input": the student types a short answer (a number, expression, word or short phrase). Put the canonical answer in "answer" and other acceptable forms in "accepted" (e.g. ["1/2", "0.5"]). Set "options" to [] and "correctIndex" to -1.
- "check": if the correct answer is a number, a plain arithmetic expression that computes it (e.g. "(3/4)*12" or "sqrt(2)/2"), using only numbers, + - * / ^ ( ), sqrt, abs, pi, e. Otherwise "".
- "hint": one short nudge that does not give the answer away.
- "moreHints": up to 2 further hints, each giving a little more away than the one before, still without stating the answer. [] if one hint is enough.
- "explanation": why the answer is right, in 1–4 sentences, showing the key step.
- Never write "all of the above" or "none of the above". Never make two options equivalent.
- Vary the style: recall, understanding, applying to a new situation, spotting a mistake.`;

/** Extra rules for written-answer questions (used where the AI grades the answer). */
export const OPEN_QUESTION_RULES = `- kind "open": the student writes 1–4 sentences (explain why, compare, give an example). Put a short model answer with the key points in "answer". Set "options" to [], "correctIndex" to -1, "accepted" to [] and "check" to "".`;
