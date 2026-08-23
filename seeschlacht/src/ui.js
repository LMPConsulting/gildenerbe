// Seeschlacht — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.
//
// Der heikle Teil ist das Verstecken: An einem Handy darf die eigene Flotte nur
// zu sehen sein, wenn man sie selbst in der Hand hat. Darum zeigt der
// Schießbildschirm dort nur das gegnerische Meer — die eigene Flotte liegt
// hinter einem Übergabe-Bildschirm.

import {
  BREITE, HOEHE, SPALTEN, FLOTTE, LAENGEN,
  neuerStand, leeresMeer, passt, setzen, entfernen, zufallsflotte, flotteAuffuellen,
  flotteFertig, schiessen, schiffAn, versenkt, alleVersenkt, feldName,
  bereit, phase, gegnerSicht, nochUebrig, partieNeu, vorbei, alsCode, ausCode,
} from './engine.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'seeschlacht.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  screen: 'start',
  overlay: null,
  halter: 0,          // wer das Handy in der Hand hat (nur an einem Gerät)
  legtGerade: 0,      // wer gerade seine Flotte legt (nur an einem Gerät)
  legenFertig: false, // beide Flotten bestätigt (an einem Gerät)
  bestaetigt: false,  // dieses Gerät hat „Fertig" gedrückt (auf zwei Geräten)
  uebergabeNoetig: false,
  quer: true,         // Ausrichtung beim Legen
  codeStatus: '',
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
const name = (i) => esc(stand.spieler[i]?.name || (i === 0 ? 'Eins' : 'Zwei'));
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };
const einHandy = () => ui.modus === 'lokal';

/** Wer ist auf diesem Gerät gerade der Handelnde? */
const ich = () => (einHandy() ? ui.legtGerade : ui.meinIndex);

function sichern() {
  // Am Gast hängt nur eine beschnittene Fassung — die darf auch so auf die Platte.
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.siege) && Array.isArray(s.meere)) return s;
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

/* ---------------------------------------------------- Zwei Handys, ein Spiel */

const gegenIndex = () => (ui.meinIndex === 0 ? 1 : 0);

