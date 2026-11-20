import type { Lecture } from '@/features/lectures/repo';
import type { NewShare } from './groupsRepo';

/**
 * What a group receives when a lecture is shared: a snapshot of its notes,
 * flashcards and quiz. Notes saved in other styles stay private, and the
 * recording and transcript are never shared.
 */
export const lectureShare = (lecture: Lecture, title: string): NewShare => {
  const { other: _other, ...notes } = lecture.notes ?? {};
  return {
    title: title.slice(0, 200),
    notes: lecture.notes ? (notes as NewShare['notes']) : null,
    flashcards: lecture.flashcards,
    quiz: lecture.quiz,
  };
};
