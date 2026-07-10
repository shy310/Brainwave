// ─── DETERMINISTIC MATH ENGINE ────────────────────────────────────────────────
// Exact mathematical evaluation for question validation and answer checking.
// Built on mathjs (expression-tree parser — no eval / no code execution).
// The AI generates wording, hints and explanations; THIS module decides what is
// mathematically correct.

import { create, all, MathNode } from 'mathjs';

const math = create(all, {
  number: 'number',
  precision: 64,
});

// Only pure arithmetic is allowed to evaluate. Anything else (assignments,
// ranges, matrices, arbitrary functions/symbols) is rejected up front.
const ALLOWED_FUNCTIONS = new Set([
  'sqrt', 'cbrt', 'nthRoot', 'abs', 'round', 'floor', 'ceil',
  'log', 'log10', 'log2', 'exp', 'sin', 'cos', 'tan', 'pow',
]);
const ALLOWED_SYMBOLS = new Set(['pi', 'e']);

export interface ParseResult {
  ok: boolean;
  value?: number;
  /** Present when the input carried a recognized unit (e.g. "5 cm") */
  unit?: string;
  /** mathjs Unit object for dimension-aware comparison */
  unitValue?: any;
  error?: string;
}

export interface EquivalenceResult {
  equivalent: boolean;
  /** true/false when a unit comparison happened; undefined for pure numbers */
  unitMatch?: boolean;
  valueMatch?: boolean;
  reason?: string;
}

export interface CompareOptions {
  /** Absolute tolerance for decimal comparison (default: relative 1e-9) */
  tolerance?: number;
  /** Question explicitly asks to round to N decimals */
  roundTo?: number;
  /** The answer must include a unit to count as correct */
  unitRequired?: boolean;
}

/** Verify an expression tree contains only whitelisted arithmetic nodes. */
const assertSafe = (node: MathNode): void => {
  node.traverse((n: any) => {
    switch (n.type) {
      case 'ConstantNode':
      case 'OperatorNode':
      case 'ParenthesisNode':
        return;
      case 'FunctionNode':
        if (!ALLOWED_FUNCTIONS.has(n.fn?.name)) throw new Error(`Function "${n.fn?.name}" is not allowed`);
        return;
      case 'SymbolNode':
        // Symbols are allowed only as constants (pi/e) or as function names
        // that the FunctionNode case has already vetted.
        if (!ALLOWED_SYMBOLS.has(n.name) && !ALLOWED_FUNCTIONS.has(n.name)) {
          throw new Error(`Unknown symbol "${n.name}"`);
        }
        return;
      default:
        throw new Error(`Expression element "${n.type}" is not allowed`);
    }
  });
};

/**
 * Normalize the many ways students (and the AI) write math:
 * LaTeX wrappers, percentages, ratios, mixed numbers, comma decimals,
 * thousands separators, unicode operators, "x =" prefixes.
 */
export const normalizeMathInput = (raw: string): string => {
  let s = String(raw ?? '').trim();

  // Strip LaTeX inline/display wrappers and simple LaTeX commands
  s = s.replace(/^\$\$?|\$\$?$/g, '').trim();
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\cdot|\\times/g, '*');
  s = s.replace(/\\div/g, '/');
  s = s.replace(/\\pi/g, 'pi');

  // Unicode math → ASCII
  s = s.replace(/[×✕✖]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-')
       .replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/³/g, '^3');

  // "x = 5" / "y=1/2" → take the right-hand side
  const eqMatch = s.match(/^[a-zA-Z]\s*=\s*(.+)$/);
  if (eqMatch) s = eqMatch[1].trim();

  // Ratio "3:4" → fraction
  const ratio = s.match(/^(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)$/);
  if (ratio) s = `(${ratio[1]})/(${ratio[2]})`;

  // Mixed number "1 1/2" → (1 + 1/2), "-2 3/4" → -(2 + 3/4)
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) s = `${mixed[1]}(${mixed[2]} + ${mixed[3]}/${mixed[4]})`;

  // Thousands separators "1,234.5" (only when clearly thousands-grouping)
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  // European decimal comma "0,5" (single comma, no dot)
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');

  return s.trim();
};

/** Does this string look like something the engine should be able to judge? */
export const looksNumeric = (raw: string): boolean => {
  const s = normalizeMathInput(raw).replace(/%$/, '').trim();
  if (!s) return false;
  // Pure arithmetic characters (plus whitelisted function names / constants)
  const stripped = s.replace(/\b(sqrt|cbrt|abs|round|floor|ceil|log10|log2|log|exp|sin|cos|tan|pow|nthRoot|pi|e)\b/g, '');
  return /^[\d\s+\-*/^().,]*$/.test(stripped) && /\d/.test(s);
};

/**
 * Parse a numeric answer (possibly an expression, percentage, fraction,
 * ratio…) into an exact number. Never throws — returns { ok:false, error }.
 */
