import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Segmented } from '@/ui/Segmented';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { MAX_SLIDES_CHARS, MAX_TRANSCRIPT_CHARS, type Flashcards } from '@shared/lectures';
import type { Quiz } from '@shared/learn';
import { FlashcardDeck } from './Flashcards';
import { folderRepo, type Folder } from './folders';
import { lectureTitle } from './LecturesPage';
import { lectureRepo, transcriptOf, type StudyLecture } from './repo';

type Tab = 'cards' | 'quiz';
interface Last { cards?: { knew: number; total: number }; quiz?: { score: number } }

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const QUIZ_ROUND = 12;

/** Flashcards and a quiz drawn from every lecture in a folder. */
export default function StudyFolderPage() {
  const { t, locale } = useI18n();
  const ts = t.lectures.study;
  const toMessage = useAiError();
  const [params] = useSearchParams();
  const folder = params.get('folder') ?? 'all';
  const lastKey = `bw.study.${folder}`;
  const [lectures, setLectures] = useState<StudyLecture[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tab, setTab] = useState<Tab>('cards');
  const [round, setRound] = useState(0);
  const [making, setMaking] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [last, setLast] = useState<Last>(() => { try { return JSON.parse(storage.get(lastKey) ?? '{}') as Last; } catch { return {}; } });

  useEffect(() => {
    Promise.all([lectureRepo.studyMaterial(folder), folderRepo.list()])
      .then(([l, f]) => { setLectures(l); setFolders(f); })
      .catch(() => { setLectures([]); setError(t.auth.errors.generic); });
  }, [folder, t]);

  const remember = (patch: Last) => {
    const next = { ...last, ...patch };
    setLast(next);
    storage.set(lastKey, JSON.stringify(next));
  };

  const name = folder === 'all' ? ts.allLectures : folder === 'none' ? t.lectures.library.unfiled : folders.find((f) => f.id === folder)?.name ?? '';
  const titleOf = (l: StudyLecture) => lectureTitle(l, t.lectures.untitled, locale);

  const deck = useMemo(() => {
    const items = (lectures ?? []).flatMap((l) => (l.flashcards?.cards ?? []).map((card) => ({ card, from: titleOf(l) })));
    return { deck: { cards: items.map((i) => i.card) } as Flashcards, labels: items.map((i) => i.from), lectures: (lectures ?? []).filter((l) => l.flashcards?.cards.length).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectures, locale]);

  const quiz = useMemo(() => {
    const all = (lectures ?? []).flatMap((l) => l.quiz?.questions ?? []);
    return { questions: shuffle(all).slice(0, QUIZ_ROUND), total: all.length, lectures: (lectures ?? []).filter((l) => l.quiz?.questions.length).length };
    // `round` draws a new set of questions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectures, round]);

  const missing = (lectures ?? []).filter((l) => (tab === 'cards' ? !l.flashcards?.cards.length : !l.quiz?.questions.length));

  /** Make flashcards or a quiz for every lecture in the folder that has none. */
  const makeMissing = async () => {
    const todo = missing;
    setError('');
    setMaking({ done: 0, total: todo.length });
    for (const [i, item] of todo.entries()) {
      try {
        const full = await lectureRepo.get(item.id);
        if (!full) continue;
        const transcript = transcriptOf(full);
        if (transcript.length < 20) continue;
        const input = { transcript: transcript.slice(0, MAX_TRANSCRIPT_CHARS), slides: full.slides_text?.slice(0, MAX_SLIDES_CHARS) || undefined, title: full.title || undefined };
        if (tab === 'cards') {
          const flashcards = await callAi<Flashcards>('flashcards', { ...input, count: 15 });
          await lectureRepo.update(item.id, { flashcards });
          setLectures((ls) => ls?.map((l) => (l.id === item.id ? { ...l, flashcards } : l)) ?? null);
        } else {
          const q = await callAi<Quiz>('lectureQuiz', { ...input, count: 6 });
          await lectureRepo.update(item.id, { quiz: q });
          setLectures((ls) => ls?.map((l) => (l.id === item.id ? { ...l, quiz: q } : l)) ?? null);
        }
      } catch (err) {
        setError(toMessage(err) || t.auth.errors.generic);
        break;
      }
      setMaking({ done: i + 1, total: todo.length });
    }
    setMaking(null);
  };

  if (!lectures) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight" dir="auto">{ts.title(name)}</h1>
        {(last.cards || last.quiz) && (
          <p className="text-sm text-muted">
            {ts.lastTime}: {[last.cards && ts.lastCards(last.cards.knew, last.cards.total), last.quiz && ts.lastQuiz(last.quiz.score)].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      {lectures.length === 0 ? <Alert>{ts.nothing}</Alert> : (
        <>
          <Segmented<Tab> label={ts.title(name)} value={tab} onChange={(v) => { setTab(v); setError(''); }}
            options={[{ value: 'cards', label: ts.cards }, { value: 'quiz', label: ts.quiz }]} />

          {error && <Alert tone="error">{error}</Alert>}

          {missing.length > 0 && (
            <Alert>
              <p>{tab === 'cards' ? ts.missingCards(missing.length) : ts.missingQuiz(missing.length)}</p>
              {making
                ? <p className="mt-2 flex items-center gap-2"><Spinner className="size-4" />{ts.making(making.done, making.total)}</p>
                : <Button size="sm" className="mt-2" icon={<Sparkles className="size-4" />} onClick={() => void makeMissing()}>{ts.makeMissing}</Button>}
            </Alert>
          )}

          {tab === 'cards' && deck.deck.cards.length > 0 && (
            <Card className="space-y-3 p-6">
              <p className="text-sm text-muted">{ts.cardsFrom(deck.deck.cards.length, deck.lectures)}</p>
              <FlashcardDeck deck={deck.deck} labels={deck.labels} onFinish={(knew, total) => remember({ cards: { knew, total } })} />
            </Card>
          )}

          {tab === 'quiz' && quiz.questions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">{ts.questionsFrom(Math.min(QUIZ_ROUND, quiz.total), quiz.lectures)}</p>
              <QuizRunner key={round} questions={quiz.questions} onFinish={(score) => remember({ quiz: { score } })}
                resultActions={<Button onClick={() => setRound((r) => r + 1)}>{ts.newRound}</Button>} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
