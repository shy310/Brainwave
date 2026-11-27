import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-10 rounded-[12px] [&>svg]:size-5',
  md: 'size-12 rounded-[14px] [&>svg]:size-6',
  lg: 'size-14 rounded-2xl [&>svg]:size-7',
  xl: 'size-[72px] rounded-[22px] [&>svg]:size-9',
  '2xl': 'size-24 rounded-[28px] [&>svg]:size-12',
} as const;

/**
 * The 2.0 signature: a chunky keycap of colour. A two-stop gradient (`tint`,
 * e.g. TOOL_META.x.tile), a glossy top, a darker lip along the bottom and a soft
 * cast shadow. Inside a `.group` that is pressed, it sinks onto its lip.
 * Decorative: the label next to it carries the meaning.
 */
export const KeyTile = ({ icon: Icon, tint, size = 'md', className }: {
  icon: LucideIcon; tint: string; size?: keyof typeof SIZES; className?: string;
}) => (
  <span aria-hidden="true" className={cn('key-tile relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white', SIZES[size], tint, className)}>
    <Icon className="relative drop-shadow-[0_1px_0_rgb(0_0_0/0.18)]" fill="currentColor" fillOpacity={0.22} strokeWidth={2.1} />
  </span>
);
