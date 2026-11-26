import { afterEach, describe, expect, it, vi } from 'vitest';

const dns: Record<string, string> = { 'example.edu': '93.184.216.34', 'evil.test': '10.0.0.5' };
vi.mock('node:dns/promises', () => ({ lookup: async (host: string) => (dns[host] ? [{ address: dns[host], family: 4 }] : []) }));
const { webpageHandler } = await import('../../server/webpage');

const ARTICLE = `<html><head><title>Cells</title></head><body><nav>Menu</nav><article><h1>Cells</h1><p>${'Cells are the basic unit of life. '.repeat(20)}</p></article></body></html>`;

const call = async (url: string) => {
  let status = 200;
  let body: Record<string, unknown> = {};
  const res = { status: (s: number) => { status = s; return res; }, json: (b: Record<string, unknown>) => { body = b; return res; } };
  await webpageHandler({ query: { url } } as never, res as never);
  return { status, body };
};
const page = (html: string, init: ResponseInit = {}) => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });

afterEach(() => vi.unstubAllGlobals());

describe('reading a web page for a lecture', () => {
  it('returns the article text and title', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => page(ARTICLE)));
    const { status, body } = await call('https://example.edu/cells');
    expect(status).toBe(200);
    expect(body).toMatchObject({ url: 'https://example.edu/cells', title: 'Cells' });
    expect(body.text).toMatch(/^Cells\n\nCells are the basic unit of life\./);
    expect(body.text).not.toContain('Menu');
  });

  it('checks every redirect, and refuses one into a private network', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/admin' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await call('https://example.edu/go')).toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses non-pages, pages without text, unknown hosts and bad links', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })));
    expect((await call('https://example.edu/a.pdf')).status).toBe(415);
    vi.stubGlobal('fetch', vi.fn(async () => page('<body><p>Too short</p></body>')));
    expect((await call('https://example.edu/empty')).status).toBe(422);
    expect((await call('https://nowhere.example/')).status).toBe(502);
    expect((await call('javascript:alert(1)')).status).toBe(400);
    expect((await call('https://user:pw@example.edu/')).status).toBe(400);
    expect((await call('http://10.0.0.1/')).status).toBe(400);
  });

  it('decodes pages in other character sets (old Hebrew sites)', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('<body><p>'), ...Array(300).fill(0xf9), ...new TextEncoder().encode('</p></body>')]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'text/html; charset=windows-1255' } })));
    const { body } = await call('https://example.edu/he');
    expect(String(body.text).slice(0, 3)).toBe('ששש');
  });
});
