// Sky Team — Oberfläche. Zwei Leute, ein Cockpit, kein Wort dazwischen.

import {
  PILOT, KOPILOT, ROLLE, FLUGHAEFEN, FELDER, FLUGLAGE_GRENZE, KAFFEE_MAX,
  BREMSWERTE, WUERFEL_JE_RUNDE, NEUWURF_MARKEN,
  neuesSpiel, wuerfeln, neuWuerfeln, setzen, passt, moeglicheFelder, kaffeeNutzen,
  feldMit, feldWerte, feldFrei, bremswert, lage, geschwindigkeit, windAufschlag,
  istLanderunde,
} from './engine.js';
import {
  EINWEISUNG, LEXIKON, naechsterHinweis, lexikonFuer, ratschlag,
} from './lehre.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';
import { netzAufbauen, netzMoeglich } from './netz.js';

const KEY = 'skyteam.v1';
const app = document.getElementById('app');

let spiel = null;
let ui = {
  overlay: null,
  halter: -1,          // nur lokal: wer das Handy gerade hält
  modus: 'lokal',      // 'lokal' | 'online'
  offen: false,        // lokal: Würfel beider Seiten offen zeigen (leichter)
  gewaehlt: null,      // Index des angetippten eigenen Würfels
  meinIndex: PILOT,    // online: welche Rolle dieses Gerät spielt
  gastgeber: true,     // online: dieses Gerät rechnet
  funk: null,
  kopplung: null,
  namen: ['Monty', 'Christina'],
  flughafen: 0,
  einweisung: null,    // Index der Einweisungskarte, solange sie läuft
  gesehen: [],         // schon gezeigte Hinweise
  hinweis: null,       // Hinweis, der gerade unten steht
  lexikon: null,       // Gruppe, deren Erklärung offen ist
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const name = (i) => esc(spiel.namen[i] || ROLLE[i]);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  if (ui.modus === 'online') return;      // auf zwei Geräten führt der Gastgeber Buch
  try {
    localStorage.setItem(KEY, JSON.stringify({ spiel, offen: ui.offen, gesehen: ui.gesehen }));
  } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const d = JSON.parse(roh);
    if (d && d.spiel && d.spiel.v === 2) return d;
  } catch { /* kaputter Stand wird ignoriert */ }
  return null;
}

function weiter() {
  sichern();
  render();
}

/** Baut aus <style> und <script> der laufenden Seite wieder ein vollständiges Dokument. */
function seitenQuelltext(cssId, jsId, ersatzTitel) {
  const css = document.getElementById(cssId)?.textContent || '';
  const js = document.getElementById(jsId)?.textContent || '';
  if (!css || !js) return null;
  const kopf = typeof SEITENKOPF === 'string'
    ? SEITENKOPF
    : `<meta charset="utf-8"><title>${ersatzTitel}</title>`;
  return [
    '<!doctype html>', '<html lang="de">', '<head>',
    kopf,
    `<style id="${cssId}">`, css, '</style>', '</head>', '<body>',
    '<div id="app"></div>',
    `<script id="${jsId}">`, js, '<' + '/script>',
    '</body>', '</html>', ''
  ].join('\n');
}

function browserDownload(dateiname, html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Speichert die laufende Seite als eigenständige HTML-Datei. */
async function seiteAlsDateiSichern(cssId, jsId, dateiname, ersatzTitel) {
  // Auf der Webseite liegt die Einzeldatei fertig daneben — dann einfach die holen.
  if (typeof OFFLINE_DATEI === 'string') {
    const a = document.createElement('a');
    a.href = OFFLINE_DATEI;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'ok';
  }
  const html = seitenQuelltext(cssId, jsId, ersatzTitel);
  if (!html) return 'dev';
  const dl = typeof window !== 'undefined' && window.claude ? window.claude.downloads : null;
  if (dl) {
    try {
      await dl.save({ filename: dateiname, data: html });
      return 'ok';
    } catch (fehler) {
      const code = fehler && fehler.code;
      if (code === 'declined') return 'abgelehnt';
      if (code === 'rejected_extension' || code === 'extension_not_enabled') {
        try {
          await dl.save({ filename: dateiname.replace(/\.html$/, '') + '.txt', data: html });
          return 'txt';
        } catch (zweiter) {
          if (zweiter && zweiter.code === 'declined') return 'abgelehnt';
        }
      }
    }
  }
  browserDownload(dateiname, html);
  return 'ok';
}

/** Gibt die Spieldatei ans Teilen-Menü des Handys weiter. */
async function spielTeilen(cssId, jsId, dateiname, titel) {
  // Auf der Webseite ist der Link das Nützlichste, was man weitergeben kann.
  if (typeof OFFLINE_DATEI === 'string') {
    try {
      if (navigator.share) {
        await navigator.share({ title: titel, url: location.href });
        return 'ok';
      }
      await navigator.clipboard.writeText(location.href);
      return 'kopiert';
    } catch (fehler) {
      return fehler && fehler.name === 'AbortError' ? 'abgelehnt' : 'geht-nicht';
    }
  }
  const html = seitenQuelltext(cssId, jsId, titel);
  if (!html) return 'dev';
  try {
    const datei = new File([html], dateiname, { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: titel });
      return 'ok';
    }
  } catch (fehler) {
    if (fehler && fehler.name === 'AbortError') return 'abgelehnt';
  }
  return 'geht-nicht';
}

const TEILEN_TEXT = {
  ok: 'Weitergegeben',
  kopiert: 'Link kopiert',
  abgelehnt: 'Abgebrochen',
  'geht-nicht': 'Geht hier nicht — erst sichern, dann aus den Dateien teilen',
  dev: 'Geht nur in der fertigen Version',
};

const SICHER_TEXT = {
  ok: 'Gesichert — liegt in deinen Downloads',
  txt: 'Als .txt gesichert — bitte in %NAME% umbenennen',
  abgelehnt: 'Abgebrochen — nichts gespeichert',
  dev: 'Geht nur in der fertigen Version',
};

/* ------------------------------------------------ Züge ausführen oder senden */

const AKTIONEN = { wuerfeln, setzen, kaffeeNutzen, neuWuerfeln };

const gastIndex = () => (ui.meinIndex === PILOT ? KOPILOT : PILOT);

/**
 * Der Gastgeber rechnet, der Gast schickt nur seine Absicht hinüber.
 * Nach Kaffee bleibt der Würfel gewählt — man will ihn ja gleich legen.
 */
function tun(aktion, ...args) {
  if (aktion !== 'kaffeeNutzen') ui.gewaehlt = null;
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.funk?.senden({ typ: 'aktion', name: aktion, args });
    render();
    return;
  }
  AKTIONEN[aktion](spiel, ...args);
  if (ui.modus === 'online') standSenden();
  weiter();
}

/**
 * Was der Gast zu sehen bekommt. Im Cockpit ist genau eine Sache geheim:
 * die ungesetzten Würfel der anderen Seite. Alles andere liegt offen.
 */
function standFuer(s, empfaenger) {
  const k = JSON.parse(JSON.stringify(s));
  const anderer = empfaenger === PILOT ? KOPILOT : PILOT;
  k.wuerfel[anderer] = k.wuerfel[anderer].map(() => 0);   // 0 = verdeckt
  return k;
}

function standSenden() {
  ui.funk?.senden({ typ: 'stand', spiel: standFuer(spiel, gastIndex()) });
}

/** Wessen Würfel zeigt dieses Gerät als „meine“? */
function michSelbst() {
  return ui.modus === 'online' ? ui.meinIndex : spiel.dran;
}

/** Darf an diesem Gerät gerade getippt werden? */
function ichBinDran() {
  if (spiel.phase === 'briefing') return true;             // würfeln darf jeder
  return ui.modus === 'online' ? spiel.dran === ui.meinIndex : true;
}

/* ------------------------------------------------------------------ Würfel */

// Wo die Augen auf einem 3×3-Raster sitzen.
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

/**
 * Ein Würfel. `wer` färbt ihn: Pilot blau, Kopilot orange — wie im Original.
 * Ohne Wert kommt die verdeckte Rückseite.
 */
function wuerfelHtml(wert, { wer = PILOT, klasse = '', attrs = '', knopf = false } = {}) {
  const tag = knopf ? 'button' : 'div';
  const typ = knopf ? ' type="button"' : '';
  const farbe = wer === PILOT ? 'wuerfel--blau' : 'wuerfel--orange';
  if (!wert) {
    return `<${tag} class="wuerfel wuerfel--zu ${klasse}"${attrs}${typ}><span class="fragezeichen">?</span></${tag}>`;
  }
  const punkte = Array.from({ length: 9 }, (_, i) =>
    `<i class="${PIPS[wert].includes(i) ? 'an' : ''}"></i>`).join('');
  return `<${tag} class="wuerfel ${farbe} ${klasse}"${attrs}${typ} aria-label="Würfel ${wert}">${punkte}</${tag}>`;
}

/* ------------------------------------------------------------------- Start */

const STUFE = (i) => Math.max(1, Math.min(5, Math.round(1 + (i / (FLUGHAEFEN.length - 1)) * 4)));