export const parseAnswer = (raw: string): ParseResult => {
  const original = String(raw ?? '').trim();
  if (!original) return { ok: false, error: 'Empty answer' };

  let s = normalizeMathInput(original);

  // Percentage: "50%" → 0.5  (also "12.5 %")
  let isPercent = false;
  if (/%\s*$/.test(s)) { isPercent = true; s = s.replace(/%\s*$/, '').trim(); }

  // Unit-carrying answer, e.g. "5 cm", "3.2 kg", "10 m/s" — try mathjs units
  // (but not for percent, and only when there are letters present).
  if (!isPercent && /[a-zA-Z]/.test(s) && /^-?[\d.,]+\s*[a-zA-Z/^0-9]+$/.test(s)) {
    try {
      const u = math.unit(s);
      const value = u.toNumber(u.formatUnits());
      return { ok: true, value, unit: u.formatUnits(), unitValue: u };
    } catch { /* fall through to expression parsing */ }
  }

  try {
    const node = math.parse(s);
    assertSafe(node);
    const value = node.compile().evaluate();
    if (typeof value !== 'number' || !isFinite(value)) {
      return { ok: false, error: 'Expression did not produce a finite number' };
    }
    return { ok: true, value: isPercent ? value / 100 : value };
  } catch (e: any) {
    return { ok: false, error: `Cannot parse "${original}": ${e?.message ?? 'invalid expression'}` };
  }
};

/** Safely evaluate a pure arithmetic expression (for verifying stored answers). */
export const evaluateExpression = (expr: string): ParseResult => parseAnswer(expr);

const numbersEqual = (a: number, b: number, opts: CompareOptions = {}): boolean => {
  if (opts.roundTo !== undefined && opts.roundTo !== null) {
    const f = Math.pow(10, opts.roundTo);
    return Math.round(a * f) / f === Math.round(b * f) / f;
  }
  if (opts.tolerance !== undefined && opts.tolerance !== null) {
    return Math.abs(a - b) <= opts.tolerance;
  }
  // Default: tight relative tolerance to absorb float noise (0.1+0.2 vs 0.3)
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-9 * scale;
};

/**
 * The heart of answer checking: is the student's answer mathematically
 * equivalent to the expected one? Handles 0.5 == 1/2 == 50%, "5 cm" == "0.05 m",
 * fractions, expressions, tolerance and explicit rounding.
 */
export const answersEquivalent = (
  expected: string,
  given: string,
  opts: CompareOptions = {}
): EquivalenceResult => {
  const exp = parseAnswer(expected);
  const giv = parseAnswer(given);

  if (!exp.ok) return { equivalent: false, reason: `Expected answer unparseable: ${exp.error}` };
  if (!giv.ok) return { equivalent: false, reason: giv.error };

  // Unit-aware comparison when the expected answer carries a unit
  if (exp.unitValue) {
    if (!giv.unitValue) {
      if (opts.unitRequired) {
        return { equivalent: false, valueMatch: numbersEqual(exp.value!, giv.value!, opts), unitMatch: false, reason: 'Missing unit' };
      }
      // Unit optional: compare raw numbers in the expected unit
      const valueMatch = numbersEqual(exp.value!, giv.value!, opts);
      return { equivalent: valueMatch, valueMatch, unitMatch: undefined };
    }
    try {
      if (!exp.unitValue.equalBase(giv.unitValue)) {
        return { equivalent: false, unitMatch: false, valueMatch: false, reason: 'Different unit dimensions' };
      }
      const givenInExpected = giv.unitValue.toNumber(exp.unitValue.formatUnits());
      const valueMatch = numbersEqual(exp.value!, givenInExpected, opts);
      return { equivalent: valueMatch, unitMatch: true, valueMatch };
    } catch (e: any) {
      return { equivalent: false, reason: `Unit comparison failed: ${e?.message}` };
    }
  }

  // Given has a unit but expected doesn't — treat the number as the answer
  const equivalent = numbersEqual(exp.value!, giv.value!, opts);
  return { equivalent, valueMatch: equivalent };
};

/**
 * Check a student's answer against the expected answer plus any explicitly
 * acceptable alternates. Non-numeric answers fall back to a normalized
 * string comparison so the engine stays useful for word answers too.
 */
export const checkAnswer = (
  studentAnswer: string,
  expectedAnswer: string,
  acceptable: string[] = [],
  opts: CompareOptions = {}
): { correct: boolean; method: 'math' | 'text'; reason?: string } => {
  const candidates = [expectedAnswer, ...acceptable].filter(Boolean);

  // Deterministic math comparison whenever both sides are parseable
  for (const cand of candidates) {
    if (looksNumeric(cand) || /[a-zA-Z]/.test(cand) === false) {
      const res = answersEquivalent(cand, studentAnswer, opts);
      if (res.equivalent) return { correct: true, method: 'math' };
    } else if (parseAnswer(cand).unitValue) {
      const res = answersEquivalent(cand, studentAnswer, opts);
      if (res.equivalent) return { correct: true, method: 'math' };
    }
  }
  // If expected is numeric and the student's input parses, a non-match is a
  // definitive engine verdict (not a "maybe" for the AI to overrule).
  const expParsed = parseAnswer(expectedAnswer);
  const givParsed = parseAnswer(studentAnswer);
  if (expParsed.ok && givParsed.ok) {
    return { correct: false, method: 'math', reason: answersEquivalent(expectedAnswer, studentAnswer, opts).reason };
  }

  // Text fallback: case/whitespace/punctuation-insensitive comparison
  const norm = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const correct = candidates.some(c => norm(c) === norm(studentAnswer) && norm(c).length > 0);
  return { correct, method: 'text' };
};

/** Format a number for display (trim float noise, keep fractions readable). */
export const formatNumber = (n: number, maxDecimals = 6): string => {
  const rounded = Number(n.toFixed(maxDecimals));
  return String(rounded);
};
