// Text from documents, read in the browser: Word (.docx), PowerPoint (.pptx),
// OpenDocument (.odt, .odp) and plain text (.txt, .md). Office files are zip
// archives of XML; this reads them with the browser's own decompression.

export type DocKind = 'pdf' | 'image' | 'docx' | 'pptx' | 'odt' | 'odp' | 'text' | 'legacy' | 'unknown';

/** What kind of document a file is, from its name (and type for images). */
export const docKind = (name: string, type = ''): DocKind => {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'gif'].includes(ext)) return 'image';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'odt') return 'odt';
  if (ext === 'odp') return 'odp';
  if (['txt', 'md', 'markdown', 'text', 'csv', 'srt', 'vtt'].includes(ext) || type.startsWith('text/')) return 'text';
  if (['doc', 'ppt', 'rtf', 'pages', 'key'].includes(ext)) return 'legacy';
  return 'unknown';
};

/** The file types the document picker offers. */
export const DOC_ACCEPT = '.pdf,.docx,.pptx,.odt,.odp,.txt,.md,.markdown,.csv,.srt,.vtt,.doc,.ppt,.rtf,image/*';

// ── Reading a .zip ─────────────────────────────────────────────────────────

const inflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** The files in a zip archive, by name (only those `want` asks for are unpacked). */
export const readZip = async (buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, string>> => {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // The end record is in the last 64 KB; it points to the central directory.
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('not-a-zip');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < count && v.getUint32(at, true) === 0x02014b50; n++) {
    const method = v.getUint16(at + 10, true);
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true), extraLen = v.getUint16(at + 30, true), commentLen = v.getUint16(at + 32, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) out.set(name, dec.decode(raw));
    else if (method === 8) out.set(name, dec.decode(await inflate(raw)));
  }
  return out;
};

// ── Text out of the XML ────────────────────────────────────────────────────

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? m);

/** Paragraphs from Office XML: each <p> (in namespace `ns`), its text runs <t> joined, tabs and breaks kept. */
const paragraphs = (xml: string, ns: string): string[] =>
  xml.split(new RegExp(`<${ns}:p[\\s>/]`)).slice(1).map((p) => {
    const body = p.split(new RegExp(`</${ns}:p>`))[0]
      .replace(new RegExp(`<${ns}:tab\\s*/>`, 'g'), '\u0001\t\u0002')
      .replace(new RegExp(`<${ns}:br\\s*/>`, 'g'), '\u0001\n\u0002')
      .replace(new RegExp(`<${ns}:t(?:\\s[^>]*)?>([^<]*)</${ns}:t>`, 'g'), '\u0001$1\u0002');
    // Only the text runs (and tabs and breaks) count; everything between them is markup.
    return decode([...body.matchAll(/\u0001([^\u0002]*)\u0002/g)].map((m) => m[1]).join(''));
  }).map((p) => p.trim()).filter(Boolean);

/** OpenDocument paragraphs and headings (<text:p>, <text:h>). */
const odfParagraphs = (xml: string): string[] =>
  [...xml.matchAll(/<text:(?:p|h)(?:\s[^>]*)?>([\s\S]*?)<\/text:(?:p|h)>/g)]
    .map((m) => decode(m[1].replace(/<text:tab\s*\/>/g, '\t').replace(/<text:line-break\s*\/>/g, '\n').replace(/<text:s(?:\s[^>]*)?\/>/g, ' ').replace(/<[^>]*>/g, '')).trim())
    .filter(Boolean);

const slideNumber = (name: string) => Number(/slide(\d+)\.xml$/.exec(name)?.[1] ?? 0);

export class DocumentError extends Error {
  constructor(public reason: 'legacy' | 'unknown' | 'empty' | 'unreadable') { super(reason); }
}

/**
 * The text of a Word, PowerPoint, OpenDocument or text file. Slides come in
 * order, each starting with its number ("Slide 3"), so the notes can follow
 * the deck. Throws DocumentError when it can't be read.
 */
export const documentText = async (file: Blob & { name: string }, slideLabel: (n: number) => string): Promise<string> => {
  const kind = docKind(file.name, file.type);
  if (kind === 'legacy') throw new DocumentError('legacy');
  let text = '';
  try {
    if (kind === 'text') {
      const buf = new Uint8Array(await file.arrayBuffer());
      const utf16 = (buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff);
      text = new TextDecoder(utf16 ? (buf[0] === 0xff ? 'utf-16le' : 'utf-16be') : 'utf-8').decode(buf).replace(/^﻿/, '');
    } else if (kind === 'docx') {
      const files = await readZip(await file.arrayBuffer(), (n) => n === 'word/document.xml');
      text = paragraphs(files.get('word/document.xml') ?? '', 'w').join('\n\n');
    } else if (kind === 'pptx') {
      const files = await readZip(await file.arrayBuffer(), (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      text = [...files.entries()].sort((a, b) => slideNumber(a[0]) - slideNumber(b[0]))
        .map(([name, xml]) => [slideLabel(slideNumber(name)), ...paragraphs(xml, 'a')].join('\n'))
        .filter((s) => s.includes('\n')).join('\n\n');
    } else if (kind === 'odt' || kind === 'odp') {
      const files = await readZip(await file.arrayBuffer(), (n) => n === 'content.xml');
      text = odfParagraphs(files.get('content.xml') ?? '').join('\n\n');
    } else throw new DocumentError('unknown');
  } catch (err) {
    if (err instanceof DocumentError) throw err;
    throw new DocumentError('unreadable');
  }
  text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 20) throw new DocumentError('empty');
  return text;
};
