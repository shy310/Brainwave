import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Trash2, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { ChatPanel } from '@/features/tutor/ChatPanel';
import { mediaRepo, type Media } from '@/features/media/repo';
import type { VideoScript } from '@shared/media';
import { VideoPlayer } from './VideoPlayer';

export default function VideoPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Media<VideoScript> | null | undefined>(undefined);
  const [askScene, setAskScene] = useState<number | null>(null);
  const askRef = useRef<HTMLDivElement>(null);

  useEffect(() => { mediaRepo.get<VideoScript>(id).then(setVideo).catch(() => setVideo(null)); }, [id]);

  const context = useCallback(() => {
    const scenes = video?.script.scenes ?? [];
    const s = scenes[askScene ?? 0];
    return {
      mode: 'explain' as const,
      material: {
        kind: 'video' as const,
        title: video?.title ?? '',
        focus: s ? [s.heading, ...s.items, s.latex, s.narration].filter(Boolean).join('\n') : '',
        text: scenes.map((sc, i) => `Scene ${i + 1} — ${sc.heading}: ${sc.narration}`).join('\n'),
      },
    };
  }, [video, askScene]);

  if (video === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (video === null) return <Alert tone="error">{t.videos.notFound}</Alert>;

  const remove = async () => {
    if (!window.confirm(t.videos.confirmDelete)) return;
    await mediaRepo.remove(id);
    navigate('/videos', { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink to="/videos" label={t.videos.title} />
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" dir="auto">{video.title}</h1>
          <p className="text-sm text-muted" dir="auto">{video.origin.label}</p>
        </div>
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.videos.delete} onClick={remove}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <VideoPlayer script={video.script} locale={video.locale}
        onAsk={(i) => { setAskScene(i); requestAnimationFrame(() => askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} />

      {askScene !== null && (
        <Card ref={askRef} className="space-y-3 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">
              {t.videos.askTitle}: <span className="font-normal text-muted" dir="auto">{video.script.scenes[askScene]?.heading}</span>
            </h2>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.common.close} onClick={() => setAskScene(null)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <ChatPanel sessionKey={`bw.videoChat.${id}.${askScene}`} context={context} emptyTitle={t.videos.askEmpty} starters={t.videos.askStarters} />
        </Card>
      )}
    </div>
  );
}
