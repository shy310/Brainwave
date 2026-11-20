import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { progressRepo, type ProgressMap, type TopicProgress } from './progress';

interface ProgressState {
  progress: ProgressMap;
  loading: boolean;
  markLesson: (topicId: string) => void;
  recordQuiz: (topicId: string, score: number) => void;
  recordPractice: (topicId: string) => void;
}

const Ctx = createContext<ProgressState | null>(null);

export const ProgressProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);
  const ref = useRef(progress);
  ref.current = progress;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    progressRepo.list(user.id)
      .then((p) => { if (alive) setProgress(p); })
      .catch((err) => console.error('Could not load progress', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const apply = useCallback((topicId: string, change: (p: TopicProgress) => TopicProgress) => {
    if (!user) return;
    const before = ref.current[topicId];
    // Show the change right away, then save and keep what the database returns.
    if (before) setProgress((m) => ({ ...m, [topicId]: change(before) }));
    progressRepo.update(user.id, before, topicId, change)
      .then((saved) => setProgress((m) => ({ ...m, [topicId]: saved })))
      .catch((err) => console.error('Could not save progress', err));
  }, [user]);

  const value = useMemo<ProgressState>(() => ({
    progress,
    loading,
    markLesson: (id) => apply(id, (p) => ({ ...p, lesson_done: true })),
    recordQuiz: (id, score) => apply(id, (p) => ({
      ...p, quiz_attempts: p.quiz_attempts + 1, last_score: score, best_score: Math.max(p.best_score, score),
    })),
    recordPractice: (id) => apply(id, (p) => ({ ...p, practiced: p.practiced + 1 })),
  }), [progress, loading, apply]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useProgress = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
};
