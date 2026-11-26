import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { sinePath } from './Wave';
import { TOOL_META, type Tool } from './tools';

/**
 * A tool's scene on its coloured header: the tool's icon on a raised tile,
 * the brainwave running underneath, and a small motif from the tool's world
 * (sound bars for lectures, a film strip for videos, stacked cards for review…).
 * Shapes are white or the tool's spark colour, so they read on every field.
 * Decorative.
 */
const MOTIF: Record<Tool, (spark: string) => ReactNode> = {
  learn: (s) => <><path d="M24 40 h26 M24 50 h18" stroke="#fff" strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" /><Spark x={206} y={30} c={s} /></>,
  lectures: (s) => (
    <>
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 10} y={46 - [10, 18, 26, 14, 8][i]} width={6} height={[10, 18, 26, 14, 8][i] * 2} rx={3} fill="#fff" fillOpacity={0.4} />)}
      <Spark x={206} y={30} c={s} />
    </>
  ),
  tutor: (s) => (
    <>
      <path d="M18 30 h40 a8 8 0 0 1 8 8 v12 a8 8 0 0 1 -8 8 h-26 l-10 8 v-8 h-4 a8 8 0 0 1 -8 -8 v-12 a8 8 0 0 1 8 -8 z" fill="#fff" fillOpacity={0.25} />
      <circle cx={210} cy={28} r={5} fill={s} /><circle cx={224} cy={40} r={3} fill="#fff" fillOpacity={0.5} />
    </>
  ),
  videos: (s) => (
    <>
      <rect x={16} y={28} width={54} height={36} rx={8} fill="#fff" fillOpacity={0.22} />
      <path d="M38 38 l14 8 -14 8 z" fill="#fff" fillOpacity={0.8} />
      <Spark x={208} y={28} c={s} />
    </>
  ),
  podcasts: (s) => (
    <>
      {[12, 22, 32].map((r) => <path key={r} d={`M${44 - r} 66 a${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" />)}
      <circle cx={44} cy={66} r={5} fill={s} />
      <Spark x={208} y={30} c="#fff" />
    </>
  ),
  review: (s) => (
    <>
      <rect x={22} y={34} width={44} height={30} rx={6} fill="#fff" fillOpacity={0.18} transform="rotate(-10 44 49)" />
      <rect x={26} y={30} width={44} height={30} rx={6} fill="#fff" fillOpacity={0.32} transform="rotate(4 48 45)" />
      <Spark x={206} y={30} c={s} />
    </>
  ),
  practice: (s) => (
    <>
      {[22, 14, 6].map((r, i) => <circle key={r} cx={44} cy={48} r={r} fill="none" stroke="#fff" strokeOpacity={0.3 + i * 0.15} strokeWidth={4} />)}
      <circle cx={44} cy={48} r={3} fill={s} />
    </>
  ),
  exams: (s) => (
    <>
      <path d="M44 24 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2 z" fill="#fff" fillOpacity={0.55} />
      <circle cx={210} cy={30} r={5} fill={s} /><circle cx={222} cy={44} r={3} fill={s} fillOpacity={0.6} />
    </>
  ),
  calendar: (s) => (
    <>
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={18 + c * 13} y={28 + r * 13} width={9} height={9} rx={2.5} fill={r === 1 && c === 2 ? s : '#fff'} fillOpacity={r === 1 && c === 2 ? 1 : 0.35} />))}
    </>
  ),
  schedule: (s) => (
    <>
      {[0, 1, 2].map((r) => <rect key={r} x={18} y={28 + r * 14} width={[46, 32, 40][r]} height={8} rx={4} fill={r === 0 ? s : '#fff'} fillOpacity={r === 0 ? 1 : 0.4} />)}
    </>
  ),
  games: (s) => (
    <>
      <path d="M22 38 h8 v-8 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 z" fill="#fff" fillOpacity={0.45} />
      <circle cx={62} cy={36} r={5} fill={s} /><circle cx={72} cy={48} r={5} fill="#fff" fillOpacity={0.5} />
    </>
  ),
  groups: (s) => (
    <>
      <circle cx={34} cy={46} r={14} fill="#fff" fillOpacity={0.3} />
      <circle cx={54} cy={46} r={14} fill="#fff" fillOpacity={0.3} />
      <circle cx={44} cy={30} r={6} fill={s} />
    </>
  ),
  grader: (s) => (
    <>
      <rect x={18} y={26} width={44} height={44} rx={10} fill="#fff" fillOpacity={0.22} />
      <path d="M28 48 l9 9 16 -18" fill="none" stroke={s} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  search: (s) => (
    <>
      <circle cx={38} cy={42} r={14} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={5} />
      <path d="M48 52 l12 12" stroke="#fff" strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" />
      <Spark x={208} y={30} c={s} />
    </>
  ),
  settings: (s) => (
    <>
      {[0, 1, 2].map((r) => <g key={r}><rect x={18} y={30 + r * 14} width={46} height={5} rx={2.5} fill="#fff" fillOpacity={0.35} /><circle cx={[30, 52, 40][r]} cy={32.5 + r * 14} r={5} fill={r === 1 ? s : '#fff'} /></g>)}
    </>
  ),
  conceptMap: (s) => (
    <>
      <path d="M26 34 L50 50 L30 66 M50 50 L70 36" stroke="#fff" strokeOpacity={0.45} strokeWidth={3} />
      <circle cx={26} cy={34} r={6} fill="#fff" fillOpacity={0.7} /><circle cx={30} cy={66} r={5} fill="#fff" fillOpacity={0.7} />
      <circle cx={70} cy={36} r={5} fill="#fff" fillOpacity={0.7} /><circle cx={50} cy={50} r={8} fill={s} />
    </>
  ),
  cheatSheet: (s) => (
    <>
      <rect x={20} y={24} width={40} height={50} rx={6} fill="#fff" fillOpacity={0.6} />
      {[0, 1, 2, 3].map((r) => <rect key={r} x={27} y={33 + r * 9} width={[26, 20, 24, 14][r]} height={4} rx={2} fill={s} fillOpacity={0.5} />)}
    </>
  ),
};

const Spark = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <path className="tool-spark" d={`M${x} ${y - 9} q1.6 7.4 9 9 q-7.4 1.6 -9 9 q-1.6 -7.4 -9 -9 q7.4 -1.6 9 -9 z`} fill={c} />
);

export const ToolArt = ({ tool, className, draw }: { tool: Tool; className?: string; draw?: boolean }) => {
  const meta = TOOL_META[tool];
  const Icon = meta.icon;
  const dark = meta.onField === 'text-brand-950';
  return (
    <div className={cn('tool-art', className)} aria-hidden="true">
      <svg viewBox="0 0 240 150" className="absolute inset-0 size-full overflow-visible rtl:-scale-x-100">
        <circle cx={150} cy={78} r={62} fill={dark ? '#172344' : '#fff'} fillOpacity={dark ? 0.06 : 0.1} />
        {MOTIF[tool](meta.spark)}
        <path d={sinePath(240, 3, 7, 124)} fill="none" stroke={meta.spark} strokeWidth={5} strokeLinecap="round" pathLength={1}
          className={draw ? 'wave-draw' : undefined} />
      </svg>
      {/* The tool's icon on a raised tile, tilted a little: the scene's subject. */}
      <span style={{ color: meta.hue }} className="tool-tile absolute start-[47%] top-[18%] flex aspect-square w-[34%] -rotate-6 items-center justify-center rounded-[28%] bg-white shadow-[0_10px_24px_-10px_rgb(23_35_68/0.55),inset_0_-4px_0_rgb(23_35_68/0.08)]">
        <Icon className="size-[52%]" strokeWidth={2.1} />
      </span>
    </div>
  );
};
