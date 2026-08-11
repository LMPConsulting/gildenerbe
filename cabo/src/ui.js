// Cabo — Oberfläche. Ein Handy wandert, die Karten bleiben geheim.

import {
  KRAEFTE, HANDGROESSE, CABO_STRAFE, SPIELENDE_AB,
  kraftVon, neuesSpiel, neueRunde, startKarten, einpraegenFertig,
  ziehen, tauschen, abwerfen, kraftAuslassen, peek, spy, swapEigene, swapFremde,
  aufdeckenSchliessen, caboRufen, handSumme, naechsteRunde, endstand,
  amZug, obenAufAblage,
  PAAR_MINDESTENS, paarStarten, paarWaehlen, paarAbbrechen, paarAufdecken, paarBestaetigen,
  START_ANSEHEN,
} from './engine.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, scannerStarten, scannerMoeglich } from './funk.js';

const KEY = 'cabo.v1';
const app = document.getElementById('app');

let spiel = null;
let ui = {
  overlay: null,
  halter: 0,           // nur im Modus 'lokal': wer das Handy in der Hand hat
  animRunde: 0,
  modus: 'lokal',      // 'lokal' | 'online'
  meinIndex: 0,        // im Modus 'online': welcher Spieler dieses Gerät ist
  funk: null,
  kopplung: null,      // Zustand des Verbindungsaufbaus
};

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const name = (i) => esc(spiel.spieler[i].name);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
  // Auf zwei Geräten führt der Gastgeber Buch; ein halber Stand im Gast wäre wertlos.
  if (ui.modus === 'online') return;
  try { localStorage.setItem(KEY, JSON.stringify(spiel)); } catch { /* privater Modus */ }
}

