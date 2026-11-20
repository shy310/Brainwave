import { Capacitor } from '@capacitor/core';

/** True inside the Android app. */
export const isNativeApp = () => Capacitor.isNativePlatform();

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Full URL for a backend path. The web app is served with its API, so paths
 * stay relative; the Android app calls the deployed backend (VITE_API_URL).
 */
export const apiUrl = (path: string) => `${API_BASE}${path}`;

/** The public web address, for links people open elsewhere (share links). */
export const publicUrl = (path: string) =>
  `${(import.meta.env.VITE_PUBLIC_URL || (isNativeApp() ? '' : window.location.origin) || window.location.origin).replace(/\/$/, '')}${path}`;
