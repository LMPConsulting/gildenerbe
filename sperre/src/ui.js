// Sperrsteine — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.
//
// Hier gibt es nichts zu verbergen: beide sehen dasselbe Brett, dieselben
// Steine. Darum kein Übergabe-Bildschirm — die Kopfzeile sagt, wer dran ist.
//
// Bedienung in zwei Schritten, weil eine Figur mit einem Wurf mehrere
// verschiedene Felder erreichen kann: erst die Figur antippen, dann den Punkt,
// auf den sie soll. Kann nur eine Figur ziehen, ist sie schon ausgewählt.

import {
  FIGUREN, SPERREN,
  neuerStand, wuerfeln, zuege, zieleFuer, ziehen, ziehbar,
  figurAuf, sperreAuf, setztGerade, setzbar, sperreSetzen,
  zugBeenden, partieNeu, vorbei, beste, alsCode, ausCode,
  MODI,
} from './engine.js';
import { FELDER, NACHBARN, ZIEL, HEIM, mitte, REIHEN, SPALTEN, zumZiel } from './brett.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'sperre.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  modusWahl: 'klassisch',
  screen: 'start',
  overlay: null,
  codeStatus: '',
  rollt: false,
  gewaehlt: null,        // Nummer der angetippten Figur
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
const name = (i) => esc(stand.spieler[i]?.name || (i === 0 ? 'Bernstein' : 'Türkis'));
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.siege) && Array.isArray(s.figuren)
      && Array.isArray(s.sperren)) return s;
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

// Bei den Sperrsteinen ist nichts geheim — der Stand geht unverändert hinüber.
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
    ui.gewaehlt = null;
    ui.screen = 'spiel';
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'aktion') {
    try {
      if (m.name === 'wuerfeln') wuerfeln(stand);
      else if (m.name === 'ziehen') ziehen(stand, m.wert.figur, m.wert.ziel);
      else if (m.name === 'setzen') sperreSetzen(stand, m.wert);
      else if (m.name === 'weiter') zugBeenden(stand);
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
  app.innerHTML = `
    <div class="screen start">
      <div class="wrap">
        <h1 class="wortmarke">Sperr<em>steine</em></h1>
        <p class="unterzeile">Fünf Figuren, ein Wegenetz, elf weiße Steine im Weg.
          Wer genau auf einen trifft, nimmt ihn und stellt ihn der Gegenseite vor
          die Nase. Die erste Figur oben gewinnt.</p>
        <div class="feldlabel">Wer spielt?</div>
        <input class="feld" id="n1" maxlength="14" placeholder="Bernstein" value="Monty">
        <div style="height:10px"></div>
        <input class="feld" id="n2" maxlength="14" placeholder="Türkis" value="Christina">
                <div class="feldlabel">Welche Fassung?</div>
        <div class="wahlliste">
          ${MODI.map((m) => `
            <button class="wahl${m.id === ui.modusWahl ? ' wahl--an' : ''}" data-modus="${m.id}">
              <div class="haupt">
                <div class="oben">${esc(m.titel)}</div>
                <div class="unten">${esc(m.zeile)}</div>
              </div>
              <div class="haken">${m.id === ui.modusWahl ? '\u2713' : ''}</div>
            </button>`).join('')}
        </div>
<div class="knopfsaeule">
          <button class="btn btn--filz" id="los">Los geht's</button>
          <button class="btn btn--leise" id="regeln">Wie geht das?</button>
        </div>
      </div>
    </div>`;
  app.querySelectorAll('[data-modus]').forEach((k) => {
    k.onclick = () => { ui.modusWahl = k.dataset.modus; render(); };
  });
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Bernstein';
    const b = app.querySelector('#n2').value.trim() || 'Türkis';
    const m = MODI.find((x) => x.id === ui.modusWahl) || MODI[0];
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)], m.regeln);
    stand.modusId = m.id;
    ui.screen = 'spiel';
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Das Brett */

const ZELLE = 10;
const RAND = 3;
const BREITE = SPALTEN * ZELLE + 2 * RAND;
const HOEHE = REIHEN * ZELLE + 2 * RAND;

