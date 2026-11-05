import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { readAppVersion } from './scripts/app-version';

// GitHub Pages serves the app from /<repo-name>/, so the production build (and `vite preview`,
// which serves that build) need that base path. The dev server stays at /.
const PAGES_BASE = '/lift_scanner/';

/**
 * The MediaPipe runtime the pose estimator loads. scripts/copy-mediapipe-wasm.mjs also copies
 * an ES-module build of it (vision_wasm_module_internal.*), which the app never asks for.
 */
const POSE_RUNTIME = 'mediapipe/wasm/vision_wasm_internal.{js,wasm}';

const appVersion = readAppVersion(import.meta.dirname);

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  // Shown in the app so a phone can tell which version it's running. See scripts/app-version.ts.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion.label),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appVersion.commit ?? ''),
  },
  plugins: [
    react(),
    // Makes the app installable on a phone, and able to run offline once the pose model has
    // been downloaded. See "Installing on a phone" in docs/ARCHITECTURE.md.
    VitePWA({
      // A new version waits for the user to reload (see ui/components/UpdateNotice.tsx), so an
      // update never interrupts an analysis.
      registerType: 'prompt',
      injectRegister: false,
      // The manifest's own icons are stored automatically; these are the ones index.html uses.
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lift Scanner',
        short_name: 'Lift Scanner',
        description:
          'Review squat, deadlift and bench press form from a phone video, entirely on device.',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // The icon is drawn to stay inside the safe zone, so it works under any mask shape.
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app and the MediaPipe runtime (about 15 MB) are stored when the app is first
        // opened, and replaced whenever a deploy changes them.
        globPatterns: ['**/*.{js,css,html,woff2}', POSE_RUNTIME],
        globIgnores: ['mediapipe/wasm/vision_wasm_module_internal.*'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            // The pose model comes from Google on first use. Its URL names its version, so a
            // stored copy never goes stale.
            urlPattern: ({ url }) =>
              url.origin === 'https://storage.googleapis.com' &&
              url.pathname.startsWith('/mediapipe-models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pose-model',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}));
