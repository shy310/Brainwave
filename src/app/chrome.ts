import { useEffect, useSyncExternalStore } from 'react';

// Pages with their own bottom controls (a lecture's dock) hide the phone tab bar while open.
let hiders = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const useHideTabBar = (hide = true) => {
  useEffect(() => {
    if (!hide) return;
    hiders++;
    emit();
    return () => { hiders--; emit(); };
  }, [hide]);
};

export const useTabBarHidden = () => useSyncExternalStore(
  (l) => { listeners.add(l); return () => listeners.delete(l); },
  () => hiders > 0,
  () => false,
);
