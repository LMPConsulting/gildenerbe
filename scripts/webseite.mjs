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
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(here, '..');
const argumente = process.argv.slice(2).filter((a) => a !== '--ohne-server');
const ohneServer = process.argv.includes('--ohne-server');
const ziel = resolve(argumente[0] || join(wurzel, 'web'));

const SPIELE = [
  {
    ordner: 'qwixx',
    titel: 'Qwixx',
    zeile: 'Würfeln, ankreuzen, hoffen',
    text: 'Zwei weiße und vier farbige Würfel, vier Reihen, immer nur von links nach rechts. '
      + 'Kurz, schnell, jedes Mal anders.',
    dauer: '15 Minuten',
    zwei: 'Zwei Handys',
    zweiOhne: 'Ein Handy zum Weiterreichen',
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
    zwei: 'Zwei Handys, Antworten verdeckt',
    zweiOhne: 'Ein Handy zum Weiterreichen',
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
    zwei: 'Zwei Handys, fremde Karten geheim',
    zweiOhne: 'Zwei Handys per QR im selben WLAN',
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
    zwei: 'Zwei Handys, eigene Würfel geheim',
    zweiOhne: 'Zwei Handys per QR im selben WLAN',
    farbe: '#f0a92b',
    icon: '<path d="M56 32 L20 39 L11 54 H6 L13 38 L4 34 V30 L13 26 L6 10 H11 L20 25 Z"/>',
  },
];

mkdirSync(ziel, { recursive: true });

