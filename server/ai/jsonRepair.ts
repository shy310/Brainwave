// Tolerant JSON parsing for model output. Structured outputs make this a rare
// fallback, but models still occasionally return fenced, truncated or
// LaTeX-escaped JSON. Ported from the original app, where it was battle-tested.

const JSON_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

/** Fix invalid escapes (LaTeX `\frac`), unescaped inner quotes and raw newlines. */
const repairEscapes = (text: string): string => {
  let out = '';
  let inString = false;
  let pendingSlash = false;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (pendingSlash) {
      pendingSlash = false;
      out += !inString || JSON_ESCAPE_CHARS.has(ch) ? '\\' + ch : '\\\\' + ch;
      continue;
    }
    if (ch === '\\') { pendingSlash = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; out += ch; continue; }
      let j = i + 1;
      while (j < chars.length && (chars[j] === ' ' || chars[j] === '\t')) j++;
      const next = chars[j];
      const structural = next === undefined || ',}]:\n\r'.includes(next);
      if (structural) { inString = false; out += ch; } else out += '\\"';
      continue;
    }
    if (inString && ch === '\n') { out += '\\n'; continue; }
    if (inString && ch === '\r') { out += '\\r'; continue; }
    if (inString && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  if (pendingSlash) out += '\\\\';
  return out;
};

/** Close structures left open by truncated output. */
const closeIncomplete = (text: string): string => {
  let inStr = false, esc = false, lastSafe = 0;
  const stack: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; if (!inStr) lastSafe = i + 1; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') { stack.pop(); if (!stack.length) lastSafe = i + 1; }
    else if ((ch === ',' || ch === ':') && stack.length <= 1) lastSafe = i + 1;
  }
  let result = inStr ? text.slice(0, lastSafe) : text;
  const stack2: string[] = [];
  inStr = false; esc = false;
  for (const ch of result) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack2.push(ch);
    else if ((ch === '}' || ch === ']') && stack2.length) stack2.pop();
  }
  result = result.replace(/,(\s*)$/, '$1');
  for (let i = stack2.length - 1; i >= 0; i--) result += stack2[i] === '{' ? '}' : ']';
  return result;
};

/** Pull the outermost JSON object/array out of surrounding prose. */
const extractJson = (text: string): string => {
  const a = text.indexOf('{'), b = text.indexOf('[');
  const start = Math.min(a === -1 ? Infinity : a, b === -1 ? Infinity : b);
  if (start === Infinity) return text;
  const opener = text[start], closer = opener === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
};

// LaTeX commands whose first letter collides with a valid JSON escape
// (\b \f \n \r \t). Unescaped, `\frac` would parse as form-feed + "rac".
const LATEX_COLLISIONS = [
  'frac', 'fbox', 'flat', 'forall', 'beta', 'bar', 'binom', 'boxed', 'bigl', 'bigr', 'big', 'bullet', 'because', 'bot',
  'nu', 'neq', 'ne', 'nabla', 'not', 'nmid', 'neg', 'ni', 'notin', 'newline', 'nearrow',
  'rho', 'right', 'rangle', 'rceil', 'rfloor', 'rightarrow', 'rbrace',
  'times', 'theta', 'tau', 'tan', 'tanh', 'text', 'textbf', 'textit', 'tfrac', 'to', 'top', 'triangle', 'tilde', 'therefore',
];
const LATEX_RE = new RegExp(`(?<!\\\\)\\\\(${LATEX_COLLISIONS.join('|')})(?![a-zA-Z])`, 'g');
const protectLatex = (text: string) => text.replace(LATEX_RE, '\\\\$1');

/** Drop the last (incomplete) element: cut at the last comma outside a string. */
const cutAtLastComma = (text: string): string | null => {
  let inStr = false, esc = false, last = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr && ch === ',') last = i;
  }
  return last === -1 ? null : text.slice(0, last);
};

const preClean = (text: string): string =>
  text
    .replace(/^﻿/, '')
    .replace(/[​-‏‪-‮⁠⁦-⁩]/g, '') // invisible direction marks
    .replace(/[“”„‟″]/g, '"')               // smart double quotes
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');

export const parseJson = (text: string): unknown => {
  const stripped = protectLatex(extractJson(preClean(text).trim()));
  try { return JSON.parse(stripped); } catch { /* repair below */ }
  const pass1 = repairEscapes(stripped).replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(pass1); } catch { /* repair below */ }
  // Truncated output: close open structures, dropping partial trailing items.
  let candidate: string | null = pass1;
  for (let i = 0; candidate && i < 50; i++) {
    try { return JSON.parse(closeIncomplete(candidate)); } catch { candidate = cutAtLastComma(candidate); }
  }
  throw new Error(`Could not parse JSON from model output (${text.length} chars)`);
};
