import { describe, expect, it } from 'vitest';
import { notesLabels, notesLocale, notesToHtml, notesToMarkdown, notesToText } from '../../src/features/lectures/notesExport';

const he = {
  title: 'מבוא', summary: 'ההרצאה עסקה בפונקציות לינאריות.',
  sections: [{ heading: 'פונקציות לינאריות', points: ['קו ישר', 'שיפוע $m$'] }],
  keyTerms: [{ term: 'פונקציה לינארית', definition: 'משוואה מהצורה $y = mx + b$' }],
  reminders: [],
} as never;

describe('copying notes', () => {
  it('uses headings in the language the notes are written in, not the app language', () => {
    expect(notesLocale(he, 'en')).toBe('he');
    expect(notesLocale({ summary: 'Лекция о функциях', sections: [] } as never, 'en')).toBe('ru');
    expect(notesLocale({ summary: '', sections: [] } as never, 'ar')).toBe('ar');
    const md = notesToMarkdown('מבוא', he, notesLabels('he'));
    expect(md).toContain('## תקציר');
    expect(md).not.toContain('Summary');
  });

  it('plain text has no Markdown marks or math dollars', () => {
    const text = notesToText('מבוא', he, notesLabels('he'));
    expect(text).not.toMatch(/[#*$]/);
    expect(text).toContain('• פונקציה לינארית — משוואה מהצורה y = mx + b');
    expect(text.split('\n')[0]).toBe('מבוא');
  });

  it('formatted copy is right-to-left for Hebrew, with bold terms and escaped text', () => {
    const html = notesToHtml('<מבוא>', he, notesLabels('he'), 'he');
    expect(html.startsWith('<div dir="rtl" lang="he">')).toBe(true);
    expect(html).toContain('<h1>&lt;מבוא&gt;</h1>');
    expect(html).toContain('<strong>פונקציה לינארית</strong>');
    expect(html).toContain('<li>שיפוע m</li>');
  });
});