function renderStart() {
  const liste = FLUGHAEFEN.map((f, i) => {
    const n = STUFE(i);
    return `
    <button class="ziel ${i === ui.flughafen ? 'ziel--an' : ''}" data-ziel="${i}" type="button">
      <span class="zielkopf"><span class="kuerzel">${f.kuerzel}</span>
        <span class="schwer">${'▰'.repeat(n)}<span class="aus">${'▰'.repeat(5 - n)}</span></span></span>
      <span class="ort">${esc(f.name)}</span>
      <span class="zielzeile">${f.hoehe / 1000} Runden · ${f.anflug} Felder${
      f.flugzeuge.length ? ` · ${f.flugzeuge.length}✈` : ''}${f.verkehr.length ? ' · Verkehr' : ''}${
      f.wind ? ' · Wind' : ''}</span>
    </button>`;
  }).join('');

  app.innerHTML = `
    <div class="screen start">
      <div class="scroll"><div class="wrap">
        <div class="marke">
          <div class="fenster">
            <div class="himmel"><span class="sonne"></span></div>
            <div class="bahnlicht"></div>
          </div>
          <h1 class="wortmarke">SKY TEAM</h1>
          <p class="unterzeile">Pilot und Kopilot landen zusammen ein Flugzeug —
            mit acht Würfeln und ohne ein Wort.</p>
        </div>

        <button class="btn btn--geist btn--lehre" id="einweisung">
          <span class="lehrezeichen">?</span> Einweisung — was spielen wir hier?
        </button>

        <div class="feldlabel">Wer sitzt vorne?</div>
        <div class="feldreihe">
          <input class="feld" id="n0" maxlength="16" value="${esc(ui.namen[0])}" aria-label="Pilot">
          <span class="rollenschild rollenschild--blau">Pilot</span>
        </div>
        <div class="feldreihe">
          <input class="feld" id="n1" maxlength="16" value="${esc(ui.namen[1])}" aria-label="Kopilot">
          <span class="rollenschild rollenschild--orange">Kopilot</span>
        </div>

        <div class="feldlabel">Wohin geht es?</div>
        <div class="zielliste">${liste}</div>

        <label class="schalterzeile">
          <input type="checkbox" id="offen" ${ui.offen ? 'checked' : ''}>
          <span>Würfel offen zeigen — leichter, aber nicht das echte Spiel</span>
        </label>

        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="los">An einem Handy</button>
          <button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys</button>
          <button class="btn btn--leise" id="regeln">Alle Regeln nachlesen</button>
        </div>
      </div></div>
    </div>`;

  const namenLesen = () => [0, 1].map((i) =>
    app.querySelector(`#n${i}`).value.trim() || ROLLE[i]);

  app.querySelectorAll('[data-ziel]').forEach((b) => {
    b.onclick = () => {
      ui.flughafen = Number(b.dataset.ziel);
      app.querySelectorAll('[data-ziel]').forEach((x) => x.classList.remove('ziel--an'));
      b.classList.add('ziel--an');
      buzz(6);
    };
  });
  app.querySelector('#offen').onchange = (e) => { ui.offen = e.currentTarget.checked; };
  app.querySelector('#einweisung').onclick = () => { ui.einweisung = 0; render(); };
  app.querySelector('#los').onclick = () => {
    ui.modus = 'lokal';
    ui.namen = namenLesen();
    spielAnlegen();
  };
  app.querySelector('#zweiGeraete').onclick = () => {
    ui.namen = namenLesen();
    ui.kopplung = { schritt: 'rolle' };
    render();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

function spielAnlegen() {
  spiel = neuesSpiel(ui.flughafen, ui.namen);
  ui.halter = -1;
  ui.gewaehlt = null;
  ui.hinweis = null;
  weiter();
}

/* ---------------------------------------------------------- Einweisung */

function renderEinweisung() {
  const i = Math.max(0, Math.min(EINWEISUNG.length - 1, ui.einweisung));
  const k = EINWEISUNG[i];
  const punkte = EINWEISUNG.map((_, n) =>
    `<span class="punkt ${n === i ? 'an' : ''}"></span>`).join('');

  const layer = document.createElement('div');
  layer.className = 'overlay einweisung';
  layer.innerHTML = `
    <div class="scroll"><div class="blatt">
      <div class="lbl">Einweisung · ${i + 1} von ${EINWEISUNG.length}</div>
      <div class="lehrbild">${lehrbild(k.bild)}</div>
      <h2>${k.titel}</h2>
      <p class="lehrtext">${k.text}</p>
      <div class="punkte">${punkte}</div>
      <div class="knopfsaeule">
        <button class="btn btn--bernstein" id="weiterKarte">
          ${i + 1 === EINWEISUNG.length ? 'Alles klar' : 'Weiter'}</button>
        ${i > 0 ? '<button class="btn btn--geist" id="zurueckKarte">Zurück</button>' : ''}
        ${i + 1 < EINWEISUNG.length ? '<button class="btn btn--leise" id="ueberspringen">Überspringen</button>' : ''}
      </div>
    </div></div>`;
  app.appendChild(layer);

  layer.querySelector('#weiterKarte').onclick = () => {
    ui.einweisung = i + 1 < EINWEISUNG.length ? i + 1 : null;
    buzz(6);
    render();
  };
  layer.querySelector('#zurueckKarte')?.addEventListener('click', () => {
    ui.einweisung = i - 1; render();
  });
  layer.querySelector('#ueberspringen')?.addEventListener('click', () => {
    ui.einweisung = null; render();
  });
}

/** Kleine erklärende Bilder — reines SVG, damit nichts nachgeladen wird. */
function lehrbild(art) {
  const f = { blau: '#5aa9f0', orange: '#f0a92b', hell: '#e9eff7', dunkel: '#29364a' };
  if (art === 'crew') {
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Zwei Sitze im Cockpit">
      <rect x="14" y="22" width="70" height="54" rx="10" fill="${f.blau}" opacity=".22" stroke="${f.blau}" stroke-width="2"/>
      <rect x="116" y="22" width="70" height="54" rx="10" fill="${f.orange}" opacity=".22" stroke="${f.orange}" stroke-width="2"/>
      <circle cx="49" cy="42" r="9" fill="${f.blau}"/><path d="M34 68c0-9 7-15 15-15s15 6 15 15z" fill="${f.blau}"/>
      <circle cx="151" cy="42" r="9" fill="${f.orange}"/><path d="M136 68c0-9 7-15 15-15s15 6 15 15z" fill="${f.orange}"/>
      <path d="M92 49h16M100 41l8 8-8 8" stroke="${f.hell}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  if (art === 'schweigen') {
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Nicht sprechen">
      <circle cx="100" cy="45" r="30" fill="none" stroke="${f.hell}" stroke-width="2.5"/>
      <path d="M88 40c0-7 5-12 12-12s12 5 12 12v8c0 7-5 12-12 12s-12-5-12-12z" fill="${f.hell}" opacity=".85"/>
      <path d="M80 46c0 11 9 20 20 20s20-9 20-20" stroke="${f.hell}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M74 19l52 52" stroke="#e2664f" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  }
  if (art === 'wuerfel') {
    const w = (x, farbe, augen) => `<g transform="translate(${x} 24)">
      <rect width="34" height="34" rx="7" fill="${farbe}"/>
      ${augen.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#0b1220"/>`).join('')}</g>`;
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Blaue und orange Würfel">
      ${w(14, f.blau, [[10, 10], [24, 24]])}${w(54, f.blau, [[10, 10], [17, 17], [24, 24]])}
      ${w(112, f.orange, [[10, 10], [24, 10], [10, 24], [24, 24]])}${w(152, f.orange, [[17, 17]])}
      <path d="M100 20v50" stroke="${f.dunkel}" stroke-width="2" stroke-dasharray="4 5"/>
    </svg>`;
  }
  if (art === 'panel') {
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Gelegte Würfel liegen offen">
      <rect x="12" y="18" width="176" height="56" rx="10" fill="#131c2b" stroke="${f.dunkel}" stroke-width="2"/>
      <rect x="24" y="30" width="30" height="30" rx="6" fill="${f.blau}"/>
      <circle cx="39" cy="45" r="3.5" fill="#0b1220"/>
      <rect x="64" y="30" width="30" height="30" rx="6" fill="${f.orange}"/>
      <circle cx="72" cy="38" r="3.5" fill="#0b1220"/><circle cx="86" cy="52" r="3.5" fill="#0b1220"/>
      <rect x="108" y="30" width="30" height="30" rx="6" fill="none" stroke="${f.dunkel}" stroke-width="2" stroke-dasharray="4 4"/>
      <rect x="146" y="30" width="30" height="30" rx="6" fill="none" stroke="${f.dunkel}" stroke-width="2" stroke-dasharray="4 4"/>
      <circle cx="160" cy="12" r="7" fill="none" stroke="${f.hell}" stroke-width="2"/>
      <path d="M157 12l2.5 2.5 4.5-5" stroke="${f.hell}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  if (art === 'pflicht') {
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Ruder und Schub">
      <rect x="16" y="20" width="78" height="24" rx="6" fill="${f.blau}" opacity=".2" stroke="${f.blau}" stroke-width="2"/>
      <rect x="106" y="20" width="78" height="24" rx="6" fill="${f.orange}" opacity=".2" stroke="${f.orange}" stroke-width="2"/>
      <rect x="16" y="52" width="78" height="24" rx="6" fill="${f.blau}" opacity=".2" stroke="${f.blau}" stroke-width="2"/>
      <rect x="106" y="52" width="78" height="24" rx="6" fill="${f.orange}" opacity=".2" stroke="${f.orange}" stroke-width="2"/>
      <text x="55" y="37" fill="${f.hell}" font-size="12" font-family="sans-serif" text-anchor="middle">RUDER</text>
      <text x="145" y="37" fill="${f.hell}" font-size="12" font-family="sans-serif" text-anchor="middle">RUDER</text>
      <text x="55" y="69" fill="${f.hell}" font-size="12" font-family="sans-serif" text-anchor="middle">SCHUB</text>
      <text x="145" y="69" fill="${f.hell}" font-size="12" font-family="sans-serif" text-anchor="middle">SCHUB</text>
    </svg>`;
  }
  if (art === 'sinken') {
    return `<svg viewBox="0 0 200 90" role="img" aria-label="Sinkflug">
      <path d="M16 16 L176 70" stroke="${f.dunkel}" stroke-width="2" stroke-dasharray="5 5"/>
      <path d="M12 78h176" stroke="${f.hell}" stroke-width="2"/>
      ${[0, 1, 2, 3].map((i) => `<text x="${30 + i * 46}" y="${30 + i * 15}" fill="${f.orange}" font-size="10" font-family="monospace">${8 - i * 2}000</text>`).join('')}
      <g transform="translate(150 56) rotate(18)"><path d="M0 0l-22 -6 6 6 -6 6z" fill="${f.hell}"/></g>
    </svg>`;
  }
  return `<svg viewBox="0 0 200 90" role="img" aria-label="Landebahn">
    <rect x="12" y="30" width="176" height="34" rx="6" fill="#1b2637" stroke="${f.dunkel}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${28 + i * 34}" y="45" width="18" height="4" rx="2" fill="${f.orange}"/>`).join('')}
    <g transform="translate(40 22)"><path d="M0 0l24 6 -6 -6 6 -6z" fill="${f.hell}"/></g>
  </svg>`;
}
/* ------------------------------------------------------------- Zwei Geräte */

function kopplungAbbrechen() {
  ui.kopplung?.scannerStoppen?.();
  ui.funk?.schliessen();
  ui.funk = null;
  ui.kopplung = null;
  ui.modus = 'lokal';
  ui.meinIndex = PILOT;
  ui.gastgeber = true;
  render();
}

/* ---------------------------------------------- Fehlersuche beim Koppeln */

/** Was die Direktverbindung gerade weiß — in einer Zeile, für den Ernstfall. */
/** Womit hängt dieses Handy gerade am Netz? Chrome kennt die Antwort. */
function netzArt() {
  const c = navigator.connection || navigator.mozConnection || {};
  if (c.type) return c.type === 'none' ? 'kein Netz' : c.type;
  return navigator.onLine ? 'verbunden' : 'kein Netz';
}

function lageText(l, ausfuehrlich) {
  if (!l) return '';
  const kamera = ui.kopplung?.kamera;
  const stumm = l.mdns && !l.eigene.length;         // nur .local statt echter Adresse
  const leer = !l.mdns && !l.eigene.length && l.sammeln === 'fertig';  // gar nichts gefunden
  if (!ausfuehrlich && !stumm && !leer) return '';  // läuft alles: keine Technik im Weg
  const teile = [];
  if (ausfuehrlich) {
    teile.push(`Eigene Adresse: ${l.eigene.length ? l.eigene.join('  ') : 'noch keine'}`,
      `Gegenseite: ${l.fremde}`, `Stand: ${l.stand}`,
      `Kamera: ${kamera === undefined ? '?' : (kamera ? 'frei' : 'abgelehnt')}`,
      `Netz: ${netzArt()}`);
  }
  if (stumm) {
    teile.push('Dieses Handy gibt seine WLAN-Adresse nicht heraus. Erlaube der Seite die '
      + 'Kamera (Schloss-Symbol neben der Adresse → Berechtigungen → Kamera) und koppelt neu.');
  }
  if (leer && kamera === false) {
    teile.push('Dieses Handy hat keine Netzwerkadresse gefunden — und die Kamera ist nicht '
      + 'freigegeben. Ohne sie gibt Chrome keine Adresse heraus. Erst freigeben, dann neu koppeln.');
  } else if (leer) {
    teile.push('Dieses Handy hat keine Netzwerkadresse gefunden, obwohl die Kamera frei ist. '
      + 'Chrome sieht hier also kein Netz. Läuft auf diesem Handy der Hotspot? Ein Handy, das '
      + 'selbst den Hotspot aufspannt, meldet Android oft gar kein Netz — dann kann es nicht '
      + 'mitspielen. Abhilfe: beide Handys in dasselbe WLAN einwählen. Gibt es keins, spielt '
      + 'an einem Handy und reicht es hin und her.');
  }
  return teile.join(' · ');
}

/** Zeigt den Kamera-Bildschirm und wartet, wie es weitergehen soll. */
function kameraFrage() {
  return new Promise((fertig) => {
    ui.kopplung.schritt = 'kamera';
    ui.kopplung.kameraAntwort = fertig;
    render();
  });
}

/** Hält die Technikzeile aktuell, solange gekoppelt wird. */
function lageTakten() {
  if (ui.lageTakt) clearInterval(ui.lageTakt);
  ui.lageTakt = setInterval(() => {
    if (!ui.kopplung || !ui.funk) { clearInterval(ui.lageTakt); ui.lageTakt = null; return; }
    const feld = document.getElementById('lage');
    // Beim Warten die ganze Zeile — sonst nur, wenn wirklich etwas fehlt.
    if (feld) feld.textContent = lageText(ui.funk.lage, ui.kopplung.schritt === 'warten');
  }, 500);
}

async function kopplungStarten(gastgeber, rolle) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = rolle;
  ui.kopplung = { schritt: 'moment', gastgeber, hinweis: '', fehler: '' };
  render();

  // Erst die Kamera-Erlaubnis, dann die Verbindung. Ohne sie gibt Chrome die eigene
  // Netzwerkadresse nicht heraus — das Handy findet dann gar keine oder nur einen
  // .local-Namen, den ein Hotspot nicht auflöst. Scannen müssen wir gleich ohnehin.
  let frei = await kameraFreigeben();
  while (!frei) {
    if (!ui.kopplung) return;                 // in der Zwischenzeit abgebrochen
    const wahl = await kameraFrage();
    if (!ui.kopplung || wahl === 'abbruch') return;
    if (wahl === 'weiter') break;
    frei = await kameraFreigeben();
  }
  if (!ui.kopplung) return;
  ui.kopplung.kamera = frei;
  ui.kopplung.schritt = 'moment';
  render();

  ui.funk = funkAufbauen({
    gastgeber,
    aufZustand: (text, verbunden) => {
      if (verbunden) return verbindungSteht();
      if (ui.kopplung && ui.kopplung.schritt !== 'scannen') {
        ui.kopplung.hinweis = text;
        render();
      }
      return undefined;
    },
    aufNachricht: nachrichtVerarbeiten,
  });
  lageTakten();

  if (gastgeber) {
    ui.kopplung.code = await ui.funk.eigenerCode();
    ui.kopplung.schritt = 'zeigen';
  } else {
    ui.kopplung.schritt = 'scannen';
  }
  render();
}

