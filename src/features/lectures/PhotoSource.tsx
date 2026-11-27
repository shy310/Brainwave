import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Sparkles, X } from '@/ui/icons';
import { useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { MAX_PHOTOS, MAX_TRANSCRIPT_CHARS, type Segment } from '@shared/lectures';
import { mapLimit, photoToDataUrl } from './documents';
import type { SourceProps } from './PdfSource';
import { lectureRepo } from './repo';

interface Photo { id: string; file: File; url: string }

/** A lecture made from photos of a whiteboard, handwritten notes or a textbook. */
export const PhotoSource = ({ title, language, onBusy, onDone, initialFiles }: SourceProps) => {
  const t = useT();
  const toMessage = useAiError();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  /** Text already read, by photo: a retry after an error doesn't pay twice. */
  const done = useRef(new Map<string, string>());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    setError('');
    const room = MAX_PHOTOS - photos.length;
    const picked = [...files].filter((f) => f.type.startsWith('image/'));
    if (picked.length > room) setError(t.lectures.tooManyPhotos(MAX_PHOTOS));
    setPhotos((ps) => [...ps, ...picked.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  };

  useEffect(() => { if (initialFiles?.length) add(initialFiles); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (id: string) => setPhotos((ps) => {
    const p = ps.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    return ps.filter((x) => x.id !== id);
  });

  const make = async () => {
    if (!photos.length) return;
    setError('');
    onBusy(true);
    setProgress({ done: 0, total: photos.length });
    let count = 0;
    try {
      const texts = await mapLimit(photos, 2, async (p) => {
        let text = done.current.get(p.id);
        if (text === undefined) {
          let image: string;
          try { image = await photoToDataUrl(p.file); } catch { throw new Error(t.lectures.photoFailed); }
          text = (await callAi<{ text: string }>('imageText', { image, kind: 'photo', language })).text.trim();
          done.current.set(p.id, text);
        }
        setProgress({ done: ++count, total: photos.length });
        return text;
      });
      let room = MAX_TRANSCRIPT_CHARS;
      const segments: Segment[] = [];
      texts.forEach((text, i) => {
        const cut = text.slice(0, room);
        if (cut.trim()) { segments.push({ start: i + 1, text: cut }); room -= cut.length + 2; }
      });
      if (!segments.length) { setError(t.lectures.photosEmpty); return; }
      const lecture = await lectureRepo.create({ title: title.trim().slice(0, 200), source: 'image', language, segments, status: 'ready' });
      onDone(lecture.id);
    } catch (err) {
      setError(err instanceof Error && err.message === t.lectures.photoFailed ? err.message : toMessage(err) || t.auth.errors.generic);
    } finally {
      setProgress(null);
      onBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-line pt-5">
      <p className="text-sm text-muted">{t.lectures.photoHint}</p>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {error && <Alert tone="error">{error}</Alert>}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p, i) => (
            <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface-2">
              <img src={p.url} alt={t.lectures.photoN(i + 1)} className="size-full object-cover" />
              {!progress && (
                <button type="button" aria-label={t.lectures.removePhoto(i + 1)} onClick={() => remove(p.id)}
                  className="absolute end-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {progress ? (
        <p className="flex items-center gap-2 text-muted" aria-live="polite"><Spinner className="size-5" />{t.lectures.readingPhoto(progress.done, progress.total)}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" variant={photos.length ? 'secondary' : 'primary'} icon={<Camera className="size-5" />} disabled={photos.length >= MAX_PHOTOS} onClick={() => camera.current?.click()}>{t.lectures.takePhoto}</Button>
            <Button size="lg" variant="secondary" icon={<ImagePlus className="size-5" />} disabled={photos.length >= MAX_PHOTOS} onClick={() => gallery.current?.click()}>{t.lectures.choosePhotos}</Button>
          </div>
          {photos.length > 0 && <Button size="lg" block icon={<Sparkles className="size-5" />} onClick={() => void make()}>{t.lectures.makeNotes}</Button>}
        </>
      )}
    </div>
  );
};
