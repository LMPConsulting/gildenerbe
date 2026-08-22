// Galgenmännchen — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.

import {
  STUFEN, BUCHSTABEN, PUNKTE, KATEGORIEN,
  neuerStand, rundeStarten, raten, wortRaten, aufgeben,
  rundeAbschliessen, rundeAbbrechen, wortZiehen, wortPruefen, normalisieren,
  gezeichnet, offen, fuehrung, erlaubteFehler, alsCode, ausCode,
} from './engine.js';
import { galgenSvg } from './galgen.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'hangman.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  screen: 'start',    // 'start' | 'hub' | 'stellen' | 'spiel'
  overlay: null,
  halter: 0,          // wer das Handy gerade in der Hand hat (nur lokal)
  entwurf: '',        // was gerade als Wort eingetippt wird
  entwurfTipp: '',
  verdeckt: true,     // Wort beim Tippen verbergen
  eingabefehler: '',
  letzter: null,      // zuletzt geratener Buchstabe — für die kleine Animation
  codeStatus: '',
  modus: 'lokal',     // 'lokal' | 'online'
  meinIndex: 0,
  gastgeber: true,
  netz: null,
  kopplung: null,
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const andere = (i) => (i === 0 ? 1 : 0);
const name = (i) => esc(stand.spieler[i]?.name || (i === 0 ? 'Eins' : 'Zwei'));
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  // Auf zwei Handys rechnet der Gastgeber für beide und hat das Wort deshalb im
  // Speicher — auf die Platte muss es dort aber nicht. Gesichert wird die
  // Fassung, die dieses Gerät auch sehen dürfte.
  const raus = ui.modus === 'online' ? standFuer(stand, ui.meinIndex) : stand;
  try { localStorage.setItem(KEY, JSON.stringify(raus)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.punkte) && s.punkte.length === 2) return s;
  } catch { /* kaputter Stand wird ignoriert */ }
  return null;
}

/** Wer stellt in der kommenden Runde das Wort? */
const setzerIndex = () => andere(stand.dran);

/** Wer muss das Handy in der Hand haben? null = beide dürfen schauen. */
function braucht() {
  if (ui.screen === 'stellen') return setzerIndex();
  const r = stand?.aktuell;
  if (r && !r.fertig && r.setzer >= 0) return r.rater;   // Wort kam vom anderen
  return null;
}

function nachAenderung() {
  if (ui.modus === 'online') {
    if (ui.gastgeber) standSenden();
    render();
    return;
  }
  sichern();
  render();
}

/* ---------------------------------------------------- Zwei Handys, ein Spiel */

const gegenIndex = () => (ui.meinIndex === 0 ? 1 : 0);

/**
 * Der Stand, wie ihn ein bestimmtes Gerät sehen darf. Das Wort ist das ganze
 * Geheimnis dieses Spiels — wer rät, bekommt es nicht mitgeschickt, sondern
 * nur das Muster mit den schon aufgedeckten Buchstaben.
 */
function standFuer(quelle, empfaenger) {
  const k = JSON.parse(JSON.stringify(quelle));
  const r = k.aktuell;
  if (r && !r.fertig && r.rater === empfaenger) {
    const geheim = r.wort;
    r.wort = null;
    // Ein gezogenes Wort steht auch in der Liste der schon benutzten — dort
    // wäre es sonst das jüngste und damit sofort abzulesen.
    k.benutzt = k.benutzt.filter((w) => w !== geheim);
  }
  return k;
}

function standSenden() {
  ui.netz?.senden({ typ: 'stand', stand: standFuer(stand, gegenIndex()) });
}

/** Zug ausführen (Gastgeber) oder hinüberschicken (Gast). */
function tun(name, wert) {
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.netz?.senden({ typ: 'aktion', name, wert });
    return false;
  }
  return true;
}

function nachrichtVerarbeiten(m) {
  if (m.typ === 'namen' && !ui.gastgeber) {
    ui.meinIndex = m.meinIndex === 1 ? 1 : 0;
    return;
  }
  if (m.typ === 'stand' && !ui.gastgeber) {
    stand = m.stand;
    ui.halter = ui.meinIndex;
    // Wer gerade selbst ein Wort eintippt, bleibt auf seinem Bildschirm.
    if (ui.screen !== 'stellen') ui.screen = stand.aktuell ? 'spiel' : 'hub';
    if (stand.aktuell && ui.screen === 'stellen') ui.screen = 'spiel';
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'aktion') {
    if (m.name === 'raten') raten(stand, m.wert);
    else if (m.name === 'wortRaten') wortRaten(stand, m.wert);
    else if (m.name === 'aufgeben') aufgeben(stand);
    else if (m.name === 'weiter') rundeAbschliessen(stand);
    else if (m.name === 'stellt') stand.stellt = m.wert;
    else if (m.name === 'stufe' && STUFEN[m.wert]) stand.stufe = m.wert;
    else if (m.name === 'kategorie') stand.kategorie = m.wert;
    else return;
    sichern();
    standSenden();
    render();
    return;
  }

  if (m.typ === 'wort') {
    try {
      rundeStarten(stand, { wort: m.wort, tipp: m.tipp, setzer: m.setzer, rater: andere(m.setzer) });
    } catch { return; }                      // unsinniges Wort einfach verwerfen
    ui.screen = 'spiel';
    sichern();
    standSenden();
    render();
  }
}

function kopplungAbbrechen() {
  ui.netz?.schliessen();
  ui.netz = null;
  ui.kopplung = null;
  ui.modus = 'lokal';
  ui.meinIndex = 0;
  ui.gastgeber = true;
  render();
}

