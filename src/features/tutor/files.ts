import { MAX_ATTACHMENT_PAGE_CHARS, MAX_ATTACHMENT_PAGES, MAX_ATTACHMENT_TEXT, type Attachment } from '@shared/learn';
import { MAX_PDF_PAGES } from '@shared/lectures';

/** Files up to this size are sent whole, so the AI also sees pictures and layout. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Bigger PDFs, up to this size, are read on the device and sent as text. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Shrink big photos (phone cameras) so they fit the request limit and upload fast. */
const downscale = async (file: File, maxSide = 1600): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_FILE_BYTES) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85));
};

/** A PDF too big to send whole: its text, plus pictures of the first pages if it is a scan. */
const bigPdf = async (file: File): Promise<Attachment> => {
  const { loadPdf, looksScanned, pageImage, pageText } = await import('@/features/lectures/documents');
  const pdf = await loadPdf(file);
  try {
    const parts: string[] = [];
    let length = 0;
    for (let p = 1; p <= Math.min(pdf.numPages, MAX_PDF_PAGES) && length < MAX_ATTACHMENT_TEXT; p++) {
      const text = await pageText(pdf, p);
      if (looksScanned(text)) continue;
      const part = `Page ${p}:\n${text}`;
      parts.push(part);
      length += part.length + 2;
    }
    const text = parts.join('\n\n').slice(0, MAX_ATTACHMENT_TEXT);
    const pages: string[] = [];
    if (!text) {
      for (let p = 1; p <= Math.min(pdf.numPages, MAX_ATTACHMENT_PAGES); p++) pages.push(await pageImage(pdf, p, 1400, MAX_ATTACHMENT_PAGE_CHARS));
    }
    return { kind: 'pdfText', name: file.name, text, pages };
  } finally {
    void pdf.destroy();
  }
};

export type FileProblem = 'type' | 'size';

export const toAttachment = async (file: File): Promise<Attachment | FileProblem> => {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size <= MAX_FILE_BYTES) return { kind: 'pdf', name: file.name, dataUrl: await readAsDataUrl(file) };
    if (file.size > MAX_PDF_BYTES) return 'size';
    return bigPdf(file);
  }
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    // A big GIF is sent as a still picture of its first frame.
    const blob = file.type === 'image/gif' && file.size <= MAX_FILE_BYTES ? file : await downscale(file).catch(() => file);
    if (blob.size > MAX_FILE_BYTES) return 'size';
    return { kind: 'image', name: file.name, dataUrl: await readAsDataUrl(blob) };
  }
  return 'type';
};
