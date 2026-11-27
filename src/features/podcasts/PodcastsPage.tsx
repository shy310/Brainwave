import { Headphones } from '@/ui/icons';
import { useT } from '@/i18n';
import { MediaStudio } from '@/features/media/MediaStudio';

export default function PodcastsPage() {
  const t = useT();
  return <MediaStudio kind="podcast" op="podcastScript" strings={t.podcasts} icon={Headphones} tint="from-amber-400 to-amber-600" />;
}
