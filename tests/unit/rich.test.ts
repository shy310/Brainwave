import { describe, expect, it } from 'vitest';
import { parseInline, parseRich } from '../../src/lib/rich';

describe('rich text parser', () => {
  it('parses inline math, bold, italics and code', () => {
    expect(parseInline('Solve $x^2=4$ **now** and *carefully* with `x`')).toEqual([
      { t: 'text', v: 'Solve ' }, { t: 'math', v: 'x^2=4' }, { t: 'text', v: ' ' },
      { t: 'strong', c: [{ t: 'text', v: 'now' }] }, { t: 'text', v: ' and ' },
      { t: 'em', c: [{ t: 'text', v: 'carefully' }] }, { t: 'text', v: ' with ' }, { t: 'code', v: 'x' },
    ]);
  });

  it('does not treat prices as math', () => {
    expect(parseInline('It costs $5 and $10.')).toEqual([{ t: 'text', v: 'It costs $5 and $10.' }]);
  });

  it('parses blocks', () => {
    const blocks = parseRich('# Title\n\nPara one\nline two\n\n- a\n- b\n\n2. x\n3. y\n\n$$\n\\frac{1}{2}\n$$\n\n```py\nprint(1)\n```\n> note');
    expect(blocks.map(b => b.t)).toEqual(['h', 'p', 'ul', 'ol', 'math', 'code', 'quote']);
    expect(blocks[3]).toMatchObject({ start: 2 });
    expect(blocks[4]).toEqual({ t: 'math', v: '\\frac{1}{2}' });
    expect(blocks[5]).toEqual({ t: 'code', lang: 'py', v: 'print(1)' });
  });

  it('handles one-line display math and Hebrew text', () => {
    expect(parseRich('$$a+b$$')).toEqual([{ t: 'math', v: 'a+b' }]);
    expect(parseRich('שלום $x$')[0]).toMatchObject({ t: 'p' });
  });

  it('keeps html as plain text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ t: 'text', v: '<img src=x onerror=alert(1)>' }]);
  });
});
