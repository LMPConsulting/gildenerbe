// Sky Team — Oberfläche. Zwei Leute, ein Cockpit, kein Wort dazwischen.

import {
  PILOT, KOPILOT, ROLLE, FLUGHAEFEN, FELDER, FLUGLAGE_GRENZE, KAFFEE_MAX,
  BREMSWERTE, WUERFEL_JE_RUNDE,
  neuesSpiel, wuerfeln, setzen, passt, moeglicheFelder, kaffeeNutzen,
  feldMit, feldWerte, feldFrei, bremswert, lage, geschwindigkeit,
} from './engine.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, scannerStarten, scannerMoeglich } from './funk.js';

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
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const name = (i) => esc(spiel.namen[i] || ROLLE[i]);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  if (ui.modus === 'online') return;      // auf zwei Geräten führt der Gastgeber Buch
  try {
    localStorage.setItem(KEY, JSON.stringify({ spiel, offen: ui.offen }));
  } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const d = JSON.parse(roh);
    if (d && d.spiel && d.spiel.v === 1) return d;
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

const AKTIONEN = { wuerfeln, setzen, kaffeeNutzen };

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

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function wuerfelHtml(wert, { klasse = '', attrs = '', knopf = false } = {}) {
  const tag = knopf ? 'button' : 'div';
  const typ = knopf ? ' type="button"' : '';
  if (!wert) {
    return `<${tag} class="wuerfel wuerfel--zu ${klasse}"${attrs}${typ}><span class="fragezeichen">?</span></${tag}>`;
  }
  const punkte = Array.from({ length: 9 }, (_, i) =>
    `<i class="${PIPS[wert].includes(i) ? 'an' : ''}"></i>`).join('');
  return `<${tag} class="wuerfel ${klasse}"${attrs}${typ}>${punkte}</${tag}>`;
}

/* ------------------------------------------------------------------- Start */

function renderStart() {
  const liste = FLUGHAEFEN.map((f, i) => `
    <button class="ziel ${i === ui.flughafen ? 'ziel--an' : ''}" data-ziel="${i}" type="button">
      <span class="kuerzel">${f.kuerzel}</span>
      <span class="ort">${esc(f.name)}</span>
      <span class="schwer">${'●'.repeat(Math.min(5, 1 + Math.floor(i / 2.2)))}<span class="aus">${'●'.repeat(5 - Math.min(5, 1 + Math.floor(i / 2.2)))}</span></span>
    </button>`).join('');

  app.innerHTML = `
    <div class="screen start">
      <div class="scroll"><div class="wrap">
        <div class="marke">
          <div class="horizont"><span class="flieger">✈</span></div>
          <h1 class="wortmarke">SKY TEAM</h1>
          <p class="unterzeile">Pilot und Kopilot landen zusammen ein Flugzeug —
            mit acht Würfeln und ohne ein Wort.</p>
        </div>

        <div class="feldlabel">Wer sitzt vorne?</div>
        <div class="feldreihe">
          <input class="feld" id="n0" maxlength="16" value="${esc(ui.namen[0])}" aria-label="Pilot">
          <span class="rollenschild">Pilot</span>
        </div>
        <div class="feldreihe">
          <input class="feld" id="n1" maxlength="16" value="${esc(ui.namen[1])}" aria-label="Kopilot">
          <span class="rollenschild">Kopilot</span>
        </div>

        <div class="feldlabel">Wohin geht es?</div>
        <div class="zielliste">${liste}</div>
        <p class="hinweiszeile" id="zielinfo"></p>

        <label class="schalter">
          <input type="checkbox" id="offen" ${ui.offen ? 'checked' : ''}>
          <span>Würfel offen zeigen — leichter, aber nicht das echte Spiel</span>
        </label>

        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="los">An einem Handy</button>
          <button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys</button>
          <button class="btn btn--leise" id="regeln">Wie es funktioniert</button>
        </div>
      </div></div>
    </div>`;

  const info = app.querySelector('#zielinfo');
  const zielZeigen = () => {
    const f = FLUGHAEFEN[ui.flughafen];
    info.innerHTML = `<b>${esc(f.name)}</b> — ${f.hoehe / 1000} Runden, ${f.anflug} Felder Anflug,
      ${f.flugzeuge.length === 0 ? 'freier Luftraum' : `${f.flugzeuge.length} fremde Maschine${f.flugzeuge.length > 1 ? 'n' : ''}`}${f.wind ? ', böiger Wind' : ''}.`;
  };
  zielZeigen();

  const namenLesen = () => [0, 1].map((i) =>
    app.querySelector(`#n${i}`).value.trim() || ROLLE[i]);

  app.querySelectorAll('[data-ziel]').forEach((b) => {
    b.onclick = () => {
      ui.flughafen = Number(b.dataset.ziel);
      app.querySelectorAll('[data-ziel]').forEach((x) => x.classList.remove('ziel--an'));
      b.classList.add('ziel--an');
      zielZeigen();
      buzz(6);
    };
  });
  app.querySelector('#offen').onchange = (e) => { ui.offen = e.currentTarget.checked; };
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
  weiter();
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

async function kopplungStarten(gastgeber, rolle) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = rolle;
  ui.kopplung = { schritt: 'moment', gastgeber, hinweis: '', fehler: '' };
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
        <div class="knopfsaeule">
          <button class="btn btn--bernstein" id="alsPilot">Ich bin Pilot — dieses Handy führt</button>
          <button class="btn btn--bernstein" id="alsKopilot">Ich bin Kopilot — dieses Handy führt</button>
          <button class="btn btn--geist" id="alsGast">Ich steige zu — anderes Handy führt</button>
          <button class="btn btn--leise" id="zurueck">Doch an einem Handy</button>
        </div>
        <p class="hinweiszeile">Wer führt, rechnet und würfelt. Die Rolle des anderen ergibt
           sich automatisch.</p>
      </div></div></div>`;
    app.querySelector('#alsPilot').onclick = () => kopplungStarten(true, PILOT);
    app.querySelector('#alsKopilot').onclick = () => kopplungStarten(true, KOPILOT);
    app.querySelector('#alsGast').onclick = () => kopplungStarten(false, KOPILOT);
    app.querySelector('#zurueck').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'moment') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Einen Moment</h2><p>Verbindungsdaten werden vorbereitet …</p></div></div></div>`;
    return;
  }

  if (k.schritt === 'warten') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Verbinde …</h2>
      <p>${esc(k.hinweis || 'Die Handys suchen sich gerade.')}</p>
      <div class="hinweis">Dauert es länger als ein paar Sekunden, blockiert der Hotspot
        vermutlich den direkten Weg. Dann hilft nur: beide ins gleiche WLAN — oder doch an
        einem Handy spielen.</div>
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

