// Remove everything BrainWave keeps on this device (after deleting an account,
// or when a demo student deletes their data). Language and theme stay.

const KEEP = new Set(['bw.locale', 'bw.theme']);

export const clearLocalData = async () => {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('bw.') && !KEEP.has(key)) localStorage.removeItem(key);
  } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  // Unsent lecture audio and drafts.
  if (typeof indexedDB !== 'undefined') {
    const { audioStore } = await import('@/features/lectures/audioStore');
    audioStore._reset();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('bw-lecture-audio');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }
};