const punkt = (id) => mitte(id, ZELLE);

/** Welche Figur ist gerade ausgewählt — und was kann sie? */
function auswahl() {
  if (!ichBinDran() || stand.wurf === null || setztGerade(stand) || vorbei(stand)) {
    return { figur: null, ziele: [], beweglich: new Set() };
  }
  const alle = zuege(stand);
  const beweglich = new Set(alle.map((z) => z.figur));
  let figur = ui.gewaehlt;
  if (figur === null || !beweglich.has(figur)) figur = null;
  // Kann nur eine Figur ziehen, muss man sie nicht erst antippen.
  if (figur === null && beweglich.size === 1) [figur] = [...beweglich];
  return { figur, ziele: figur === null ? [] : zieleFuer(stand, figur), beweglich };
}

/** Eine Figur: Kegel von oben — Kreis mit angedeutetem Fuß. */
function figurForm(cx, cy, spieler, klassen, extra) {
  return `<circle class="figur figur--${spieler}${klassen}" cx="${cx}" cy="${cy}" r="3.1"${extra}/>`;
}

/** Ein Sperrstein: kleine weiße Kuppe. */
function steinForm(cx, cy) {
  const d = `M ${cx - 3.1} ${cy + 2.4} L ${cx - 3.1} ${cy - 0.4}`
    + ` Q ${cx - 3.1} ${cy - 3.4} ${cx} ${cy - 3.4}`
    + ` Q ${cx + 3.1} ${cy - 3.4} ${cx + 3.1} ${cy - 0.4}`
    + ` L ${cx + 3.1} ${cy + 2.4} Z`;
  return `<path class="stein" d="${d}"/>`
    + `<ellipse class="steinkuppe" cx="${cx - 0.8}" cy="${cy - 1.6}" rx="1" ry="0.7"/>`;
}

function brettSvg() {
  const setzt = setztGerade(stand) && ichBinDran();
  const { figur: gewaehlt, ziele, beweglich } = auswahl();
  const teile = [`<rect class="karton" x="${-RAND + 0.8}" y="${-RAND + 0.8}"`
    + ` width="${BREITE - 1.6}" height="${HOEHE - 1.6}" rx="6"/>`];

  // 1. Die Wege. Jede Kante nur einmal — sonst doppelt gezeichnete Linien.
  NACHBARN.forEach((liste, a) => {
    for (const b of liste) {
      if (b < a) continue;
      const [x1, y1] = punkt(a);
      const [x2, y2] = punkt(b);
      const heim = FELDER[a].art === 'heim' || FELDER[b].art === 'heim';
      const seite = heim ? (HEIM[0].includes(a) || HEIM[0].includes(b) ? 0 : 1) : null;
      teile.push(`<line class="weg${heim ? ` weg--heim${seite}` : ''}"`
        + ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    }
  });

  // 2. Die Felder.
  for (const feld of FELDER) {
    const [cx, cy] = punkt(feld.id);
    if (feld.art === 'ziel') {
      teile.push(`<circle class="loch loch--ziel" cx="${cx}" cy="${cy}" r="4.4"/>`);
      const zacken = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 1.1 : 2.6;
        const w = (Math.PI / 5) * i - Math.PI / 2;
        return `${(cx + r * Math.cos(w)).toFixed(2)},${(cy + r * Math.sin(w)).toFixed(2)}`;
      }).join(' ');
      teile.push(`<polygon class="zielstern" points="${zacken}"/>`);
      continue;
    }
    const heim = feld.art === 'heim' ? ` loch--heim${HEIM[0].includes(feld.id) ? 0 : 1}` : '';
    teile.push(`<circle class="loch${heim}" cx="${cx}" cy="${cy}" r="3.6"/>`);
  }

  // 3. Wohin darf der aufgenommene Stein?
  if (setzt) {
    for (const id of setzbar(stand)) {
      const [cx, cy] = punkt(id);
      teile.push(`<circle class="setzfeld" cx="${cx}" cy="${cy}" r="4.4" data-setzen="${id}"/>`);
    }
  }

  // 4. Steine und Figuren.
  for (const id of stand.sperren) {
    const [cx, cy] = punkt(id);
    teile.push(steinForm(cx, cy));
  }
  stand.figuren.forEach((seite, spieler) => seite.forEach((fig, nr) => {
    const [cx, cy] = punkt(fig.feld);
    const waehlbar = !setzt && spieler === stand.dran && beweglich.has(nr);
    const dieseGewaehlt = waehlbar && nr === gewaehlt;
    teile.push(figurForm(cx, cy, spieler,
      (waehlbar ? ' figur--wahl' : '') + (dieseGewaehlt ? ' figur--gewaehlt' : ''), ''));
    if (dieseGewaehlt) {
      teile.push(`<circle class="ring" cx="${cx}" cy="${cy}" r="4.5" pointer-events="none"/>`);
    }
    if (waehlbar) {
      teile.push(`<circle class="tippfeld" cx="${cx}" cy="${cy}" r="5" data-figur="${nr}"/>`);
    }
  }));

  // 5. Die Ziele der gewählten Figur — zuletzt, damit sie obenauf liegen.
  for (const z of ziele) {
    const [cx, cy] = punkt(z.ziel);
    const art = z.schlaegt ? ' zielpunkt--schlag' : z.sperre ? ' zielpunkt--stein' : '';
    teile.push(`<circle class="zielpunkt${art}" cx="${cx}" cy="${cy}" r="1.9"/>`);
    teile.push(`<circle class="tippfeld" cx="${cx}" cy="${cy}" r="5" data-ziel="${z.ziel}"/>`);
  }

  return `<svg class="brett" viewBox="${-RAND} ${-RAND} ${BREITE} ${HOEHE}" role="img"
    aria-label="Spielbrett mit ${FELDER.length} Feldern">${teile.join('')}</svg>`;
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
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#eee9df', dunkel: '#171d2b' });
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
          <textarea class="codefeld" id="rein" placeholder="SP1O|…"></textarea>
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

