import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, Layers, Mic, NotebookText, Target, Timer } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { StudyPath, type PathStep } from '@/ui/StudyPath';
import { TOOL_META } from '@/ui/tools';
import { Mascot } from '@/ui/Mascot';
import { DAILY_MINUTES, dailyGoals, localDay, type DayActivity } from '@shared/activity';
import { nextExam, type Exam } from '@shared/exam';
import { findTopic } from '@shared/curriculum';
import type { LectureSummary } from '@/features/lectures/repo';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { useWeakSpots } from '@/features/weak/WeakSpotsPage';
import { examRepo } from '@/features/exams/examRepo';
import { useExamStatus } from '@/features/exams/useExamData';
import { useProgress } from '@/features/learn/ProgressProvider';
import { topicStatus } from '@/features/learn/progress';

/**
 * Today's path: the day's real study steps in order, from what you have.
 * Review the cards that are due, pick up your latest lecture, practise weak
 * spots, follow your exam plan, study for 10 minutes and add a lecture. Steps
 * you've finished today come first (they're behind you); the first one left is
 * "now". Nothing here is invented: a step only appears when its data exists.
 */
export const TodayPath = ({ days, due, latest, showWave = true }: { days: DayActivity[]; due: number; latest: LectureSummary | undefined; showWave?: boolean }) => {
  const { t, locale } = useI18n();
  const td = t.home.daily;
  const today = days.find((d) => d.day === localDay());
  const { goals } = dailyGoals(today, due);
  const done = (id: string) => goals.find((g) => g.id === id)?.done ?? false;

  const weak = useWeakSpots();
  const weakTotal = weak ? weak.mistakes.length + weak.cards.length : 0;
  const [exam, setExam] = useState<Exam | null>(null);
  useEffect(() => {
    examRepo.list().then((all) => {
      const e = nextExam(all, localDay());
      setExam(e && Date.parse(e.date) - Date.parse(localDay()) <= 31 * 86_400_000 ? e : null);
    }).catch(() => setExam(null));
  }, []);
  const status = useExamStatus(exam);
  const { progress } = useProgress();
  const learning = useMemo(() => Object.values(progress)
    .filter((p) => topicStatus(p) === 'learning' && findTopic(p.topic_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0], [progress]);

  type Draft = Omit<PathStep, 'state' | 'status'> & { done: boolean };
  const steps: Draft[] = [];
  const add = (s: Omit<Draft, 'done'>, isDone: boolean) => { steps.push({ ...s, done: isDone }); };

  if (due > 0 || (today?.cards ?? 0) > 0) {
    add({ key: 'review', to: '/lectures/review', icon: Layers, tint: TOOL_META.review.tile,
      title: due > 0 ? t.home.hero.review(due) : td.review, sub: due > 0 ? t.home.hero.reviewBody(Math.max(1, Math.ceil(due / 4))) : td.caughtUp }, due === 0);
  }
  if (latest) {
    add({ key: 'lecture-open', to: `/lectures/${latest.id}`, icon: NotebookText, tint: TOOL_META.lectures.tile,
      title: lectureTitle(latest, t.lectures.untitled, locale), sub: t.home.hero.continueTitle }, false);
  }
  if (weakTotal > 0) {
    add({ key: 'weak', to: '/practice', icon: Target, tint: TOOL_META.practice.tile, title: t.weak.home, sub: t.weak.count(weakTotal) }, false);
  }
  if (exam && status && status.days >= 0) {
    add({ key: 'exam', to: `/exams/${exam.id}`, icon: CalendarClock, tint: TOOL_META.exams.tile,
      title: t.exams.banner(exam.title, t.exams.inDays(status.days)), sub: t.exams.plan }, false);
  }
  const minutes = Math.min(DAILY_MINUTES, today?.minutes ?? 0);
  const topic = learning ? findTopic(learning.topic_id) : null;
  add({ key: 'minutes', to: topic ? `/learn/topic/${topic.topic.id}` : '/learn', icon: topic ? BookOpen : Timer, tint: TOOL_META.learn.tile,
    title: td.minutes(DAILY_MINUTES), sub: topic ? `${td.minutesSoFar(minutes, DAILY_MINUTES)} · ${topic.topic.title[locale]}` : td.minutesSoFar(minutes, DAILY_MINUTES) }, done('minutes'));
  add({ key: 'add-lecture', to: '/lectures/new', icon: Mic, tint: TOOL_META.lectures.tile, title: td.lecture, sub: td.lectureHint }, done('lecture'));

  // Finished steps first, then the rest in order; the first one left is "now".
  const ordered = [...steps.filter((s) => s.done), ...steps.filter((s) => !s.done)];
  const firstLeft = ordered.findIndex((s) => !s.done);
  const path: PathStep[] = ordered.map(({ done: d, ...s }, i) => ({
    ...s, state: d ? 'done' : i === firstLeft ? 'now' : 'todo',
    status: d ? t.home.goalDone : i === firstLeft ? t.home.nextUp : t.home.goalTodo,
  }));

  return (
    <section aria-labelledby="path-title" className="space-y-5">
      <h2 id="path-title" className="font-display text-2xl font-bold">{t.home.nextUp}</h2>
      {firstLeft < 0 && (
        // Everything on the path is done today.
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-emerald-50 p-4 dark:bg-emerald-900/25">
          <Mascot mood="celebrating" size={72} className="shrink-0" />
          <p className="font-display text-lg font-bold">{td.caughtUp}</p>
        </div>
      )}
      <StudyPath steps={path} label={t.home.nextUp} showWave={showWave} />
    </section>
  );
};
