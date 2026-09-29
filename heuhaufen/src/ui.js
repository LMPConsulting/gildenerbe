// Die Oberfläche: vier Reiter (Haufen, Halle, Forschung, Funde), ein Menü und
// ein paar Einblendungen. Die Engine rechnet, hier wird nur gezeichnet,
// angetippt und gespeichert.

import {
  AESTE, TECH, MASCHINEN, FUNDE, SELTENHEIT, NADELN, GESCHICHTE, PRODUKTE, SAMMELBONUS,
  AUSSCHUSS_TIPPS,
} from './daten.js';
import {
  neuerStand, werte, tick, tippen, verkaufen, saugen, techKaufen, techKosten, techStatus, techStufe,
  techOffen, techLage, techGekauft, TECH_NACH_ID, TECH_STUFEN_GESAMT, MASCHINE_NACH_ID, FUND_NACH_ID,
  maschineFrei, maschinenKosten, maschineKaufen, maschineAbbauen, maschineUmschalten, plaetzeBelegt,
  anzahl, fabrik, drohneKaufen, drohnenKosten, ausschussTippen, imAusschuss, nadelnGefunden,
  alleNadeln, fundeVerkaufen, fundWert, fundPreis, fundArten, detektor, rest, griffMenge, taschePlatz,
  preisRoh, produktPreis, speichern, laden, offlineNachholen, neuerHaufen,
} from './engine.js';
import { zahl, halme, geld, rate, prozent, dauer } from './format.js';
import { klang, klangWecken, klangStumm, saugerAn, saugerAus, saugerHitze } from './klang.js';
import { SYM, MASCHINEN_SYM, FUND_SYM } from './symbole.js';
import { haufenSzene, halleSzene } from './szene.js';

const SPEICHER_KEY = 'heuhaufen-stand-v1';
const TON_KEY = 'heuhaufen-ton';
const AST_NACH_ID = Object.fromEntries(AESTE.map((a) => [a.id, a]));
const SELTEN_NACH_ID = Object.fromEntries(SELTENHEIT.map((r, i) => [r.id, { ...r, rang: i }]));
const BAUM = techLage(AESTE);

let stand = null;
const ui = {
  reiter: 'haufen',
  wahl: null,          // Techknoten im Detailblatt
  suche: '',
  laufGesamt: 1,
  naechsterPiep: 0,
  blink: 0,
  baumScroll: null,
  bildschirm: null,    // { aktualisieren, zeichnen, weg }
  gespeichert: 0,
  saugerLaeuft: false,
  endeOffen: false,
};

/* ------------------------------------------------------------ Helfer */

function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat()) {
    if (kind == null || kind === false) continue;
    e.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return e;
}

const sym = (html) => h('span', { class: 'symhalter', html });

function setzeText(e, t) {
  if (e && e.textContent !== t) e.textContent = t;
}

function schalte(e, klasse, an) {
  if (e && e.classList.contains(klasse) !== !!an) e.classList.toggle(klasse, !!an);
}

function summen(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* egal */ }
}

/* ------------------------------------------------------------ Speichern */

function sichern() {
  if (!stand) return;
  try { localStorage.setItem(SPEICHER_KEY, speichern(stand)); } catch { /* privater Modus */ }
  ui.gespeichert = performance.now();
}

