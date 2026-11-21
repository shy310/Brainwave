import { describe, expect, it } from 'vitest';
import { cleanMap, layoutMap, type ConceptMap } from '../../shared/conceptMap';

const n = (id: string, kind: 'main' | 'concept' | 'detail' = 'concept') => ({ id, label: id.toUpperCase(), kind, note: '' });
const e = (from: string, to: string) => ({ from, to, label: 'is' });

describe('concept maps', () => {
  it('cleans what the AI wrote: one main idea, real links only, nothing left floating', () => {
    const m = cleanMap({
      nodes: [n('a', 'main'), n('b', 'main'), n('c'), n('a'), n('d')],
      edges: [e('a', 'b'), e('b', 'a'), e('b', 'b'), e('b', 'x'), e('b', 'c')],
    } as ConceptMap);
    expect(m.nodes.map((x) => [x.id, x.kind])).toEqual([['a', 'main'], ['b', 'concept'], ['c', 'concept'], ['d', 'concept']]);
    expect(m.edges.map((x) => `${x.from}-${x.to}`)).toEqual(['a-b', 'b-c', 'a-d']);
  });

  it('picks the best-connected idea as the main one when none is marked', () => {
    const m = cleanMap({ nodes: [n('a'), n('hub'), n('c')], edges: [e('hub', 'a'), e('hub', 'c')] } as ConceptMap);
    expect(m.nodes.find((x) => x.kind === 'main')?.id).toBe('hub');
  });

  it('puts the main idea in the middle, its links on the first ring, and keeps nodes apart', () => {
    const m = cleanMap({
      nodes: [n('m', 'main'), n('a'), n('b'), n('c'), n('a1', 'detail'), n('a2', 'detail'), n('b1', 'detail')],
      edges: [e('m', 'a'), e('m', 'b'), e('m', 'c'), e('a', 'a1'), e('a', 'a2'), e('b', 'b1')],
    } as ConceptMap);
    const p = layoutMap(m, 200);
    expect(p).toHaveLength(7);
    const at = (id: string) => p.find((x) => x.id === id)!;
    expect(at('m')).toMatchObject({ x: 0, y: 0, ring: 0 });
    expect(['a', 'b', 'c'].map((id) => at(id).ring)).toEqual([1, 1, 1]);
    expect(Math.round(Math.hypot(at('a').x, at('a').y))).toBe(200);
    expect(at('a1').ring).toBe(2);
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      expect(Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y)).toBeGreaterThan(80);
    }
    expect(layoutMap(m, 200)).toEqual(p); // the same every time
  });
});