/** Wie weit ist eine Seite? Für die Kopfzeile: Schritte der besten Figur. */
const restWeg = (spieler) => beste(stand, spieler);

/** Was steht gerade an? Zwei Zeilen Klartext neben dem Würfel. */
function ansage() {
  const dran = stand.dran;
  const meins = ichBinDran();
  const wer = meins && ui.modus === 'online' ? 'Du bist' : `${name(dran)} ist`;
  if (vorbei(stand)) return { eins: `${name(stand.fertig)} hat gewonnen.`, zwei: '' };

  if (setztGerade(stand)) {
    return {
      eins: 'Sperrstein aufgenommen!',
      zwei: meins ? 'Tipp ein violett markiertes Feld an — dorthin kommt er.'
        : `${name(stand.setzen.spieler)} sucht ein Feld dafür.`,
      warnung: true,
    };
  }

  const letzte = stand.letzteAktion;
  if (stand.wurf === null) {
    if (letzte && letzte.art === 'geschlagen' && letzte.spieler !== dran) {
      return { eins: 'Deine Figur wurde geschlagen — zurück ins Heim.', zwei: `${wer} dran.`, warnung: true };
    }
    if (letzte && letzte.art === 'gesetzt') {
      return { eins: `${name(letzte.spieler)} hat einen Stein neu gesetzt.`, zwei: `${wer} dran — würfeln.` };
    }
    return { eins: `${wer} dran — würfeln.`, zwei: `Noch ${restWeg(dran)} Schritte bis oben.` };
  }

  const moeglich = zuege(stand);
  if (!moeglich.length) {
    return { eins: `${stand.wurf} gewürfelt — kein Zug möglich.`, zwei: 'Weiter.', warnung: true };
  }
  const schlaege = moeglich.filter((z) => z.schlaegt).length;
  const steine = moeglich.filter((z) => z.sperre).length;
  const sieg = moeglich.some((z) => z.gewinnt);
  const { figur } = auswahl();
  const zwei = sieg ? 'Ein Zug führt ins Ziel!'
    : schlaege && steine ? 'Schlagen oder eine Sperre knacken — beides geht.'
      : schlaege ? `${schlaege === 1 ? 'Ein Zug schlägt' : `${schlaege} Züge schlagen`} eine fremde Figur.`
        : steine ? `${steine === 1 ? 'Ein Zug knackt' : `${steine} Züge knacken`} eine Sperre.`
          : figur === null ? 'Tipp eine helle Figur an.' : 'Tipp einen Punkt an.';
  return { eins: `${stand.wurf} gewürfelt.`, zwei, warnung: sieg };
}

