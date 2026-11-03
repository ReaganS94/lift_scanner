import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the app from /<repo-name>/, so the production build (and `vite preview`,
// which serves that build) need that base path. The dev server stays at /.
const PAGES_BASE = '/lift_scanner/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
}));
