import { useEffect, useState } from 'react';
import { ToolHero, heroAction } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';
import { Link } from 'react-router';
import { CalendarClock, ChevronRight, Plus } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/ui/EmptyState';
import { dateLocale } from '@shared/locales';
import type { Exam } from '@shared/exam';
import { examRepo } from './examRepo';
import { ExamSheet } from './ExamSheet';
import { ReadinessRing } from './ReadinessRing';
import { examStatus, useStudyPool } from './useExamData';

/** Every exam, the nearest first, with how many days are left and how ready the student is. */
export default function ExamsPage() {
  const { t, locale } = useI18n();
  const te = t.exams;
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [adding, setAdding] = useState(false);
  const { pool, states, title } = useStudyPool();
  useEffect(() => { examRepo.list().then(setExams).catch(() => setExams([])); }, []);

  const rows = exams && pool ? exams.map((e) => ({ e, s: examStatus(e, pool, states, title) })) : null;
  const upcoming = rows?.filter((r) => r.s.days >= 0) ?? [];
  const past = rows?.filter((r) => r.s.days < 0).reverse() ?? [];

  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <ToolHero tool="exams" back={{ to: '/lectures', label: t.lectures.title }} title={te.title} subtitle={te.subtitle}
        actions={<button type="button" className={heroAction('exams')} onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden="true" />{te.add}</button>} />

      {!rows && <Loading label={t.common.loading} />}
      {rows && rows.length === 0 && <EmptyState icon={CalendarClock} body={te.empty} />}

      {[upcoming, past].map((list, i) => list.length > 0 && (
        <ul key={i} className={cn('space-y-3', i === 1 && 'opacity-70')}>
          {list.map(({ e, s }) => (
            <li key={e.id}>
              <Link to={`/exams/${e.id}`}
                className="pressable lift flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
                {/* A tear-off calendar leaf with the exam's day. */}
                <span className="flex w-14 shrink-0 flex-col overflow-hidden rounded-xl border border-accent-300 bg-surface text-center shadow-[var(--shadow-soft)] dark:border-accent-600/40" aria-hidden="true">
                  <span className="bg-accent-400 py-0.5 text-[11px] font-bold text-brand-950">{new Date(`${e.date}T12:00:00`).toLocaleDateString(dateLocale(locale), { month: 'short' })}</span>
                  <span className="py-1 font-display text-2xl font-bold leading-none tabular-nums">{new Date(`${e.date}T12:00:00`).getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-bold" dir="auto">{e.title}</span>
                  <span className="block text-sm text-muted">
                    {new Date(`${e.date}T12:00:00`).toLocaleDateString(dateLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{te.lectures(s.lectures.length)}
                    <span className="sm:hidden">{' · '}{s.days < 0 ? te.done : te.inDays(s.days)}</span>
                  </span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold max-sm:hidden',
                  s.days < 0 ? 'bg-surface-2 text-muted' : s.days <= 3 ? 'bg-accent-400 text-brand-950' : 'bg-brand-500/12 text-brand-700 dark:text-brand-300')}>
                  {s.days < 0 ? te.done : te.inDays(s.days)}
                </span>
                <ReadinessRing value={s.ready} label={te.ready(s.ready)} />
                <ChevronRight className="size-5 shrink-0 text-muted max-sm:hidden rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ))}

      {pool && (
        <ExamSheet key={adding ? 'open' : 'closed'} open={adding} onClose={() => setAdding(false)} pool={pool} title={title}
          onSave={async (n) => { const e = await examRepo.create(n); setExams((all) => [...(all ?? []), e].sort((a, b) => a.date.localeCompare(b.date))); }} />
      )}
    </div>
  );
}