async function fremdenCodeAnnehmen(code) {
  const k = ui.kopplung;
  try {
    await ui.funk.codeLesen(code);
    if (!ui.kopplung) return;                 // war schon verbunden
    if (!k.gastgeber) {
      ui.kopplung.code = await ui.funk.eigenerCode();
      ui.kopplung.schritt = 'zeigen';
    } else {
      ui.kopplung.schritt = 'warten';
    }
    k.fehler = '';
  } catch (fehler) {
    if (!ui.kopplung) return;
    k.fehler = fehler.message || 'Der Code passt nicht.';
  }
  render();
}

function verbindungSteht() {
  ui.kopplung?.scannerStoppen?.();
  ui.kopplung = null;
  if (ui.gastgeber) {
    spiel = neuesSpiel(ui.flughafen, ui.namen);
    ui.gewaehlt = null;
    ui.funk?.senden({ typ: 'rollen', meinIndex: gastIndex(), namen: ui.namen });
    standSenden();
  }
  render();
}

function nachrichtVerarbeiten(m) {
  if (m.typ === 'rollen' && !ui.gastgeber) {
    ui.meinIndex = m.meinIndex === KOPILOT ? KOPILOT : PILOT;
    ui.namen = Array.isArray(m.namen) ? m.namen : ui.namen;
    return;
  }
  if (m.typ === 'stand' && !ui.gastgeber) {
    // Die Auswahl überlebt, solange die eigenen Würfel unverändert viele sind
    // (Kaffee ändert nur den Wert) — sonst zeigt sie ins Leere.
    const vorher = spiel ? spiel.wuerfel[ui.meinIndex].length : -1;
    spiel = m.spiel;
    if (spiel.wuerfel[ui.meinIndex].length !== vorher) ui.gewaehlt = null;
    render();
    return;
  }
  if (m.typ === 'aktion' && ui.gastgeber && spiel) {
    if (!AKTIONEN[m.name]) return;
    const args = m.args || [];
    // Der Gast darf nur für sich selbst handeln.
    if ((m.name === 'setzen' || m.name === 'kaffeeNutzen') && args[0] !== gastIndex()) return;
    AKTIONEN[m.name](spiel, ...args);
    standSenden();
    render();
  }
}

