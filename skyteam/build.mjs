// Baut aus skyteam/src/* eine einzige, in sich geschlossene HTML-Datei.
// Kein CDN, keine externen Dateien: läuft per Doppelklick (file://) und offline.
//
//   node skyteam/build.mjs            -> skyteam/index.html
//   node skyteam/build.mjs --fragment out.html   (Rumpf ohne <html>/<head>, für Artifacts)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const MODULE = ['src/qr.js', 'src/funk.js', 'src/netz.js', 'src/engine.js', 'src/lehre.js', 'src/ui.js'];

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

// Ein Flugzeug im Sinkflug über der Landebahn — das Bild des Spiels.
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" rx="14" fill="#0b1220"/>`
  + `<path d="M8 50h48" stroke="#29364a" stroke-width="3" stroke-linecap="round"/>`
  + `<path d="M14 50h8M28 50h8M42 50h8" stroke="#f0a92b" stroke-width="3" stroke-linecap="round"/>`
  + `<path d="M50 14 L26 33 L16 29 L12 33 L21 39 L24 46 L28 42 L26 33" fill="none" stroke="#e9eff7"`
  + ` stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
  + `<circle cx="50" cy="14" r="4" fill="#f0a92b"/></svg>`;
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(ICON);

const manifest = {
  name: 'Sky Team', short_name: 'Sky Team', start_url: '.', display: 'standalone',
  orientation: 'portrait', background_color: '#0b1220', theme_color: '#0b1220',
  description: 'Sky Team — Pilot und Kopilot landen zu zweit ein Flugzeug. Komplett offline.',
  icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

// Ein Kopf für beide Zwecke: die gebaute Seite und die Kopie, die sich das
// Spiel im Browser selbst herunterlädt.
const kopf = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1220">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="Sky Team – kooperatives Würfelspiel für zwei. Pilot und Kopilot landen gemeinsam ein Flugzeug, komplett offline.">
<title>Sky Team</title>
<link rel="icon" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<link rel="manifest" href="${manifestUrl}">`;

const script = `const SEITENKOPF = ${JSON.stringify(kopf)};\n${rumpf}`;

const body = `<div id="app"></div>\n<script id="skyteam-js">\n${script}\n</script>`;

const page = `<!doctype html>
<html lang="de">
<head>
${kopf}
<style id="skyteam-css">
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
  const mitnahme = 'SkyTeam.html';
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
    '</head>', '<body>', '<div id="app"></div>', '</body>', '</html>', '',
  ].join('\n'));
  writeFileSync(join(ziel, mitnahme), page);
  console.log(`Webfassung: ${ziel} (index.html + spiel.js + stil.css + ${mitnahme})`);
  process.exit(0);
}

const fragmentFlag = process.argv.indexOf('--fragment');
if (fragmentFlag !== -1) {
  const out = resolve(process.argv[fragmentFlag + 1] || 'skyteam-fragment.html');
  writeFileSync(out, `<title>Sky Team</title>\n<style id="skyteam-css">\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${out}`);
} else {
  const out = join(here, 'index.html');
  writeFileSync(out, page);
  console.log(`Gebaut: ${out} (${(page.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
