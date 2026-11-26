import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Pause } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Mascot } from '@/ui/Mascot';

/**
 * The landing's signature scene: Wave the mascot with five real study
 * artifacts BrainWave makes (notes, a quiz question, a flashcard, a podcast,
 * a formula), linked by one drawn brainwave. Laid out at a fixed design size
 * and scaled to fit, so it composes the same on a phone and a desktop.
 * Decorative: the page says all of this in words too.
 */
const W = 560, H = 470;

const Piece = ({ x, y, rot, delay, float, children, className }: { x: number; y: number; rot: number; delay: number; float: number; children: ReactNode; className?: string }) => (
  <div className={cn('hero-piece absolute', className)}
    style={{ left: x, top: y, '--rot': `${rot}deg`, '--from-x': `${W / 2 - x - 60}px`, '--from-y': `${H / 2 - y - 40}px`, '--delay': `${delay}ms`, '--float': `${float}s` } as CSSProperties}>
    <div className="hero-float">
      <div className="rounded-2xl border border-white/60 bg-white p-3 text-[13px] leading-snug text-brand-950 shadow-[0_18px_40px_-16px_rgb(23_35_68/0.55)]" style={{ transform: `rotate(${rot}deg)` }}>
        {children}
      </div>
    </div>
  </div>
);

const Tag = ({ children, tone }: { children: ReactNode; tone: string }) => (
  <span className={cn('mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide', tone)}>{children}</span>
);

export const LandingHero = () => {
  const t = useT();
  const ta = t.landing.art;
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.15, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full" style={{ height: H * scale }} aria-hidden="true">
      <div className="absolute start-1/2 top-0 origin-top" style={{ width: W, height: H, transform: `translateX(-50%) scale(${scale})` }} dir="ltr">
        {/* The brainwave that links everything, drawn in on load. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible">
          <path d="M40 120 C120 40 200 210 280 230 S440 90 520 150 M120 380 C200 330 220 260 280 250 S380 400 470 330"
            fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="1 10" />
          <path d="M40 120 C120 40 200 210 280 230 S440 90 520 150" fill="none" stroke="#ffd35a" strokeWidth={4} strokeLinecap="round" pathLength={1} className="wave-draw" />
        </svg>

        <div className="hero-mascot absolute" style={{ left: W / 2 - 125, top: H / 2 - 145 }}>
          <Mascot mood="waving" size={250} />
        </div>

        <Piece x={14} y={36} rot={-6} delay={250} float={4.2}>
          <div className="w-[150px]">
            <Tag tone="bg-brand-100 text-brand-700">{ta.notes}</Tag>
            <p className="font-display text-[15px] font-bold">🧬 {ta.cell}</p>
            <ul className="mt-1.5 space-y-1">
              {[90, 72, 84].map((w, i) => <li key={i} className="flex items-center gap-1.5"><span className="size-1.5 shrink-0 rounded-full bg-brand-400" /><span className="h-1.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} /></li>)}
            </ul>
          </div>
        </Piece>

        <Piece x={360} y={10} rot={5} delay={340} float={4.6}>
          <div className="w-[176px]">
            <Tag tone="bg-violet-100 text-violet-700">{ta.quiz}</Tag>
            <p className="font-semibold">{ta.q}</p>
            <div className="mt-2 space-y-1.5">
              <p className="flex items-center gap-1.5 rounded-lg border-2 border-emerald-400 bg-emerald-50 px-2 py-1 font-medium"><Check className="size-3.5 text-emerald-600" strokeWidth={3} />{ta.a1}</p>
              <p className="rounded-lg border border-slate-200 px-2 py-1 text-slate-500">{ta.a2}</p>
            </div>
          </div>
        </Piece>

        <Piece x={402} y={262} rot={-4} delay={430} float={4.4}>
          <div className="w-[136px] text-center">
            <Tag tone="bg-accent-200 text-accent-600">{ta.cards}</Tag>
            <p className="font-display text-lg font-bold">{ta.front}</p>
            <p className="mt-1 border-t border-dashed border-slate-200 pt-1 text-[12px] text-slate-500">{ta.back}</p>
          </div>
        </Piece>

        <Piece x={0} y={306} rot={4} delay={520} float={4.8}>
          <div className="w-[168px]">
            <Tag tone="bg-coral-100 text-coral-700">{ta.podcast}</Tag>
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Pause className="size-4" fill="currentColor" /></span>
              <span className="flex h-8 flex-1 items-center gap-[3px]">
                {[8, 16, 24, 14, 28, 18, 10, 22, 30, 16, 12, 20].map((h, i) => <span key={i} className="hero-bar w-[3px] rounded-full bg-brand-400" style={{ height: h, animationDelay: `${i * 80}ms` }} />)}
              </span>
            </div>
          </div>
        </Piece>

        <Piece x={206} y={380} rot={-3} delay={610} float={4.5}>
          <div className="w-[150px] text-center">
            <Tag tone="bg-emerald-100 text-emerald-700">{ta.formula}</Tag>
            {/* The quadratic formula as a real stacked fraction. */}
            <p className="inline-flex items-center gap-1.5 font-serif text-[16px] italic" dir="ltr">
              <span>x =</span>
              <span className="inline-flex flex-col items-center leading-tight">
                <span className="border-b border-brand-950 px-0.5 pb-0.5">−b ± √<span className="border-t border-brand-950 not-italic">b²−4ac</span></span>
                <span className="pt-0.5">2a</span>
              </span>
            </p>
          </div>
        </Piece>
      </div>
    </div>
  );
};
