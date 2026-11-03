import { describe, expect, it } from 'vitest';
import { checkAnswer, equivalent, looksNumeric, normalizeMath, parseAnswer } from '../../shared/math/check';

describe('math checker', () => {
  it('treats equivalent forms as equal', () => {
    for (const [a, b] of [['0.5', '1/2'], ['50%', '0.5'], ['1 1/2', '1.5'], ['3:4', '0.75'], ['x = 4', '4'],
      ['\\frac{1}{2}', '0.5'], ['2\\times3', '6'], ['0,5', '0.5'], ['1,000', '1000'], ['√16', '4'], ['2²', '4'], ['−3', '-3']]) {
      expect(equivalent(a, b).equal, `${a} vs ${b}`).toBe(true);
    }
  });

  it('compares values with units', () => {
    expect(equivalent('5 cm', '0.05 m').equal).toBe(true);
    expect(equivalent('5 cm', '5 kg').equal).toBe(false);
    expect(equivalent('5 cm', '5').equal).toBe(true);
    expect(equivalent('5 cm', '5', { unitRequired: true }).equal).toBe(false);
  });

  it('respects rounding and tolerance', () => {
    expect(equivalent('3.14159', '3.14', { roundTo: 2 }).equal).toBe(true);
    expect(equivalent('10', '10.4', { tolerance: 0.5 }).equal).toBe(true);
    expect(equivalent('0.1+0.2', '0.3').equal).toBe(true);
  });

  it('refuses anything that is not plain arithmetic', () => {
    expect(parseAnswer('import("fs")').ok).toBe(false);
    expect(parseAnswer('a = 5; a').ok).toBe(false);
    expect(parseAnswer('[1,2]').ok).toBe(false);
    expect(parseAnswer('').ok).toBe(false);
  });

  it('detects numeric-looking input', () => {
    expect(looksNumeric('sqrt(2)/2')).toBe(true);
    expect(looksNumeric('photosynthesis')).toBe(false);
    expect(normalizeMath('y=1/2')).toBe('1/2');
  });

  it('checks answers with math, text and unsure verdicts', () => {
    expect(checkAnswer('2/4', '0.5')).toEqual({ correct: true, method: 'math' });
    expect(checkAnswer('0.6', '0.5').correct).toBe(false);
    expect(checkAnswer('0.6', '0.5').method).toBe('math');
    expect(checkAnswer('  Mitochondria! ', 'mitochondria').correct).toBe(true);
    expect(checkAnswer('צָהֳרַיִם', 'צהרים').correct).toBe(true);
    expect(checkAnswer('powerhouse of the cell', 'mitochondria').method).toBe('unsure');
    expect(checkAnswer('seven', '7', ['seven']).correct).toBe(true);
    expect(checkAnswer('', '7').correct).toBe(false);
  });
});
