import { en } from '@/i18n/en';
import { he } from '@/i18n/he';
import { ar } from '@/i18n/ar';
import { ru } from '@/i18n/ru';
import { isRtl, type Locale } from '@shared/locales';
import type { Notes } from '@shared/lectures';

export interface NotesLabels { summary: string; keyTerms: string; reminders: string; practice: string; mistakes: string }

const DICTS = { en, he, ar, ru } as const;

/** The language the notes are written in, from their script (so headings match the text, not the app). */
export const notesLocale = (n: Pick<Notes, 'summary' | 'sections'>, fallback: Locale): Locale => {
  const text = [n.summary, ...n.sections.flatMap((s) => [s.heading, ...s.points])].join(' ');
  const count = (re: RegExp) => text.match(re)?.length ?? 0;
  const scores: [Locale, number][] = [
    ['he', count(/[֐-׿]/g)], ['ar', count(/[؀-ۿ]/g)],
    ['ru', count(/[Ѐ-ӿ]/g)], ['en', count(/[A-Za-z]/g)],
  ];
  const [best, n2] = scores.sort((a, b) => b[1] - a[1])[0];
  return n2 > 0 ? best : fallback;
};

export const notesLabels = (locale: Locale): NotesLabels => {
  const l = DICTS[locale].lectures;
  return { summary: l.summary, keyTerms: l.keyTerms, reminders: l.reminders, practice: l.practice, mistakes: l.mistakes };
};

/** The notes as Markdown, for the .md download. */
export const notesToMarkdown = (title: string, n: Notes, labels: NotesLabels) => [
  `# ${title}`, '', `## ${labels.summary}`, n.summary, '',
  ...n.sections.flatMap((s) => [`## ${s.heading}`, ...s.points.map((p) => `- ${p}`), '']),
  ...(n.keyTerms.length ? [`## ${labels.keyTerms}`, ...n.keyTerms.map((k) => `- **${k.term}** — ${k.definition}`), ''] : []),
  ...(n.practice?.length ? [`## ${labels.practice}`, ...n.practice.map((p, i) => `${i + 1}. ${p.question}\n   ${p.answer}`), ''] : []),
  ...(n.mistakes?.length ? [`## ${labels.mistakes}`, ...n.mistakes.map((m) => `- ${m}`), ''] : []),
  ...(n.reminders.length ? [`## ${labels.reminders}`, ...n.reminders.map((r) => `- ${r}`), ''] : []),
].join('\n');

/** `$y = mx + b$` reads as plain `y = mx + b` once it's outside the app. */
const plain = (s: string) => s.replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

type Block = { heading: string; items: string[]; numbered?: boolean; terms?: boolean } | { heading: string; text: string };

const blocks = (n: Notes, labels: NotesLabels): Block[] => [
  { heading: labels.summary, text: n.summary },
  ...n.sections.map((s) => ({ heading: s.heading, items: s.points })),
  ...(n.keyTerms.length ? [{ heading: labels.keyTerms, terms: true, items: n.keyTerms.map((k) => `${k.term} — ${k.definition}`) }] : []),
  ...(n.practice?.length ? [{ heading: labels.practice, numbered: true, items: n.practice.map((p) => `${p.question}\n${p.answer}`) }] : []),
  ...(n.mistakes?.length ? [{ heading: labels.mistakes, items: n.mistakes }] : []),
  ...(n.reminders.length ? [{ heading: labels.reminders, items: n.reminders }] : []),
];

/** Clean text with no Markdown marks, for chats and plain-text apps. */
export const notesToText = (title: string, n: Notes, labels: NotesLabels) => [
  title, '',
  ...blocks(n, labels).flatMap((b) => [
    b.heading,
    ...('text' in b ? [plain(b.text)] : b.items.map((it, i) => `${b.numbered ? `${i + 1}.` : '•'} ${plain(it).replace(/\n/g, '\n   ')}`)),
    '',
  ]),
].join('\n').trim();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Formatted notes (headings, lists, bold terms) for docs and mail, right-to-left when the notes are. */
export const notesToHtml = (title: string, n: Notes, labels: NotesLabels, locale: Locale) => {
  const dir = isRtl(locale) ? 'rtl' : 'ltr';
  const item = (s: string) => esc(plain(s)).replace(/\n/g, '<br>');
  const term = (k: Notes['keyTerms'][number]) => `<li><strong>${esc(plain(k.term))}</strong> — ${item(k.definition)}</li>`;
  const body = blocks(n, labels).map((b) => {
    const h = `<h2>${esc(b.heading)}</h2>`;
    if ('text' in b) return `${h}<p>${item(b.text)}</p>`;
    const tag = b.numbered ? 'ol' : 'ul';
    const lis = b.terms ? n.keyTerms.map(term).join('') : b.items.map((it) => `<li>${item(it)}</li>`).join('');
    return `${h}<${tag}>${lis}</${tag}>`;
  }).join('');
  return `<div dir="${dir}" lang="${locale}"><h1>${esc(title)}</h1>${body}</div>`;
};

/** Copy as formatted text where the app supports it (pastes nicely in docs), with clean plain text alongside. */
export const copyNotes = async (title: string, n: Notes, fallback: Locale) => {
  const locale = notesLocale(n, fallback);
  const labels = notesLabels(locale);
  const text = notesToText(title, n, labels);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([notesToHtml(title, n, labels, locale)], { type: 'text/html' }),
      })]);
      return;
    } catch { /* fall back to plain text */ }
  }
  await navigator.clipboard.writeText(text);
};