function einlesen() {
  try {
    const roh = localStorage.getItem(SPEICHER_KEY);
    return roh ? laden(roh) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ Gerüst */

const el = {};

function geruest() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  el.geld = h('span', { class: 'num' });
  el.halme = h('span', { class: 'num' });
  el.nadeln = h('div', { class: 'nadelreihe' }, NADELN.map(() => h('span', { class: 'nadelmarke', html: SYM.nadel })));
  el.kopf = h('header', { class: 'kopf' },
    h('div', { class: 'kasse' }, sym(SYM.geld), el.geld),
    h('div', { class: 'zaehler' }, el.halme, h('small', {}, 'Halme übrig')),
    el.nadeln,
    h('button', { class: 'rund', 'aria-label': 'Menü', onclick: menue }, sym(SYM.menue)));
  el.buehne = h('main', { class: 'buehne' });
  el.reiter = {};
  const reiter = [
    ['haufen', 'Haufen', SYM.haufen], ['halle', 'Halle', SYM.halle],
    ['forschung', 'Forschung', SYM.forschung], ['funde', 'Funde', SYM.funde],
  ];
  el.nav = h('nav', { class: 'reiter' }, reiter.map(([id, name, s]) => {
    const marke = h('span', { class: 'marke' });
    const b = h('button', { class: 'reiterknopf', onclick: () => wechseln(id) }, sym(s), h('span', {}, name), marke);
    el.reiter[id] = { knopf: b, marke };
    return b;
  }));
  el.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  el.modal = h('div', { class: 'modalhalter' });
  app.append(el.kopf, el.buehne, el.nav, el.toasts, el.modal);
}

function wechseln(id) {
  klangWecken();
  if (ui.bildschirm && ui.bildschirm.weg) ui.bildschirm.weg();
  ui.reiter = id;
  el.buehne.innerHTML = '';
  ui.bildschirm = { haufen: bildHaufen, halle: bildHalle, forschung: bildForschung, funde: bildFunde }[id]();
  for (const [k, r] of Object.entries(el.reiter)) schalte(r.knopf, 'aktiv', k === id);
  kopfAktualisieren();
}

function kopfAktualisieren() {
  setzeText(el.geld, geld(stand.geld));
  setzeText(el.halme, halme(rest(stand)));
  stand.nadeln.forEach((n, i) => {
    const m = el.nadeln.children[i];
    schalte(m, 'gefunden', n.zustand === 'gefunden');
    schalte(m, 'ausschuss', n.zustand === 'ausschuss');
  });
  const kaufbar = TECH.filter((t) => techStatus(stand, t.id) === 'kaufbar').length;
  setzeText(el.reiter.forschung.marke, kaufbar ? String(kaufbar) : '');
  schalte(el.reiter.forschung.marke, 'sichtbar', kaufbar > 0);
  const aus = imAusschuss(stand);
  setzeText(el.reiter.funde.marke, aus ? '!' : '');
  schalte(el.reiter.funde.marke, 'sichtbar', aus > 0);
  schalte(el.reiter.halle.knopf, 'zu', !werte(stand).frei.has('halle'));
}

/* ------------------------------------------------------------ Einblendungen */

function toast(text, art = '') {
  const t = h('div', { class: `toast ${art}` }, text);
  el.toasts.append(t);
  while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
  setTimeout(() => t.classList.add('weg'), 2600);
  setTimeout(() => t.remove(), 3000);
}

const warteschlange = [];

/** Zeigt eine Einblendung; ist schon eine offen, wartet die neue dahinter. */
function modal(optionen) {
  if (modalOffen()) { warteschlange.push(optionen); return; }
  const { titel, ober, absaetze = [], inhalt = null, knoepfe = [], klasse = '' } = optionen;
  el.modal.innerHTML = '';
  const zu = () => {
    el.modal.innerHTML = '';
    el.modal.classList.remove('offen');
    if (warteschlange.length) modal(warteschlange.shift());
  };
  const karte = h('div', { class: `modal ${klasse}`, role: 'dialog', 'aria-modal': 'true' },
    ober ? h('p', { class: 'ober' }, ober) : null,
    titel ? h('h2', {}, titel) : null,
    absaetze.map((p) => h('p', {}, p)),
    inhalt,
    h('div', { class: 'modalknoepfe' }, knoepfe.map((k) => h('button', {
      class: `knopf ${k.klasse || ''}`,
      onclick: () => { klangWecken(); if (!k.bleiben) zu(); if (k.aktion) k.aktion(); },
    }, k.text))));
  el.modal.append(h('div', { class: 'schleier' }), karte);
  el.modal.classList.add('offen');
  return zu;
}

const modalOffen = () => el.modal.classList.contains('offen');

function einfuehrung() {
  modal({
    ober: 'Rund 6.000.000 Halme',
    titel: 'Find die Nadel',
    absaetze: GESCHICHTE.anfang,
    inhalt: h('ul', { class: 'anleitung' },
      h('li', {}, 'Tippe auf den Haufen, um Heu zu schaufeln.'),
      h('li', {}, 'Ist die Tasche voll, bring sie zum Ankauf.'),
      h('li', {}, 'Mit dem Geld kaufst du in der Forschung bessere Werkzeuge, später Förderbänder und Maschinen.'),
      h('li', {}, 'Der Metalldetektor piept, wenn eine Nadel nah ist.')),
    knoepfe: [{ text: 'Los geht’s', klasse: 'primaer' }],
  });
}

function nadelGefunden(i) {
  klang.nadel();
  summen([30, 60, 30]);
  if (ui.reiter === 'haufen' && ui.bildschirm.glanz) ui.bildschirm.glanz();
  const n = NADELN[i];
  const zahlGefunden = nadelnGefunden(stand);
  modal({
    klasse: 'nadelmodal',
    ober: `Nadel ${zahlGefunden} von ${NADELN.length}`,
    titel: n.name,
    inhalt: h('div', {},
      h('div', { class: 'nadelgross', html: SYM.nadel }),
      h('p', { class: 'geschichte' }, GESCHICHTE.nadeln[i]),
      h('p', { class: 'bonus' }, `Bonus: ${n.bonus}`)),
    knoepfe: [{
      text: alleNadeln(stand) ? 'Hinaus' : 'Weitersuchen',
      klasse: 'primaer',
      aktion: () => { if (alleNadeln(stand)) ende(); },
    }],
  });
  sichern();
}

function ende() {
  const zeit = (stand.zeitGesamt || 0) + stand.zeit;
  modal({
    klasse: 'endemodal',
    ober: stand.erledigt ? `Haufen ${stand.lauf}` : 'Geschafft',
    titel: 'Alle sechs Nadeln',
    absaetze: [GESCHICHTE.ende],
    inhalt: h('dl', { class: 'werte' },
      h('dt', {}, 'Spielzeit'), h('dd', {}, dauer(stand.zeit)),
      h('dt', {}, 'Halme abgetragen'), h('dd', {}, halme(stand.haufen.entfernt)),
      h('dt', {}, 'Schaufelstiche'), h('dd', {}, zahl(stand.stat.tipps)),
      h('dt', {}, 'Upgrades'), h('dd', {}, `${techGekauft(stand)} von ${TECH_STUFEN_GESAMT}`),
      h('dt', {}, 'Fundstücke'), h('dd', {}, `${fundArten(stand)} von ${FUNDE.length} Arten`),
      zeit !== stand.zeit ? [h('dt', {}, 'Alle Haufen'), h('dd', {}, dauer(zeit))] : null),
    knoepfe: [
      { text: 'Hier bleiben', klasse: '' },
      { text: 'Neuer Haufen', klasse: 'primaer', aktion: neuerHaufenFragen },
    ],
  });
}

function neuerHaufenFragen() {
  const groesse = Math.round(stand.haufen.gesamt * 1.5);
  modal({
    titel: 'Neuer Haufen',
    absaetze: [
      `Die nächste Halle hat ${halme(groesse)} Halme und sechs neue Nadeln. Geld, Forschung und Maschinen `
        + 'bleiben hier. Dein Fundalbum kommt mit.',
      `Dafür bringt alles ${prozent(0.5 * (stand.erledigt + 1))} mehr ein und jeder Stich wird `
        + `${prozent(0.25 * (stand.erledigt + 1))} kräftiger.`,
    ],
    knoepfe: [
      { text: 'Noch nicht' },
      {
        text: 'Aufbrechen', klasse: 'primaer', aktion: () => {
          const neu = neuerHaufen(stand);
          if (!neu) return;
          stand = neu;
          sichern();
          wechseln('haufen');
          toast(`Haufen ${stand.lauf}: ${halme(stand.haufen.gesamt)} Halme.`, 'gut');
        },
      },
    ],
  });
}

function abwesenheitsbericht(b) {
  if (!b) return;
  const zeilen = [
    `Die Halle hat ${halme(b.halme)} Halme abgetragen und ${geld(b.geld)} verdient.`,
  ];
  if (b.funde) zeilen.push(`Dabei sind ${zahl(b.funde)} Fundstücke in der Kiste gelandet.`);
  if (b.nadeln) zeilen.push(b.nadeln === 1 ? 'Und eine Nadel wurde gefunden.' : `Und ${b.nadeln} Nadeln wurden gefunden.`);
  if (b.ausschuss) zeilen.push('Eine Nadel ist dabei in den Ausschuss gerutscht. Unter Funde kannst du sie heraussuchen.');
  if (b.abwesend > b.sekunden + 60) {
    zeilen.push(`Gezählt wurden ${dauer(b.sekunden)} von ${dauer(b.abwesend)}. Mehr schafft die Nachtschicht noch nicht.`);
  }
  modal({ ober: `Du warst ${dauer(b.abwesend)} weg`, titel: 'Während du weg warst', absaetze: zeilen, knoepfe: [{ text: 'Gut', klasse: 'primaer' }] });
  for (const e of b.ereignisse) if (e.typ === 'nadel') nadelGefunden(e.i);
}

/* ------------------------------------------------------------ Ereignisse */

function ereignisse(liste) {
  for (const e of liste) {
    if (e.typ === 'nadel') nadelGefunden(e.i);
    else if (e.typ === 'ausschuss') {
      klang.fehler();
      toast('Eine Nadel ist ungescannt durchs Band gerutscht und liegt jetzt im Ausschuss.', 'warn');
    } else if (e.typ === 'fund') {
      const f = FUND_NACH_ID[e.id];
      const r = SELTEN_NACH_ID[f.stufe];
      if (e.neu || r.rang >= 2) {
        klang.fund(r.rang);
        toast(`${e.neu ? 'Neu im Album: ' : ''}${f.name} (${r.name})`, `fund r${r.rang}`);
      }
    } else if (e.typ === 'verkauft') {
      klang.kasse();
      if (ui.reiter === 'haufen' && ui.bildschirm.geldText) ui.bildschirm.geldText(`+${geld(e.betrag)}`);
    } else if (e.typ === 'ueberhitzt') {
      klang.heiss();
      toast('Der Sauger ist überhitzt und muss abkühlen.', 'warn');
    }
  }
}

/* ------------------------------------------------------------ Hinweis */

function hinweis() {
  const w = werte(stand);
  const d = detektor(stand);
  if (imAusschuss(stand)) return 'Eine Nadel liegt im Ausschuss. Unter „Funde“ kannst du sie heraussuchen.';
  if (stand.stat.tipps < 3) return 'Tippe auf den Haufen, um Heu zu schaufeln.';
  if (stand.tasche >= taschePlatz(w) && stand.stat.gaenge < 3) return 'Die Tasche ist voll. Bring das Heu zum Ankauf.';
  if (techGekauft(stand) === 0 && stand.geld >= 3) return 'Du hast Geld. In der Forschung gibt es die ersten Upgrades.';
  if (d.stufe === 'heiss') return 'Der Detektor schlägt aus. Die Nadel ist ganz nah.';
  if (w.frei.has('halle') && !anzahl(stand, 'arm')) return 'Die Halle ist offen. Dort steht der erste Greifarm zum Kauf.';
  if (w.frei.has('halle') && fabrik(stand).strom < 1) return 'In der Halle fehlt Strom. Die Maschinen laufen langsamer.';
  if (w.frei.has('halle') && anzahl(stand, 'arm') && fabrik(stand).deckung < 1) {
    return w.frei.has('scanner') ? 'Nicht alles Heu auf dem Band wird gescannt. Mehr Scanner kaufen.' : 'Ohne Scanner können Nadeln durchs Band rutschen. Scanner gibt es in der Forschung.';
  }
  if (!w.frei.has('halle') && techStufe(stand, 'drohne') && stand.geld > 1000) return 'Nächstes Ziel: Automatisierung in der Forschung.';
  return '';
}

/* ================================================================ Haufen */

function bildHaufen() {
  const canvas = h('canvas', { class: 'haufencanvas', 'aria-label': 'Der Heuhaufen. Tippen zum Schaufeln.' });
  const hinweisZeile = h('div', { class: 'hinweis' });
  const taschenFuellung = h('div', { class: 'fuellung' });
  const taschenText = h('span', {});
  const tasche = h('div', { class: 'taschebalken' }, taschenFuellung, sym(SYM.tasche), taschenText);
  const werkzeug = h('div', { class: 'werkzeugschild' });
  const szeneBox = h('div', { class: 'szene' }, canvas, hinweisZeile, werkzeug, tasche);
  const segmente = Array.from({ length: 12 }, () => h('span', { class: 'seg' }));
  const dText = h('span', { class: 'dtext' });
  const detektorLeiste = h('div', { class: 'detektorleiste' }, sym(SYM.detektor), h('div', { class: 'segmente' }, segmente), dText);

  const vText = h('span', { class: 'zeile1' }, 'Zum Ankauf');
  const vKlein = h('small', {});
  const vBalken = h('div', { class: 'lauf' });
  const verkaufKnopf = h('button', {
    class: 'aktion gross', onclick: () => {
      klangWecken();
      if (verkaufen(stand)) ui.laufGesamt = stand.laufen;
      else klang.fehler();
    },
  }, sym(SYM.ankauf), h('span', { class: 'aktiontext' }, vText, vKlein), vBalken);

  const hitze = h('div', { class: 'hitze' });
  const sKlein = h('small', {}, 'halten');
  const saugerKnopf = h('button', { class: 'aktion sauger' }, sym(SYM.sauger), h('span', { class: 'aktiontext' }, h('span', { class: 'zeile1' }, 'Saugen'), sKlein), hitze);
  const saugStart = (ev) => {
    ev.preventDefault();
    klangWecken();
    saugen(stand, true);
    saugerKnopf.setPointerCapture?.(ev.pointerId);
  };
  const saugEnde = () => saugen(stand, false);
  saugerKnopf.addEventListener('pointerdown', saugStart);
  saugerKnopf.addEventListener('pointerup', saugEnde);
  saugerKnopf.addEventListener('pointercancel', saugEnde);
  saugerKnopf.addEventListener('lostpointercapture', saugEnde);
  saugerKnopf.addEventListener('contextmenu', (e) => e.preventDefault());

  const dKlein = h('small', {});
  const drohnenKnopf = h('button', {
    class: 'aktion drohne', onclick: () => {
      klangWecken();
      const r = drohneKaufen(stand);
      if (r.ok) { klang.kauf(); toast('Eine Drohne mehr in der Luft.'); } else klang.fehler();
    },
  }, sym(SYM.drohne), h('span', { class: 'aktiontext' }, h('span', { class: 'zeile1' }, 'Drohne'), dKlein));

  const aktionen = h('div', { class: 'aktionen' }, verkaufKnopf, saugerKnopf, drohnenKnopf);
  const wurzel = h('section', { class: 'bild haufenbild' }, szeneBox, detektorLeiste, aktionen);
  el.buehne.append(wurzel);

  const szene = haufenSzene(canvas);

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    klangWecken();
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const e = [];
    const erg = tippen(stand, e);
    if (!erg) { szene.text(x, y - 10, 'Unterwegs …', '#e8dcc4', 13); return; }
    if (erg.menge > 0) {
      szene.stich(x, y, erg.menge, erg.krit);
      klang.stich(erg.krit);
      if (erg.krit) summen(15);
    } else if (erg.voll) {
      szene.text(x, y - 10, 'Tasche voll!', '#ffb36b', 15);
      klang.fehler();
    }
    ereignisse(e);
  });

  let letzterHinweis = '';
  return {
    glanz: () => szene.nadelGlanz(),
    geldText: (t) => {
      const r = canvas.getBoundingClientRect();
      szene.text(r.width - 34, r.height * 0.84 - 110, t, '#9fe0a4', 15);
    },
    zeichnen(dt) {
      const w = werte(stand);
      const f = w.frei.has('halle') ? fabrik(stand) : null;
      szene.zeichnen(stand, {
        laufAnteil: stand.laufen > 0 ? 1 - stand.laufen / Math.max(ui.laufGesamt, 0.01) : null,
        saugt: stand.sauger.an && !stand.sauger.heiss && stand.laufen <= 0,
        saugerSichtbar: w.frei.has('sauger'),
        hitze: stand.sauger.hitze,
        blink: ui.blink,
        fabrik: f,
        torOffen: alleNadeln(stand),
      }, dt);
    },
    aktualisieren() {
      const w = werte(stand);
      const platz = taschePlatz(w);
      taschenFuellung.style.width = `${Math.min(100, (stand.tasche / platz) * 100)}%`;
      setzeText(taschenText, `${halme(stand.tasche)} / ${halme(platz)}`);
      schalte(tasche, 'voll', stand.tasche >= platz);
      const wz = w.frei.has('gabelstapler') ? 'Heu-Gabelstapler' : w.frei.has('doppelgabel') ? 'Doppelgabel'
        : w.frei.has('heugabel') ? 'Heugabel' : 'Schaufel';
      setzeText(werkzeug, `${wz} · ${rate(griffMenge(w))} pro Stich`);
      const hw = hinweis();
      if (hw !== letzterHinweis) {
        letzterHinweis = hw;
        setzeText(hinweisZeile, hw);
        schalte(hinweisZeile, 'sichtbar', !!hw);
      }
      // Detektor
      const d = detektor(stand);
      const an = Math.round(d.staerke * segmente.length);
      segmente.forEach((sg, i) => {
        schalte(sg, 'an', i < an);
        schalte(sg, 'heiss', i < an && i >= segmente.length * 0.7);
      });
      let dt = 'still';
      if (d.abstand == null) dt = 'keine Nadel mehr im Haufen';
      else if (w.frei.has('kompass')) dt = `${halme(d.abstand)} Halme`;
      else if (w.frei.has('piepser')) dt = { still: 'weit weg', kalt: 'kalt', warm: 'warm', heiss: 'heiß!' }[d.stufe];
      else dt = { still: 'still', kalt: 'piept leise', warm: 'piept', heiss: 'piept wild!' }[d.stufe];
      setzeText(dText, dt);
      // Ankauf
      const unterwegs = stand.laufen > 0;
      setzeText(vText, unterwegs ? 'Unterwegs …' : 'Zum Ankauf');
      setzeText(vKlein, unterwegs ? `${rate(stand.laufen)} s` : `${halme(stand.tasche)} Halme · ${geld(stand.tasche * preisRoh(w))}`);
      vBalken.style.width = unterwegs ? `${(1 - stand.laufen / Math.max(ui.laufGesamt, 0.01)) * 100}%` : '0%';
      verkaufKnopf.disabled = unterwegs || stand.tasche <= 0;
      schalte(verkaufKnopf, 'drängt', !unterwegs && stand.tasche >= platz);
      // Sauger
      saugerKnopf.hidden = !w.frei.has('sauger');
      hitze.style.width = `${stand.sauger.hitze * 100}%`;
      schalte(saugerKnopf, 'heiss', stand.sauger.heiss);
      setzeText(sKlein, stand.sauger.heiss ? 'kühlt ab' : stand.sauger.an ? `${rate(w.saugerRate)}/s` : 'gedrückt halten');
      // Drohnen
      drohnenKnopf.hidden = !w.frei.has('drohne');
      const voll = stand.drohnen >= w.drohnenMax;
      setzeText(dKlein, voll ? `${stand.drohnen}/${w.drohnenMax} voll` : geld(drohnenKosten(stand)));
      drohnenKnopf.disabled = voll || stand.geld < drohnenKosten(stand);
    },
    weg() { saugen(stand, false); },
  };
}

