import { useEffect, useState } from 'react';
import { MonitorPlay } from 'lucide-react';
import { useT } from '@/i18n';
import { callAi, getApi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Field, Input } from '@/ui/Field';
import { Shimmer } from '@/ui/Feedback';
import { Spinner } from '@/ui/Spinner';
import { MAX_TRANSCRIPT_CHARS } from '@shared/lectures';
import { youtubeId, youtubeUrl, type YoutubeTranscript } from '@shared/youtube';
import { lectureRepo } from './repo';
import type { SourceProps } from './PdfSource';

type Info = { id: string; title: string; channel: string } | { id: string; error: 'unavailable' };

/** A lecture from a YouTube link: paste it, see which video it is, and the AI writes down what's said. */
export const YouTubeSource = ({ title, language, onBusy, onDone }: SourceProps) => {
  const t = useT();
  const ty = t.lectures.yt;
  const toMessage = useAiError();
  const [link, setLink] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [finding, setFinding] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const id = youtubeId(link);

  // Which video is it? (Title and channel, from YouTube.)
  useEffect(() => {
    setError('');
    if (!id) { setInfo(null); return; }
    if (info?.id === id) return;
    const ctl = new AbortController();
    setFinding(true);
    getApi<{ title: string; channel: string }>(`/api/youtube/info?id=${id}`, ctl.signal)
      .then((r) => setInfo({ id, ...r }))
      .catch((err: { status?: number; name?: string }) => {
        if (err?.name === 'AbortError') return;
        setInfo(err?.status === 404 || err?.status === 403 ? { id, error: 'unavailable' } : { id, title: '', channel: '' });
      })
      .finally(() => setFinding(false));
    return () => ctl.abort();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    if (!id || !info || 'error' in info) return;
    setError('');
    setReading(true);
    onBusy(true);
    try {
      const out = await callAi<YoutubeTranscript>('youtubeTranscript', { videoId: id, language });
      if (!out.speech || !out.segments.length) { setError(ty.noSpeech); return; }
      let used = 0;
      const segments = out.segments.filter((s) => (used += s.text.length) <= MAX_TRANSCRIPT_CHARS);
      const lecture = await lectureRepo.create({
        title: title.trim() || info.title, source: 'youtube', language, status: 'ready', segments,
        duration_sec: Math.round((segments.at(-1)?.start ?? 0) + 30), source_url: youtubeUrl(id),
      });
      onDone(lecture.id);
    } catch (err) {
      console.error(err);
      setError(`${toMessage(err) ? `${toMessage(err)} ` : ''}${ty.failed}`);
    } finally {
      setReading(false);
      onBusy(false);
    }
  };

  const bad = link.trim().length > 6 && !id;
  return (
    <div className="space-y-4 border-t border-line pt-5">
      <p className="text-sm text-muted">{ty.hint}</p>
      <Field label={ty.label} error={bad ? ty.bad : undefined}>
        {(fid, describedBy) => <Input id={fid} aria-describedby={describedBy} type="url" inputMode="url" dir="ltr" placeholder={ty.placeholder} value={link} disabled={reading}
          onChange={(e) => setLink(e.target.value)} autoComplete="off" />}
      </Field>

      {finding && <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{ty.finding}</p>}
      {info && !finding && ('error' in info ? <Alert tone="error">{ty.unavailable}</Alert> : (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-2 animate-pop-in">
          <img src={`https://i.ytimg.com/vi/${info.id}/mqdefault.jpg`} alt="" width={128} height={72}
            className="aspect-video w-32 shrink-0 rounded-xl bg-surface-2 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-snug" dir="auto">{info.title || youtubeUrl(info.id)}</p>
            {info.channel && <p className="truncate text-sm text-muted" dir="auto">{ty.by(info.channel)}</p>}
          </div>
        </div>
      ))}

      {error && <Alert tone="error">{error}</Alert>}
      {reading ? (
        <p className="flex items-center gap-2 text-muted" aria-live="polite"><Spinner className="size-5" /><Shimmer text={ty.reading} /></p>
      ) : (
        <Button size="lg" block icon={<MonitorPlay className="size-5" />} disabled={!info || 'error' in info || finding} onClick={() => void make()}>{ty.go}</Button>
      )}
    </div>
  );
};