async function netzStarten(gastgeber, code) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = gastgeber ? 0 : 1;
  ui.kopplung = { schritt: 'raum', gastgeber, code: '', hinweis: '', fehler: '' };
  render();

  ui.netz = netzAufbauen({
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
    await ui.netz.bereit;
  } catch (fehler) {
    if (!ui.kopplung) return;
    ui.kopplung.fehler = fehler.message || 'Das hat nicht geklappt.';
    ui.kopplung.schritt = gastgeber ? 'raum' : 'code';
    render();
  }
}

function verbindungSteht() {
  ui.kopplung = null;
  if (ui.gastgeber) {
    if (!stand) stand = neuerStand();
    ui.halter = ui.meinIndex;
    ui.screen = stand.aktuell ? 'spiel' : 'hub';
    ui.netz?.senden({ typ: 'namen', meinIndex: 1 });
    standSenden();
  }
  render();
}

/* ------------------------------------------------- Seite als Datei sichern */

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
    '</body>', '</html>', '',
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

/** Rückgabe: 'ok' | 'txt' | 'abgelehnt' | 'dev' */
async function seiteAlsDateiSichern(cssId, jsId, dateiname, ersatzTitel) {
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
        } catch (zweiterFehler) {
          if (zweiterFehler && zweiterFehler.code === 'declined') return 'abgelehnt';
        }
      }
    }
  }
  browserDownload(dateiname, html);
  return 'ok';
}

const SICHER_TEXT = {
  ok: 'Gesichert — liegt in deinen Downloads',
  txt: 'Als .txt gesichert — bitte in %NAME% umbenennen',
  abgelehnt: 'Abgebrochen — nichts gespeichert',
  dev: 'Geht nur in der fertigen Version',
};

/* ----------------------------------------------------------- Erste Anlage */

function renderStart() {
  app.innerHTML = `
    <div class="screen start">
      <div class="wrap">
        <h1 class="wortmarke">Galgen<em>männchen</em></h1>
        <p class="unterzeile">Einer denkt sich ein Wort aus, der andere rät.
          Elf Fehlgriffe — dann hängt es.</p>
        <div class="feldlabel">Wer spielt?</div>
        <input class="feld" id="n1" maxlength="14" placeholder="Erster Name" value="Monty">
        <div style="height:10px"></div>
        <input class="feld" id="n2" maxlength="14" placeholder="Zweiter Name" value="Christina">
        <div class="knopfsaeule">
          <button class="btn btn--kreide" id="los">Los geht's</button>
          <button class="btn btn--leise" id="regeln">Wie geht das?</button>
        </div>
      </div>
    </div>`;
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Eins';
    const b = app.querySelector('#n2').value.trim() || 'Zwei';
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)]);
    ui.screen = 'hub';
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Übersicht */

function punktetafel() {
  const f = fuehrung(stand);
  const seite = (i) => `
    <div class="seite ${f && f.index === i ? 'fuehrt' : ''}">
      <div class="wer">${name(i)}</div>
      <div class="zahl num">${stand.punkte[i]}</div>
    </div>`;
  return `<div class="tafel">${seite(0)}<div class="strichlein"></div>${seite(1)}</div>`;
}

