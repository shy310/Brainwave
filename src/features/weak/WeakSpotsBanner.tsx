import { Link } from 'react-router';
import { ChevronRight, Target } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useWeakSpots } from './WeakSpotsPage';

/** On Home, when there's something to practise: the weak spots and how many. */
export const WeakSpotsBanner = () => {
  const { t } = useI18n();
  const data = useWeakSpots();
  const total = data ? data.mistakes.length + data.cards.length : 0;
  if (!total) return null;
  return (
    <Link to="/practice" className="pressable lift flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400"><Target className="size-6" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t.weak.home}</span>
        <span className="block text-sm text-muted">{t.weak.count(total)}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
};
