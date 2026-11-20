import { describe, expect, it } from 'vitest';
import { compilePlot, samplePlot } from '../../shared/math/plot';
import { MediaSourceSchema, sanitizeScene, type Scene } from '../../shared/media';

const scene = (over: Partial<Scene>): Scene => ({ kind: 'title', heading: 'H', items: [], latex: '', fn: '', xMin: -5, xMax: 5, narration: 'Hi.', ...over });

describe('plots', () => {
  it('compiles plain math in x and refuses anything else', () => {
    expect(compilePlot('y = x^2 - 2*x')?.evaluate({ x: 3 })).toBe(3);
    expect(compilePlot('sin(x) + cos(pi*x)')).not.toBeNull();
    expect(compilePlot('import("fs")')).toBeNull();
    expect(compilePlot('a = 5')).toBeNull();
    expect(compilePlot('z + 1')).toBeNull();
    expect(compilePlot('')).toBeNull();
  });

  it('breaks the line at gaps', () => {
    const lines = samplePlot('1/x', -1, 1, 100);
    expect(lines.length).toBe(2);
    expect(samplePlot('sqrt(x)', -4, 4, 80).length).toBe(1);
  });
});

describe('scenes', () => {
  it('falls back when a visual cannot be drawn', () => {
    expect(sanitizeScene(scene({ kind: 'graph', fn: 'evil()', latex: 'y=x' })).kind).toBe('equation');
    expect(sanitizeScene(scene({ kind: 'graph', fn: 'x', xMin: 3, xMax: 1, items: ['a'] })).kind).toBe('bullets');
    expect(sanitizeScene(scene({ kind: 'equation', latex: ' ' })).kind).toBe('title');
    expect(sanitizeScene(scene({ kind: 'steps', items: ['', ' '] })).kind).toBe('title');
    expect(sanitizeScene(scene({ kind: 'graph', fn: 'x^2' })).kind).toBe('graph');
  });

  it('needs exactly one source', () => {
    expect(MediaSourceSchema.safeParse({ prompt: 'photosynthesis' }).success).toBe(true);
    expect(MediaSourceSchema.safeParse({}).success).toBe(false);
    expect(MediaSourceSchema.safeParse({ prompt: 'abc', topicId: 'math-k-t1' }).success).toBe(false);
  });
});

import { estimateMs, splitSentences } from '../../src/features/media/speech';

describe('narration', () => {
  it('splits narration into sentences', () => {
    expect(splitSentences('Hello there. How are you? Great!')).toEqual(['Hello there.', 'How are you?', 'Great!']);
    expect(splitSentences('No full stop at the end')).toEqual(['No full stop at the end']);
    expect(splitSentences('שלום. מה שלומך?')).toEqual(['שלום.', 'מה שלומך?']);
    expect(splitSentences('He said "wow." Then left.')).toEqual(['He said "wow."', 'Then left.']);
  });

  it('estimates speaking time', () => {
    expect(estimateMs('one two three four five six seven eight nine ten')).toBeGreaterThan(3000);
    expect(estimateMs('hi', 2)).toBe(1200);
  });
});

import { cleanSpoken, sanitizePodcast } from '../../shared/media';

describe('podcasts', () => {
  it('strips Markdown and LaTeX from spoken lines', () => {
    expect(cleanSpoken('So **x squared** is $x^2$ \\cdot fun # yes')).toBe('So x squared is x^2 fun yes');
  });

  it('cleans lines and always starts with a chapter', () => {
    const p = sanitizePodcast({
      title: 'Ep', hosts: [{ name: 'Maya', role: '' }, { name: 'Sam', role: '' }],
      lines: [{ speaker: 0, text: 'Hi!', chapter: '' }, { speaker: 1, text: '**', chapter: '' }, { speaker: 1, text: 'Hello.', chapter: ' Part 2 ' }],
    });
    expect(p.lines).toEqual([{ speaker: 0, text: 'Hi!', chapter: 'Ep' }, { speaker: 1, text: 'Hello.', chapter: 'Part 2' }]);
  });
});
