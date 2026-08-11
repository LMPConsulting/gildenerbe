// Cabo — Oberfläche. Ein Handy wandert, die Karten bleiben geheim.

import {
  KRAEFTE, HANDGROESSE, CABO_STRAFE, SPIELENDE_AB,
  kraftVon, neuesSpiel, neueRunde, startKarten, einpraegenFertig,
  ziehen, tauschen, abwerfen, kraftAuslassen, peek, spy, swapEigene, swapFremde,
  aufdeckenSchliessen, caboRufen, handSumme, naechsteRunde, endstand,
  amZug, obenAufAblage,
} from './engine.js';

const KEY = 'cabo.v1';
const app = document.getElementById('app');

let spiel = null;
let ui = { overlay: null, halter: 0, animRunde: 0 };

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const name = (i) => esc(spiel.spieler[i].name);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

function sichern() {
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

const SICHER_TEXT = {
  ok: 'Gesichert — liegt in deinen Downloads',
  txt: 'Als .txt gesichert — bitte in %NAME% umbenennen',
  abgelehnt: 'Abgebrochen — nichts gespeichert',
  dev: 'Geht nur in der fertigen Version',
};

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
          <button class="btn btn--messing" id="los">Austeilen</button>
          <button class="btn btn--leise" id="regeln">Wie es funktioniert</button>
        </div>
      </div>
    </div>`;

  app.querySelector('#los').onclick = () => {
    const namen = [0, 1].map((i) => app.querySelector(`#n${i}`).value.trim() || `Spieler ${i + 1}`);
    spiel = neuesSpiel(namen);
    spiel.geber = namen.length - 1;      // damit die erste Person anfängt
    neueRunde(spiel);
    ui.halter = 0;
    ui.animRunde = 0;
    weiter();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* ------------------------------------------------------------------- Tisch */

/** Darf diese Karte gerade angetippt werden? */
function waehlbar(besitzer, index) {
  if (spiel.aufdecken) return false;
  const ich = spiel.dran;
  if (spiel.phase === 'gezogen') return besitzer === ich;
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
    const markiert = spiel.phase === 'kraft' && spiel.kraft?.art === 'swap'
      && spiel.kraft.eigene === i && p === spiel.dran;
    return karteHtml(k, {
      klasse: `${klein ? 'karte--klein' : ''}${markiert ? ' karte--markiert' : ''}${frisch}`,
      waehlbar: w,
      attrs: w ? ` data-p="${p}" data-i="${i}"` : '',
    });
  }).join('');
}

function renderTisch() {
  const ich = spiel.dran;
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
          <div class="ober">Runde ${spiel.runde} · bis ${SPIELENDE_AB}</div>
          <h1>${name(ich)} ist dran</h1>
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
    b.onclick = () => { ziehen(spiel, b.dataset.zug); buzz(10); weiter(); };
  });
  app.querySelectorAll('[data-p]').forEach((b) => {
    b.onclick = () => karteGetippt(Number(b.dataset.p), Number(b.dataset.i));
  });
  app.querySelector('#btnCabo')?.addEventListener('click', () => {
    if (!confirm('Cabo rufen? Alle anderen bekommen noch genau einen Zug.')) return;
    caboRufen(spiel);
    buzz([20, 50, 30]);
    weiter();
  });
  app.querySelector('#btnAbwerfen')?.addEventListener('click', () => { abwerfen(spiel); buzz(10); weiter(); });
  app.querySelector('#btnKraftAus')?.addEventListener('click', () => { kraftAuslassen(spiel); weiter(); });
}

function karteGetippt(p, i) {
  if (spiel.phase === 'gezogen') { tauschen(spiel, i); buzz(12); return weiter(); }
  if (spiel.phase !== 'kraft' || !spiel.kraft || spiel.kraft.erledigt) return;
  const art = spiel.kraft.art;
  if (art === 'peek') peek(spiel, i);
  else if (art === 'spy') spy(spiel, p, i);
  else if (art === 'swap') {
    if (p === spiel.dran) swapEigene(spiel, i);
    else swapFremde(spiel, p, i);
  }
  buzz(10);
  weiter();
}

function ansage() {
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
  if (spiel.phase === 'zug') {
    return `<button class="btn btn--geist" id="btnCabo">Cabo rufen</button>`;
  }
  if (spiel.phase === 'gezogen' && spiel.quelle === 'stapel') {
    const art = kraftVon(spiel.gezogene.w);
    return `<button class="btn ${art ? 'btn--messing' : 'btn--geist'}" id="btnAbwerfen">
      ${art ? `Abwerfen und ${KRAEFTE[art].titel} nutzen` : 'Abwerfen'}</button>`;
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
  layer.querySelector('#ok').onclick = () => { einpraegenFertig(spiel); buzz(10); weiter(); };
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
  layer.querySelector('#ok').onclick = () => { aufdeckenSchliessen(spiel); weiter(); };
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
    naechsteRunde(spiel);
    ui.halter = -1;               // erzwingt die Übergabe an die erste Person
    weiter();
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
    spiel = neuesSpiel(namen);
    spiel.geber = namen.length - 1;
    neueRunde(spiel);
    ui.halter = 0;
    ui.animRunde = 0;
    weiter();
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
      <button class="btn btn--warn" id="abbruch">Spiel abbrechen</button>
      <button class="btn btn--messing" id="zu">Weiterspielen</button>
    </div>
    <p class="hinweiszeile" style="margin-top:22px">
      Der Spielstand liegt auf diesem Gerät — die App darf zwischendurch zugehen.</p>`);

  l.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
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
  if (!spiel) { renderStart(); return; }
  if (spiel.phase === 'ende') { renderEnde(); return; }

  renderTisch();

  if (ui.overlay === 'regeln') { renderRegeln(); return; }
  if (ui.overlay === 'menue') { renderMenue(); return; }
  if (spiel.phase === 'auswertung') { renderRundenende(); return; }

  const wer = amZug(spiel);
  if (wer !== null && wer !== ui.halter) { renderUebergabe(wer); return; }

  if (spiel.aufdecken) { renderAufdecken(); return; }
  if (spiel.phase === 'einpraegen') { renderEinpraegen(); return; }
}

spiel = laden();
if (spiel) {
  const wer = amZug(spiel);
  ui.halter = wer === null ? 0 : wer;
}
render();
