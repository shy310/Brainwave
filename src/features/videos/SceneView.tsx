import { useMemo } from 'react';
import katex from 'katex';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { RichInline } from '@/ui/Rich';
import { cn } from '@/lib/cn';
import { samplePlot } from '@shared/math/plot';
import type { Scene } from '@shared/media';

/** How many list items are visible, given how far the narration of this scene has got (0–1). */
export const visibleItems = (count: number, progress: number) => Math.max(1, Math.min(count, Math.ceil(progress * count)));

const Item = ({ shown, children, className }: { shown: boolean; children: React.ReactNode; className?: string }) => (
  <div className={cn('transition-all duration-500', shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0', className)} aria-hidden={!shown}>
    {children}
  </div>
);

const Graph = ({ fn, xMin, xMax }: { fn: string; xMin: number; xMax: number }) => {
  const { paths, yMin, yMax } = useMemo(() => {
    const lines = samplePlot(fn, xMin, xMax);
    const ys = lines.flat().map((p) => p.y);
    let lo = Math.min(...ys, 0), hi = Math.max(...ys, 0);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1;
    lo -= pad; hi += pad;
    const W = 160, H = 90;
    const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const sy = (y: number) => H - ((y - lo) / (hi - lo)) * H;
    return {
      yMin: lo, yMax: hi,
      paths: lines.map((l) => l.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')),
    };
  }, [fn, xMin, xMax]);
  const W = 160, H = 90;
  const x0 = ((0 - xMin) / (xMax - xMin)) * W;
  const y0 = H - ((0 - yMin) / (yMax - yMin)) * H;
  return (
    <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className="h-full w-full" role="img" aria-label={`y = ${fn}`}>
      {[...Array(9)].map((_, i) => <line key={`v${i}`} x1={(i * W) / 8} x2={(i * W) / 8} y1={0} y2={H} className="stroke-white/10" strokeWidth={0.3} />)}
      {[...Array(5)].map((_, i) => <line key={`h${i}`} y1={(i * H) / 4} y2={(i * H) / 4} x1={0} x2={W} className="stroke-white/10" strokeWidth={0.3} />)}
      {x0 >= 0 && x0 <= W && <line x1={x0} x2={x0} y1={0} y2={H} className="stroke-white/50" strokeWidth={0.5} />}
      {y0 >= 0 && y0 <= H && <line y1={y0} y2={y0} x1={0} x2={W} className="stroke-white/50" strokeWidth={0.5} />}
      <text x={2} y={H - 2} className="fill-white/60" fontSize={4}>{xMin}</text>
      <text x={W - 2} y={H - 2} textAnchor="end" className="fill-white/60" fontSize={4}>{xMax}</text>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" className="stroke-accent-400 [animation:draw_2.4s_ease-out_forwards]" strokeWidth={1.4}
          strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1} />
      ))}
    </svg>
  );
};

const Equation = ({ latex }: { latex: string }) => {
  const html = useMemo(() => katex.renderToString(latex, { displayMode: true, throwOnError: false, strict: 'ignore', trust: false }), [latex]);
  return <div dir="ltr" className="max-w-full overflow-x-auto overflow-y-hidden text-[4.5cqw] animate-fade-up" dangerouslySetInnerHTML={{ __html: html }} />;
};

/** One animated video scene. Drawn on a 16:9 stage; sizes scale with the stage. */
export const SceneView = ({ scene, progress }: { scene: Scene; progress: number }) => {
  const shown = visibleItems(scene.items.length, progress);
  const heading = scene.heading && (
    <h3 className={cn('font-semibold tracking-tight animate-fade-up', scene.kind === 'title' ? 'text-[6.5cqw] leading-tight' : 'text-[4cqw]')} dir="auto">
      <RichInline text={scene.heading} />
    </h3>
  );

  switch (scene.kind) {
    case 'title':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[2cqw] px-[8cqw] text-center">
          {heading}
          {scene.items[0] && <p className="text-[2.6cqw] text-white/75 animate-fade-up [animation-delay:300ms]" dir="auto"><RichInline text={scene.items[0]} /></p>}
        </div>
      );
    case 'equation':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[3cqw] px-[6cqw] text-center">
          {heading}
          <Equation latex={scene.latex} />
          {scene.items[0] && <p className="text-[2.4cqw] text-white/75" dir="auto"><RichInline text={scene.items[0]} /></p>}
        </div>
      );
    case 'graph':
      return (
        <div className="flex h-full flex-col gap-[1.5cqw] px-[6cqw] py-[5cqw]">
          {heading}
          <p className="text-[2.4cqw] text-white/70" dir="ltr">y = {scene.fn}</p>
          <div className="min-h-0 flex-1" dir="ltr"><Graph fn={scene.fn} xMin={scene.xMin} xMax={scene.xMax} /></div>
        </div>
      );
    case 'flow':
      return (
        <div className="flex h-full flex-col justify-center gap-[4cqw] px-[6cqw]">
          {heading}
          <div className="flex items-center justify-center gap-[1.5cqw]">
            {scene.items.map((it, i) => (
              <div key={i} className="flex items-center gap-[1.5cqw]">
                {i > 0 && <Item shown={i < shown}><ArrowRight className="size-[3.5cqw] text-accent-400 rtl:rotate-180" aria-hidden="true" /></Item>}
                <Item shown={i < shown} className="rounded-[1.5cqw] border border-white/20 bg-white/10 px-[2cqw] py-[1.5cqw] text-center text-[2.4cqw] font-medium">
                  <span dir="auto"><RichInline text={it} /></span>
                </Item>
              </div>
            ))}
          </div>
        </div>
      );
    default: {
      const numbered = scene.kind === 'steps';
      const check = scene.kind === 'summary';
      return (
        <div className="flex h-full flex-col justify-center gap-[3cqw] px-[8cqw]">
          {heading}
          <ul className="space-y-[1.8cqw]">
            {scene.items.map((it, i) => (
              <li key={i} aria-hidden={i >= shown} dir="auto"
                className={cn('flex items-start gap-[1.5cqw] text-[3cqw] leading-snug transition-all duration-500', i < shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0')}>
                  {numbered ? <span className="flex size-[4cqw] shrink-0 items-center justify-center rounded-full bg-accent-500 text-[2.2cqw] font-bold">{i + 1}</span>
                    : check ? <CheckCircle2 className="mt-[0.3cqw] size-[3.4cqw] shrink-0 text-emerald-400" aria-hidden="true" />
                    : <span className="mt-[1.2cqw] size-[1.2cqw] shrink-0 rounded-full bg-accent-400" aria-hidden="true" />}
                  <span className="min-w-0"><RichInline text={it} /></span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }
};
