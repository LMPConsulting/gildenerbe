// Baut aus qwixx/src/* eine einzige, in sich geschlossene HTML-Datei.
// Kein CDN, keine externen Dateien: läuft per Doppelklick (file://) und offline.
//
//   node qwixx/build.mjs            -> qwixx/index.html
//   node qwixx/build.mjs --fragment out.html   (Rumpf ohne <html>/<head>, für Artifacts)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const css = read('src/style.css');

// Die Module werden zu einem klassischen Script zusammengezogen — ES-Module
// dürfen über file:// nichts nachladen.
const engine = read('src/engine.js').replace(/^export /gm, '');
const uiSrc = read('src/ui.js').replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\/engine\.js';\n/m, '');
if (uiSrc.includes("from './engine.js'")) throw new Error('Import in ui.js nicht erkannt');

const script = `(function () {\n'use strict';\n${engine}\n${uiSrc}\n})();`;

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" rx="14" fill="#0e1620"/>`
  + `<rect x="9" y="9" width="46" height="46" rx="10" fill="#f3f2ee"/>`
  + `<circle cx="23" cy="23" r="6.5" fill="#dc3b2f"/><circle cx="41" cy="23" r="6.5" fill="#e8a300"/>`
  + `<circle cx="23" cy="41" r="6.5" fill="#12995b"/><circle cx="41" cy="41" r="6.5" fill="#2a6ed4"/></svg>`;
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(ICON);

const manifest = {
  name: 'Qwixx', short_name: 'Qwixx', start_url: '.', display: 'standalone',
  orientation: 'portrait', background_color: '#0e1620', theme_color: '#0e1620',
  description: 'Qwixx-Würfelspiel für zwei bis vier Leute an einem Handy — komplett offline.',
  icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

const body = `<div id="app"></div>\n<script>\n${script}\n</script>`;

const page = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0e1620">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="Qwixx – das Würfelspiel für unterwegs. Zwei bis vier Leute an einem Handy, komplett offline.">
<title>Qwixx</title>
<link rel="icon" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<link rel="manifest" href="${manifestUrl}">
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;

const fragmentFlag = process.argv.indexOf('--fragment');
if (fragmentFlag !== -1) {
  const out = resolve(process.argv[fragmentFlag + 1] || 'qwixx-fragment.html');
  writeFileSync(out, `<title>Qwixx</title>\n<style>\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${out}`);
} else {
  const out = join(here, 'index.html');
  writeFileSync(out, page);
  console.log(`Gebaut: ${out} (${(page.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