/* ================================================================ Halle */

const GRUPPEN = [
  ['foerderung', 'Förderung'], ['erkennung', 'Erkennung'], ['strom', 'Strom'], ['verarbeitung', 'Verarbeitung'],
];

function freischaltTech(m) {
  return TECH.find((t) => t.effekt.some((e) => e[0] === 'frei' && e[1] === m.frei));
}

function bildHalle() {
  const w = werte(stand);
  const wurzel = h('section', { class: 'bild hallenbild' });
  el.buehne.append(wurzel);
  if (!w.frei.has('halle')) {
    const t = TECH_NACH_ID.automatisierung;
    wurzel.append(h('div', { class: 'leerkarte' },
      h('div', { class: 'grosssym', html: SYM.halle }),
      h('h2', {}, 'Noch alles Handarbeit'),
      h('p', {}, `Förderbänder, Greifarme und Maschinen gibt es, sobald du „${t.name}“ erforscht hast.`),
      h('p', { class: 'leise' }, `Kostet ${geld(techKosten(stand, t.id))}. Vorher: ${t.braucht.map((b) => TECH_NACH_ID[b].name).join(', ')}.`),
      h('button', { class: 'knopf primaer', onclick: () => { ui.wahl = t.id; wechseln('forschung'); } }, 'Zur Forschung')));
    return { aktualisieren() { if (werte(stand).frei.has('halle')) wechseln('halle'); } };
  }

  const canvas = h('canvas', { class: 'hallecanvas' });
  const szene = halleSzene(canvas);
  const kz = {};
  const kennzahl = (id, name) => {
    kz[id] = { wert: h('b', { class: 'num' }), unter: h('small', {}) };
    return h('div', { class: `kz kz-${id}` }, h('span', {}, name), kz[id].wert, kz[id].unter);
  };
  const warnungen = h('div', { class: 'warnungen' });
  wurzel.append(
    h('div', { class: 'hallenszene' }, canvas),
    h('div', { class: 'kennzahlen' },
      kennzahl('einnahmen', 'Einnahmen'), kennzahl('foerderung', 'Förderung'),
      kennzahl('band', 'Förderband'), kennzahl('strom', 'Strom'),
      kennzahl('scanner', 'Scanner'), kennzahl('plaetze', 'Stellplätze')),
    warnungen);

  const karten = {};
  for (const [gruppe, name] of GRUPPEN) {
    const liste = MASCHINEN.filter((m) => m.gruppe === gruppe);
    wurzel.append(h('h3', { class: 'gruppe' }, name));
    for (const m of liste) {
      const anzahlEl = h('span', { class: 'anzahl num' });
      const status = h('p', { class: 'mstatus' });
      const kaufen = h('button', {
        class: 'knopf kaufen', onclick: () => {
          klangWecken();
          const r = maschineKaufen(stand, m.id);
          if (r.ok) klang.kauf();
          else {
            klang.fehler();
            if (r.grund === 'platz') toast('Keine Stellplätze frei. Mehr gibt es im Hofbau.', 'warn');
          }
        },
      });
      const umschalten = h('button', { class: 'knopf klein', onclick: () => { maschineUmschalten(stand, m.id); klang.kauf(); } });
      const abbauen = h('button', {
        class: 'knopf klein', 'aria-label': 'Eine abbauen', onclick: () => {
          const r = maschineAbbauen(stand, m.id);
          if (r.ok) toast(`${m.name} abgebaut, ${geld(r.erstattung)} zurück.`);
        },
      }, '−');
      const t = freischaltTech(m);
      const gesperrt = h('button', {
        class: 'knopf klein sperre', onclick: () => { ui.wahl = t.id; wechseln('forschung'); },
      }, `Forschung: ${t.name}`);
      const karte = h('div', { class: 'mkarte' },
        h('div', { class: 'msym', html: MASCHINEN_SYM[m.id] }),
        h('div', { class: 'mtext' }, h('p', { class: 'mname' }, h('b', {}, m.name), anzahlEl), h('p', { class: 'mbeschr' }, m.text), status),
        h('div', { class: 'mknoepfe' }, kaufen, h('div', { class: 'mklein' }, umschalten, abbauen), gesperrt));
      karten[m.id] = { karte, anzahlEl, status, kaufen, umschalten, abbauen, gesperrt };
      wurzel.append(karte);
    }
  }

  let geldProSek = 0;
  return {
    zeichnen(dt) { szene.zeichnen(stand, fabrik(stand), dt, geldProSek); },
    aktualisieren() {
      const wv = werte(stand);
      const f = fabrik(stand);
      geldProSek = f.einnahmen;
      setzeText(kz.einnahmen.wert, `${geld(f.einnahmen)}/s`);
      setzeText(kz.einnahmen.unter, stand.drohnen ? `dazu Drohnen ${geld(stand.drohnen * wv.drohnenRate * preisRoh(wv))}/s` : 'am Verkaufsstand');
      setzeText(kz.foerderung.wert, `${rate(f.fluss)}/s`);
      setzeText(kz.foerderung.unter, f.foerderung > f.band + 0.01 ? `Arme könnten ${rate(f.foerderung)}/s` : 'Halme vom Haufen');
      setzeText(kz.band.wert, `${rate(f.band)}/s`);
      setzeText(kz.band.unter, f.foerderung >= f.band ? 'voll, Bandtechnik erforschen' : `${prozent(f.band ? f.fluss / f.band : 0)} ausgelastet`);
      setzeText(kz.strom.wert, `${rate(f.erzeugt)} / ${rate(f.bedarf)}`);
      setzeText(kz.strom.unter, f.strom < 1 ? `nur ${prozent(f.strom)} Leistung` : 'reicht');
      setzeText(kz.scanner.wert, prozent(f.deckung));
      setzeText(kz.scanner.unter, anzahl(stand, 'sortierer') ? `Funde sortiert ${prozent(f.sortiert)}` : 'des Heus gescannt');
      setzeText(kz.plaetze.wert, `${plaetzeBelegt(stand)} / ${wv.plaetze}`);
      setzeText(kz.plaetze.unter, 'belegt');
      schalte(kz.strom.wert.parentNode, 'schlecht', f.strom < 1);
      schalte(kz.scanner.wert.parentNode, 'schlecht', f.fluss > 0 && f.deckung < 1);
      schalte(kz.band.wert.parentNode, 'engpass', f.foerderung >= f.band && f.fluss > 0);

      const warn = [];
      if (rest(stand) <= 0) warn.push('Der Haufen ist leer. Die Arme greifen ins Nichts.');
      if (f.strom < 1) warn.push(`Der Strom reicht nicht: alle Maschinen laufen mit ${prozent(f.strom)}.`);
      if (f.fluss > 0 && f.deckung < 1) warn.push(`Nur ${prozent(f.deckung)} des Heus wird gescannt. Der Rest kann Nadeln in den Ausschuss spülen.`);
      if (f.brennstoff > 0 && f.brennstoff >= f.fluss * 0.5) warn.push('Die Generatoren verbrennen mehr als die Hälfte des Heus.');
      setzeText(warnungen, '');
      warnungen.replaceChildren(...warn.map((t) => h('p', {}, t)));

      for (const m of MASCHINEN) {
        const k = karten[m.id];
        const frei = maschineFrei(stand, m.id);
        const n = anzahl(stand, m.id);
        schalte(k.karte, 'gesperrt', !frei);
        k.gesperrt.hidden = frei;
        k.kaufen.hidden = !frei;
        k.umschalten.hidden = !frei || n === 0;
        k.abbauen.hidden = !frei || n === 0;
        setzeText(k.anzahlEl, n ? `×${n}` : '');
        const preis = maschinenKosten(stand, m.id);
        const platzFehlt = plaetzeBelegt(stand) + m.plaetze > wv.plaetze;
        setzeText(k.kaufen, platzFehlt ? 'kein Platz' : geld(preis));
        k.kaufen.disabled = platzFehlt || stand.geld < preis;
        const aus = !!stand.aus[m.id];
        setzeText(k.umschalten, aus ? 'aus' : 'an');
        schalte(k.umschalten, 'aus', aus);
        schalte(k.karte, 'ausgeschaltet', aus && n > 0);
        let st = '';
        if (frei && n) {
          if (m.gruppe === 'strom') st = `liefert ${rate(-m.strom * n * wv.stromMul)} Strom${m.brennstoff ? `, frisst ${rate(m.brennstoff * n)} Halme/s` : ''}`;
          else if (m.id === 'arm' || m.id === 'bagger') st = `Auslastung ${prozent(f.auslastung.arm || 0)}`;
          else if (m.id === 'scanner') st = `prüft ${rate(n * m.rate * wv.scanDeckung * wv.maschinenTempo * f.strom)} Halme/s`;
          else if (m.id === 'sortierer') st = `sortiert ${prozent(f.sortiert)} des Heus`;
          else if (m.id === 'sichter') st = imAusschuss(stand) ? `sucht … ${prozent(stand.ausschuss)}` : 'wartet auf Ausschuss';
          else if (m.produkt) {
            const menge = f.produkte[m.produkt] || 0;
            st = `Auslastung ${prozent(f.auslastung[m.id] || 0)} · ${PRODUKTE[m.produkt].name} je ${geld(produktPreis(wv, m.produkt))}`;
            if (menge && (m.produkt === 'ballen' || m.produkt === 'brei')) st += ` · ${rate(menge)}/s zum Verkauf`;
          }
          if (m.strom > 0) st += ` · braucht ${rate(m.strom * n * wv.verbrauch)} Strom`;
        } else if (frei && m.produkt) {
          st = `${PRODUKTE[m.produkt].name} je ${geld(produktPreis(wv, m.produkt))}`;
        }
        setzeText(k.status, st);
      }
    },
  };
}

