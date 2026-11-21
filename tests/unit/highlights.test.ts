import { describe, expect, it } from 'vitest';
import { addHighlight, locate, sortHighlights, type NoteHighlight } from '../../shared/highlights';

const h = (block: string, quote: string, offset: number, color: NoteHighlight['color'] = 'yellow'): NoteHighlight => ({ id: `${block}-${offset}`, block, quote, offset, color, createdAt: 0 });

describe('note highlights', () => {
  it('finds the highlighted text where it was, or the nearest copy, or not at all', () => {
    const text = 'the slope, the slope again, and the slope';
    expect(locate(text, 'the slope', 11)).toBe(11);
    expect(locate(text, 'the slope', 30)).toBe(32);
    expect(locate(text, 'the area', 0)).toBe(-1);
    expect(locate('', '', 0)).toBe(-1);
  });

  it('adds highlights, and recolours the same one instead of adding it twice', () => {
    let all = addHighlight([], h('summary', 'limits', 4));
    all = addHighlight(all, h('summary', 'limits', 4, 'green'));
    expect(all).toHaveLength(1);
    expect(all[0].color).toBe('green');
    expect(addHighlight(all, h('s0.1', 'limits', 4))).toHaveLength(2);
  });

  it('lists them in the order of the notes', () => {
    const all = [h('k0', 'b', 0), h('s1.0', 'c', 0), h('s0.2', 'd', 5), h('summary', 'e', 9), h('s0.2', 'f', 1)];
    expect(sortHighlights(all).map((x) => x.quote)).toEqual(['e', 'f', 'd', 'c', 'b']);
  });
});
