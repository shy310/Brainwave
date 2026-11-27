import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToolHero } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';
import { Link } from 'react-router';
import { Target } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { linkButton } from '@/features/learn/TopicPage';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureRepo, type StudyLecture } from '@/features/lectures/repo';
import { rate, reviewRepo } from '@/features/lectures/reviews';
import { buildGame, type GameQuestion } from '@/features/game/game';
import { isWeakCard, openMistakes, weakSession, type Mistake } from '@shared/mistakes';
import type { CardState } from '@shared/srs';
import type { Question } from '@shared/learn';
import { loadMistakes, recordQuizAnswer } from './mistakeRepo';

type Item = { kind: 'mistake'; m: Mistake; q: Question } | { kind: 'card'; g: GameQuestion; q: Question };

const cardQuestion = (g: GameQuestion, from: (t: string) => string): Question => ({
  kind: 'choice', prompt: g.prompt, options: g.options, correctIndex: g.correct, answer: g.options[g.correct] ?? '',
  accepted: [], check: '', hint: '', explanation: from(g.from),
});

/** The weak spots: what's on the list, and short practice rounds until they stick. */
export const useWeakSpots = () => {
  const { t, locale } = useI18n();
  const [data, setData] = useState<{ mistakes: Mistake[]; cards: GameQuestion[]; states: Map<string, CardState> } | null>(null);
  const load = useCallback(() => {
    Promise.all([loadMistakes(), lectureRepo.studyMaterial('all'), reviewRepo.list()]).then(([ms, pool, states]) => {
      const title = (l: StudyLecture) => lectureTitle(l, t.lectures.untitled, locale);
      const cards = buildGame(pool, title, Math.random, 500).filter((g) => g.card && isWeakCard(states.get(g.card.key)));
      setData({ mistakes: openMistakes(ms), cards, states });
    }).catch(() => setData({ mistakes: [], cards: [], states: new Map() }));
  }, [t, locale]);
  useEffect(() => {
    load();
    window.addEventListener('bw-mistakes', load);
    return () => window.removeEventListener('bw-mistakes', load);
  }, [load]);
  return data;
};

export default function WeakSpotsPage() {
  const { t } = useI18n();
  const tw = t.weak;
  const data = useWeakSpots();
  const [round, setRound] = useState<Item[] | null>(null);
  const [n, setN] = useState(0);

  const start = () => {
    if (!data) return;
    const items: Item[] = weakSession<Item, Item>(
      data.mistakes.map((m) => ({ kind: 'mistake', m, q: m.question })),
      data.cards.map((g) => ({ kind: 'card', g, q: cardQuestion(g, t.game.from) })),
    );
    setRound(items);
    setN((x) => x + 1);
  };
  const byQuestion = useMemo(() => new Map(round?.map((it) => [it.q, it]) ?? []), [round]);
  const answered = (q: Question, ok: boolean) => {
    const it = byQuestion.get(q);
    if (!it || !data) return;
    if (it.kind === 'mistake') void recordQuizAnswer(q, it.m.lectureId, ok);
    else if (it.g.card) void rate(data.states, it.g.card, ok ? 'good' : 'again');
  };

  if (!data) return <Loading label={t.common.loading} />;
  const total = data.mistakes.length + data.cards.length;

  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <ToolHero tool="practice" back={{ to: '/lectures', label: t.lectures.title }} title={tw.title} subtitle={tw.subtitle} />

      {round ? (
        <QuizRunner key={n} questions={round.map((it) => it.q)} onQuestion={answered}
          resultActions={<>
            <Button onClick={() => { setRound(null); window.dispatchEvent(new Event('bw-mistakes')); }}>{tw.again}</Button>
            <Link to="/lectures" className={cn(linkButton, 'border border-line bg-surface hover:bg-surface-2')}>{tw.done}</Link>
          </>} />
      ) : total === 0 ? (
        <EmptyState icon={Target} body={tw.empty} />
      ) : (
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400"><Target className="size-7" aria-hidden="true" /></span>
          <div className="space-y-1">
            <p className="text-2xl font-semibold">{tw.count(total)}</p>
            <ul className="text-sm text-muted">
              {data.mistakes.length > 0 && <li>{tw.missed(data.mistakes.length)}</li>}
              {data.cards.length > 0 && <li>{tw.cards(data.cards.length)}</li>}
            </ul>
          </div>
          <Button size="lg" onClick={start}>{tw.start}</Button>
        </Card>
      )}
    </div>
  );
}