function renderHub() {
  const setzer = setzerIndex();
  const kat = KATEGORIEN.find((k) => k.id === stand.kategorie) || KATEGORIEN[0];
  const wartet = ui.modus === 'online' && stand.stellt !== null && stand.stellt !== ui.meinIndex;
  const ichSetze = ui.modus !== 'online' || setzer === ui.meinIndex;

  app.innerHTML = `
    <div class="screen">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Runde ${stand.runde}</div>
          <h1>Galgenmännchen</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      <div class="scroll"><div class="wrap">
        ${punktetafel()}
        ${wartet ? `
          <p style="text-align:center"><b>${name(stand.stellt)}</b> denkt sich gerade
            ein Wort aus …</p>`
          : ichSetze ? `
          <p style="text-align:center"><b>${name(setzer)}</b> stellt das Wort,
            <b>${name(stand.dran)}</b> rät.</p>
          <div class="knopfsaeule">
            <button class="btn btn--kreide" id="selbst">Ich denke mir ein Wort aus</button>
            <button class="btn btn--geist" id="vomHandy">Das Handy stellt das Wort</button>
          </div>`
          : `
          <p style="text-align:center">Du rätst diese Runde.
            <b>${name(setzer)}</b> ist am Zug und denkt sich etwas aus.</p>`}

        <div class="feldlabel">Einstellungen</div>
        <div class="wahlliste">
          <button class="wahl" id="wStufe">
            <div class="haupt">
              <div class="oben">Schwierigkeit: ${esc(STUFEN[stand.stufe].titel)}</div>
              <div class="unten">${esc(STUFEN[stand.stufe].unter)}</div>
            </div><div class="haken">›</div>
          </button>
          <button class="wahl" id="wKat">
            <div class="haupt">
              <div class="oben">Wortliste: ${esc(kat.titel)}</div>
              <div class="unten">Gilt, wenn das Handy das Wort stellt</div>
            </div><div class="haken">›</div>
          </button>
        </div>

        ${stand.verlauf.length ? `
          <div class="feldlabel">Bisher</div>
          ${stand.verlauf.slice(0, 6).map((z) => `
            <div class="zeile">
              <span class="wort">${esc(z.wort)}</span>
              <span class="${z.fertig === 'gewonnen' ? 'pkt--plus' : 'pkt--null'}">${
  z.fertig === 'gewonnen' ? 'erraten' : 'gehängt'}</span>
              <span class="pkt num ${z.gutschrift[0] + z.gutschrift[1] ? 'pkt--plus' : 'pkt--null'}">
                ${z.gutschrift[0] + z.gutschrift[1] ? `+${z.gutschrift[0] + z.gutschrift[1]}` : '0'}</span>
            </div>`).join('')}` : ''}
      </div></div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#wStufe').onclick = () => { ui.overlay = 'stufe'; render(); };
  app.querySelector('#wKat').onclick = () => { ui.overlay = 'kategorie'; render(); };
  app.querySelector('#selbst')?.addEventListener('click', () => {
    ui.entwurf = '';
    ui.entwurfTipp = '';
    ui.eingabefehler = '';
    ui.screen = 'stellen';
    if (ui.modus === 'online') {
      if (ui.gastgeber) { stand.stellt = ui.meinIndex; standSenden(); }
      else ui.netz?.senden({ typ: 'aktion', name: 'stellt', wert: ui.meinIndex });
    }
    render();
  });
  app.querySelector('#vomHandy')?.addEventListener('click', () => {
    const zug = wortZiehen(stand, stand.kategorie);
    const tipp = (KATEGORIEN.find((k) => k.id === zug.kategorie) || {}).tipp || '';
    if (!tun('wort', null)) {
      ui.netz?.senden({ typ: 'wort', wort: zug.wort, tipp, setzer: -1 });
      return;
    }
    rundeStarten(stand, { wort: zug.wort, tipp, setzer: -1, rater: stand.dran });
    ui.halter = stand.dran;
    ui.screen = 'spiel';
    nachAenderung();
  });
}

/* ------------------------------------------------------- Wort eintippen */

function renderStellen() {
  const setzer = ui.modus === 'online' ? ui.meinIndex : setzerIndex();
  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="wrap">
      <h2>Dein Wort, ${name(setzer)}</h2>
      <p>Höchstens drei Wörter, mindestens drei Buchstaben. Umlaute sind eigene
        Tasten — ß gibt es nicht, dafür SS.</p>
      <input class="feld feld--wort" id="wort" maxlength="24" autocomplete="off"
        autocapitalize="characters" spellcheck="false" placeholder="· · · · ·"
        type="${ui.verdeckt ? 'password' : 'text'}" value="${esc(ui.entwurf)}">
      <label class="geheim">
        <input type="checkbox" id="verdeckt" ${ui.verdeckt ? 'checked' : ''}>
        Beim Tippen verbergen
      </label>
      <div class="feldlabel">Tipp (freiwillig)</div>
      <input class="feld" id="tipp" maxlength="60" autocomplete="off"
        placeholder="z. B. „steht in Wien herum“" value="${esc(ui.entwurfTipp)}">
      ${ui.eingabefehler ? `<p class="warnton">${esc(ui.eingabefehler)}</p>` : ''}
      <div class="knopfsaeule">
        <button class="btn btn--kreide" id="fertig">Fertig — jetzt rätst du</button>
        <button class="btn btn--leise" id="zurueck">Zurück</button>
      </div>
    </div></div></div>`;

  const feld = app.querySelector('#wort');
  const tippFeld = app.querySelector('#tipp');
  feld.focus();
  feld.oninput = () => { ui.entwurf = feld.value; };
  tippFeld.oninput = () => { ui.entwurfTipp = tippFeld.value; };
  app.querySelector('#verdeckt').onchange = (e) => {
    ui.entwurf = feld.value;
    ui.entwurfTipp = tippFeld.value;
    ui.verdeckt = e.currentTarget.checked;
    render();
  };
  app.querySelector('#fertig').onclick = () => {
    ui.entwurf = feld.value;
    ui.entwurfTipp = tippFeld.value;
    const grund = wortPruefen(ui.entwurf);
    if (grund) { ui.eingabefehler = grund; render(); return; }
    const wort = normalisieren(ui.entwurf);
    const tipp = ui.entwurfTipp.trim();
    ui.entwurf = '';
    ui.entwurfTipp = '';
    ui.eingabefehler = '';
    if (ui.modus === 'online' && !ui.gastgeber) {
      ui.netz?.senden({ typ: 'wort', wort, tipp, setzer: ui.meinIndex });
      ui.screen = 'hub';
      render();
      return;
    }
    rundeStarten(stand, { wort, tipp, setzer, rater: andere(setzer) });
    ui.halter = setzer;                       // Übergabe erzwingen
    ui.screen = 'spiel';
    nachAenderung();
  };
  app.querySelector('#zurueck').onclick = () => {
    ui.screen = 'hub';
    ui.eingabefehler = '';
    if (ui.modus === 'online') {
      if (ui.gastgeber) { stand.stellt = null; standSenden(); }
      else ui.netz?.senden({ typ: 'aktion', name: 'stellt', wert: null });
    }
    render();
  };
}

/* --------------------------------------------------------------- Die Runde */

function wortfeld(r, zeigen) {
  const zeichen = r.muster.map((z, i) => {
    const echt = r.wort ? r.wort[i] : null;
    if (z === ' ') return '<span class="zeichen zeichen--luecke"></span>';
    if (z === '-') return '<span class="zeichen zeichen--strich">-</span>';
    if (z) {
      const frisch = z === ui.letzter ? ' zeichen--neu' : '';
      return `<span class="zeichen zeichen--voll${frisch}">${esc(z)}</span>`;
    }
    // Nach dem Ende wird aufgedeckt, was gefehlt hat.
    if (zeigen && echt) return `<span class="zeichen zeichen--verraten">${esc(echt)}</span>`;
    return '<span class="zeichen"></span>';
  });
  return `<div class="wortfeld">${zeichen.join('')}</div>`;
}

