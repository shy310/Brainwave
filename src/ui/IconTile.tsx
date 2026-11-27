import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-10 rounded-[12px] [&>svg]:size-5',
  md: 'size-12 rounded-[14px] [&>svg]:size-6',
  lg: 'size-14 rounded-2xl [&>svg]:size-7',
  xl: 'size-16 rounded-[20px] [&>svg]:size-8',
} as const;

/**
 * A feature icon on a keycap tile (the 2.0 look, see KeyTile and `.key-tile`):
 * gradient, glossy top, a darker lip and a cast shadow, with a duotone glyph.
 * `tint` is the gradient, e.g. "from-brand-500 to-brand-700".
 */
export const IconTile = ({ icon: Icon, tint, size = 'md', className }: {
  icon: LucideIcon; tint: string; size?: keyof typeof SIZES; className?: string;
}) => (
  <span aria-hidden="true" className={cn('key-tile relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white', SIZES[size], tint, className)}>
    <Icon className="relative drop-shadow-[0_1px_0_rgb(0_0_0/0.18)]" fill="currentColor" fillOpacity={0.22} strokeWidth={2.1} />
  </span>
);