function renderSpiel() {
  const a = ansage();
  const kannWuerfeln = ichBinDran() && !vorbei(stand) && !setztGerade(stand) && stand.wurf === null;
  const kannWeiter = ichBinDran() && !vorbei(stand) && !setztGerade(stand)
    && stand.wurf !== null && zuege(stand).length === 0;

  app.innerHTML = `
    <div class="screen screen--spiel">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Partie ${stand.partie} · ${stand.siege[0]} : ${stand.siege[1]}
            · noch ${restWeg(0)} : ${restWeg(1)}</div>
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
      <div class="legende">
        <span><i class="l-zug"></i>Zug</span>
        <span><i class="l-schlag"></i>schlägt</span>
        <span><i class="l-stein"></i>Sperre</span>
      </div>
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
  app.querySelectorAll('[data-figur]').forEach((k) => {
    k.onclick = () => { ui.gewaehlt = Number(k.dataset.figur); render(); };
  });
  app.querySelectorAll('[data-ziel]').forEach((k) => {
    k.onclick = () => zielTippen(Number(k.dataset.ziel));
  });
  app.querySelectorAll('[data-setzen]').forEach((k) => {
    k.onclick = () => setzenTippen(Number(k.dataset.setzen));
  });
}

function wuerfelTippen() {
  ui.rollt = true;
  ui.gewaehlt = null;
  render();
  setTimeout(() => {
    ui.rollt = false;
    if (!tun('wuerfeln')) { render(); return; }
    try { wuerfeln(stand); } catch { render(); return; }
    buzz(12);
    nachAenderung();
  }, 380);
}

function zielTippen(ziel) {
  const { figur } = auswahl();
  if (figur === null) return;
  const zug = zieleFuer(stand, figur).find((z) => z.ziel === ziel);
  if (!zug) return;
  ui.gewaehlt = null;
  if (!tun('ziehen', { figur, ziel })) { render(); return; }
  try { ziehen(stand, figur, ziel); } catch { render(); return; }
  buzz(zug.gewinnt ? [30, 60, 30, 60, 30] : zug.schlaegt ? [20, 50, 20] : zug.sperre ? [15, 40] : 10);
  nachAenderung();
}

function setzenTippen(feld) {
  if (!tun('setzen', feld)) { render(); return; }
  try { sperreSetzen(stand, feld); } catch { render(); return; }
  buzz(14);
  nachAenderung();
}

function weiterTippen() {
  ui.gewaehlt = null;
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
    <div class="krone" aria-hidden="true">⛰️</div>
    <div class="name">${name(sieger)}</div>
    <p>Oben angekommen — durch elf Steine hindurch. Es steht
      <b class="num">${stand.siege[0]} : ${stand.siege[1]}</b>.</p>
    <button class="btn btn--filz" id="nochmal">Noch eine Partie</button>
    <button class="btn btn--leise" id="spaeter">Später</button>`;
  app.appendChild(layer);
  layer.querySelector('#nochmal').onclick = () => {
    ui.gewaehlt = null;
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
    <p>Jeder hat <b>fünf Figuren</b>, die unten im eigenen Heim stehen. Sie laufen über
      das Wegenetz nach oben zum Stern. <b>Die erste Figur, die oben ankommt, gewinnt</b> —
      die anderen vier müssen nicht mit.</p>

    <h3>Ziehen</h3>
    <p>Ein Würfel, ein Zug. Es wird <b>genau</b> die gewürfelte Zahl gegangen, Schritt für
      Schritt entlang der Linien. Die Richtung ist frei, an jeder Kreuzung darf man
      abbiegen — nur <b>zurück auf das gerade verlassene Feld</b> geht nicht.</p>

    <h3>Die Sperrsteine</h3>
    <p>Elf weiße Steine stehen im Weg. <b>Über einen Stein kommt niemand hinweg.</b> Man
      kann ihn nur <b>genau treffen</b>: dann nimmt man ihn weg und stellt ihn auf eines
      der violett markierten Felder — am besten der Gegenseite direkt vor die Nase. Nicht erlaubt
      sind das Ziel, die Heimfelder und die unterste Straße.</p>
    <p>Zu Beginn stehen die Steine als <b>drei Mauern</b> quer über dem Brett. Der Weg nach
      oben muss also erst aufgebrochen werden — und was du aufbrichst, steht auch der
      Gegenseite offen.</p>

    <h3>Schlagen</h3>
    <p>Landest du <b>genau</b> auf einer gegnerischen Figur, geht sie zurück in ihr Heim
      und fängt von vorn an. Über Figuren darf man <b>hinwegziehen</b> — über Steine nicht.
      Auf einer eigenen Figur darf man nicht stehen bleiben.</p>

    <h3>Das Ziel</h3>
    <p>Der Stern muss <b>genau</b> getroffen werden; darüber hinaus geht es nicht. Es führen
      drei Wege hinauf, damit kein einzelner Stein das Spiel zusperren kann.</p>

    <h3>Am Handy</h3>
    <p>Erst den Würfel antippen. Dann eine <b>hell umrandete Figur</b> — es erscheinen
      Punkte für alle Felder, die sie erreichen kann: <b>violett</b> ein gewöhnlicher Zug,
      <b>rot</b> ein Schlag, <b>grün</b> eine Sperre. Punkt antippen, fertig. Kann nur eine
      Figur ziehen, ist sie schon ausgewählt.</p>
    <p>Hier ist nichts geheim — ihr könnt an einem Handy spielen und es hin und her
      reichen, oder jeder nimmt sein eigenes.</p>

    <h3>Woher die Regeln kommen</h3>
    <p>Aus der Familie von <em>Malefiz</em> bzw. <em>Barricade</em> (Ravensburger, 1960).
      Spielregeln sind frei — Name und Brettgestaltung nicht. Deshalb heißt es hier
      Sperrsteine, und das Wegenetz ist ein eigener Entwurf: für zwei Seiten
      spiegelgleich, damit beide denselben Weg haben.</p>

    <div class="knopfsaeule"><button class="btn btn--filz" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const heim = (i) => stand.figuren[i].filter((x) => HEIM[i].includes(x.feld)).length;
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div class="tafel">
      <div class="seite seite--0"><div class="wer">${name(0)}</div>
        <div class="zahl num">${stand.siege[0]}</div></div>
      <div class="strichlein"></div>
      <div class="seite seite--1"><div class="wer">${name(1)}</div>
        <div class="zahl num">${stand.siege[1]}</div></div>
    </div>
    <p style="text-align:center">Beste Figur noch <b>${restWeg(0)}</b> bzw.
      <b>${restWeg(1)}</b> Schritte vom Ziel.<br>
      Zu Hause: ${heim(0)} zu ${heim(1)} von je ${FIGUREN}.
      Steine auf dem Brett: ${stand.sperren.length} von ${SPERREN}.</p>

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

  l.querySelector('#zu').onclick = () => { ui.overlay = null; ui.codeStatus = ''; render(); };
  l.querySelector('#zweiGeraete')?.addEventListener('click', () => {
    ui.overlay = null;
    ui.kopplung = { schritt: 'rolle', gastgeber: true, code: '', fehler: '' };
    render();
  });
  l.querySelector('#trennen')?.addEventListener('click', () => { ui.overlay = null; kopplungAbbrechen(); });
  l.querySelector('#neuePartie').onclick = () => {
    ui.gewaehlt = null;
    if (!tun('partieNeu')) { ui.overlay = null; render(); return; }
    partieNeu(stand);
    ui.overlay = null;
    nachAenderung();
  };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('sperre-css', 'sperre-js', 'Sperrsteine.html', 'Sperrsteine');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'Sperrsteine.html');
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
    <textarea class="codefeld" id="rein" placeholder="SPR1-…"></textarea>
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
