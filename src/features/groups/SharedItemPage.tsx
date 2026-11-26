import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Loading } from '@/ui/Wave';
import { Card } from '@/ui/Card';
import { Segmented } from '@/ui/Segmented';
import { BackLink } from '@/features/learn/CoursePage';
import { QuizRunner } from '@/features/learn/QuizRunner';
import { FlashcardDeck } from '@/features/lectures/Flashcards';
import { NotesView } from '@/features/lectures/NotesView';
import { groupsRepo, type Group, type Share } from './groupsRepo';

type Tab = 'notes' | 'cards' | 'quiz';

/** Notes, flashcards and a quiz a group member shared. */
export default function SharedItemPage() {
  const { id = '', shareId = '' } = useParams();
  const { t } = useI18n();
  const tg = t.groups;
  const [item, setItem] = useState<{ group: Group; share: Share } | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('notes');

  useEffect(() => {
    groupsRepo.get(id).then((d) => {
      const share = d?.shares.find((s) => s.id === shareId);
      setItem(d && share ? { group: d.group, share } : null);
      if (share && !share.notes) setTab(share.flashcards ? 'cards' : 'quiz');
    }).catch(() => setItem(null));
  }, [id, shareId]);

  if (item === undefined) return <Loading label={t.common.loading} />;
  if (!item) return <div className="mx-auto max-w-2xl space-y-4"><BackLink to={`/groups/${id}`} label={tg.title} /><Alert tone="error">{tg.notFound}</Alert></div>;

  const { share, group } = item;
  const tabs = (['notes', 'cards', 'quiz'] as const).filter((x) => (x === 'notes' ? share.notes : x === 'cards' ? share.flashcards?.cards.length : share.quiz?.questions.length));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink to={`/groups/${id}`} label={group.name} />
      <header>
        <h1 className="text-3xl font-bold" dir="auto">{share.title}</h1>
        <p className="text-sm text-muted" dir="auto">{share.sharer_name}</p>
      </header>
      {tabs.length > 1 && <Segmented<Tab> label={share.title} value={tab} onChange={setTab} options={tabs.map((x) => ({ value: x, label: tg.tabs[x] }))} />}
      {tab === 'notes' && share.notes && <div className="space-y-4"><NotesView notes={share.notes} /></div>}
      {tab === 'cards' && share.flashcards && <Card className="p-6"><FlashcardDeck deck={share.flashcards} /></Card>}
      {tab === 'quiz' && share.quiz && <QuizRunner questions={share.quiz.questions} />}
    </div>
  );
}
