// ─── QUESTION VALIDATION PIPELINE ─────────────────────────────────────────────
// Every AI-generated question passes through here BEFORE it can be shown to a
// learner. Generation (AI) is separated from validation (deterministic):
// the math engine independently verifies stored answers, and questions that
// fail any check are discarded so a broken question never reaches the screen.

import { Exercise, QuestionType } from '../types';
import { parseAnswer, answersEquivalent, looksNumeric, formatNumber } from './mathEngine';

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
  /** The exercise with deterministic fixes applied (verified answers, clamped difficulty) */
  exercise: Exercise;
}

const BROKEN_PATTERNS = /undefined|NaN|\[object |null,|\.\.\.\s*$|TODO|XXX|<\/?[a-z]+>/i;

const normText = (t: string) =>
  String(t ?? '').toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();

/** Two option texts count as duplicates if equal as text OR as numbers (2 == 2.0 == 4/2). */
const optionsDuplicate = (a: string, b: string): boolean => {
  if (normText(a) === normText(b)) return true;
  if (looksNumeric(a) && looksNumeric(b)) {
    const res = answersEquivalent(a, b);
    return res.equivalent;
  }
  return false;
};

export const validateExercise = (raw: Exercise): ValidationResult => {
  const reasons: string[] = [];
  const ex: Exercise = { ...raw };

  // ── Wording sanity ────────────────────────────────────────────────────────
  const q = String(ex.question ?? '').trim();
  if (q.length < 5) reasons.push('question text too short');
  if (BROKEN_PATTERNS.test(q)) reasons.push('question contains broken formatting');
  if (ex.questionType === QuestionType.FILL_IN_BLANK && !q.includes('___')) {
    reasons.push('fill-in-blank question has no ___ blank');
  }
  if (ex.questionType !== QuestionType.FILL_IN_BLANK && q.includes('___')) {
    reasons.push('non-blank question contains ___ placeholder');
  }
  if (!String(ex.explanation ?? '').trim()) reasons.push('missing explanation');

  // ── Difficulty ────────────────────────────────────────────────────────────
  ex.difficulty = Math.max(1, Math.min(5, Number(ex.difficulty) || 3));
  ex.xpValue = typeof ex.xpValue === 'number' && ex.xpValue > 0 ? ex.xpValue : ex.difficulty * 10;

  const type = ex.questionType || QuestionType.MULTIPLE_CHOICE;

  // ── Option-based types ────────────────────────────────────────────────────
  if (type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.TRUE_FALSE || type === QuestionType.MULTI_SELECT) {
    const options = Array.isArray(ex.options) ? ex.options.filter(o => o && String(o.text ?? '').trim()) : [];

    if (type === QuestionType.TRUE_FALSE && options.length !== 2) {
      reasons.push(`true/false must have exactly 2 options (got ${options.length})`);
    }
    if (options.length < 2) reasons.push(`needs at least 2 options (got ${options.length})`);

    // Unique option ids and texts (text- and math-equivalence aware)
    const ids = new Set<string>();
    for (const o of options) {
      if (ids.has(o.id)) reasons.push(`duplicate option id "${o.id}"`);
      ids.add(o.id);
    }
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        if (optionsDuplicate(options[i].text, options[j].text)) {
          reasons.push(`options "${options[i].text}" and "${options[j].text}" are duplicates/equivalent`);
        }
      }
    }
    if (options.some(o => BROKEN_PATTERNS.test(o.text))) reasons.push('an option contains broken formatting');

    if (type === QuestionType.MULTI_SELECT) {
      const correctIds = Array.isArray(ex.correctOptionIds) ? ex.correctOptionIds : [];
      if (correctIds.length < 1) reasons.push('multi-select has no correct options');
      if (correctIds.length >= options.length && options.length > 0) reasons.push('multi-select marks every option correct');
      for (const id of correctIds) {
        if (!options.some(o => o.id === id)) reasons.push(`correctOptionIds contains unknown id "${id}"`);
      }
    } else {
      // Exactly one correct option
      if (!ex.correctOptionId || !options.some(o => o.id === ex.correctOptionId)) {
        reasons.push('correctOptionId does not match any option');
      }
      // No accidental second correct answer: if the correct option is numeric,
      // no distractor may be mathematically equivalent to it (covered by the
      // duplicate check above) — and if an answerExpression is provided, the
      // marked option must actually equal it.
      if (ex.answerExpression && ex.correctOptionId) {
        const marked = options.find(o => o.id === ex.correctOptionId);
        if (marked && looksNumeric(marked.text)) {
          const verify = answersEquivalent(ex.answerExpression, marked.text);
          if (!verify.equivalent) {
            reasons.push(`marked option "${marked.text}" does not equal verified answer "${ex.answerExpression}"`);
          }
        }
        // A distractor equivalent to the verified answer = accidental 2nd correct
        for (const o of options) {
          if (o.id !== ex.correctOptionId && looksNumeric(o.text) && answersEquivalent(ex.answerExpression, o.text).equivalent) {
            reasons.push(`distractor "${o.text}" equals the correct answer`);
          }
        }
      }
    }
    ex.options = options;
  }

  // ── Open-answer types ─────────────────────────────────────────────────────
  if (type === QuestionType.SHORT_ANSWER || type === QuestionType.FILL_IN_BLANK ||
      type === QuestionType.NUMERIC || type === QuestionType.MULTI_STEP) {
    const sample = String(ex.sampleAnswer ?? '').trim();
    const expr = String(ex.answerExpression ?? '').trim();
    if (!sample && !expr) reasons.push('open-answer question has no stored answer');

    if (expr) {
      // The math engine independently computes the canonical answer. If it
      // cannot parse the expression, the question is not machine-verifiable
      // as claimed — discard rather than risk wrong grading.
      const parsed = parseAnswer(expr);
      if (!parsed.ok) {
        reasons.push(`answerExpression invalid: ${parsed.error}`);
      } else if (type === QuestionType.NUMERIC) {
        // Keep sampleAnswer in sync with the VERIFIED computation so the
        // displayed solution is always the engine's answer, not the AI's.
        const displayed = parsed.unit
          ? `${formatNumber(parsed.value!)} ${parsed.unit}`
          : formatNumber(parsed.value!);
        if (sample && looksNumeric(sample)) {
          const agree = answersEquivalent(expr, sample, { tolerance: ex.tolerance, roundTo: ex.roundTo });
          if (!agree.equivalent) {
            reasons.push(`stored sampleAnswer "${sample}" disagreed with verified answer — replaced`);
            ex.sampleAnswer = displayed;
            // This is a FIX, not a fatal error: remove the reason from fatal set below
          }
        } else if (!sample) {
          ex.sampleAnswer = displayed;
        }
      }
    } else if (type === QuestionType.NUMERIC) {
      // NUMERIC without an expression must at least have a parseable sample
      if (!looksNumeric(sample) || !parseAnswer(sample).ok) {
        reasons.push('numeric question has no machine-checkable answer');
      }
    }

    if (type === QuestionType.MULTI_STEP && (!Array.isArray(ex.steps) || ex.steps.length < 2)) {
      reasons.push('multi-step question needs at least 2 steps');
    }
  }

  // "replaced" reasons are repairs, not failures
  const fatal = reasons.filter(r => !r.endsWith('— replaced'));
  return { ok: fatal.length === 0, reasons, exercise: ex };
};

/**
 * Validate a whole generated quiz: drop invalid questions, drop near-duplicate
 * questions, and return only what is safe to show a learner.
 */
export const sanitizeQuiz = (
  questions: Exercise[]
): { valid: Exercise[]; discarded: { question: string; reasons: string[] }[] } => {
  const valid: Exercise[] = [];
  const discarded: { question: string; reasons: string[] }[] = [];
  const seen = new Set<string>();

  for (const raw of questions) {
    const { ok, reasons, exercise } = validateExercise(raw);
    if (!ok) {
      discarded.push({ question: String(raw?.question ?? '').slice(0, 80), reasons });
      continue;
    }
    const key = normText(exercise.question);
    if (seen.has(key)) {
      discarded.push({ question: exercise.question.slice(0, 80), reasons: ['duplicate of another question'] });
      continue;
    }
    seen.add(key);
    valid.push(exercise);
  }
  return { valid, discarded };
};
