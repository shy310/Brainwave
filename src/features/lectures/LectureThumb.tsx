import { BookOpen, Camera, FileText, FileType, MonitorPlay, Mic, Upload } from '@/ui/icons';
import type { LectureSource } from '@shared/lectures';
import { IconTile } from '@/ui/IconTile';

/** Where a lecture came from, as an icon and a colour (recordings are BrainWave blue; video is coral; documents mint). */
export const SOURCE_LOOK: Record<LectureSource, { icon: typeof Mic; tint: string }> = {
  record: { icon: Mic, tint: 'from-brand-500 to-brand-700' },
  upload: { icon: Upload, tint: 'from-violet-500 to-violet-700' },
  text: { icon: FileText, tint: 'from-emerald-400 to-emerald-600' },
  pdf: { icon: BookOpen, tint: 'from-emerald-400 to-emerald-600' },
  document: { icon: FileType, tint: 'from-emerald-400 to-emerald-600' },
  image: { icon: Camera, tint: 'from-teal-400 to-teal-600' },
  youtube: { icon: MonitorPlay, tint: 'from-coral-400 to-coral-600' },
};

/** A lecture's thumbnail: its source on a raised tile. Decorative (the source is also written out). */
export const LectureThumb = ({ source, size = 'sm', className }: { source: LectureSource; size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const look = SOURCE_LOOK[source] ?? SOURCE_LOOK.text;
  return <IconTile icon={look.icon} tint={look.tint} size={size} className={className} />;
};