function anflugHtml() {
  const l = lage(spiel);
  const zellen = [];
  for (let i = 0; i <= spiel.anflugLaenge; i++) {
    const hier = i === spiel.position;
    const fremd = spiel.flugzeuge.includes(i);
    const bahn = i === spiel.anflugLaenge;
    zellen.push(`<div class="zelle ${bahn ? 'zelle--bahn' : ''} ${fremd ? 'zelle--fremd' : ''} ${hier ? 'zelle--hier' : ''}">
      <span class="zeichen">${hier ? '✈' : fremd ? '✖' : bahn ? '⌷' : ''}</span>
    </div>`);
  }
  return `<div class="anflug">
    <div class="anflugkopf"><span>Anflug</span><span>noch ${l.rest} Feld${l.rest === 1 ? '' : 'er'}</span></div>
    <div class="bahn">${zellen.join('')}</div>
  </div>`;
}

function lageHtml() {
  const skala = [];
  for (let v = -FLUGLAGE_GRENZE; v <= FLUGLAGE_GRENZE; v++) {
    skala.push(`<span class="lagepunkt ${v === spiel.fluglage ? 'an' : ''} ${v === 0 ? 'mitte' : ''}"></span>`);
  }
  const wind = spiel.wind
    ? `<span class="windzeichen">Wind ${spiel.windRichtung === 0 ? '±0' : spiel.windRichtung > 0 ? '+1' : '−1'}</span>`
    : '';
  return `<div class="instrument">
    <div class="instrumentkopf"><span>Fluglage</span>${wind}</div>
    <div class="lageskala">${skala.join('')}</div>
    <div class="instrumentwert">${spiel.fluglage > 0 ? '+' : ''}${spiel.fluglage} · Grenze ±${FLUGLAGE_GRENZE}</div>
  </div>`;
}

