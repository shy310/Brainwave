import type { CapacitorConfig } from '@capacitor/cli';

// The Android app wraps the same web build. It talks to the deployed backend
// (VITE_API_URL at build time) and uses the same Supabase accounts, so a
// student sees the same lectures on the phone and on the web.
const config: CapacitorConfig = {
  appId: 'com.brainwave.app',
  appName: 'BrainWave',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