function fehlerLeiste(r) {
  const uebrig = Math.max(0, r.erlaubt - r.fehler);
  const punkte = Array.from({ length: r.erlaubt }, (_, i) =>
    `<span class="punkt ${i < r.fehler ? 'punkt--weg' : ''}"></span>`).join('');
  return `<div class="leiste"><span>${uebrig} übrig</span><span class="punkte">${punkte}</span></div>`;
}

function renderSpiel() {
  const r = stand.aktuell;
  const fertig = !!r.fertig;
  const zustand = r.fertig === 'gewonnen' ? 'froh' : r.fertig === 'verloren' ? 'weg' : 'laeuft';
  const ichRate = ui.modus !== 'online' || r.rater === ui.meinIndex;

  const tastatur = BUCHSTABEN.map((b) => {
    const treffer = r.geraten.includes(b);
    const daneben = r.daneben.includes(b);
    const klasse = treffer ? ' taste--treffer' : daneben ? ' taste--daneben' : '';
    const aus = fertig || treffer || daneben || !ichRate;
    return `<button class="taste${klasse}" data-b="${b}" ${aus ? 'disabled' : ''}>${b}</button>`;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Runde ${stand.runde} · ${
  r.setzer < 0 ? 'Wort vom Handy' : `Wort von ${name(r.setzer)}`}</div>
          <h1>${name(r.rater)} rät</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      <div class="buehne">
        <div class="galgenfeld">${galgenSvg(gezeichnet(r), { vorab: r.vorab, zustand })}</div>
        ${wortfeld(r, fertig)}
        <div class="tippzeile">${r.tipp ? `Tipp: <b>${esc(r.tipp)}</b>` : ''}</div>
        ${fertig ? abschluss(r) : `
          ${fehlerLeiste(r)}
          <div class="tastatur">${tastatur}</div>
          ${ichRate ? `
            <div class="reihe wortknopf">
              <button class="btn btn--geist" id="ganzesWort">Ganzes Wort</button>
              <button class="btn btn--leise" id="aufgeben">Aufgeben</button>
            </div>` : `
            <p style="text-align:center">${name(r.rater)} ist dran — du siehst nur zu.</p>`}`}
      </div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };

  if (!fertig && ichRate) {
    app.querySelectorAll('.taste:not([disabled])').forEach((k) => {
      k.onclick = () => buchstabeTippen(k.dataset.b);
    });
    app.querySelector('#ganzesWort').onclick = () => { ui.overlay = 'ganzesWort'; render(); };
    app.querySelector('#aufgeben').onclick = () => { ui.overlay = 'aufgeben'; render(); };
  }
  if (fertig) {
    app.querySelector('#weiter').onclick = () => {
      ui.letzter = null;
      if (!tun('weiter')) return;
      rundeAbschliessen(stand);
      ui.screen = 'hub';
      nachAenderung();
    };
  }
}

function buchstabeTippen(b) {
  const r = stand.aktuell;
  if (!r || !offen(r, b)) return;
  ui.letzter = b;
  if (!tun('raten', b)) { render(); return; }
  const was = raten(stand, b);
  buzz(was && was.treffer ? 12 : [18, 40, 18]);
  nachAenderung();
}

function abschluss(r) {
  const gut = r.gutschrift || [0, 0];
  const wer = gut[0] > 0 ? 0 : gut[1] > 0 ? 1 : -1;
  return `
    <div style="text-align:center">
      <h2 style="margin-top:6px">${r.fertig === 'gewonnen' ? 'Erraten!' : 'Gehängt.'}</h2>
      ${r.fertig === 'gewonnen' ? '' : `<p>Das Wort war <b>${esc(r.wort || r.muster.join(''))}</b>.</p>`}
      ${wer >= 0
    ? `<p><b>${name(wer)}</b> bekommt <span class="pkt--plus num">+${gut[wer]}</span> Punkte.</p>`
    : '<p>Keine Punkte diese Runde.</p>'}
      <div class="knopfsaeule">
        <button class="btn btn--kreide" id="weiter">Weiter</button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- Übergabe */

function renderUebergabe(wer) {
  const r = stand?.aktuell;
  const auftrag = ui.screen === 'stellen'
    ? 'Denk dir ein Wort aus — ohne dass jemand mitliest.'
    : 'Du rätst. Der andere darf jetzt ruhig zuschauen.';
  const layer = document.createElement('div');
  layer.className = 'overlay uebergabe';
  layer.innerHTML = `
    <div class="pfeil" aria-hidden="true">📱</div>
    <div class="lbl">Handy weitergeben an</div>
    <div class="name">${name(wer)}</div>
    <p class="auftrag">${auftrag}</p>
    ${r && ui.screen === 'spiel' && r.tipp ? `<p class="auftrag">Tipp: ${esc(r.tipp)}</p>` : ''}
    <button class="btn btn--kreide" id="btnBereit">Ich hab's</button>`;
  app.appendChild(layer);
  layer.querySelector('#btnBereit').onclick = () => { ui.halter = wer; render(); };
}

/* ------------------------------------- Kopplung ohne Server: QR im selben WLAN */

/** Womit hängt dieses Handy gerade am Netz? Chrome kennt die Antwort. */
function netzArt() {
  const c = navigator.connection || navigator.mozConnection || {};
  if (c.type) return c.type === 'none' ? 'kein Netz' : c.type;
  return navigator.onLine ? 'verbunden' : 'kein Netz';
}

/** Was die Direktverbindung gerade weiß — in einer Zeile, für den Ernstfall. */
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
    if (!ui.kopplung || !ui.netz) { clearInterval(ui.lageTakt); ui.lageTakt = null; return; }
    const feld = document.getElementById('lage');
    if (feld) feld.textContent = lageText(ui.netz.lage, ui.kopplung.schritt === 'warten');
  }, 500);
}