/* ================================================================ Forschung */

const SPALTE = 168;
const ZEILE = 68;
const KARTE_B = 148;
const KARTE_H = 56;
const RAND_L = 30;
const RAND_O = 34;

function schritteName(n) {
  if (n === 0) return 'Start';
  return n === 1 ? '1 Schritt' : `${n} Schritte`;
}

function bildForschung() {
  const suchfeld = h('input', { class: 'suche', type: 'search', placeholder: 'Baum durchsuchen', value: ui.suche });
  const zaehler = h('span', { class: 'num' });
  const kopf = h('div', { class: 'forschungskopf' },
    h('div', {}, h('p', { class: 'ober' }, 'Hof-Forschung'), h('p', { class: 'fortschritt' }, zaehler, ' Upgrades')),
    suchfeld);

  const breite = RAND_L + BAUM.breite * SPALTE + 10;
  const hoehe = RAND_O + BAUM.hoehe * ZEILE + 20;
  const pos = (id) => {
    const l = BAUM.lage[id];
    return { x: RAND_L + l.x * SPALTE, y: RAND_O + l.y * ZEILE };
  };

  const ns = 'http://www.w3.org/2000/svg';
  const linien = document.createElementNS(ns, 'svg');
  linien.setAttribute('class', 'linien');
  linien.setAttribute('width', breite);
  linien.setAttribute('height', hoehe);
  const linienListe = [];
  for (const t of TECH) {
    for (const b of t.braucht) {
      // Vom Start gehen sehr viele Linien aus; die Spalte „1 Schritt“ sagt dasselbe.
      if (b === 'scheune') continue;
      const a = pos(b);
      const z = pos(t.id);
      const x1 = a.x + KARTE_B;
      const y1 = a.y + KARTE_H / 2;
      const x2 = z.x;
      const y2 = z.y + KARTE_H / 2;
      const mx = (x1 + x2) / 2;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
      const fremd = TECH_NACH_ID[b].ast !== t.ast && b !== 'scheune';
      p.setAttribute('class', fremd ? 'fremd' : '');
      linien.append(p);
      linienListe.push({ p, von: b, nach: t.id });
    }
  }

  const baender = BAUM.aeste.map((a) => {
    const ast = AST_NACH_ID[a.ast];
    return h('div', {
      class: 'band', style: {
        top: `${RAND_O + a.von * ZEILE - 6}px`, height: `${(a.bis - a.von + 1) * ZEILE}px`, '--astfarbe': ast.farbe,
      },
    }, h('span', {}, ast.name));
  });

  const spaltenKopf = h('div', { class: 'spaltenkopf', style: { width: `${breite}px` } },
    Array.from({ length: BAUM.breite }, (_, i) => h('span', { style: { left: `${RAND_L + i * SPALTE}px` } }, schritteName(i))));

  const karten = {};
  for (const t of TECH) {
    const p = pos(t.id);
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Lagerhalle', farbe: '#e8dcc4' };
    const preis = h('span', { class: 'preis num' });
    const stufe = h('span', { class: 'stufe num' });
    const karte = h('button', {
      class: 'karte', style: { left: `${p.x}px`, top: `${p.y}px`, '--astfarbe': ast.farbe },
      onclick: () => { klangWecken(); ui.wahl = t.id; blattZeigen(); },
    }, h('span', { class: 'astname' }, ast.name), h('b', {}, t.name), h('span', { class: 'kartenfuss' }, preis, stufe));
    karten[t.id] = { karte, preis, stufe };
  }

  const brett = h('div', { class: 'brett', style: { width: `${breite}px`, height: `${hoehe}px` } },
    baender, linien, Object.values(karten).map((k) => k.karte));
  const scroller = h('div', { class: 'baum' }, spaltenKopf, brett);
  const blatt = h('div', { class: 'blatt' });
  const wurzel = h('section', { class: 'bild forschungsbild' }, kopf, scroller, blatt);
  el.buehne.append(wurzel);

  const zuKarte = (id, sanft = true) => {
    const p = pos(id);
    scroller.scrollTo({
      left: Math.max(0, p.x - scroller.clientWidth / 2 + KARTE_B / 2),
      top: Math.max(0, p.y - scroller.clientHeight / 2 + KARTE_H / 2),
      behavior: sanft ? 'smooth' : 'auto',
    });
  };

  requestAnimationFrame(() => {
    if (ui.wahl) zuKarte(ui.wahl, false);
    else if (ui.baumScroll) { scroller.scrollLeft = ui.baumScroll.x; scroller.scrollTop = ui.baumScroll.y; }
    else zuKarte('scheune', false);
  });
  scroller.addEventListener('scroll', () => { ui.baumScroll = { x: scroller.scrollLeft, y: scroller.scrollTop }; }, { passive: true });

  const passt = (t, q) => !q || t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
    || (t.ast && AST_NACH_ID[t.ast].name.toLowerCase().includes(q));
  suchfeld.addEventListener('input', () => {
    ui.suche = suchfeld.value.trim().toLowerCase();
    anwendenSuche();
    const erste = TECH.find((t) => ui.suche && passt(t, ui.suche));
    if (erste) zuKarte(erste.id);
  });
  const anwendenSuche = () => {
    for (const t of TECH) schalte(karten[t.id].karte, 'blass', !!ui.suche && !passt(t, ui.suche));
  };
  anwendenSuche();

  function blattZeigen() {
    const id = ui.wahl;
    if (!id) { blatt.classList.remove('offen'); blatt.innerHTML = ''; return; }
    const t = TECH_NACH_ID[id];
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Lagerhalle', farbe: '#e8dcc4' };
    for (const [k, v] of Object.entries(karten)) schalte(v.karte, 'gewaehlt', k === id);
    const knopf = h('button', { class: 'knopf primaer breit', onclick: () => {
      klangWecken();
      const r = techKaufen(stand, id);
      if (r.ok) {
        klang.kauf();
        summen(8);
        const neu = t.effekt.find((e) => e[0] === 'frei');
        if (neu && techStufe(stand, id) === 1) toast(`${t.name} freigeschaltet.`, 'gut');
        if (id === 'automatisierung') toast('Die Halle ist offen. Schau unter „Halle“.', 'gut');
      } else klang.fehler();
      blattAktualisieren();
    } });
    const stufeEl = h('span', { class: 'num' });
    const vor = h('ul', { class: 'voraus' });
    blatt.replaceChildren(
      h('div', { class: 'blattkopf', style: { '--astfarbe': ast.farbe } },
        h('div', {}, h('p', { class: 'astname' }, ast.name), h('h3', {}, t.name)),
        h('button', { class: 'rund', 'aria-label': 'Schließen', onclick: () => { ui.wahl = null; blattZeigen(); anwendenZustand(); } }, sym(SYM.zu))),
      h('p', { class: 'blatttext' }, t.text),
      h('p', { class: 'blattstufe' }, 'Stufe ', stufeEl),
      vor,
      knopf);
    blatt.classList.add('offen');
    function blattAktualisieren() {
      const st = techStatus(stand, id);
      setzeText(stufeEl, `${techStufe(stand, id)} / ${t.stufen}`);
      vor.replaceChildren(...t.braucht.filter((b) => b !== 'scheune').map((b) => h('li', {
        class: techStufe(stand, b) ? 'erfuellt' : 'fehlt',
        onclick: () => { ui.wahl = b; blattZeigen(); zuKarte(b); },
      }, sym(techStufe(stand, b) ? SYM.haken : SYM.schloss), `braucht ${TECH_NACH_ID[b].name}`)));
      if (st === 'max') { setzeText(knopf, t.stufen > 1 ? 'Voll ausgebaut' : 'Erforscht'); knopf.disabled = true; }
      else if (st === 'gesperrt') { setzeText(knopf, `Gesperrt · ${geld(techKosten(stand, id))}`); knopf.disabled = true; }
      else {
        setzeText(knopf, `${techStufe(stand, id) ? 'Ausbauen' : 'Erforschen'} · ${geld(techKosten(stand, id))}`);
        knopf.disabled = st !== 'kaufbar';
      }
    }
    blattAktualisieren();
    blatt.aktualisieren = blattAktualisieren;
  }

  function anwendenZustand() {
    setzeText(zaehler, `${techGekauft(stand)} / ${TECH_STUFEN_GESAMT}`);
    for (const t of TECH) {
      const k = karten[t.id];
      const st = techStatus(stand, t.id);
      for (const z of ['max', 'kaufbar', 'teuer', 'gesperrt']) schalte(k.karte, z, st === z);
      schalte(k.karte, 'begonnen', techStufe(stand, t.id) > 0);
      setzeText(k.preis, st === 'max' ? (t.id === 'scheune' ? '' : 'fertig') : geld(techKosten(stand, t.id)));
      setzeText(k.stufe, t.id === 'scheune' ? '' : `${techStufe(stand, t.id)}/${t.stufen}`);
    }
    for (const l of linienListe) l.p.classList.toggle('offen', techStufe(stand, l.von) > 0);
    if (blatt.aktualisieren && ui.wahl) blatt.aktualisieren();
  }

  anwendenZustand();
  if (ui.wahl) blattZeigen();
  return { aktualisieren: anwendenZustand };
}

