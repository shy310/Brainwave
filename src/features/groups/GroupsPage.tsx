import { useEffect, useState, type FormEvent } from 'react';
import { ToolHero } from '@/ui/PageHeader';
import { Loading } from '@/ui/Wave';
import { IconTile } from '@/ui/IconTile';
import { TOOL_META } from '@/ui/tools';
import { Link, useNavigate } from 'react-router';
import { Plus, Users } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupsRepo, type Group } from './groupsRepo';
import { EmptyState } from '@/ui/EmptyState';

/** An invite link (…/join/CODE) or just the code → the code. */
export const inviteCodeFrom = (text: string) => {
  const m = text.trim().match(/(?:\/join\/)?([A-Za-z0-9]{10,32})\/?$/);
  return m ? m[1] : '';
};

export default function GroupsPage() {
  const { t } = useI18n();
  const tg = t.groups;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<(Group & { members: number })[] | null>(null);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { groupsRepo.list().then(setGroups).catch(() => setGroups([])); }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    try { navigate(`/groups/${await groupsRepo.create(name, profile?.display_name ?? '', user.id)}`); }
    catch { setError(t.auth.errors.generic); }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = inviteCodeFrom(invite);
    if (c) navigate(`/join/${c}`); else setError(tg.badInvite);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ToolHero tool="groups" back={{ to: '/lectures', label: t.lectures.title }} title={tg.title} subtitle={tg.subtitle} />
      {error && <Alert tone="error">{error}</Alert>}
      {!groups && <Loading label={t.common.loading} />}
      {groups?.length === 0 && <EmptyState icon={Users} body={tg.empty} />}
      {groups && groups.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id} className="min-w-0">
              <Link to={`/groups/${g.id}`} className="group block rounded-[var(--radius-card)]">
                <Card className="lift flex items-center gap-3.5 p-4">
                  <IconTile icon={Users} tint={TOOL_META.groups.tile} className="tool-tile-hover" />
                  <div className="min-w-0">
                    <p className="truncate font-medium" dir="auto">{g.name}</p>
                    <p className="text-sm text-muted">{tg.members(g.members)}{g.owner_id === user?.id ? ` · ${tg.owner}` : ''}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <Card className="p-4">
          <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label={tg.name} placeholder={tg.namePlaceholder} value={name} maxLength={80} autoFocus dir="auto" onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={!name.trim()}>{tg.make}</Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>{t.common.cancel}</Button>
          </form>
        </Card>
      ) : (
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{tg.create}</Button>
      )}

      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">{tg.join}</h2>
        <form onSubmit={join} className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label={tg.join} placeholder={tg.joinPlaceholder} value={invite} dir="ltr" onChange={(e) => { setInvite(e.target.value); setError(''); }} />
          <Button type="submit" variant="secondary" disabled={!invite.trim()}>{tg.joinGo}</Button>
        </form>
      </Card>
    </div>
  );
}
