// Deterministic answer checking. The AI writes questions and explanations;
// this module decides what is mathematically correct. Built on mathjs's
// expression parser — nothing is ever eval'd, and only plain arithmetic is allowed.

import { all, create, type MathNode, type Unit } from 'mathjs';

const math = create(all, { number: 'number', precision: 64 });

const ALLOWED_FUNCTIONS = new Set([
  'sqrt', 'cbrt', 'nthRoot', 'abs', 'round', 'floor', 'ceil',
  'log', 'log10', 'log2', 'exp', 'sin', 'cos', 'tan', 'pow',
]);
const ALLOWED_SYMBOLS = new Set(['pi', 'e']);

export interface Parsed {
  ok: boolean;
  value?: number;
  unit?: string;
  unitValue?: Unit;
  error?: string;
}

export interface CompareOptions {
  /** Absolute tolerance (default: tight relative tolerance). */
  tolerance?: number;
  /** Compare after rounding both sides to this many decimals. */
  roundTo?: number;
  /** The answer must include a unit. */
  unitRequired?: boolean;
}

const assertSafe = (node: MathNode): void => {
  node.traverse((n) => {
    switch (n.type) {
      case 'ConstantNode':
      case 'OperatorNode':
      case 'ParenthesisNode':
        return;
      case 'FunctionNode': {
        const name = (n as unknown as { fn?: { name?: string } }).fn?.name ?? '';
        if (!ALLOWED_FUNCTIONS.has(name)) throw new Error(`Function "${name}" is not allowed`);
        return;
      }
      case 'SymbolNode': {
        const name = (n as unknown as { name: string }).name;
        if (!ALLOWED_SYMBOLS.has(name) && !ALLOWED_FUNCTIONS.has(name)) throw new Error(`Unknown symbol "${name}"`);
        return;
      }
      default:
        throw new Error(`"${n.type}" is not allowed`);
    }
  });
};

/** Normalize the many ways people write math: LaTeX, unicode, "x =", ratios, mixed numbers, commas. */
export const normalizeMath = (raw: string): string => {
  let s = String(raw ?? '').trim();
  s = s.replace(/^\$\$?|\$\$?$/g, '').replace(/^\\\(|\\\)$/g, '').trim();
  s = s.replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\left|\\right/g, '').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\pi/g, 'pi');
  s = s.replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'));
  s = s.replace(/[×✕✖]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    .replace(/√\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)').replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/³/g, '^3');

  const eq = s.match(/^[a-zA-Z]\s*=\s*(.+)$/);
  if (eq) s = eq[1].trim();

  const ratio = s.match(/^(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)$/);
  if (ratio) s = `(${ratio[1]})/(${ratio[2]})`;

  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) s = `${mixed[1]}(${mixed[2]} + ${mixed[3]}/${mixed[4]})`;

  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');

  return s.trim();
};

const FN_WORDS = /\b(sqrt|cbrt|abs|round|floor|ceil|log10|log2|log|exp|sin|cos|tan|pow|nthRoot|pi|e)\b/g;

/** Does this look like something the checker can judge as a number? */
export const looksNumeric = (raw: string): boolean => {
  const s = normalizeMath(raw).replace(/%$/, '').trim();
  if (!s || !/\d/.test(s)) return false;
  return /^[\d\s+\-*/^().,]*$/.test(s.replace(FN_WORDS, ''));
};

/** Parse a numeric answer (expression, percent, fraction, ratio, value with unit). Never throws. */
export const parseAnswer = (raw: string): Parsed => {
  const original = String(raw ?? '').trim();
  if (!original) return { ok: false, error: 'Empty answer' };
  let s = normalizeMath(original);

  let percent = false;
  if (/%\s*$/.test(s)) { percent = true; s = s.replace(/%\s*$/, '').trim(); }

  if (!percent && /[a-zA-Z]/.test(s) && /^-?[\d.,]+\s*[a-zA-Z/^0-9]+$/.test(s)) {
    try {
      const unit = math.unit(s);
      const units = unit.formatUnits();
      return { ok: true, value: unit.toNumber(units), unit: units, unitValue: unit };
    } catch { /* not a unit — try as an expression */ }
  }

  try {
    const node = math.parse(s);
    assertSafe(node);
    const value: unknown = node.compile().evaluate();
    if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: 'Not a finite number' };
    return { ok: true, value: percent ? value / 100 : value };
  } catch (e) {
    return { ok: false, error: `Cannot read "${original}": ${(e as Error).message}` };
  }
};

const numbersEqual = (a: number, b: number, o: CompareOptions = {}): boolean => {
  if (o.roundTo != null) {
    const f = 10 ** o.roundTo;
    return Math.round(a * f) === Math.round(b * f);
  }
  if (o.tolerance != null) return Math.abs(a - b) <= o.tolerance;
  return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1);
};

/** Are two answers mathematically the same? 0.5 = 1/2 = 50%, 5 cm = 0.05 m. */
export const equivalent = (expected: string, given: string, o: CompareOptions = {}): { equal: boolean; reason?: string } => {
  const e = parseAnswer(expected);
  const g = parseAnswer(given);
  if (!e.ok) return { equal: false, reason: e.error };
  if (!g.ok) return { equal: false, reason: g.error };

  if (e.unitValue) {
    if (!g.unitValue) {
      if (o.unitRequired) return { equal: false, reason: 'Missing unit' };
      return { equal: numbersEqual(e.value!, g.value!, o) };
    }
    try {
      if (!e.unitValue.equalBase(g.unitValue)) return { equal: false, reason: 'Different kind of unit' };
      return { equal: numbersEqual(e.value!, g.unitValue.toNumber(e.unit!), o) };
    } catch (err) {
      return { equal: false, reason: (err as Error).message };
    }
  }
  return { equal: numbersEqual(e.value!, g.value!, o) };
};

const normText = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export type Verdict =
  | { correct: true; method: 'math' | 'text' }
  | { correct: false; method: 'math' | 'text' | 'unsure'; reason?: string };

/**
 * Check a student's answer against the expected answer and any accepted alternatives.
 * `unsure` means the checker can't decide (e.g. a worded answer) — the caller may ask the AI.
 */
export const checkAnswer = (given: string, expected: string, accepted: string[] = [], o: CompareOptions = {}): Verdict => {
  const candidates = [expected, ...accepted].filter((c) => c && c.trim());
  if (!given.trim()) return { correct: false, method: 'text', reason: 'Empty answer' };

  for (const c of candidates) {
    if (looksNumeric(c) || parseAnswer(c).unitValue) {
      if (equivalent(c, given, o).equal) return { correct: true, method: 'math' };
    }
  }
  const g = normText(given);
  if (g && candidates.some((c) => normText(c) === g)) return { correct: true, method: 'text' };

  // Numeric expected answer + readable student number = a definite no.
  if (looksNumeric(expected) && parseAnswer(expected).ok && parseAnswer(given).ok) {
    return { correct: false, method: 'math', reason: equivalent(expected, given, o).reason };
  }
  return { correct: false, method: 'unsure' };
};

/** Format a number without float noise. */
export const formatNumber = (n: number, maxDecimals = 6): string => String(Number(n.toFixed(maxDecimals)));
