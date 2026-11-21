import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DocumentError, docKind, documentText, readZip } from '../../src/features/lectures/documentText';

/** A real .zip with deflated files (like Word and PowerPoint save). */
const zip = (files: Record<string, string>, deflate = true) => {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = deflate ? deflateRawSync(raw) : raw, nm = Buffer.from(name);
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(deflate ? 8 : 0, 8);
    loc.writeUInt32LE(data.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(nm.length, 26);
    parts.push(loc, nm, data);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(deflate ? 8 : 0, 10);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE(off, 42);
    central.push(cen, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
};
const file = (buf: Buffer | string, name: string, type = '') => Object.assign(new Blob([typeof buf === 'string' ? buf : new Uint8Array(buf)], { type }), { name });
const slide = (n: number) => `Slide ${n}`;

describe('reading documents', () => {
  it('knows the kinds of files', () => {
    expect(['a.PDF', 'b.docx', 'c.pptx', 'd.txt', 'e.md', 'f.doc', 'g.ppt', 'h.jpg', 'i.odt', 'j.zip'].map((n) => docKind(n)))
      .toEqual(['pdf', 'docx', 'pptx', 'text', 'text', 'legacy', 'legacy', 'image', 'odt', 'unknown']);
  });

  it('unzips stored and deflated files', async () => {
    const b = zip({ 'a.txt': 'hello', 'b/c.xml': '<x>שלום</x>' });
    const out = await readZip(b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer, () => true);
    expect([...out.entries()]).toEqual([['a.txt', 'hello'], ['b/c.xml', '<x>שלום</x>']]);
  });

  it('Word: paragraphs in order, runs joined, entities decoded, tabs and breaks kept', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Derivatives &amp; </w:t></w:r><w:r><w:t xml:space="preserve">slopes</w:t></w:r></w:p>'
      + '<w:p><w:pPr/><w:r><w:t>Line one</w:t><w:br/><w:t>line two</w:t><w:tab/><w:t>x</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>מבוא &#8211; סוף</w:t></w:r></w:p></w:body></w:document>';
    const text = await documentText(file(zip({ 'word/document.xml': xml, 'docProps/app.xml': '<x/>' }), 'notes.docx'), slide);
    expect(text).toBe('Derivatives & slopes\n\nLine one\nline two\tx\n\nמבוא – סוף');
  });

  it('PowerPoint: slides in number order (10 after 9), each labelled', async () => {
    const s = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p><a:p><a:r><a:t>point</a:t></a:r></a:p></p:sld>`;
    const text = await documentText(file(zip({ 'ppt/slides/slide10.xml': s('Ten'), 'ppt/slides/slide2.xml': s('Two'), 'ppt/slides/slide1.xml': s('One'), 'ppt/slides/_rels/slide1.xml.rels': '<x/>' }), 'deck.pptx'), slide);
    expect(text).toBe('Slide 1\nOne\npoint\n\nSlide 2\nTwo\npoint\n\nSlide 10\nTen\npoint');
  });

  it('text files (UTF-8 and UTF-16), and OpenDocument', async () => {
    expect(await documentText(file('﻿Plain notes about limits and derivatives.', 'a.txt'), slide)).toBe('Plain notes about limits and derivatives.');
    const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Notes in UTF-16 about integrals.', 'utf16le')]);
    expect(await documentText(file(u16, 'b.txt'), slide)).toBe('Notes in UTF-16 about integrals.');
    const odt = '<office:text><text:h>Heading here</text:h><text:p>A paragraph<text:s/>with space.</text:p></office:text>';
    expect(await documentText(file(zip({ 'content.xml': odt }), 'c.odt'), slide)).toBe('Heading here\n\nA paragraph with space.');
  });

  it("says why a file can't be read: old formats, unknown, empty, broken", async () => {
    const reason = (f: Blob & { name: string }) => documentText(f, slide).then(() => 'ok', (e: DocumentError) => e.reason);
    expect(await reason(file('x', 'old.doc'))).toBe('legacy');
    expect(await reason(file('x', 'a.zip'))).toBe('unknown');
    expect(await reason(file('hi', 'short.txt'))).toBe('empty');
    expect(await reason(file('not a zip at all', 'broken.docx'))).toBe('unreadable');
  });
});
