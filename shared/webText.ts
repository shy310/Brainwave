// A web page's readable text (the article, not the menus), for making a
// lecture from a link. Pure: the server fetches the page, this reads it.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export const decodeEntities = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

const meta = (html: string, prop: string) =>
  new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1]
  ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i').exec(html)?.[1];

/** The inner HTML of the largest element of this tag, if any. */
const largest = (html: string, tag: string) => {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let best = '';
  for (let m = re.exec(html); m; m = re.exec(html)) if (m[1].length > best.length) best = m[1];
  return best;
};

/** HTML to plain text: block elements become line breaks, everything else is dropped. */
export const htmlToText = (html: string) => decodeEntities(html
  .replace(/<(script|style|noscript|svg|template|iframe|nav|header|footer|aside|form|button|figure)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<li\b[^>]*>/gi, '\n• ')
  .replace(/<(br|hr)\b[^>]*>/gi, '\n')
  .replace(/<\/li>/gi, '')
  .replace(/<\/?(p|div|section|article|main|h[1-6]|ul|ol|tr|table|blockquote|pre|dd|dt)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/**
 * The page's title and main text: the <article> (or <main>) when there is a
 * substantial one, otherwise the whole body without menus, headers and footers.
 */
export const readablePage = (html: string): { title: string; text: string } => {
  const title = decodeEntities(meta(html, 'og:title') ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  for (const tag of ['article', 'main']) {
    const part = htmlToText(largest(body, tag));
    if (part.length >= 400) return { title, text: part };
  }
  return { title, text: htmlToText(body) };
};

/** Addresses a server must never fetch for a user: this machine, private networks, cloud metadata. */
export const isPrivateAddress = (ip: string): boolean => {
  const v = ip.toLowerCase().replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
};
