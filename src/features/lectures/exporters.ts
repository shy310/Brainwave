// Exports for other apps: flashcards for Anki, notes as a Word file (which
// Google Docs opens) and as Markdown (for Notion). Pure and tested.
import type { Flashcards, Notes } from '@shared/lectures';
import type { NotesLabels } from './notesExport';

// ── Anki ────────────────────────────────────────────────────────────────────

/** $x$ → \(x\) and $$x$$ → \[x\]: the maths delimiters Anki understands. */
export const ankiMath = (s: string) => s.replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]').replace(/\$([^$\n]+)\$/g, '\\($1\\)');

const ankiField = (s: string) => ankiMath(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');

/**
 * A tab-separated file Anki imports as is (File → Import): front, back, and a
 * tag for the lecture. Header lines tell Anki the format.
 */
export const ankiTsv = (title: string, cards: Flashcards['cards']): string => {
  const tag = `BrainWave::${title.trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_:-]/gu, '') || 'lecture'}`;
  return [
    '#separator:tab', '#html:true', '#tags column:3',
    ...cards.map((c) => `${ankiField(c.front)}\t${ankiField(c.back)}\t${tag}`),
  ].join('\n') + '\n';
};

// ── A minimal .zip (stored, no compression) for the .docx ──────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Pack files into a .zip (no compression, which every reader accepts). */
export const zipStore = (files: { name: string; data: Uint8Array }[]): Uint8Array => {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true); local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, f.data.length, true); cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of all) { out.set(c, at); at += c.length; }
  return out;
};

// ── Word (.docx), which Google Docs opens ──────────────────────────────────

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Characters XML 1.0 doesn't allow.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
/** $x$ reads as plain x in a document. */
const plainMath = (s: string) => s.replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

type Run = { text: string; bold?: boolean };
const para = (runs: Run[], o: { style?: string; bullet?: boolean; rtl: boolean }) => {
  const pPr = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '',
    o.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '',
    o.rtl ? '<w:bidi/>' : '',
  ].join('');
  const r = runs.map((x) => `<w:r><w:rPr>${x.bold ? '<w:b/>' : ''}${o.rtl ? '<w:rtl/>' : ''}</w:rPr><w:t xml:space="preserve">${xml(plainMath(x.text))}</w:t></w:r>`).join('');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${r}</w:p>`;
};

/** The notes as a Word document: title, headings, bullet points, key terms in bold. */
export const docxBytes = (title: string, n: Notes, labels: NotesLabels, rtl: boolean): Uint8Array => {
  const P = (text: string, style?: string) => para([{ text }], { style, rtl });
  const body = [
    P(title, 'Title'),
    P(labels.summary, 'Heading1'), P(n.summary),
    ...n.sections.flatMap((s) => [P(s.heading, 'Heading1'), ...s.points.map((p) => para([{ text: p }], { bullet: true, rtl }))]),
    ...(n.keyTerms.length ? [P(labels.keyTerms, 'Heading1'), ...n.keyTerms.map((k) => para([{ text: k.term, bold: true }, { text: ` — ${k.definition}` }], { bullet: true, rtl }))] : []),
    ...(n.practice?.length ? [P(labels.practice, 'Heading1'), ...n.practice.flatMap((q, i) => [para([{ text: `${i + 1}. ${q.question}`, bold: true }], { rtl }), P(q.answer)])] : []),
    ...(n.mistakes?.length ? [P(labels.mistakes, 'Heading1'), ...n.mistakes.map((m) => para([{ text: m }], { bullet: true, rtl }))] : []),
    ...(n.reminders.length ? [P(labels.reminders, 'Heading1'), ...n.reminders.map((m) => para([{ text: m }], { bullet: true, rtl }))] : []),
  ].join('');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr>${rtl ? '<w:bidi/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/><w:color w:val="17327A"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="2356E8"/></w:rPr></w:style></w:styles>`,
    'word/numbering.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
  };
  const enc = new TextEncoder();
  return zipStore(Object.entries(files).map(([name, s]) => ({ name, data: enc.encode(s) })));
};

/** A safe file name from a lecture title (keeps letters in any script). */
export const fileName = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'BrainWave'}.${ext}`;
