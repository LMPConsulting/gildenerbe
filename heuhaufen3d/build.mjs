// Baut aus heuhaufen3d/src/* und dem eingebetteten three.js eine einzige,
// in sich geschlossene HTML-Datei. Kein CDN, keine externen Dateien: läuft per
// Doppelklick (file://) und offline.
//
//   node heuhaufen3d/build.mjs                     -> heuhaufen3d/index.html
//   node heuhaufen3d/build.mjs --fragment out.html (Rumpf ohne <html>/<head>, für Artifacts)
//   node heuhaufen3d/build.mjs --web <ordner>      (Fassung für die Spielesammlung)
//
// three.js (MIT, siehe vendor/THREE-LICENSE.txt) liegt als ES-Modul in vendor/.
// Hier wird es in eine Funktion gekapselt, die ein Objekt THREE liefert; die
// Spielmodule schreiben `import * as THREE from '…/vendor/three.module.min.js'`,
// was im Browser-Entwicklungsmodus direkt funktioniert und hier entfernt wird.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

// Reihenfolge = Abhängigkeiten: erst Daten und reine Logik, dann Grafik, dann Oberfläche.
export const MODULE = [
  'src/daten.js',
  'src/format.js',
  'src/zufall.js',
  'src/haufen.js',
  'src/wirtschaft.js',
  'src/welt.js',
  'src/nadeln.js',
  'src/lose.js',
  'src/werkzeuge.js',
  'src/gegenstaende.js',
  'src/baender.js',
  'src/laster.js',
  'src/maschinen.js',
  'src/versorgung.js',
  'src/bauen.js',
  'src/drohnen.js',
  'src/automatik.js',
  'src/spieler.js',
  'src/spiel.js',
  'src/klang.js',
  'src/grafik/texturen.js',
  'src/grafik/modelle.js',
  'src/grafik/szene3d.js',
  'src/grafik/hof3d.js',
  'src/grafik/haufen3d.js',
  'src/grafik/ansicht.js',
  'src/grafik/maschinenmodelle.js',
  'src/grafik/objekte3d.js',
  'src/steuerung.js',
  'src/ui/oberflaeche.js',
  'src/ui/forschung.js',
  'src/ui/panele.js',
  'src/ui/bauen.js',
  'src/ui/maschine.js',
  'src/ui/auftrag.js',
  'src/ui/skizze.js',
  'src/baumodus.js',
  'src/main.js',
];

// three.js: das abschließende `export{a as B,…};` wird zum Rückgabeobjekt.
function threeKapseln() {
  const roh = read('vendor/three.module.min.js');
  const start = roh.lastIndexOf('export{');
  if (start < 0) throw new Error('three.js: export-Block nicht gefunden');
  const ende = roh.indexOf('};', start);
  const liste = roh.slice(start + 'export{'.length, ende);
  const paare = liste.split(',').map((eintrag) => {
    const [lokal, als] = eintrag.trim().split(/\s+as\s+/);
    return `${als || lokal}:${lokal}`;
  });
  const kopfKommentar = roh.slice(0, roh.indexOf('*/') + 2);
  const code = roh.slice(roh.indexOf('*/') + 2, start);
  return `${kopfKommentar}\nconst THREE = (() => {${code}\nreturn {${paare.join(',')}};\n})();`;
}