/**
 * Kopplung über die Webseite: kein gemeinsames WLAN, keine Kamera. Der Server
 * hält nur einen Raum mit kurzem Code offen und reicht Nachrichten durch.
 */
async function netzStarten(gastgeber, rolle, code) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = rolle;
  ui.kopplung = { schritt: 'raum', gastgeber, ueberNetz: true, code: '', hinweis: '', fehler: '' };
  render();

  ui.funk = netzAufbauen({
    gastgeber,
    code,
    aufZustand: (text, verbunden) => {
      if (verbunden) return verbindungSteht();
      if (ui.kopplung) { ui.kopplung.hinweis = text; render(); }
      return undefined;
    },
    aufNachricht: nachrichtVerarbeiten,
    aufCode: (c) => { if (ui.kopplung) { ui.kopplung.code = c; render(); } },
  });

  try {
    await ui.funk.bereit;
  } catch (fehler) {
    if (!ui.kopplung) return;
    ui.kopplung.fehler = fehler.message || 'Das hat nicht geklappt.';
    ui.kopplung.schritt = gastgeber ? 'raum' : 'code';
    render();
  }
}

function renderKopplung() {
  const k = ui.kopplung;

  if (k.schritt === 'rolle') {
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>Auf zwei Handys</h2>
        <p>Beide Geräte müssen im <strong>selben WLAN oder Hotspot</strong> sein. Zum Koppeln
           zeigt ihr euch gegenseitig einen QR-Code — danach läuft alles direkt zwischen den
           Handys, ganz ohne Internet.</p>
        <p>Für Sky Team ist das die richtige Art zu spielen: <strong>jeder sieht nur seine
           eigenen Würfel</strong>, so wie hinter dem Sichtschirm am Tisch.</p>
        ${netzMoeglich() ? `
        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="netzPilot">Raum öffnen — ich bin Pilot</button>
          <button class="btn btn--bernstein" id="netzKopilot">Raum öffnen — ich bin Kopilot</button>
          <button class="btn btn--geist" id="netzGast">Mit Code beitreten</button>
        </div>
        <details class="codeklappe"><summary>Ohne Internet: per QR im selben WLAN</summary>
        <div class="knopfsaeule">
          <button class="btn btn--geist" id="alsPilot">QR · ich bin Pilot, führe</button>
          <button class="btn btn--geist" id="alsKopilot">QR · ich bin Kopilot, führe</button>
          <button class="btn btn--geist" id="alsGast">QR · ich steige zu</button>
        </div></details>
        <div class="knopfsaeule">
          <button class="btn btn--leise" id="zurueck">Doch an einem Handy</button>
        </div>` : `
        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="alsPilot">Ich bin Pilot — dieses Handy führt</button>
          <button class="btn btn--bernstein" id="alsKopilot">Ich bin Kopilot — dieses Handy führt</button>
          <button class="btn btn--geist" id="alsGast">Ich steige zu — anderes Handy führt</button>
          <button class="btn btn--leise" id="zurueck">Doch an einem Handy</button>
        </div>`}
        <p class="hinweiszeile">Wer führt, rechnet und würfelt. Die Rolle des anderen ergibt
           sich automatisch.</p>
      </div></div></div>`;
    app.querySelector('#netzPilot')?.addEventListener('click', () => netzStarten(true, PILOT));
    app.querySelector('#netzKopilot')?.addEventListener('click', () => netzStarten(true, KOPILOT));
    app.querySelector('#netzGast')?.addEventListener('click', () => {
      ui.kopplung = { schritt: 'code', gastgeber: false, ueberNetz: true, code: '', fehler: '' };
      render();
    });
    app.querySelector('#alsPilot').onclick = () => kopplungStarten(true, PILOT);
    app.querySelector('#alsKopilot').onclick = () => kopplungStarten(true, KOPILOT);
    app.querySelector('#alsGast').onclick = () => kopplungStarten(false, KOPILOT);
    app.querySelector('#zurueck').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'code') {
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>Code eingeben</h2>
        <p>Auf dem anderen Handy steht ein fünfstelliger Code. Tipp ihn hier ein.</p>
        <input class="feld feld--code" id="raumcode" maxlength="5" autocapitalize="characters"
          autocomplete="off" spellcheck="false" placeholder="ABCDE" value="${esc(k.code || '')}">
        ${k.fehler ? `<div class="hinweis hinweis--warn">${esc(k.fehler)}</div>` : ''}
        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="beitreten">Mitspielen</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    const feld = app.querySelector('#raumcode');
    feld.focus();
    app.querySelector('#beitreten').onclick = () => {
      const wert = feld.value.trim().toUpperCase();
      if (wert.length < 4) { k.fehler = 'Der Code hat fünf Zeichen.'; render(); return; }
      netzStarten(false, KOPILOT, wert);
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'raum') {
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>${k.gastgeber ? 'Dein Raum steht' : 'Verbinde …'}</h2>
        ${k.gastgeber
          ? `<p>Gib diesen Code an das andere Handy. Dort auf dieser Seite
               <b>„Mit Code beitreten“</b> wählen und eintippen.</p>
             <div class="raumcode">${esc(k.code || '·····')}</div>
             <p class="hinweiszeile">Ihr müsst <b>nicht</b> im selben WLAN sein — das geht
               von überall, solange beide Handys online sind.</p>`
          : `<p>${esc(k.hinweis || 'Der Raum wird gesucht …')}</p>`}
        ${k.fehler ? `<div class="hinweis hinweis--warn">${esc(k.fehler)}</div>` : ''}
        <div class="knopfsaeule">
          ${k.gastgeber && k.code
            ? '<button class="btn btn--geist" id="codeTeilen">Code weitergeben</button>' : ''}
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    app.querySelector('#codeTeilen')?.addEventListener('click', async (e) => {
      const text = `Spielen? Geh auf ${location.href} und tipp den Code ${k.code} ein.`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); e.currentTarget.textContent = 'Kopiert'; }
      } catch { /* abgebrochen */ }
    });
    return;
  }

  if (k.schritt === 'kamera') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Kamera freigeben</h2>
      <p>Dieses Handy hat die Kamera nicht freigegeben. Ohne sie kann es weder den QR-Code
        scannen noch seine eigene Netzwerkadresse herausgeben — die beiden Handys finden
        sich dann nicht.</p>
      <p><strong>So geht es:</strong> Handy-Einstellungen → Apps → „Spiele“ → Berechtigungen
        → Kamera → <em>Zulassen</em>. Im Browser stattdessen: Schloss-Symbol neben der
        Adresse → Berechtigungen → Kamera. Danach hier auf <em>Nochmal fragen</em>.</p>
      <div class="knopfsaeule">
        <button class="btn btn--bernstein" id="kameraNochmal">Nochmal fragen</button>
        <button class="btn btn--geist" id="kameraTrotzdem">Trotzdem versuchen</button>
        <button class="btn btn--leise" id="abbruch">Abbrechen</button>
      </div>
    </div></div></div>`;
    const antwort = (was) => { const f = k.kameraAntwort; k.kameraAntwort = null; f?.(was); };
    app.querySelector('#kameraNochmal').onclick = () => antwort('nochmal');
    app.querySelector('#kameraTrotzdem').onclick = () => antwort('weiter');
    app.querySelector('#abbruch').onclick = () => { antwort('abbruch'); kopplungAbbrechen(); };
    return;
  }

  if (k.schritt === 'moment') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Einen Moment</h2><p>Verbindungsdaten werden vorbereitet. Falls nach der Kamera gefragt wird: erlauben — ohne die Freigabe finden sich die Handys im Hotspot nicht.</p></div></div></div>`;
    return;
  }

  if (k.schritt === 'warten') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Verbinde …</h2>
      <p>${esc(k.hinweis || 'Die Handys suchen sich gerade.')}</p>
      <div class="hinweis">Dauert es länger als ein paar Sekunden, sagt die Zeile darunter, woran es liegt.</div>
      <p class="lage" id="lage"></p>
      <div class="knopfsaeule"><button class="btn btn--geist" id="abbruch">Abbrechen</button></div>
    </div></div></div>`;
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'zeigen') {
    const weiterText = k.gastgeber ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung';
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>${k.gastgeber ? 'Zeig diesen Code' : 'Jetzt du zurück'}</h2>
        <p>${k.gastgeber
          ? 'Die andere Person scannt ihn mit „Ich steige zu“.'
          : 'Halt den Code dem führenden Handy hin — es scannt ihn.'}</p>
        <div class="qrfeld"><canvas id="qr" width="720" height="720"></canvas></div>
        <details class="codeklappe">
          <summary>Kamera streikt? Code als Text</summary>
          <textarea class="codefeld" id="raus" readonly>${esc(k.code || '')}</textarea>
          <button class="btn btn--geist" id="kopieren">Kopieren</button>
        <p class="lage" id="lage"></p>
        </details>
        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="weiterKoppeln">${weiterText}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;

    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#e9eff7', dunkel: '#0b1220' });
    } catch {
      app.querySelector('.qrfeld').textContent = 'Code zu lang für einen QR — nimm den Textcode.';
    }
    app.querySelector('#kopieren').onclick = async (e) => {
      try { await navigator.clipboard.writeText(k.code); e.currentTarget.textContent = 'Kopiert'; }
      catch { app.querySelector('#raus').select(); }
    };
    app.querySelector('#weiterKoppeln').onclick = () => {
      ui.kopplung.schritt = k.gastgeber ? 'scannen' : 'warten';
      ui.kopplung.scannerVersucht = false;
      render();
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  // schritt === 'scannen'
  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="blatt">
      <h2>Code scannen</h2>
      <p>Halte die Kamera auf den Code des anderen Handys.</p>
      <div class="scanfenster"><video id="kamera" muted playsinline></video></div>
      ${k.fehler ? `<div class="hinweis hinweis--warn">${esc(k.fehler)}</div>` : ''}
      <details class="codeklappe" ${scannerMoeglich() ? '' : 'open'}>
        <summary>Kamera streikt? Code eintippen oder einfügen</summary>
        <textarea class="codefeld" id="rein" placeholder="ST1O|…"></textarea>
        <button class="btn btn--geist" id="uebernehmen">Code übernehmen</button>
      </details>
      <div class="knopfsaeule"><button class="btn btn--leise" id="abbruch">Abbrechen</button></div>
    </div></div></div>`;

  app.querySelector('#uebernehmen').onclick = () => {
    const code = app.querySelector('#rein').value.trim();
    if (code) fremdenCodeAnnehmen(code);
  };
  app.querySelector('#abbruch').onclick = kopplungAbbrechen;

  if (!k.scannerVersucht) {
    k.scannerVersucht = true;
    scannerStarten(
      app.querySelector('#kamera'),
      (code) => { k.scannerStoppen = null; fremdenCodeAnnehmen(code); },
      (fehler) => { k.fehler = fehler.message; render(); },
    ).then((stoppen) => { if (ui.kopplung === k) k.scannerStoppen = stoppen; else stoppen(); });
  }
}

/* ------------------------------------------------------------- Instrumente */

/** Der Anflugstreifen: links ihr, rechts die Bahn, dazwischen fremde Maschinen. */
function anflugHtml() {
  const l = lage(spiel);
  const zellen = [];
  for (let i = 0; i <= spiel.anflugLaenge; i++) {
    const hier = i === spiel.position;
    const fremd = spiel.flugzeuge.includes(i);
    const neu = spiel.neueMaschinen?.includes(i);
    const bahn = i === spiel.anflugLaenge;
    const verkehrsfeld = spiel.verkehr.includes(i);
    zellen.push(`<div class="zelle ${bahn ? 'zelle--bahn' : ''} ${fremd ? 'zelle--fremd' : ''} ${
      hier ? 'zelle--hier' : ''} ${neu ? 'zelle--neu' : ''}">
      ${bahn ? '<span class="bahnstreifen"></span>' : ''}
      ${verkehrsfeld && !fremd ? '<span class="verkehrszeichen">◆</span>' : ''}
      ${fremd ? fliegerHtml('fremd') : ''}
      ${hier ? fliegerHtml('eigen') : ''}
    </div>`);
  }
  return `<div class="anflug">
    <div class="anflugkopf">
      <span>Anflug ${esc(l.flughafen.kuerzel)}</span>
      <span>${l.rest === 0 ? 'auf der Bahn' : `noch ${l.rest} Feld${l.rest === 1 ? '' : 'er'}`}</span>
    </div>
    <div class="bahn">${zellen.join('')}</div>
  </div>`;
}

function fliegerHtml(art) {
  return `<svg class="flieger flieger--${art}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.6 12c0 .62-.47 1.14-1.09 1.21l-6.4.75-4.3 6.86c-.16.26-.44.42-.75.42H8.5a.62.62 0 0 1-.6-.8l1.85-6.06-3.6.42-1.5 1.86a.62.62 0 0 1-.48.23h-.8a.62.62 0 0 1-.6-.79l.72-2.1-.72-2.1a.62.62 0 0 1 .6-.79h.8c.19 0 .37.09.48.23l1.5 1.86 3.6.42L7.9 7.56a.62.62 0 0 1 .6-.8h1.56c.31 0 .59.16.75.42l4.3 6.86 6.4.75c.62.07 1.09.59 1.09 1.21z" transform="translate(0 -2.6)"/>
  </svg>`;
}

/** Die Fluglage als echter Zeiger, wie die Scheibe auf dem Brett. */
function lageHtml() {
  const grad = spiel.fluglage * 22;
  const striche = [];
  for (let v = -FLUGLAGE_GRENZE - 1; v <= FLUGLAGE_GRENZE + 1; v++) {
    const a = (v * 22 - 90) * (Math.PI / 180);
    const aussen = v === 0 ? 30 : 32;
    const innen = v === 0 ? 18 : 24;
    const gefahr = Math.abs(v) > FLUGLAGE_GRENZE;
    striche.push(`<line x1="${50 + Math.cos(a) * innen}" y1="${40 + Math.sin(a) * innen}"
      x2="${50 + Math.cos(a) * aussen}" y2="${40 + Math.sin(a) * aussen}"
      class="strich ${gefahr ? 'strich--x' : ''} ${v === 0 ? 'strich--mitte' : ''}"/>`);
  }
  const wind = spiel.wind
    ? `<span class="windzeichen">Wind +${windAufschlag(spiel)}</span>` : '';
  return `<div class="instrument">
    <div class="instrumentkopf"><span>Fluglage</span>${wind}</div>
    <svg class="lagescheibe" viewBox="0 0 100 46" aria-label="Fluglage ${spiel.fluglage}">
      <path d="M12 40 A38 38 0 0 1 88 40" class="bogen"/>
      ${striche.join('')}
      <g transform="rotate(${grad} 50 40)">
        <path d="M50 40 L50 12" class="zeiger"/>
        <path d="M44 16 L50 6 L56 16 Z" class="zeigerspitze"/>
      </g>
      <circle cx="50" cy="40" r="4" class="nabe"/>
    </svg>
    <div class="instrumentwert ${spiel.fluglage === 0 ? 'gut' : 'warn'}">
      ${spiel.fluglage === 0 ? 'waagerecht' : `${spiel.fluglage > 0 ? '+' : ''}${spiel.fluglage} — muss auf 0`}
    </div>
  </div>`;
}

/** Die Geschwindigkeitsskala 2–12 mit den drei Markern. */
function tempoHtml() {
  const zellen = [];
  for (let summe = 2; summe <= 12; summe++) {
    const stufe = geschwindigkeit(spiel, summe);
    zellen.push(`<span class="tempofeld t${stufe}">${summe}</span>`);
  }
  const pos = (wert) => `${((wert - 1) / 11) * 100}%`;
  const marke = (wert, klasse, titel) => (wert >= 1 && wert <= 12
    ? `<span class="skalenmarke ${klasse}" style="left:${pos(wert)}" title="${titel}"></span>` : '');
  return `<div class="instrument">
    <div class="instrumentkopf"><span>Tempo</span><span>Schubsumme</span></div>
    <div class="tempoleiste">
      <div class="tempofelder">${zellen.join('')}</div>
      ${marke(spiel.aero.blau, 'marke--blau', 'Fahrwerk')}
      ${marke(spiel.aero.orange, 'marke--orange', 'Klappen')}
      ${marke(bremswert(spiel), 'marke--rot', 'Bremsen')}
    </div>
    <div class="tempolegende">
      <span class="legendetitel">Felder</span>
      <span><i class="pkt p0"></i>0</span><span><i class="pkt p1"></i>1</span>
      <span><i class="pkt p2"></i>2</span>
      <span class="bremsnote">Bremse hält ${bremswert(spiel)}</span>
    </div>
  </div>`;
}

/* ----------------------------------------------------------------- Cockpit */

function feldHtml(feld, { klein = false } = {}) {
  const wert = spiel.belegt[feld.id];
  const ich = michSelbst();
  const gewaehltWert = ui.gewaehlt !== null ? spiel.wuerfel[ich][ui.gewaehlt] : null;
  const anbietbar = !ui.hinweis && gewaehltWert && ichBinDran() && feld.wer === ich
    && passt(spiel, ich, feld.id, gewaehltWert);
  const werte = feldWerte(feld);
  const erledigt = feld.gruppe === 'fahrwerk' ? spiel.fahrwerk[feld.nr]
    : feld.gruppe === 'klappe' ? spiel.klappen[feld.nr]
      : feld.gruppe === 'bremse' ? spiel.bremsen[feld.nr] : false;
  const gesperrt = !wert && !erledigt && !feldFrei(spiel, feld);
  const lampe = ['fahrwerk', 'klappe', 'bremse'].includes(feld.gruppe);

  const inhalt = wert
    ? wuerfelHtml(wert, { wer: feld.wer, klasse: 'wuerfel--klein' })
    : `<span class="anforderung">${werte ? werte.join('·') : '1–6'}</span>`;

  const tag = anbietbar ? 'button' : 'div';
  const seite = feld.wer === PILOT ? 'blau' : 'orange';
  return `<${tag} class="slot slot--${seite} ${wert ? 'belegt' : ''} ${anbietbar ? 'offen' : ''}
      ${gesperrt ? 'zu' : ''} ${erledigt ? 'gruen' : ''} ${klein ? 'slot--klein' : ''}"
      ${anbietbar ? ` type="button" data-feld="${feld.id}"` : ''}
      data-gruppe="${feld.gruppe}">
    ${lampe ? `<span class="lampe ${erledigt ? 'lampe--gruen' : 'lampe--rot'}"></span>` : ''}
    <span class="slotname">${esc(feld.titel)}</span>
    ${inhalt}
  </${tag}>`;
}

function gruppeHtml(titel, gruppe, ids, extra = '', klein = false) {
  return `<section class="gruppe">
    <button class="gruppentitel" type="button" data-lex="${gruppe}">
      <span>${titel}</span>
      ${extra ? `<span class="gruppenwert">${extra}</span>` : ''}
      <span class="lexzeichen">?</span>
    </button>
    <div class="slots">${ids.map((id) => feldHtml(feldMit(id), { klein })).join('')}</div>
  </section>`;
}

function cockpitHtml() {
  const ich = michSelbst();
  const anderer = ich === PILOT ? KOPILOT : PILOT;
  const fahrwerkOffen = spiel.fahrwerk.filter((x) => !x).length;
  const klappenOffen = spiel.klappen.filter((x) => !x).length;
  const bremsen = spiel.bremsen.filter(Boolean).length;

  const meineGruppen = ich === PILOT
    ? gruppeHtml('Fahrwerk', 'fahrwerk', ['fahrwerk0', 'fahrwerk1', 'fahrwerk2'],
      fahrwerkOffen ? `${3 - fahrwerkOffen}/3` : 'komplett')
      + gruppeHtml('Bremsen', 'bremse', ['bremse0', 'bremse1', 'bremse2'], `${bremsen}/3`)
      + gruppeHtml('Funk & Kaffee', 'funk', ['funkP', 'kaffeeP'])
    : gruppeHtml('Landeklappen', 'klappe', ['klappe0', 'klappe1', 'klappe2', 'klappe3'],
      klappenOffen ? `${4 - klappenOffen}/4` : 'komplett')
      + gruppeHtml('Funk & Kaffee', 'funk', ['funkK1', 'funkK2', 'kaffeeK']);

  const fremdIds = anderer === PILOT
    ? ['fahrwerk0', 'fahrwerk1', 'fahrwerk2', 'bremse0', 'bremse1', 'bremse2', 'funkP', 'kaffeeP']
    : ['klappe0', 'klappe1', 'klappe2', 'klappe3', 'funkK1', 'funkK2', 'kaffeeK'];

  return `
    <div class="pflichtband">
      ${gruppeHtml('Ruder — Pflicht für beide', 'achse', ['achseP', 'achseK'])}
      ${gruppeHtml('Schub — Pflicht für beide', 'motor', ['motorP', 'motorK'])}
    </div>
    <div class="meins">
      <div class="bereichskopf bereichskopf--${ich === PILOT ? 'blau' : 'orange'}">
        Deine Seite · ${ROLLE[ich]}</div>
      ${meineGruppen}
    </div>
    <div class="fremds">
      <div class="bereichskopf bereichskopf--fremd">
        ${name(anderer)} · ${ROLLE[anderer]}</div>
      <div class="slots">${fremdIds.map((id) => feldHtml(feldMit(id), { klein: true })).join('')}</div>
    </div>`;
}

/* ------------------------------------------------------------- Fußleiste */

function meineWuerfelHtml() {
  const ich = michSelbst();
  const wuerfel = spiel.wuerfel[ich] || [];
  if (!wuerfel.length) return '<p class="ansage">Alle deine Würfel liegen.</p>';
  return `<div class="wuerfelreihe">${wuerfel.map((w, i) => {
    const nutzbar = ichBinDran() && moeglicheFelder(spiel, ich, w).length > 0;
    return wuerfelHtml(w, {
      wer: ich,
      knopf: true,
      klasse: `${ui.gewaehlt === i ? 'wuerfel--an' : ''} ${nutzbar ? '' : 'wuerfel--tot'}`,
      attrs: ` data-w="${i}"`,
    });
  }).join('')}</div>`;
}

function fremdeWuerfelHtml() {
  const anderer = michSelbst() === PILOT ? KOPILOT : PILOT;
  const wuerfel = spiel.wuerfel[anderer] || [];
  const zeigen = ui.modus === 'lokal' && ui.offen;
  return `<div class="fremdreihe">
    <span class="fremdlabel">${name(anderer)}</span>
    ${wuerfel.length
      ? wuerfel.map((w) => wuerfelHtml(zeigen ? w : 0, { wer: anderer, klasse: 'wuerfel--mini' })).join('')
      : '<span class="fremdlabel">— fertig</span>'}
  </div>`;
}

function werkzeugHtml() {
  const ich = michSelbst();
  const gewaehltDa = ui.gewaehlt !== null && spiel.wuerfel[ich][ui.gewaehlt];
  const tassen = Array.from({ length: KAFFEE_MAX }, (_, i) =>
    `<span class="tasse ${i < spiel.kaffee ? 'voll' : ''}">☕</span>`).join('');
  const kannKaffee = spiel.kaffee > 0 && gewaehltDa && ichBinDran();
  const kannNeuwurf = spiel.neuwurf > 0 && ichBinDran() && !ui.hinweis;
  return `<div class="werkzeugleiste">
    <span class="tassen" title="Kaffee">${tassen}</span>
    ${kannKaffee
      ? `<button class="btn btn--klein" id="kaffeeRunter" type="button">−1</button>
         <button class="btn btn--klein" id="kaffeeHoch" type="button">+1</button>`
      : `<span class="werkzeugtext">${spiel.kaffee
        ? 'Würfel wählen, dann ±1' : 'Kaffeefeld füllt den Vorrat'}</span>`}
    <span class="trenner"></span>
    <button class="btn btn--klein" id="neuwurf" type="button" ${kannNeuwurf ? '' : 'disabled'}>
      ⟳ Neuwurf ${spiel.neuwurf}/${NEUWURF_MARKEN}</button>
  </div>`;
}

function ansage() {
  const ich = michSelbst();
  if (!ichBinDran()) return `<b>${name(spiel.dran)}</b> legt gerade. Warten.`;
  if (ui.gewaehlt === null) return ratschlag(spiel, ich);
  const wert = spiel.wuerfel[ich][ui.gewaehlt];
  const felder = moeglicheFelder(spiel, ich, wert);
  if (!felder.length) return `Die <b>${wert}</b> passt gerade nirgendwo hin. Anderen Würfel wählen.`;
  const pflichtOffen = FELDER.filter((f) => f.pflicht && f.wer === ich && spiel.belegt[f.id] === undefined).length;
  const rest = spiel.wuerfel[ich].length;
  const eng = rest <= pflichtOffen ? ' <b>Ruder und Schub müssen noch bedient werden.</b>' : '';
  return `Die <b>${wert}</b> passt auf ${felder.length} Feld${felder.length === 1 ? '' : 'er'}.${eng}`;
}

/* ------------------------------------------------------------- Hinweisband */

function hinweisHtml() {
  if (!ui.hinweis) return '';
  return `<div class="lehrband">
    <div class="lehrbandkopf"><span class="lehrezeichen">?</span>${esc(ui.hinweis.titel)}</div>
    <p>${ui.hinweis.text}</p>
    <button class="btn btn--klein" id="hinweisWeg" type="button">Verstanden</button>
  </div>`;
}

function hinweisSuchen() {
  if (ui.hinweis || ui.einweisung !== null || ui.overlay) return;
  const ich = michSelbst();
  const kontext = {
    ich,
    meinAchse: ich === PILOT ? 'achseP' : 'achseK',
    fremdAchse: ich === PILOT ? 'achseK' : 'achseP',
    meinMotor: ich === PILOT ? 'motorP' : 'motorK',
  };
  ui.hinweis = naechsterHinweis(spiel, kontext, ui.gesehen);
}

/* ------------------------------------------------------ Cockpit-Bildschirm */

function renderCockpit() {
  const l = lage(spiel);
  const ich = michSelbst();

  app.innerHTML = `
    <div class="screen cockpit">
      <header class="kopf">
        <div class="titel">
          <div class="ober">${l.flughafen.kuerzel} · ${esc(l.flughafen.name)}${
            ui.modus === 'online' ? ' · zwei Geräte' : ''}</div>
          <h1>${spiel.phase === 'setzen'
            ? `${name(spiel.dran)} legt` : 'Briefing'}</h1>
        </div>
        <div class="werkzeuge">
          <div class="hoehenfenster ${istLanderunde(spiel) ? 'letzte' : ''}">
            <b>${l.hoehe}</b><small>Fuß · Runde ${l.runde}/${l.runden}</small>
          </div>
          <button class="werkzeug" id="btnMenue" aria-label="Menü">⋯</button>
        </div>
      </header>

      <div class="scroll">
        <div class="instrumente">
          ${anflugHtml()}
          <div class="instrumentpaar">${lageHtml()}${tempoHtml()}</div>
        </div>
        <div class="panel">${cockpitHtml()}</div>
        <div class="platzhalter"></div>
      </div>

      <div class="fuss">
        ${hinweisHtml()}
        ${fremdeWuerfelHtml()}
        ${meineWuerfelHtml()}
        ${werkzeugHtml()}
        <p class="ansage">${ansage()}</p>
      </div>
    </div>`;

  app.querySelector('#btnMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#hinweisWeg')?.addEventListener('click', () => {
    if (ui.hinweis) ui.gesehen.push(ui.hinweis.id);
    ui.hinweis = null;
    sichern();
    render();
  });
  app.querySelectorAll('[data-lex]').forEach((b) => {
    b.onclick = () => { ui.lexikon = b.dataset.lex; render(); };
  });
  app.querySelectorAll('[data-w]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.w);
      ui.gewaehlt = ui.gewaehlt === i ? null : i;
      buzz(6);
      render();
    };
  });
  app.querySelectorAll('[data-feld]').forEach((b) => {
    b.onclick = () => {
      const wert = spiel.wuerfel[ich][ui.gewaehlt];
      buzz(12);
      tun('setzen', ich, b.dataset.feld, wert);
    };
  });
  app.querySelector('#kaffeeHoch')?.addEventListener('click', () => {
    tun('kaffeeNutzen', ich, ui.gewaehlt, +1);
  });
  app.querySelector('#kaffeeRunter')?.addEventListener('click', () => {
    tun('kaffeeNutzen', ich, ui.gewaehlt, -1);
  });
  app.querySelector('#neuwurf')?.addEventListener('click', () => {
    if (!confirm('Neuwurf: Beide werfen alle noch nicht gelegten Würfel neu. Marke einsetzen?')) return;
    buzz([10, 30, 10]);
    tun('neuWuerfeln');
  });
}

/* ---------------------------------------------------------------- Briefing */

function renderBriefing() {
  const l = lage(spiel);
  const r = spiel.letzteRunde;
  const neue = spiel.neueMaschinen || [];

  const rueckblick = r
    ? `<div class="rueckblick">
        <div class="rzeile"><span>Ruder</span><span>${r.achseP} gegen ${r.achseK}
          → Lage ${r.fluglage > 0 ? '+' : ''}${r.fluglage}</span></div>
        <div class="rzeile"><span>Schub</span><span>${r.motorP} + ${r.motorK} = ${r.summe}${
          r.wind ? ` +${r.wind} Wind = ${r.tempo}` : ''} → ${r.felder} Feld${r.felder === 1 ? '' : 'er'}</span></div>
      </div>`
    : `<p>Ihr sitzt im Anflug auf <b>${esc(l.flughafen.name)}</b>. ${l.flughafen.wind
      ? 'Es weht von der Seite — solange ihr gerade fliegt, stört das nicht.'
      : 'Ruhige Luft.'}</p>`;

  const layer = document.createElement('div');
  layer.className = 'overlay briefing';
  layer.innerHTML = `
    <div class="scroll"><div class="blatt">
      <div class="lbl">Briefing · Runde ${l.runde} von ${l.runden}</div>
      <h2>${l.runde === 1 ? 'Startklar?'
        : istLanderunde(spiel) ? 'Letzte Runde — jetzt wird aufgesetzt'
          : `Noch ${l.hoehe} Fuß`}</h2>
      ${rueckblick}
      ${neue.length
        ? `<div class="hinweis hinweis--warn">Der Funkverkehr meldet
            ${neue.length === 1 ? 'eine neue Maschine' : `${neue.length} neue Maschinen`}
            im Anflug — ${neue.map((f) => `${f - spiel.position} Felder voraus`).join(', ')}.</div>`
        : ''}
      <div class="briefingzahlen">
        <div><b>${l.rest}</b><small>bis zur Bahn</small></div>
        <div><b>${l.offen.fahrwerk + l.offen.klappen}</b><small>Schalter offen</small></div>
        <div><b>${l.offen.flugzeuge}</b><small>im Weg</small></div>
      </div>
      <p class="planzeile">${ratschlag(spiel, michSelbst())}</p>
      <p class="hinweiszeile">Jetzt dürft ihr reden — ab dem Wurf nicht mehr.
        Diese Runde eröffnet <b>${name(spiel.startspieler)}</b>.</p>
      <div class="knopfsaeule">
        <button class="btn btn--bernstein" id="wuerfeln">${WUERFEL_JE_RUNDE * 2} Würfel werfen</button>
        <button class="btn btn--leise" id="briefingHilfe">Was ist was?</button>
      </div>
    </div></div>`;
  app.appendChild(layer);
  layer.querySelector('#wuerfeln').onclick = () => {
    buzz([12, 30, 12]);
    ui.halter = -1;
    tun('wuerfeln');
  };
  layer.querySelector('#briefingHilfe').onclick = () => { ui.overlay = 'lexikon'; render(); };
}

/* --------------------------------------------------------------- Übergabe */

function renderUebergabe(wer) {
  const layer = document.createElement('div');
  layer.className = 'overlay uebergabe';
  layer.innerHTML = `
    <div class="pfeil" aria-hidden="true">📱</div>
    <div class="lbl">Handy weitergeben an</div>
    <div class="name">${name(wer)}</div>
    <p class="auftrag">${ROLLE[wer]} — leg einen deiner Würfel. Und sag nichts dabei.</p>
    <button class="btn btn--bernstein" id="bereit">Ich hab's</button>`;
  app.appendChild(layer);
  layer.querySelector('#bereit').onclick = () => { ui.halter = wer; ui.gewaehlt = null; render(); };
}