/* ================================================================ Funde */

function bildFunde() {
  const wurzel = h('section', { class: 'bild fundebild' });
  el.buehne.append(wurzel);

  const nadelKarten = NADELN.map((n) => {
    const name = h('b', {});
    const info = h('small', {});
    const k = h('div', { class: 'nadelkarte' }, h('div', { class: 'nsym', html: SYM.nadel }), name, info);
    return { k, name, info };
  });

  const ausFortschritt = h('div', { class: 'fuellung' });
  const ausText = h('p', {});
  const ausKnopf = h('button', { class: 'knopf primaer breit', onclick: () => {
    klangWecken();
    const e = [];
    const r = ausschussTippen(stand, e);
    if (r) { klang.stich(false); summen(5); }
    ereignisse(e);
  } }, 'Im Ausschuss wühlen');
  const ausschussKarte = h('div', { class: 'ausschusskarte' },
    h('div', { class: 'kartenkopf' }, sym(SYM.ausschuss), h('h3', {}, 'Ausschuss')),
    ausText, h('div', { class: 'balken' }, ausFortschritt), ausKnopf);

  const kisteWert = h('b', { class: 'num' });
  const kisteAnzahl = h('small', {});
  const verkaufen = h('button', { class: 'knopf primaer', onclick: () => {
    const b = fundeVerkaufen(stand);
    if (b > 0) { klang.kasse(); toast(`Fundstücke für ${geld(b)} verkauft.`, 'gut'); } else klang.fehler();
  } }, 'Alles verkaufen');
  const sammelbonus = h('p', { class: 'leise' });

  const album = {};
  const albumGitter = h('div', { class: 'album' }, FUNDE.map((f) => {
    const r = SELTEN_NACH_ID[f.stufe];
    const zahlEl = h('small', { class: 'num' });
    const name = h('b', {});
    const wert = h('small', { class: 'wert num' });
    const k = h('div', { class: 'fundkarte', style: { '--seltenfarbe': r.farbe } },
      h('div', { class: 'fsym', html: FUND_SYM[f.id] }), name, h('span', { class: 'selten' }, r.name), zahlEl, wert);
    album[f.id] = { k, zahlEl, name, wert };
    return k;
  }));

  const stat = h('dl', { class: 'werte' });

  wurzel.append(
    h('h3', { class: 'gruppe' }, 'Nadeln'),
    h('div', { class: 'nadelgitter' }, nadelKarten.map((n) => n.k)),
    ausschussKarte,
    h('div', { class: 'kiste' },
      h('div', {}, h('h3', {}, 'Fundkiste'), kisteWert, kisteAnzahl, sammelbonus), verkaufen),
    h('h3', { class: 'gruppe' }, 'Album'),
    albumGitter,
    h('h3', { class: 'gruppe' }, 'Statistik'),
    stat);

  return {
    aktualisieren() {
      const w = werte(stand);
      stand.nadeln.forEach((n, i) => {
        const k = nadelKarten[i];
        schalte(k.k, 'gefunden', n.zustand === 'gefunden');
        schalte(k.k, 'ausschuss', n.zustand === 'ausschuss');
        setzeText(k.name, n.zustand === 'gefunden' ? NADELN[i].name : n.zustand === 'ausschuss' ? 'im Ausschuss' : `Nadel ${i + 1}`);
        setzeText(k.info, n.zustand === 'gefunden' ? NADELN[i].bonus : n.zustand === 'ausschuss' ? 'raussuchen!' : 'noch im Haufen');
      });
      const aus = imAusschuss(stand);
      ausschussKarte.hidden = !aus;
      ausFortschritt.style.width = `${stand.ausschuss * 100}%`;
      setzeText(ausText, `${aus === 1 ? 'Eine Nadel ist' : `${aus} Nadeln sind`} ungescannt durchs Band gerutscht. `
        + `Etwa ${AUSSCHUSS_TIPPS} Griffe, dann hast du sie${anzahl(stand, 'sichter') ? ' — der Nadelsichter sucht mit' : ''}.`);
      const stueck = Object.values(stand.funde).reduce((n, e) => n + e.n, 0);
      setzeText(kisteWert, geld(fundWert(stand)));
      setzeText(kisteAnzahl, `${zahl(stueck)} Stück in der Kiste`);
      verkaufen.disabled = stueck === 0;
      setzeText(sammelbonus, `Sammelbonus: ${fundArten(stand)} von ${FUNDE.length} Arten entdeckt, alles ${prozent(SAMMELBONUS * fundArten(stand))} mehr wert.`);
      for (const f of FUNDE) {
        const e = stand.funde[f.id];
        const a = album[f.id];
        const bekannt = e && e.ges > 0;
        schalte(a.k, 'unbekannt', !bekannt);
        setzeText(a.name, bekannt ? f.name : '???');
        setzeText(a.zahlEl, bekannt ? `${zahl(e.n)} da · ${zahl(e.ges)} gefunden` : 'noch nie gefunden');
        setzeText(a.wert, bekannt ? `je ${geld(fundPreis(w, f.id))}` : '');
      }
      const z = [
        ['Spielzeit', dauer(stand.zeit)],
        ['Haufen', `${stand.lauf}${stand.erledigt ? ` (${stand.erledigt} geschafft)` : ''}`],
        ['Abgetragen', `${halme(stand.haufen.entfernt)} von ${halme(stand.haufen.gesamt)}`],
        ['davon von Hand', halme(stand.stat.hand || 0)],
        ['davon Drohnen', halme(stand.stat.drohne || 0)],
        ['davon Maschinen', halme(stand.stat.maschine || 0)],
        ['Schaufelstiche', zahl(stand.stat.tipps)],
        ['Gänge zum Ankauf', zahl(stand.stat.gaenge)],
        ['Fundstücke', zahl(stand.stat.funde)],
        ['Verdient', geld(stand.verdient)],
      ];
      if (stat.children.length !== z.length * 2) {
        stat.replaceChildren(...z.flatMap(([a]) => [h('dt', {}, a), h('dd', { class: 'num' })]));
      }
      z.forEach(([, b], i) => setzeText(stat.children[i * 2 + 1], b));
    },
  };
}

