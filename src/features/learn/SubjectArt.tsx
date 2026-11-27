import type { Subject } from '@shared/curriculum';
import { cn } from '@/lib/cn';

/**
 * Each subject's own small scene, drawn in one shared style: soft rounded
 * shapes, white and a tint of the subject's colour, one line weight. They sit
 * on the subject's colour field. On hover (or focus) of the card, each comes
 * alive in its own way (see .subject-art-* in styles.css). Decorative.
 */
const W = '#ffffff';

const Math_ = () => (
  <>
    <g stroke={W} strokeOpacity={0.22} strokeWidth={1.5}>
      {[30, 55, 80, 105].map((y) => <path key={y} d={`M18 ${y} H186`} />)}
      {[40, 70, 100, 130, 160].map((x) => <path key={x} d={`M${x} 14 V116`} />)}
    </g>
    <path className="art-draw" d="M28 104 C60 0 92 0 124 60 S172 120 186 30" fill="none" stroke="#ffcb45" strokeWidth={5} strokeLinecap="round" />
    <path d="M136 22 l26 0 l-13 -22z" transform="translate(0 70) rotate(0)" fill={W} fillOpacity={0.9} />
    <g fill={W} fontFamily="var(--font-display)" fontWeight={800}>
      <text x={38} y={44} fontSize={26}>π</text>
      <text x={150} y={52} fontSize={22} className="art-bob">x²</text>
    </g>
    <circle cx={76} cy={30} r={6} fill="#bd9cf6" />
  </>
);

const Science = () => (
  <>
    <circle cx={150} cy={56} r={30} fill="none" stroke={W} strokeOpacity={0.5} strokeWidth={2.5} />
    <ellipse cx={150} cy={56} rx={42} ry={14} fill="none" stroke={W} strokeOpacity={0.7} strokeWidth={2.5} className="art-spin" />
    <circle cx={150} cy={56} r={8} fill="#ffcb45" />
    <path d="M60 20 h28 M66 20 v32 l-24 44 a8 8 0 0 0 7 12 h50 a8 8 0 0 0 7 -12 l-24 -44 v-32" fill={W} fillOpacity={0.95} stroke={W} strokeWidth={3} strokeLinejoin="round" />
    <path d="M48 92 q12 -8 26 0 t26 0 l6 10 a8 8 0 0 1 -7 10 h-50 a8 8 0 0 1 -7 -10z" fill="#0d7f5e" fillOpacity={0.85} />
    <g fill={W} className="art-bubbles"><circle cx={72} cy={84} r={4} /><circle cx={84} cy={74} r={3} /><circle cx={78} cy={62} r={2.5} /></g>
  </>
);

const Geography = () => (
  <>
    <path d="M10 112 l40 -52 l22 26 l26 -42 l44 68z" fill={W} fillOpacity={0.9} />
    <path d="M86 44 l10 -16 l12 18 l-8 -3 l-6 6z" fill="#e6f7f5" />
    <circle cx={156} cy={52} r={30} fill="#0f766e" fillOpacity={0.6} stroke={W} strokeWidth={3} />
    <g className="art-spin-slow" fill="none" stroke={W} strokeOpacity={0.8} strokeWidth={2}>
      <ellipse cx={156} cy={52} rx={13} ry={30} /><path d="M126 52 h60 M131 37 h50 M131 67 h50" />
    </g>
    <g className="art-bob"><path d="M58 28 a10 10 0 1 1 20 0 c0 8 -10 18 -10 18 s-10 -10 -10 -18z" fill="#ff7468" /><circle cx={68} cy={28} r={3.5} fill={W} /></g>
  </>
);

const History = () => (
  <>
    <path d="M30 40 l40 -22 l40 22z" fill={W} />
    <rect x={30} y={40} width={80} height={6} rx={2} fill={W} />
    {[38, 58, 78, 98].map((x) => <rect key={x} x={x - 4} y={50} width={8} height={46} rx={3} fill={W} fillOpacity={0.9} />)}
    <rect x={24} y={98} width={92} height={8} rx={3} fill={W} />
    <g className="art-flip" transform="translate(150 58)">
      <path d="M-16 -30 h32 M-16 30 h32 M-12 -30 c0 22 24 22 24 0 M-12 30 c0 -22 24 -22 24 0" fill="none" stroke={W} strokeWidth={4} strokeLinecap="round" />
      <path d="M-7 -20 h14 l-7 10z M-8 26 q8 -12 16 0z" fill="#7c2d12" fillOpacity={0.7} />
    </g>
  </>
);

const Coding = () => (
  <>
    <rect x={20} y={18} width={110} height={84} rx={12} fill="#3f1d7a" fillOpacity={0.55} stroke={W} strokeWidth={3} />
    <g fill={W}><circle cx={34} cy={30} r={3} /><circle cx={44} cy={30} r={3} /><circle cx={54} cy={30} r={3} /></g>
    <path d="M48 56 l-12 12 l12 12 M102 56 l12 12 l-12 12 M82 52 l-12 34" fill="none" stroke="#ffcb45" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    <rect className="art-blink" x={88} y={84} width={10} height={4} rx={2} fill={W} />
    <g fill={W}>
      {[[146, 26], [160, 26], [160, 40], [174, 40], [146, 54], [174, 68], [160, 82]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width={11} height={11} rx={3} fillOpacity={(x + y) % 3 ? 0.95 : 0.55} />)}
    </g>
  </>
);

const Economics = () => (
  <>
    <g className="art-grow" fill={W}>
      <rect x={30} y={70} width={20} height={36} rx={5} fillOpacity={0.55} />
      <rect x={58} y={54} width={20} height={52} rx={5} fillOpacity={0.7} />
      <rect x={86} y={38} width={20} height={68} rx={5} fillOpacity={0.85} />
      <rect x={114} y={22} width={20} height={84} rx={5} />
    </g>
    <path d="M28 62 L64 44 L92 30 L130 12" fill="none" stroke="#ffcb45" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M118 10 l14 1 l-3 13" fill="none" stroke="#ffcb45" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    <g className="art-bob"><circle cx={164} cy={76} r={20} fill="#ffcb45" /><circle cx={164} cy={76} r={13} fill="none" stroke="#8a5a00" strokeWidth={2.5} /><text x={164} y={83} textAnchor="middle" fontSize={18} fontWeight={800} fill="#8a5a00" fontFamily="var(--font-display)">$</text></g>
  </>
);

const ART: Record<Subject, () => React.ReactNode> = { math: Math_, science: Science, geography: Geography, history: History, coding: Coding, economics: Economics };

export const SubjectArt = ({ subject, className }: { subject: Subject; className?: string }) => {
  const Art = ART[subject];
  return (
    <svg viewBox="0 0 200 120" className={cn('subject-art', className)} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <Art />
    </svg>
  );
};
