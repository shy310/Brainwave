import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Check, Gamepad2, Sparkles, Trophy, X } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { Segmented } from '@/ui/Segmented';
import { RichInline } from '@/ui/Rich';
import { DrawCheck } from '@/ui/Feedback';
import { buildGame } from '@/features/game/game';
import type { StudyLecture } from '@/features/lectures/repo';
import { dailyIndex, medal, rankBoard, utcDay, type BoardRow } from '@shared/challenge';
import type { Member, Share } from './groupsRepo';
import { answerDaily, loadBoard, loadDaily, type DailyAnswer, type Game } from './challenges';

// A fixed "random" order, so every member builds the very same questions.
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** The group's question of the day and this week's game leaderboard. */
export const GroupChallenges = ({ groupId, shares, members, me }: { groupId: string; shares: Share[]; members: Member[]; me: { id: string; name: string } }) => {
  const { t } = useI18n();
  const tc = t.groups.challenge;
  const [board, setBoard] = useState<Record<Game, BoardRow[]> | null>(null);
  const [daily, setDaily] = useState<DailyAnswer[] | null>(null);
  const [game, setGame] = useState<Game>('glide');
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    loadBoard(groupId, me).then(setBoard).catch(() => setBoard({ glide: [], rush: [] }));
    loadDaily(groupId, me).then(setDaily).catch(() => setDaily([]));
  }, [groupId, me]);

  // The question of the day: the same pick from the group's shared quizzes and flashcards for everyone.
  const question = useMemo(() => {
    const pool = shares.map((s) => ({ id: s.id, title: s.title, flashcards: s.flashcards, quiz: s.quiz, created_at: s.created_at, status: 'ready', folder_id: null }) as StudyLecture);
    const all = buildGame([...pool].sort((a, b) => a.id.localeCompare(b.id)), (l) => l.title, seeded(7), 1000);
    const i = dailyIndex(groupId, utcDay(), all.length);
    return i >= 0 ? all[i] : null;
  }, [shares, groupId]);

  const mine = daily?.find((a) => a.userId === me.id);
  const answer = async (i: number) => {
    if (!question || mine || picked !== null) return;
    setPicked(i);
    const correct = i === question.correct;
    await answerDaily(groupId, correct).catch(() => {});
    setDaily((d) => [...(d ?? []), { userId: me.id, name: me.name, correct }]);
  };
  const shownPick = picked ?? (mine ? (mine.correct ? question?.correct ?? -1 : -1) : null);
  const ranked = board ? rankBoard(board[game], me.id) : [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-accent-600 dark:text-accent-300" aria-hidden="true" />{tc.daily}</h2>
          <p className="text-sm text-muted">{tc.dailyHint}</p>
        </div>
        {!question ? <p className="text-sm text-muted">{tc.noQuestion}</p> : (
          <>
            <p className="font-semibold" dir="auto"><RichInline text={question.prompt} /></p>
            <div className="grid gap-2" role="group" aria-label={tc.daily}>
              {question.options.map((o, i) => {
                const done = shownPick !== null;
                const right = done && i === question.correct;
                const wrongPick = done && picked === i && i !== question.correct;
                return (
                  <button key={i} type="button" disabled={done} onClick={() => void answer(i)}
                    className={cn('pressable flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-start text-sm transition-colors',
                      !done && 'border-line hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30',
                      right && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                      wrongPick && 'animate-shake border-rose-400 bg-rose-50 dark:bg-rose-950/40',
                      done && !right && !wrongPick && 'border-line opacity-50')}>
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold', right ? 'bg-emerald-500 text-white' : 'bg-surface-2')}>
                      {right ? <DrawCheck className="size-3.5" /> : String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1" dir="auto"><RichInline text={o} /></span>
                  </button>
                );
              })}
            </div>
            {daily && daily.length > 0 && (
              <div className="space-y-1.5 border-t border-line pt-3" aria-live="polite">
                <p className="text-sm font-medium">{tc.answered(daily.length, members.length)}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {daily.map((a) => (
                    <li key={a.userId} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                      a.correct ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/12 text-rose-700 dark:text-rose-300')}>
                      {a.correct ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                      <span dir="auto">{a.name || '—'}{a.userId === me.id ? ` (${tc.you})` : ''}</span>
                      <span className="sr-only">: {a.correct ? tc.gotIt : tc.missed}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-semibold"><Trophy className="size-4 text-accent-600 dark:text-accent-300" aria-hidden="true" />{tc.board}</h2>
            <p className="text-sm text-muted">{tc.boardHint}</p>
          </div>
        </div>
        <Segmented<Game> label={tc.board} value={game} onChange={setGame} fill
          options={[{ value: 'glide', label: t.game.glide.name }, { value: 'rush', label: t.game.rush.name }]} />
        {board && !ranked.length && <p className="text-sm text-muted">{tc.noScores}</p>}
        {ranked.length > 0 && (
          <ol className="space-y-1" aria-label={`${tc.board}: ${t.game[game].name}`}>
            {ranked.map((r) => (
              <li key={r.userId} className={cn('flex items-center gap-3 rounded-xl px-3 py-2', r.you ? 'bg-brand-500/10 font-semibold' : 'bg-surface-2/60')}>
                <span className="w-7 shrink-0 text-center tabular-nums">{medal(r.rank) || r.rank}</span>
                <span className="min-w-0 flex-1 truncate" dir="auto">{r.name || '—'}{r.you ? ` (${tc.you})` : ''}</span>
                <span className="shrink-0 tabular-nums">{r.best}</span>
              </li>
            ))}
          </ol>
        )}
        <Link to="/play?folder=all" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          <Gamepad2 className="size-4" aria-hidden="true" />{tc.play}
        </Link>
      </Card>
    </div>
  );
};
