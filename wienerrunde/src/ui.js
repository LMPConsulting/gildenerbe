// Wiener Runde — Oberfläche. Ein Handy zum Weiterreichen oder zwei zugleich.
//
// Nichts ist geheim: beide sehen dasselbe Brett und dieselben Konten. Darum
// kein Übergabe-Bildschirm; die Kopfzeile und der Rahmen um das Konto sagen,
// wer dran ist.

import {
  FELDER, FELDER_GESAMT, GRUPPEN, GRUPPENFELDER, KAUFBAR, LOS_GELD,
  GEFAENGNIS_FELD, KAUTION, LINIENMIETE, WERKFAKTOR,
} from './brett.js';
import {
  neuerStand, wuerfeln, ziehen, kaufen, kaufVerzichten, miete, besitzer,
  gruppeKomplett, haeuserAuf, beliehen, bauen, abreissen, beleihen, ausloesen,
  kautionZahlen, freikarteNutzen, wuerfelnImKnast, zugBeenden, vermoegen,
  vorbei, phase, handelAnbieten, handelAnnehmen, handelAblehnen,
  partieNeu, alsCode, ausCode,
  MODI, schnellstartVerteilen, angebotAnnehmen, angebotAblehnen,
} from './engine.js';
import { FELDPUNKTE, KANTE, RASTER, mitte } from './geometrie.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, kameraFreigeben, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'wienerrunde.v1';
const app = document.getElementById('app');

