import zlib from 'node:zlib';
import { test, expect, onboard } from './fixtures';
import { en } from '../../src/i18n/en';
import { he } from '../../src/i18n/he';

/** A small real PDF: one page per entry; null makes a page with no text (like a scan). */
const makePdf = (pages: (string | null)[]) => {
  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1 + pages.length * 2;
  const kids: number[] = [];
  for (const text of pages) {
    const stream = text ? `BT /F1 16 Tf 72 720 Td (${text}) Tj ET` : '0 0 1 rg 100 400 200 100 re f';
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: 'calculus-notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from(out, 'latin1') };
};

/** A small PNG (a grey square) so the browser can decode it. */
const makePng = (name: string) => {
  const w = 40, h = 40;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x80);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const buffer = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return { name, mimeType: 'image/png', buffer };
};

const NOTES = { title: 'From the source', summary: 'Made from the chosen pages.', sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [] };

for (const lang of ['en', 'he'] as const) {
  const t = lang === 'he' ? he : en;

  test(`a lecture from chosen PDF pages; scanned pages are read by the AI (${lang})`, async ({ page }) => {
    const calls: { op: string; input: Record<string, unknown> }[] = [];
    await page.route('**/api/ai/*', (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop()!;
      const input = (route.request().postDataJSON() as { input: Record<string, unknown> }).input;
      calls.push({ op, input });
      if (op === 'imageText') return route.fulfill({ json: { data: { text: 'Scanned page: the chain rule $(f\\circ g)\' = f\'(g)g\'$.' } } });
      if (op === 'lectureNotes') return route.fulfill({ json: { data: NOTES } });
      return route.fulfill({ status: 404, json: { error: 'no' } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.pdf }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: t.lectures.choosePdf }).click();
    await (await chooser).setFiles(makePdf(['Limits and continuity', 'The derivative is the slope of the tangent', null, 'Problem set 4 is due Monday']));
    await expect(page.getByText(t.lectures.pdfPages(4), { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(t.lectures.selectedPages(4))).toBeVisible();

    // Pick pages 2-3 with the range box, then drop 3 and add 4 with the page buttons.
    await page.getByPlaceholder(t.lectures.pagesHint).fill('2-3');
    await expect(page.getByText(t.lectures.selectedPages(2))).toBeVisible();
    await page.getByRole('button', { name: t.lectures.pageN(4) }).click();
    await expect(page.getByPlaceholder(t.lectures.pagesHint)).toHaveValue('2-4');
    await page.getByRole('button', { name: t.lectures.makeNotes }).click();

    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    await expect(page.getByText('Made from the chosen pages.')).toBeVisible();
    // Only the page without text went to the AI, as an image.
    expect(calls.filter((c) => c.op === 'imageText')).toHaveLength(1);
    expect(calls.find((c) => c.op === 'imageText')!.input).toMatchObject({ kind: 'page', image: expect.stringMatching(/^data:image\/jpeg;base64,/) });
    const transcript = String(calls.find((c) => c.op === 'lectureNotes')!.input.transcript);
    expect(transcript).toContain('slope of the tangent');
    expect(transcript).toContain('chain rule');
    expect(transcript).toContain('Problem set 4');
    expect(transcript).not.toContain('Limits and continuity');

    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    await expect(page.getByText('0:02')).toHaveCount(0); // documents have no times
  });

  test(`a lecture from photos (${lang})`, async ({ page }) => {
    const photos: unknown[] = [];
    await page.route('**/api/ai/*', (route) => {
      const op = new URL(route.request().url()).pathname.split('/').pop()!;
      if (op === 'imageText') {
        photos.push((route.request().postDataJSON() as { input: unknown }).input);
        return route.fulfill({ json: { data: { text: `Whiteboard ${photos.length}: integration by parts.` } } });
      }
      if (op === 'lectureNotes') return route.fulfill({ json: { data: NOTES } });
      return route.fulfill({ status: 404, json: { error: 'no' } });
    });
    await onboard(page, { hebrew: lang === 'he' });
    await page.goto('/lectures/new');
    await page.getByRole('radio', { name: t.lectures.tabs.image }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: t.lectures.choosePhotos }).click();
    await (await chooser).setFiles([makePng('a.png'), makePng('b.png'), makePng('c.png')]);
    await expect(page.getByRole('img')).toHaveCount(3);
    await page.getByRole('button', { name: t.lectures.removePhoto(2) }).click();
    await expect(page.getByRole('img')).toHaveCount(2);
    await page.getByRole('button', { name: t.lectures.makeNotes }).click();
    await expect(page).toHaveURL(/\/lectures\/(?!new)[\w-]+$/, { timeout: 20_000 });
    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({ kind: 'photo', image: expect.stringMatching(/^data:image\/jpeg;base64,/) });
    await page.getByRole('radio', { name: t.lectures.tabsView.transcript }).click();
    await expect(page.getByText(/Whiteboard \d: integration by parts\./)).toHaveCount(2);
  });
}
