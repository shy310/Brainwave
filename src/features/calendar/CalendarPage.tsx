import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ToolHero, heroAction } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';
import { Link } from 'react-router';
import { BookOpen, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, FileUp, GraduationCap, Layers, Plus, Trash2 } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, Select } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { localDay } from '@shared/activity';
import { dateLocale } from '@shared/locales';
import { daysUntil, examPlan, type Exam, type PlanTask } from '@shared/exam';
import type { ClassSlot } from '@shared/schedule';
import { DEADLINE_KINDS, itemsOn, monthGrid, shiftMonth, weekStart, type Deadline, type DeadlineKind } from '@shared/syllabus';
import { examRepo, examLectures } from '@/features/exams/examRepo';
import { useStudyPool } from '@/features/exams/useExamData';
import { scheduleRepo } from '@/features/schedule/scheduleRepo';
import { deadlineRepo } from './deadlineRepo';
import { SyllabusImport } from './SyllabusImport';

interface PlanItem { date: string; exam: Exam; task: PlanTask }

const DOT = { class: 'bg-brand-500', exam: 'bg-rose-500', deadline: 'bg-amber-500', plan: 'bg-emerald-500' } as const;

/**
 * The study calendar: classes, exams, deadlines and each exam's study plan on
 * one month view; tap a day to see what's on and what to study. A syllabus can
 * fill it in.
 */
