import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { localDay } from '@shared/activity';
import { daysUntil, readiness, type Exam } from '@shared/exam';
import type { CardState } from '@shared/srs';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureRepo, type StudyLecture } from '@/features/lectures/repo';
import { reviewCards, reviewRepo } from '@/features/lectures/reviews';
import { examLectures } from './examRepo';

/** Everything an exam needs from the study data: its lectures, flashcard knowledge, readiness. */
export const useStudyPool = () => {
  const { t, locale } = useI18n();
  const [pool, setPool] = useState<StudyLecture[] | null>(null);
  const [states, setStates] = useState<Map<string, CardState>>(new Map());
  useEffect(() => {
    Promise.all([lectureRepo.studyMaterial('all'), reviewRepo.list()])
      .then(([p, s]) => { setPool(p); setStates(s); })
      .catch(() => setPool([]));
  }, []);
  const title = useCallback((l: Pick<StudyLecture, 'title' | 'created_at'>) => lectureTitle(l, t.lectures.untitled, locale), [t, locale]);
  return { pool, states, title };
};

export const examStatus = (exam: Exam, pool: StudyLecture[], states: Map<string, CardState>, title: (l: StudyLecture) => string, today = localDay()) => {
  const lectures = examLectures(exam, pool);
  const cards = reviewCards(lectures, title);
  const known = cards.filter((c) => (states.get(c.key)?.box ?? 0) >= 2).length;
  return { lectures, cards: cards.length, known, ready: readiness(cards.length, known, exam.bestScore), days: daysUntil(exam.date, today) };
};

export const useExamStatus = (exam: Exam | null | undefined) => {
  const { pool, states, title } = useStudyPool();
  return useMemo(() => (exam && pool ? { ...examStatus(exam, pool, states, title), pool, title } : null), [exam, pool, states, title]);
};
