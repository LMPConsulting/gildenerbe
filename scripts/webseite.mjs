// Baut alle vier Reisespiele als Webfassung in einen Ordner und schreibt die
// Startseite dazu. Aufruf:
//
//   node scripts/webseite.mjs <zielordner>
//
// Ergebnis:
//   <ziel>/index.html          Startseite mit den vier Kacheln
//   <ziel>/stil.css            Stil der Startseite
//   <ziel>/<spiel>/index.html  das Spiel (Stil und Skript als eigene Dateien)
//   <ziel>/<spiel>/Spiel.html  dieselbe Fassung als eine Datei zum Mitnehmen
//
// Der Spieleserver liefert diesen Ordner unverändert aus; die Spiele erreichen
// die Durchreiche unter ../api.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(here, '..');
const ziel = resolve(process.argv[2] || join(wurzel, 'web'));

const SPIELE = [
  {
    ordner: 'qwixx',
    titel: 'Qwixx',
    zeile: 'Würfeln, ankreuzen, hoffen',
    text: 'Zwei weiße und vier farbige Würfel, vier Reihen, immer nur von links nach rechts. '
      + 'Kurz, schnell, jedes Mal anders.',
    dauer: '15 Minuten',
    zwei: 'Beide gleichzeitig auf zwei Handys',
    farbe: '#2a6ed4',
    icon: '<circle cx="18" cy="18" r="8"/><circle cx="46" cy="18" r="8"/>'
      + '<circle cx="18" cy="46" r="8"/><circle cx="46" cy="46" r="8"/>',
  },
  {
    ordner: 'dreikampf',
    titel: 'Dreikampf',
    zeile: 'Wissen · Wahrheit · Wagnis',
    text: 'Allgemeinwissen gegeneinander, ehrliche Fragen übereinander, Mutproben für unterwegs. '
      + 'Die Punkte laufen über den ganzen Urlaub weiter.',
    dauer: 'so lange ihr wollt',
    zwei: 'Auf zwei Handys, Antworten bleiben verdeckt',
    farbe: '#c9a227',
    icon: '<path d="M32 8 L54 46 H10 Z" fill="none" stroke-width="6" stroke-linejoin="round"/>',
  },
  {
    ordner: 'cabo',
    titel: 'Cabo',
    zeile: 'Vier Karten, keiner weiß welche',
    text: 'Wer am wenigsten hat, gewinnt — wenn er sich traut, Cabo zu rufen. '
      + 'Peek, Spy, Swap und Pärchen abwerfen.',
    dauer: '20 Minuten',
    zwei: 'Auf zwei Handys, fremde Karten bleiben geheim',
    farbe: '#8a2c3d',
    icon: '<rect x="12" y="10" width="26" height="38" rx="4" fill="none" stroke-width="5"/>'
      + '<rect x="26" y="16" width="26" height="38" rx="4" fill="none" stroke-width="5"/>',
  },
  {
    ordner: 'skyteam',
    titel: 'Sky Team',
    zeile: 'Zusammen landen — schweigend',
    text: 'Pilot und Kopilot bringen ein Flugzeug herunter. Acht Würfel pro Runde, '
      + 'zwei Pflichthebel, und ab dem Wurf wird nicht mehr geredet.',
    dauer: '20 Minuten',
    zwei: 'Auf zwei Handys, jeder sieht nur seine Würfel',
    farbe: '#f0a92b',
    icon: '<path d="M56 32 L20 39 L11 54 H6 L13 38 L4 34 V30 L13 26 L6 10 H11 L20 25 Z"/>',
  },
];

mkdirSync(ziel, { recursive: true });

for (const spiel of SPIELE) {
  execFileSync('node', [join(wurzel, spiel.ordner, 'build.mjs'), '--web', join(ziel, spiel.ordner)],
    { stdio: 'inherit' });
}

/* ------------------------------------------------------------- Startseite */

// Vier Punkte in den Farben der vier Spiele — reicht als Symbol und spart einen
// zusätzlichen Abruf (und damit einen 404 auf /favicon.ico).
const SYMBOL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  + '<rect width="64" height="64" rx="14" fill="#11151c"/>'
  + SPIELE.map((s, i) => `<circle cx="${i % 2 ? 42 : 22}" cy="${i < 2 ? 22 : 42}" r="9" fill="${s.farbe}"/>`).join('')
  + '</svg>';
