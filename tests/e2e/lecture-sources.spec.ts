import { deflateRawSync } from 'node:zlib';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

/** A .zip of deflated files, the way Word and PowerPoint save. */
const zip = (files: Record<string, string>) => {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = deflateRawSync(raw), nm = Buffer.from(name);
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(data.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(nm.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(loc, nm, data); central.push(cen, nm); off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
};
const docx = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Derivatives measure how fast a function changes.</w:t></w:r></w:p><w:p><w:r><w:t>The chain rule differentiates compositions of functions.</w:t></w:r></w:p></w:body></w:document>' });
const pptx = zip({ 'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Integrals add up areas.</a:t></a:r></a:p></p:sld>', 'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>Calculus overview for the whole term</a:t></a:r></a:p></p:sld>' });
const saved = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('bw.lectures') ?? '[]') as { source: string; title: string; segments: { start: number; text: string }[]; source_url?: string }[]);

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;
  const tl = t.lectures;

  test(`new lecture has three ways in: audio, YouTube, document (${lang})`, async ({ page }) => {
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    const tabs = page.getByRole('radiogroup', { name: tl.newTitle });
    await expect(tabs.getByRole('radio')).toHaveText([tl.modes.audio, tl.modes.youtube, tl.modes.document]);
    await expect(tabs.getByRole('radio', { name: tl.modes.audio })).toBeChecked();
    // Audio: record, or upload a recording right there.
    await expect(page.getByRole('button', { name: tl.start })).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: tl.orUpload }).click();
    expect((await chooser).element()).toBeTruthy();
    // Old links still open the right tab.
    await page.goto('/lectures/new?tab=pdf');
    await expect(tabs.getByRole('radio', { name: tl.modes.document })).toBeChecked();
  });

  test(`a lecture from a YouTube link (${lang})`, async ({ page }) => {
    let asked: { videoId: string } | null = null;
    await page.route('**/api/youtube/info?id=*', (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      return id === 'AAAAAAAAAAA' ? route.fulfill({ status: 404, json: { error: 'gone' } }) : route.fulfill({ json: { title: 'The essence of calculus', channel: '3Blue1Brown' } });
    });
    await page.route('**/api/ai/youtubeTranscript', async (route) => {
      asked = route.request().postDataJSON().input;
      await route.fulfill({ json: { data: { speech: true, segments: [{ start: 0, text: 'Welcome to calculus.' }, { start: 42, text: 'Derivatives measure change.' }] } } });
    });
    await page.route('**/api/ai/lectureNotes', (r) => r.fulfill({ status: 503, json: { error: 'off' } }));
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: tl.modes.youtube }).click();
    const link = page.getByLabel(tl.yt.label);

    await link.fill('https://vimeo.com/123');
    await expect(page.getByText(tl.yt.bad)).toBeVisible();
    await link.fill('https://youtu.be/AAAAAAAAAAA');
    await expect(page.getByText(tl.yt.unavailable)).toBeVisible();
    await expect(page.getByRole('button', { name: tl.yt.go })).toBeDisabled();

    await link.fill('https://www.youtube.com/watch?v=WUvTyaaNkzM&t=10s');
    await expect(page.getByText('The essence of calculus')).toBeVisible();
    await expect(page.getByText(tl.yt.by('3Blue1Brown'))).toBeVisible();
    await page.getByRole('button', { name: tl.yt.go }).click();
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    expect(asked).toEqual({ videoId: 'WUvTyaaNkzM', language: 'auto' });
    const [lecture] = await saved(page);
    expect(lecture).toMatchObject({ source: 'youtube', title: 'The essence of calculus', source_url: 'https://www.youtube.com/watch?v=WUvTyaaNkzM' });
    expect(lecture.segments.map((s) => s.start)).toEqual([0, 42]);
    await expect(page.getByRole('link', { name: tl.yt.watch })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=WUvTyaaNkzM');
  });

  test(`a lecture from a Word or PowerPoint file, or pasted text (${lang})`, async ({ page }) => {
    await page.route('**/api/ai/lectureNotes', (r) => r.fulfill({ status: 503, json: { error: 'off' } }));
    await onboard(page, { hebrew: lang === 'he' });
    const pick = async (name: string, buffer: Buffer) => {
      await page.goto('/lectures/new');
      await page.getByRole('radio', { name: tl.modes.document }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: tl.doc.choose }).click();
      await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer });
    };

    await pick('Week 3 notes.docx', docx);
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    let all = await saved(page);
    expect(all[0]).toMatchObject({ source: 'document', title: 'Week 3 notes' });
    expect(all[0].segments[0].text).toBe('Derivatives measure how fast a function changes.\n\nThe chain rule differentiates compositions of functions.');

    await pick('deck.pptx', pptx);
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    all = await saved(page);
    expect(all[0].segments[0].text).toBe(`${tl.doc.slide(1)}\nCalculus overview for the whole term\n\n${tl.doc.slide(2)}\nIntegrals add up areas.`);

    // Old formats get a clear message.
    await pick('old.doc', Buffer.from('binary'));
    await expect(page.getByRole('alert')).toHaveText(tl.doc.legacy);

    // Or paste the text.
    await page.getByRole('button', { name: tl.doc.paste }).click();
    await page.getByLabel(tl.textPlaceholder).fill('Today we covered limits, continuity and the definition of the derivative in detail.');
    await page.getByRole('button', { name: tl.create }).click();
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    expect((await saved(page))[0].source).toBe('text');
  });
}