function standSenden() {
  ui.netz?.senden({ typ: 'stand', stand: gegnerSicht(stand, gegenIndex()) });
}

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
    // Die eigene Flotte kennt nur dieses Gerät — sie darf nicht überschrieben werden.
    const eigenesMeer = stand?.meere?.[ui.meinIndex];
    stand = m.stand;
    if (eigenesMeer && eigenesMeer.schiffe.length) {
      stand.meere[ui.meinIndex].schiffe = eigenesMeer.schiffe;
    }
    ui.screen = 'spiel';
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'flotte') {
    // Der Gast schickt seine Flotte — anders kann der Gastgeber nicht rechnen.
    const meer = stand.meere[m.spieler];
    meer.schiffe = m.schiffe;
    sichern();
    standSenden();
    render();
    return;
  }

  if (m.typ === 'aktion') {
    try {
      if (m.name === 'schiessen') schiessen(stand, m.wert.x, m.wert.y);
      else if (m.name === 'partieNeu') partieNeu(stand);
      else if (m.name === 'regel') stand.regeln = { ...stand.regeln, ...m.wert };
      else return;
    } catch { return; }
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
  // Kann zweimal gemeldet werden — dann darf die Partie nicht erneut hochzählen.
  if (!ui.kopplung) return;
  ui.kopplung = null;
  ui.legenFertig = false;
  ui.bestaetigt = false;
  ui.uebergabeNoetig = false;
  // Beim Koppeln beginnt eine frische Partie: die Flotten müssen neu liegen,
  // schon damit keine halb gelegte Aufstellung durcheinandergerät.
  if (ui.gastgeber) {
    if (!stand) stand = neuerStand();
    partieNeu(stand);
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
        <h1 class="wortmarke">See<em>schlacht</em></h1>
        <p class="unterzeile">Zehn Schiffe, zehn mal zehn Felder, ein Schuss nach dem
          anderen. Wer zuerst die ganze Flotte versenkt, gewinnt.</p>
        <div class="feldlabel">Wer spielt?</div>
        <input class="feld" id="n1" maxlength="14" placeholder="Erster Name" value="Monty">
        <div style="height:10px"></div>
        <input class="feld" id="n2" maxlength="14" placeholder="Zweiter Name" value="Christina">
        <div class="knopfsaeule">
          <button class="btn btn--signal" id="los">Los geht's</button>
          <button class="btn btn--leise" id="regeln">Wie geht das?</button>
        </div>
      </div>
    </div>`;
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Eins';
    const b = app.querySelector('#n2').value.trim() || 'Zwei';
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)]);
    ui.screen = 'spiel';
    ui.legtGerade = 0;
    ui.halter = 0;
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* ------------------------------------------------------------- Das Raster */

/**
 * Zeichnet ein Meer. `zeigeSchiffe` entscheidet über die eigenen Rümpfe,
 * `klickbar` schaltet die Zellen scharf.
 */
function meerGitter(meer, { zeigeSchiffe, klickbar, klasse = '', letzter = null }) {
  const zellen = ['<div class="kopfzelle"></div>'];
  for (const s of SPALTEN) zellen.push(`<div class="kopfzelle">${s}</div>`);
  for (let y = 0; y < HOEHE; y++) {
    zellen.push(`<div class="kopfzelle">${y + 1}</div>`);
    for (let x = 0; x < BREITE; x++) {
      const schuss = meer.schuesse[`${x},${y}`];
      const schiff = zeigeSchiffe ? schiffAn(meer, x, y) : null;
      const wrack = schuss === 'treffer'
        && (meer.versenkte || []).some((v) => v.felder.some((f) => f.x === x && f.y === y));
      const teile = ['zelle'];
      if (schiff && !schuss) teile.push('zelle--schiff');
      if (schuss === 'wasser') teile.push('zelle--daneben');
      if (schuss === 'treffer') teile.push(wrack ? 'zelle--wrack' : 'zelle--treffer');
      if (letzter && letzter.x === x && letzter.y === y) teile.push('zelle--letzter');
      const frei = klickbar && !schuss;
      if (frei) teile.push('zelle--frei');
      zellen.push(`<button class="${teile.join(' ')}" ${frei ? '' : 'disabled'}`
        + ` data-x="${x}" data-y="${y}" aria-label="${feldName(x, y)}"></button>`);
    }
  }
  return `<div class="meer ${klasse}">${zellen.join('')}</div>`;
}

/** Die Flottenliste — welche Schiffe stehen noch, welche sind weg. */
function flottenLeiste(meer, { alsGegner = false } = {}) {
  const potts = [];
  const gelegt = meer.schiffe.map((s) => s.laenge);
  const versenkteLaengen = alsGegner
    ? (meer.versenkte || []).map((v) => v.laenge)
    : meer.schiffe.filter((s) => versenkt(meer, s)).map((s) => s.laenge);
  const offenVersenkt = versenkteLaengen.slice();
  const offenGelegt = gelegt.slice();

  for (const laenge of LAENGEN) {
    const iw = offenVersenkt.indexOf(laenge);
    const weg = iw >= 0;
    if (weg) offenVersenkt.splice(iw, 1);
    let steht = true;
    if (!alsGegner) {
      const ig = offenGelegt.indexOf(laenge);
      steht = ig >= 0;
      if (steht) offenGelegt.splice(ig, 1);
    }
    const rumpf = Array.from({ length: laenge }, () => '<span class="planke"></span>').join('');
    const klassen = ['pott'];
    if (weg) klassen.push('pott--weg');
    else if (!steht) klassen.push('pott--dran');
    potts.push(`<span class="${klassen.join(' ')}"><span class="rumpf">${rumpf}</span></span>`);
  }
  return `<div class="flotte">${potts.join('')}</div>`;
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
          <button class="btn btn--signal" id="netzWirt">Raum öffnen</button>
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
        <button class="btn btn--signal" id="kameraNochmal">Nochmal fragen</button>
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
          <button class="btn btn--signal" id="weiterKoppeln">${k.gastgeber
    ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#dfe9e4', dunkel: '#0c1f26' });
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
          <textarea class="codefeld" id="rein" placeholder="SE1O|…"></textarea>
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
          <button class="btn btn--signal" id="beitreten">Mitspielen</button>
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

/* --------------------------------------------------------------- Legen */

/** Welche Länge kommt als Nächstes dran? */
function naechsteLaenge(meer) {
  const fehlt = LAENGEN.slice();
  for (const s of meer.schiffe) {
    const i = fehlt.indexOf(s.laenge);
    if (i >= 0) fehlt.splice(i, 1);
  }
  return fehlt[0] ?? null;
}

function renderLegen() {
  const wer = ich();
  const meer = stand.meere[wer];
  const laenge = naechsteLaenge(meer);
  const fertig = flotteFertig(meer);
  const wartet = !einHandy() && fertig && !bereit(stand, andere(wer));

  app.innerHTML = `
    <div class="screen">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Partie ${stand.partie} · Flotte legen</div>
          <h1>${name(wer)}</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      <div class="scroll"><div class="meerfeld">
        <div class="meertitel">Dein Meer</div>
        ${meerGitter(meer, { zeigeSchiffe: true, klickbar: false })}
        ${flottenLeiste(meer)}
        <div class="leiste">
          <div class="sagt">
            <div class="zeile1">${wartet
    ? `Flotte steht. ${name(andere(wer))} legt noch.`
    : fertig ? 'Alle zehn Schiffe liegen.'
      : `Als Nächstes: ein Schiff mit <b>${laenge}</b> Feldern.`}</div>
            <div class="zeile2">${wartet ? 'Gleich geht es los.'
    : fertig ? 'Auf ein Schiff tippen nimmt es wieder weg.'
      : 'Auf das erste Feld tippen. Ein gelegtes Schiff antippen nimmt es weg.'}</div>
          </div>
          ${fertig ? '' : `<button class="btn btn--geist" id="drehen" style="width:auto;padding:12px 16px">${
  ui.quer ? '↔ quer' : '↕ hoch'}</button>`}
        </div>
        <div class="wrap" style="padding-top:0">
          <div class="reihe">
            <button class="btn btn--geist" id="zufall">Zufällig legen</button>
            <button class="btn btn--geist" id="leeren">Alles wegnehmen</button>
          </div>
          <div class="knopfsaeule">
            <button class="btn btn--signal" id="bereit" ${fertig && !wartet ? '' : 'disabled'}>${
  einHandy() && wer === 0 ? `Fertig — jetzt legt ${name(andere(wer))}`
    : 'Fertig, das Meer steht'}</button>
          </div>
        </div>
      </div></div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#drehen')?.addEventListener('click', () => { ui.quer = !ui.quer; render(); });
  app.querySelector('#zufall').onclick = () => {
    flotteAuffuellen(meer);
    flottenAenderung();
  };
  app.querySelector('#leeren').onclick = () => {
    meer.schiffe = [];
    flottenAenderung();
  };
  app.querySelector('#bereit').onclick = bereitTippen;

  app.querySelectorAll('.meer .zelle').forEach((z) => {
    z.disabled = false;
    z.onclick = () => legenTippen(Number(z.dataset.x), Number(z.dataset.y));
  });
}

function legenTippen(x, y) {
  const meer = stand.meere[ich()];
  if (entfernen(meer, x, y)) { buzz(8); flottenAenderung(); return; }
  const laenge = naechsteLaenge(meer);
  if (!laenge) return;
  if (!setzen(meer, { x, y, laenge, quer: ui.quer })) { buzz([30]); return; }
  buzz(10);
  flottenAenderung();
}

/** Die Flotte hat sich geändert — beim Gast muss sie hinüber. */
function flottenAenderung() {
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.netz?.senden({ typ: 'flotte', spieler: ui.meinIndex, schiffe: stand.meere[ui.meinIndex].schiffe });
    render();
    return;
  }
  nachAenderung();
}