let stand = null;
let ui = {
  modusWahl: 'klassisch',
  overlay: null,
  gezeigtesFeld: null,     // welches Feld gerade als Karte offen ist
  handelFeld: null,        // Feld, für das gerade ein Angebot getippt wird
  handelPreis: '',
  meldung: '',
  rollt: false,
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
const geld = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('de-DE')} €`;
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };
const ichBinDran = () => ui.modus !== 'online' || stand.dran === ui.meinIndex;

function sichern() {
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.geld) && Array.isArray(s.ort)) return s;
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
  ui.netz?.senden({ typ: 'stand', stand });
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
    stand = m.stand;
    render();
    return;
  }
  if (!ui.gastgeber || !stand) return;

  if (m.typ === 'aktion') {
    try {
      const w = m.wert;
      if (m.name === 'wuerfeln') { wuerfeln(stand); ziehen(stand); }
      else if (m.name === 'kaufen') kaufen(stand);
      else if (m.name === 'verzichten') kaufVerzichten(stand);
      else if (m.name === 'zugreifen') angebotAnnehmen(stand);
      else if (m.name === 'ablehnen') angebotAblehnen(stand);
      else if (m.name === 'bauen') bauen(stand, w);
      else if (m.name === 'abreissen') abreissen(stand, w);
      else if (m.name === 'beleihen') beleihen(stand, w);
      else if (m.name === 'ausloesen') ausloesen(stand, w);
      else if (m.name === 'kaution') kautionZahlen(stand);
      else if (m.name === 'freikarte') freikarteNutzen(stand);
      else if (m.name === 'knastwurf') wuerfelnImKnast(stand);
      else if (m.name === 'weiter') zugBeenden(stand);
      else if (m.name === 'anbieten') handelAnbieten(stand, w);
      else if (m.name === 'annehmen') handelAnnehmen(stand);
      else if (m.name === 'ablehnen') handelAblehnen(stand);
      else if (m.name === 'partieNeu') stand = partieNeu(stand);
      else if (m.name === 'regel') stand.regeln = { ...stand.regeln, ...w };
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
  if (!ui.kopplung) return;
  ui.kopplung = null;
  if (ui.gastgeber) {
    if (!stand) stand = neuerStand();
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
    <div class="screen"><div class="scroll">
      <div class="wrap" style="text-align:center">
        <h1 class="wortmarke">Wiener <em>Runde</em></h1>
        <p class="unterzeile">Kaufen, bauen, Miete kassieren — einmal quer durch Wien.
          Nach 40 Runden gewinnt, wer mehr besitzt.</p>
        <div class="feldlabel">Wer spielt?</div>
        <input class="feld" id="n1" maxlength="14" placeholder="Erster Name" value="Monty">
        <div style="height:10px"></div>
        <input class="feld" id="n2" maxlength="14" placeholder="Zweiter Name" value="Christina">
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
          <button class="btn btn--rot" id="los">Los geht's</button>
          <button class="btn btn--leise" id="regeln">Wie geht das?</button>
        </div>
      </div>
    </div></div>`;
  app.querySelectorAll('[data-modus]').forEach((k) => {
    k.onclick = () => { ui.modusWahl = k.dataset.modus; render(); };
  });
  app.querySelector('#los').onclick = () => {
    const a = app.querySelector('#n1').value.trim() || 'Eins';
    const b = app.querySelector('#n2').value.trim() || 'Zwei';
    const m = MODI.find((x) => x.id === ui.modusWahl) || MODI[0];
    stand = neuerStand([a.slice(0, 14), b.slice(0, 14)], m.regeln);
    stand.modusId = m.id;
    schnellstartVerteilen(stand);
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Das Brett */

const ZELLE = 10;
const MASS = RASTER * ZELLE;

const GRUPPENFARBE = (g) => (GRUPPEN[g] ? GRUPPEN[g].farbe : '#999');

/** Kurzzeichen für Felder ohne Farbband — damit man sie unterscheidet. */
const KUERZEL = { linie: 'U', werk: '⚡', ereignis: '?', kaffeehaus: '☕', steuer: '€',
  los: 'LOS', besuch: 'BES', parken: 'FREI', inHaft: '→', ort: '' };

function brettSvg() {
  const teile = [];

  FELDER.forEach((f, i) => {
    const [gx, gy] = FELDPUNKTE[i];
    const x = gx * ZELLE;
    const y = gy * ZELLE;
    const ecke = i % 10 === 0;
    const hier = stand.ort.includes(i);
    const klassen = ['zelle', ecke ? 'zelle--ecke' : '', hier ? 'zelle--jetzt' : '', 'zelle--wahl']
      .filter(Boolean).join(' ');
    teile.push(`<rect class="${klassen}" x="${x + 0.3}" y="${y + 0.3}"`
      + ` width="${ZELLE - 0.6}" height="${ZELLE - 0.6}" rx="1.2" data-feld="${i}"/>`);

    // Farbband auf der zur Mitte zeigenden Seite
    if (f.art === 'ort') {
      const dicke = 2.4;
      const kante = KANTE[i];
      const bx = kante === 'rechts' ? x + 0.3 : x + 0.3;
      const by = kante === 'unten' ? y + 0.3 : y + 0.3;
      const bw = kante === 'links' || kante === 'rechts' ? dicke : ZELLE - 0.6;
      const bh = kante === 'oben' || kante === 'unten' ? dicke : ZELLE - 0.6;
      const vx = kante === 'links' ? x + ZELLE - 0.3 - dicke : bx;
      const vy = kante === 'oben' ? y + ZELLE - 0.3 - dicke : by;
      teile.push(`<rect class="band" x="${vx}" y="${vy}" width="${bw}" height="${bh}"`
        + ` rx="0.6" fill="${GRUPPENFARBE(f.gruppe)}" pointer-events="none"/>`);
    } else if (KUERZEL[f.art]) {
      teile.push(`<text class="kuerzel" x="${x + ZELLE / 2}" y="${y + ZELLE / 2}"`
        + ` pointer-events="none">${KUERZEL[f.art]}</text>`);
    }

    // Besitzmarke am äußeren Rand
    const wem = besitzer(stand, i);
    if (wem !== null) {
      const kante = KANTE[i];
      const mx = kante === 'links' ? x + 1.2 : kante === 'rechts' ? x + ZELLE - 1.2 : x + ZELLE / 2;
      const my = kante === 'oben' ? y + 1.2 : kante === 'unten' ? y + ZELLE - 1.2 : y + ZELLE / 2;
      teile.push(`<circle class="marke marke--${wem}" cx="${mx}" cy="${my}" r="1.1"`
        + ' pointer-events="none"/>');
      if (beliehen(stand, i)) {
        teile.push(`<path class="hyp" d="M ${x + 1.4} ${y + 1.4} L ${x + ZELLE - 1.4} ${y + ZELLE - 1.4}"`
          + ' pointer-events="none"/>');
      }
    }

    // Häuser
    const h = haeuserAuf(stand, i);
    if (h === 5) {
      teile.push(`<rect class="hotel" x="${x + ZELLE / 2 - 2}" y="${y + ZELLE / 2 - 1.2}"`
        + ' width="4" height="2.4" rx="0.5" pointer-events="none"/>');
    } else if (h > 0) {
      for (let k = 0; k < h; k++) {
        teile.push(`<rect class="haus" x="${x + 1.4 + k * 2}" y="${y + ZELLE / 2 - 0.9}"`
          + ' width="1.6" height="1.8" rx="0.3" pointer-events="none"/>');
      }
    }
  });

  // Mitte
  const mx = MASS / 2;
  teile.push(`<text class="mitteschrift" x="${mx}" y="${mx - 6}">Wiener Runde</text>`);
  teile.push(`<text class="mittezeile" x="${mx}" y="${mx + 4}">RUNDE ${stand.runde}${
    stand.regeln.runden ? ` VON ${stand.regeln.runden}` : ''}</text>`);

  // Figuren — leicht versetzt, damit sie sich auf einem Feld nicht verdecken
  stand.ort.forEach((feld, spieler) => {
    const [cx, cy] = mitte(FELDPUNKTE[feld], ZELLE);
    const dx = spieler === 0 ? -1.8 : 1.8;
    teile.push(`<circle class="figur figur--${spieler}" cx="${cx + dx}" cy="${cy - 2.4}" r="1.9"`
      + ' pointer-events="none"/>');
  });

  return `<svg class="brett" viewBox="0 0 ${MASS} ${MASS}" role="img"
    aria-label="Spielbrett mit ${FELDER_GESAMT} Feldern">${teile.join('')}</svg>`;
}

const AUGEN = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function wuerfelSvg(zahl) {
  if (!zahl) return '<span>?</span>';
  const gesetzt = new Set(AUGEN[zahl]);
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
        <p>Jeder auf seinem Gerät: Wer das Wort stellt, tippt es bei sich ein —
          der andere sieht nur die Lücken.</p>
        ${netzMoeglich() ? `
        <div class="feldlabel">Über das Internet</div>
        <p>Egal wo ihr seid. Einer öffnet einen Raum, der andere tippt den Code ein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--rot" id="netzWirt">Raum öffnen</button>
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
        <button class="btn btn--rot" id="kameraNochmal">Nochmal fragen</button>
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
          <button class="btn btn--rot" id="weiterKoppeln">${k.gastgeber
    ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#f4ece0', dunkel: '#221a24' });
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
          <textarea class="codefeld" id="rein" placeholder="WR1O|…"></textarea>
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
          <button class="btn btn--rot" id="beitreten">Mitspielen</button>
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

/* ------------------------------------------------------------ Der Spieltisch */

/** Was jetzt ansteht — eine Zeile Klartext. */
function ansage() {
  const wer = stand.dran;
  if (vorbei(stand)) return `${name(stand.fertig)} gewinnt.`;
  if (ui.meldung) return ui.meldung;
  if (stand.haft[wer] > 0) return `${name(wer)} sitzt im Kommissariat — ${stand.haft[wer]} Versuche.`;
  if (phase(stand) === 'wuerfeln') return `${name(wer)} ist dran.`;
  if (phase(stand) === 'kaufen') {
    const f = FELDER[stand.ort[wer]];
    return `${esc(f.name)} ist frei — ${geld(f.preis)}.`;
  }
  if (phase(stand) === 'angebot' && stand.angebot) {
    const f = FELDER[stand.angebot.feld];
    return `${name(stand.angebot.an)} darf ${esc(f.name)} für ${geld(f.preis)} nehmen.`;
  }
  return `${name(wer)} kann bauen, handeln oder weitergeben.`;
}

function kontenZeile() {
  const zelle = (i) => `
    <div class="konto konto--${i} ${stand.dran === i ? 'konto--dran' : ''}">
      <div class="wer">${name(i)}${stand.haft[i] > 0 ? ' · im Kommissariat' : ''}</div>
      <div class="geld num">${geld(stand.geld[i])}</div>
      <div class="klein">Vermögen ${geld(vermoegen(stand, i))}${
  stand.freikarten[i] ? ` · ${stand.freikarten[i]}× frei` : ''}</div>
    </div>`;
  return `<div class="konten">${zelle(0)}${zelle(1)}</div>`;
}

function renderSpiel() {
  const wer = stand.dran;
  const meins = ichBinDran();
  const imKnast = stand.haft[wer] > 0;
  const p = phase(stand);

  const knoepfe = [];
  if (meins && !vorbei(stand)) {
    if (imKnast) {
      knoepfe.push('<button class="btn btn--rot" id="knastwurf">Auf Pasch würfeln</button>');
      if (stand.freikarten[wer] > 0) {
        knoepfe.push('<button class="btn btn--geist" id="freikarte">Freikarte einlösen</button>');
      }
      if (stand.geld[wer] >= KAUTION) {
        knoepfe.push(`<button class="btn btn--geist" id="kaution">${geld(KAUTION)} zahlen</button>`);
      }
    } else if (p === 'kaufen') {
      knoepfe.push(`<button class="btn btn--rot" id="kaufen">Kaufen für ${
        geld(FELDER[stand.ort[wer]].preis)}</button>`);
      knoepfe.push('<button class="btn btn--geist" id="verzichten">Lieber nicht</button>');
    } else if (p === 'angebot') {
      // Versteigerung: der Läufer hat verzichtet, jetzt greift die Gegenseite zu.
      knoepfe.push(`<button class="btn btn--rot" id="zugreifen">Zugreifen für ${
        geld(FELDER[stand.angebot.feld].preis)}</button>`);
      knoepfe.push('<button class="btn btn--geist" id="ablehnen">Auch nicht</button>');
    } else if (p === 'wuerfeln') {
      knoepfe.push('<button class="btn btn--rot" id="wuerfeln">Würfeln</button>');
    } else {
      knoepfe.push('<button class="btn btn--rot" id="weiter">Zug beenden</button>');
    }
    if (!imKnast && p !== 'kaufen') {
      knoepfe.push('<button class="btn btn--geist" id="besitz">Mein Besitz &amp; bauen</button>');
    }
  }

  const w = stand.wurf;
  app.innerHTML = `
    <div class="screen">
      <div class="kopf">
        <div class="titel">
          <div class="ober">Runde ${stand.runde}${stand.regeln.runden ? ` von ${stand.regeln.runden}` : ''}
            · ${stand.siege[0]} : ${stand.siege[1]}</div>
          <h1>${vorbei(stand) ? `${name(stand.fertig)} gewinnt` : `${name(wer)} ist dran`}</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="wRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="wMenue" aria-label="Menü">⋯</button>
        </div>
      </div>
      ${kontenZeile()}
      <div class="tischplatte">${brettSvg()}</div>
      <div class="leiste">
        <button class="wuerfel${w ? '' : ' wuerfel--frage'}${ui.rollt ? ' wuerfel--rollt' : ''}"
          id="wuerfelA" disabled aria-hidden="true">${wuerfelSvg(w ? w.wuerfel[0] : null)}</button>
        <button class="wuerfel${w ? '' : ' wuerfel--frage'}${ui.rollt ? ' wuerfel--rollt' : ''}"
          id="wuerfelB" disabled aria-hidden="true">${wuerfelSvg(w ? w.wuerfel[1] : null)}</button>
        <div class="sagt"><div class="zeile1">${ansage()}</div>
          <div class="zeile2">${w ? `Gewürfelt: ${w.wuerfel[0]} und ${w.wuerfel[1]}${
  w.pasch ? ' — Pasch!' : ''}` : 'Tipp ein Feld an, um es anzusehen.'}</div></div>
      </div>
      <div class="wrap" style="padding-top:0">
        <div class="knopfsaeule">${knoepfe.join('')}</div>
      </div>
    </div>`;

  app.querySelector('#wRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#wMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#wuerfeln')?.addEventListener('click', wuerfelnTippen);
  app.querySelector('#kaufen')?.addEventListener('click', () => aktion('kaufen', null, kaufen));
  app.querySelector('#verzichten')?.addEventListener('click', () => aktion('verzichten', null, kaufVerzichten));
  app.querySelector('#zugreifen')?.addEventListener('click', () => aktion('zugreifen', null, angebotAnnehmen));
  app.querySelector('#ablehnen')?.addEventListener('click', () => aktion('ablehnen', null, angebotAblehnen));
  app.querySelector('#weiter')?.addEventListener('click', () => {
    ui.meldung = '';
    aktion('weiter', null, zugBeenden);
  });
  app.querySelector('#kaution')?.addEventListener('click', () => aktion('kaution', null, kautionZahlen));
  app.querySelector('#freikarte')?.addEventListener('click', () => aktion('freikarte', null, freikarteNutzen));
  app.querySelector('#knastwurf')?.addEventListener('click', knastwurfTippen);
  app.querySelector('#besitz')?.addEventListener('click', () => { ui.overlay = 'besitz'; render(); });

  app.querySelectorAll('.zelle--wahl').forEach((z) => {
    z.onclick = () => { ui.gezeigtesFeld = Number(z.dataset.feld); ui.overlay = 'feld'; render(); };
  });
}

/** Eine Aktion ausführen — beim Gast über die Leitung, sonst hier. */
function aktion(name2, wert, fn) {
  if (!tun(name2, wert)) { render(); return; }
  try { fn(stand, wert); } catch { render(); return; }
  nachAenderung();
}

function wuerfelnTippen() {
  ui.rollt = true;
  ui.meldung = '';
  render();
  setTimeout(() => {
    ui.rollt = false;
    if (!tun('wuerfeln')) { render(); return; }
    try {
      wuerfeln(stand);
      const was = ziehen(stand);
      ui.meldung = ereignisText(was);
    } catch { render(); return; }
    buzz(12);
    nachAenderung();
  }, 380);
}

function knastwurfTippen() {
  ui.rollt = true;
  render();
  setTimeout(() => {
    ui.rollt = false;
    if (!tun('knastwurf')) { render(); return; }
    const raus = wuerfelnImKnast(stand);
    ui.meldung = !raus ? ''
      : raus.pasch ? 'Pasch — frei!'
        : raus.frei ? `Dritter Fehlversuch: ${geld(KAUTION)} Kaution.`
          : 'Kein Pasch.';
    buzz(10);
    nachAenderung();
  }, 380);
}

/** Was auf dem Feld passiert ist, in einem Satz. */
function ereignisText(was) {
  if (!was) return '';
  if (was.art === 'karte') return esc(was.karte.text);
  if (was.art === 'miete') return `Miete an ${name(besitzer(stand, was.feld))}: ${geld(was.betrag)}.`;
  if (was.art === 'steuer') return `Steuer: ${geld(was.betrag)}.`;
  if (was.art === 'haft') return 'Ab ins Kommissariat.';
  if (was.art === 'parken') return 'Freier Platz — nichts passiert.';
  if (was.art === 'los') return `Auf Los: ${geld(LOS_GELD)}.`;
  if (was.art === 'eigen') return 'Eigener Grund.';
  if (was.art === 'frei' && phase(stand) !== 'kaufen') return 'Frei — aber zu teuer.';
  return '';
}

/* ------------------------------------------------------- Die Feldkarte */

function mietTabelle(f) {
  const wem = besitzer(stand, f.feld);
  const h = haeuserAuf(stand, f.feld);
  const voll = wem !== null && gruppeKomplett(stand, f.gruppe, wem);
  const zeilen = [
    ['Grundmiete', f.miete[0]],
    ['bei ganzer Gruppe', f.miete[0] * 2],
    ['mit 1 Haus', f.miete[1]],
    ['mit 2 Häusern', f.miete[2]],
    ['mit 3 Häusern', f.miete[3]],
    ['mit 4 Häusern', f.miete[4]],
    ['mit Hotel', f.miete[5]],
  ];
  const jetztIndex = h > 0 ? h + 1 : (voll ? 1 : 0);
  return `<table>${zeilen.map((z, i) =>
    `<tr class="${i === jetztIndex ? 'jetzt' : ''}"><td>${z[0]}</td><td>${geld(z[1])}</td></tr>`).join('')}
    <tr><td>Haus / Hotel</td><td>${geld(f.haus)}</td></tr></table>`;
}

function renderFeldkarte() {
  const i = ui.gezeigtesFeld;
  const f = FELDER[i];
  const wem = besitzer(stand, i);
  const meins = ichBinDran();
  const wer = stand.dran;

  let farbe = '#6b5c66';
  let band = f.name;
  if (f.art === 'ort') { farbe = GRUPPENFARBE(f.gruppe); band = GRUPPEN[f.gruppe].titel; }
  else if (f.art === 'linie') { farbe = '#41525e'; band = 'U-Bahn'; }
  else if (f.art === 'werk') { farbe = '#7a6b41'; band = 'Versorgung'; }

  let rumpf = '';
  if (f.art === 'ort') rumpf = mietTabelle(f);
  else if (f.art === 'linie') {
    rumpf = `<table>${LINIENMIETE.slice(1).map((m, k) =>
      `<tr><td>${k + 1} Linie${k ? 'n' : ''}</td><td>${geld(m)}</td></tr>`).join('')}</table>`;
  } else if (f.art === 'werk') {
    rumpf = `<table><tr><td>ein Werk</td><td>${WERKFAKTOR[1]}× Wurf</td></tr>
      <tr><td>beide Werke</td><td>${WERKFAKTOR[2]}× Wurf</td></tr></table>`;
  } else if (f.art === 'steuer') {
    rumpf = `<p class="fuss">Kostet ${geld(f.betrag)}.</p>`;
  } else {
    rumpf = '<p class="fuss">Kein Grundstück.</p>';
  }

  const knoepfe = [];
  if (f.preis && wem === null) knoepfe.push(`<p class="fuss">Kaufpreis ${geld(f.preis)}. Noch frei.</p>`);
  if (wem !== null) {
    knoepfe.push(`<p class="fuss">Gehört ${name(wem)}${beliehen(stand, i) ? ' · beliehen' : ''}.</p>`);
  }

  const l = overlayHuelle(`
    <div class="karte">
      <div class="kopfband" style="background:${farbe}">${esc(band)}</div>
      <div class="rumpf">
        <h4>${esc(f.name)}</h4>
        ${rumpf}
        ${knoepfe.join('')}
      </div>
    </div>
    ${f.art === 'ort' && wem !== null && gruppeKomplett(stand, f.gruppe, wem)
    ? '<p class="gruppenhinweis">Ganze Gruppe in einer Hand — hier darf gebaut werden.</p>' : ''}
    <div class="knopfsaeule">
      ${meins && wem === wer && f.art === 'ort' && gruppeKomplett(stand, f.gruppe, wer)
    ? `<button class="btn btn--geist" id="bauen">Haus bauen (${geld(f.haus)})</button>` : ''}
      ${meins && wem === wer && haeuserAuf(stand, i) > 0
    ? `<button class="btn btn--geist" id="abreissen">Haus abreißen (+${geld(Math.floor(f.haus / 2))})</button>` : ''}
      ${meins && wem === wer && f.preis && !beliehen(stand, i) && haeuserAuf(stand, i) === 0
    ? `<button class="btn btn--geist" id="beleihen">Beleihen (+${geld(Math.floor(f.preis / 2))})</button>` : ''}
      ${meins && wem === wer && beliehen(stand, i)
    ? `<button class="btn btn--geist" id="ausloesen">Auslösen (${geld(Math.ceil(Math.floor(f.preis / 2) * 1.1))})</button>` : ''}
      ${meins && wem === wer && f.preis && haeuserAuf(stand, i) === 0
    ? '<button class="btn btn--geist" id="anbieten">Der Gegenseite anbieten</button>' : ''}
      <button class="btn btn--leise" id="zu">Zurück</button>
    </div>`);

  const nach = (n, fn) => { ui.overlay = null; aktion(n, i, fn); };
  l.querySelector('#bauen')?.addEventListener('click', () => nach('bauen', bauen));
  l.querySelector('#abreissen')?.addEventListener('click', () => nach('abreissen', abreissen));
  l.querySelector('#beleihen')?.addEventListener('click', () => nach('beleihen', beleihen));
  l.querySelector('#ausloesen')?.addEventListener('click', () => nach('ausloesen', ausloesen));
  l.querySelector('#anbieten')?.addEventListener('click', () => {
    ui.handelFeld = i;
    ui.handelPreis = String(f.preis);
    ui.overlay = 'anbieten';
    render();
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

/* ----------------------------------------------------------------- Handel */

function renderAnbieten() {
  const i = ui.handelFeld;
  const f = FELDER[i];
  const l = overlayHuelle(`
    <h2>${esc(f.name)} anbieten</h2>
    <p>Nenn einen Preis. Die Gegenseite entscheidet.</p>
    <div class="feldlabel">Preis in Euro</div>
    <input class="feld feld--code" id="preis" inputmode="numeric" value="${esc(ui.handelPreis)}">
    <p class="fuss" style="color:var(--schrift-blass);font-size:13px">
      Listenpreis ${geld(f.preis)}. Die Gegenseite hat ${geld(stand.geld[andere(stand.dran)])}.</p>
    <div class="knopfsaeule">
      <button class="btn btn--rot" id="senden">Anbieten</button>
      <button class="btn btn--leise" id="zu">Doch nicht</button>
    </div>`);
  const feld = l.querySelector('#preis');
  feld.focus();
  l.querySelector('#senden').onclick = () => {
    const preis = Math.max(0, parseInt(feld.value, 10) || 0);
    ui.overlay = null;
    ui.handelFeld = null;
    const angebot = { von: stand.dran, feld: i, preis };
    if (!tun('anbieten', angebot)) { render(); return; }
    handelAnbieten(stand, angebot);
    nachAenderung();
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; ui.handelFeld = null; render(); };
}

function renderHandel() {
  const h = stand.handel;
  const f = FELDER[h.feld];
  const an = andere(h.von);
  const darfIch = ui.modus !== 'online' || ui.meinIndex === an;
  const l = overlayHuelle(`
    <h2>Angebot von ${name(h.von)}</h2>
    <div class="karte">
      <div class="kopfband" style="background:${f.art === 'ort' ? GRUPPENFARBE(f.gruppe) : '#41525e'}">
        ${f.art === 'ort' ? esc(GRUPPEN[f.gruppe].titel) : esc(f.name)}</div>
      <div class="rumpf"><h4>${esc(f.name)}</h4>
        <p class="fuss">Listenpreis ${geld(f.preis)} · verlangt werden <b>${geld(h.preis)}</b></p>
      </div>
    </div>
    <p>${name(an)} hat ${geld(stand.geld[an])}.</p>
    ${darfIch ? `<div class="knopfsaeule">
      <button class="btn btn--rot" id="ja" ${stand.geld[an] >= h.preis ? '' : 'disabled'}>Annehmen</button>
      <button class="btn btn--geist" id="nein">Ablehnen</button>
    </div>` : '<p>Die Gegenseite entscheidet.</p>'}`);
  l.querySelector('#ja')?.addEventListener('click', () => {
    if (!tun('annehmen')) { render(); return; }
    handelAnnehmen(stand);
    nachAenderung();
  });
  l.querySelector('#nein')?.addEventListener('click', () => {
    if (!tun('ablehnen')) { render(); return; }
    handelAblehnen(stand);
    nachAenderung();
  });
}

/* ---------------------------------------------------------- Besitzübersicht */

function renderBesitz() {
  const wer = stand.dran;
  const meine = KAUFBAR.filter((f) => besitzer(stand, f) === wer);
  const fehlend = [];
  for (const [g, felder] of Object.entries(GRUPPENFELDER)) {
    const habe = felder.filter((f) => besitzer(stand, f) === wer).length;
    if (habe === felder.length - 1 && habe > 0) {
      const fehlt = felder.find((f) => besitzer(stand, f) !== wer);
      fehlend.push({ gruppe: g, feld: fehlt });
    }
  }

  const zeile = (f) => {
    const feld = FELDER[f];
    const farbe = feld.art === 'ort' ? GRUPPENFARBE(feld.gruppe) : '#41525e';
    const h = haeuserAuf(stand, f);
    return `<button class="besitzzeile ${beliehen(stand, f) ? 'besitzzeile--hyp' : ''}" data-feld="${f}">
      <span class="streifen" style="background:${farbe}"></span>
      <span class="nam">${esc(feld.name)}</span>
      <span class="wert">${h === 5 ? 'Hotel' : h ? `${h} Haus${h > 1 ? 'er' : ''}` : geld(feld.preis)}</span>
    </button>`;
  };

  const l = overlayHuelle(`
    <h2>Besitz von ${name(wer)}</h2>
    <p>${meine.length} von ${KAUFBAR.length} Feldern · Vermögen ${geld(vermoegen(stand, wer))}</p>
    ${fehlend.length ? `<p class="gruppenhinweis">Dir fehlt nur noch
      <b>${esc(FELDER[fehlend[0].feld].name)}</b> für die Gruppe
      „${esc(GRUPPEN[fehlend[0].gruppe].titel)}“. Vielleicht ein Angebot machen?</p>` : ''}
    <div class="besitzliste">${meine.length ? meine.map(zeile).join('')
    : '<p>Noch nichts gekauft.</p>'}</div>
    <div class="knopfsaeule"><button class="btn btn--leise" id="zu">Zurück</button></div>`);

  l.querySelectorAll('.besitzzeile').forEach((b) => {
    b.onclick = () => { ui.gezeigtesFeld = Number(b.dataset.feld); ui.overlay = 'feld'; render(); };
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

/* ---------------------------------------------------------------- Jubel */

function renderJubel() {
  const sieger = stand.fertig;
  const layer = document.createElement('div');
  layer.className = 'overlay jubel';
  layer.innerHTML = `
    <div class="krone" aria-hidden="true">🏆</div>
    <div class="name">${name(sieger)}</div>
    <p>Vermögen: <b class="num">${geld(vermoegen(stand, 0))}</b> zu
      <b class="num">${geld(vermoegen(stand, 1))}</b>.
      Es steht <b class="num">${stand.siege[0]} : ${stand.siege[1]}</b>.</p>
    <button class="btn btn--rot" id="nochmal">Noch eine Partie</button>
    <button class="btn btn--leise" id="spaeter">Später</button>`;
  app.appendChild(layer);
  layer.querySelector('#nochmal').onclick = () => {
    if (!tun('partieNeu')) { render(); return; }
    stand = partieNeu(stand);
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
    <p>Beide starten mit ${geld(1500)} auf Los. Abwechselnd wird mit zwei Würfeln gezogen.
      Wo man landet, kauft man — oder zahlt Miete. Nach ${stand ? stand.regeln.runden || '∞' : 40}
      Runden gewinnt, wer mehr besitzt; wer vorher zahlungsunfähig wird, verliert sofort.</p>

    <h3>Kaufen</h3>
    <p>Freie Orte, U-Bahn-Linien und Werke kann man kaufen. Wer nicht will, lässt es
      liegen — <b>versteigert wird nicht</b>, das macht zu zweit keinen Spaß.</p>

    <h3>Miete</h3>
    <p>Auf fremdem Grund wird gezahlt. Gehört jemandem eine ganze Farbgruppe, ist die
      Grundmiete <b>doppelt</b>. U-Bahn-Linien zahlen nach ihrer Anzahl
      (${LINIENMIETE.slice(1).map((m) => geld(m)).join(' · ')}), die Werke das
      ${WERKFAKTOR[1]}-Fache des Wurfs, mit beiden das ${WERKFAKTOR[2]}-Fache.</p>

    <h3>Bauen</h3>
    <p>Nur auf einer <b>vollständigen Farbgruppe</b> und nur gleichmäßig: kein Ort darf
      mehr als ein Haus vor den anderen liegen. Vier Häuser, dann ein Hotel. Abreißen
      bringt die Hälfte zurück.</p>

    <h3>Handeln — wichtiger, als es klingt</h3>
    <p>Zu zweit bekommt man eine Farbgruppe fast nie allein zusammen. Über
      <em>Mein Besitz</em> oder die Feldkarte kann man der Gegenseite einen Ort zum
      Wunschpreis anbieten; sie nimmt an oder lehnt ab. <b>Ohne Handel wird kaum gebaut</b> —
      das ist gemessen, nicht geraten.</p>

    <h3>Geldnot</h3>
    <p>Unbebaute Orte lassen sich <b>beleihen</b>: die Hälfte des Preises sofort, Auslösen
      kostet zehn Prozent Aufschlag. Häuser bringen beim Abreißen die Hälfte. Erst wenn
      auch das nicht mehr reicht, ist die Partie vorbei.</p>

    <h3>Kommissariat</h3>
    <p>Wer auf <em>Ab ins Kommissariat</em> landet, eine entsprechende Karte zieht oder
      dreimal hintereinander einen Pasch würfelt, muss hinein. Heraus kommt man mit einem
      Pasch, einer Freikarte oder ${geld(KAUTION)} — spätestens beim dritten Fehlversuch
      wird die Kaution fällig.</p>

    <h3>Am Handy</h3>
    <p>Jedes Feld lässt sich antippen: dann erscheint seine Karte mit Preisen und
      Mietstufen. Hier ist nichts geheim — an einem Handy liegen lassen und abwechselnd
      tippen, oder jeder nimmt sein eigenes.</p>

    <div class="knopfsaeule"><button class="btn btn--rot" id="zu">Verstanden</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

const RUNDENWAHL = [20, 30, 40, 60, 0];

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

    <div class="feldlabel">Länge der Partie</div>
    <div class="wahlliste">
      ${RUNDENWAHL.map((n) => `
        <button class="wahl ${r.runden === n ? 'wahl--an' : ''}" data-runden="${n}">
          <div class="haupt">
            <div class="oben">${n ? `${n} Runden` : 'Bis zur Pleite'}</div>
            <div class="unten">${n === 20 ? 'kurz — kaum Zeit zum Bauen'
    : n === 30 ? 'flott' : n === 40 ? 'ausgewogen, empfohlen'
      : n === 60 ? 'lang, mit Hotels' : 'kann sehr lange dauern'}</div>
          </div>
          <div class="haken">${r.runden === n ? '✓' : ''}</div>
        </button>`).join('')}
    </div>
    <p style="font-size:13px">Eine Änderung gilt ab der nächsten Partie.</p>

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

  l.querySelectorAll('.wahl').forEach((b) => {
    b.onclick = () => {
      const n = Number(b.dataset.runden);
      ui.overlay = null;
      if (!tun('regel', { runden: n })) { render(); return; }
      stand.regeln = { ...stand.regeln, runden: n };
      nachAenderung();
    };
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = null; ui.codeStatus = ''; render(); };
  l.querySelector('#zweiGeraete')?.addEventListener('click', () => {
    ui.overlay = null;
    ui.kopplung = { schritt: 'rolle', gastgeber: true, code: '', fehler: '' };
    render();
  });
  l.querySelector('#trennen')?.addEventListener('click', () => { ui.overlay = null; kopplungAbbrechen(); });
  l.querySelector('#neuePartie').onclick = () => {
    ui.overlay = null;
    ui.meldung = '';
    if (!tun('partieNeu')) { render(); return; }
    stand = partieNeu(stand);
    nachAenderung();
  };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; render(); };
  l.querySelector('#sichern').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const wie = await seiteAlsDateiSichern('wienerrunde-css', 'wienerrunde-js',
      'WienerRunde.html', 'Wiener Runde');
    ui.codeStatus = SICHER_TEXT[wie].replace('%NAME%', 'WienerRunde.html');
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
    <p>Der Code enthält Namen und Siege — keine laufende Partie.</p>
    <div class="feldlabel">Dieser Stand</div>
    <textarea class="codefeld" id="raus" readonly>${esc(alsCode(stand))}</textarea>
    <button class="btn btn--geist" id="kopieren">Kopieren</button>
    <div class="feldlabel">Anderen Stand übernehmen</div>
    <textarea class="codefeld" id="rein" placeholder="WR1-…"></textarea>
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

  // Ein offenes Angebot geht allem anderen vor.
  if (stand.handel) { renderHandel(); return; }

  if (ui.overlay === 'feld') renderFeldkarte();
  else if (ui.overlay === 'anbieten') renderAnbieten();
  else if (ui.overlay === 'besitz') renderBesitz();
  else if (ui.overlay === 'menue') renderMenue();
  else if (ui.overlay === 'code') renderCode();
  else if (vorbei(stand)) renderJubel();
}

stand = laden();
render();
