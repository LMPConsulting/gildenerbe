// Ärger — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.
//
// Hier gibt es nichts zu verbergen: beide sehen dasselbe Brett. Darum kein
// Übergabe-Bildschirm — die Kopfzeile sagt, wer dran ist.

import {
  RING, HAUSLAENGE, START, VORGABE,
  neuerStand, wuerfeln, zuege, ziehen, ziehbar, feldVon,
  figurenAuf, wuerfeErlaubt, zugBeenden, partieNeu, vorbei, alsCode, ausCode,
} from './engine.js';
import { RINGFELDER, HAUSFELDER, BASISFELDER, mitte, BRETTGROESSE } from './brett.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'aerger.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  screen: 'start',
  overlay: null,
  codeStatus: '',
  rollt: false,          // Würfelanimation läuft
  modus: 'lokal',
  meinIndex: 0,
  gastgeber: true,
  netz: null,
  kopplung: null,
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const andere = (i) => (i === 0 ? 1 : 0);
const name = (i) => esc(stand.spieler[i]?.name || (i === 0 ? 'Rot' : 'Blau'));
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.siege) && Array.isArray(s.figuren)) return s;
  } catch { /* kaputter Stand wird ignoriert */ }
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

/** Darf dieses Gerät gerade handeln? */
const ichBinDran = () => ui.modus !== 'online' || stand.dran === ui.meinIndex;

/* ---------------------------------------------------- Zwei Handys, ein Spiel */

const gegenIndex = () => (ui.meinIndex === 0 ? 1 : 0);

// Beim Ärger ist nichts geheim — der Stand geht unverändert hinüber.
const standFuer = (quelle) => quelle;

function standSenden() {
  ui.netz?.senden({ typ: 'stand', stand: standFuer(stand, gegenIndex()) });
}

/** Zug ausführen (Gastgeber) oder hinüberschicken (Gast). */
function tun(name2, wert) {
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.netz?.senden({ typ: 'aktion', name: name2, wert });
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
    ui.screen = 'spiel';
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'aktion') {
    try {
      if (m.name === 'wuerfeln') wuerfeln(stand);
      else if (m.name === 'ziehen') ziehen(stand, m.wert);
      else if (m.name === 'weiter') zugBeenden(stand);
      else if (m.name === 'partieNeu') partieNeu(stand);
      else if (m.name === 'regel') stand.regeln = { ...stand.regeln, ...m.wert };
      else return;
    } catch { return; }            // ein Zug, der nicht geht, wird verworfen
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
    ui.screen = 'spiel';
    ui.netz?.senden({ typ: 'namen', meinIndex: 1 });
    standSenden();
  }
  render();
}

/* ------------------------------------------------- Seite als Datei sichern */

function seitenQuelltext(cssId, jsId, ersatzTitel) {
  const css = document.getElementById(cssId)?.textContent || '';
  const js = document.getElementById(jsId)?.textContent || '';
  if (!css || !js) return null;
  const kopf = typeof SEITENKOPF === 'string'
    ? SEITENKOPF
    : `<meta charset="utf-8"><title>${ersatzTitel}</title>`;
  return [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    `<style id="${cssId}">`, css, '</style>', '</head>', '<body>',
    '<div id="app"></div>',
    `<script id="${jsId}">`, js, '<' + '/script>',
    '</body>', '</html>', '',
  ].join('\n');
}

