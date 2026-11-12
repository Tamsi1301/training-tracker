/**
 * Erzeugt alle App-Icons (PNG) aus dem Monogramm und den Farben in src/config.ts.
 * Aufruf: npm run icons   (nutzt das vorinstallierte Chromium über Playwright)
 *
 * Eigenes Icon verwenden: einfach die PNG-Dateien in public/icons/ ersetzen
 * (apple-touch-icon.png 180×180, icon-192.png, icon-512.png, icon-maskable-512.png, favicon-32.png).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright ist in der Entwicklungsumgebung global installiert (kein Projekt-Paket nötig).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = new URL('..', import.meta.url);
const cfg = readFileSync(new URL('src/config.ts', root), 'utf8');
const pick = (k, d) => cfg.match(new RegExp(`${k}:\\s*'([^']*)'`))?.[1] ?? d;
const monogram = pick('monogram', 'T');
const bg = pick('iconBackground', '#3A3A3C');
const fg = pick('iconForeground', '#C9AE78');
const font = readFileSync(new URL('src/assets/fonts/jost-latin-wght-normal.woff2', root)).toString('base64');

const html = (size, { maskable = false, rounded = false } = {}) => `<!doctype html><html><head><style>
@font-face { font-family: Jost; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html,body{margin:0;background:transparent}
.i{width:${size}px;height:${size}px;display:grid;place-items:center;position:relative;overflow:hidden;
  background: radial-gradient(120% 120% at 30% 15%, color-mix(in srgb, ${bg} 82%, white) 0%, ${bg} 55%, color-mix(in srgb, ${bg} 85%, black) 100%);
  ${rounded ? `border-radius:${size * 0.225}px;` : ''}}
.m{font-family:Jost;font-weight:300;color:${fg};font-size:${size * (maskable ? 0.42 : 0.56)}px;line-height:1;
  letter-spacing:-0.02em;transform:translateY(${size * 0.01}px);
  background:linear-gradient(170deg, color-mix(in srgb, ${fg} 70%, white), ${fg} 45%, color-mix(in srgb, ${fg} 80%, black));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.r{position:absolute;inset:${size * (maskable ? 0.2 : 0.12)}px;border:${Math.max(1, size * 0.008)}px solid color-mix(in srgb, ${fg} 45%, transparent);border-radius:50%}
</style></head><body><div class="i"><div class="r"></div><div class="m">${monogram}</div></div></body></html>`;

const targets = [
  ['apple-touch-icon.png', 180, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['favicon-32.png', 32, { rounded: true }],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, opts] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, opts));
  await page.evaluate(async () => {
    await document.fonts.load('300 100px Jost');
    await document.fonts.ready;
  });
  await page.locator('.i').screenshot({ path: fileURLToPath(new URL(`public/icons/${name}`, root)), omitBackground: !!opts.rounded });
  console.log('✓', name);
}
await browser.close();
