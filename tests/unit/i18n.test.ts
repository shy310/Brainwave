import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

const shape = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object'
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, `${prefix}${k}.`))
    : [prefix.slice(0, -1)];

const leaves = (o: unknown): unknown[] =>
  o && typeof o === 'object' ? Object.values(o as Record<string, unknown>).flatMap(leaves) : [o];

describe('translations', () => {
  it('Hebrew has exactly the same keys as English', () => {
    expect(shape(he).sort()).toEqual(shape(en).sort());
  });
  it('no translation is empty', () => {
    for (const v of [...leaves(en), ...leaves(he)]) {
      if (typeof v === 'string') expect(v.trim().length).toBeGreaterThan(0);
      else expect(typeof v).toBe('function');
    }
  });
  it('Hebrew strings are actually Hebrew', () => {
    expect(he.nav.home).toMatch(/[֐-׿]/);
    expect(he.auth.signIn).toMatch(/[֐-׿]/);
  });
});
