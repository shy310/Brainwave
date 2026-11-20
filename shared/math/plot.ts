// Safe function plotting for video scenes: only arithmetic in `x` is allowed.
import { all, create, type EvalFunction, type MathNode } from 'mathjs';

const math = create(all, { number: 'number' });
const FUNCTIONS = new Set(['sqrt', 'cbrt', 'abs', 'exp', 'log', 'log10', 'log2', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'floor', 'ceil', 'round', 'pow', 'min', 'max']);
const SYMBOLS = new Set(['x', 'pi', 'e']);

const safe = (node: MathNode): boolean => {
  let ok = true;
  node.traverse((n) => {
    if (!ok) return;
    if (n.type === 'ConstantNode' || n.type === 'OperatorNode' || n.type === 'ParenthesisNode') return;
    if (n.type === 'FunctionNode') { ok = FUNCTIONS.has((n as unknown as { fn: { name: string } }).fn.name); return; }
    if (n.type === 'SymbolNode') { const name = (n as unknown as { name: string }).name; ok = SYMBOLS.has(name) || FUNCTIONS.has(name); return; }
    ok = false;
  });
  return ok;
};

/** Compile `y = f(x)` if it is plain math in x; otherwise null. */
export const compilePlot = (expr: string): EvalFunction | null => {
  const src = expr.replace(/^\s*(y|f\(x\))\s*=\s*/i, '').replace(/\*\*/g, '^').trim();
  if (!src || src.length > 200) return null;
  try {
    const node = math.parse(src);
    if (!safe(node)) return null;
    const fn = node.compile();
    const probe = fn.evaluate({ x: 0.5 });
    return typeof probe === 'number' ? fn : null;
  } catch {
    return null;
  }
};

/** Sample a function for drawing. Gaps (NaN, infinities, huge jumps) break the line. */
export const samplePlot = (expr: string, xMin: number, xMax: number, steps = 200): { x: number; y: number }[][] => {
  const fn = compilePlot(expr);
  if (!fn || !(xMax > xMin)) return [];
  const lines: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    let y: unknown;
    try { y = fn.evaluate({ x }); } catch { y = NaN; }
    if (typeof y === 'number' && Number.isFinite(y) && Math.abs(y) < 1e6) current.push({ x, y });
    else if (current.length) { lines.push(current); current = []; }
  }
  if (current.length) lines.push(current);
  return lines;
};
