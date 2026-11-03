import type { Attachment } from '@shared/learn';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

export type FileProblem = 'type' | 'size';

export const toAttachment = async (file: File): Promise<Attachment | FileProblem> => {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_FILE_BYTES) return 'size';
    return { kind: 'pdf', name: file.name, dataUrl: await readAsDataUrl(file) };
  }
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    const blob = file.type === 'image/gif' ? file : await downscale(file).catch(() => file);
    if (blob.size > MAX_FILE_BYTES) return 'size';
    return { kind: 'image', name: file.name, dataUrl: await readAsDataUrl(blob) };
  }
  return 'type';
};
