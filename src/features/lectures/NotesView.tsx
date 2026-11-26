import { useState } from 'react';
import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { useI18n, useT } from '@/i18n';
import { findTopic } from '@shared/curriculum';
import { Alert } from '@/ui/Alert';
import { Rich, RichInline } from '@/ui/Rich';
import type { Notes } from '@shared/lectures';

/**
 * Lecture notes as one document: a lead summary, sections, key terms, practice
 * and reminders on a single page that reads like a well-kept notebook. Used on
 * screen, in print and on share links.
 */
export const NotesView = ({ notes }: { notes: Notes }) => {
  const { t, locale } = useI18n();
  const topics = (notes.topics ?? []).map(findTopic).filter((x) => !!x);
  return (
    <>
      <article className="notes-doc px-1 py-2 sm:rounded-[var(--radius-card)] sm:border sm:border-line sm:bg-surface sm:px-10 sm:py-10 sm:shadow-[var(--shadow-soft)] print:border-0 print:p-0 print:shadow-none">
        <div className="mx-auto max-w-[68ch] space-y-9 stagger">
          <section className="break-inside-avoid">
            <h2 className="sr-only">{t.lectures.summary}</h2>
            <div data-block="summary" className="border-s-[3px] border-brand-400 ps-4 text-[1.0625rem] leading-8 text-fg/85 dark:border-brand-500"><Rich text={notes.summary} /></div>
          </section>
          {notes.sections.map((s, i) => (
            <section key={i} className="break-inside-avoid">
              <h2 className="mb-3 text-xl font-semibold tracking-tight" dir="auto">{s.heading}</h2>
              <ul className="notes-points space-y-2.5 leading-7">{s.points.map((p, j) => <li key={j} dir="auto" data-block={`s${i}.${j}`}><RichInline text={p} /></li>)}</ul>
            </section>
          ))}
          {notes.keyTerms.length > 0 && (
            <section className="break-inside-avoid border-t border-line pt-7">
              <h2 className="mb-4 text-xl font-semibold tracking-tight">{t.lectures.keyTerms}</h2>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {notes.keyTerms.map((k, i) => (
                  <div key={i} className="break-inside-avoid">
                    <dt className="font-semibold text-brand-700 dark:text-brand-300" dir="auto"><RichInline text={k.term} /></dt>
                    <dd className="mt-0.5 text-[0.9375rem] leading-6 text-muted" dir="auto" data-block={`k${i}`}><RichInline text={k.definition} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {!!notes.practice?.length && (
            <section className="border-t border-line pt-7">
              <h2 className="mb-1 text-xl font-semibold tracking-tight">{t.lectures.practice}</h2>
              <p className="mb-4 text-sm text-muted print:hidden">{t.lectures.practiceHint}</p>
              <ol className="list-decimal space-y-4 ps-6 marker:font-semibold marker:text-muted">
                {notes.practice.map((p, i) => <PracticeItem key={i} question={p.question} answer={p.answer} />)}
              </ol>
            </section>
          )}
          {!!notes.mistakes?.length && (
            <section className="break-inside-avoid border-t border-line pt-7">
              <h2 className="mb-3 text-xl font-semibold tracking-tight">{t.lectures.mistakes}</h2>
              <ul className="notes-points notes-points-warn space-y-2.5 leading-7">{notes.mistakes.map((m, i) => <li key={i} dir="auto"><RichInline text={m} /></li>)}</ul>
            </section>
          )}
          {notes.reminders.length > 0 && (
            <Alert className="break-inside-avoid">
              <p className="mb-1 font-semibold">{t.lectures.reminders}</p>
              <ul className="list-disc space-y-1 ps-5">{notes.reminders.map((r, i) => <li key={i} dir="auto">{r}</li>)}</ul>
            </Alert>
          )}
        </div>
      </article>
      {topics.length > 0 && (
        <nav aria-label={t.lectures.relatedTopics} className="space-y-2 print:hidden">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><GraduationCap className="size-4" aria-hidden="true" />{t.lectures.relatedTopics}</h2>
          <p className="text-sm text-muted">{t.lectures.relatedTopicsHint}</p>
          <ul className="flex flex-wrap gap-2">
            {topics.map((ref) => (
              <li key={ref.topic.id}>
                <Link to={`/learn/topic/${ref.topic.id}`} className="pressable inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100">
                  {ref.topic.title[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
};

/** One practice question; the answer stays hidden until asked for (always shown in print). */
const PracticeItem = ({ question, answer }: { question: string; answer: string }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <li className="break-inside-avoid" dir="auto">
      <RichInline text={question} />
      <div className="mt-1 print:hidden">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
          {open ? t.lectures.hideAnswer : t.lectures.showAnswer}
        </button>
      </div>
      <div className={open ? 'mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm' : 'hidden print:mt-1 print:block print:text-sm'}>
        <Rich text={answer} />
      </div>
    </li>
  );
};
