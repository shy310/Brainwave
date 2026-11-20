import { describe, expect, it } from 'vitest';
import { nextDaily } from '../../src/features/schedule/notify';

describe('daily study reminder', () => {
  it('fires later today, or tomorrow once the time has passed', () => {
    expect(nextDaily('19:00', new Date(2026, 10, 20, 9, 0))).toEqual(new Date(2026, 10, 20, 19, 0));
    expect(nextDaily('19:00', new Date(2026, 10, 20, 19, 0))).toEqual(new Date(2026, 10, 21, 19, 0));
    expect(nextDaily('07:30', new Date(2026, 11, 31, 23, 0))).toEqual(new Date(2027, 0, 1, 7, 30));
  });
});
