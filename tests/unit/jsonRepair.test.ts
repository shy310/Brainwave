import { describe, expect, it } from 'vitest';
import { parseJson } from '../../server/ai/jsonRepair';

describe('parseJson', () => {
  it('parses plain JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips markdown fences and prose', () => {
    expect(parseJson('Here you go:\n```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });
  it('repairs LaTeX backslashes', () => {
    expect(parseJson('{"f":"$\\frac{1}{2}$"}')).toEqual({ f: '$\\frac{1}{2}$' });
  });
  it('closes truncated output', () => {
    expect(parseJson('{"items":[{"q":"one"},{"q":"tw')).toEqual({ items: [{ q: 'one' }] });
    expect(parseJson('{"items":[{"q":"one"},{"q":"two"')).toEqual({ items: [{ q: 'one' }, { q: 'two' }] });
  });
  it('removes trailing commas', () => {
    expect(parseJson('{"a":[1,2,],}')).toEqual({ a: [1, 2] });
  });
  it('handles smart quotes used as delimiters', () => {
    expect(parseJson('{“name”: “שלום”}')).toEqual({ name: 'שלום' });
  });
  it('throws on hopeless input', () => {
    expect(() => parseJson('no json here')).toThrow();
  });
});

describe('parseJson LaTeX safety', () => {
  it('keeps already-escaped LaTeX intact', () => {
    expect(parseJson('{"f":"$\\\\frac{1}{2} \\\\times 3$"}')).toEqual({ f: '$\\frac{1}{2} \\times 3$' });
  });
  it('protects colliding commands but keeps real newlines', () => {
    expect(parseJson('{"f":"$\\theta + \\beta$","g":"a\\nb"}')).toEqual({ f: '$\\theta + \\beta$', g: 'a\nb' });
  });
});
