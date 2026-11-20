import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-10 rounded-xl [&>svg]:size-5',
  md: 'size-12 rounded-2xl [&>svg]:size-6',
  lg: 'size-14 rounded-2xl [&>svg]:size-7',
  xl: 'size-16 rounded-3xl [&>svg]:size-8',
} as const;

/**
 * A feature icon on a coloured tile: gradient, a soft highlight on the top
 * edge and a small shadow, with a duotone glyph (light fill under the
 * outline). `tint` is the gradient, e.g. "from-brand-500 to-brand-700".
 */
export const IconTile = ({ icon: Icon, tint, size = 'md', className }: {
  icon: LucideIcon; tint: string; size?: keyof typeof SIZES; className?: string;
}) => (
  <span className={cn('icon-tile relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white', SIZES[size], tint, className)}>
    <Icon className="relative" fill="currentColor" fillOpacity={0.2} strokeWidth={2} aria-hidden="true" />
  </span>
);