export default function CalendarPage() {
  const { t, locale } = useI18n();
  const tc = t.calendar;
  const today = localDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [classes, setClasses] = useState<ClassSlot[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[] | null>(null);
  const [sheet, setSheet] = useState<'' | 'import' | 'deadline'>('');
  const { pool, title } = useStudyPool();

  const load = () => {
    void scheduleRepo.list().then(setClasses).catch(() => setClasses([]));
    void examRepo.list().then(setExams).catch(() => setExams([]));
    void deadlineRepo.list().then(setDeadlines).catch(() => setDeadlines([]));
  };
  useEffect(load, []);

  // Every upcoming exam's day-by-day plan, so study tasks show on their days.
  // (Only exams that have lectures to study get a plan.)
  const plan = useMemo<PlanItem[]>(() => (exams && pool ? exams.filter((e) => daysUntil(e.date, today) > 0).flatMap((exam) => {
    const ids = examLectures(exam, pool).map((l) => l.id);
    return ids.length ? examPlan(ids, today, exam.date).flatMap((d) => d.tasks.map((task) => ({ date: d.date, exam, task }))) : [];
  }) : []), [exams, pool, today]);

  if (!classes || !exams || !deadlines) return <Loading label={t.common.loading} />;

  const all = { classes, exams, deadlines, plan };
  const first = weekStart(locale);
  const grid = monthGrid(month, first);
  const lang = dateLocale(locale);
  const monthName = new Date(`${month}-15T12:00:00`).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  const weekdayNames = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + ((first + i) % 7))).toLocaleDateString(lang, { weekday: 'narrow', timeZone: 'UTC' }));
  const selected = itemsOn(day, all);
  const lectureName = new Map((pool ?? []).map((l) => [l.id, title(l)]));
  const nothing = !selected.classes.length && !selected.exams.length && !selected.deadlines.length && !selected.plan.length;

  const toggleDone = (d: Deadline) => {
    setDeadlines((all) => all?.map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)) ?? null);
    void deadlineRepo.update(d.id, { done: !d.done }).catch(() => {});
  };
  const removeDeadline = (d: Deadline) => {
    setDeadlines((all) => all?.filter((x) => x.id !== d.id) ?? null);
    void deadlineRepo.remove(d.id).catch(() => {});
  };

  const row = 'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2';
  const icon = 'flex size-8 shrink-0 items-center justify-center rounded-[10px]';
  const taskLabel = (p: PlanItem) => p.task.kind === 'learn'
    ? tc.learn(p.task.lectureIds.map((id) => lectureName.get(id) ?? '').filter(Boolean).join(', '))
    : p.task.kind === 'review' ? tc.review : tc.practice;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ToolHero tool="calendar" back={{ to: '/lectures', label: t.lectures.title }} title={tc.title} subtitle={tc.subtitle} actions={(
        <>
          <button type="button" className={heroAction('calendar')} onClick={() => setSheet('import')}><FileUp className="size-4" aria-hidden="true" />{tc.syllabus.open}</button>
          <button type="button" className={heroAction('calendar', 'secondary')} onClick={() => setSheet('deadline')}><Plus className="size-4" aria-hidden="true" />{tc.addDeadline}</button>
          <Link to="/lectures/schedule" className={heroAction('calendar', 'secondary')}><CalendarClock className="size-4" aria-hidden="true" />{tc.classTimes}</Link>
        </>
      )} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-1">
            <h2 className="flex-1 px-2 text-lg font-semibold capitalize" aria-live="polite">{monthName}</h2>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={tc.prev} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" onClick={() => { setMonth(today.slice(0, 7)); setDay(today); }}>{tc.today}</Button>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={tc.next} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" /></Button>
          </div>
          <div role="grid" aria-label={monthName} className="grid grid-cols-7 gap-1 text-center">
            {weekdayNames.map((w, i) => <div key={i} role="columnheader" className="pb-1 text-xs font-semibold text-muted">{w}</div>)}
            {grid.map((d) => {
              const items = itemsOn(d, all);
              // Daily flashcard review isn't marked (it would be every day); learning and practice are.
              const dots = [items.classes.length && 'class', items.exams.length && 'exam', items.deadlines.some((x) => !x.done) && 'deadline', items.plan.some((p) => p.task.kind !== 'review') && 'plan'].filter(Boolean) as (keyof typeof DOT)[];
              const label = new Date(`${d}T12:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <button key={d} type="button" role="gridcell" aria-selected={d === day} aria-current={d === today ? 'date' : undefined}
                  aria-label={dots.length ? `${label}: ${dots.map((x) => tc.kinds[x]).join(', ')}` : label}
                  onClick={() => setDay(d)}
                  className={cn('pressable flex aspect-square min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors sm:aspect-[4/3]',
                    d.slice(0, 7) !== month && 'text-muted/60',
                    d === day ? 'bg-brand-600 font-semibold text-white' : d === today ? 'font-semibold text-brand-700 ring-2 ring-brand-500/40 dark:text-brand-300' : 'hover:bg-surface-2')}>
                  <span className="tabular-nums">{Number(d.slice(8))}</span>
                  <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                    {dots.map((x) => <span key={x} className={cn('size-1.5 rounded-full', d === day ? 'bg-white' : DOT[x])} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-muted" aria-hidden="true">
            {(Object.keys(DOT) as (keyof typeof DOT)[]).map((k) => <li key={k} className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', DOT[k])} />{tc.kinds[k]}</li>)}
          </ul>
        </Card>

        <section aria-labelledby="calendar-day" className="space-y-2">
          <h2 id="calendar-day" className="px-1 font-semibold">
            {day === today ? tc.today : new Date(`${day}T12:00:00`).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <Card key={day} className="space-y-0.5 p-2 animate-tab-in">
            {nothing && <p className="px-3 py-6 text-center text-sm text-muted">{classes.length + exams.length + deadlines.length ? tc.free : tc.empty}</p>}
            {selected.exams.map((e) => (
              <Link key={e.id} to={`/exams/${e.id}`} className={cn(row, 'pressable hover:bg-surface-2')}>
                <span className={cn(icon, 'bg-rose-500/12 text-rose-600 dark:text-rose-300')}><GraduationCap className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold" dir="auto">{e.title}</span>
              </Link>
            ))}
            {selected.classes.map((c) => (
              <div key={c.id} className={row}>
                <span className={cn(icon, 'bg-brand-500/10 text-brand-700 dark:text-brand-300')}><CalendarClock className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-medium" dir="auto">{c.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{c.starts}–{c.ends}</span>
              </div>
            ))}
            {selected.deadlines.map((d) => (
              <div key={d.id} className={cn(row, 'group')}>
                <input type="checkbox" checked={d.done} onChange={() => toggleDone(d)} aria-label={tc.done(d.title)} className="size-5 shrink-0 accent-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', d.done && 'text-muted line-through')} dir="auto">{d.title}</span>
                  <span className="block text-xs text-muted" dir="auto">{tc.kindsOf[d.kind]}{d.course ? ` · ${d.course}` : ''}</span>
                </span>
                <button type="button" onClick={() => removeDeadline(d)} aria-label={tc.remove(d.title)}
                  className="flex size-8 items-center justify-center rounded-full text-muted opacity-60 hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {selected.plan.map((p, i) => (
              <Link key={i} to={`/exams/${p.exam.id}`} className={cn(row, 'pressable hover:bg-surface-2')}>
                <span className={cn(icon, 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300')}>
                  {p.task.kind === 'learn' ? <BookOpen className="size-4" aria-hidden="true" /> : p.task.kind === 'review' ? <Layers className="size-4" aria-hidden="true" /> : <ClipboardList className="size-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium" dir="auto">{taskLabel(p)}</span>
                  <span className="block text-xs text-muted" dir="auto">{tc.for(p.exam.title)}</span>
                </span>
              </Link>
            ))}
          </Card>
        </section>
      </div>

      <SyllabusImport open={sheet === 'import'} onClose={() => setSheet('')}
        onAdded={(firstDate) => { setSheet(''); load(); if (firstDate) { setMonth(firstDate.slice(0, 7)); setDay(firstDate); } }} />
      <DeadlineSheet open={sheet === 'deadline'} day={day < today ? today : day} onClose={() => setSheet('')}
        onSave={async (d) => { const [saved] = await deadlineRepo.create([d]); setDeadlines((all) => [...(all ?? []), saved].sort((a, b) => a.date.localeCompare(b.date))); setSheet(''); setMonth(d.date.slice(0, 7)); setDay(d.date); }} />
    </div>
  );
}

/** Add one deadline by hand. */
const DeadlineSheet = ({ open, day, onClose, onSave }: { open: boolean; day: string; onClose: () => void; onSave: (d: Omit<Deadline, 'id' | 'done'>) => Promise<void> }) => {
  const { t } = useI18n();
  const tc = t.calendar;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(day);
  const [kind, setKind] = useState<DeadlineKind>('assignment');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setTitle(''); setDate(day); setKind('assignment'); } }, [open, day]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    try { await onSave({ title: title.trim().slice(0, 160), date, kind, course: null }); } finally { setSaving(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={tc.addDeadline}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-medium">{tc.what}</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={tc.whatPlaceholder} dir="auto" autoFocus /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1"><span className="text-sm font-medium">{tc.due}</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">{tc.kind}</span>
            <Select value={kind} onChange={(e) => setKind(e.target.value as DeadlineKind)}>
              {DEADLINE_KINDS.map((k) => <option key={k} value={k}>{tc.kindsOf[k]}</option>)}
            </Select></label>
        </div>
        <Button type="submit" size="lg" block loading={saving} disabled={!title.trim()}>{tc.save}</Button>
      </form>
    </Sheet>
  );
};

