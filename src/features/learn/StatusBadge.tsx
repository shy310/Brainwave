import { CheckCircle2, Circle, CircleDashed } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import type { TopicStatus } from './progress';

const STYLE: Record<TopicStatus, string> = {
  new: 'text-muted',
  learning: 'text-amber-600 dark:text-amber-400',
  mastered: 'text-emerald-600 dark:text-emerald-400',
};

export const StatusIcon = ({ status, className }: { status: TopicStatus; className?: string }) => {
  const t = useT();
  const Icon = status === 'mastered' ? CheckCircle2 : status === 'learning' ? CircleDashed : Circle;
  return <Icon className={cn('size-5 shrink-0', STYLE[status], className)} aria-label={t.learn.status[status]} role="img" />;
};

export const StatusText = ({ status }: { status: TopicStatus }) => {
  const t = useT();
  return <span className={cn('inline-flex items-center gap-1 text-sm font-medium', STYLE[status])}><StatusIcon status={status} className="size-4" />{t.learn.status[status]}</span>;
};
