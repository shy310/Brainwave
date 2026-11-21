import { describe, expect, it } from 'vitest';
import { ankiMath, ankiTsv, crc32, docxBytes, fileName, zipStore } from '../../src/features/lectures/exporters';

const labels = { summary: 'Summary', keyTerms: 'Key terms', reminders: 'Reminders', practice: 'Practice', mistakes: 'Mistakes' };
const notes = { title: 't', summary: 'Rates & <changes>.', sections: [{ heading: 'Rules', points: ['Chain rule: $f(g(x))$'] }],
  keyTerms: [{ term: 'Slope', definition: 'Rise over run' }], reminders: ['Quiz Friday'] } as never;

/** Read a stored .zip back: name → text (checking each file's CRC). */
const unzip = (z: Uint8Array) => {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const out: Record<string, string> = {};
  let at = 0;
  while (v.getUint32(at, true) === 0x04034b50) {
    const crc = v.getUint32(at + 14, true), size = v.getUint32(at + 18, true), nameLen = v.getUint16(at + 26, true);
    const name = new TextDecoder().decode(z.slice(at + 30, at + 30 + nameLen));
    const data = z.slice(at + 30 + nameLen, at + 30 + nameLen + size);
    expect(crc32(data)).toBe(crc);
    out[name] = new TextDecoder().decode(data);
    at += 30 + nameLen + size;
  }
  return out;
};

describe('exports', () => {
  it('Anki: a tab-separated file with a header, safe fields, maths Anki understands, and a tag', () => {
    const tsv = ankiTsv('Calculus 101', [{ front: 'What is $x^2$\'s derivative?', back: '$2x$\n(power rule)' }, { front: 'A\tB', back: 'a < b' }]);
    const lines = tsv.trimEnd().split('\n');
    expect(lines.slice(0, 3)).toEqual(['#separator:tab', '#html:true', '#tags column:3']);
    expect(lines[3]).toBe("What is \\(x^2\\)'s derivative?\t\\(2x\\)<br>(power rule)\tBrainWave::Calculus_101");
    expect(lines[4]).toBe('A B\ta &lt; b\tBrainWave::Calculus_101');
    expect(ankiMath('$$\\int x$$ and $y$')).toBe('\\[\\int x\\] and \\(y\\)');
  });

  it('zips files that read back exactly (CRC checked)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('héllo') }, { name: 'dir/b.xml', data: new TextEncoder().encode('<x/>') }]);
    expect(unzip(z)).toEqual({ 'a.txt': 'héllo', 'dir/b.xml': '<x/>' });
  });

  it('Word: a valid .docx with the notes, escaped text, bullets, bold terms, and right-to-left for Hebrew', () => {
    const files = unzip(docxBytes('My <notes>', notes, labels, false));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']));
    const doc = files['word/document.xml'];
    expect(doc).toContain('My &lt;notes&gt;');
    expect(doc).toContain('Rates &amp; &lt;changes&gt;.');
    expect(doc).toContain('Chain rule: f(g(x))');
    expect(doc).toContain('<w:b/></w:rPr><w:t xml:space="preserve">Slope</w:t>');
    expect(doc).toContain('<w:numId w:val="1"/>');
    expect(doc).not.toContain('<w:bidi/>');
    expect(unzip(docxBytes('סיכום', notes, labels, true))['word/document.xml']).toContain('<w:bidi/>');
  });

  it('makes safe file names in any language', () => {
    expect(fileName('Calc: week 2/3?', 'docx')).toBe('Calc week 2 3.docx');
    expect(fileName('מבוא למתמטיקה', 'txt')).toBe('מבוא למתמטיקה.txt');
    expect(fileName('  ', 'md')).toBe('BrainWave.md');
  });
});