/** Kopplung von vorn: alte Verbindung weg, gleiche Rolle noch einmal. */
function kopplungNeu() {
  const gastgeber = ui.kopplung?.gastgeber ?? true;
  ui.netz?.schliessen();
  ui.netz = null;
  funkStarten(gastgeber);
}

/**
 * Direktverbindung zwischen zwei Handys. Braucht keinen Server, dafür ein
 * gemeinsames WLAN — nach außen sieht sie aus wie die Durchreiche.
 */
async function funkStarten(gastgeber) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = gastgeber ? 0 : 1;
  ui.kopplung = { schritt: 'moment', gastgeber, ueberQr: true, hinweis: '', fehler: '' };
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

  ui.netz = funkAufbauen({
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
    ui.kopplung.code = await ui.netz.eigenerCode();
    ui.kopplung.schritt = 'zeigen';
  } else {
    ui.kopplung.schritt = 'scannen';
  }
  render();
}

async function fremdenCodeAnnehmen(code) {
  const k = ui.kopplung;
  try {
    await ui.netz.codeLesen(code);
    if (!ui.kopplung) return;                  // war schon verbunden
    if (!k.gastgeber) {
      ui.kopplung.code = await ui.netz.eigenerCode();
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

function renderKopplung() {
  const k = ui.kopplung;

  if (k.schritt === 'rolle') {
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="wrap">
        <h2>Auf zwei Handys</h2>
        <p>Jeder auf seinem Gerät: Wer das Wort stellt, tippt es bei sich ein —
          der andere sieht nur die Lücken.</p>
        ${netzMoeglich() ? `
        <div class="feldlabel">Über das Internet</div>
        <p>Egal wo ihr seid. Einer öffnet einen Raum, der andere tippt den Code ein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--kreide" id="netzWirt">Raum öffnen</button>
          <button class="btn btn--geist" id="netzGast">Mit Code beitreten</button>
        </div>` : ''}
        <div class="feldlabel">Im selben WLAN</div>
        <p>Ohne Server, direkt von Handy zu Handy. Ihr zeigt euch dafür QR-Codes.
          Beide Geräte müssen im selben WLAN sein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--geist" id="qrWirt">QR zeigen</button>
          <button class="btn btn--geist" id="qrGast">QR scannen</button>
        </div>
        <div class="knopfsaeule">
          <button class="btn btn--leise" id="abbruch">Doch an einem Handy</button>
        </div>
      </div></div></div>`;
    app.querySelector('#netzWirt')?.addEventListener('click', () => netzStarten(true));
    app.querySelector('#netzGast')?.addEventListener('click', () => {
      ui.kopplung = { schritt: 'code', gastgeber: false, code: '', fehler: '' };
      render();
    });
    app.querySelector('#qrWirt').onclick = () => funkStarten(true);
    app.querySelector('#qrGast').onclick = () => funkStarten(false);
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'kamera') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="wrap">
      <h2>Kamera freigeben</h2>
      <p>Dieses Handy hat die Kamera nicht freigegeben. Ohne sie kann es weder den QR-Code
        scannen noch seine eigene Netzwerkadresse herausgeben — die beiden Handys finden
        sich dann nicht.</p>
      <p><strong>So geht es:</strong> Handy-Einstellungen → Apps → „Spiele“ → Berechtigungen
        → Kamera → <em>Zulassen</em>. Im Browser stattdessen: Schloss-Symbol neben der
        Adresse → Berechtigungen → Kamera. Danach hier auf <em>Nochmal fragen</em>.</p>
      <div class="knopfsaeule">
        <button class="btn btn--kreide" id="kameraNochmal">Nochmal fragen</button>
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
    app.innerHTML = `<div class="screen"><div class="wrap">
      <h2>Einen Moment</h2>
      <p>Verbindungsdaten werden vorbereitet. Falls nach der Kamera gefragt wird:
        erlauben — ohne die Freigabe finden sich die Handys nicht.</p></div></div>`;
    return;
  }

  if (k.schritt === 'warten') {
    app.innerHTML = `<div class="screen"><div class="wrap">
      <h2>Verbinde …</h2>
      <p>${esc(k.hinweis || 'Die Handys suchen sich gerade.')}</p>
      <p>Dauert es länger als ein paar Sekunden, sagt die Zeile darunter, woran es liegt.</p>
      <p class="lage" id="lage"></p>
      <div class="knopfsaeule">
        <button class="btn btn--geist" id="nochmal">Von vorn versuchen</button>
        <button class="btn btn--leise" id="abbruch">Abbrechen</button></div>
    </div></div>`;
    app.querySelector('#nochmal').onclick = () => kopplungNeu();
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'zeigen') {
    app.innerHTML = `
      <div class="screen"><div class="scrollbar"><div class="wrap">
        <h2>${k.gastgeber ? 'Zeig diesen Code' : 'Jetzt du zurück'}</h2>
        <p>${k.gastgeber
    ? 'Die andere Person scannt ihn mit „QR scannen“.'
    : 'Halt den Code dem ersten Handy hin — es scannt ihn.'}</p>
        <div class="qrfeld"><canvas id="qr" width="720" height="720"></canvas></div>
        <details class="codeklappe">
          <summary>Kamera streikt? Code als Text</summary>
          <textarea class="codefeld" id="raus" readonly>${esc(k.code || '')}</textarea>
          <button class="btn btn--geist" id="kopieren">Kopieren</button>
        </details>
        <p class="lage" id="lage"></p>
        <div class="knopfsaeule">
          <button class="btn btn--kreide" id="weiterKoppeln">${k.gastgeber
    ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#eef3ef', dunkel: '#1b2422' });
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

  if (k.schritt === 'scannen') {
    app.innerHTML = `
      <div class="screen"><div class="scrollbar"><div class="wrap">
        <h2>Code scannen</h2>
        <p>Halte die Kamera auf den Code des anderen Handys.</p>
        <div class="scanfenster"><video id="kamera" muted playsinline></video></div>
        ${k.fehler ? `<p><span class="warnton">${esc(k.fehler)}</span></p>` : ''}
        <details class="codeklappe" ${scannerMoeglich() ? '' : 'open'}>
          <summary>Kamera streikt? Code eintippen oder einfügen</summary>
          <textarea class="codefeld" id="rein" placeholder="HM1O|…"></textarea>
          <button class="btn btn--geist" id="uebernehmen">Code übernehmen</button>
        </details>
        <div class="knopfsaeule">
          <button class="btn btn--leise" id="abbruch">Abbrechen</button></div>
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
    return;
  }

  if (k.schritt === 'code') {
    app.innerHTML = `
      <div class="screen"><div class="wrap">
        <h2>Code eingeben</h2>
        <p>Auf dem anderen Handy steht ein fünfstelliger Code.</p>
        <input class="feld feld--code" id="raumcode" maxlength="5" autocapitalize="characters"
          autocomplete="off" spellcheck="false" placeholder="ABCDE" value="${esc(k.code || '')}">
        ${k.fehler ? `<p class="warnton">${esc(k.fehler)}</p>` : ''}
        <div class="knopfsaeule">
          <button class="btn btn--kreide" id="beitreten">Mitspielen</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div>`;
    const feld = app.querySelector('#raumcode');
    feld.focus();
    app.querySelector('#beitreten').onclick = () => {
      const wert = feld.value.trim().toUpperCase();
      if (wert.length < 4) { k.fehler = 'Der Code hat fünf Zeichen.'; render(); return; }
      netzStarten(false, wert);
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  app.innerHTML = `
    <div class="screen"><div class="wrap">
      <h2>${k.gastgeber ? 'Dein Raum steht' : 'Verbinde …'}</h2>
      ${k.gastgeber
    ? `<p>Gib diesen Code an das andere Handy — dort auf dieser Seite
           <b>„Mit Code beitreten“</b> wählen.</p>
         <div class="raumcode">${esc(k.code || '·····')}</div>
         <p>Ihr müsst <b>nicht</b> im selben WLAN sein. Der Punktestand dieses
           Geräts gilt für beide.</p>`
    : `<p>${esc(k.hinweis || 'Der Raum wird gesucht …')}</p>`}
      ${k.fehler ? `<p class="warnton">${esc(k.fehler)}</p>` : ''}
      <div class="knopfsaeule"><button class="btn btn--leise" id="abbruch">Abbrechen</button></div>
    </div></div>`;
  app.querySelector('#abbruch').onclick = kopplungAbbrechen;
}

/* --------------------------------------------------------------- Overlays */

function overlayHuelle(inhalt) {
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `<div class="scroll"><div class="blatt">${inhalt}</div></div>`;
  app.appendChild(layer);
  return layer;
}

function renderRegeln() {
  const l = overlayHuelle(`
    <h2>Wie geht das?</h2>
    <p>Einer denkt sich ein Wort aus. Der andere rät Buchstaben — einen nach dem
      anderen. Jeder Buchstabe, der im Wort steckt, wird aufgedeckt. Jeder, der
      nicht drin ist, kostet einen Fehlversuch und zeichnet einen Strich am
      Galgen.</p>

    <h3>Gewonnen oder gehängt</h3>
    <p>Steht das Wort komplett, hat der Rater gewonnen. Sind alle Fehlversuche
      verbraucht, ist das Männchen fertig gezeichnet — dann bekommt derjenige die
      Punkte, der das Wort gestellt hat.</p>

    <h3>Punkte</h3>
    <ul>
      <li>Erraten: <b>${PUNKTE.grundGewonnen}</b> Punkte, plus
        <b>${PUNKTE.jeUebrigerFehler}</b> für jeden nicht verbrauchten Fehlversuch.</li>
      <li>Ab zwölf Buchstaben gibt es <b>${PUNKTE.langesWort}</b> Punkte obendrauf.</li>
      <li>Nicht erraten: <b>${PUNKTE.setzerGewinnt}</b> Punkte für den, der das Wort
        gestellt hat. Wörter vom Handy bringen niemandem Punkte.</li>
    </ul>

    <h3>Schwierigkeit</h3>
    <p>Sie bestimmt, wie viel vom Galgen schon steht, bevor es losgeht — und damit,
      wie viele Fehlgriffe bleiben: ${Object.values(STUFEN)
    .map((s) => `<b>${s.titel}</b> ${erlaubteFehler(Object.keys(STUFEN)
      .find((k) => STUFEN[k] === s))}`).join(', ')} Fehler.</p>

    <h3>Buchstaben</h3>
    <p>A bis Z und die Umlaute Ä, Ö, Ü sind eigene Tasten — ein geratenes A deckt
      also kein Ä auf. Ein ß gibt es nicht; in Großschrift steht dafür SS.
      Leerzeichen und Bindestriche sind von Anfang an zu sehen.</p>

    <h3>Ganzes Wort</h3>
    <p>Wer eine Idee hat, kann das ganze Wort auf einmal sagen. Danebengeraten
      kostet einen Fehlversuch — sonst wäre Durchprobieren gratis.</p>

    <h3>An zwei Handys</h3>
    <p>Wer das Wort stellt, tippt es bei sich ein. Auf dem Bildschirm des Ratenden
      erscheinen nur die Lücken, und gespeichert wird es dort auch nicht. Rechnen muss
      allerdings ein Gerät für beide — das hat das Wort so lange im Arbeitsspeicher.
      Wer ganz sichergehen will, spielt an einem Handy und reicht es weiter.</p>

    <div class="knopfsaeule"><button class="btn btn--kreide" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div class="knopfsaeule">
      ${ui.modus === 'lokal'
    ? '<button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys spielen</button>'
    : '<button class="btn btn--geist" id="trennen">Verbindung trennen</button>'}
      <button class="btn btn--geist" id="verlauf">Alle Runden ansehen</button>
      <button class="btn btn--geist" id="code">Punktestand sichern oder laden</button>
      <button class="btn btn--geist" id="sichern">Spiel als Datei sichern</button>
      ${stand.aktuell ? '<button class="btn btn--geist" id="abbrechen">Laufende Runde verwerfen</button>' : ''}
      <button class="btn btn--geist" id="neu">Punkte zurücksetzen</button>
      <button class="btn btn--leise" id="zu">Zurück</button>
    </div>
    <p class="lage" id="status">${esc(ui.codeStatus)}</p>`);

  l.querySelector('#zu').onclick = () => { ui.overlay = null; ui.codeStatus = ''; render(); };
  l.querySelector('#zweiGeraete')?.addEventListener('click', () => {
    ui.overlay = null;
    ui.kopplung = { schritt: 'rolle', gastgeber: true, code: '', fehler: '' };
    render();
  });
  l.querySelector('#trennen')?.addEventListener('click', () => { ui.overlay = null; kopplungAbbrechen(); });
  l.querySelector('#verlauf').onclick = () => { ui.overlay = 'verlauf'; render(); };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('hangman-css', 'hangman-js', 'Galgenmaennchen.html', 'Galgenmännchen');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'Galgenmaennchen.html');
    render();
  };
  l.querySelector('#abbrechen')?.addEventListener('click', () => {
    rundeAbbrechen(stand);
    ui.overlay = null;
    ui.screen = 'hub';
    nachAenderung();
  });
  l.querySelector('#neu').onclick = () => {
    stand = neuerStand(stand.spieler.map((s) => s.name));
    ui.overlay = null;
    ui.screen = 'hub';
    nachAenderung();
  };
}

function renderStufe() {
  const l = overlayHuelle(`
    <h2>Schwierigkeit</h2>
    <p>Je schwerer, desto mehr vom Galgen steht schon — und desto weniger
      Fehlgriffe bleiben.</p>
    <div class="wahlliste">
      ${Object.entries(STUFEN).map(([id, s]) => `
        <button class="wahl ${stand.stufe === id ? 'wahl--an' : ''}" data-id="${id}">
          <div class="haupt"><div class="oben">${esc(s.titel)}</div>
            <div class="unten">${esc(s.unter)}</div></div>
          <div class="haken">${stand.stufe === id ? '✓' : ''}</div>
        </button>`).join('')}
    </div>
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);
  l.querySelectorAll('.wahl').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (!tun('stufe', id)) { ui.overlay = null; render(); return; }
      stand.stufe = id;
      ui.overlay = null;
      nachAenderung();
    };
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderKategorie() {
  const liste = [...KATEGORIEN, { id: 'alle', titel: 'Alles gemischt', tipp: 'Quer durch alle Listen' }];
  const l = overlayHuelle(`
    <h2>Wortliste</h2>
    <p>Gilt nur, wenn das Handy das Wort stellt. Die Kategorie ist dann zugleich
      der Tipp.</p>
    <div class="wahlliste">
      ${liste.map((k) => `
        <button class="wahl ${stand.kategorie === k.id ? 'wahl--an' : ''}" data-id="${k.id}">
          <div class="haupt"><div class="oben">${esc(k.titel)}</div>
            <div class="unten">${esc(k.tipp)}</div></div>
          <div class="haken">${stand.kategorie === k.id ? '✓' : ''}</div>
        </button>`).join('')}
    </div>
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);
  l.querySelectorAll('.wahl').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (!tun('kategorie', id)) { ui.overlay = null; render(); return; }
      stand.kategorie = id;
      ui.overlay = null;
      nachAenderung();
    };
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderVerlauf() {
  const s = stand.statistik;
  const l = overlayHuelle(`
    <h2>Alle Runden</h2>
    <div class="tafel">
      <div class="seite"><div class="wer">${name(0)}</div>
        <div class="zahl num">${s.erraten[0]}</div><div class="wer">erraten</div></div>
      <div class="strichlein"></div>
      <div class="seite"><div class="wer">${name(1)}</div>
        <div class="zahl num">${s.erraten[1]}</div><div class="wer">erraten</div></div>
    </div>
    ${stand.verlauf.length ? stand.verlauf.map((z) => `
      <div class="zeile">
        <span class="wort">${esc(z.wort)}</span>
        <span style="font-size:13px">${z.setzer < 0 ? 'Handy' : name(z.setzer)} →
          ${name(z.rater)}</span>
        <span class="pkt num ${z.fertig === 'gewonnen' ? 'pkt--plus' : 'pkt--null'}">${
  z.fertig === 'gewonnen' ? `+${z.gutschrift[z.rater]}` : `${z.fehler} F`}</span>
      </div>`).join('') : '<p>Noch keine Runde gespielt.</p>'}
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; render(); };
}

function renderCode() {
  const l = overlayHuelle(`
    <h2>Punktestand mitnehmen</h2>
    <p>Der Code enthält Namen, Punkte und die Runde — sonst nichts. Auf einem
      anderen Handy einfügen, und ihr spielt dort weiter.</p>
    <div class="feldlabel">Dieser Stand</div>
    <textarea class="codefeld" id="raus" readonly>${esc(alsCode(stand))}</textarea>
    <button class="btn btn--geist" id="kopieren">Kopieren</button>
    <div class="feldlabel">Anderen Stand übernehmen</div>
    <textarea class="codefeld" id="rein" placeholder="HMS1-…"></textarea>
    <button class="btn btn--geist" id="uebernehmen">Diesen Stand übernehmen</button>
    <p class="lage" id="status">${esc(ui.codeStatus)}</p>
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);

  l.querySelector('#kopieren').onclick = async (e) => {
    try { await navigator.clipboard.writeText(alsCode(stand)); e.currentTarget.textContent = 'Kopiert'; }
    catch { l.querySelector('#raus').select(); }
  };
  l.querySelector('#uebernehmen').onclick = () => {
    try {
      stand = ausCode(l.querySelector('#rein').value);
      ui.overlay = null;
      ui.screen = 'hub';
      ui.codeStatus = '';
      nachAenderung();
    } catch (fehler) {
      ui.codeStatus = fehler.message;
      render();
    }
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; ui.codeStatus = ''; render(); };
}

function renderGanzesWort() {
  const l = overlayHuelle(`
    <h2>Ganzes Wort</h2>
    <p>Danebengeraten kostet einen Fehlversuch.</p>
    <input class="feld feld--wort" id="versuch" maxlength="24" autocomplete="off"
      autocapitalize="characters" spellcheck="false" placeholder="· · · · ·">
    <div class="knopfsaeule">
      <button class="btn btn--kreide" id="sagen">Das ist mein Wort</button>
      <button class="btn btn--leise" id="zu">Doch nicht</button>
    </div>`);
  const feld = l.querySelector('#versuch');
  feld.focus();
  l.querySelector('#sagen').onclick = () => {
    const versuch = normalisieren(feld.value);
    if (!versuch) return;
    ui.overlay = null;
    ui.letzter = null;
    if (!tun('wortRaten', versuch)) { render(); return; }
    const was = wortRaten(stand, versuch);
    buzz(was && was.treffer ? 20 : [18, 40, 18]);
    nachAenderung();
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderAufgeben() {
  const l = overlayHuelle(`
    <h2>Aufgeben?</h2>
    <p>Das Wort wird aufgedeckt und zählt als nicht erraten.</p>
    <div class="knopfsaeule">
      <button class="btn btn--geist" id="ja">Ja, aufdecken</button>
      <button class="btn btn--leise" id="zu">Weiterraten</button>
    </div>`);
  l.querySelector('#ja').onclick = () => {
    ui.overlay = null;
    if (!tun('aufgeben')) { render(); return; }
    aufgeben(stand);
    nachAenderung();
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

/* ----------------------------------------------------------------- Render */

function render() {
  // Der Scanner darf nicht weiterlaufen, wenn sein Bildschirm verschwindet.
  const k = ui.kopplung;
  if (k && k.scannerStoppen && k.schritt !== 'scannen') { k.scannerStoppen(); k.scannerStoppen = null; }

  if (!stand) { renderStart(); }
  else if (ui.kopplung) { renderKopplung(); }
  else if (ui.screen === 'stellen') { renderStellen(); }
  else if (ui.screen === 'spiel' && stand.aktuell) { renderSpiel(); }
  else { ui.screen = 'hub'; renderHub(); }

  // Ein Handy: erst weiterreichen, dann weiterspielen.
  if (stand && !ui.kopplung && ui.modus === 'lokal') {
    const wer = braucht();
    if (wer !== null && wer !== ui.halter) { renderUebergabe(wer); return; }
  }

  // Die Regeln muss man auch lesen können, bevor überhaupt ein Spiel angelegt ist.
  if (ui.overlay === 'regeln') { renderRegeln(); return; }
  if (!stand) return;
  if (ui.overlay === 'menue') renderMenue();
  else if (ui.overlay === 'stufe') renderStufe();
  else if (ui.overlay === 'kategorie') renderKategorie();
  else if (ui.overlay === 'verlauf') renderVerlauf();
  else if (ui.overlay === 'code') renderCode();
  else if (ui.overlay === 'ganzesWort') renderGanzesWort();
  else if (ui.overlay === 'aufgeben') renderAufgeben();
}

stand = laden();
if (stand) ui.screen = stand.aktuell ? 'spiel' : 'hub';
render();
