// Mauern — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.
//
// Hier gibt es nichts zu verbergen: beide sehen dasselbe Brett. Darum kein
// Übergabe-Bildschirm — die Kopfzeile sagt, wer dran ist.
//
// Die Bedienung ist die eigentliche Aufgabe dieses Spiels: eine Mauer sitzt
// **zwischen** den Feldern, und auf einem Handy ist so eine Fuge kein Ziel, das
// man treffen kann. Darum in drei klaren Schritten statt in einer Geste:
//
//   1. unten umschalten: Laufen oder Mauern
//   2. beim Mauern die Richtung wählen (quer oder längs)
//   3. einen Punkt antippen — die Mauer erscheint als Vorschau — und bestätigen
//
// Eine Mauer ist unwiderruflich und oft spielentscheidend. Der Bestätigungs-
// schritt ist deshalb Absicht, kein überflüssiger Tipp.

import {
  MODI, neuerStand, zuege, ziehen, ziehbar,
  mauerErlaubt, mauerSetzen, mauernUebrig, wegLaenge,
  partieNeu, vorbei, alsCode, ausCode,
} from './engine.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'mauern.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  screen: 'start',
  overlay: null,
  codeStatus: '',
  modusWahl: 'klassisch',
  werkzeug: 'laufen',          // 'laufen' | 'mauern'
  ausrichtung: 'waagerecht',
  vorschau: null,              // { r, c, a } — Mauer, die noch bestätigt wird
  modus: 'lokal',
  meinIndex: 0,
  gastgeber: true,
  netz: null,
  kopplung: null,
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const name = (i) => esc(stand.spieler[i]?.name || (i === 0 ? 'Koralle' : 'Blau'));
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };
const modusInfo = () => MODI.find((m) => m.id === stand?.modusId) || MODI[0];

function sichern() {
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.siege) && Array.isArray(s.figuren)
      && Array.isArray(s.mauern) && s.regeln) return s;
  } catch { /* kaputter Stand wird ignoriert */ }
  return null;
}