function bereitTippen() {
  if (!einHandy()) {
    ui.bestaetigt = true;
    nachAenderung();
    return;
  }
  if (ui.legtGerade === 0) {
    ui.legtGerade = 1;
    ui.halter = 0;                    // erzwingt die Übergabe an den Zweiten
    render();
    return;
  }
  // Beide Flotten stehen. Das Handy liegt beim Zweiten, schießen darf der Erste.
  ui.legenFertig = true;
  ui.uebergabeNoetig = true;
  nachAenderung();
}

/* ------------------------------------------------------------- Schießen */

function renderSchiessen() {
  const wer = einHandy() ? stand.dran : ui.meinIndex;
  const gegner = andere(wer);
  const amZug = einHandy() || stand.dran === ui.meinIndex;
  const l = stand.letzterSchuss;

  const meineUebrig = nochUebrig(stand.meere[wer]);
  const fremdUebrig = LAENGEN.length - (stand.meere[gegner].versenkte || []).length;

  app.innerHTML = `
    <div class="screen">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Partie ${stand.partie} · ${stand.siege[0]} : ${stand.siege[1]}</div>
          <h1>${amZug ? `${name(stand.dran)} schießt` : `${name(stand.dran)} ist dran`}</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      <div class="scroll"><div class="meerfeld">
        <div class="meerspalte">
          <div class="meertitel">Meer von ${name(andere(stand.dran))} · noch ${
  LAENGEN.length - (stand.meere[andere(stand.dran)].versenkte || []).length} Schiffe</div>
          ${meerGitter(stand.meere[andere(stand.dran)], {
    zeigeSchiffe: false, klickbar: amZug && !vorbei(stand), letzter: l,
  })}
        </div>
        ${einHandy() ? '' : `
        <div class="meerspalte">
          <div class="meertitel">Dein Meer · noch ${meineUebrig} Schiffe</div>
          ${meerGitter(stand.meere[wer], { zeigeSchiffe: true, klickbar: false, klasse: 'meer--klein' })}
        </div>`}
        <div class="leiste">
          <div class="sagt">
            <div class="zeile1">${meldung()}</div>
            <div class="zeile2">${einHandy()
    ? `Deine Flotte: noch ${meineUebrig} von ${LAENGEN.length}.`
    : `Gegenüber: noch ${fremdUebrig} von ${LAENGEN.length}.`}</div>
          </div>
        </div>
        ${einHandy() ? `<div class="wrap" style="padding-top:0">
          <button class="btn btn--geist" id="meineFlotte">Meine Flotte ansehen</button>
        </div>` : ''}
      </div></div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#meineFlotte')?.addEventListener('click', () => {
    ui.overlay = 'meineFlotte';
    ui.halter = andere(stand.dran);      // erzwingt die Übergabe
    render();
  });
  if (amZug && !vorbei(stand)) {
    app.querySelectorAll('.zelle--frei').forEach((z) => {
      z.onclick = () => schussTippen(Number(z.dataset.x), Number(z.dataset.y));
    });
  }
}

function meldung() {
  const l = stand.letzterSchuss;
  if (vorbei(stand)) return `${name(stand.fertig)} hat die Flotte versenkt.`;
  if (!l) return 'Ein Feld antippen.';
  const feld = feldName(l.x, l.y);
  if (l.versenkt) return `<span class="senk">${feld} — versenkt!</span>`;
  if (l.treffer) return `<span class="treff">${feld} — Treffer.</span> Noch einmal.`;
  return `${feld} — Wasser.`;
}

function schussTippen(x, y) {
  if (!tun('schiessen', { x, y })) { render(); return; }
  const was = schiessen(stand, x, y);
  if (!was) return;
  buzz(was.versenkt ? [30, 60, 30] : was.treffer ? 24 : 8);
  nachAenderung();
}

/* --------------------------------------------------------------- Übergabe */

function renderUebergabe(wer, auftrag, danach) {
  const layer = document.createElement('div');
  layer.className = 'overlay uebergabe';
  layer.innerHTML = `
    <div class="pfeil" aria-hidden="true">📱</div>
    <div class="lbl">Handy weitergeben an</div>
    <div class="name">${name(wer)}</div>
    <p>${esc(auftrag)}</p>
    <button class="btn btn--signal" id="btnBereit">Ich hab's</button>`;
  app.appendChild(layer);
  layer.querySelector('#btnBereit').onclick = () => {
    ui.halter = wer;
    danach?.();
    render();
  };
}

