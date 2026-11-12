import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
} as any);
