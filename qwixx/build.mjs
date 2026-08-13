// Baut aus qwixx/src/* eine einzige, in sich geschlossene HTML-Datei.
// Kein CDN, keine externen Dateien: läuft per Doppelklick (file://) und offline.
//
//   node qwixx/build.mjs            -> qwixx/index.html
//   node qwixx/build.mjs --fragment out.html   (Rumpf ohne <html>/<head>, für Artifacts)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const css = read('src/style.css');

const MODULE = ['src/engine.js', 'src/netz.js', 'src/ui.js'];

// Alle Module landen in einem gemeinsamen Scope — gleichnamige Deklarationen in
// zwei Dateien wären dort ein SyntaxError. Lieber hier auffallen als im Browser.
function kollisionenPruefen(namen) {
  const gesehen = new Map();
  for (const [datei, roh] of namen) {
    const re = /^(?:export )?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
    for (const treffer of roh.matchAll(re)) {
      const id = treffer[1];
      if (gesehen.has(id)) {
        throw new Error(`"${id}" ist in ${gesehen.get(id)} und ${datei} deklariert — bitte umbenennen.`);
      }
      gesehen.set(id, datei);
    }
  }
}

kollisionenPruefen(MODULE.map((d) => [d, read(d)]));

// ES-Module dürfen über file:// nichts nachladen — darum ein klassisches Script.
const teile = MODULE.map((datei) => {
  const roh = read(datei);
  const ohneImporte = roh.replace(/^import\b[^;]*;\n/gm, '');
  if (/^\s*import\b/m.test(ohneImporte)) throw new Error(`Import in ${datei} nicht erkannt`);
  return ohneImporte.replace(/^export /gm, '');
});

// Wird unten mit dem Seitenkopf zusammengesetzt, damit sich die Seite selbst
// als vollständige Datei abspeichern kann.
const rumpf = `(function () {\n'use strict';\n${teile.join('\n')}\n})();`;

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

// Ein Kopf für beide Zwecke: die gebaute Seite und die Kopie, die sich das
// Spiel im Browser selbst herunterlädt.
const kopf = `<meta charset="utf-8">
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
<link rel="manifest" href="${manifestUrl}">`;

const script = `const SEITENKOPF = ${JSON.stringify(kopf)};\n${rumpf}`;

const body = `<div id="app"></div>\n<script id="qwixx-js">\n${script}\n</script>`;

const page = `<!doctype html>
<html lang="de">
<head>
${kopf}
<style id="qwixx-css">
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;


// --- Fassung für die Webseite ------------------------------------------------
// Auf lmp-docmatch.de gilt eine strenge Content-Security-Policy ohne
// 'unsafe-inline'. Darum wandern Stil und Skript in eigene Dateien; die
// Einzeldatei zum Mitnehmen wird gleich mit danebengelegt.
const webFlagge = process.argv.indexOf('--web');
if (webFlagge !== -1) {
  const ziel = resolve(process.argv[webFlagge + 1] || 'web');
  mkdirSync(ziel, { recursive: true });
  const mitnahme = 'Qwixx.html';
  const webScript = [
    `const SEITENKOPF = ${JSON.stringify(kopf)};`,
    "const SPIELE_BASIS = '..';",
    `const OFFLINE_DATEI = ${JSON.stringify(mitnahme)};`,
    rumpf,
  ].join('\n');
  writeFileSync(join(ziel, 'spiel.js'), webScript);
  writeFileSync(join(ziel, 'stil.css'), css);
  writeFileSync(join(ziel, 'index.html'), [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    '<link rel="stylesheet" href="stil.css">',
    '<script src="spiel.js" defer></' + 'script>',
    '</head>', '<body>', '<div id="app"></div>', '</body>', '</html>', '',
  ].join('\n'));
  writeFileSync(join(ziel, mitnahme), page);
  console.log(`Webfassung: ${ziel} (index.html + spiel.js + stil.css + ${mitnahme})`);
  process.exit(0);
}

const fragmentFlag = process.argv.indexOf('--fragment');
if (fragmentFlag !== -1) {
  const out = resolve(process.argv[fragmentFlag + 1] || 'qwixx-fragment.html');
  writeFileSync(out, `<title>Qwixx</title>\n<style id="qwixx-css">\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${out}`);
} else {
  const out = join(here, 'index.html');
  writeFileSync(out, page);
  console.log(`Gebaut: ${out} (${(page.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
