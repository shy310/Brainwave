// Every AI-written question passes through here before a student sees it.
// The checker independently verifies numeric answers; questions that can't be
// trusted are dropped rather than risk marking a right answer wrong.

import type { Question } from '../learn.js';
import { equivalent, formatNumber, looksNumeric, parseAnswer } from './check.js';

const BROKEN = /\bundefined\b|\bNaN\b|\[object |\bTODO\b|<\/?(script|div|span)\b/i;
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();

const sameOption = (a: string, b: string) =>
  norm(a) === norm(b) || (looksNumeric(a) && looksNumeric(b) && equivalent(a, b).equal);

/** Return a cleaned, verified copy of the question, or null if it can't be trusted. */
export const sanitizeQuestion = (raw: Question): Question | null => {
  const q: Question = {
    ...raw,
    prompt: raw.prompt.trim(),
    explanation: raw.explanation.trim(),
    hint: raw.hint.trim(),
    check: raw.check.trim(),
    answer: raw.answer.trim(),
    options: raw.options.map((o) => o.trim()),
    accepted: raw.accepted.map((a) => a.trim()).filter(Boolean),
  };
  if (q.prompt.length < 3 || BROKEN.test(q.prompt) || !q.explanation) return null;

  const verified = q.check ? parseAnswer(q.check) : undefined;
  const checkValue = verified?.ok ? q.check : undefined;

  if (q.kind === 'choice') {
    if (q.options.length < 2 || q.options.some((o) => !o || BROKEN.test(o))) return null;
    for (let i = 0; i < q.options.length; i++) {
      for (let j = i + 1; j < q.options.length; j++) if (sameOption(q.options[i], q.options[j])) return null;
    }
    if (checkValue) {
      const matches = q.options
        .map((o, i) => (looksNumeric(o) && equivalent(checkValue, o).equal ? i : -1))
        .filter((i) => i >= 0);
      if (matches.length > 1) return null;
      if (matches.length === 1) q.correctIndex = matches[0];
      else if (q.options.every((o) => looksNumeric(o))) return null; // no option is actually right
    }
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return null;
    return { ...q, answer: q.options[q.correctIndex], accepted: [] };
  }

  // kind === 'input'
  if (checkValue) {
    const shown = formatNumber(verified!.value!);
    if (!q.answer) q.answer = shown;
    else if (looksNumeric(q.answer) && !equivalent(checkValue, q.answer).equal) {
      q.answer = shown; // trust the computation, not the AI's arithmetic
      q.accepted = q.accepted.filter((a) => !looksNumeric(a) || equivalent(checkValue, a).equal);
    }
  }
  if (!q.answer) return null;
  return { ...q, options: [], correctIndex: -1 };
};

/** Clean a list of questions and drop invalid ones and duplicates. */
export const sanitizeQuestions = (questions: Question[]): Question[] => {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const raw of questions) {
    const q = sanitizeQuestion(raw);
    if (!q) continue;
    const key = norm(q.prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
};