function laden() {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return null;
    const s = JSON.parse(roh);
    if (s && s.v === 1 && Array.isArray(s.punkte)) return s;
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

/**
 * Speichert die laufende Seite als eigenständige HTML-Datei.
 * In der Claude-App über deren Speichern-Dialog, sonst als Browser-Download.
 */
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

/**
 * Gibt die Spieldatei an das Teilen-Menü des Handys weiter — damit landet sie
 * per Nearby Share, WhatsApp oder Bluetooth direkt auf dem zweiten Gerät.
 * Rückgabe: 'ok' | 'abgelehnt' | 'geht-nicht' | 'dev'
 */
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

/* ------------------------------------------------- Züge ausführen oder senden */

const AKTIONEN = {
  ziehen, tauschen, abwerfen, kraftAuslassen, peek, spy, swapEigene, swapFremde,
  aufdeckenSchliessen, caboRufen, einpraegenFertig, naechsteRunde,
  paarStarten, paarWaehlen, paarAbbrechen, paarAufdecken, paarBestaetigen,
};

/** Der Gastgeber rechnet, der Gast schickt nur seine Absicht hinüber. */
function tun(name, ...args) {
  if (ui.modus === 'online' && ui.meinIndex !== 0) {
    ui.funk?.senden({ typ: 'aktion', name, args });
    return;
  }
  AKTIONEN[name](spiel, ...args);
  if (ui.modus === 'online') standSenden();
  weiter();
}

/**
 * Was der Gast zu sehen bekommt: alle Handkarten und der Nachziehstapel sind
 * wertlos gemacht. Nur was ihm zusteht — seine gezogene Karte, seine
 * Enthüllung, seine Startkarten — kommt im Klartext mit.
 */
function standFuer(s, empfaenger) {
  const k = JSON.parse(JSON.stringify(s));
  if (k.phase === 'auswertung' || k.phase === 'ende') return k;

  const zu = (karte) => ({ id: karte.id, w: null });
  for (const p of k.spieler) p.hand = p.hand.map(zu);
  k.stapel = k.stapel.map(zu);

  if (k.dran !== empfaenger) {
    if (k.gezogene) k.gezogene = zu(k.gezogene);
    if (k.aufdecken) k.aufdecken = { ...k.aufdecken, karte: zu(k.aufdecken.karte) };
  }
  if (k.phase === 'einpraegen' && k.einpraegenIndex === empfaenger) {
    const echt = s.spieler[empfaenger].hand;
    k.spieler[empfaenger].hand = echt.map((c, i) => (
      i >= echt.length - START_ANSEHEN ? { ...c } : zu(c)));
  }
  return k;                                   // aufgedeckte Paare sehen ohnehin alle
}

function standSenden() {
  ui.funk?.senden({ typ: 'stand', spiel: standFuer(spiel, 1) });
}

/** Wessen Blatt zeigt dieses Gerät als „meins“? */
function michSelbst() {
  return ui.modus === 'online' ? ui.meinIndex : spiel.dran;
}

/** Darf an diesem Gerät gerade überhaupt getippt werden? */
function ichBinDran() {
  return ui.modus !== 'online' || spiel.dran === ui.meinIndex;
}

/* ------------------------------------------------------------------ Karten */

function karteHtml(karte, { offen = false, klasse = '', attrs = '', waehlbar = false } = {}) {
  const w = karte ? karte.w : null;
  const art = w != null ? kraftVon(w) : null;
  const tag = waehlbar ? 'button' : 'div';
  const kl = ['karte', offen ? 'karte--offen' : '', waehlbar ? 'karte--waehlbar' : '', klasse]
    .filter(Boolean).join(' ');
  const vorderseite = w != null
    ? `<span class="ecke">${w}</span>${w}${art ? `<span class="kraftzeichen">${KRAEFTE[art].titel}</span>` : ''}`
    : '';
  return `<${tag} class="${kl}"${attrs}${waehlbar ? ' type="button"' : ''}>
    <span class="seite zu"></span><span class="seite auf">${vorderseite}</span>
  </${tag}>`;
}

/* ------------------------------------------------------------------- Start */

function renderStart() {
  app.innerHTML = `
    <div class="screen start">
      <div class="wrap">
        <h1 class="wortmarke">CABO</h1>
        <p class="unterzeile">Vier Karten, keiner weiß welche. Wer am wenigsten hat, gewinnt —
          wenn er sich traut.</p>

        <div class="feldlabel">Wer spielt?</div>
        <div class="feldreihe"><input class="feld" id="n0" maxlength="16" value="Monty" aria-label="Name 1"></div>
        <div class="feldreihe"><input class="feld" id="n1" maxlength="16" value="Christina" aria-label="Name 2"></div>

        <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn--messing" id="los">An einem Handy</button>
          <button class="btn btn--geist" id="zweiGeraete">Auf zwei Handys</button>
          <button class="btn btn--leise" id="regeln">Wie es funktioniert</button>
        </div>
      </div>
    </div>`;

  const namenLesen = () => [0, 1].map((i) => app.querySelector(`#n${i}`).value.trim() || `Spieler ${i + 1}`);

  app.querySelector('#los').onclick = () => {
    ui.modus = 'lokal';
    spielAnlegen(namenLesen());
  };
  app.querySelector('#zweiGeraete').onclick = () => {
    ui.namen = namenLesen();
    ui.kopplung = { schritt: 'rolle' };
    render();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

function spielAnlegen(namen) {
  spiel = neuesSpiel(namen);
  spiel.geber = namen.length - 1;      // damit die erste Person anfängt
  neueRunde(spiel);
  ui.halter = 0;
  ui.animRunde = 0;
  weiter();
}

/* ------------------------------------------------------------- Zwei Geräte */

function kopplungAbbrechen() {
  ui.kopplung?.scannerStoppen?.();
  ui.funk?.schliessen();
  ui.funk = null;
  ui.kopplung = null;
  ui.modus = 'lokal';
  ui.meinIndex = 0;
  render();
}

async function kopplungStarten(rolle) {
  ui.modus = 'online';
  ui.meinIndex = rolle === 'gastgeber' ? 0 : 1;
  ui.kopplung = { schritt: 'moment', rolle, hinweis: '', fehler: '' };
  render();

  ui.funk = funkAufbauen({
    gastgeber: rolle === 'gastgeber',
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

  if (rolle === 'gastgeber') {
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
    if (!ui.kopplung) return;            // war schon verbunden
    if (k.rolle === 'gast') {
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
  if (ui.meinIndex === 0) {
    const namen = ui.namen || ['Gastgeber', 'Gast'];
    spiel = neuesSpiel(namen);
    spiel.geber = namen.length - 1;
    neueRunde(spiel);
    ui.animRunde = 0;
    standSenden();
  }
  render();
}

function nachrichtVerarbeiten(m) {
  if (m.typ === 'stand' && ui.meinIndex !== 0) {
    spiel = m.spiel;
    render();
    return;
  }
  if (m.typ === 'aktion' && ui.meinIndex === 0 && spiel) {
    const erlaubt = amZug(spiel) === 1 || spiel.phase === 'auswertung';
    if (!erlaubt || !AKTIONEN[m.name]) return;
    AKTIONEN[m.name](spiel, ...(m.args || []));
    standSenden();
    render();
  }
}

function renderKopplung() {
  const k = ui.kopplung;
  const gastgeber = k.rolle === 'gastgeber';

  if (k.schritt === 'rolle') {
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>Auf zwei Handys</h2>
        <p>Beide Geräte müssen im <strong>selben WLAN oder Hotspot</strong> sein. Zum Koppeln
           zeigt ihr euch gegenseitig einen QR-Code — danach läuft alles direkt zwischen den
           Handys, ganz ohne Internet.</p>
        <div class="wahlreihe" style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn--messing" id="alsGastgeber">Dieses Handy teilt aus</button>
          <button class="btn btn--geist" id="alsGast">Dieses Handy macht mit</button>
          <button class="btn btn--leise" id="zurueck">Doch an einem Handy</button>
        </div>
        <p class="hinweiszeile" style="margin-top:20px">Wer austeilt, führt Buch. Fangt beide
           gleichzeitig an — einer tippt oben, der andere unten.</p>
      </div></div></div>`;
    app.querySelector('#alsGastgeber').onclick = () => kopplungStarten('gastgeber');
    app.querySelector('#alsGast').onclick = () => kopplungStarten('gast');
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
      <div class="hinweis" style="margin-top:16px">Dauert es länger als ein paar Sekunden,
        blockiert der Hotspot vermutlich die direkte Verbindung. Dann hilft nur: beide ins
        gleiche WLAN, oder doch an einem Handy spielen.</div>
      <div style="margin-top:20px"><button class="btn btn--geist" id="abbruch">Abbrechen</button></div>
    </div></div></div>`;
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'zeigen') {
    const weiterText = gastgeber ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung';
    app.innerHTML = `
      <div class="screen"><div class="scroll"><div class="blatt">
        <h2>${gastgeber ? 'Zeig diesen Code' : 'Jetzt du zurück'}</h2>
        <p>${gastgeber
          ? 'Die andere Person scannt ihn mit „Dieses Handy macht mit“.'
          : 'Halt den Code dem Gastgeber hin — er scannt ihn.'}</p>
        <div class="qrfeld"><canvas id="qr" width="720" height="720"></canvas></div>
        <details class="codeklappe">
          <summary>Kamera streikt? Code als Text</summary>
          <textarea class="codefeld" id="raus" readonly>${esc(k.code || '')}</textarea>
          <button class="btn btn--geist" id="kopieren" style="margin-top:8px">Kopieren</button>
        </details>
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn--messing" id="weiterKoppeln">${weiterText}</button>
          <button class="btn btn--leise" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;

    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#f6f2e7', dunkel: '#16211e' });
    } catch {
      app.querySelector('.qrfeld').textContent = 'Code zu lang für einen QR — nimm den Textcode.';
    }
    app.querySelector('#kopieren').onclick = async (e) => {
      try { await navigator.clipboard.writeText(k.code); e.currentTarget.textContent = 'Kopiert'; }
      catch { app.querySelector('#raus').select(); }
    };
    app.querySelector('#weiterKoppeln').onclick = () => {
      ui.kopplung.schritt = gastgeber ? 'scannen' : 'warten';
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
      <p>${gastgeber ? 'Halte die Kamera auf den Code des Gasts.' : 'Halte die Kamera auf den Code des Gastgebers.'}</p>
      <div class="scanfenster"><video id="kamera" muted playsinline></video></div>
      ${k.fehler ? `<div class="hinweis" style="border-color:#4b2b28;color:#f0a79d">${esc(k.fehler)}</div>` : ''}
      <details class="codeklappe" ${scannerMoeglich() ? '' : 'open'}>
        <summary>Kamera streikt? Code eintippen oder einfügen</summary>
        <textarea class="codefeld" id="rein" placeholder="CB1O|…"></textarea>
        <button class="btn btn--geist" id="uebernehmen" style="margin-top:8px">Code übernehmen</button>
      </details>
      <div style="margin-top:20px"><button class="btn btn--leise" id="abbruch">Abbrechen</button></div>
    </div></div></div>`;

  app.querySelector('#uebernehmen').onclick = () => {
    const code = app.querySelector('#rein').value.trim();
    if (code) fremdenCodeAnnehmen(code);
  };
  app.querySelector('#abbruch').onclick = kopplungAbbrechen;

  // Nur einmal versuchen: ein fehlgeschlagener Start rendert neu und würde sich
  // sonst selbst wieder aufrufen.
  if (!k.scannerVersucht) {
    k.scannerVersucht = true;
    scannerStarten(
      app.querySelector('#kamera'),
      (code) => { k.scannerStoppen = null; fremdenCodeAnnehmen(code); },
      (fehler) => { k.fehler = fehler.message; render(); },
    ).then((stoppen) => { if (ui.kopplung === k) k.scannerStoppen = stoppen; else stoppen(); });
  }
}

/* ------------------------------------------------------------------- Tisch */

/** Darf diese Karte gerade angetippt werden? */
function waehlbar(besitzer, index) {
  if (spiel.aufdecken) return false;
  if (!ichBinDran()) return false;
  const ich = spiel.dran;
  if (spiel.phase === 'gezogen') return besitzer === ich;
  if (spiel.phase === 'paar') return besitzer === ich && !spiel.paar.ergebnis;
  if (spiel.phase === 'paar') {
    const n = spiel.paar.gewaehlt.length;
    return n < PAAR_MINDESTENS
      ? `Tippe die Karten an, von denen du glaubst, dass sie <b>gleich</b> sind. Mindestens ${PAAR_MINDESTENS}.`
      : `<b>${n} Karten</b> gewählt. Aufdecken sehen alle — auch wenn du danebenliegst.`;
  }
  if (spiel.phase === 'kraft') {
    const art = spiel.kraft?.art;
    if (art === 'peek') return besitzer === ich;
    if (art === 'spy') return besitzer !== ich;
    if (art === 'swap') return besitzer === ich || spiel.kraft.eigene !== null;
    return false;
  }
  return false;
}

function handHtml(p, klein) {
  const frisch = ui.animRunde !== spiel.runde ? ' austeilen' : '';
  return spiel.spieler[p].hand.map((k, i) => {
    const w = waehlbar(p, i);
    const markiert = p === spiel.dran && (
      (spiel.phase === 'kraft' && spiel.kraft?.art === 'swap' && spiel.kraft.eigene === i)
      || (spiel.phase === 'paar' && spiel.paar.gewaehlt.includes(i)));
    return karteHtml(k, {
      klasse: `${klein ? 'karte--klein' : ''}${markiert ? ' karte--markiert' : ''}${frisch}`,
      waehlbar: w,
      attrs: w ? ` data-p="${p}" data-i="${i}"` : '',
    });
  }).join('');
}

function renderTisch() {
  const ich = michSelbst();
  const gegner = spiel.spieler.map((_, i) => i).filter((i) => i !== ich);
  const oben = obenAufAblage(spiel);
  const ziehbar = spiel.phase === 'zug';

  const gegnerHtml = gegner.map((p) => `
    <div class="gegnerblock">
      <div class="wer"><b>${name(p)}</b> · ${spiel.punkte[p]}</div>
      <div class="hand">${handHtml(p, true)}</div>
    </div>`).join('');

  app.innerHTML = `
    <div class="screen">
      <header class="kopf">
        <div class="titel">
          <div class="ober">Runde ${spiel.runde} · bis ${SPIELENDE_AB}${
            ui.modus === 'online' ? ' · zwei Geräte' : ''}</div>
          <h1>${name(spiel.dran)} ist dran</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="btnRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="btnMenue" aria-label="Menü">⋯</button>
        </div>
      </header>

      <div class="tisch">
        <div class="gegner">${gegnerHtml}</div>

        <div class="mitte">
          <div class="platz">
            <div class="stapelhaufen">
              ${karteHtml(null, {
                waehlbar: ziehbar && spiel.stapel.length > 0,
                attrs: ' data-zug="stapel"',
                klasse: spiel.stapel.length ? '' : 'karte--leer',
              })}
            </div>
            <div class="lbl">Stapel · ${spiel.stapel.length}</div>
          </div>

          <div class="platz">
            ${oben
              ? karteHtml(oben, { offen: true, waehlbar: ziehbar, attrs: ' data-zug="ablage"' })
              : karteHtml(null, { klasse: 'karte--leer' })}
            <div class="lbl">Ablage</div>
          </div>

          ${spiel.gezogene ? `<div class="platz">
            ${karteHtml(spiel.gezogene, { offen: true })}
            <div class="lbl" style="color:var(--messing)">Gezogen</div>
          </div>` : ''}
        </div>

        ${spiel.caboVon !== null
          ? `<div class="cabobanner">Cabo von ${name(spiel.caboVon)} — letzte Züge</div>`
          : ''}

        <div class="eigene">
          <div class="wer">${name(ich)} · ${spiel.punkte[ich]} Punkte</div>
          <div class="hand">${handHtml(ich, false)}</div>
        </div>
      </div>

      <div class="fuss">
        <p class="ansage">${ansage()}</p>
        ${knoepfe()}
      </div>
    </div>`;

  ui.animRunde = spiel.runde;

  app.querySelector('#btnRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#btnMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelectorAll('[data-zug]').forEach((b) => {
    b.onclick = () => { tun('ziehen', b.dataset.zug); buzz(10); };
  });
  app.querySelectorAll('[data-p]').forEach((b) => {
    b.onclick = () => karteGetippt(Number(b.dataset.p), Number(b.dataset.i));
  });
  app.querySelector('#btnCabo')?.addEventListener('click', () => {
    if (!confirm('Cabo rufen? Alle anderen bekommen noch genau einen Zug.')) return;
    tun('caboRufen');
    buzz([20, 50, 30]);
  });
  app.querySelector('#btnAbwerfen')?.addEventListener('click', () => { tun('abwerfen'); buzz(10); });
  app.querySelector('#btnKraftAus')?.addEventListener('click', () => { tun('kraftAuslassen'); });
  app.querySelector('#btnPaar')?.addEventListener('click', () => { tun('paarStarten'); buzz(8); });
  app.querySelector('#btnPaarAb')?.addEventListener('click', () => { tun('paarAbbrechen'); });
  app.querySelector('#btnPaarAuf')?.addEventListener('click', () => { tun('paarAufdecken'); buzz(18); });
}

function karteGetippt(p, i) {
  buzz(10);
  if (spiel.phase === 'gezogen') return tun('tauschen', i);
  if (spiel.phase === 'paar') return tun('paarWaehlen', i);
  if (spiel.phase !== 'kraft' || !spiel.kraft || spiel.kraft.erledigt) return undefined;
  const art = spiel.kraft.art;
  if (art === 'peek') return tun('peek', i);
  if (art === 'spy') return tun('spy', p, i);
  if (art === 'swap') return p === spiel.dran ? tun('swapEigene', i) : tun('swapFremde', p, i);
  return undefined;
}

function ansage() {
  if (spiel.phase === 'einpraegen') {
    return `<b>${name(spiel.einpraegenIndex)}</b> prägt sich gerade zwei Karten ein.`;
  }
  if (!ichBinDran()) return `<b>${name(spiel.dran)}</b> ist am Zug. Schau zu.`;
  if (spiel.phase === 'zug') {
    return 'Zieh vom <b>Stapel</b> oder nimm die <b>Ablage</b>.';
  }
  if (spiel.phase === 'gezogen') {
    const art = kraftVon(spiel.gezogene.w);
    if (spiel.quelle === 'ablage') return 'Tippe die eigene Karte an, die du dafür hergibst.';
    return art
      ? `Tauschen: eigene Karte antippen. Oder abwerfen und <span class="kraftname">${KRAEFTE[art].titel}</span> nutzen.`
      : 'Tauschen: eigene Karte antippen. Oder einfach abwerfen.';
  }
  if (spiel.phase === 'paar') {
    const n = spiel.paar.gewaehlt.length;
    return n < PAAR_MINDESTENS
      ? `Tippe die Karten an, von denen du glaubst, dass sie <b>gleich</b> sind. Mindestens ${PAAR_MINDESTENS}.`
      : `<b>${n} Karten</b> gewählt. Aufdecken sehen alle — auch wenn du danebenliegst.`;
  }
  if (spiel.phase === 'kraft') {
    const art = spiel.kraft?.art;
    if (!art || spiel.kraft.erledigt) return 'Merk es dir — dann geht es weiter.';
    if (art === 'swap' && spiel.kraft.eigene === null) {
      return `<span class="kraftname">Swap</span> — erst eine <b>eigene</b> Karte wählen.`;
    }
    if (art === 'swap') return `<span class="kraftname">Swap</span> — jetzt die fremde Karte antippen. Blind.`;
    return `<span class="kraftname">${KRAEFTE[art].titel}</span> — ${KRAEFTE[art].text}`;
  }
  return '';
}

function knoepfe() {
  if (!ichBinDran()) return '';
  if (spiel.phase === 'zug') {
    return `<button class="btn btn--geist" id="btnCabo">Cabo rufen</button>`;
  }
  if (spiel.phase === 'gezogen') {
    const paarKnopf = spiel.spieler[spiel.dran].hand.length >= PAAR_MINDESTENS
      ? `<button class="btn btn--geist" id="btnPaar">Gleiche Karten abwerfen</button>` : '';
    if (spiel.quelle !== 'stapel') return paarKnopf;
    const art = kraftVon(spiel.gezogene.w);
    return `<button class="btn ${art ? 'btn--messing' : 'btn--geist'}" id="btnAbwerfen">
      ${art ? `Abwerfen und ${KRAEFTE[art].titel} nutzen` : 'Abwerfen'}</button>${paarKnopf}`;
  }
  if (spiel.phase === 'paar') {
    const genug = spiel.paar.gewaehlt.length >= PAAR_MINDESTENS;
    return `<div class="reihe">
      <button class="btn btn--geist" id="btnPaarAb">Doch nicht</button>
      <button class="btn btn--messing" id="btnPaarAuf" ${genug ? '' : 'disabled'}>
        Aufdecken${genug ? ` (${spiel.paar.gewaehlt.length})` : ''}</button>
    </div>`;
  }
  if (spiel.phase === 'kraft' && spiel.kraft && !spiel.kraft.erledigt) {
    return `<button class="btn btn--geist" id="btnKraftAus">Kraft auslassen</button>`;
  }
  return '';
}

/* --------------------------------------------------------- Aufdeck-Momente */

function renderEinpraegen() {
  const wer = spiel.einpraegenIndex;
  const karten = startKarten(spiel, wer);
  const layer = document.createElement('div');
  layer.className = 'merken';
  layer.innerHTML = `
    <div class="lbl">${name(wer)} — einprägen</div>
    <div class="karten">
      ${karten.map((k) => karteHtml(k.karte, { offen: true, klasse: 'karte--gross' })).join('')}
    </div>
    <p class="hinweis">Deine beiden unteren Karten. Merk sie dir — danach sind sie wieder zu.</p>
    <button class="btn btn--messing" id="ok">Gemerkt</button>`;
  app.appendChild(layer);
  layer.querySelector('#ok').onclick = () => { buzz(10); tun('einpraegenFertig'); };
}

function renderPaarErgebnis() {
  const e = spiel.paar.ergebnis;
  const layer = document.createElement('div');
  layer.className = 'merken';
  layer.innerHTML = `
    <div class="lbl">Alle schauen mit</div>
    <div class="karten">
      ${e.karten.map((k) => karteHtml(k, { offen: true, klasse: 'karte--gross' })).join('')}
    </div>
    <p class="hinweis" style="color:${e.stimmt ? 'var(--gut)' : 'var(--schlecht)'};font-weight:650">
      ${e.stimmt
        ? `${e.karten.length}× die ${e.karten[0].w} — die Karten sind weg, deine Hand wird kleiner.`
        : 'Nicht alle gleich. Die Karten bleiben liegen, dein Zug ist futsch.'}
    </p>
    <p class="hinweis">${e.stimmt
      ? 'Die gezogene Karte rückt auf den ersten frei gewordenen Platz.'
      : 'Und jetzt weiß auch die Gegenseite, was da liegt.'}</p>
    <button class="btn btn--messing" id="ok">Weiter</button>`;
  app.appendChild(layer);
  layer.querySelector('#ok').onclick = () => {
    buzz(e.stimmt ? [20, 40, 20] : 60);
    tun('paarBestaetigen');
  };
}

function renderAufdecken() {
  const a = spiel.aufdecken;
  const layer = document.createElement('div');
  layer.className = 'merken';
  layer.innerHTML = `
    <div class="lbl">${esc(a.text)}</div>
    <div class="karten">${karteHtml(a.karte, { offen: true, klasse: 'karte--gross' })}</div>
    <p class="hinweis">Position ${a.index + 1} von ${HANDGROESSE}. Nur du siehst das.</p>
    <button class="btn btn--messing" id="ok">Gemerkt</button>`;
  app.appendChild(layer);
  layer.querySelector('#ok').onclick = () => { tun('aufdeckenSchliessen'); };
}

/* --------------------------------------------------------------- Übergabe */

function renderUebergabe(wer) {
  const auftrag = spiel.phase === 'einpraegen'
    ? 'Sieh dir deine beiden unteren Karten an.'
    : spiel.caboVon !== null
      ? 'Dein letzter Zug — danach wird aufgedeckt.'
      : 'Du bist am Zug.';
  const layer = document.createElement('div');
  layer.className = 'overlay uebergabe';
  layer.innerHTML = `
    <div class="pfeil" aria-hidden="true">📱</div>
    <div class="lbl">Handy weitergeben an</div>
    <div class="name">${name(wer)}</div>
    <p class="auftrag">${auftrag}</p>
    <button class="btn btn--messing" id="bereit">Ich hab's</button>`;
  app.appendChild(layer);
  layer.querySelector('#bereit').onclick = () => { ui.halter = wer; render(); };
}

/* -------------------------------------------------------------- Auswertung */

function bilanzZeilen() {
  return spiel.auswertung.zeilen.map((z) => {
    const klasse = z.punkte === 0 ? 'pkt--null' : z.punkte >= 15 ? 'pkt--viel' : 'pkt--mittel';
    const karten = spiel.spieler[z.p].hand.map((k) => `<span class="mini">${k.w}</span>`).join('');
    return `<div class="rundenzeile ${z.punkte === 0 ? 'gewinner' : ''}">
      <span class="wer"><b>${name(z.p)}${spiel.auswertung.caboVon === z.p ? ' · Cabo' : ''}</b>
        <small>${esc(z.text)} · Summe ${z.summe}</small></span>
      <span class="karten">${karten}</span>
      <span class="pkt ${klasse}">+${z.punkte}</span>
    </div>`;
  }).join('');
}

function renderRundenende() {
  const a = spiel.auswertung;
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `
    <div class="scroll"><div class="blatt">
      <h2>Runde ${spiel.runde}</h2>
      <p>${a.caboVon === null
        ? 'Runde beendet.'
        : a.caboGeglueckt
          ? `<strong>${name(a.caboVon)}</strong> hat Cabo gerufen und lag richtig.`
          : `<strong>${name(a.caboVon)}</strong> hat Cabo gerufen und danebengelegen — ${CABO_STRAFE} Punkte obendrauf.`}</p>

      <div style="margin-top:16px">${bilanzZeilen()}</div>

      <div class="feldlabel">Gesamt</div>
      ${spiel.spieler.map((p, i) => `<div class="rundenzeile">
        <span class="wer"><b>${name(i)}</b></span>
        <span class="pkt pkt--mittel">${spiel.punkte[i]}</span>
      </div>`).join('')}

      <div style="margin-top:22px">
        <button class="btn btn--messing" id="weiterRunde">Nächste Runde</button>
      </div>
    </div></div>`;
  app.appendChild(layer);
  layer.querySelector('#weiterRunde').onclick = () => {
    ui.halter = -1;               // erzwingt im lokalen Spiel die Übergabe
    tun('naechsteRunde');
  };
}

function renderEnde() {
  const tabelle = endstand(spiel);
  const bester = tabelle[0].punkte;
  const sieger = tabelle.filter((z) => z.punkte === bester);

  app.innerHTML = `
    <div class="screen"><div class="scroll"><div class="blatt">
      <div style="text-align:center;padding:14px 0 20px">
        <div class="lbl" style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--nebel-dim);font-weight:700">
          ${sieger.length > 1 ? 'Unentschieden' : 'Gewonnen hat'}</div>
        <div style="font-size:clamp(28px,8vw,40px);font-weight:700;color:var(--karton);line-height:1.15">
          ${sieger.map((s) => esc(s.name)).join(' & ')}</div>
        <div class="num" style="color:var(--nebel)">${bester} Punkte — am wenigsten gewinnt</div>
      </div>

      ${tabelle.map((z, rang) => `<div class="rundenzeile ${rang === 0 ? 'gewinner' : ''}">
        <span class="wer"><b>${esc(z.name)}</b><small>Platz ${rang + 1}</small></span>
        <span class="pkt ${rang === 0 ? 'pkt--null' : 'pkt--mittel'}">${z.punkte}</span>
      </div>`).join('')}

      <p class="hinweiszeile" style="margin-top:16px">
        Nach ${spiel.runde} Runden — jemand hat ${SPIELENDE_AB} Punkte erreicht.</p>

      <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn--messing" id="nochmal">Nochmal spielen</button>
        <button class="btn btn--geist" id="zumStart">Zum Start</button>
      </div>
    </div></div></div>`;

  app.querySelector('#nochmal').onclick = () => {
    const namen = spiel.spieler.map((p) => p.name);
    if (ui.modus === 'online') {
      if (ui.meinIndex !== 0) return;          // der Gastgeber teilt neu aus
      spiel = neuesSpiel(namen);
      spiel.geber = namen.length - 1;
      neueRunde(spiel);
      ui.animRunde = 0;
      standSenden();
      render();
      return;
    }
    spielAnlegen(namen);
  };
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
  const kraftliste = Object.values(KRAEFTE).map((k) => `
    <div class="kraftzeile">
      <span class="werte">${k.werte.join(' · ')}</span>
      <span><b>${k.titel}</b><small>${k.text}</small></span>
    </div>`).join('');

  const l = huelle(`
    <div class="lesbar">
      <h2>Cabo — so geht's</h2>
      <p>Jeder hat <strong>vier Karten</strong>, alle verdeckt. Am Anfang darfst du dir
         <strong>zwei davon</strong> ansehen — danach musst du dich erinnern. Wer am Ende die
         <strong>niedrigste Summe</strong> hat, gewinnt die Runde.</p>

      <h3>Die Karten</h3>
      <p>52 Stück: die <strong>0</strong> und die <strong>13</strong> je zweimal, alle Werte von
         1 bis 12 je viermal. Der Wert ist gleichzeitig der Punktwert — <strong>wenig ist gut</strong>.</p>

      <h3>Dein Zug</h3>
      <ul>
        <li><strong>Vom Stapel ziehen:</strong> Du siehst die Karte. Entweder tauschst du sie
            gegen eine deiner vier (die alte kommt offen auf die Ablage), oder du wirfst sie ab.</li>
        <li><strong>Von der Ablage nehmen:</strong> Nur tauschen — keine Kraft.</li>
        <li>Eine abgeworfene <strong>7 bis 12</strong> darfst du als Kraft nutzen.</li>
      </ul>

      <h3>Die Kräfte</h3>
      <div class="kraftliste">${kraftliste}</div>
      <p>Nutzen ist freiwillig. Beim <strong>Swap</strong> siehst du keine der beiden Karten —
         du tauschst blind.</p>

      <h3>Gleiche Karten abwerfen</h3>
      <p>Wenn du glaubst, <strong>mehrere gleiche Werte</strong> auf der Hand zu haben: nach dem
         Ziehen antippen und aufdecken. Alle sehen die Karten — so oder so.</p>
      <ul>
        <li><strong>Richtig geraten:</strong> Die Karten wandern auf die Ablage, die gezogene
            Karte rückt auf den ersten frei gewordenen Platz. Deine Hand wird
            <strong>kleiner</strong> — und damit deine Summe.</li>
        <li><strong>Danebengelegen:</strong> Alles bleibt liegen, die gezogene Karte kommt auf
            die Ablage, dein Zug ist verloren. Und die Gegenseite weiß jetzt Bescheid.</li>
      </ul>

      <h3>Cabo rufen</h3>
      <p>Statt zu ziehen, kannst du <strong>Cabo</strong> rufen. Alle anderen bekommen noch
         <strong>genau einen Zug</strong>, dann wird aufgedeckt.</p>
      <ul>
        <li>Hast du wirklich die niedrigste Summe: <strong>0 Punkte</strong> für dich.
            Bei Gleichstand gewinnst du.</li>
        <li>Lagst du daneben: deine Summe <strong>plus ${CABO_STRAFE} Strafpunkte</strong>.</li>
        <li>Alle anderen bekommen ihre Kartensumme als Punkte.</li>
      </ul>

      <h3>Spielende</h3>
      <p>Sobald jemand <strong>${SPIELENDE_AB} Punkte</strong> erreicht, ist Schluss — es gewinnt,
         wer am <strong>wenigsten</strong> hat. Landet man genau auf ${SPIELENDE_AB}, geht es
         zurück auf ${SPIELENDE_AB / 2}.</p>

      <h3>An einem Handy</h3>
      <p>Das Handy wandert reihum. Alles, was nur du sehen darfst — die Startkarten, Peek und
         Spy — kommt als Vollbild und verschwindet danach wieder. Die App merkt sich nichts
         für dich: <strong>erinnern musst du dich selbst</strong>.</p>

      <div style="margin-top:24px"><button class="btn btn--messing" id="zu">Verstanden</button></div>
    </div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const l = huelle(`
    <h2>Menü</h2>
    <div style="margin-top:18px;display:flex;flex-direction:column;gap:9px">
      <button class="btn btn--geist" id="regeln">Regeln</button>
      <button class="btn btn--geist" id="datei">Spiel als Datei sichern</button>
      <button class="btn btn--messing" id="weitergeben">Aufs zweite Handy schicken</button>
      <button class="btn btn--warn" id="abbruch">Spiel abbrechen</button>
      <button class="btn btn--messing" id="zu">Weiterspielen</button>
    </div>
    <p class="hinweiszeile" style="margin-top:22px">
      Der Spielstand liegt auf diesem Gerät — die App darf zwischendurch zugehen.</p>`);

  l.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
  l.querySelector('#weitergeben').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Teilen-Menü …';
    const erg = await spielTeilen('cabo-css', 'cabo-js', 'Cabo.html', 'Cabo');
    knopf.textContent = TEILEN_TEXT[erg];
    knopf.disabled = erg === 'ok';
  };
  l.querySelector('#datei').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Wird gespeichert …';
    const erg = await seiteAlsDateiSichern('cabo-css', 'cabo-js', 'Cabo.html', 'Cabo');
    knopf.textContent = SICHER_TEXT[erg].replace('%NAME%', 'Cabo.html');
    knopf.disabled = erg === 'ok' || erg === 'txt';
  };
  l.querySelector('#abbruch').onclick = () => {
    if (!confirm('Laufendes Spiel verwerfen?')) return;
    spiel = null;
    ui.overlay = null;
    try { localStorage.removeItem(KEY); } catch { /* egal */ }
    render();
  };
}

/* ----------------------------------------------------------------- Render */

function render() {
  if (ui.kopplung) { renderKopplung(); return; }
  if (!spiel && ui.modus === 'online') {
    app.innerHTML = `<div class="screen"><div class="scroll"><div class="blatt">
      <h2>Verbunden</h2><p>Warte auf die Karten vom Gastgeber …</p></div></div></div>`;
    return;
  }
  if (!spiel) { renderStart(); return; }
  if (spiel.phase === 'ende') { renderEnde(); return; }

  renderTisch();

  if (ui.overlay === 'regeln') { renderRegeln(); return; }
  if (ui.overlay === 'menue') { renderMenue(); return; }
  if (spiel.phase === 'auswertung') { renderRundenende(); return; }

  const wer = amZug(spiel);
  if (ui.modus === 'lokal' && wer !== null && wer !== ui.halter) { renderUebergabe(wer); return; }

  // Das aufgedeckte Paar sehen beide, alles andere nur das betroffene Gerät.
  if (spiel.phase === 'paar' && spiel.paar.ergebnis) { renderPaarErgebnis(); return; }
  if (spiel.aufdecken && spiel.dran === michSelbst()) { renderAufdecken(); return; }
  if (spiel.phase === 'einpraegen' && spiel.einpraegenIndex === michSelbst()) {
    renderEinpraegen();
  }
}

spiel = laden();
if (spiel) {
  const wer = amZug(spiel);
  ui.halter = wer === null ? 0 : wer;
}
render();
