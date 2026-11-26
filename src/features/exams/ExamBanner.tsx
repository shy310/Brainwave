import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { localDay } from '@shared/activity';
import { nextExam, type Exam } from '@shared/exam';
import { examRepo } from './examRepo';
import { ReadinessRing } from './ReadinessRing';
import { useExamStatus } from './useExamData';

/** On Home: the next exam (within a month), its countdown and readiness. */
export const ExamBanner = () => {
  const { t } = useI18n();
  const te = t.exams;
  const [exam, setExam] = useState<Exam | null>(null);
  useEffect(() => {
    examRepo.list().then((all) => {
      const e = nextExam(all, localDay());
      setExam(e && Date.parse(e.date) - Date.parse(localDay()) <= 31 * 86_400_000 ? e : null);
    }).catch(() => setExam(null));
  }, []);
  const status = useExamStatus(exam);
  if (!exam || !status) return null;
  return (
    // The exam's sunshine: a warm card that reads as "the big day" without shouting.
    <Link to={`/exams/${exam.id}`} className="pressable lift flex items-center gap-4 rounded-[var(--radius-card)] border border-accent-300 bg-accent-200/70 p-4 shadow-[var(--shadow-soft)] dark:border-accent-600/40 dark:bg-accent-600/15">
      <ReadinessRing value={status.ready} label={te.ready(status.ready)} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{te.title}: </span>
        <span className="block truncate font-display text-lg font-bold leading-tight" dir="auto">{te.banner(exam.title, te.inDays(status.days))}</span>
        <span className="mt-0.5 block text-sm font-medium text-accent-600 dark:text-accent-300">{status.days === 0 ? te.goodLuck : te.plan}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-accent-600 rtl:rotate-180 dark:text-accent-300" aria-hidden="true" />
    </Link>
  );
};