function browserDownload(dateiname, html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url; a.download = dateiname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Rückgabe: 'ok' | 'txt' | 'abgelehnt' | 'dev' */
async function seiteAlsDateiSichern(cssId, jsId, dateiname, ersatzTitel) {
  if (typeof OFFLINE_DATEI === 'string') {
    const a = document.createElement('a');
    a.href = OFFLINE_DATEI; a.download = dateiname;
    document.body.appendChild(a); a.click(); a.remove();
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
        <h1 class="wortmarke">Ärger</h1>
        <p class="unterzeile">Vier Figuren, ein Würfel, kein Erbarmen.
          Wer als Erster alle vier zu Hause hat, gewinnt.</p>
        <div class="feldlabel">Wer spielt?</div>
        <input class="feld" id="n1" maxlength="14" placeholder="Rot" value="Monty">
        <div style="height:10px"></div>
        <input class="feld" id="n2" maxlength="14" placeholder="Blau" value="Christina">
        <div class="knopfsaeule">
          <button class="btn btn--holz" id="los">Los geht's</button>
          <button class="btn btn--leise" id="regeln">Wie geht das?</button>
        </div>
      </div>
    </div>`;
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Rot';
    const b = app.querySelector('#n2').value.trim() || 'Blau';
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)]);
    ui.screen = 'spiel';
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Das Brett */

const ZELLE = 10;
const MASS = BRETTGROESSE * ZELLE;

/** Wo steht diese Figur auf dem Brett? */
function figurPunkt(spieler, figur, f) {
  if (f.ort === 'basis') return mitte(BASISFELDER[spieler][figur], ZELLE);
  if (f.ort === 'haus') return mitte(HAUSFELDER[spieler][f.schritt], ZELLE);
  return mitte(RINGFELDER[feldVon(spieler, f.schritt)], ZELLE);
}

/** Wohin käme die Figur mit dem aktuellen Zug? */
function zielPunkt(spieler, zug) {
  if (zug.nach.ort === 'haus') return mitte(HAUSFELDER[spieler][zug.nach.schritt], ZELLE);
  return mitte(RINGFELDER[feldVon(spieler, zug.nach.schritt)], ZELLE);
}

function brettSvg() {
  const moeglich = ichBinDran() ? zuege(stand) : [];
  const beweglich = new Set(moeglich.map((z) => z.figur));
  const teile = [];

  // Farbige Flächen zuerst: die Ecke, in der gewartet wird, und die Zielbahn.
  // Ohne sie ist das Brett nur ein Feld voller Kreise.
  BASISFELDER.forEach((liste, spieler) => {
    const xs = liste.map(([x]) => x);
    const ys = liste.map(([, y]) => y);
    const x0 = Math.min(...xs) * ZELLE + 0.6;
    const y0 = Math.min(...ys) * ZELLE + 0.6;
    teile.push(`<rect class="hof hof--${spieler}" x="${x0}" y="${y0}"`
      + ` width="${2 * ZELLE - 1.2}" height="${2 * ZELLE - 1.2}" rx="4"/>`);
  });
  HAUSFELDER.forEach((liste, spieler) => {
    const xs = liste.map(([x]) => x);
    const x0 = Math.min(...xs) * ZELLE + 0.8;
    const y0 = liste[0][1] * ZELLE + 0.8;
    teile.push(`<rect class="bahn bahn--${spieler}" x="${x0}" y="${y0}"`
      + ` width="${4 * ZELLE - 1.6}" height="${ZELLE - 1.6}" rx="4"/>`);
  });

  // Die Mitte: ein ruhiger Punkt, damit das Kreuz einen Mittelpunkt hat.
  const [mx, my] = mitte([5, 5], ZELLE);
  teile.push(`<circle class="nabe" cx="${mx}" cy="${my}" r="4.6"/>`);
  teile.push(`<circle class="nabe-innen" cx="${mx}" cy="${my}" r="2.2"/>`);

  // Löcher: Ring, Häuser, Basisplätze
  RINGFELDER.forEach(([x, y], i) => {
    const [cx, cy] = mitte([x, y], ZELLE);
    const start = i === START[0] ? ' loch--start0' : i === START[1] ? ' loch--start1' : '';
    teile.push(`<circle class="loch${start}" cx="${cx}" cy="${cy}" r="3.7"/>`);
    if (start) teile.push(`<circle class="startpunkt startpunkt--${i === START[0] ? 0 : 1}"`
      + ` cx="${cx}" cy="${cy}" r="1.4"/>`);
  });
  HAUSFELDER.forEach((liste, spieler) => liste.forEach(([x, y]) => {
    const [cx, cy] = mitte([x, y], ZELLE);
    teile.push(`<circle class="loch loch--haus${spieler}" cx="${cx}" cy="${cy}" r="3.7"/>`);
  }));
  BASISFELDER.forEach((liste, spieler) => liste.forEach(([x, y]) => {
    const [cx, cy] = mitte([x, y], ZELLE);
    teile.push(`<circle class="loch loch--basis${spieler}" cx="${cx}" cy="${cy}" r="3.9"/>`);
  }));

  // Zielpunkte der möglichen Züge — kleine Marken, damit man sieht, wohin es geht
  moeglich.forEach((z) => {
    const [zx, zy] = zielPunkt(stand.dran, z);
    teile.push(`<circle class="zielpunkt" cx="${zx}" cy="${zy}" r="1.5"/>`);
  });

  // Figuren
  stand.figuren.forEach((seite, spieler) => seite.forEach((f, figur) => {
    const [cx, cy] = figurPunkt(spieler, figur, f);
    const waehlbar = spieler === stand.dran && beweglich.has(figur);
    teile.push(`<circle class="figur figur--${spieler}${waehlbar ? ' figur--wahl' : ''}"`
      + ` cx="${cx}" cy="${cy}" r="3.2"${waehlbar ? ` data-figur="${figur}"` : ''}/>`);
    if (waehlbar) teile.push(`<circle class="ring" cx="${cx}" cy="${cy}" r="4.4" pointer-events="none"/>`);
  }));

  return `<svg class="brett" viewBox="0 0 ${MASS} ${MASS}" role="img"
    aria-label="Spielbrett mit ${RING} Feldern">${teile.join('')}</svg>`;
}

const AUGEN = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function wuerfelSvg(wurf) {
  if (!wurf) return '<span>?</span>';
  const gesetzt = new Set(AUGEN[wurf]);
  return Array.from({ length: 9 }, (_, i) =>
    `<span class="auge${gesetzt.has(i) ? '' : ' auge--leer'}"></span>`).join('');
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
        <p>Jeder auf seinem Gerät: Beide sehen dasselbe Brett — hier gibt es nichts zu verbergen —
          der andere sieht nur die Lücken.</p>
        ${netzMoeglich() ? `
        <div class="feldlabel">Über das Internet</div>
        <p>Egal wo ihr seid. Einer öffnet einen Raum, der andere tippt den Code ein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--holz" id="netzWirt">Raum öffnen</button>
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
        <button class="btn btn--holz" id="kameraNochmal">Nochmal fragen</button>
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
          <button class="btn btn--holz" id="weiterKoppeln">${k.gastgeber
    ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#efe2c8', dunkel: '#2a201a' });
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
          <textarea class="codefeld" id="rein" placeholder="AE1O|…"></textarea>
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
          <button class="btn btn--holz" id="beitreten">Mitspielen</button>
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

/* ---------------------------------------------------------- Der Spieltisch */

/** Was steht gerade an? Zwei Zeilen Klartext neben dem Würfel. */
function ansage() {
  const dran = stand.dran;
  const meins = ichBinDran();
  const wer = meins && ui.modus === 'online' ? 'Du bist' : `${name(dran)} ist`;
  if (vorbei(stand)) return { eins: `${name(stand.fertig)} hat gewonnen.`, zwei: '' };

  if (stand.wurf === null) {
    const uebrig = stand.wuerfeUebrig;
    return {
      eins: `${wer} dran — würfeln.`,
      zwei: uebrig > 1 ? `Noch ${uebrig} Würfe: keine Figur auf der Bahn.` : '',
    };
  }
  const moeglich = zuege(stand);
  if (!moeglich.length) {
    return { eins: `${stand.wurf} gewürfelt — kein Zug möglich.`, zwei: 'Weiter.', warnung: true };
  }
  if (stand.regeln.strengeSechs && stand.wurf === 6
      && stand.figuren[dran].some((f) => f.ort === 'basis') && moeglich.length === 1) {
    return { eins: 'Eine Sechs — erst heraus.', zwei: 'Der Zug ist vorgegeben.' };
  }
  return {
    eins: `${stand.wurf} gewürfelt.`,
    zwei: moeglich.length === 1 ? 'Ein Zug ist möglich — tipp die Figur an.'
      : `${moeglich.length} Figuren können ziehen.`,
  };
}

function renderSpiel() {
  const a = ansage();
  const kannWuerfeln = ichBinDran() && !vorbei(stand) && stand.wurf === null && stand.wuerfeUebrig > 0;
  const kannWeiter = ichBinDran() && !vorbei(stand) && stand.wurf !== null && zuege(stand).length === 0;

  app.innerHTML = `
    <div class="screen screen--spiel">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Partie ${stand.partie} · ${stand.siege[0]} : ${stand.siege[1]}</div>
          <h1>${vorbei(stand)
    ? `<span class="wer--${stand.fertig}">${name(stand.fertig)}</span> gewinnt`
    : `<span class="wer--${stand.dran}">${name(stand.dran)}</span> ist dran`}</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      <div class="tischplatte">${brettSvg()}</div>
      <div class="leiste">
        <button class="wuerfel${stand.wurf ? '' : ' wuerfel--frage'}${ui.rollt ? ' wuerfel--rollt' : ''}"
          id="wuerfel" ${kannWuerfeln ? '' : 'disabled'}
          aria-label="${stand.wurf ? `Gewürfelt: ${stand.wurf}` : 'Würfeln'}">${wuerfelSvg(stand.wurf)}</button>
        <div class="sagt">
          <div class="zeile1${a.warnung ? ' warnung' : ''}">${esc(a.eins)}</div>
          <div class="zeile2">${esc(a.zwei || '')}</div>
        </div>
        ${kannWeiter ? '<button class="btn btn--geist" id="weiter" style="width:auto;padding:14px 18px">Weiter</button>' : ''}
      </div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  if (kannWuerfeln) app.querySelector('#wuerfel').onclick = wuerfelTippen;
  if (kannWeiter) app.querySelector('#weiter').onclick = weiterTippen;
  app.querySelectorAll('.figur--wahl').forEach((k) => {
    k.onclick = () => figurTippen(Number(k.dataset.figur));
  });
}

function wuerfelTippen() {
  ui.rollt = true;
  render();
  setTimeout(() => {
    ui.rollt = false;
    if (!tun('wuerfeln')) { render(); return; }
    try { wuerfeln(stand); } catch { render(); return; }
    buzz(12);
    nachAenderung();
  }, 380);
}

function figurTippen(figur) {
  if (!ziehbar(stand, figur)) return;
  const schlaegt = zuege(stand).find((z) => z.figur === figur)?.schlaegt;
  if (!tun('ziehen', figur)) { render(); return; }
  try { ziehen(stand, figur); } catch { render(); return; }
  buzz(schlaegt ? [20, 50, 20] : 10);
  nachAenderung();
}

function weiterTippen() {
  if (!tun('weiter')) { render(); return; }
  zugBeenden(stand);
  nachAenderung();
}

/* ---------------------------------------------------------------- Jubel */

function renderJubel() {
  const sieger = stand.fertig;
  const layer = document.createElement('div');
  layer.className = 'overlay jubel';
  layer.innerHTML = `
    <div class="krone" aria-hidden="true">🏆</div>
    <div class="name">${name(sieger)}</div>
    <p>Alle vier Figuren zu Hause. Es steht
      <b class="num">${stand.siege[0]} : ${stand.siege[1]}</b>.</p>
    <button class="btn btn--holz" id="nochmal">Noch eine Partie</button>
    <button class="btn btn--leise" id="spaeter">Später</button>`;
  app.appendChild(layer);
  layer.querySelector('#nochmal').onclick = () => {
    if (!tun('partieNeu')) { render(); return; }
    partieNeu(stand);
    nachAenderung();
  };
  layer.querySelector('#spaeter').onclick = () => { ui.overlay = 'menue'; render(); };
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
    <p>Jeder hat vier Figuren, die in der eigenen Ecke warten. Ziel ist, alle vier
      einmal um das Brett herum und in das eigene Haus zu bringen — die vier Felder,
      die zur Mitte zeigen.</p>

    <h3>Herauskommen</h3>
    <p>Nur mit einer <b>Sechs</b>. Die Figur kommt auf das eigene Startfeld, das farbig
      umrandet ist. Solange keine Figur auf der Bahn steht, darf man <b>dreimal</b> würfeln,
      um eine Sechs zu bekommen.</p>

    <h3>Die Sechs</h3>
    <p>Nach jeder Sechs wird noch einmal gewürfelt. Und die Sechs hat Vorrang: Wer noch
      Figuren in der Ecke hat, muss mit ihr zuerst herauskommen. Steht dort schon eine
      eigene Figur, muss die erst weiterziehen. (Abschaltbar im Menü.)</p>

    <h3>Schlagen</h3>
    <p>Wer auf einem Feld landet, auf dem eine fremde Figur steht, schickt sie zurück in
      ihre Ecke. Auf eine <b>eigene</b> Figur darf man nicht ziehen. Wahlweise lässt sich
      einstellen, dass Schlagen Pflicht ist, wenn es möglich ist.</p>

    <h3>Das Haus</h3>
    <p>Die vier Hausfelder müssen <b>genau</b> getroffen werden. Wer zu hoch würfelt, darf
      mit dieser Figur nicht ziehen. Im Haus darf keine eigene Figur übersprungen werden.</p>

    <h3>Zugzwang</h3>
    <p>Gibt es einen gültigen Zug, muss er gemacht werden. Gibt es keinen, geht es mit
      <em>Weiter</em> an die andere Seite.</p>

    <h3>Am Handy</h3>
    <p>Antippen: erst den Würfel, dann eine der hervorgehobenen Figuren. Der kleine goldene
      Punkt zeigt, wohin sie käme. Hier ist nichts geheim — ihr könnt an einem Handy
      spielen und es einfach liegen lassen, oder jeder nimmt sein eigenes.</p>

    <div class="knopfsaeule"><button class="btn btn--holz" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const r = stand.regeln;
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div class="tafel">
      <div class="seite seite--0"><div class="wer">${name(0)}</div>
        <div class="zahl num">${stand.siege[0]}</div></div>
      <div class="strichlein"></div>
      <div class="seite seite--1"><div class="wer">${name(1)}</div>
        <div class="zahl num">${stand.siege[1]}</div></div>
    </div>

    <div class="feldlabel">Regeln</div>
    <div class="wahlliste">
      <button class="wahl ${r.figuren === 2 ? 'wahl--an' : ''}" id="rFiguren">
        <div class="haupt"><div class="oben">Kurze Partie: zwei Figuren</div>
          <div class="unten">${r.figuren === 2 ? 'An — zwei statt vier' : 'Aus — es sind vier'}</div></div>
        <div class="haken">${r.figuren === 2 ? '✓' : ''}</div>
      </button>
      <button class="wahl ${r.mussSchlagen ? 'wahl--an' : ''}" id="rSchlagen">
        <div class="haupt"><div class="oben">Schlagen ist Pflicht</div>
          <div class="unten">Wer schlagen kann, muss schlagen</div></div>
        <div class="haken">${r.mussSchlagen ? '✓' : ''}</div>
      </button>
      <button class="wahl ${r.strengeSechs ? 'wahl--an' : ''}" id="rSechs">
        <div class="haupt"><div class="oben">Sechs hat Vorrang</div>
          <div class="unten">Erst herauskommen, Startfeld frei machen</div></div>
        <div class="haken">${r.strengeSechs ? '✓' : ''}</div>
      </button>
    </div>
    <p style="font-size:13px">Eine Änderung an der Figurenzahl beginnt eine neue Partie.</p>

    <div class="knopfsaeule">
      ${ui.modus === 'lokal'
    ? '<button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys spielen</button>'
    : '<button class="btn btn--geist" id="trennen">Verbindung trennen</button>'}
      <button class="btn btn--geist" id="neuePartie">Neue Partie</button>
      <button class="btn btn--geist" id="code">Punktestand sichern oder laden</button>
      <button class="btn btn--geist" id="sichern">Spiel als Datei sichern</button>
      <button class="btn btn--geist" id="nullen">Siege zurücksetzen</button>
      <button class="btn btn--leise" id="zu">Zurück</button>
    </div>
    <p class="lage" id="status">${esc(ui.codeStatus)}</p>`);

  const regelSetzen = (aenderung, neuePartie) => {
    if (!tun('regel', aenderung)) { ui.overlay = null; render(); return; }
    stand.regeln = { ...stand.regeln, ...aenderung };
    if (neuePartie) partieNeu(stand);
    ui.overlay = null;
    nachAenderung();
  };

  l.querySelector('#rFiguren').onclick = () =>
    regelSetzen({ figuren: r.figuren === 2 ? 4 : 2 }, true);
  l.querySelector('#rSchlagen').onclick = () => regelSetzen({ mussSchlagen: !r.mussSchlagen }, false);
  l.querySelector('#rSechs').onclick = () => regelSetzen({ strengeSechs: !r.strengeSechs }, false);

  l.querySelector('#zu').onclick = () => { ui.overlay = null; ui.codeStatus = ''; render(); };
  l.querySelector('#zweiGeraete')?.addEventListener('click', () => {
    ui.overlay = null;
    ui.kopplung = { schritt: 'rolle', gastgeber: true, code: '', fehler: '' };
    render();
  });
  l.querySelector('#trennen')?.addEventListener('click', () => { ui.overlay = null; kopplungAbbrechen(); });
  l.querySelector('#neuePartie').onclick = () => {
    if (!tun('partieNeu')) { ui.overlay = null; render(); return; }
    partieNeu(stand);
    ui.overlay = null;
    nachAenderung();
  };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('aerger-css', 'aerger-js', 'Aerger.html', 'Ärger');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'Aerger.html');
    render();
  };
  l.querySelector('#nullen').onclick = () => {
    stand.siege = [0, 0];
    stand.partie = 1;
    ui.overlay = null;
    nachAenderung();
  };
}

function renderCode() {
  const l = overlayHuelle(`
    <h2>Punktestand mitnehmen</h2>
    <p>Der Code enthält Namen und Siege — sonst nichts. Auf einem anderen Handy einfügen,
      und ihr zählt dort weiter.</p>
    <div class="feldlabel">Dieser Stand</div>
    <textarea class="codefeld" id="raus" readonly>${esc(alsCode(stand))}</textarea>
    <button class="btn btn--geist" id="kopieren">Kopieren</button>
    <div class="feldlabel">Anderen Stand übernehmen</div>
    <textarea class="codefeld" id="rein" placeholder="AER1-…"></textarea>
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
      ui.screen = 'spiel';
      ui.codeStatus = '';
      nachAenderung();
    } catch (fehler) {
      ui.codeStatus = fehler.message;
      render();
    }
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; ui.codeStatus = ''; render(); };
}

/* ----------------------------------------------------------------- Render */

function render() {
  const k = ui.kopplung;
  if (k && k.scannerStoppen && k.schritt !== 'scannen') { k.scannerStoppen(); k.scannerStoppen = null; }

  if (!stand) renderStart();
  else if (ui.kopplung) renderKopplung();
  else renderSpiel();

  if (ui.overlay === 'regeln') { renderRegeln(); return; }
  if (!stand || ui.kopplung) return;

  if (ui.overlay === 'menue') renderMenue();
  else if (ui.overlay === 'code') renderCode();
  else if (vorbei(stand)) renderJubel();
}

stand = laden();
if (stand) ui.screen = 'spiel';
render();
