/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Phosphor ships every icon with all six weights; BrainWave uses three (bold,
 * fill, duotone; see src/ui/icons.tsx). Drop the others from each icon's
 * definition so the bundle carries only what can render.
 */
const ICON_WEIGHTS = new Set(['bold', 'fill', 'duotone']);
const phosphorWeights = (): Plugin => ({
  name: 'brainwave-phosphor-weights',
  enforce: 'pre',
  transform(code, id) {
    if (!/@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/.test(id)) return null;
    const start = code.indexOf('new Map([');
    const end = code.lastIndexOf(']);');
    if (start < 0 || end < 0) return null;
    const open = start + 'new Map(['.length;
    const kept = code.slice(open, end).split(/,(?=\n {2}\[\n {4}")/)
      .filter((entry) => { const m = entry.match(/^\n {2}\[\n {4}"(\w+)"/); return !m || ICON_WEIGHTS.has(m[1]); });
    return { code: code.slice(0, open) + kept.join(',') + code.slice(end), map: null };
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), phosphorWeights()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    // mathjs (~650 kB) is only loaded when a typed answer is checked.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router'] },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