/* ================================================================ Menü */

function menue() {
  klangWecken();
  const stumm = klangStumm();
  const knoepfe = [
    { text: stumm ? 'Ton einschalten' : 'Ton ausschalten', aktion: () => {
      klangStumm(!stumm);
      try { localStorage.setItem(TON_KEY, klangStumm() ? 'aus' : 'an'); } catch { /* egal */ }
    } },
    { text: 'Geschichte und Anleitung', aktion: einfuehrung },
    { text: 'Spiel als Datei sichern', aktion: dateiSichern },
  ];
  if (alleNadeln(stand)) knoepfe.push({ text: 'Neuer Haufen', klasse: 'primaer', aktion: neuerHaufenFragen });
  knoepfe.push({ text: 'Spielstand löschen', klasse: 'gefahr', aktion: loeschenFragen });
  knoepfe.push({ text: 'Zurück' });
  modal({
    ober: `Haufen ${stand.lauf}`,
    titel: 'Menü',
    inhalt: h('p', { class: 'leise' }, 'Der Spielstand wird auf diesem Gerät gespeichert, alle paar Sekunden und beim Schließen. '
      + 'Die Halle arbeitet weiter, während du weg bist.'),
    knoepfe,
    klasse: 'menuemodal',
  });
}

function loeschenFragen() {
  modal({
    titel: 'Wirklich von vorn?',
    absaetze: ['Geld, Forschung, Maschinen, Nadeln und Album sind danach weg. Das lässt sich nicht rückgängig machen.'],
    knoepfe: [
      { text: 'Abbrechen' },
      { text: 'Löschen', klasse: 'gefahr', aktion: () => {
        stand = neuerStand();
        sichern();
        ui.wahl = null;
        ui.baumScroll = null;
        wechseln('haufen');
        einfuehrung();
      } },
    ],
  });
}

