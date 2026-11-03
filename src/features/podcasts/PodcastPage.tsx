import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Download, Trash2, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { ChatPanel } from '@/features/tutor/ChatPanel';
import { mediaRepo, type Media } from '@/features/media/repo';
import type { PodcastScript } from '@shared/media';
import { PodcastPlayer } from './PodcastPlayer';

const scriptText = (p: PodcastScript) =>
  p.lines.map((l) => `${l.chapter ? `\n## ${l.chapter}\n` : ''}${p.hosts[l.speaker]?.name}: ${l.text}`).join('\n').trim();

export default function PodcastPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<Media<PodcastScript> | null | undefined>(undefined);
  const [askLine, setAskLine] = useState<number | null>(null);
  const askRef = useRef<HTMLDivElement>(null);

  useEffect(() => { mediaRepo.get<PodcastScript>(id).then(setEpisode).catch(() => setEpisode(null)); }, [id]);

  const context = useCallback(() => {
    const p = episode?.script;
    const i = askLine ?? 0;
    const name = (s: number) => p?.hosts[s]?.name ?? '';
    return {
      mode: 'explain' as const,
      material: {
        kind: 'podcast' as const,
        title: episode?.title ?? '',
        focus: (p?.lines.slice(Math.max(0, i - 2), i + 1) ?? []).map((l) => `${name(l.speaker)}: ${l.text}`).join('\n'),
        text: p ? scriptText(p).slice(0, 80_000) : '',
      },
    };
  }, [episode, askLine]);

  if (episode === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (episode === null) return <Alert tone="error">{t.podcasts.notFound}</Alert>;

  const remove = async () => {
    if (!window.confirm(t.podcasts.confirmDelete)) return;
    await mediaRepo.remove(id);
    navigate('/podcasts', { replace: true });
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([`# ${episode.title}\n\n${scriptText(episode.script)}\n`], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${episode.title}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink to="/podcasts" label={t.podcasts.title} />
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" dir="auto">{episode.title}</h1>
          <p className="text-sm text-muted" dir="auto">{episode.origin.label}</p>
        </div>
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.podcasts.downloadScript} title={t.podcasts.downloadScript} onClick={download}>
          <Download className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.podcasts.delete} onClick={remove}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </header>

      {askLine !== null && (
        <Card ref={askRef} className="space-y-3 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold">{t.podcasts.askTitle}</h2>
              <p className="line-clamp-2 text-sm text-muted" dir="auto">{episode.script.lines[askLine]?.text}</p>
            </div>
            <Button variant="ghost" size="sm" className="size-9 shrink-0 px-0" aria-label={t.common.close} onClick={() => setAskLine(null)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <ChatPanel sessionKey={`bw.podcastChat.${id}.${askLine}`} context={context} emptyTitle={t.podcasts.askEmpty} starters={t.podcasts.askStarters} />
        </Card>
      )}

      <PodcastPlayer script={episode.script} locale={episode.locale} title={episode.title}
        onAsk={(i) => { setAskLine(i); requestAnimationFrame(() => askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} />
    </div>
  );
}
