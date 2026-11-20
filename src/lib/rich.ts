// A tiny, safe Markdown + LaTeX parser for AI text. It produces a tree that the
// <Rich> component renders as React elements — raw HTML is never interpreted.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'math'; v: string }
  | { t: 'br' };

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; level: 1 | 2 | 3; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][]; start?: number }
  | { t: 'code'; lang: string; v: string }
  | { t: 'math'; v: string }
  | { t: 'quote'; c: Inline[] };

// Inline tokens, in priority order: code, display-ish \( \), $math$, **bold**, *em*.
const INLINE = /(`[^`\n]+`)|\\\((.+?)\\\)|(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)|\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g;

export const parseInline = (text: string): Inline[] => {
  const out: Inline[] = [];
  const pushText = (s: string) => {
    const lines = s.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) out.push({ t: 'br' });
      if (line) out.push({ t: 'text', v: line });
    });
  };
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) pushText(text.slice(last, idx));
    if (m[1]) out.push({ t: 'code', v: m[1].slice(1, -1) });
    else if (m[2] !== undefined) out.push({ t: 'math', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'math', v: m[3] });
    else if (m[4] !== undefined) out.push({ t: 'strong', c: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ t: 'em', c: parseInline(m[5]) });
    last = idx + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
};

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

export const parseRich = (src: string): Block[] => {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', c: parseInline(para.join('\n').trim()) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const fence = trimmed.match(/^```(\w*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i]);
      blocks.push({ t: 'code', lang: fence[1], v: body.join('\n') });
      continue;
    }

    if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
      flush();
      const close = trimmed.startsWith('$$') ? '$$' : '\\]';
      let body = trimmed.slice(2);
      if (body.trimEnd().endsWith(close) && body.length >= close.length) {
        body = body.trimEnd().slice(0, -close.length);
      } else {
        const rest: string[] = [body];
        while (++i < lines.length) {
          const l = lines[i];
          const at = l.indexOf(close);
          if (at >= 0) { rest.push(l.slice(0, at)); break; }
          rest.push(l);
        }
        body = rest.join('\n');
      }
      blocks.push({ t: 'math', v: body.trim() });
      continue;
    }

    if (!trimmed) { flush(); continue; }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ t: 'h', level: heading[1].length as 1 | 2 | 3, c: parseInline(heading[2]) });
      continue;
    }

    if (trimmed.startsWith('>')) {
      flush();
      blocks.push({ t: 'quote', c: parseInline(trimmed.replace(/^>\s?/, '')) });
      continue;
    }

    const listKind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null;
    if (listKind) {
      flush();
      const items: Inline[][] = [];
      const start = listKind === 'ol' ? Number(line.match(NUMBERED)![1]) : undefined;
      const re = listKind === 'ul' ? BULLET : NUMBERED;
      while (i < lines.length && re.test(lines[i])) {
        const m = lines[i].match(re)!;
        items.push(parseInline(listKind === 'ul' ? m[1] : m[2]));
        i++;
      }
      i--;
      blocks.push({ t: listKind, items, start });
      continue;
    }

    para.push(line);
  }
  flush();
  return blocks;
};
