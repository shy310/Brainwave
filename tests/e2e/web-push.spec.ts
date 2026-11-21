import { test, expect } from './fixtures';

test('the site can be installed and shows pushed reminders: manifest, icons and service worker', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json() as { name: string; display: string; icons: { src: string; purpose?: string }[] };
  expect(manifest).toMatchObject({ name: 'BrainWave', display: 'standalone' });
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()['content-type']).toContain('image/png');
  const sw = await request.get('/sw.js');
  expect(sw.headers()['content-type']).toContain('javascript');
  const code = await sw.text();
  expect(code).toContain("addEventListener('push'");
  expect(code).toContain("addEventListener('notificationclick'");
});