function renderMeineFlotte() {
  const wer = ui.halter;
  const meer = stand.meere[wer];
  const l = overlayHuelle(`
    <h2>Deine Flotte, ${name(wer)}</h2>
    <p>Was die Gegenseite bisher getroffen hat.</p>
    ${meerGitter(meer, { zeigeSchiffe: true, klickbar: false })}
    ${flottenLeiste(meer)}
    <div class="knopfsaeule"><button class="btn btn--signal" id="zu">Zurück zum Schießen</button></div>`);
  l.querySelector('#zu').onclick = () => {
    ui.overlay = null;
    ui.halter = stand.dran;
    render();
  };
}

/* ---------------------------------------------------------------- Jubel */

function renderJubel() {
  const sieger = stand.fertig;
  const layer = document.createElement('div');
  layer.className = 'overlay jubel';
  layer.innerHTML = `
    <div class="krone" aria-hidden="true">⚓</div>
    <div class="lbl">Alle zehn Schiffe versenkt</div>
    <div class="name">${name(sieger)}</div>
    <p>Es steht <b class="num">${stand.siege[0]} : ${stand.siege[1]}</b>.</p>
    <button class="btn btn--signal" id="nochmal">Noch eine Partie</button>
    <button class="btn btn--leise" id="spaeter">Später</button>`;
  app.appendChild(layer);
  layer.querySelector('#nochmal').onclick = () => {
    if (!tun('partieNeu')) { render(); return; }
    partieNeu(stand);
    ui.legtGerade = 0;
    ui.halter = 0;
    ui.legenFertig = false;
    ui.bestaetigt = false;
    ui.uebergabeNoetig = false;
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
    <p>Jeder legt zehn Schiffe in sein eigenes Meer — zehn mal zehn Felder, Spalten A bis J,
      Zeilen 1 bis 10. Dann wird abwechselnd auf Felder der Gegenseite geschossen. Wer
      zuerst alle zehn versenkt hat, gewinnt.</p>

    <h3>Die Flotte</h3>
    <ul>
      ${FLOTTE.map((s) => `<li><b>${s.anzahl}×</b> ${esc(s.name)} mit ${s.laenge} Feldern</li>`).join('')}
    </ul>
    <p>Zusammen zehn Schiffe auf 30 Feldern. Schiffe dürfen sich <b>nicht berühren</b>,
      auch nicht über Eck — im Menü abschaltbar.</p>

    <h3>Legen</h3>
    <p>Auf das erste Feld tippen, das Schiff wird von dort aus gelegt. Mit
      <em>↔ quer</em> / <em>↕ hoch</em> die Richtung wechseln. Ein gelegtes Schiff antippen
      nimmt es wieder weg. <em>Zufällig legen</em> füllt alles auf, was noch fehlt.</p>

    <h3>Schießen</h3>
    <p>Ein Feld je Zug. <b>Wasser</b> gibt ab, ein <b>Treffer</b> bringt einen weiteren
      Schuss (abschaltbar). Ist ein Schiff ganz getroffen, meldet das Spiel
      <em>versenkt</em> und markiert die Felder ringsum als Wasser — dort kann nichts
      mehr liegen.</p>

    <h3>An einem Handy</h3>
    <p>Erst legt der eine seine Flotte, dann wird weitergereicht und der andere legt.
      Beim Schießen zeigt der Bildschirm nur das <b>gegnerische</b> Meer — das ist
      ohnehin beiden bekannt. Die eigene Flotte gibt es über <em>Meine Flotte ansehen</em>,
      und davor kommt wieder die Übergabe.</p>

    <h3>Auf zwei Handys</h3>
    <p>Da sieht jeder beides zugleich: oben das gegnerische Meer zum Schießen, darunter
      klein das eigene. Die Schiffe der Gegenseite werden nie mitgeschickt — nur Treffer,
      Wasser und was schon versenkt ist.</p>

    <div class="knopfsaeule"><button class="btn btn--signal" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const r = stand.regeln;
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div class="tafel">
      <div class="seite"><div class="wer">${name(0)}</div>
        <div class="zahl num">${stand.siege[0]}</div></div>
      <div class="strichlein"></div>
      <div class="seite"><div class="wer">${name(1)}</div>
        <div class="zahl num">${stand.siege[1]}</div></div>
    </div>

    <div class="feldlabel">Regeln</div>
    <div class="wahlliste">
      <button class="wahl ${r.abstand ? 'wahl--an' : ''}" id="rAbstand">
        <div class="haupt"><div class="oben">Schiffe dürfen sich nicht berühren</div>
          <div class="unten">Auch nicht über Eck</div></div>
        <div class="haken">${r.abstand ? '✓' : ''}</div>
      </button>
      <button class="wahl ${r.trefferNochmal ? 'wahl--an' : ''}" id="rNochmal">
        <div class="haupt"><div class="oben">Treffer bringt einen weiteren Schuss</div>
          <div class="unten">Sonst wechselt nach jedem Schuss die Seite</div></div>
        <div class="haken">${r.trefferNochmal ? '✓' : ''}</div>
      </button>
    </div>
    <p style="font-size:13px">Die Abstandsregel gilt ab der nächsten Partie.</p>

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

  const regelSetzen = (aenderung) => {
    if (!tun('regel', aenderung)) { ui.overlay = null; render(); return; }
    stand.regeln = { ...stand.regeln, ...aenderung };
    ui.overlay = null;
    nachAenderung();
  };
  l.querySelector('#rAbstand').onclick = () => regelSetzen({ abstand: !r.abstand });
  l.querySelector('#rNochmal').onclick = () => regelSetzen({ trefferNochmal: !r.trefferNochmal });

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
    ui.legtGerade = 0;
    ui.halter = 0;
    ui.legenFertig = false;
    ui.bestaetigt = false;
    ui.uebergabeNoetig = false;
    ui.overlay = null;
    nachAenderung();
  };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('seeschlacht-css', 'seeschlacht-js', 'Seeschlacht.html', 'Seeschlacht');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'Seeschlacht.html');
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
    <p>Der Code enthält Namen und Siege — keine Schiffe.</p>
    <div class="feldlabel">Dieser Stand</div>
    <textarea class="codefeld" id="raus" readonly>${esc(alsCode(stand))}</textarea>
    <button class="btn btn--geist" id="kopieren">Kopieren</button>
    <div class="feldlabel">Anderen Stand übernehmen</div>
    <textarea class="codefeld" id="rein" placeholder="SEE1-…"></textarea>
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
      ui.legtGerade = 0;
      ui.halter = 0;
      ui.codeStatus = '';
      nachAenderung();
    } catch (fehler) {
      ui.codeStatus = fehler.message;
      render();
    }
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; ui.codeStatus = ''; render(); };
}