for (const spiel of SPIELE) {
  execFileSync('node', [
    join(wurzel, spiel.ordner, 'build.mjs'), '--web', join(ziel, spiel.ordner),
    ...(ohneServer ? ['--ohne-server'] : []),
  ], { stdio: 'inherit' });
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
          <p class="fakten"><span>${s.dauer}</span><span>${ohneServer ? s.zweiOhne : s.zwei}</span></p>
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
<script src="sw-reg.js" defer></script>
</head>
<body>
<div class="blatt">
  <header class="kopf">
    <p class="ober">Für zwei</p>
    <h1>Spiele</h1>
    <p class="unter">${ohneServer
      ? `Vier Spiele für zwei. <strong>Cabo</strong> und <strong>Sky Team</strong> laufen auf
         <strong>zwei Handys gleichzeitig</strong> — koppeln per QR-Code, dafür müsst ihr im
         selben WLAN oder Hotspot sein. <strong>Qwixx</strong> und <strong>Dreikampf</strong>
         spielt ihr an einem Handy, das ihr euch hin und her gebt.`
      : `Vier Spiele, die ihr zu zweit spielen könnt — jedes auf einem Handy zum
         Weiterreichen oder auf <strong>zwei Handys gleichzeitig</strong>. Dafür öffnet einer
         einen Raum und gibt den fünfstelligen Code weiter; ihr müsst <strong>nicht</strong>
         im selben WLAN sein.`}</p>
  </header>

  <main class="liste">${SPIELE.map(kachel).join('')}
  </main>

  <section class="hinweiskasten">
    <h3>Vor dem Flug: einmal installieren</h3>
    <p><strong>Auf beiden Handys</strong> im Chrome-Menü (⋮) auf
      <em>Zum Startbildschirm hinzufügen</em> tippen. Danach liegt „Spiele“ wie eine App
      auf dem Homescreen und läuft <strong>komplett ohne Netz</strong> — alle vier Spiele
      sind dann auf dem Gerät gespeichert.</p>
    <p><span class="offlineampel" id="offlineampel">wird gespeichert …</span></p>
    <p>Zu zweit ohne Internet: Einer macht seinen <strong>Hotspot</strong> an, der andere
      verbindet sich damit. Dann im Spiel <em>Auf zwei Handys → QR zeigen</em> bzw.
      <em>QR scannen</em>. Es wird kein Internet gebraucht, nur die Funkstrecke zwischen
      euren beiden Geräten.</p>
    <p><strong>Wichtig beim Koppeln:</strong> Wenn ein Handy nach der <em>Kamera</em> fragt,
      erlaubt sie — auf beiden Geräten, auch auf dem, das nur den Code zeigt. Ohne diese
      Freigabe verrät Chrome die eigene WLAN-Adresse nicht, und die Handys suchen sich
      vergeblich.</p>
    <p>Wer lieber eine einzelne Datei mitnimmt: in jedem Spiel unter
      <em>Menü → Spiel als Datei sichern</em>.</p>
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

.offlineampel {
  display: inline-block; font-size: 12.5px; font-weight: 650;
  border: 1px solid var(--naht); border-radius: 999px; padding: 4px 12px;
}
.offlineampel.bereit { color: #5ec98a; border-color: #2f6b48; }
.offlineampel.fehlt { color: #e2a34f; border-color: #6b532f; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

writeFileSync(join(ziel, 'index.html'), startseite);
writeFileSync(join(ziel, 'stil.css'), stil);
console.log(`\nStartseite geschrieben: ${join(ziel, 'index.html')}`);
console.log(`Fertig — ${SPIELE.length} Spiele unter ${ziel}`);

/* ------------------------------------------------- Offline: Service Worker */

// Alle erzeugten Dateien einsammeln — genau die kommen in den Vorrat.
function dateienSammeln(ordner, praefix = '') {
  const raus = [];
  for (const eintrag of readdirSync(ordner).sort()) {
    const voll = join(ordner, eintrag);
    if (statSync(voll).isDirectory()) raus.push(...dateienSammeln(voll, `${praefix}${eintrag}/`));
    else raus.push({ pfad: `${praefix}${eintrag}`, inhalt: readFileSync(voll) });
  }
  return raus;
}

// sw.js und sw-reg.js bleiben aussen vor: sonst sammelt ein zweiter Lauf die
// Ergebnisse des ersten mit ein und die Marke waere bei gleichem Inhalt anders.
const dateien = dateienSammeln(ziel).filter((d) => d.pfad !== 'sw.js' && d.pfad !== 'sw-reg.js');
// Der Name des Vorrats hängt am Inhalt: neue Fassung -> neuer Name -> alter Vorrat fliegt raus.
const stempel = createHash('sha1');
for (const d of dateien) stempel.update(d.pfad).update(d.inhalt);
const marke = stempel.digest('hex').slice(0, 12);

// Die dicken Einzeldateien zum Mitnehmen sind im Vorrat verzichtbar — sie laufen
// ohnehin für sich allein und würden den Erstbesuch unnötig aufblähen.
const vorrat = [
  './',
  './sw-reg.js',
  // Die Spiele werden als Verzeichnis aufgerufen (/qwixx/), im Vorrat liegt aber
  // die Datei darin. Beide Adressen aufnehmen, sonst greift offline nur der
  // Notnagel und liefert die Startseite.
  ...SPIELE.map((sp) => `./${sp.ordner}/`),
  ...dateien.map((d) => `./${d.pfad}`).filter((pf) => !/\/[A-Z][A-Za-z]*\.html$/.test(pf)),
];

writeFileSync(join(ziel, 'sw.js'), `// Erzeugt von scripts/webseite.mjs — nicht von Hand ändern.
//
// Aufgabe: die Sammlung beim ersten Besuch vollstaendig auf das Geraet legen,
// damit sie im Flugzeug ohne Netz startet. Danach wird immer zuerst aus dem
// Vorrat geliefert und im Hintergrund nach einer neuen Fassung geschaut.

const VORRAT = 'spiele-${marke}';
const DATEIEN = ${JSON.stringify(vorrat, null, 2)};

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VORRAT);
    // Einzeln, damit eine fehlende Datei nicht die ganze Installation kippt.
    await Promise.all(DATEIEN.map((d) => c.add(new Request(d, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== VORRAT) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const c = await caches.open(VORRAT);
    // Verzeichnis -> index.html darin; erst danach der Notnagel Startseite.
    const alsIndex = url.pathname.endsWith('/')
      ? new URL(url.pathname + 'index.html', url.origin).href : null;
    const treffer = await c.match(anfrage, { ignoreSearch: true })
      || (alsIndex ? await c.match(alsIndex, { ignoreSearch: true }) : null)
      || (anfrage.mode === 'navigate' ? await c.match('./') : null);
    // Im Hintergrund auffrischen, aber niemals auf das Netz warten.
    const frisch = fetch(anfrage).then((antwort) => {
      if (antwort && antwort.ok && antwort.type === 'basic') c.put(anfrage, antwort.clone());
      return antwort;
    }).catch(() => null);
    return treffer || (await frisch) || new Response('Offline und nicht im Vorrat.', {
      status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
`);

writeFileSync(join(ziel, 'sw-reg.js'), `// Meldet den Service Worker an. Liegt als eigene Datei vor, weil die Seiten
// unter einer strengen Content-Security-Policy ohne Inline-Skripte laufen.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var hier = document.currentScript && document.currentScript.src;
  var ziel = hier ? new URL('sw.js', hier).href : '/sw.js';
  var wurzel = hier ? new URL('./', hier).href : '/';
  navigator.serviceWorker.register(ziel, { scope: wurzel }).then(function (reg) {
    var ampel = document.getElementById('offlineampel');
    if (!ampel) return;
    var zeigen = function () {
      var fertig = navigator.serviceWorker.controller || reg.active;
      ampel.textContent = fertig
        ? 'Offline bereit — funktioniert ohne Netz'
        : 'wird gespeichert …';
      ampel.className = 'offlineampel ' + (fertig ? 'bereit' : '');
    };
    zeigen();
    navigator.serviceWorker.addEventListener('controllerchange', zeigen);
    if (reg.installing) reg.installing.addEventListener('statechange', zeigen);
  }).catch(function () {
    var ampel = document.getElementById('offlineampel');
    if (ampel) {
      ampel.textContent = 'Offline-Vorrat nicht möglich (kein HTTPS?)';
      ampel.className = 'offlineampel fehlt';
    }
  });
})();
`);

console.log(`Offline-Vorrat: sw.js mit ${vorrat.length} Dateien (Marke ${marke})`);
