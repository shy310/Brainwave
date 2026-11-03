import { Clapperboard } from 'lucide-react';
import { useT } from '@/i18n';
import { MediaStudio } from '@/features/media/MediaStudio';

export default function VideosPage() {
  const t = useT();
  return <MediaStudio kind="video" op="videoScript" strings={t.videos} icon={Clapperboard} tint="from-sky-500 to-indigo-600" />;
}
