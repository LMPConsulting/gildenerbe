// Baut aus hangman/src/* eine einzige, in sich geschlossene HTML-Datei.
// Kein CDN, keine externen Dateien: läuft per Doppelklick (file://) und offline.
//
//   node hangman/build.mjs            -> hangman/index.html
//   node hangman/build.mjs --fragment out.html   (Rumpf ohne <html>/<head>, für Artifacts)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const MODULE = ['src/qr.js', 'src/funk.js', 'src/netz.js', 'src/woerter.js',
  'src/engine.js', 'src/galgen.js', 'src/ui.js'];

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

const rumpf = `(function () {\n'use strict';\n${teile.join('\n')}\n})();`;
const css = read('src/style.css');

// Eine Schultafel mit Galgen und drei leeren Lücken.
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" rx="14" fill="#1b2422"/>`
  + `<g fill="none" stroke="#eef3ef" stroke-width="3" stroke-linecap="round">`
  + `<path d="M12 44h16M16 44V16h18"/><path d="M34 16v6"/>`
  + `<circle cx="34" cy="27" r="5"/><path d="M34 32v10"/></g>`
  + `<g stroke="#7fd1b9" stroke-width="3" stroke-linecap="round">`
  + `<path d="M42 52h5M50 52h5"/></g>`
  + `<path d="M12 52h5" stroke="#7fd1b9" stroke-width="3" stroke-linecap="round"/></svg>`;
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(ICON);

const manifest = {
  name: 'Galgenmännchen', short_name: 'Galgen', start_url: '.', display: 'standalone',
  orientation: 'portrait', background_color: '#1b2422', theme_color: '#1b2422',
  description: 'Galgenmännchen — einer stellt das Wort, der andere rät. Komplett offline.',
  icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

// Ein Kopf für beide Zwecke: die gebaute Seite und die Kopie, die sich das
// Spiel im Browser selbst herunterlädt.
const kopf = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#1b2422">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="Galgenmännchen – Buchstaben raten zu zweit. An einem Handy oder auf zweien, komplett offline.">
<title>Galgenmännchen</title>
<link rel="icon" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<link rel="manifest" href="${manifestUrl}">`;

const script = `const SEITENKOPF = ${JSON.stringify(kopf)};\n${rumpf}`;

const body = `<div id="app"></div>\n<script id="hangman-js">\n${script}\n</script>`;

const page = `<!doctype html>
<html lang="de">
<head>
${kopf}
<style id="hangman-css">
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
  const mitnahme = 'Galgenmaennchen.html';
  // Ohne Durchreiche (z.B. auf einer reinen Dateiablage wie GitHub Pages) gibt
  // es keinen Raumcode — die Spiele blenden die Knöpfe dann selbst aus.
  const ohneServer = process.argv.includes('--ohne-server');
  const webScript = [
    `const SEITENKOPF = ${JSON.stringify(kopf)};`,
    ohneServer ? 'const SPIELE_BASIS = null;' : "const SPIELE_BASIS = '..';",
    `const OFFLINE_DATEI = ${JSON.stringify(mitnahme)};`,
    rumpf,
  ].join('\n');
  writeFileSync(join(ziel, 'spiel.js'), webScript);
  writeFileSync(join(ziel, 'stil.css'), css);
  writeFileSync(join(ziel, 'index.html'), [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    '<link rel="stylesheet" href="stil.css">',
    '<script src="spiel.js" defer></' + 'script>',
    '<script src="../sw-reg.js" defer></' + 'script>',
    '</head>', '<body>', '<div id="app"></div>', '</body>', '</html>', '',
  ].join('\n'));
  writeFileSync(join(ziel, mitnahme), page);
  console.log(`Webfassung: ${ziel} (index.html + spiel.js + stil.css + ${mitnahme})`);
  process.exit(0);
}

const fragmentFlag = process.argv.indexOf('--fragment');
if (fragmentFlag !== -1) {
  const out = resolve(process.argv[fragmentFlag + 1] || 'hangman-fragment.html');
  writeFileSync(out, `<title>Galgenmännchen</title>\n<style id="hangman-css">\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${out}`);
} else {
  const out = join(here, 'index.html');
  writeFileSync(out, page);
  console.log(`Gebaut: ${out} (${(page.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