function tempoHtml() {
  const felder = [];
  for (let summe = 2; summe <= 12; summe++) {
    const stufe = geschwindigkeit(spiel, summe);
    felder.push(`<span class="tempofeld t${stufe}">${summe}</span>`);
  }
  return `<div class="instrument">
    <div class="instrumentkopf"><span>Schub</span><span>Bremse ≤ ${bremswert(spiel)}</span></div>
    <div class="tempoleiste">${felder.join('')}</div>
    <div class="instrumentwert">0 · 1 · 2 Felder weit</div>
  </div>`;
}

/* ----------------------------------------------------------------- Cockpit */

function feldHtml(feld) {
  const wert = spiel.belegt[feld.id];
  const ich = michSelbst();
  const gewaehltWert = ui.gewaehlt !== null ? spiel.wuerfel[ich][ui.gewaehlt] : null;
  const anbietbar = gewaehltWert && ichBinDran() && feld.wer === ich
    && passt(spiel, ich, feld.id, gewaehltWert);
  const werte = feldWerte(feld);
  const gesperrt = !wert && !feldFrei(spiel, feld);

  const inhalt = wert
    ? wuerfelHtml(wert, { klasse: 'wuerfel--klein' })
    : `<span class="anforderung">${werte ? werte.join('·') : '1–6'}</span>`;

  const tag = anbietbar ? 'button' : 'div';
  return `<${tag} class="feld-slot ${wert ? 'belegt' : ''} ${anbietbar ? 'offen' : ''} ${gesperrt ? 'zu' : ''}"
      ${anbietbar ? ` type="button" data-feld="${feld.id}"` : ''}>
    <span class="slotname">${esc(feld.titel)}</span>
    ${inhalt}
  </${tag}>`;
}

function gruppeHtml(titel, ids, extra = '') {
  return `<section class="gruppe">
    <h3 class="gruppentitel">${titel}${extra ? `<span class="gruppenwert">${extra}</span>` : ''}</h3>
    <div class="slots">${ids.map((id) => feldHtml(feldMit(id))).join('')}</div>
  </section>`;
}

function cockpitHtml() {
  const ich = michSelbst();
  const anderer = ich === PILOT ? KOPILOT : PILOT;
  const fahrwerkOffen = spiel.fahrwerk.filter((x) => !x).length;
  const klappenOffen = spiel.klappen.filter((x) => !x).length;

  const meins = ich === PILOT
    ? [
      gruppeHtml('Fahrwerk', ['fahrwerk0', 'fahrwerk1', 'fahrwerk2'], fahrwerkOffen ? `noch ${fahrwerkOffen}` : 'komplett'),
      gruppeHtml('Bremsen', ['bremse0', 'bremse1', 'bremse2'], `bis ${bremswert(spiel)}`),
      gruppeHtml('Funk & Kaffee', ['funkP', 'kaffeeP']),
    ].join('')
    : [
      gruppeHtml('Landeklappen', ['klappe0', 'klappe1', 'klappe2', 'klappe3'], klappenOffen ? `noch ${klappenOffen}` : 'komplett'),
      gruppeHtml('Funk & Kaffee', ['funkK1', 'funkK2', 'kaffeeK']),
    ].join('');

  const fremds = anderer === PILOT
    ? gruppeHtml(`${name(PILOT)} · Pilot`, ['fahrwerk0', 'fahrwerk1', 'fahrwerk2', 'bremse0', 'bremse1', 'bremse2', 'funkP', 'kaffeeP'])
    : gruppeHtml(`${name(KOPILOT)} · Kopilot`, ['klappe0', 'klappe1', 'klappe2', 'klappe3', 'funkK1', 'funkK2', 'kaffeeK']);

  return `
    ${gruppeHtml('Ruder — beide, jede Runde', ['achseP', 'achseK'])}
    ${gruppeHtml('Schub — beide, jede Runde', ['motorP', 'motorK'])}
    <div class="meins">
      <div class="bereichskopf">Dein Bereich · ${ROLLE[ich]}</div>
      ${meins}
    </div>
    <div class="fremds">
      <div class="bereichskopf bereichskopf--fremd">Andere Seite</div>
      ${fremds}
    </div>`;
}

function meineWuerfelHtml() {
  const ich = michSelbst();
  const wuerfel = spiel.wuerfel[ich] || [];
  if (!wuerfel.length) return '<p class="ansage">Alle deine Würfel liegen.</p>';
  return `<div class="wuerfelreihe">${wuerfel.map((w, i) => {
    const nutzbar = ichBinDran() && moeglicheFelder(spiel, ich, w).length > 0;
    return wuerfelHtml(w, {
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
      ? wuerfel.map((w) => wuerfelHtml(zeigen ? w : 0, { klasse: 'wuerfel--mini' })).join('')
      : '<span class="fremdlabel">— fertig</span>'}
  </div>`;
}

