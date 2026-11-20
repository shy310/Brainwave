import { describe, expect, it } from 'vitest';
import { dropIndex, moveItem } from '../../src/features/lectures/useDragReorder';

describe('drag to reorder', () => {
  it('moves an item to a new place', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
  const boxes = [{ left: 0, right: 100 }, { left: 110, right: 200 }, { left: 210, right: 300 }];
  it('lands on the item under the pointer, or the nearest one', () => {
    expect(dropIndex(105, boxes)).toBe(0); // in the gap, nearer the first
    expect(dropIndex(20, boxes)).toBe(0);
    expect(dropIndex(160, boxes)).toBe(1);
    expect(dropIndex(400, boxes)).toBe(2);
  });
  it('finds the drop place right-to-left (first item on the right)', () => {
    const rtl = [{ left: 210, right: 300 }, { left: 110, right: 200 }, { left: 0, right: 100 }];
    expect(dropIndex(280, rtl)).toBe(0);
    expect(dropIndex(150, rtl)).toBe(1);
    expect(dropIndex(-10, rtl)).toBe(2);
  });
});