// Alle Spielmodule landen in einem gemeinsamen Scope: gleichnamige Deklarationen
// in zwei Dateien wären dort ein SyntaxError. Lieber hier auffallen als im Browser.
function kollisionenPruefen(namen) {
  const gesehen = new Map([['THREE', 'vendor/three.module.min.js']]);
  for (const [datei, roh] of namen) {
    const re = /^(?:export )?(?:const|let|var|(?:async\s+)?function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
    for (const treffer of roh.matchAll(re)) {
      const id = treffer[1];
      if (gesehen.has(id)) {
        throw new Error(`"${id}" ist in ${gesehen.get(id)} und ${datei} deklariert — bitte umbenennen.`);
      }
      gesehen.set(id, datei);
    }
  }
}

function modulText(datei) {
  const roh = read(datei);
  if (/^export\s*\{/m.test(roh)) throw new Error(`${datei}: "export { … }" geht hier nicht, bitte direkt beim Deklarieren exportieren.`);
  // Umbenennen beim Import gibt es im gemeinsamen Scope nicht.
  for (const imp of roh.matchAll(/^import\s*\{([^}]*)\}/gm)) {
    if (/\bas\b/.test(imp[1])) throw new Error(`${datei}: "import { a as b }" geht hier nicht, bitte den Originalnamen nutzen.`);
  }
  // import … from '…'; auch über mehrere Zeilen
  const ohneImporte = roh.replace(/^import\b[\s\S]*?from\s+['"][^'"]+['"];?\n/gm, '');
  if (/^\s*import\b/m.test(ohneImporte)) throw new Error(`Import in ${datei} nicht erkannt`);
  return `// ---- ${datei}\n${ohneImporte.replace(/^export (default )?/gm, '')}`;
}

kollisionenPruefen(MODULE.map((d) => [d, read(d)]));

const spielCode = MODULE.map(modulText).join('\n');
const rumpf = `(function () {\n'use strict';\n${threeKapseln()}\n${spielCode}\n})();`;
// Schmale Schrift wie im Vorbild (Barlow Semi Condensed, SIL OFL 1.1, vendor/fonts/OFL.txt).
// Im Einzeldokument als data:-URL, in der Webfassung als Dateien neben stil.css.
const SCHRIFTEN = [500, 700, 800].map((w) => ({ w, datei: `barlow-semi-condensed-latin-${w}-normal.woff2` }));
const schriftRegeln = (url) => SCHRIFTEN.map(({ w, datei }) => `@font-face { font-family: "Barlow Semi Condensed"; font-style: normal; font-weight: ${w}; font-display: swap; src: url(${url(datei)}) format("woff2"); }`).join('\n');
const schriftDaten = (datei) => `data:font/woff2;base64,${readFileSync(join(here, 'vendor/fonts', datei)).toString('base64')}`;
const stil = read('src/style.css');
const css = `${schriftRegeln(schriftDaten)}\n${stil}`;

// Ein Heuhaufen unter Stahlbögen, mit einer Nadel darin.
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" rx="14" fill="#5a9ad8"/>`
  + `<path d="M4 50 Q32 -6 60 50" fill="none" stroke="#7a4a2a" stroke-width="3"/>`
  + `<rect x="0" y="50" width="64" height="14" fill="#b89a74"/>`
  + `<path d="M10 54 Q14 26 32 20 Q50 26 54 54 Z" fill="#e3a948"/>`
  + `<g stroke="#a8792a" stroke-width="2" stroke-linecap="round">`
  + `<path d="M22 46l3-7M31 42l1-8M40 47l3-8M26 32l2-5M37 33l2-5"/></g>`
  + `<path d="M38 10 L30 42" stroke="#eef2f5" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const iconUrl = 'data:image/svg+xml,' + encodeURIComponent(ICON);

const manifest = {
  name: 'Heuhaufen 3D', short_name: 'Heuhaufen 3D', start_url: '.', display: 'fullscreen',
  orientation: 'landscape', background_color: '#1a1510', theme_color: '#1a1510',
  description: 'Sechs Millionen Halme, sechs Nadeln – in 3D. Graben, verkaufen, Bänder legen, automatisieren. Komplett offline.',
  icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
};
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));

const kopf = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#1a1510">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="Heuhaufen 3D – finde sechs Nadeln in sechs Millionen Halmen, in der Ich-Perspektive. Graben, verkaufen, Förderbänder legen, Maschinen bauen. Komplett offline.">
<title>Heuhaufen 3D</title>
<link rel="icon" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<link rel="manifest" href="${manifestUrl}">`;

const script = `const SEITENKOPF = ${JSON.stringify(kopf)};\n${rumpf}`;
const body = `<div id="app"></div>\n<script id="heuhaufen3d-js">\n${script}\n</script>`;

const page = `<!doctype html>
<html lang="de">
<head>
${kopf}
<style id="heuhaufen3d-css">
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;

// --- Fassung für die Webseite ------------------------------------------------
// Auf der Sammlungsseite gilt eine strenge Content-Security-Policy ohne
// 'unsafe-inline'. Darum wandern Stil und Skript in eigene Dateien; die
// Einzeldatei zum Mitnehmen wird gleich mit danebengelegt.
const webFlagge = process.argv.indexOf('--web');
if (webFlagge !== -1) {
  const ziel = resolve(process.argv[webFlagge + 1] || 'web');
  mkdirSync(ziel, { recursive: true });
  const mitnahme = 'Heuhaufen-3D.html';
  const ohneServer = process.argv.includes('--ohne-server');
  const webScript = [
    `const SEITENKOPF = ${JSON.stringify(kopf)};`,
    ohneServer ? 'const SPIELE_BASIS = null;' : "const SPIELE_BASIS = '..';",
    `const OFFLINE_DATEI = ${JSON.stringify(mitnahme)};`,
    rumpf,
  ].join('\n');
  writeFileSync(join(ziel, 'spiel.js'), webScript);
  writeFileSync(join(ziel, 'stil.css'), `${schriftRegeln((datei) => datei)}\n${stil}`);
  for (const { datei } of SCHRIFTEN) writeFileSync(join(ziel, datei), readFileSync(join(here, 'vendor/fonts', datei)));
  writeFileSync(join(ziel, 'index.html'), [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    '<link rel="stylesheet" href="stil.css">',
    '<script src="spiel.js" defer></' + 'script>',
    '<script src="../sw-reg.js" defer></' + 'script>',
    '</head>', '<body>', '<div id="app"></div>', '</body>', '</html>', '',
  ].join('\n'));
  writeFileSync(join(ziel, mitnahme), page);
  console.log(`Webfassung: ${ziel} (index.html + spiel.js + stil.css + Schriften + ${mitnahme})`);
  process.exit(0);
}

const fragmentFlag = process.argv.indexOf('--fragment');
if (fragmentFlag !== -1) {
  const out = resolve(process.argv[fragmentFlag + 1] || 'heuhaufen3d-fragment.html');
  writeFileSync(out, `<title>Heuhaufen 3D</title>\n<style id="heuhaufen3d-css">\n${css}\n</style>\n${body}\n`);
  console.log(`Fragment geschrieben: ${out}`);
} else {
  const out = join(here, 'index.html');
  writeFileSync(out, page);
  console.log(`Gebaut: ${out} (${(page.length / 1024).toFixed(1)} kB, eine Datei, keine Abhängigkeiten)`);
}
