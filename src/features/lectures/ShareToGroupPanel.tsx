import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Users } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupsRepo, type Group } from '@/features/groups/groupsRepo';
import { lectureShare } from '@/features/groups/share';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Select } from '@/ui/Field';
import { Spinner } from '@/ui/Spinner';
import { lectureTitle } from './LecturesPage';
import type { Lecture } from './repo';

/** Share this lecture's notes, flashcards and quiz with one of the student's study groups. */
export const ShareToGroupPanel = ({ lecture }: { lecture: Lecture }) => {
  const { t, locale } = useI18n();
  const ts = t.lectures.shareGroup;
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Group | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    groupsRepo.list().then((g) => { setGroups(g); if (g.length === 1) setPick(g[0].id); }).catch(() => setGroups([]));
  }, []);

  const share = async (e: FormEvent) => {
    e.preventDefault();
    const group = groups?.find((g) => g.id === pick);
    if (!group || !user) return;
    setBusy(true); setError(false); setDone(null);
    try {
      await groupsRepo.share(group.id, lectureShare(lecture, lectureTitle(lecture, t.lectures.untitled, locale)), profile?.display_name ?? '', user.id);
      setDone(group);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">{ts.title}</h3>
      <p className="text-sm text-muted">{ts.body}</p>
      {!groups ? <Spinner className="size-5 text-muted" /> : groups.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{ts.none}</p>
          <Link to="/groups" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
            <Users className="size-4" aria-hidden="true" />{ts.create}
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => void share(e)}>
          <Select aria-label={ts.pick} value={pick} onChange={(e) => { setPick(e.target.value); setDone(null); }} className="min-w-0 sm:max-w-sm sm:flex-1">
            <option value="" disabled>{ts.pick}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Button type="submit" size="md" loading={busy} disabled={!pick} icon={<Users className="size-4" />} className="self-start">{ts.share}</Button>
        </form>
      )}
      {done && (
        <p className="flex flex-wrap items-center gap-2 text-sm" role="status">
          {ts.done(done.name)}
          <Link to={`/groups/${done.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{ts.open}</Link>
        </p>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{ts.failed}</p>}
    </Card>
  );
};
