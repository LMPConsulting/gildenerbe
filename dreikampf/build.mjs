// Baut aus dreikampf/src/* eine einzige, in sich geschlossene HTML-Datei.
// Kein CDN, keine externen Dateien: läuft per Doppelklick (file://) und offline.
//
//   node dreikampf/build.mjs                     -> dreikampf/index.html
//   node dreikampf/build.mjs --fragment out.html    Rumpf ohne <html>/<head>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

// Reihenfolge = Abhängigkeitsreihenfolge. Die Module werden zu einem klassischen
// Script zusammengezogen, weil ES-Module über file:// nichts nachladen dürfen.
const MODULE = ['src/wissen.js', 'src/wahrheit.js', 'src/wagnis.js', 'src/engine.js', 'src/netz.js', 'src/ui.js'];

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

const teile = MODULE.map((datei) => {
  const roh = read(datei);
  const ohneImporte = roh.replace(/^import\b[^;]*;\n/gm, '');
  if (/^\s*import\b/m.test(ohneImporte)) throw new Error(`Import in ${datei} nicht erkannt`);
  return ohneImporte.replace(/^export /gm, '');
});

// Wird unten mit dem Seitenkopf zusammengesetzt, damit sich die Seite selbst
// als vollständige Datei abspeichern kann.
const rumpf = `(function () {\n'use strict';\n${teile.join('\n')}\n})();`;
const css = read('src/style.css');

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" rx="14" fill="#17111c"/>`
  + `<rect x="10" y="16" width="20" height="34" rx="4" fill="#0e6f77" transform="rotate(-11 20 33)"/>`
  + `<rect x="22" y="14" width="20" height="34" rx="4" fill="#a83a5c"/>`
  + `<rect x="34" y="16" width="20" height="34" rx="4" fill="#cf8f1a" transform="rotate(11 44 33)"/></svg>`;
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(ICON);

const manifest = {
  name: 'Dreikampf', short_name: 'Dreikampf', start_url: '.', display: 'standalone',
  orientation: 'portrait', background_color: '#17111c', theme_color: '#17111c',
  description: 'Wissen, Wahrheit, Wagnis — Duell zu zweit an einem Handy, mit Punktekonto für den ganzen Urlaub.',
  icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

// Ein Kopf für beide Zwecke: die gebaute Seite und die Kopie, die sich das
// Spiel im Browser selbst herunterlädt.
const kopf = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#17111c">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="Dreikampf – Wissen, Wahrheit, Wagnis. Duell zu zweit an einem Handy, komplett offline.">
<title>Dreikampf</title>
<link rel="icon" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<link rel="manifest" href="${manifestUrl}">`;

const script = `const SEITENKOPF = ${JSON.stringify(kopf)};\n${rumpf}`;

const body = `<div id="app"></div>\n<script id="dreikampf-js">\n${script}\n</script>`;

const seite = `<!doctype html>
<html lang="de">
<head>
${kopf}
<style id="dreikampf-css">
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
  const mitnahme = 'Dreikampf.html';
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
  writeFileSync(join(ziel, mitnahme), seite);
  console.log(`Webfassung: ${ziel} (index.html + spiel.js + stil.css + ${mitnahme})`);
  process.exit(0);
}

const flagge = process.argv.indexOf('--fragment');
if (flagge !== -1) {
  const ziel = resolve(process.argv[flagge + 1] || 'dreikampf-fragment.html');
  writeFileSync(ziel, `<title>Dreikampf</title>\n<style id="dreikampf-css">\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${ziel}`);
} else {
  const ziel = join(here, 'index.html');
  writeFileSync(ziel, seite);
  console.log(`Gebaut: ${ziel} (${(seite.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