function nachAenderung() {
  ui.vorschau = null;
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

// Bei Mauern ist nichts geheim — der Stand geht unverändert hinüber.
const standFuer = (quelle) => quelle;

function standSenden() {
  ui.netz?.senden({ typ: 'stand', stand: standFuer(stand) });
}

/** Zug ausführen (Gastgeber) oder hinüberschicken (Gast). */
function tun(was, wert) {
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.netz?.senden({ typ: 'aktion', name: was, wert });
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
    ui.vorschau = null;
    ui.screen = 'spiel';
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'aktion') {
    try {
      if (m.name === 'ziehen') ziehen(stand, m.wert.r, m.wert.c);
      else if (m.name === 'mauer') mauerSetzen(stand, m.wert.r, m.wert.c, m.wert.a);
      else if (m.name === 'partieNeu') partieNeu(stand);
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
  if (!ui.kopplung) return;                 // kann zweimal feuern
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
  const gewaehlt = ui.modusWahl;
  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="wrap" style="text-align:center">
      <h1 class="wortmarke">Mau<em>ern</em></h1>
      <p class="unterzeile">Eine Figur, zehn Mauern. In jedem Zug entweder ein Feld
        gehen <b>oder</b> eine Mauer bauen. Wer zuerst auf der anderen Seite
        ankommt, gewinnt — und niemand darf komplett zugemauert werden.</p>
      <div class="feldlabel">Wer spielt?</div>
      <input class="feld" id="n1" maxlength="14" placeholder="Koralle" value="Monty">
      <div style="height:10px"></div>
      <input class="feld" id="n2" maxlength="14" placeholder="Blau" value="Christina">
      <div class="feldlabel">Welche Fassung?</div>
      <div class="wahlliste">
        ${MODI.map((m) => `
          <button class="wahl${m.id === gewaehlt ? ' wahl--an' : ''}" data-modus="${m.id}">
            <div class="haupt">
              <div class="oben">${esc(m.titel)}</div>
              <div class="unten">${esc(m.zeile)}</div>
            </div>
            <span class="haken">✓</span>
          </button>`).join('')}
      </div>
      <div class="knopfsaeule">
        <button class="btn btn--filz" id="los">Los geht's</button>
        <button class="btn btn--leise" id="regeln">Wie geht das?</button>
      </div>
    </div></div></div>`;
  app.querySelectorAll('[data-modus]').forEach((k) => {
    k.onclick = () => { ui.modusWahl = k.dataset.modus; render(); };
  });
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Koralle';
    const b = app.querySelector('#n2').value.trim() || 'Blau';
    const m = MODI.find((x) => x.id === ui.modusWahl) || MODI[0];
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)], m.regeln);
    stand.modusId = m.id;
    ui.screen = 'spiel';
    ui.werkzeug = 'laufen';
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Das Brett */

// Feld 10 breit, dazwischen 2 Einheiten Fuge — genau dort sitzen die Mauern.
const ZELLE = 10;
const FUGE = 2;
const TAKT = ZELLE + FUGE;
const RAND = 4;

const brettMass = () => stand.regeln.groesse * TAKT - FUGE + 2 * RAND;
const zelleXY = (r, c) => [c * TAKT, r * TAKT];
const zelleMitte = (r, c) => [c * TAKT + ZELLE / 2, r * TAKT + ZELLE / 2];
const fugeMitte = (r, c) => [c * TAKT + ZELLE + FUGE / 2, r * TAKT + ZELLE + FUGE / 2];

/** Rechteck einer Mauer im Zeichenraster. */
function mauerRechteck(m) {
  const [x, y] = zelleXY(m.r, m.c);
  return m.a === 'waagerecht'
    ? { x, y: y + ZELLE, breite: 2 * ZELLE + FUGE, hoehe: FUGE }
    : { x: x + ZELLE, y, breite: FUGE, hoehe: 2 * ZELLE + FUGE };
}

function brettSvg() {
  const n = stand.regeln.groesse;
  const mass = brettMass();
  const meins = ichBinDran() && !vorbei(stand);
  const laufziele = meins && ui.werkzeug === 'laufen' ? zuege(stand) : [];
  const teile = [`<rect class="karton" x="${-RAND + 1}" y="${-RAND + 1}"`
    + ` width="${mass - 2}" height="${mass - 2}" rx="5"/>`];

  // 1. Felder. Die Zielreihen sind eingefärbt — sonst weiß man nicht, wohin.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [x, y] = zelleXY(r, c);
      const fuerA = stand.ziele[0] === r;
      const fuerB = stand.ziele[1] === r;
      const klasse = fuerA && fuerB ? ' zelle--beide' : fuerA ? ' zelle--ziel0' : fuerB ? ' zelle--ziel1' : '';
      teile.push(`<rect class="zelle${klasse}" x="${x}" y="${y}"`
        + ` width="${ZELLE}" height="${ZELLE}" rx="1.6"/>`);
    }
  }

  // 1b. Zielmarken am Rand. Die Tönung allein sagt nicht, *wessen* Reihe das
  // ist — die Marken in Spielerfarbe sagen es. Zielen beide auf dieselbe Reihe
  // (Wettlauf), steht links die eine und rechts die andere Farbe.
  const markeFuer = (r, seite) => {
    const beide = stand.ziele[0] === stand.ziele[1];
    if (beide) return seite === 'links' ? 0 : 1;
    return stand.ziele[0] === r ? 0 : 1;
  };
  for (const r of [...new Set(stand.ziele)]) {
    const [, y] = zelleXY(r, 0);
    for (const [seite, x] of [['links', -RAND + 1.4], ['rechts', mass - 2 * RAND + 1.2]]) {
      teile.push(`<rect class="zielmarke zielmarke--${markeFuer(r, seite)}" x="${x}" y="${y + 1.5}"`
        + ` width="1.6" height="${ZELLE - 3}" rx="0.8"/>`);
    }
  }

  // 2. Beim Mauern: alle erlaubten Fugen als kleine Punkte.
  if (meins && ui.werkzeug === 'mauern') {
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        if (!mauerErlaubt(stand, r, c, ui.ausrichtung)) continue;
        const [cx, cy] = fugeMitte(r, c);
        const gewaehlt = ui.vorschau && ui.vorschau.r === r && ui.vorschau.c === c;
        if (!gewaehlt) teile.push(`<circle class="fugenpunkt" cx="${cx}" cy="${cy}" r="1.5"/>`);
        teile.push(`<circle class="tippfeld" cx="${cx}" cy="${cy}" r="4.6"`
          + ` data-fuge="${r},${c}"/>`);
      }
    }
  }

  // 3. Gesetzte Mauern, dann die Vorschau darüber.
  // Die neue Mauer blitzt einmal auf — aber wirklich nur einmal. Ohne die
  // Merkzeile unten liefe die Animation bei jedem Neuzeichnen wieder los, also
  // auch beim bloßen Umschalten zwischen Laufen und Mauern.
  const neueste = stand.letzteAktion?.art === 'gemauert' ? stand.letzteAktion : null;
  const marke = neueste ? `${neueste.r},${neueste.c},${neueste.a}` : null;
  const blitzen = marke && marke !== ui.geflasht;
  ui.geflasht = marke;
  for (const m of stand.mauern) {
    const q = mauerRechteck(m);
    const frisch = blitzen && neueste.r === m.r && neueste.c === m.c && neueste.a === m.a;
    teile.push(`<rect class="mauer${frisch ? ' mauer--neu' : ''}" x="${q.x}" y="${q.y}"`
      + ` width="${q.breite}" height="${q.hoehe}" rx="0.8"/>`);
  }
  if (ui.vorschau) {
    const q = mauerRechteck(ui.vorschau);
    teile.push(`<rect class="fuge fuge--gewaehlt" x="${q.x}" y="${q.y}"`
      + ` width="${q.breite}" height="${q.hoehe}" rx="0.8"/>`);
  }

  // 4. Figuren.
  stand.figuren.forEach((f, spieler) => {
    const [cx, cy] = zelleMitte(f.r, f.c);
    teile.push(`<circle class="figur figur--${spieler}" cx="${cx}" cy="${cy}" r="3.6"/>`);
  });

  // 5. Laufziele zuletzt, damit sie obenauf liegen.
  for (const z of laufziele) {
    const [cx, cy] = zelleMitte(z.r, z.c);
    teile.push(`<circle class="zielpunkt" cx="${cx}" cy="${cy}" r="2"/>`);
    teile.push(`<circle class="tippfeld" cx="${cx}" cy="${cy}" r="5" data-ziel="${z.r},${z.c}"/>`);
  }

  return `<svg class="brett" viewBox="${-RAND} ${-RAND} ${mass} ${mass}" role="img"
    aria-label="Spielbrett ${n} mal ${n} Felder">${teile.join('')}</svg>`;
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
  const stumm = l.mdns && !l.eigene.length;
  const leer = !l.mdns && !l.eigene.length && l.sammeln === 'fertig';
  if (!ausfuehrlich && !stumm && !leer) return '';
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
    if (!ui.kopplung) return;
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
    if (!ui.kopplung) return;
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
        <p>Jeder auf seinem Gerät. Ihr seht dasselbe Brett — hier gibt es nichts
          zu verbergen.</p>
        ${netzMoeglich() ? `
        <div class="feldlabel">Über das Internet</div>
        <p>Egal wo ihr seid. Einer öffnet einen Raum, der andere tippt den Code ein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--filz" id="netzWirt">Raum öffnen</button>
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
        <button class="btn btn--filz" id="kameraNochmal">Nochmal fragen</button>
        <button class="btn btn--geist" id="kameraTrotzdem">Trotzdem versuchen</button>
        <button class="btn btn--leise" id="abbruch">Abbrechen</button>
      </div>
    </div></div></div>`;
    const antwort = (was) => { const fn = k.kameraAntwort; k.kameraAntwort = null; fn?.(was); };
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
          <button class="btn btn--filz" id="weiterKoppeln">${k.gastgeber
    ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#f0ece0', dunkel: '#10262b' });
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
          <textarea class="codefeld" id="rein" placeholder="MA1O|…"></textarea>
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
          <button class="btn btn--filz" id="beitreten">Mitspielen</button>
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

/** Was steht gerade an? Zwei Zeilen Klartext unter dem Brett. */
function ansage() {
  const dran = stand.dran;
  const meins = ichBinDran();
  const wer = meins && ui.modus === 'online' ? 'Du bist' : `${name(dran)} ist`;
  if (vorbei(stand)) return { eins: `${name(stand.fertig)} hat gewonnen.`, zwei: '' };

  if (!meins) {
    return { eins: `${name(dran)} überlegt.`, zwei: 'Laufen oder mauern — beides ist möglich.' };
  }
  if (ui.werkzeug === 'mauern') {
    if (ui.vorschau) {
      return { eins: 'Mauer hier?', zwei: 'Unten bestätigen — danach steht sie fest.', warnung: true };
    }
    if (mauernUebrig(stand, dran) <= 0) {
      return { eins: 'Keine Mauern mehr übrig.', zwei: 'Ab jetzt hilft nur noch laufen.', warnung: true };
    }
    return {
      eins: `Mauer setzen — noch ${mauernUebrig(stand, dran)}.`,
      zwei: 'Richtung wählen, dann einen Punkt antippen.',
    };
  }
  const rest = wegLaenge(stand, dran);
  return {
    eins: `${wer} dran.`,
    zwei: `Noch ${rest} ${rest === 1 ? 'Schritt' : 'Schritte'} bis ans andere Ende.`,
  };
}

function renderSpiel() {
  const a = ansage();
  const meins = ichBinDran() && !vorbei(stand);
  const kannMauern = meins && mauernUebrig(stand, stand.dran) > 0;
  const m = modusInfo();

  app.innerHTML = `
    <div class="screen screen--spiel">
      <div class="kopf">
        <div class="titel">
          <div class="ober">${esc(m.titel)} · Partie ${stand.partie}
            · ${stand.siege[0]} : ${stand.siege[1]}</div>
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
      <div class="rechts">
        <div class="vorratsbalken">
          <span class="seite"><i class="v-0"></i>${name(0)}: <b class="num">${mauernUebrig(stand, 0)}</b> Mauern</span>
          <span class="seite"><i class="v-1"></i>${name(1)}: <b class="num">${mauernUebrig(stand, 1)}</b> Mauern</span>
        </div>
        <div class="leiste">
          <div class="sagt">
            <div class="zeile1${a.warnung ? ' warnung' : ''}">${esc(a.eins)}</div>
            <div class="zeile2">${esc(a.zwei || '')}</div>
          </div>
        </div>
        ${meins ? modusleiste(kannMauern) : ''}
      </div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#zuLaufen')?.addEventListener('click', () => {
    ui.werkzeug = 'laufen'; ui.vorschau = null; render();
  });
  app.querySelector('#zuMauern')?.addEventListener('click', () => {
    ui.werkzeug = 'mauern'; ui.vorschau = null; render();
  });
  app.querySelector('#quer')?.addEventListener('click', () => {
    ui.ausrichtung = 'waagerecht'; ui.vorschau = null; render();
  });
  app.querySelector('#laengs')?.addEventListener('click', () => {
    ui.ausrichtung = 'senkrecht'; ui.vorschau = null; render();
  });
  app.querySelector('#setzen')?.addEventListener('click', mauerBestaetigen);
  app.querySelector('#zurueck')?.addEventListener('click', () => { ui.vorschau = null; render(); });
  app.querySelectorAll('[data-ziel]').forEach((k) => {
    k.onclick = () => {
      const [r, c] = k.dataset.ziel.split(',').map(Number);
      zielTippen(r, c);
    };
  });
  app.querySelectorAll('[data-fuge]').forEach((k) => {
    k.onclick = () => {
      const [r, c] = k.dataset.fuge.split(',').map(Number);
      ui.vorschau = { r, c, a: ui.ausrichtung };
      buzz(8);
      render();
    };
  });
}

