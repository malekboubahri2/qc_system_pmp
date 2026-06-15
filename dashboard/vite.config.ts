import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // The platform is served under a subpath (inspection.pmp.com/level3/). Vite
  // bakes this into every asset URL; the router basename, SW scope, manifest and
  // hard redirects read it back from import.meta.env.BASE_URL (see lib/basePath).
  base: '/level3/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // Three entry bundles, kept separate so each surface stays lean:
      //  - main    → admin dashboard (index.html)
      //  - inspect → touch-first inspection PWA (inspect.html)
      //  - andon   → public, no-login KPI wall display (andon.html)
      input: {
        main: path.resolve(__dirname, 'index.html'),
        inspect: path.resolve(__dirname, 'inspect.html'),
        andon: path.resolve(__dirname, 'andon.html'),
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
