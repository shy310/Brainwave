// Models aren't shown size limits (some providers reject schemas that have
// them), so a good answer can come back a little too long: 35 key terms where
// 30 are allowed, a summary a few words over. Rather than throw it away (and
// show the student an error), trim it to the limits before validating.

type Json = Record<string, unknown>;

const pickBranch = (value: unknown, branches: Json[]): Json | undefined => {
  const t = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value;
  return branches.find((b) => b.type === t || (t === 'integer' && b.type === 'number') || (t === 'number' && b.type === 'integer'))
    ?? branches.find((b) => b.type !== 'null');
};

/** Trim arrays to maxItems, strings to maxLength, round integers and clamp numbers, following a JSON Schema. */
export const fitToSchema = (value: unknown, schema: unknown): unknown => {
  if (!schema || typeof schema !== 'object') return value;
  const s = schema as Json;
  const branches = (s.anyOf ?? s.oneOf) as Json[] | undefined;
  if (branches) {
    const b = pickBranch(value, branches);
    return b ? fitToSchema(value, b) : value;
  }
  if (Array.isArray(value)) {
    const max = typeof s.maxItems === 'number' ? s.maxItems : Infinity;
    return value.slice(0, max).map((v) => fitToSchema(v, s.items));
  }
  if (typeof value === 'string') {
    return typeof s.maxLength === 'number' && value.length > s.maxLength ? value.slice(0, s.maxLength).trimEnd() : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    let n = s.type === 'integer' ? Math.round(value) : value;
    if (typeof s.minimum === 'number') n = Math.max(s.minimum, n);
    if (typeof s.maximum === 'number') n = Math.min(s.maximum, n);
    return n;
  }
  if (value && typeof value === 'object' && s.properties && typeof s.properties === 'object') {
    const props = s.properties as Json;
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) out[k] = k in props ? fitToSchema(v, props[k]) : v;
    return out;
  }
  return value;
};