const symbolUrl = 'data:image/svg+xml,' + encodeURIComponent(SYMBOL);
const manifestUrl = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify({
  name: 'Spiele', short_name: 'Spiele', start_url: '.', display: 'standalone',
  background_color: '#11151c', theme_color: '#11151c',
  description: 'Vier Reisespiele für zwei Handys.',
  icons: [{ src: symbolUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
}));

const kachel = (s) => `
      <a class="spiel" href="${s.ordner}/" style="--akzent:${s.farbe}">
        <svg class="zeichen" viewBox="0 0 64 64" aria-hidden="true">${s.icon}</svg>
        <div class="text">
          <h2>${s.titel}</h2>
          <p class="zeile">${s.zeile}</p>
          <p class="beschreibung">${s.text}</p>
          <p class="fakten"><span>${s.dauer}</span><span>${s.zwei}</span></p>
        </div>
        <span class="pfeil" aria-hidden="true">→</span>
      </a>`;

const startseite = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#11151c">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Vier Reisespiele für zwei Handys — Qwixx, Dreikampf, Cabo und Sky Team.">
<title>Spiele</title>
<link rel="icon" href="${symbolUrl}">
<link rel="apple-touch-icon" href="${symbolUrl}">
<link rel="manifest" href="${manifestUrl}">
<link rel="stylesheet" href="stil.css">
</head>
<body>
<div class="blatt">
  <header class="kopf">
    <p class="ober">Für zwei</p>
    <h1>Spiele</h1>
    <p class="unter">Vier Spiele, die ihr zu zweit spielen könnt — jedes auf einem Handy
      zum Weiterreichen oder auf <strong>zwei Handys gleichzeitig</strong>. Für zwei Handys
      öffnet einer einen Raum und gibt den fünfstelligen Code weiter; ihr müsst
      <strong>nicht</strong> im selben WLAN sein.</p>
  </header>

  <main class="liste">${SPIELE.map(kachel).join('')}
  </main>

  <section class="hinweiskasten">
    <h3>Ohne Netz, im Flugzeug</h3>
    <p>Jedes Spiel gibt es auch als <strong>einzelne Datei</strong>: im Spiel unter
      <em>Menü → Spiel als Datei sichern</em>. Die liegt danach in den Downloads, läuft
      komplett offline und lässt sich weitergeben. Zwei Handys ohne Internet koppeln sich
      dann per QR-Code im selben WLAN oder Hotspot.</p>
    <p>Oder legt euch die Seite über <em>Zum Startbildschirm hinzufügen</em> wie eine App
      auf den Homescreen.</p>
  </section>

  <footer class="fuss">Privat. Keine Konten, keine Werbung, keine Auswertung.</footer>
</div>
</body>
</html>
`;

const stil = `/* Startseite der Spielesammlung — dunkel, ruhig, groß genug für Daumen. */

:root {
  --grund: #11151c;
  --grund-2: #0a0d13;
  --karte: #1a212c;
  --naht: #2b3543;
  --text: #e8edf4;
  --leise: #8e9bad;
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--grund);
  background-image: radial-gradient(120% 40% at 50% 0%, #1d2836 0%, rgba(29, 40, 54, 0) 70%),
    linear-gradient(180deg, var(--grund) 0%, var(--grund-2) 100%);
  background-attachment: fixed;
  color: var(--text);
  font-family: var(--font);
  line-height: 1.55;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}

.blatt { max-width: 640px; margin-inline: auto; padding: calc(var(--safe-t) + 30px) 18px calc(28px + var(--safe-b)); }

.kopf .ober {
  margin: 0; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--leise); font-weight: 700;
}
.kopf h1 { margin: 4px 0 10px; font-size: clamp(34px, 11vw, 48px); letter-spacing: -0.02em; }
.kopf .unter { margin: 0 0 26px; color: var(--leise); font-size: 15px; text-wrap: pretty; }
.kopf strong { color: var(--text); font-weight: 650; }

.liste { display: flex; flex-direction: column; gap: 12px; }
.spiel {
  display: flex; align-items: center; gap: 14px;
  background: var(--karte); border: 1px solid var(--naht);
  border-left: 4px solid var(--akzent);
  border-radius: 16px; padding: 16px 14px;
  text-decoration: none; color: inherit;
  transition: transform 0.12s ease, border-color 0.15s ease;
}
.spiel:active { transform: scale(0.99); }
.spiel:focus-visible { outline: 2px solid var(--akzent); outline-offset: 3px; }
.zeichen { width: 40px; height: 40px; flex: none; fill: var(--akzent); stroke: var(--akzent); }
.spiel .text { flex: 1; min-width: 0; }
.spiel h2 { margin: 0; font-size: 19px; letter-spacing: -0.01em; }
.spiel .zeile { margin: 1px 0 6px; font-size: 13px; color: var(--akzent); font-weight: 600; }
.spiel .beschreibung { margin: 0; font-size: 13.5px; color: var(--leise); }
.spiel .fakten { margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.spiel .fakten span {
  font-size: 11px; color: var(--leise);
  border: 1px solid var(--naht); border-radius: 999px; padding: 2px 8px;
}
.spiel .pfeil { color: var(--leise); font-size: 20px; flex: none; }

.hinweiskasten {
  margin-top: 26px; background: var(--karte); border: 1px solid var(--naht);
  border-radius: 16px; padding: 16px;
}
.hinweiskasten h3 {
  margin: 0 0 8px; font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--leise);
}
.hinweiskasten p { margin: 0 0 10px; font-size: 14px; color: var(--leise); }
.hinweiskasten p:last-child { margin-bottom: 0; }
.hinweiskasten strong { color: var(--text); font-weight: 650; }
.hinweiskasten em { color: var(--text); font-style: normal; }

.fuss { margin-top: 24px; text-align: center; font-size: 12px; color: var(--leise); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

writeFileSync(join(ziel, 'index.html'), startseite);
writeFileSync(join(ziel, 'stil.css'), stil);
console.log(`\nStartseite geschrieben: ${join(ziel, 'index.html')}`);
console.log(`Fertig — ${SPIELE.length} Spiele unter ${ziel}`);
