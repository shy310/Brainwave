import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureRepo, type StudyLecture } from '@/features/lectures/repo';
import { buildGame, shuffle, type GameQuestion } from './game';

/**
 * The questions for a game, from the lectures in a folder. `next()` deals them
 * in a shuffled order and starts over when they run out, so a long game never
 * runs dry.
 */
export const useDeck = (folder: string) => {
  const { t, locale } = useI18n();
  const [pool, setPool] = useState<StudyLecture[] | null>(null);
  useEffect(() => { lectureRepo.studyMaterial(folder).then(setPool).catch(() => setPool([])); }, [folder]);
  const title = useCallback((l: StudyLecture) => lectureTitle(l, t.lectures.untitled, locale), [t, locale]);
  const deck = useMemo<GameQuestion[]>(() => (pool ? buildGame(pool, title, Math.random, 500) : []), [pool, title]);
  const order = useRef<number[]>([]);

  const next = useCallback((): number => {
    if (!order.current.length) order.current = shuffle(deck.map((_, i) => i), Math.random);
    return order.current.shift()!;
  }, [deck]);
  const reset = useCallback(() => { order.current = []; }, []);

  return { loading: !pool, deck, next, reset };
};
