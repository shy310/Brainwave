import { Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { Card } from '@/ui/Card';
import type { Dict } from '@/i18n/en';

/** Placeholder for pillars that arrive in later releases. */
export const ComingSoon = ({ title, body }: { title: (t: Dict) => string; body: (t: Dict) => string }) => {
  const t = useT();
  return (
    <Card className="mx-auto max-w-xl p-8 text-center animate-fade-up">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
        <Sparkles className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold">{title(t)}</h1>
      <p className="mt-2 text-muted">{body(t)}</p>
      <p className="mt-4 inline-block rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-muted">{t.common.comingSoon}</p>
    </Card>
  );
};

export const PodcastsSoon = () => <ComingSoon title={t => t.home.podcastsTitle} body={t => t.home.podcastsBody} />;
