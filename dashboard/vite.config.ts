import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // Two entry bundles: the admin dashboard (index.html) and the touch-first
      // inspection PWA (inspect.html). Kept separate so the kiosk bundle is lean.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        inspect: path.resolve(__dirname, 'inspect.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/polyfills.ts', './src/test-utils/setup.ts'],
    globals: true,
    pool: 'threads',
    // singleThread avoids per-file worker startup overhead in devcontainer
    poolOptions: { threads: { singleThread: true } },
  } as any,
});