/**
 * Wird noch gelegt? Nicht allein an der Phase abzulesen: die zweite Flotte ist
 * fertig, sobald das letzte Schiff liegt — bestätigt hat sie damit aber
 * niemand, und an einem Handy hält sie noch der Falsche in der Hand.
 */
function zeigeLegen() {
  if (vorbei(stand)) return false;
  if (einHandy()) return !ui.legenFertig;
  return phase(stand) === 'legen' || !ui.bestaetigt;
}

/* ----------------------------------------------------------------- Render */

function render() {
  const k = ui.kopplung;
  if (k && k.scannerStoppen && k.schritt !== 'scannen') { k.scannerStoppen(); k.scannerStoppen = null; }

  if (!stand) { renderStart(); }
  else if (ui.kopplung) { renderKopplung(); }
  else if (zeigeLegen()) { renderLegen(); }
  else { renderSchiessen(); }

  if (ui.overlay === 'regeln') { renderRegeln(); return; }
  if (!stand || ui.kopplung) return;

  // An einem Handy: erst weiterreichen, dann weiterspielen.
  if (einHandy()) {
    if (zeigeLegen() && ui.halter !== ui.legtGerade) {
      renderUebergabe(ui.legtGerade, 'Leg deine Flotte, ohne dass jemand zusieht.');
      return;
    }
    if (ui.uebergabeNoetig && !vorbei(stand)) {
      renderUebergabe(stand.dran, 'Beide Flotten stehen. Du schießt zuerst.', () => {
        ui.uebergabeNoetig = false;
      });
      return;
    }
    if (ui.overlay === 'meineFlotte' && ui.halter !== stand.dran) {
      // absichtlich verdreht: „Meine Flotte" gehört dem, der nicht schießt
      renderUebergabe(ui.halter, 'Nur für deine Augen.');
      return;
    }
  }

  if (ui.overlay === 'meineFlotte') { renderMeineFlotte(); return; }
  if (ui.overlay === 'menue') { renderMenue(); return; }
  if (ui.overlay === 'code') { renderCode(); return; }
  if (vorbei(stand)) renderJubel();
}

stand = laden();
if (stand) {
  ui.screen = 'spiel';
  ui.legtGerade = bereit(stand, 0) && !bereit(stand, 1) ? 1 : 0;
  ui.halter = ui.legtGerade;
  ui.legenFertig = bereit(stand, 0) && bereit(stand, 1);
}
render();
