import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupsRepo } from './groupsRepo';

/** An invite link: see the group's name, then join. */
export default function JoinGroupPage() {
  const { code = '' } = useParams();
  const { t } = useI18n();
  const tg = t.groups;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{ name: string; members: number } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => { groupsRepo.preview(code).then(setPreview).catch(() => setPreview(null)); }, [code]);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    try { navigate(`/groups/${await groupsRepo.join(code, profile?.display_name ?? '', user.id)}`, { replace: true }); }
    catch { setPreview(null); setBusy(false); }
  };

  if (preview === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!preview) return <div className="mx-auto max-w-md"><Alert tone="error">{tg.badInvite}</Alert></div>;
  return (
    <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
      <Users className="mx-auto size-10 text-brand-600 dark:text-brand-300" aria-hidden="true" />
      <h1 className="text-2xl font-semibold" dir="auto">{tg.joinTitle(preview.name)}</h1>
      <p className="text-muted">{tg.joinBody(preview.members)}</p>
      <Button size="lg" loading={busy} onClick={() => void join()}>{tg.joinButton}</Button>
    </Card>
  );
}
