import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brainwave.app',
  appName: 'BrainWave',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
