import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/i18n';
import { findTopic } from '@shared/curriculum';
import type { MediaOrigin, MediaSource } from '@shared/media';
import { lectureRepo, transcriptOf } from '@/features/lectures/repo';

export interface ResolvedSource { source: MediaSource; origin: MediaOrigin }

/** Turns `?topic=` or `?lecture=` into a media source; null means "type a request". */
export const useMediaSource = () => {
  const { locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic');
  const lectureId = params.get('lecture');
  const [resolved, setResolved] = useState<ResolvedSource | null>(null);
  const [loading, setLoading] = useState(Boolean(lectureId));

  useEffect(() => {
    setResolved(null);
    if (topicId) {
      const ref = findTopic(topicId);
      if (ref) setResolved({ source: { topicId }, origin: { type: 'topic', ref: topicId, label: ref.topic.title[locale] } });
      return;
    }
    if (!lectureId) return;
    let alive = true;
    setLoading(true);
    lectureRepo.get(lectureId).then((l) => {
      if (!alive || !l) return;
      const transcript = transcriptOf(l);
      const notes = l.notes ? [l.notes.summary, ...l.notes.sections.map((s) => `${s.heading}: ${s.points.join(' ')}`)].join('\n') : '';
      const text = [notes && `Notes:\n${notes}`, `Transcript:\n${transcript}`, l.slides_text && `Slides:\n${l.slides_text}`]
        .filter(Boolean).join('\n\n').slice(0, 80_000);
      const title = l.title || l.notes?.title || 'Lecture';
      if (text.length >= 20) setResolved({ source: { lecture: { title, text } }, origin: { type: 'lecture', ref: l.id, label: title } });
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [topicId, lectureId, locale]);

  return { resolved, loading, clear: () => setParams({}) };
};
