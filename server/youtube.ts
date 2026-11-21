import type { Response } from 'express';
import type { AuthedRequest } from './auth.js';

/**
 * A YouTube video's title and channel, from YouTube's public oEmbed endpoint
 * (no key needed). Used to show which video was pasted before reading it.
 */
export const youtubeInfoHandler = async (req: AuthedRequest, res: Response) => {
  const id = String(req.query.id ?? '');
  if (!/^[\w-]{11}$/.test(id)) { res.status(400).json({ error: 'Not a YouTube video.' }); return; }
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r) { res.status(502).json({ error: 'YouTube could not be reached.' }); return; }
  // 401/403: embedding is off or the video is private; 404: no such video.
  if (!r.ok) { res.status(r.status === 404 || r.status === 400 ? 404 : 403).json({ error: 'This video is private or unavailable.' }); return; }
  const data = (await r.json()) as { title?: string; author_name?: string };
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.json({ title: String(data.title ?? '').slice(0, 200), channel: String(data.author_name ?? '').slice(0, 120) });
};