/* ------------------------------------------------------------------- Ende */

function renderEnde() {
  const gewonnen = spiel.phase === 'gewonnen';
  const l = lage(spiel);
  const haken = (gut, text) => `<div class="pruefzeile ${gut ? 'ja' : 'nein'}">
    <span class="haken">${gut ? '✓' : '✕'}</span><span>${text}</span></div>`;
  const r = spiel.letzteRunde;
  const tempo = r ? r.tempo : null;

  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="blatt">
      <div class="endkopf ${gewonnen ? 'gut' : 'schlecht'}">
        <div class="endzeichen">${gewonnen ? fliegerHtml('eigen') : '✕'}</div>
        <div class="lbl">${l.flughafen.kuerzel} · ${esc(l.flughafen.name)}</div>
        <h2>${gewonnen ? 'Gelandet' : 'Abgestürzt'}</h2>
        <p class="endgrund">${esc(spiel.grund)}</p>
      </div>

      <div class="feldlabel">Die fünf Häkchen</div>
      ${haken(spiel.position >= spiel.anflugLaenge, 'Auf der Landebahn')}
      ${haken(spiel.fluglage === 0, 'Flugzeug waagerecht')}
      ${haken(spiel.fahrwerk.every(Boolean) && spiel.klappen.every(Boolean),
    `Fahrwerk ${spiel.fahrwerk.filter(Boolean).length}/3 und Klappen ${spiel.klappen.filter(Boolean).length}/4`)}
      ${haken(spiel.flugzeuge.length === 0, 'Luftraum frei')}
      ${haken(tempo !== null && tempo <= bremswert(spiel),
    `Tempo${tempo !== null ? ` ${tempo}` : ''} unter Bremswert ${bremswert(spiel)}`)}

      <div class="knopfsaeule">
        <button class="btn btn--bernstein" id="nochmal">Nochmal ${esc(l.flughafen.name)}</button>
        ${gewonnen && spiel.flughafen + 1 < FLUGHAEFEN.length
          ? `<button class="btn btn--geist" id="weiterZiel">Weiter nach ${esc(FLUGHAEFEN[spiel.flughafen + 1].name)}</button>` : ''}
        <button class="btn btn--leise" id="zumStart">Zum Start</button>
      </div>
    </div></div></div>`;

  const neuStarten = (index) => {
    ui.flughafen = index;
    if (ui.modus === 'online') {
      if (!ui.gastgeber) return;
      spiel = neuesSpiel(index, ui.namen);
      ui.gewaehlt = null;
      standSenden();
      render();
      return;
    }
    spielAnlegen();
  };

  app.querySelector('#nochmal').onclick = () => neuStarten(spiel.flughafen);
  app.querySelector('#weiterZiel')?.addEventListener('click', () => neuStarten(spiel.flughafen + 1));
  app.querySelector('#zumStart').onclick = () => {
    spiel = null;
    try { localStorage.removeItem(KEY); } catch { /* egal */ }
    render();
  };
}

/* --------------------------------------------------------------- Overlays */

function huelle(inhalt, klasse = '') {
  const layer = document.createElement('div');
  layer.className = `overlay ${klasse}`;
  layer.innerHTML = `<div class="scroll"><div class="blatt">${inhalt}</div></div>`;
  app.appendChild(layer);
  return layer;
}

/** Ein einzelner Lexikoneintrag als Popup. */
function renderLexikonEintrag() {
  const e = lexikonFuer(ui.lexikon);
  if (!e) { ui.lexikon = null; return; }
  const l = huelle(`
    <div class="lbl">Cockpit · was ist das?</div>
    <h2>${e.titel}</h2>
    <p class="werzeile">${e.wer}</p>
    <p><b>${e.kurz}</b></p>
    <p>${e.lang}</p>
    <div class="knopfsaeule">
      <button class="btn btn--bernstein" id="zu">Weiter</button>
      <button class="btn btn--leise" id="alles">Alles nachschlagen</button>
    </div>`, 'lexpop');
  l.querySelector('#zu').onclick = () => { ui.lexikon = null; render(); };
  l.querySelector('#alles').onclick = () => { ui.lexikon = null; ui.overlay = 'lexikon'; render(); };
}

function renderLexikon() {
  const eintraege = LEXIKON.map((e) => `
    <div class="lexzeile">
      <div class="lexkopf"><b>${e.titel}</b><small>${e.wer}</small></div>
      <p>${e.kurz}</p>
      <p class="leise">${e.lang}</p>
    </div>`).join('');
  const l = huelle(`
    <div class="lesbar">
      <h2>Was ist was im Cockpit</h2>
      <p>Neunzehn Felder, zwei Seiten. Jedes Feld nimmt nur Würfel der eigenen Farbe.</p>
      ${eintraege}
      <div class="knopfsaeule">
        <button class="btn btn--geist" id="einweisung">Einweisung nochmal ansehen</button>
        <button class="btn btn--bernstein" id="zu">Zurück</button>
      </div>
    </div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
  l.querySelector('#einweisung').onclick = () => { ui.overlay = null; ui.einweisung = 0; render(); };
}