function kaffeeHtml() {
  const ich = michSelbst();
  const gewaehltDa = ui.gewaehlt !== null && spiel.wuerfel[ich][ui.gewaehlt];
  const tassen = Array.from({ length: KAFFEE_MAX }, (_, i) =>
    `<span class="tasse ${i < spiel.kaffee ? 'voll' : ''}">☕</span>`).join('');
  const kannNutzen = spiel.kaffee > 0 && gewaehltDa && ichBinDran();
  return `<div class="kaffeeleiste">
    <span class="tassen">${tassen}</span>
    ${kannNutzen
      ? `<button class="btn btn--klein" id="kaffeeRunter" type="button">−1</button>
         <button class="btn btn--klein" id="kaffeeHoch" type="button">+1</button>`
      : `<span class="kaffeetext">${spiel.kaffee
        ? 'Würfel wählen, dann ±1'
        : 'Kein Kaffee — das Kaffeefeld füllt den Vorrat'}</span>`}
  </div>`;
}

function ansage() {
  const ich = michSelbst();
  if (!ichBinDran()) return `<b>${name(spiel.dran)}</b> legt gerade. Warten.`;
  if (ui.gewaehlt === null) return 'Würfel antippen — dann leuchtet, wohin er darf.';
  const wert = spiel.wuerfel[ich][ui.gewaehlt];
  const felder = moeglicheFelder(spiel, ich, wert);
  if (!felder.length) return `Die <b>${wert}</b> passt gerade nirgendwo hin. Anderen Würfel wählen.`;
  const pflichtOffen = FELDER.filter((f) => f.pflicht && f.wer === ich && spiel.belegt[f.id] === undefined).length;
  const rest = spiel.wuerfel[ich].length;
  const eng = rest <= pflichtOffen ? ' <b>Ruder und Schub müssen noch bedient werden.</b>' : '';
  return `Die <b>${wert}</b> passt auf ${felder.length} Feld${felder.length === 1 ? '' : 'er'}.${eng}`;
}

function renderCockpit() {
  const l = lage(spiel);
  const ich = michSelbst();

  app.innerHTML = `
    <div class="screen cockpit">
      <header class="kopf">
        <div class="titel">
          <div class="ober">${l.flughafen.kuerzel} · ${esc(l.flughafen.name)}${
            ui.modus === 'online' ? ' · zwei Geräte' : ''}</div>
          <h1>${spiel.phase === 'setzen' ? `${name(spiel.dran)} legt` : 'Briefing'}</h1>
        </div>
        <div class="werkzeuge">
          <div class="hoehe"><b>${l.hoehe}</b><small>Fuß</small></div>
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
        ${fremdeWuerfelHtml()}
        ${meineWuerfelHtml()}
        ${kaffeeHtml()}
        <p class="ansage">${ansage()}</p>
      </div>
    </div>`;

  app.querySelector('#btnMenue').onclick = () => { ui.overlay = 'menue'; render(); };
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
}

/* ---------------------------------------------------------------- Briefing */

