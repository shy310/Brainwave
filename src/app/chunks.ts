// After a new deploy, a tab opened before it still asks for the old code files
// (their names change with every build). Those are gone, so opening a page
// fails with "Failed to fetch dynamically imported module". Reloading once
// picks up the new version; if that doesn't help, the error screen says so.

const KEY = 'bw.chunkReload';
const WINDOW_MS = 30_000;

/** True for the errors browsers give when a code file can't be loaded. */
export const isChunkError = (err: unknown): boolean => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg);
};

/**
 * Load `href` afresh to get the new version — the page the student was going
 * to, not the one they're leaving. At most once every 30 s, so a real outage
 * can't loop. Returns true if it's loading.
 */
export const reloadOnce = (href = window.location.href, now = Date.now()): boolean => {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch { return false; }
  if (href === window.location.href) window.location.reload();
  else window.location.assign(href);
  return true;
};