function renderRegeln() {
  const l = huelle(`
    <div class="lesbar">
      <h2>Sky Team — alle Regeln</h2>
      <p>Ihr spielt <strong>zusammen gegen das Spiel</strong>. Einer ist Pilot, einer Kopilot.
         Gewonnen habt ihr nur gemeinsam — und verloren auch.</p>

      <h3>Die eine große Regel</h3>
      <p>Während einer Runde wird <strong>nicht geredet</strong>. Keine Zahlen, keine Andeutungen.
         Reden dürft ihr nur im Briefing zwischen den Runden. Jeder sieht nur seine eigenen
         Würfel — <strong>gelegte</strong> Würfel sehen beide.</p>

      <h3>Eine Runde</h3>
      <ol>
        <li>Briefing: absprechen, was ihr vorhabt.</li>
        <li>Beide werfen <strong>vier Würfel</strong>, verdeckt voreinander.</li>
        <li>Abwechselnd legt jeder <strong>einen Würfel</strong> auf ein Feld seiner Seite.
            Wer eröffnet, wechselt von Runde zu Runde.</li>
        <li>Sind alle Würfel gelegt: Ruder auswerten, dann Schub. Das Flugzeug sinkt
            <strong>1000 Fuß</strong>.</li>
      </ol>

      <h3>Die Felder</h3>
      ${LEXIKON.map((e) => `<div class="regelzeile">
        <b>${e.titel}</b> <small>${e.wer}</small><br>${e.kurz}</div>`).join('')}

      <h3>Fremder Verkehr</h3>
      <p>Fremde Maschinen stehen auf Feldern eures Anflugs. Fliegt ihr auf ihr Feld,
         ist das Spiel sofort vorbei. An manchen Flughäfen rollt zu Rundenbeginn ein
         <strong>Verkehrswürfel</strong> und setzt neue Maschinen ein. Alle müssen weg,
         bevor ihr landen dürft.</p>

      <h3>Neuwurf</h3>
      <p>Zweimal pro Flug dürft ihr <strong>alle</strong> noch nicht gelegten Würfel neu
         werfen — beide Seiten gleichzeitig.</p>

      <h3>Die Landung</h3>
      <p>In der letzten Runde muss alles zusammenpassen:</p>
      <ul>
        <li>Ihr steht genau auf der Landebahn.</li>
        <li>Die Fluglage ist <strong>genau 0</strong>.</li>
        <li>Fahrwerk und Klappen sind komplett draußen.</li>
        <li>Kein fremdes Flugzeug mehr im Anflug.</li>
        <li>Das Tempo ist <strong>höchstens so hoch wie euer Bremswert</strong>
            (${BREMSWERTE.join(' → ')}).</li>
      </ul>
      <p>Rechnet damit, dass ihr in der Landerunde <strong>stehen bleiben</strong> müsst:
         So wenig Schub, wie die Bremsen verlangen, bewegt das Flugzeug ohnehin nicht mehr.
         Ihr müsst also <strong>vorher</strong> an der Bahn ankommen.</p>

      <h3>An einem Handy</h3>
      <p>Das Gerät wandert nach jedem gelegten Würfel weiter — so bleiben die Würfel geheim.
         Wer das nicht mag, schaltet beim Start <em>„Würfel offen zeigen“</em> ein.</p>
      <p>Auf <strong>zwei Handys</strong> braucht ihr nichts weiterzureichen: jeder sieht nur
         seine vier Würfel, das ganze Cockpit bleibt beiden sichtbar.</p>

      <div class="knopfsaeule"><button class="btn btn--bernstein" id="zu">Verstanden</button></div>
    </div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const l = huelle(`
    <h2>Menü</h2>
    <div class="knopfsaeule">
      <button class="btn btn--geist" id="lexikon">Was ist was? — Cockpit erklärt</button>
      <button class="btn btn--geist" id="einweisung">Einweisung nochmal</button>
      <button class="btn btn--geist" id="regeln">Alle Regeln</button>
      <button class="btn btn--geist" id="datei">Spiel als Datei sichern</button>
      <button class="btn btn--bernstein" id="weitergeben">Aufs zweite Handy schicken</button>
      <button class="btn btn--warn" id="abbruch">Flug abbrechen</button>
      <button class="btn btn--bernstein" id="zu">Weiterfliegen</button>
    </div>
    <p class="hinweiszeile">Der Spielstand liegt auf diesem Gerät — die App darf zwischendurch
      zugehen.</p>`);

  l.querySelector('#lexikon').onclick = () => { ui.overlay = 'lexikon'; render(); };
  l.querySelector('#einweisung').onclick = () => { ui.overlay = null; ui.einweisung = 0; render(); };
  l.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
  l.querySelector('#weitergeben').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Teilen-Menü …';
    const erg = await spielTeilen('skyteam-css', 'skyteam-js', 'SkyTeam.html', 'Sky Team');
    knopf.textContent = TEILEN_TEXT[erg];
    knopf.disabled = erg === 'ok';
  };
  l.querySelector('#datei').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Wird gespeichert …';
    const erg = await seiteAlsDateiSichern('skyteam-css', 'skyteam-js', 'SkyTeam.html', 'Sky Team');
    knopf.textContent = SICHER_TEXT[erg].replace('%NAME%', 'SkyTeam.html');
    knopf.disabled = erg === 'ok' || erg === 'txt';
  };
  l.querySelector('#abbruch').onclick = () => {
    if (!confirm('Laufenden Flug verwerfen?')) return;
    spiel = null;
    ui.overlay = null;
    try { localStorage.removeItem(KEY); } catch { /* egal */ }
    render();
  };
}

/* ----------------------------------------------------------------- Render */

function render() {
  if (spiel && spiel.phase === 'setzen') hinweisSuchen();

  if (ui.kopplung) {
    renderKopplung();
  } else if (!spiel && ui.modus === 'online') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Verbunden</h2><p>Warte auf das Briefing vom anderen Handy …</p></div></div></div>`;
  } else if (!spiel) {
    renderStart();
  } else if (spiel.phase === 'gewonnen' || spiel.phase === 'verloren') {
    renderEnde();
  } else {
    renderCockpit();
    if (ui.einweisung === null && !ui.overlay && !ui.lexikon) {
      if (spiel.phase === 'briefing') { renderBriefing(); return; }
      // Ein Handy, verdeckte Würfel: vor jedem Zug wird weitergereicht.
      if (ui.modus === 'lokal' && !ui.offen && spiel.dran !== ui.halter) {
        renderUebergabe(spiel.dran);
        return;
      }
    }
  }

  if (ui.lexikon) { renderLexikonEintrag(); return; }
  if (ui.overlay === 'regeln') renderRegeln();
  else if (ui.overlay === 'lexikon') renderLexikon();
  else if (ui.overlay === 'menue') renderMenue();
  if (ui.einweisung !== null) renderEinweisung();
}

const gespeichert = laden();
if (gespeichert) {
  spiel = gespeichert.spiel;
  ui.offen = !!gespeichert.offen;
  ui.gesehen = Array.isArray(gespeichert.gesehen) ? gespeichert.gesehen : [];
  ui.namen = spiel.namen;
  ui.flughafen = spiel.flughafen;
}
render();
