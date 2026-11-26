import { describe, expect, it } from 'vitest';
import { cleanSheet } from '../../shared/cheatSheet';
import { sheetText } from '../../src/features/lectures/CheatSheetPage';

describe('cheat sheets', () => {
  it('tidies what the AI wrote', () => {
    const s = cleanSheet({
      blocks: [
        { heading: ' Rules ', items: ['- **Chain** rule: $f(g)$', '  ', '• Product'], table: null },
        { heading: 'Empty', items: [], table: null },
        { heading: 'Pairs', items: [], table: { head: ['Term', 'Meaning', 'Example'], rows: [['Limit', 'Approach'], ['', '', ''], ['A', 'B', 'C', 'D']] } },
        { heading: 'No rows', items: [], table: { head: ['a', 'b'], rows: [] } },
      ],
      formulas: [' $e^{i\\pi}=-1$ ', ''],
    }, 'tables');
    expect(s.format).toBe('tables');
    expect(s.blocks.map((b) => b.heading)).toEqual(['Rules', 'Pairs']);
    expect(s.blocks[0].items).toEqual(['**Chain** rule: $f(g)$', 'Product']);
    expect(s.blocks[1].table!.rows).toEqual([['Limit', 'Approach', ''], ['A', 'B', 'C']]);
    expect(s.formulas).toEqual(['$e^{i\\pi}=-1$']);
  });

  it('copies as plain text', () => {
    const text = sheetText('Calc', { format: 'bullets', formulas: ['a=b'], blocks: [{ heading: 'Rules', items: ['**x** y'], table: { head: ['A', 'B'], rows: [['1', '2']] } }] });
    expect(text).toBe('Calc\n\nRULES\n• x y\nA | B\n1 | 2\n\n∑\n• a=b');
  });
});
