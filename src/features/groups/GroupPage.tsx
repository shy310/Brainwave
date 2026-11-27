import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Link2, LogOut, Pencil, RefreshCw, Share2, Trash2, UserMinus, Users } from '@/ui/icons';
import { IconTile } from '@/ui/IconTile';
import { Loading } from '@/ui/Wave';
import { TOOL_META } from '@/ui/tools';
import { useI18n } from '@/i18n';
import { publicUrl } from '@/lib/platform';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, Select } from '@/ui/Field';
import { BackLink } from '@/features/learn/CoursePage';
import { useAuth } from '@/features/auth/AuthProvider';
import { lectureRepo, type Lecture, type LectureSummary } from '@/features/lectures/repo';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureShare } from './share';
import { groupsRepo, type Group, type Member, type Share } from './groupsRepo';
import { dateLocale } from '@shared/locales';
import { EmptyState } from '@/ui/EmptyState';
import { askConfirm } from '@/ui/Confirm';
import { GroupChallenges } from './GroupChallenges';

export default function GroupPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const tg = t.groups;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{ group: Group; members: Member[]; shares: Share[] } | null | undefined>(undefined);
  const [lectures, setLectures] = useState<LectureSummary[]>([]);
  const [pick, setPick] = useState('');
  const [sharing, setSharing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = () => groupsRepo.get(id).then(setData).catch(() => setData(null));
  useEffect(() => { void load(); lectureRepo.list().then(setLectures).catch(() => {}); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Who I am on the group's boards: my id, and the name the group knows me by.
  const myName = data?.members.find((m) => m.user_id === user?.id)?.display_name || profile?.display_name || '';
  const me = useMemo(() => (user ? { id: user.id, name: myName } : null), [user, myName]);

  if (data === undefined) return <Loading label={t.common.loading} />;
  if (!data) return <div className="mx-auto max-w-2xl space-y-4"><BackLink to="/groups" label={tg.title} /><Alert tone="error">{tg.notFound}</Alert></div>;

  const { group, members, shares } = data;
  const isOwner = group.owner_id === user?.id;
  const link = publicUrl(`/join/${group.invite_code}`);
  const date = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short' });
  const run = async (fn: () => Promise<void>) => { setError(''); try { await fn(); } catch { setError(t.auth.errors.generic); } };

  const share = async (e: FormEvent) => {
    e.preventDefault();
    if (!pick || !user) return;
    await run(async () => {
      const l: Lecture | null = await lectureRepo.get(pick);
      if (!l || !(l.notes || l.flashcards || l.quiz)) { setError(tg.nothingToShare); return; }
      await groupsRepo.share(id, lectureShare(l, lectureTitle(l, t.lectures.untitled, locale)), profile?.display_name ?? '', user.id);
      setSharing(false); setPick('');
      await load();
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to="/groups" label={tg.title} />
      <header className="space-y-1">
        {renaming ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await groupsRepo.rename(id, name); setRenaming(false); await load(); }); }}>
            <Input aria-label={tg.name} value={name} maxLength={80} autoFocus dir="auto" onChange={(e) => setName(e.target.value)} />
            <Button type="submit">{t.common.save}</Button>
          </form>
        ) : (
          <div className="flex items-start gap-3">
            <IconTile icon={Users} tint={TOOL_META.groups.tile} size="md" className="mt-0.5" />
            <h1 className="min-w-0 flex-1 text-3xl font-bold leading-tight sm:text-4xl" dir="auto">{group.name}</h1>
            {isOwner && <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={tg.rename} onClick={() => { setName(group.name); setRenaming(true); }}><Pencil className="size-4" aria-hidden="true" /></Button>}
          </div>
        )}
        <p className="ps-[3.75rem] text-sm font-medium text-teal-700 dark:text-teal-300">{tg.members(members.length)}</p>
      </header>
      {error && <Alert tone="error">{error}</Alert>}

      {me && <GroupChallenges groupId={id} shares={shares} members={members} me={me} />}

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">{tg.invite}</h2>
        <p className="text-sm text-muted">{tg.inviteHint}</p>
        <Input readOnly aria-label={tg.invite} value={link} dir="ltr" onFocus={(e) => e.target.select()} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Link2 className="size-4" />} onClick={() => void navigator.clipboard.writeText(link).then(() => setNote(tg.copied), () => {})}>{tg.copy}</Button>
          {typeof navigator.share === 'function' && <Button size="sm" variant="secondary" icon={<Share2 className="size-4" />} onClick={() => void navigator.share({ url: link, title: group.name }).catch(() => {})}>{tg.send}</Button>}
          {isOwner && <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => void run(async () => { await groupsRepo.resetInvite(id); await load(); setNote(tg.newLinkDone); })}>{tg.newLink}</Button>}
        </div>
        {note && <p className="text-sm" role="status">{note}</p>}
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{tg.shared}</h2>
          {!sharing && <Button size="sm" icon={<Share2 className="size-4" />} onClick={() => setSharing(true)}>{tg.shareLecture}</Button>}
        </div>
        {sharing && (
          <Card className="space-y-2 p-4">
            <p className="text-sm text-muted">{tg.shareWhat}</p>
            <form onSubmit={share} className="flex flex-col gap-2 sm:flex-row">
              <Select aria-label={tg.pickLecture} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{tg.pickLecture}</option>
                {lectures.filter((l) => l.status === 'ready').map((l) => <option key={l.id} value={l.id}>{lectureTitle(l, t.lectures.untitled, locale)}</option>)}
              </Select>
              <Button type="submit" disabled={!pick}>{tg.shareIt}</Button>
              <Button variant="secondary" onClick={() => setSharing(false)}>{t.common.cancel}</Button>
            </form>
          </Card>
        )}
        {shares.length === 0 && !sharing && <EmptyState icon={Share2} body={tg.noShares} />}
        <ul className="space-y-2">
          {shares.map((s) => (
            <li key={s.id}>
              <Card className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" dir="auto">{s.title}</p>
                  <p className="text-xs text-muted" dir="auto">{tg.sharedBy(s.sharer_name || '—', date(s.created_at))}</p>
                </div>
                <Link to={`/groups/${id}/s/${s.id}`} className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2">{tg.open}</Link>
                {(s.shared_by === user?.id || isOwner) && (
                  <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`${tg.removeShare}: ${s.title}`} onClick={() => void run(async () => { await groupsRepo.unshare(s.id); await load(); })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{tg.members(members.length)}</h2>
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate" dir="auto">{m.display_name || '—'}{m.user_id === user?.id ? ` (${tg.you})` : ''}</span>
              {m.role === 'owner' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{tg.owner}</span>}
              {isOwner && m.user_id !== user?.id && (
                <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={tg.removeMember(m.display_name)}
                  onClick={() => { void askConfirm({ message: tg.confirmRemoveMember(m.display_name), action: 'remove' }).then((ok) => { if (ok) void run(async () => { await groupsRepo.removeMember(id, m.user_id); await load(); }); }); }}>
                  <UserMinus className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {isOwner ? (
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { void askConfirm({ message: tg.confirmDelete, action: 'delete' }).then((ok) => { if (ok) void run(async () => { await groupsRepo.remove(id); navigate('/groups', { replace: true }); }); }); }}>{tg.deleteGroup}</Button>
        ) : (
          <Button variant="ghost" icon={<LogOut className="size-4 rtl:rotate-180" />} onClick={() => { void askConfirm({ message: tg.confirmLeave, action: 'leave' }).then((ok) => { if (ok) void run(async () => { await groupsRepo.removeMember(id, user!.id); navigate('/groups', { replace: true }); }); }); }}>{tg.leave}</Button>
        )}
      </div>
    </div>
  );
}
