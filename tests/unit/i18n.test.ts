import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';
import { ar } from '../../src/i18n/ar';
import { ru } from '../../src/i18n/ru';
import { dateLocale, isRtl, localeFromBrowser, LOCALES } from '../../shared/locales';
import { COURSES } from '../../shared/curriculumData';

const shape = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object'
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, `${prefix}${k}.`))
    : [prefix.slice(0, -1)];

const leaves = (o: unknown): unknown[] =>
  o && typeof o === 'object' ? Object.values(o as Record<string, unknown>).flatMap(leaves) : [o];

const SCRIPT = { he: /[֐-׿]/, ar: /[؀-ۿ]/, ru: /[Ѐ-ӿ]/ };

describe('translations', () => {
  for (const [name, dict] of [['Hebrew', he], ['Arabic', ar], ['Russian', ru]] as const) {
    it(`${name} has exactly the same keys as English`, () => {
      expect(shape(dict).sort()).toEqual(shape(en).sort());
    });
  }
  it('no translation is empty', () => {
    for (const v of [...leaves(en), ...leaves(he), ...leaves(ar), ...leaves(ru)]) {
      if (typeof v === 'string') expect(v.trim().length).toBeGreaterThan(0);
      else expect(typeof v).toBe('function');
    }
  });
  it('each language is written in its own script', () => {
    for (const [dict, script] of [[he, SCRIPT.he], [ar, SCRIPT.ar], [ru, SCRIPT.ru]] as const) {
      expect(dict.nav.home).toMatch(script);
      expect(dict.auth.signIn).toMatch(script);
      expect(dict.lectures.keepRecording.title).toMatch(script);
    }
  });
  it('Russian counts use the right word form', () => {
    expect(ru.learn.topics(1)).toBe('1 тема');
    expect(ru.learn.topics(3)).toBe('3 темы');
    expect(ru.learn.topics(5)).toBe('5 тем');
    expect(ru.learn.topics(11)).toBe('11 тем');
    expect(ru.learn.topics(21)).toBe('21 тема');
    expect(ru.learn.topics(22)).toBe('22 темы');
    expect(ru.groups.members(14)).toBe('14 участников');
  });
  it('Arabic counts use singular, dual and plural forms', () => {
    expect(ar.learn.topics(1)).toBe('موضوع واحد');
    expect(ar.learn.topics(2)).toBe('موضوعان');
    expect(ar.learn.topics(4)).toBe('4 مواضيع');
    expect(ar.learn.topics(15)).toBe('15 موضوعًا');
  });
});

describe('languages', () => {
  it('Hebrew and Arabic read right to left', () => {
    expect(LOCALES.filter(isRtl)).toEqual(['he', 'ar']);
  });
  it('picks the app language from the browser', () => {
    expect(localeFromBrowser('ar-EG')).toBe('ar');
    expect(localeFromBrowser('ru-RU')).toBe('ru');
    expect(localeFromBrowser('iw')).toBe('he');
    expect(localeFromBrowser('fr-FR')).toBe('en');
    expect(localeFromBrowser(undefined)).toBe('en');
  });
  it('writes Arabic dates with Western digits', () => {
    const d = new Date(2026, 10, 21);
    expect(d.toLocaleDateString(dateLocale('ar'), { day: 'numeric', month: 'long' })).toMatch(/21/);
    expect(d.toLocaleDateString(dateLocale('ru'), { day: 'numeric', month: 'long' })).toBe('21 ноября');
  });
  it('every course title and description is translated', () => {
    for (const c of COURSES) for (const u of c.units) {
      expect(u.title.ar).toMatch(SCRIPT.ar);
      expect(u.title.ru).toMatch(SCRIPT.ru);
      for (const t of u.topics) {
        for (const text of [t.title, t.description]) {
          expect(text.ar.length).toBeGreaterThan(0);
          expect(text.ru.length).toBeGreaterThan(0);
        }
        expect(t.description.ar).toMatch(SCRIPT.ar);
        expect(t.description.ru).toMatch(SCRIPT.ru);
      }
    }
  });
});