/** Die Knopfzeile unten — sie ändert sich mit dem Schritt, in dem man ist. */
function modusleiste(kannMauern) {
  if (ui.werkzeug === 'mauern' && ui.vorschau) {
    return `<div class="modusleiste">
      <button class="modusknopf modusknopf--an" id="setzen">Mauer setzen</button>
      <button class="modusknopf" id="zurueck">Doch nicht</button>
    </div>`;
  }
  if (ui.werkzeug === 'mauern') {
    return `<div class="modusleiste">
      <button class="modusknopf" id="zuLaufen">Doch laufen</button>
      <button class="modusknopf${ui.ausrichtung === 'waagerecht' ? ' modusknopf--an' : ''}"
        id="quer">▬ quer</button>
      <button class="modusknopf${ui.ausrichtung === 'senkrecht' ? ' modusknopf--an' : ''}"
        id="laengs">▮ längs</button>
    </div>`;
  }
  return `<div class="modusleiste">
    <button class="modusknopf modusknopf--an" id="zuLaufen">Laufen</button>
    <button class="modusknopf" id="zuMauern" ${kannMauern ? '' : 'disabled'}>Mauer bauen
      <span class="zahl">${mauernUebrig(stand, stand.dran)}</span></button>
  </div>`;
}

function zielTippen(r, c) {
  if (!ziehbar(stand, r, c)) return;
  const gewinnt = stand.ziele[stand.dran] === r;
  if (!tun('ziehen', { r, c })) { render(); return; }
  try { ziehen(stand, r, c); } catch { render(); return; }
  buzz(gewinnt ? [30, 60, 30, 60, 30] : 10);
  nachAenderung();
}

