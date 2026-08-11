// Dreikampf — Oberfläche. Ein Handy, zwei Leute, ein Punktekonto für den ganzen Urlaub.

import {
  TYPEN, TYP_INFO, PUNKTE, ORTE, STAPEL,
  neuerStand, neueRunde, schritt, antworten, bewerten, weiter,
  ergebnis, rundeAbschliessen, rundeAbbrechen,
  fuehrung, stapelRest, alsCode, ausCode,
} from './engine.js';

const KEY = 'dreikampf.v1';
const app = document.getElementById('app');

let stand = null;
let ui = { screen: 'start', overlay: null, wahl: null, halter: 0, codeStatus: '' };

/* ------------------------------------------------------------------ Hilfen */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const andere = (i) => (i === 0 ? 1 : 0);
const name = (i) => esc(stand.spieler[i].name);
const vz = (n) => (n > 0 ? `+${n}` : `${n}`);
const pktKlasse = (n) => (n > 0 ? 'pkt--plus' : n < 0 ? 'pkt--minus' : 'pkt--null');

function sichern() {
  try { localStorage.setItem(KEY, JSON.stringify(stand)); } catch { /* privater Modus */ }
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

const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

/** Wer muss das Handy in der Hand haben? null = beide dürfen schauen. */
function braucht() {
  const s = schritt(stand);
  if (!s) return null;
  if (s.art === 'antwort') return s.p;     // verdeckt — nur diese Person darf sehen
  return null;
}

function nachAenderung() {
  sichern();
  render();
}

/**
 * Speichert die laufende Seite als eigenständige HTML-Datei. Zuverlässigster Weg,
 * das Spiel offline aufs Handy zu bekommen: einmal im Browser öffnen, hier tippen —
 * und es landet als echter Download im Downloads-Ordner.
 * Gibt false zurück, wenn die Seite aus lose geladenen Modulen besteht (Dev-Modus).
 */
function seiteAlsDateiSichern(cssId, jsId, dateiname, ersatzTitel) {
  const css = document.getElementById(cssId)?.textContent || '';
  const js = document.getElementById(jsId)?.textContent || '';
  if (!css || !js) return false;
  const kopf = typeof SEITENKOPF === 'string'
    ? SEITENKOPF
    : `<meta charset="utf-8"><title>${ersatzTitel}</title>`;
  const html = '<!doctype html>\n<html lang="de">\n<head>\n' + kopf
    + '\n<style id="' + cssId + '">\n' + css + '\n</style>\n</head>\n<body>\n'
    + '<div id="app"></div>\n<script id="' + jsId + '">\n' + js + '\n<' + '/script>\n'
    + '</body>\n</html>\n';
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/* ----------------------------------------------------------- Erste Anlage */

function renderStart() {
  app.innerHTML = `
    <div class="screen start">
      <div class="wrap">
        <h1 class="wortmarke">Der <em>Dreikampf</em></h1>
        <div class="dreiwort"><span>Wissen</span><i>·</i><span>Wahrheit</span><i>·</i><span>Wagnis</span></div>

        <p style="color:var(--fog-dim);font-size:14px;margin:0 0 24px">
          Zwei Leute, ein Handy, ein Punktekonto für den ganzen Urlaub.
        </p>

        <div class="feldlabel">Wer spielt?</div>
        <div class="feldreihe"><input class="feld" id="n0" maxlength="16" value="Monty" aria-label="Name 1"></div>
        <div class="feldreihe"><input class="feld" id="n1" maxlength="16" value="Christina" aria-label="Name 2"></div>

        <div class="feldlabel">Wofür zählen die Punkte?</div>
        <div class="feldreihe"><input class="feld" id="reise" maxlength="24" value="Wien" aria-label="Reise"></div>

        <div style="margin-top:26px;display:flex;flex-direction:column;gap:10px">
          <button class="btn btn--gold" id="los">Losgehen</button>
          <button class="btn btn--leise" id="regeln">Wie es funktioniert</button>
        </div>
      </div>
    </div>`;

  app.querySelector('#los').onclick = () => {
    const n0 = app.querySelector('#n0').value.trim() || 'Spieler 1';
    const n1 = app.querySelector('#n1').value.trim() || 'Spieler 2';
    const reise = app.querySelector('#reise').value.trim() || 'Urlaub';
    stand = neuerStand([n0, n1], reise);
    ui.screen = 'hub';
    ui.halter = 0;
    nachAenderung();
  };
  app.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
}

/* --------------------------------------------------------------- Übersicht */

function renderHub() {
  const f = fuehrung(stand);
  const eintraege = stand.verlauf.slice(0, 14).map((e) => {
    const d = e.deltas
      .map((n, i) => (n !== 0 ? `${esc(stand.spieler[i].name.slice(0, 1))} ${vz(n)}` : null))
      .filter(Boolean);
    return `<div class="eintrag eintrag--${e.typ}">
      <span class="marker"></span>
      <span class="txt">
        <b>Runde ${e.runde} · ${TYP_INFO[e.typ].titel}</b>
        <span>${esc(e.frage)}</span>
      </span>
      <span class="delta">${d.length ? d.join('<br>') : '±0'}</span>
    </div>`;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <header class="kopf">
        <div class="titel">
          <div class="ober">Dreikampf</div>
          <h1>${esc(stand.reise)}</h1>
        </div>
        <div class="werkzeuge">
          <button class="werkzeug" id="btnRegeln" aria-label="Regeln">?</button>
          <button class="werkzeug" id="btnMenue" aria-label="Menü">⋯</button>
        </div>
      </header>

      <div class="scroll">
        <div class="wrap">
          <div class="tafel">
            <div class="seite ${f.vorne === 0 ? 'seite--vorn' : ''}">
              <div class="name">${name(0)}</div>
              <div class="zahl">${stand.punkte[0]}</div>
              <div class="dranmarke">${stand.dran === 0 ? 'am Zug' : ''}</div>
            </div>
            <div class="gegen">vs.</div>
            <div class="seite ${f.vorne === 1 ? 'seite--vorn' : ''}">
              <div class="name">${name(1)}</div>
              <div class="zahl">${stand.punkte[1]}</div>
              <div class="dranmarke">${stand.dran === 1 ? 'am Zug' : ''}</div>
            </div>
          </div>
          <p class="abstand">
            ${f.gleich
              ? 'Gleichstand.'
              : `${name(f.vorne)} führt mit ${f.abstand} ${f.abstand === 1 ? 'Punkt' : 'Punkten'}.`}
            · Runde ${stand.runde}
          </p>

          <button class="btn btn--gold" id="btnRunde">Runde ${stand.runde} — ${name(stand.dran)} wählt</button>

          ${stand.verlauf.length
            ? `<div class="feldlabel">Bisher</div><div class="verlauf">${eintraege}</div>`
            : `<div class="hinweis" style="margin-top:22px">
                 ${name(0)} fängt an. Wer dran ist, wählt eine der drei Disziplinen — und trägt
                 damit auch das Risiko. Danach wechselt der Zug.
               </div>`}
          <div style="height:26px"></div>
        </div>
      </div>
    </div>`;

  app.querySelector('#btnRegeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  app.querySelector('#btnMenue').onclick = () => { ui.overlay = 'menue'; render(); };
  app.querySelector('#btnRunde').onclick = () => { ui.screen = 'wahl'; ui.halter = stand.dran; render(); };
}

/* ----------------------------------------------------------- Disziplinwahl */

function renderWahl() {
  const punkteText = {
    wissen: `${PUNKTE.wissenRichtig}`,
    wahrheit: `${PUNKTE.wahrheitEhrlich}`,
    wagnis: `${PUNKTE.wagnisGemacht}`,
  };

  const karten = TYPEN.map((t) => {
    const rest = stapelRest(stand, t);
    return `<button class="dis dis--${t}" data-typ="${t}">
      <span class="zahl">${punkteText[t]}</span>
      <span class="txt">
        <b>${TYP_INFO[t].titel}</b>
        <small>${TYP_INFO[t].unter}</small>
      </span>
      <span class="rest">${rest.offen}<br>neu</span>
    </button>`;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <header class="kopf">
        <div class="titel">
          <div class="ober">Runde ${stand.runde}</div>
          <h1>${name(stand.dran)} wählt</h1>
        </div>
        <div class="werkzeuge"><button class="werkzeug" id="btnZurueck" aria-label="Zurück">✕</button></div>
      </header>

      <div class="scroll"><div class="wrap" style="padding-top:18px">
        <div class="disziplinen">${karten}</div>
        <button class="btn btn--geist" id="btnZufall" style="margin-top:14px">Überrasch mich</button>
        <p class="abstand" style="margin-top:16px">
          Wagnis-Karten passend zu: <strong style="color:var(--fog)">${ORTE[stand.ort].titel}</strong>
          — im Menü änderbar.
        </p>
      </div></div>
    </div>`;

  app.querySelectorAll('[data-typ]').forEach((b) => {
    b.onclick = () => starteRunde(b.dataset.typ);
  });
  app.querySelector('#btnZufall').onclick = () => starteRunde(TYPEN[Math.floor(Math.random() * TYPEN.length)]);
  app.querySelector('#btnZurueck').onclick = () => { ui.screen = 'hub'; render(); };
}

function starteRunde(typ) {
  neueRunde(stand, typ);
  ui.screen = 'runde';
  ui.halter = stand.dran;
  buzz(12);
  nachAenderung();
}

/* --------------------------------------------------------------- Die Runde */

function renderRunde() {
  const r = stand.aktuell;
  const s = schritt(stand);
  if (!r || !s) { ui.screen = 'hub'; return render(); }

  const koerper = s.art === 'auflösung' ? aufloesung(r) : karteAnsicht(r, s);

  app.innerHTML = `
    <div class="screen">
      <header class="kopf">
        <div class="titel">
          <div class="ober">Runde ${stand.runde} · ${TYP_INFO[r.typ].titel}</div>
          <h1>${kopfzeile(r, s)}</h1>
        </div>
        <div class="werkzeuge"><button class="werkzeug" id="btnAbbruch" aria-label="Runde abbrechen">✕</button></div>
      </header>
      <div class="scroll"><div class="buehne">${koerper.inhalt}</div></div>
      <div class="fuss">
        ${koerper.anweisung ? `<p class="anweisung">${koerper.anweisung}</p>` : ''}
        ${koerper.knoepfe}
      </div>
    </div>`;

  app.querySelector('#btnAbbruch').onclick = () => {
    rundeAbbrechen(stand);
    ui.screen = 'hub';
    nachAenderung();
  };
  koerper.binden?.();
}

function kopfzeile(r, s) {
  if (s.art === 'auflösung') return 'Auswertung';
  if (s.art === 'antwort') return `${name(s.p)} antwortet`;
  if (s.art === 'urteil') return `${name(s.p)} entscheidet`;
  if (s.art === 'ausführen') return `${name(r.wer)} ist dran`;
  return 'Beide antworten';
}

function karteAnsicht(r, s) {
  const k = r.karte;

  if (r.typ === 'wissen') {
    const gewaehlt = r.antworten[s.p];
    const optionen = k.optionen.map((o, i) => `
      <button class="opt ${gewaehlt === i ? 'opt--gewaehlt' : ''}" data-opt="${i}">
        <span class="buchstabe">${'ABCD'[i]}</span><span>${esc(o)}</span>
      </button>`).join('');

    return {
      inhalt: `<div class="karte karte--wissen">
        <div class="marke"><span class="pille">${esc(k.cat)}</span></div>
        <p class="frage">${esc(k.q)}</p>
        <div class="optionen">${optionen}</div>
      </div>`,
      anweisung: gewaehlt === null
        ? `<b>${name(s.p)}</b>, tipp deine Antwort an. Die andere Person sieht sie nicht.`
        : 'Antwort steht — abgeben, ohne dass jemand mitliest.',
      knoepfe: `<button class="btn btn--gold" id="btnAbgeben" ${gewaehlt === null ? 'disabled' : ''}>
        Antwort abgeben</button>`,
      binden() {
        app.querySelectorAll('[data-opt]').forEach((b) => {
          b.onclick = () => {
            r.antworten[s.p] = Number(b.dataset.opt);
            buzz(8);
            nachAenderung();
          };
        });
        app.querySelector('#btnAbgeben').onclick = () => {
          antworten(stand, r.antworten[s.p]);
          nachAenderung();
        };
      },
    };
  }

  if (r.typ === 'wahrheit') {
    const tiefeText = { leicht: 'Zum Warmwerden', ehrlich: 'Ehrlich jetzt', tief: 'Tief' };
    const karte = `<div class="karte karte--wahrheit">
      <div class="marke">
        <span class="pille">${esc(k.thema)}</span><span>${tiefeText[k.tiefe] || ''}</span>
      </div>
      <p class="frage">${esc(k.q)}</p>
    </div>`;

    if (s.art === 'reden') {
      return {
        inhalt: karte,
        anweisung: `Beide antworten — laut und nacheinander. <b>${name(r.wer)}</b> fängt an.`,
        knoepfe: `<button class="btn btn--gold" id="btnFertig">Beide haben geantwortet</button>`,
        binden() { app.querySelector('#btnFertig').onclick = () => { weiter(stand); nachAenderung(); }; },
      };
    }

    return {
      inhalt: karte,
      anweisung: `<b>${name(s.p)}</b>: War die Antwort von <b>${name(s.ueber)}</b> ehrlich?`,
      knoepfe: `<div class="reihe">
        <button class="btn btn--nein" id="btnNein">Ausgewichen</button>
        <button class="btn btn--ja" id="btnJa">Ehrlich · ${vz(PUNKTE.wahrheitEhrlich)}</button>
      </div>`,
      binden() {
        app.querySelector('#btnJa').onclick = () => { bewerten(stand, true); buzz(12); nachAenderung(); };
        app.querySelector('#btnNein').onclick = () => { bewerten(stand, false); nachAenderung(); };
      },
    };
  }

  // Wagnis
  const karte = `<div class="karte karte--wagnis">
    <div class="marke"><span class="pille">${esc(ORTE[k.ort]?.titel || 'Überall')}</span><span>Mutprobe</span></div>
    <p class="frage">${esc(k.q)}</p>
  </div>`;

  if (s.art === 'ausführen') {
    return {
      inhalt: karte,
      anweisung: `<b>${name(r.wer)}</b>, das ist deins. ${name(andere(r.wer))} entscheidet danach, ob es zählt.`,
      knoepfe: `<div class="reihe">
        <button class="btn btn--nein" id="btnKneifen">Kneifen · ${PUNKTE.wagnisVerweigert}</button>
        <button class="btn btn--gold" id="btnErledigt">Erledigt</button>
      </div>`,
      binden() {
        app.querySelector('#btnErledigt').onclick = () => { weiter(stand); nachAenderung(); };
        app.querySelector('#btnKneifen').onclick = () => {
          r.gemacht = false;
          r.i = r.schritte.length - 1;
          nachAenderung();
        };
      },
    };
  }

  return {
    inhalt: karte,
    anweisung: `<b>${name(s.p)}</b>: Hat <b>${name(s.ueber)}</b> das wirklich durchgezogen?`,
    knoepfe: `<div class="reihe">
      <button class="btn btn--nein" id="btnNein">Nein · ${PUNKTE.wagnisVerweigert}</button>
      <button class="btn btn--ja" id="btnJa">Ja · ${vz(PUNKTE.wagnisGemacht)}</button>
    </div>`,
    binden() {
      app.querySelector('#btnJa').onclick = () => { bewerten(stand, true); buzz([15, 40, 20]); nachAenderung(); };
      app.querySelector('#btnNein').onclick = () => { bewerten(stand, false); nachAenderung(); };
    },
  };
}

function aufloesung(r) {
  const { deltas, zeilen } = ergebnis(r);
  let inhalt = '';

  if (r.typ === 'wissen') {
    const k = r.karte;
    const optionen = k.optionen.map((o, i) => {
      const wer = [0, 1].filter((p) => r.antworten[p] === i).map((p) => name(p)).join(' & ');
      const kl = i === k.richtig ? 'opt--richtig' : (wer ? 'opt--falsch' : '');
      return `<div class="opt ${kl}">
        <span class="buchstabe">${'ABCD'[i]}</span><span>${esc(o)}</span>
        ${wer ? `<span class="wer">${wer}</span>` : ''}
      </div>`;
    }).join('');
    inhalt = `<div class="karte karte--wissen">
      <div class="marke"><span class="pille">${esc(k.cat)}</span><span>Auflösung</span></div>
      <p class="frage">${esc(k.q)}</p>
      <div class="optionen">${optionen}</div>
    </div>`;
  } else {
    inhalt = `<div class="karte karte--${r.typ}">
      <div class="marke"><span>${TYP_INFO[r.typ].titel}</span></div>
      <p class="frage">${esc(r.karte.q)}</p>
    </div>`;
  }

  const bilanz = zeilen.map((z) => `
    <div class="bilanzzeile">
      <span class="wer">${name(z.p)}<br><span class="was">${esc(z.text)}</span></span>
      <span class="pkt ${pktKlasse(z.punkte)}">${vz(z.punkte)}</span>
    </div>`).join('');

  const neu = [0, 1].map((i) => stand.punkte[i] + deltas[i]);

  return {
    inhalt: `${inhalt}
      <div class="bilanz">${bilanz}</div>
      <p class="abstand" style="margin:0">
        Danach: ${name(0)} ${neu[0]} · ${name(1)} ${neu[1]}
      </p>`,
    anweisung: '',
    knoepfe: `<button class="btn btn--gold" id="btnBuchen">Punkte gutschreiben</button>`,
    binden() {
      app.querySelector('#btnBuchen').onclick = () => {
        rundeAbschliessen(stand);
        ui.screen = 'hub';
        ui.halter = stand.dran;
        buzz(15);
        nachAenderung();
      };
    },
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
    <p class="auftrag">Deine Antwort — ohne dass jemand mitliest.</p>
    <button class="btn btn--gold" id="btnBereit">Ich hab's</button>`;
  app.appendChild(layer);
  layer.querySelector('#btnBereit').onclick = () => { ui.halter = wer; render(); };
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
    <div class="lesbar">
      <h2>Der Dreikampf</h2>
      <p>Zwei Leute, ein Handy. Wer dran ist, wählt eine von drei Disziplinen — und trägt
         damit auch das Risiko. Danach wechselt der Zug. Die Punkte laufen über den ganzen
         Urlaub weiter.</p>

      <h3>Wissen · ${PUNKTE.wissenRichtig} Punkte</h3>
      <ul>
        <li><strong>Beide</strong> beantworten dieselbe Frage, verdeckt und nacheinander.</li>
        <li>Richtig: <strong>${PUNKTE.wissenRichtig} Punkte</strong>.</li>
        <li>Wer als <strong>Einzige richtig</strong> liegt, bekommt
            <strong>${PUNKTE.wissenRichtig + PUNKTE.wissenAllein}</strong> — das ist das Duell.</li>
      </ul>

      <h3>Wahrheit · ${PUNKTE.wahrheitEhrlich} Punkte</h3>
      <ul>
        <li><strong>Beide</strong> müssen antworten, laut und nacheinander.</li>
        <li>Danach entscheidet jeder über den anderen: ehrlich oder ausgewichen?</li>
        <li>Ehrlich: <strong>${PUNKTE.wahrheitEhrlich} Punkte</strong>. Ausgewichen: nichts.</li>
        <li>Es gibt mehr als beim Wissen, weil es mehr kostet.</li>
      </ul>

      <h3>Wagnis · ${PUNKTE.wagnisGemacht} Punkte</h3>
      <ul>
        <li>Nur wer dran ist, muss ran.</li>
        <li>Der oder die andere entscheidet, ob es zählt.</li>
        <li>Durchgezogen: <strong>${PUNKTE.wagnisGemacht} Punkte</strong> — die höchste Beute.</li>
        <li>Gekniffen oder nicht anerkannt: <strong>${PUNKTE.wagnisVerweigert} Punkte</strong>.</li>
      </ul>

      <h3>Die Stapel</h3>
      <p>${STAPEL.wissen.length} Wissensfragen, ${STAPEL.wahrheit.length} Wahrheitsfragen und
         ${STAPEL.wagnis.length} Mutproben. Jede Karte kommt erst wieder, wenn ihr Stapel
         durch ist. Mutproben lassen sich danach filtern, wo ihr gerade seid.</p>

      <h3>Punkte</h3>
      <p>Der Stand wird auf diesem Gerät gespeichert und läuft weiter, bis ihr ihn
         zurücksetzt. Über <strong>Menü → Punktestand sichern</strong> lässt er sich als Code
         oder Datei mitnehmen — praktisch, wenn ihr die App mal von woanders öffnet.</p>

      <div style="margin-top:24px"><button class="btn btn--gold" id="zu">Verstanden</button></div>
    </div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
}

function renderMenue() {
  const l = overlayHuelle(`
    <h2>Menü</h2>
    <div style="margin-top:18px;display:flex;flex-direction:column;gap:9px">
      <button class="btn btn--geist" id="orte">Wo seid ihr? · ${ORTE[stand.ort].titel}</button>
      <button class="btn btn--geist" id="stat">Statistik</button>
      <button class="btn btn--geist" id="code">Punktestand sichern oder laden</button>
      <button class="btn btn--geist" id="datei">Spiel als Datei sichern</button>
      <button class="btn btn--geist" id="regeln">Regeln</button>
      <button class="btn btn--nein" id="reset">Punktekonto zurücksetzen</button>
      <button class="btn btn--gold" id="zu">Zurück</button>
    </div>
    <div class="hinweis" style="margin-top:22px">
      Der Stand liegt in diesem Browser auf diesem Gerät. Öffnet ihr das Spiel von einer
      anderen Adresse aus, fängt es dort bei null an — dafür gibt es den Sicherungscode.
    </div>`);
  l.querySelector('#orte').onclick = () => { ui.overlay = 'orte'; render(); };
  l.querySelector('#stat').onclick = () => { ui.overlay = 'statistik'; render(); };
  l.querySelector('#code').onclick = () => { ui.overlay = 'code'; ui.codeStatus = ''; render(); };
  l.querySelector('#datei').onclick = (e) => {
    const ok = seiteAlsDateiSichern('dreikampf-css', 'dreikampf-js', 'Dreikampf.html', 'Dreikampf');
    e.currentTarget.textContent = ok
      ? 'Gesichert — liegt in deinen Downloads'
      : 'Geht nur in der fertigen Version';
  };
  l.querySelector('#regeln').onclick = () => { ui.overlay = 'regeln'; render(); };
  l.querySelector('#zu').onclick = () => { ui.overlay = null; render(); };
  l.querySelector('#reset').onclick = () => {
    if (!confirm('Alle Punkte und der ganze Verlauf werden gelöscht. Sicher?')) return;
    stand = neuerStand(stand.spieler.map((p) => p.name), stand.reise);
    ui.overlay = null;
    ui.screen = 'hub';
    nachAenderung();
  };
}

function renderOrte() {
  const knoepfe = Object.entries(ORTE).map(([k, v]) => {
    const rest = k === 'egal' ? STAPEL.wagnis.length
      : STAPEL.wagnis.filter((x) => x.ort === k || x.ort === 'überall').length;
    return `<button class="wahl ${stand.ort === k ? 'wahl--an' : ''}" data-ort="${k}">
      <span><b>${v.titel}</b><small>${v.unter} · ${rest} Karten</small></span>
    </button>`;
  }).join('');

  const l = overlayHuelle(`
    <h2>Wo seid ihr gerade?</h2>
    <p>Das filtert nur die Mutproben. Wissen und Wahrheit gehen überall.</p>
    <div class="wahlreihe" style="margin-top:16px">${knoepfe}</div>
    <div style="margin-top:22px"><button class="btn btn--gold" id="zu">Passt</button></div>`);
  l.querySelectorAll('[data-ort]').forEach((b) => {
    b.onclick = () => { stand.ort = b.dataset.ort; nachAenderung(); };
  });
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; render(); };
}

function renderStatistik() {
  const st = stand.statistik;
  const zeile = (k, werte, suffix = '') => `
    <span class="k">${k}</span>
    <span class="v">${werte[0]}${suffix}</span>
    <span class="v">${werte[1]}${suffix}</span>`;

  const l = overlayHuelle(`
    <h2>Statistik</h2>
    <div class="statz" style="margin-top:16px">
      <span class="kopfz" style="text-align:left">&nbsp;</span>
      <span class="kopfz">${name(0)}</span>
      <span class="kopfz">${name(1)}</span>
      ${zeile('Punkte gesamt', stand.punkte)}
      ${zeile('Wissen richtig', st.wissenRichtig)}
      ${zeile('Ehrlich geantwortet', st.wahrheitEhrlich)}
      ${zeile('Mutproben bestanden', st.wagnisGemacht)}
      ${zeile('Gekniffen', st.wagnisVerweigert)}
    </div>
    <p style="margin-top:20px">${stand.runde - 1} gespielte Runden in „${esc(stand.reise)}“.</p>
    <div style="margin-top:16px"><button class="btn btn--gold" id="zu">Zurück</button></div>`);
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; render(); };
}

function renderCode() {
  const code = alsCode(stand);
  const l = overlayHuelle(`
    <h2>Punktestand mitnehmen</h2>
    <p>Kopiert den Code oder sichert ihn als Datei. Auf einem anderen Gerät oder unter einer
       anderen Adresse fügt ihr ihn unten wieder ein.</p>

    <div class="feldlabel">Euer Code</div>
    <textarea class="code" id="raus" readonly>${esc(code)}</textarea>
    <div class="reihe" style="margin-top:9px">
      <button class="btn btn--geist" id="kopieren">Kopieren</button>
      <button class="btn btn--geist" id="datei">Als Datei</button>
    </div>

    <div class="feldlabel">Code einspielen</div>
    <textarea class="code" id="rein" placeholder="Code hier einfügen"></textarea>
    <button class="btn btn--nein" id="laden" style="margin-top:9px">Diesen Stand übernehmen</button>

    ${ui.codeStatus ? `<p class="hinweis" style="margin-top:14px">${esc(ui.codeStatus)}</p>` : ''}
    <div style="margin-top:22px"><button class="btn btn--gold" id="zu">Zurück</button></div>`);

  l.querySelector('#kopieren').onclick = async () => {
    const feld = l.querySelector('#raus');
    try {
      await navigator.clipboard.writeText(feld.value);
      ui.codeStatus = 'Code liegt in der Zwischenablage.';
    } catch {
      feld.select();
      ui.codeStatus = 'Code ist markiert — jetzt kopieren.';
    }
    render();
  };
  l.querySelector('#datei').onclick = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreikampf-${stand.reise.replace(/\W+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    ui.codeStatus = 'Datei gesichert.';
    render();
  };
  l.querySelector('#laden').onclick = () => {
    const neu = ausCode(l.querySelector('#rein').value);
    if (!neu) { ui.codeStatus = 'Der Code lässt sich nicht lesen. Vollständig eingefügt?'; return render(); }
    stand = neu;
    ui.overlay = null;
    ui.screen = stand.aktuell ? 'runde' : 'hub';
    ui.halter = braucht() ?? stand.dran;
    ui.codeStatus = '';
    nachAenderung();
  };
  l.querySelector('#zu').onclick = () => { ui.overlay = 'menue'; render(); };
}

/* ----------------------------------------------------------------- Render */

function render() {
  if (!stand) { renderStart(); }
  else if (ui.screen === 'runde' && stand.aktuell) { renderRunde(); }
  else if (ui.screen === 'wahl') { renderWahl(); }
  else { ui.screen = 'hub'; renderHub(); }

  if (ui.overlay === 'regeln') renderRegeln();
  else if (ui.overlay === 'menue') renderMenue();
  else if (ui.overlay === 'orte') renderOrte();
  else if (ui.overlay === 'statistik') renderStatistik();
  else if (ui.overlay === 'code') renderCode();
  else if (ui.screen === 'runde' && stand?.aktuell) {
    const wer = braucht();
    if (wer !== null && wer !== ui.halter) renderUebergabe(wer);
  }
}

stand = laden();
if (stand) {
  ui.screen = stand.aktuell ? 'runde' : 'hub';
  ui.halter = braucht() ?? stand.dran;
}
render();
