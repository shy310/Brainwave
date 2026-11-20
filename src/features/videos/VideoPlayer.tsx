import { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, ChevronLeft, ChevronRight, Maximize, MessageCircleQuestion, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import type { Locale } from '@shared/locales';
import type { VideoScript } from '@shared/media';
import { splitSentences, useVoices, type Voice } from '@/features/media/speech';
import { primeAudio, useCloudVoices } from '@/features/media/cloudVoice';
import { VOICE_PAIRS } from '@shared/tts';
import { usePlayback, type Unit } from '@/features/media/usePlayback';
import { SceneView } from './SceneView';

const RATES = [0.75, 1, 1.25, 1.5];

interface Props {
  script: VideoScript;
  locale: Locale;
  /** Pause and ask the tutor about the current scene. */
  onAsk?: (sceneIndex: number) => void;
}

export const VideoPlayer = ({ script, locale, onAsk }: Props) => {
  const t = useT();
  const voices = useVoices(locale);
  const cloud = useCloudVoices();
  const [voiceOn, setVoiceOn] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [rate, setRate] = useState(1);
  const [started, setStarted] = useState(false);
  const [voicesChecked, setVoicesChecked] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => { const id = setTimeout(() => setVoicesChecked(true), 1500); return () => clearTimeout(id); }, []);

  const voice: Voice = !voiceOn ? null : cloud ? { cloud: VOICE_PAIRS[locale][0] } : voices[0] ?? null;
  const units = useMemo(() => script.scenes.flatMap((scene, si) => {
    const sentences = splitSentences(scene.narration);
    return sentences.map((text, k) => ({ text, scene: si, k, n: sentences.length, voice, pauseAfter: k === sentences.length - 1 ? 700 : 120 }));
  }), [script, voice]);
  const { index, playing, ended, play, pause, seek, toggle } = usePlayback(units as Unit[], rate);

  const current = units[index];
  const sceneIndex = current?.scene ?? 0;
  const scene = script.scenes[sceneIndex];
  const progress = ended ? 1 : started && current ? (current.k + 1) / current.n : 0;
  const sceneStart = (si: number) => Math.max(0, units.findIndex((u) => u.scene === si));
  const goScene = (si: number) => { if (si >= 0 && si < script.scenes.length) { setStarted(true); seek(sceneStart(si)); } };

  const start = () => { primeAudio(); setStarted(true); play(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); primeAudio(); setStarted(true); toggle(); }
      const forward = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = document.documentElement.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === forward) goScene(sceneIndex + 1);
      if (e.key === back) goScene(sceneIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fullscreen = () => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div ref={frame} className="@container relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#1d1450] to-slate-900 text-white shadow-[var(--shadow-lift)]">
        <div className="pointer-events-none absolute -end-[10cqw] -top-[10cqw] size-[40cqw] rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-[15cqw] -start-[10cqw] size-[40cqw] rounded-full bg-accent-500/15 blur-3xl" aria-hidden="true" />

        <div key={sceneIndex} className="relative h-full animate-fade-in" aria-live="polite">
          {scene && <SceneView scene={scene} progress={progress} />}
        </div>

        {captions && started && current && !ended && (
          <p className="absolute inset-x-[6cqw] bottom-[3cqw] mx-auto w-fit max-w-full rounded-lg bg-black/70 px-[1.5cqw] py-[0.8cqw] text-center text-[2.2cqw] leading-snug" dir="auto">
            {current.text}
          </p>
        )}

        {!started && (
          <button type="button" onClick={start} aria-label={t.videos.play}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/10">
            <span className="flex size-[12cqw] items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-xl">
              <Play className="size-[5cqw] translate-x-[0.4cqw] rtl:-translate-x-[0.4cqw]" aria-hidden="true" />
            </span>
          </button>
        )}

        {ended && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <Button size="lg" icon={<RotateCcw className="size-5" />} onClick={start}>{t.videos.replay}</Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-1" role="group" aria-label={t.videos.scene(sceneIndex + 1, script.scenes.length)}>
          {script.scenes.map((_, i) => (
            <button key={i} type="button" onClick={() => goScene(i)} aria-label={t.videos.scene(i + 1, script.scenes.length)} aria-current={i === sceneIndex}
              className={cn('h-1.5 flex-1 rounded-full transition-colors', i < sceneIndex || ended ? 'bg-brand-500' : i === sceneIndex ? 'bg-brand-400' : 'bg-surface-2 hover:bg-line')} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.videos.prevScene} onClick={() => goScene(sceneIndex - 1)} disabled={sceneIndex === 0}>
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button size="sm" className="size-10 px-0" aria-label={playing ? t.videos.pause : t.videos.play} onClick={() => { primeAudio(); if (started) toggle(); else start(); }}>
            {playing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.videos.nextScene} onClick={() => goScene(sceneIndex + 1)} disabled={sceneIndex >= script.scenes.length - 1}>
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <span className="px-1 text-sm tabular-nums text-muted">{t.videos.scene(sceneIndex + 1, script.scenes.length)}</span>

          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <label className="sr-only" htmlFor="video-rate">{t.videos.speed}</label>
            <select id="video-rate" value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title={t.videos.speed}>
              {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
            </select>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-pressed={captions} aria-label={t.videos.captions} title={t.videos.captions} onClick={() => setCaptions((c) => !c)}>
              <Captions className={cn('size-5', !captions && 'opacity-40')} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-pressed={voiceOn} aria-label={voiceOn ? t.videos.voiceOn : t.videos.voiceOff} title={voiceOn ? t.videos.voiceOn : t.videos.voiceOff}
              onClick={() => setVoiceOn((v) => !v)}>
              {voiceOn ? <Volume2 className="size-5" aria-hidden="true" /> : <VolumeX className="size-5" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={t.videos.fullscreen} title={t.videos.fullscreen} onClick={fullscreen}>
              <Maximize className="size-5" aria-hidden="true" />
            </Button>
            {onAsk && (
              <Button variant="secondary" size="sm" icon={<MessageCircleQuestion className="size-4" />} onClick={() => { pause(); onAsk(sceneIndex); }}>
                {t.videos.ask}
              </Button>
            )}
          </div>
        </div>
        {voicesChecked && voiceOn && !cloud && voices.length === 0 && <p className="text-sm text-muted">{t.videos.noVoice}</p>}
      </div>
    </div>
  );
};
