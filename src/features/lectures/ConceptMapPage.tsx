import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Maximize, Minus, Network, Plus, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { useHideTabBar } from '@/app/chrome';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RichInline } from '@/ui/Rich';
import { Segmented } from '@/ui/Segmented';
import { Shimmer } from '@/ui/Feedback';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { layoutMap, type ConceptMap } from '@shared/conceptMap';
import { lectureRepo, transcriptOf, type Lecture } from './repo';
import { lectureTitle } from './LecturesPage';

const PAD = 120;
const MIN_SCALE = 0.35, MAX_SCALE = 2.5;
const size = (kind: string, label: string) => {
  const w = Math.min(kind === 'main' ? 210 : 180, Math.max(kind === 'detail' ? 96 : 110, label.length * (kind === 'main' ? 9 : 8) + 28));
  return { w, h: kind === 'main' ? 64 : kind === 'detail' ? 44 : 52 };
};

/** The lecture's notes (or transcript) as plain text for the AI. */
const sourceText = (l: Lecture) => {
  const n = l.notes;
  if (n) return [n.summary, ...n.sections.flatMap((s) => [s.heading, ...s.points.map((p) => `- ${p}`)]), ...n.keyTerms.map((k) => `${k.term}: ${k.definition}`)].join('\n');
  return transcriptOf(l);
};

/** A drawn map of a lecture's ideas: pan, zoom, tap an idea to see its links; or read it as a list. */
export default function ConceptMapPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const tm = t.lectures.map;
  const toMessage = useAiError();
  useHideTabBar();
  const [lecture, setLecture] = useState<Lecture | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { lectureRepo.get(id).then(setLecture).catch(() => setLecture(null)); }, [id]);

  const make = async () => {
    if (!lecture) return;
    setBusy(true);
    setError('');
    try {
      const map = await callAi<ConceptMap>('conceptMap', { title: lecture.title || undefined, text: sourceText(lecture).slice(0, 30_000) });
      setLecture({ ...lecture, concept_map: map });
      setSelected(null);
      await lectureRepo.update(lecture.id, { concept_map: map }).catch((err) => console.error(err));
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
    } finally { setBusy(false); }
  };

  if (lecture === undefined) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;
  if (!lecture) return <Alert tone="error">{t.lectures.notFound}</Alert>;
  const title = lectureTitle(lecture, t.lectures.untitled, locale);
  const map = lecture.concept_map;
  const canMake = sourceText(lecture).trim().length >= 20;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackLink to={`/lectures/${id}`} label={title} />
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{tm.title}</h1>
          <p className="text-muted">{tm.body}</p>
        </div>
        {map && <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} loading={busy} onClick={() => void make()}>{tm.redo}</Button>}
      </header>
      {error && <Alert tone="error">{error}</Alert>}

      {!map && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-700 dark:text-brand-300"><Network className="size-7" aria-hidden="true" /></span>
          {busy ? <Shimmer text={tm.making} /> : canMake
            ? <Button size="lg" onClick={() => void make()}>{tm.make}</Button>
            : <p className="text-muted">{tm.needsText}</p>}
        </Card>
      )}

      {map && (
        <>
          <Segmented<'map' | 'list'> label={tm.title} value={view} onChange={setView}
            options={[{ value: 'map', label: tm.title }, { value: 'list', label: tm.list }]} />
          {view === 'map'
            ? <MapView map={map} title={title} selected={selected} onSelect={setSelected} busy={busy} />
            : <MapList map={map} />}
        </>
      )}
    </div>
  );
}

