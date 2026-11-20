// PDFs and photos as note sources. PDF text is read in the browser with
// pdf.js (no AI cost, nothing uploaded); pages with no text layer (scans) and
// photos are turned into images and read by a vision model.

import { MAX_IMAGE_DATA_URL } from '@shared/lectures';

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;

/** Load a PDF. pdf.js is only downloaded when someone opens a PDF. */
export const loadPdf = async (file: Blob): Promise<PdfDoc> => {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
};

interface TextBit { str: string; transform: number[]; hasEOL?: boolean }

/** Join pdf.js text items into lines, using their positions. Pure, for tests. */
export const joinTextItems = (items: TextBit[]): string => {
  let out = '';
  let lastY: number | null = null;
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    else if (out && !out.endsWith('\n') && !out.endsWith(' ') && it.str && !it.str.startsWith(' ')) out += ' ';
    out += it.str;
    if (it.hasEOL) out += '\n';
    lastY = y;
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
};

/** The text of one page (1-based). Empty for scanned pages. */
export const pageText = async (doc: PdfDoc, n: number): Promise<string> => {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  page.cleanup();
  return joinTextItems(content.items.filter((i): i is TextBit & typeof i => 'str' in i));
};

/**
 * A page with fewer letters than this has no real text layer (a scan or a
 * picture) and is read from an image. Short pages such as title slides do
 * have text, so they stay free.
 */
export const SCANNED_BELOW = 3;

const canvasToJpeg = (canvas: HTMLCanvasElement): string => {
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= MAX_IMAGE_DATA_URL) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.3);
};

/** Render one page (1-based) as a JPEG data URL for the vision model. */
export const pageImage = async (doc: PdfDoc, n: number, maxSide = 1800): Promise<string> => {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, maxSide / Math.max(base.width, base.height)) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvasToJpeg(canvas);
};

/** Shrink a photo to at most `maxSide` pixels and encode it as JPEG under the size limit. */
export const photoToDataUrl = async (file: Blob, maxSide = 1800): Promise<string> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
};

/** "1-3, 7, 10-8" → [1, 2, 3, 7, 8, 9, 10], limited to 1..max. Pure, for tests. */
export const parsePageRange = (text: string, max: number): number[] => {
  const pages = new Set<number>();
  for (const part of text.split(/[,،;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:[-–](\d+))?$/);
    if (!m) continue;
    let a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (a > b) [a, b] = [b, a];
    for (let p = Math.max(1, a); p <= Math.min(max, b); p++) pages.add(p);
  }
  return [...pages].sort((x, y) => x - y);
};

/** [1, 2, 3, 7, 9, 10] → "1-3, 7, 9-10". */
export const formatPageRange = (pages: number[]): string => {
  const out: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    out.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
    i = j;
  }
  return out.join(', ');
};

/** Run `fn` over items, `limit` at a time, keeping order. Stops at the first error. */
export const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> => {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};
