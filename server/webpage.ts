import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { isPrivateAddress, readablePage } from '../shared/webText.js';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_TEXT = 150_000;

class PageError extends Error { constructor(public status: number, message: string) { super(message); } }

/** A link the server may fetch for the user: http(s), a public host, no credentials or odd ports. */
const checkUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try { url = new URL(raw); } catch { throw new PageError(400, 'That isn’t a web link.'); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new PageError(400, 'That isn’t a web link.');
  if (url.port && !['80', '443'].includes(url.port)) throw new PageError(400, 'That isn’t a web link.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new PageError(400, 'That address can’t be opened.');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new PageError(502, 'That site couldn’t be reached.');
  if (addresses.some(isPrivateAddress)) throw new PageError(400, 'That address can’t be opened.');
  return url;
};

/** Fetch a page, following a few redirects (each one checked again), up to a size limit. */
const fetchPage = async (raw: string) => {
  let url = await checkUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrainWave lecture reader)', Accept: 'text/html,text/plain;q=0.9' },
    }).catch(() => { throw new PageError(502, 'That site couldn’t be reached.'); });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop >= MAX_REDIRECTS) throw new PageError(502, 'That link redirects too many times.');
      url = await checkUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new PageError(502, res.status === 401 || res.status === 403 ? 'That page needs a login, so it can’t be read.' : 'That page couldn’t be opened.');
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) throw new PageError(415, 'That link isn’t a web page. For a PDF or document, download it and choose the file.');
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new PageError(413, 'That page is too big.');
    // Read up to the limit, then decode with the page's own character set.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size);
    let at = 0;
    for (const c of chunks) { bytes.set(c.subarray(0, bytes.length - at), at); at += c.length; if (at >= bytes.length) break; }
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? 'utf-8';
    let body: string;
    try { body = new TextDecoder(charset).decode(bytes); } catch { body = new TextDecoder().decode(bytes); }
    return { url: url.toString(), plain: /text\/plain/i.test(type), body };
  }
};

/** GET /api/webpage?url=… → the page's title and readable text, for a lecture from a link. */
export const webpageHandler = async (req: AuthedRequest, res: Response) => {
  try {
    const page = await fetchPage(String(req.query.url ?? '').trim().slice(0, 2000));
    const { title, text } = page.plain ? { title: '', text: page.body.trim() } : readablePage(page.body);
    if (text.length < 200) throw new PageError(422, 'There isn’t enough text on that page. Some sites only show their text in the browser — copy it and paste it instead.');
    res.json({ url: page.url, title: title.slice(0, 200), text: text.slice(0, MAX_TEXT), cut: text.length > MAX_TEXT });
  } catch (err) {
    if (err instanceof PageError) { res.status(err.status).json({ error: err.message }); return; }
    throw err;
  }
};
