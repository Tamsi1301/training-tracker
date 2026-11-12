import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Name und Farben stehen zentral in src/config.ts – hier nur gespiegelt gelesen.
const configSource = readFileSync(new URL('./src/config.ts', import.meta.url), 'utf8');
const pick = (key: string, fallback: string) =>
  configSource.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] ?? fallback;

const name = pick('name', 'Training');
const shortName = pick('shortName', name);
const description = pick('description', '');
const bgLight = pick('backgroundLight', '#F6F5F2');

process.env.VITE_APP_VERSION = pkg.version;

export default defineConfig({
  // Relative Pfade: funktioniert unter https://<user>.github.io/<repo>/ und lokal.
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'vorlagen/*.csv'],
      manifest: {
        id: './',
        name,
        short_name: shortName,
        description,
        lang: 'de',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: bgLight,
        theme_color: bgLight,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,csv,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