const MapView = ({ map, title, selected, onSelect, busy }: { map: ConceptMap; title: string; selected: string | null; onSelect: (id: string | null) => void; busy: boolean }) => {
  const { t } = useI18n();
  const tm = t.lectures.map;
  const placed = useMemo(() => new Map(layoutMap(map).map((p) => [p.id, p])), [map]);
  const box = useMemo(() => {
    const xs = [...placed.values()].map((p) => p.x), ys = [...placed.values()].map((p) => p.y);
    return { x: Math.min(...xs) - PAD, y: Math.min(...ys) - PAD, w: Math.max(...xs) - Math.min(...xs) + PAD * 2, h: Math.max(...ys) - Math.min(...ys) + PAD * 2 };
  }, [placed]);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);
  const moved = useRef(false);

  const zoom = (f: number) => setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * f)) }));
  const linked = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    for (const e of map.edges) { if (e.from === selected) s.add(e.to); if (e.to === selected) s.add(e.from); }
    return s;
  }, [selected, map]);

  // Wheel zooms the map (not the page).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)));
      setView((v) => ({ ...v, scale }));
      moved.current = true;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    // Only a real drag takes over the pointer, so a tap still reaches the idea under it.
    if (!moved.current && Math.abs(dx) + Math.abs(dy) > 3) {
      moved.current = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (!moved.current) return;
    const k = (svg.current?.viewBox.baseVal.width ?? 1) / (svg.current?.clientWidth || 1) / view.scale;
    setView((v) => ({ ...v, x: v.x + dx * k, y: v.y + dy * k }));
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };

  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const transform = `translate(${cx + view.x} ${cy + view.y}) scale(${view.scale}) translate(${-cx} ${-cy})`;
  const node = selected ? map.nodes.find((n) => n.id === selected) : null;

  return (
    <div className="space-y-3">
      <div className={cn('relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]', busy && 'opacity-60')}>
        <svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block h-[min(70dvh,640px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          role="img" aria-label={tm.diagram(title)} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onClick={(e) => { if (!moved.current && e.target === e.currentTarget) onSelect(null); }}>
          <g transform={transform}>
            {map.edges.map((e, i) => {
              const a = placed.get(e.from), b = placed.get(e.to);
              if (!a || !b) return null;
              const on = !linked || (linked.has(e.from) && linked.has(e.to) && (e.from === selected || e.to === selected));
              return (
                <g key={i} className={cn('transition-opacity duration-200', !on && 'opacity-15')}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-brand-300)" strokeWidth={2} />
                  {e.label && (
                    <foreignObject x={(a.x + b.x) / 2 - 60} y={(a.y + b.y) / 2 - 11} width={120} height={22} className="pointer-events-none overflow-visible">
                      <div className="mx-auto w-fit max-w-[120px] truncate rounded-full bg-bg px-1.5 text-center text-[11px] leading-[22px] text-muted" dir="auto">{e.label}</div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {map.nodes.map((n) => {
              const p = placed.get(n.id);
              if (!p) return null;
              const { w, h } = size(n.kind, n.label);
              const on = !linked || linked.has(n.id);
              return (
                <foreignObject key={n.id} x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} className={cn('overflow-visible transition-opacity duration-200', !on && 'opacity-25')}>
                  <button type="button" onClick={() => { if (!moved.current) onSelect(selected === n.id ? null : n.id); }} aria-pressed={selected === n.id}
                    className={cn('flex size-full items-center justify-center rounded-2xl border-2 px-2 text-center leading-tight shadow-sm transition-transform active:scale-95',
                      n.kind === 'main' ? 'border-brand-700 bg-brand-600 text-base font-bold text-white'
                        : n.kind === 'detail' ? 'border-line bg-surface-2 text-xs font-medium'
                          : 'border-brand-300 bg-surface text-sm font-semibold dark:border-brand-700',
                      selected === n.id && 'ring-4 ring-accent-400')}>
                    <span className="line-clamp-2" dir="auto"><RichInline text={n.label} /></span>
                  </button>
                </foreignObject>
              );
            })}
          </g>
        </svg>
        <div className="absolute bottom-3 end-3 flex flex-col gap-1.5">
          {[{ icon: Plus, label: tm.zoomIn, act: () => zoom(1.25) }, { icon: Minus, label: tm.zoomOut, act: () => zoom(0.8) }, { icon: Maximize, label: tm.reset, act: () => setView({ scale: 1, x: 0, y: 0 }) }].map((b) => (
            <button key={b.label} type="button" onClick={b.act} aria-label={b.label} title={b.label}
              className="flex size-10 items-center justify-center rounded-full border border-line bg-surface/95 shadow-sm backdrop-blur hover:bg-surface-2">
              <b.icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      {node && (
        <Card className="space-y-2 p-4 animate-pop-in" aria-live="polite">
          <h2 className="font-semibold" dir="auto"><RichInline text={node.label} /></h2>
          {node.note && <p className="text-sm text-muted" dir="auto"><RichInline text={node.note} /></p>}
          <LinkChips map={map} id={node.id} onSelect={onSelect} />
        </Card>
      )}
    </div>
  );
};

const LinkChips = ({ map, id, onSelect }: { map: ConceptMap; id: string; onSelect?: (id: string) => void }) => {
  const { t } = useI18n();
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const links = map.edges.filter((e) => e.from === id || e.to === id);
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">{t.lectures.map.links}:</span>
      {links.map((e, i) => {
        const other = byId.get(e.from === id ? e.to : e.from);
        if (!other) return null;
        const body = <><span dir="auto"><RichInline text={other.label} /></span>{e.label && <span className="text-muted" dir="auto"> · {e.label}</span>}</>;
        return onSelect
          ? <button key={i} type="button" onClick={() => onSelect(other.id)} className="rounded-full bg-surface-2 px-2.5 py-0.5 hover:bg-line">{body}</button>
          : <span key={i} className="rounded-full bg-surface-2 px-2.5 py-0.5">{body}</span>;
      })}
    </div>
  );
};

/** The same map as a list: the main idea, then each idea with what it links to. */
const MapList = ({ map }: { map: ConceptMap }) => {
  const order = { main: 0, concept: 1, detail: 2 } as const;
  return (
    <Card className="p-4">
      <ul className="space-y-3">
        {[...map.nodes].sort((a, b) => order[a.kind] - order[b.kind]).map((n) => (
          <li key={n.id} className="space-y-1">
            <p className={cn(n.kind === 'main' ? 'text-lg font-bold' : 'font-semibold')} dir="auto"><RichInline text={n.label} /></p>
            {n.note && <p className="text-sm text-muted" dir="auto"><RichInline text={n.note} /></p>}
            <LinkChips map={map} id={n.id} />
          </li>
        ))}
      </ul>
    </Card>
  );
};
