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
    <Link to={`/exams/${exam.id}`} className="pressable lift flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
      <ReadinessRing value={status.ready} label={te.ready(status.ready)} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{te.title}</span>
        <span className="block truncate font-semibold" dir="auto">{te.banner(exam.title, te.inDays(status.days))}</span>
        <span className="block text-sm text-muted">{status.days === 0 ? te.goodLuck : te.plan}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
};