/* ------------------------------------------------------------ Seite als Datei */

function seitenQuelltext(cssId, jsId, ersatzTitel) {
  const css = document.getElementById(cssId)?.textContent || '';
  const js = document.getElementById(jsId)?.textContent || '';
  if (!css || !js) return null;
  const kopf = typeof SEITENKOPF === 'string' ? SEITENKOPF : `<meta charset="utf-8"><title>${ersatzTitel}</title>`;
  return [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    `<style id="${cssId}">`, css, '</style>', '</head>', '<body>',
    '<div id="app"></div>',
    `<script id="${jsId}">`, js, '<' + '/script>',
    '</body>', '</html>', '',
  ].join('\n');
}

async function dateiSichern() {
  const name = 'Heuhaufen.html';
  if (typeof OFFLINE_DATEI === 'string') {
    const a = h('a', { href: OFFLINE_DATEI, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    return;
  }
  const html = seitenQuelltext('heuhaufen-css', 'heuhaufen-js', 'Heuhaufen');
  if (!html) { toast('Im Entwicklungsmodus gibt es keine Einzeldatei. Erst bauen.', 'warn'); return; }
  const dl = typeof window !== 'undefined' && window.claude ? window.claude.downloads : null;
  if (dl) {
    try {
      await dl.save({ filename: name, data: html });
      toast('Gespeichert.', 'gut');
      return;
    } catch (fehler) {
      if (fehler && fehler.code === 'declined') return;
    }
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Die Datei liegt in den Downloads.', 'gut');
}

/* ================================================================ Schleife */

function schleife() {
  let letzte = performance.now();
  let letzteAnzeige = 0;
  const schritt = (jetzt) => {
    const dt = Math.min(0.25, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    if (dt > 0) ereignisse(tick(stand, dt));

    // Staubsauger-Geräusch folgt dem Zustand
    const saugt = stand.sauger.an && !stand.sauger.heiss && stand.laufen <= 0;
    if (saugt && !ui.saugerLaeuft) { saugerAn(); ui.saugerLaeuft = true; }
    if (!saugt && ui.saugerLaeuft) { saugerAus(); ui.saugerLaeuft = false; }
    if (saugt) saugerHitze(stand.sauger.hitze);

    // Detektor
    ui.blink = Math.max(0, ui.blink - dt * 6);
    if (ui.reiter === 'haufen' && !modalOffen()) {
      const d = detektor(stand);
      if (d.staerke > 0 && jetzt >= ui.naechsterPiep) {
        klang.piep(d.staerke);
        ui.blink = 1;
        ui.naechsterPiep = jetzt + (1300 - d.staerke * 1200);
      } else if (d.staerke <= 0) ui.naechsterPiep = jetzt;
    }

    if (ui.bildschirm && ui.bildschirm.zeichnen) ui.bildschirm.zeichnen(dt);
    if (jetzt - letzteAnzeige > 200) {
      letzteAnzeige = jetzt;
      kopfAktualisieren();
      if (ui.bildschirm) ui.bildschirm.aktualisieren();
    }
    if (jetzt - ui.gespeichert > 5000) sichern();
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

function start() {
  try { klangStumm(localStorage.getItem(TON_KEY) === 'aus'); } catch { /* egal */ }
  stand = einlesen();
  const neu = !stand;
  if (neu) stand = neuerStand();
  geruest();
  wechseln('haufen');
  if (neu) einfuehrung();
  else abwesenheitsbericht(offlineNachholen(stand));
  sichern();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saugen(stand, false); sichern(); } else {
      abwesenheitsbericht(offlineNachholen(stand));
      sichern();
    }
  });
  window.addEventListener('pagehide', sichern);
  schleife();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