function mauerBestaetigen() {
  const v = ui.vorschau;
  if (!v) return;
  if (!tun('mauer', v)) { ui.vorschau = null; render(); return; }
  try { mauerSetzen(stand, v.r, v.c, v.a); } catch { ui.vorschau = null; render(); return; }
  buzz([15, 40]);
  ui.werkzeug = 'laufen';
  nachAenderung();
}

/* ---------------------------------------------------------------- Jubel */

function renderJubel() {
  const sieger = stand.fertig;
  const layer = document.createElement('div');
  layer.className = 'overlay jubel';
  layer.innerHTML = `
    <div class="krone" aria-hidden="true">🚩</div>
    <div class="name">${name(sieger)}</div>
    <p>Auf der anderen Seite angekommen — durch ${stand.mauern.length}
      ${stand.mauern.length === 1 ? 'Mauer' : 'Mauern'} hindurch. Es steht
      <b class="num">${stand.siege[0]} : ${stand.siege[1]}</b>.</p>
    <button class="btn btn--filz" id="nochmal">Noch eine Partie</button>
    <button class="btn btn--leise" id="spaeter">Später</button>`;
  app.appendChild(layer);
  layer.querySelector('#nochmal').onclick = () => {
    ui.werkzeug = 'laufen';
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
    <p>Jeder hat <b>eine Figur</b> und einen Vorrat <b>Mauern</b>. Deine Figur steht
      unten, deine Zielreihe ist die ganz oben (farblich markiert). Wer zuerst
      irgendein Feld der eigenen Zielreihe erreicht, gewinnt.</p>

    <h3>Ein Zug ist eins von beiden</h3>
    <p>In jedem Zug machst du <b>entweder</b> einen Schritt mit der Figur (ein Feld
      hoch, runter, links oder rechts — nie schräg) <b>oder</b> du baust <b>eine Mauer</b>.
      Beides zusammen geht nicht. Genau darin liegt das ganze Spiel: jede Mauer kostet
      dich einen Schritt Vorsprung.</p>

    <h3>Mauern</h3>
    <p>Eine Mauer ist <b>zwei Felder lang</b> und steht zwischen den Feldern. Sie hält
      <b>beide</b> Seiten auf, auch dich. Mauern dürfen sich nicht überlappen und nicht
      kreuzen. Ist dein Vorrat leer, kannst du nur noch laufen.</p>

    <h3>Die wichtigste Regel</h3>
    <p>Du darfst niemanden <b>vollständig zumauern</b>. Nach jeder Mauer muss für beide
      Seiten noch irgendein Weg zur eigenen Zielreihe übrig sein. Das Spiel lässt eine
      Mauer, die das verletzen würde, gar nicht erst zu — solche Punkte erscheinen nicht.</p>

    <h3>Wenn ihr euch begegnet</h3>
    <p>Stehen die Figuren direkt nebeneinander, <b>springst du über die andere hinweg</b>
      und landest dahinter — zwei Felder in einem Zug. Steht dahinter eine Mauer oder der
      Rand, gehst du stattdessen <b>schräg an ihr vorbei</b>.</p>
    <p>Daraus folgt eine Feinheit, die man beim ersten Mal übersieht: wer sich
      übersprengen lässt, <b>schenkt der Gegenseite einen Schritt</b>. Frontal
      aufeinander zuzulaufen ist deshalb selten eine gute Idee.</p>

    <h3>Am Handy</h3>
    <p>Unten schaltest du zwischen <b>Laufen</b> und <b>Mauer bauen</b> um. Beim Laufen
      erscheinen Punkte auf den erreichbaren Feldern. Beim Mauern wählst du erst die
      <b>Richtung</b> (quer oder längs), tippst dann einen Punkt zwischen den Feldern an —
      die Mauer erscheint als Vorschau — und bestätigst mit <b>Mauer setzen</b>. Die
      Bestätigung ist Absicht: eine gesetzte Mauer bleibt, wo sie ist.</p>

    <h3>Die Fassungen</h3>
    <ul>${MODI.map((m) => `<li><b>${esc(m.titel)}</b> — ${esc(m.zeile)}</li>`).join('')}</ul>

    <h3>Woher die Regeln kommen</h3>
    <p>Von <em>Quoridor</em> (Gigamic, Mirko Marchesi, 1997) — dasselbe Spiel, das online
      als <em>Barricade</em> läuft. Spielregeln sind frei, Name und Gestaltung nicht.
      Deshalb heißt es hier Mauern.</p>

    <div class="knopfsaeule"><button class="btn btn--filz" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const m = modusInfo();
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div class="tafel">
      <div class="seite seite--0"><div class="wer">${name(0)}</div>
        <div class="zahl num">${stand.siege[0]}</div></div>
      <div class="strichlein"></div>
      <div class="seite seite--1"><div class="wer">${name(1)}</div>
        <div class="zahl num">${stand.siege[1]}</div></div>
    </div>
    <p style="text-align:center"><b>${esc(m.titel)}</b> — ${esc(m.zeile)}<br>
      Noch ${wegLaenge(stand, 0)} zu ${wegLaenge(stand, 1)} Schritte.
      Mauern übrig: ${mauernUebrig(stand, 0)} zu ${mauernUebrig(stand, 1)}.</p>

    <div class="knopfsaeule">
      ${ui.modus === 'lokal'
    ? '<button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys spielen</button>'
    : '<button class="btn btn--geist" id="trennen">Verbindung trennen</button>'}
      <button class="btn btn--geist" id="neuePartie">Neue Partie</button>
      <button class="btn btn--geist" id="andereFassung">Andere Fassung wählen</button>
      <button class="btn btn--geist" id="code">Punktestand sichern oder laden</button>
      <button class="btn btn--geist" id="sichern">Spiel als Datei sichern</button>
      <button class="btn btn--geist" id="nullen">Siege zurücksetzen</button>
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
  l.querySelector('#neuePartie').onclick = () => {
    ui.werkzeug = 'laufen';
    if (!tun('partieNeu')) { ui.overlay = null; render(); return; }
    partieNeu(stand);
    ui.overlay = null;
    nachAenderung();
  };
  l.querySelector('#andereFassung').onclick = () => {
    // Die Fassung bestimmt Brettgröße und Vorrat — das geht nur mit neuer Partie.
    ui.modusWahl = stand.modusId || 'klassisch';
    ui.overlay = null;
    stand = null;
    ui.screen = 'start';
    try { localStorage.removeItem(KEY); } catch { /* privater Modus */ }
    render();
  };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('mauern-css', 'mauern-js', 'Mauern.html', 'Mauern');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'Mauern.html');
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
    <p>Der Code enthält Namen, Siege und die gewählte Fassung — sonst nichts. Auf einem
      anderen Handy einfügen, und ihr zählt dort weiter.</p>
    <div class="feldlabel">Dieser Stand</div>
    <textarea class="codefeld" id="raus" readonly>${esc(alsCode(stand))}</textarea>
    <button class="btn btn--geist" id="kopieren">Kopieren</button>
    <div class="feldlabel">Anderen Stand übernehmen</div>
    <textarea class="codefeld" id="rein" placeholder="MAU1-…"></textarea>
    <button class="btn btn--geist" id="uebernehmen">Diesen Stand übernehmen</button>
    <p class="lage" id="status">${esc(ui.codeStatus)}</p>
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);

  l.querySelector('#kopieren').onclick = async (e) => {
    try { await navigator.clipboard.writeText(alsCode(stand)); e.currentTarget.textContent = 'Kopiert'; }
    catch { l.querySelector('#raus').select(); }
  };
  l.querySelector('#uebernehmen').onclick = () => {
    try {
      const neu = ausCode(l.querySelector('#rein').value);
      neu.modusId = stand.modusId;
      stand = neu;
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
