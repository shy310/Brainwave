import { useEffect, useRef, useState } from 'react';

/**
 * While `active`, keep the screen on with a Screen Wake Lock. The browser
 * drops the lock whenever the page is hidden, so it is requested again each
 * time the page becomes visible.
 *
 * Also reports how long the page was in the background, so the recorder can
 * warn when a mobile browser stopped the microphone meanwhile.
 */
export const useKeepAwake = (active: boolean, onVisible?: (hiddenForMs: number, hiddenAt: number) => void) => {
  const lock = useRef<WakeLockSentinel | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const [held, setHeld] = useState(false);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const acquire = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock.current) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) { void sentinel.release(); return; }
        lock.current = sentinel;
        setHeld(true);
        sentinel.addEventListener('release', () => {
          if (lock.current === sentinel) lock.current = null;
          setHeld(false);
        });
      } catch {
        setHeld(false); // low battery, not allowed, or unsupported: recording still works
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = performance.now();
        return;
      }
      void acquire();
      if (hiddenAt.current != null) {
        const at = hiddenAt.current;
        hiddenAt.current = null;
        callback.current?.(performance.now() - at, at);
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock.current?.release().catch(() => {});
      lock.current = null;
      setHeld(false);
    };
  }, [active]);

  return { wakeLockHeld: held, wakeLockSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator };
};