function renderBriefing() {
  const l = lage(spiel);
  const r = spiel.letzteRunde;
  const rueckblick = r
    ? `<div class="rueckblick">
        <div class="rzeile"><span>Ruder</span><span>${r.achseP} gegen ${r.achseK}${
          spiel.wind ? ` · Wind ${spiel.windRichtung > 0 ? '+1' : spiel.windRichtung < 0 ? '−1' : '±0'}` : ''
        } → Lage ${r.fluglage > 0 ? '+' : ''}${r.fluglage}</span></div>
        <div class="rzeile"><span>Schub</span><span>${r.motorP} + ${r.motorK} = ${r.summe} → ${r.tempo} Feld${r.tempo === 1 ? '' : 'er'}</span></div>
      </div>`
    : `<p>Ihr sitzt in ${esc(l.flughafen.name)} im Anflug. ${l.flughafen.wind
      ? 'Es ist böig — der Wind schiebt euch jede Runde in eine zufällige Richtung.'
      : 'Ruhige Luft.'}</p>`;

  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `
    <div class="scroll"><div class="blatt">
      <div class="lbl">Runde ${spiel.runde} von ${spiel.runden}</div>
      <h2>${spiel.runde === 1 ? 'Startklar?' : l.hoehe === 1000 ? 'Letzte Runde — dann setzt ihr auf' : `Noch ${l.hoehe} Fuß`}</h2>
      ${rueckblick}
      <div class="briefingzahlen">
        <div><b>${l.rest}</b><small>bis zur Bahn</small></div>
        <div><b>${l.offen.fahrwerk + l.offen.klappen}</b><small>Schalter offen</small></div>
        <div><b>${l.offen.flugzeuge}</b><small>im Weg</small></div>
      </div>
      <p class="hinweiszeile">Ab jetzt wird nicht mehr geredet. Wer den Startspieler-Würfel
        hat, legt zuerst: <b>${name(spiel.startspieler)}</b>.</p>
      <div class="knopfsaeule">
        <button class="btn btn--bernstein" id="wuerfeln">${WUERFEL_JE_RUNDE * 2} Würfel werfen</button>
      </div>
    </div></div>`;
  app.appendChild(layer);
  layer.querySelector('#wuerfeln').onclick = () => {
    buzz([12, 30, 12]);
    ui.halter = -1;
    tun('wuerfeln');
  };
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
  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="blatt">
      <div class="endkopf ${gewonnen ? 'gut' : 'schlecht'}">
        <div class="endzeichen">${gewonnen ? '✈' : '✖'}</div>
        <div class="lbl">${l.flughafen.kuerzel} · ${esc(l.flughafen.name)}</div>
        <h2>${gewonnen ? 'Gelandet' : 'Abgestürzt'}</h2>
        <p class="endgrund">${esc(spiel.grund)}</p>
      </div>

      <div class="briefingzahlen">
        <div><b>${spiel.position}/${spiel.anflugLaenge}</b><small>Anflug</small></div>
        <div><b>${spiel.fluglage > 0 ? '+' : ''}${spiel.fluglage}</b><small>Fluglage</small></div>
        <div><b>${spiel.fahrwerk.filter(Boolean).length}/3</b><small>Fahrwerk</small></div>
        <div><b>${spiel.klappen.filter(Boolean).length}/4</b><small>Klappen</small></div>
        <div><b>${spiel.bremsen.filter(Boolean).length}/3</b><small>Bremsen</small></div>
        <div><b>${spiel.flugzeuge.length}</b><small>fremd im Weg</small></div>
      </div>

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

function huelle(inhalt) {
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `<div class="scroll"><div class="blatt">${inhalt}</div></div>`;
  app.appendChild(layer);
  return layer;
}

function renderRegeln() {
  const l = huelle(`
    <div class="lesbar">
      <h2>Sky Team — so geht's</h2>
      <p>Ihr spielt <strong>zusammen gegen das Spiel</strong>. Einer ist Pilot, einer Kopilot.
         Gewonnen habt ihr nur gemeinsam — und verloren auch.</p>

      <h3>Die eine große Regel</h3>
      <p>Während einer Runde wird <strong>nicht geredet</strong>. Keine Zahlen, keine Andeutungen,
         kein Blick. Ihr dürft nur reden, solange keine Würfel auf dem Tisch liegen — also im
         Briefing zwischen den Runden. Jeder sieht nur seine eigenen Würfel.</p>

      <h3>Eine Runde</h3>
      <ol>
        <li>Beide werfen <strong>vier Würfel</strong>, verdeckt voreinander.</li>
        <li>Abwechselnd legt jeder <strong>einen Würfel</strong> auf ein Feld seiner Seite.
            Wer anfängt, wechselt von Runde zu Runde.</li>
        <li>Sind alle Würfel gelegt, wird ausgewertet: erst das Ruder, dann der Schub.
            Das Flugzeug sinkt <strong>1000 Fuß</strong>.</li>
      </ol>

      <h3>Die Pflichtfelder</h3>
      <p><strong>Ruder</strong> und <strong>Schub</strong> müssen jede Runde von <em>beiden</em>
         belegt werden — sonst stürzt ihr ab. Die App lässt dir automatisch genug Würfel übrig.</p>
      <ul>
        <li><strong>Ruder:</strong> Die Differenz der beiden Würfel kippt das Flugzeug.
            Pilot höher → nach rechts, Kopilot höher → nach links. Das summiert sich über die
            Runden. Jenseits von <strong>±${FLUGLAGE_GRENZE}</strong> trudelt ihr.</li>
        <li><strong>Schub:</strong> Die Summe beider Würfel entscheidet, wie weit ihr fliegt —
            0, 1 oder 2 Felder. Zu wenig und ihr bleibt in der Luft hängen, zu viel und ihr
            schießt über die Bahn hinaus.</li>
      </ul>

      <h3>Die Schalter</h3>
      <div class="regeltabelle">
        <div><b>Fahrwerk</b> <small>Pilot · 1·2, 3·4, 5·6</small></div>
        <div>Muss zur Landung komplett draußen sein. Jedes Rad macht das Flugzeug langsamer.</div>
        <div><b>Landeklappen</b> <small>Kopilot · der Reihe nach</small></div>
        <div>Alle vier zur Landung. Jede Klappe bremst zusätzlich.</div>
        <div><b>Bremsen</b> <small>Pilot · der Reihe nach</small></div>
        <div>Hebt das Tempo, das ihr beim Aufsetzen noch verkraftet: ${BREMSWERTE.join(' → ')}.</div>
        <div><b>Funk</b> <small>Pilot 1×, Kopilot 2×</small></div>
        <div>Räumt eine fremde Maschine weg — genau so viele Felder voraus, wie der Würfel zeigt.</div>
        <div><b>Kaffee</b> <small>beide</small></div>
        <div>Sammelt eine Tasse. Für eine Tasse darfst du einen eigenen Würfel um <strong>±1</strong>
            verändern. Höchstens ${KAFFEE_MAX} auf Vorrat.</div>
      </div>

      <h3>Langsamer werden</h3>
      <p>Zu Beginn ist das Flugzeug schnell: Schubsumme bis <strong>4</strong> heißt stehenbleiben,
         bis <strong>8</strong> ein Feld, darüber zwei. Jedes Fahrwerk hebt die untere Grenze,
         jede Klappe die obere. Am Ende braucht ihr also mehr Schub für dieselbe Strecke — und
         gleichzeitig muss die Summe unter eurem Bremswert bleiben. Genau darin liegt die Klemme.</p>

      <h3>Die Landung</h3>
      <p>In der letzten Runde muss alles zusammenpassen:</p>
      <ul>
        <li>Ihr steht genau auf der Landebahn — nicht davor, nicht dahinter.</li>
        <li>Die Fluglage ist <strong>genau 0</strong>.</li>
        <li>Fahrwerk und Klappen sind komplett draußen.</li>
        <li>Kein fremdes Flugzeug mehr im Anflug.</li>
        <li>Die Schubsumme liegt <strong>nicht über eurem Bremswert</strong>.</li>
      </ul>

      <h3>An einem Handy</h3>
      <p>Das Gerät wandert nach jedem gelegten Würfel weiter — so bleiben die Würfel geheim.
         Wem das zu viel Hin und Her ist, schaltet beim Start <em>„Würfel offen zeigen“</em> ein.
         Das ist deutlich leichter, aber eben nicht mehr Sky Team.</p>
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
      <button class="btn btn--geist" id="regeln">Regeln</button>
      <button class="btn btn--geist" id="datei">Spiel als Datei sichern</button>
      <button class="btn btn--bernstein" id="weitergeben">Aufs zweite Handy schicken</button>
      <button class="btn btn--warn" id="abbruch">Flug abbrechen</button>
      <button class="btn btn--bernstein" id="zu">Weiterfliegen</button>
    </div>
    <p class="hinweiszeile">Der Spielstand liegt auf diesem Gerät — die App darf zwischendurch
      zugehen.</p>`);

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
  // Erst der Grundbildschirm (ersetzt den Inhalt), danach die Overlays (hängen sich an).
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
    if (!ui.overlay && spiel.phase === 'briefing') { renderBriefing(); return; }
    // Ein Handy, verdeckte Würfel: vor jedem Zug wird weitergereicht.
    if (!ui.overlay && ui.modus === 'lokal' && !ui.offen && spiel.dran !== ui.halter) {
      renderUebergabe(spiel.dran);
      return;
    }
  }

  if (ui.overlay === 'regeln') renderRegeln();
  else if (ui.overlay === 'menue') renderMenue();
}

const gespeichert = laden();
if (gespeichert) {
  spiel = gespeichert.spiel;
  ui.offen = !!gespeichert.offen;
  ui.namen = spiel.namen;
  ui.flughafen = spiel.flughafen;
}
render();
