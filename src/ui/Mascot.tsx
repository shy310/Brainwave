import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Wave, BrainWave's mascot: a small blue brain with a brainwave across its
 * forehead (the logo's waveform) and wavy arms. Drawn in layered SVG so its
 * eyes, mouth, arms and props can move; every mood is the same character.
 * Decorative by default (aria-hidden); pass `label` when it carries meaning.
 */
export const MOODS = ['happy', 'excited', 'curious', 'thinking', 'celebrating', 'encouraging', 'confused', 'reading', 'sleeping', 'waving'] as const;
export type Mood = (typeof MOODS)[number];

type Eyes = 'open' | 'happy' | 'closed' | 'side' | 'up' | 'down' | 'uneven' | 'wide';
type Mouth = 'smile' | 'grin' | 'o' | 'flat' | 'wavy' | 'soft' | 'sleep';
type Arms = 'down' | 'wave' | 'up' | 'chin' | 'book' | 'thumb' | 'shrug';

const LOOK: Record<Mood, { eyes: Eyes; mouth: Mouth; arms: Arms }> = {
  happy: { eyes: 'open', mouth: 'smile', arms: 'down' },
  excited: { eyes: 'wide', mouth: 'grin', arms: 'up' },
  curious: { eyes: 'side', mouth: 'o', arms: 'down' },
  thinking: { eyes: 'up', mouth: 'flat', arms: 'chin' },
  celebrating: { eyes: 'happy', mouth: 'grin', arms: 'up' },
  encouraging: { eyes: 'open', mouth: 'soft', arms: 'thumb' },
  confused: { eyes: 'uneven', mouth: 'wavy', arms: 'shrug' },
  reading: { eyes: 'down', mouth: 'soft', arms: 'book' },
  sleeping: { eyes: 'closed', mouth: 'sleep', arms: 'down' },
  waving: { eyes: 'happy', mouth: 'smile', arms: 'wave' },
};

const INK = '#141a3c';
const ARM = '#2f49d6';

// Wavy arms: shoulder → elbow wiggle → hand. [path, hand x, hand y]
const ARM_PATHS: Record<string, [string, number, number]> = {
  downL: ['M34 104 c-8 2 -11 9 -10 15 s-4 11 -9 12', 15, 131],
  downR: ['M126 104 c8 2 11 9 10 15 s4 11 9 12', 145, 131],
  upL: ['M34 98 c-9 -2 -13 -9 -12 -17 s-4 -13 -9 -17', 13, 64],
  upR: ['M126 98 c9 -2 13 -9 12 -17 s4 -13 9 -17', 147, 64],
  waveR: ['M126 100 c9 -3 13 -10 12 -18 s3 -12 8 -16', 146, 66],
  chinR: ['M126 104 c-2 8 -10 12 -20 12 s-14 -2 -18 -4', 86, 112],
  shrugL: ['M34 102 c-8 -2 -12 -8 -12 -13 s-5 -8 -10 -8', 12, 81],
  shrugR: ['M126 102 c8 -2 12 -8 12 -13 s5 -8 10 -8', 148, 81],
  bookL: ['M34 106 c-4 6 -2 12 6 14 s14 2 18 0', 58, 120],
  bookR: ['M126 106 c4 6 2 12 -6 14 s-14 2 -18 0', 102, 120],
};

const Arm = ({ k, className }: { k: keyof typeof ARM_PATHS; className?: string }) => {
  const [d, x, y] = ARM_PATHS[k];
  return (
    <g className={className}>
      <path d={d} fill="none" stroke={ARM} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={6.5} fill={ARM} />
    </g>
  );
};

const Eye = ({ x, kind, right }: { x: number; kind: Eyes; right?: boolean }) => {
  const y = 84;
  if (kind === 'happy') return <path d={`M${x - 8} ${y + 2} q8 -10 16 0`} fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />;
  if (kind === 'closed') return <path d={`M${x - 8} ${y + 1} q8 7 16 0`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
  const dx = kind === 'side' ? 3.5 : 0, dy = kind === 'up' ? -4 : kind === 'down' ? 4 : 0;
  const r = kind === 'wide' ? 11 : kind === 'uneven' && right ? 7.5 : 9.5;
  return (
    <g className="mascot-eye">
      <ellipse cx={x} cy={y} rx={r} ry={r + 1.5} fill="#fff" />
      <circle cx={x + dx} cy={y + dy + 1} r={kind === 'wide' ? 6 : 5.2} fill={INK} />
      <circle cx={x + dx + 2} cy={y + dy - 1.5} r={1.9} fill="#fff" />
    </g>
  );
};

const MOUTHS: Record<Mouth, React.ReactNode> = {
  smile: <path d="M71 102 q9 9 18 0" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />,
  soft: <path d="M73 103 q7 5 14 0" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />,
  grin: <path d="M69 100 q11 0 22 0 q-2 13 -11 13 q-9 0 -11 -13z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />,
  o: <ellipse cx={80} cy={105} rx={4.5} ry={5.5} fill={INK} />,
  flat: <path d="M74 104 h12" stroke={INK} strokeWidth={4} strokeLinecap="round" />,
  wavy: <path d="M71 105 q3 -4 6 0 t6 0 t6 0" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />,
  sleep: <ellipse cx={80} cy={104} rx={3.5} ry={2.5} fill={INK} />,
};

export const Mascot = ({ mood = 'happy', size = 96, animate = true, label, className }: {
  mood?: Mood;
  size?: number | string;
  /** Idle movement (bobbing, blinking, the mood's gesture). Always off with reduced motion. */
  animate?: boolean;
  label?: string;
  className?: string;
}) => {
  const id = useId().replace(/:/g, '');
  const look = LOOK[mood];
  const a = look.arms;
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} className={cn('mascot shrink-0 overflow-visible', animate && 'mascot-live', `mascot-${mood}`, className)}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={`${id}b`} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#7aa6ff" />
          <stop offset="0.55" stopColor="#3f76f7" />
          <stop offset="1" stopColor="#2f49d6" />
        </radialGradient>
      </defs>
      <ellipse cx={80} cy={150} rx={32} ry={5} fill={INK} opacity={0.12} className="mascot-shadow" />
      <g className="mascot-body">
        {/* Arms behind the body. */}
        {a === 'down' && <><Arm k="downL" /><Arm k="downR" /></>}
        {a === 'wave' && <><Arm k="downL" /><Arm k="waveR" className="mascot-wave-arm" /></>}
        {a === 'up' && <><Arm k="upL" className="mascot-cheer-l" /><Arm k="upR" className="mascot-cheer-r" /></>}
        {a === 'shrug' && <><Arm k="shrugL" /><Arm k="shrugR" /></>}
        {a === 'thumb' && <><Arm k="downL" /><Arm k="upR" className="mascot-thumb" /></>}
        {(a === 'chin' || a === 'book') && <Arm k={a === 'chin' ? 'downL' : 'bookL'} />}

        {/* The brain: overlapping lobes make one soft silhouette. */}
        <g fill={`url(#${id}b)`}>
          <circle cx={52} cy={64} r={30} /><circle cx={80} cy={52} r={33} /><circle cx={108} cy={64} r={30} />
          <circle cx={44} cy={92} r={27} /><circle cx={116} cy={92} r={27} /><circle cx={80} cy={98} r={38} />
          <ellipse cx={66} cy={138} rx={10} ry={6} fill="#263cb0" /><ellipse cx={94} cy={138} rx={10} ry={6} fill="#263cb0" />
        </g>
        {/* Folds, and the brainwave across the forehead (the logo's waveform). */}
        <g fill="none" strokeLinecap="round">
          {/* The fissure between the halves, and a few gyri: it reads as a brain at any size. */}
          <path d="M80 21 q-5 6 0 12 q5 6 0 12" stroke="#1b3786" strokeOpacity={0.4} strokeWidth={3.2} />
          <g stroke="#1b3786" strokeOpacity={0.3} strokeWidth={3}>
            <path d="M36 50 q10 -5 15 4" /><path d="M26 76 q9 -3 13 5" /><path d="M58 30 q6 7 2 14" />
            <path d="M124 50 q-10 -5 -15 4" /><path d="M134 76 q-9 -3 -13 5" /><path d="M102 30 q-6 7 -2 14" />
          </g>
          <g stroke="#e2e8ff" strokeOpacity={0.6} strokeWidth={2.5}>
            <path d="M38 47 q9 -4 13 3" /><path d="M122 47 q-9 -4 -13 3" />
          </g>
        </g>
        <path className="mascot-wave" d="M44 64 q6 -9 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Face. */}
        <ellipse cx={58} cy={100} rx={7} ry={4.5} fill="#ff7468" opacity={0.45} />
        <ellipse cx={102} cy={100} rx={7} ry={4.5} fill="#ff7468" opacity={0.45} />
        <g className={look.eyes === 'open' || look.eyes === 'side' || look.eyes === 'wide' ? 'mascot-blink' : undefined}>
          <Eye x={66} kind={look.eyes} />
          <Eye x={94} kind={look.eyes} right />
        </g>
        {mood === 'curious' ? <path d="M86 68 q8 -6 16 -1" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" /> : null}
        {MOUTHS[look.mouth]}

        {/* Arms in front of the body. */}
        {a === 'chin' && <Arm k="chinR" />}
        {a === 'book' && (
          <>
            <g className="mascot-book">
              <path d="M56 108 l24 6 l24 -6 v24 l-24 6 l-24 -6z" fill="#ffcb45" stroke="#8a5a00" strokeWidth={2.5} strokeLinejoin="round" />
              <path d="M80 114 v24" stroke="#8a5a00" strokeWidth={2.5} />
              <path d="M62 116 l12 3 M62 122 l12 3 M86 119 l12 -3 M86 125 l12 -3" stroke="#8a5a00" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
            </g>
            <Arm k="bookR" />
          </>
        )}
      </g>

      {/* Props. */}
      {mood === 'thinking' && (
        <g className="mascot-think" fill="#e2e8ff" stroke="#93b6ff" strokeWidth={2}>
          <circle cx={124} cy={34} r={4} /><circle cx={134} cy={22} r={6} /><circle cx={148} cy={8} r={8} />
        </g>
      )}
      {mood === 'confused' && <text x={128} y={40} fontSize={30} fontWeight={800} fill="#8b5cf6" fontFamily="var(--font-display)" className="mascot-q">?</text>}
      {mood === 'sleeping' && (
        <g className="mascot-z" fill="#8b5cf6" fontWeight={800} fontFamily="var(--font-display)">
          <text x={118} y={42} fontSize={18}>z</text><text x={132} y={26} fontSize={13}>z</text><text x={142} y={14} fontSize={9}>z</text>
        </g>
      )}
      {(mood === 'celebrating' || mood === 'excited') && (
        <g className="mascot-confetti">
          <path d="M20 30 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#ffcb45" />
          <path d="M140 34 l2.5 5.5 l5.5 2.5 l-5.5 2.5 l-2.5 5.5 l-2.5 -5.5 l-5.5 -2.5 l5.5 -2.5z" fill="#22c997" />
          <circle cx={30} cy={58} r={3.5} fill="#ff7468" /><circle cx={132} cy={14} r={3} fill="#8b5cf6" />
          <rect x={146} y={60} width={7} height={3.5} rx={1.75} fill="#ff7468" transform="rotate(30 149 62)" />
          <rect x={6} y={78} width={7} height={3.5} rx={1.75} fill="#8b5cf6" transform="rotate(-25 9 80)" />
        </g>
      )}
      {mood === 'encouraging' && <path className="mascot-spark" d="M150 48 l2.5 5.5 l5.5 2.5 l-5.5 2.5 l-2.5 5.5 l-2.5 -5.5 l-5.5 -2.5 l5.5 -2.5z" fill="#ffcb45" />}
    </svg>
  );
};
