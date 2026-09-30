// Die Oberfläche: vier Reiter (Haufen, Halle, Forschung, Nadeln), ein Menü und
// ein paar Einblendungen. Die Engine rechnet, hier wird nur gezeichnet,
// angetippt und gespeichert.

import {
  AESTE, TECH, MASCHINEN, NADELN, GESCHICHTE, PRODUKTE, WERKZEUGE, MISSIONEN,
} from './daten.js';
import {
  neuerStand, werte, tick, stich, verkaufen, saugen, saugerBlockiert, techKaufen, techKosten,
  techStatus, techStufe, techLage, techGekauft, TECH_NACH_ID, TECH_STUFEN_GESAMT, BAUM_MASS,
  maschineFrei, maschinenKosten, maschineKaufen, maschineAbbauen, maschineUmschalten, plaetzeBelegt,
  platzFrei, anzahl, fabrik, drohneKaufen, drohnenKosten, nadelnGefunden, alleNadeln, artenGefunden,
  detektor, rest, stichMenge, taschePlatz, preisRoh, produktPreis, hatBand, speichern, laden,
  offlineNachholen, werkzeugWaehlen, werkzeugFrei, missionStand, auftrag, auftragLohn,
  auftragAblehnen, ladungMoeglich, ladungBestellen, ladungPreis, ladungGroesse, kreditAufschlag,
  NADELN_JE_LADUNG,
} from './engine.js';
import { zahl, halme, geld, rate, prozent, prozentAb, dauer } from './format.js';
import { klang, klangWecken, klangStumm, saugerAn, saugerAus, saugerHitze } from './klang.js';
import { SYM, WERKZEUG_SYM, MASCHINEN_SYM } from './symbole.js';
import { haufenSzene, halleSzene } from './szene.js';

const SPEICHER_KEY = 'heuhaufen-stand-v2';
const TON_KEY = 'heuhaufen-ton';
const AST_NACH_ID = Object.fromEntries(AESTE.map((a) => [a.id, a]));
const BAUM = techLage(AESTE);
const GRUPPEN_FARBE = {
  foerderung: '#e8783a', suche: '#b58be8', strom: '#e8c547', wasser: '#5aa7e0', verarbeitung: '#5fc4b0',
};

let stand = null;
const ui = {
  reiter: 'haufen',
  wahl: null,
  suche: '',
  zoom: false,
  naechsterPiep: 0,
  blink: 0,
  baumScroll: null,
  bildschirm: null,
  gespeichert: 0,
  saugerLaeuft: false,
  endeGezeigt: 0,
  passiv: false,
};

/* ------------------------------------------------------------ Helfer */

function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, x] of Object.entries(v)) {
        if (p.startsWith('--')) e.style.setProperty(p, x);
        else e.style[p] = x;
      }
    } else e.setAttribute(k, v === true ? '' : v);
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
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch { /* egal */ }
}

const preisSchild = (w) => {
  const p = preisRoh(w);
  return p < 1 ? `${p.toFixed(4).replace('.', ',')} $` : geld(p);
};

/* ------------------------------------------------------------ Speichern */

function sichern() {
  if (!stand || ui.passiv) return;
  try { localStorage.setItem(SPEICHER_KEY, speichern(stand)); } catch { /* privater Modus */ }
  ui.gespeichert = performance.now();
}

/** Der neueste lesbare Stand: aus dem Browser oder aus der mitgenommenen Datei. */
function einlesen() {
  let lokal = null;
  try {
    const roh = localStorage.getItem(SPEICHER_KEY);
    if (roh) {
      lokal = laden(roh);
      // Unlesbares nicht einfach überschreiben, sondern zur Seite legen.
      if (!lokal) localStorage.setItem(`${SPEICHER_KEY}-kaputt`, roh);
    }
  } catch { /* kein Speicher */ }
  const mit = typeof HEUHAUFEN_MITGEBRACHT === 'string' ? laden(HEUHAUFEN_MITGEBRACHT) : null;
  if (lokal && mit) return (mit.zuletzt || 0) > (lokal.zuletzt || 0) ? mit : lokal;
  return lokal || mit;
}

/* ------------------------------------------------------------ Gerüst */

const el = {};

function geruest() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  el.geld = h('span', { class: 'num' });
  el.schulden = h('small', { class: 'schulden num' });
  el.halme = h('span', { class: 'num' });
  el.ladung = h('small', {});
  el.nadeln = h('div', { class: 'nadelreihe', 'aria-label': 'Nadeln dieser Ladung' },
    Array.from({ length: NADELN_JE_LADUNG }, () => h('span', { class: 'nadelmarke', html: SYM.nadel })));
  el.nadelZahl = h('span', { class: 'nadelzahl num' });
  el.kopf = h('header', { class: 'kopf' },
    h('div', { class: 'kasse' }, sym(SYM.geld), h('div', { class: 'kassetext' }, el.geld, el.schulden)),
    h('div', { class: 'zaehler' }, el.halme, el.ladung),
    h('div', { class: 'nadelblock' }, el.nadeln, el.nadelZahl),
    h('button', { class: 'rund', 'aria-label': 'Menü', onclick: menue }, sym(SYM.menue)));
  el.buehne = h('main', { class: 'buehne' });
  el.reiter = {};
  const reiter = [
    ['haufen', 'Haufen', SYM.haufen], ['halle', 'Halle', SYM.halle],
    ['forschung', 'Forschung', SYM.forschung], ['nadeln', 'Nadeln', SYM.nadeln],
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
  document.getElementById('app').dataset.reiter = id;
  el.buehne.innerHTML = '';
  ui.bildschirm = { haufen: bildHaufen, halle: bildHalle, forschung: bildForschung, nadeln: bildNadeln }[id]();
  for (const [k, r] of Object.entries(el.reiter)) {
    schalte(r.knopf, 'aktiv', k === id);
    if (k === id) r.knopf.setAttribute('aria-current', 'page'); else r.knopf.removeAttribute('aria-current');
  }
  kopfAktualisieren();
}

function kopfAktualisieren() {
  setzeText(el.geld, geld(stand.geld));
  setzeText(el.schulden, stand.schulden > 0 ? `−${geld(stand.schulden)}` : '');
  el.schulden.title = stand.schulden > 0 ? 'Schulden' : '';
  setzeText(el.halme, halme(rest(stand)));
  setzeText(el.ladung, `Ladung ${stand.ladung}`);
  const gefunden = nadelnGefunden(stand);
  for (let i = 0; i < NADELN_JE_LADUNG; i++) {
    const m = el.nadeln.children[i];
    schalte(m, 'gefunden', i < gefunden);
    schalte(m, 'gold', i < gefunden && i === NADELN_JE_LADUNG - 1);
  }
  setzeText(el.nadelZahl, `${gefunden}/${NADELN_JE_LADUNG}`);
  const kaufbar = TECH.filter((t) => techStatus(stand, t.id) === 'kaufbar').length;
  setzeText(el.reiter.forschung.marke, kaufbar ? String(kaufbar) : '');
  schalte(el.reiter.forschung.marke, 'sichtbar', kaufbar > 0);
  const neuLadung = ladungMoeglich(stand);
  setzeText(el.reiter.nadeln.marke, neuLadung ? '!' : '');
  schalte(el.reiter.nadeln.marke, 'sichtbar', neuLadung);
  schalte(el.reiter.halle.knopf, 'zu', !hatBand(werte(stand)));
}

/* ------------------------------------------------------------ Einblendungen */

function toast(text, art = '') {
  for (const t of el.toasts.children) {
    if (t.textContent === text && !t.classList.contains('weg')) return;
  }
  const t = h('div', { class: `toast ${art}` }, text);
  el.toasts.append(t);
  while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
  document.getElementById('app').classList.add('toastan');
  setTimeout(() => t.classList.add('weg'), 2600);
  setTimeout(() => {
    t.remove();
    if (!el.toasts.children.length) document.getElementById('app').classList.remove('toastan');
  }, 3000);
}

const warteschlange = [];
const modalOffen = () => el.modal.classList.contains('offen');

function modalSchliessen() {
  el.modal.innerHTML = '';
  el.modal.classList.remove('offen');
}

function naechstesModal() {
  if (!modalOffen() && warteschlange.length) modal(warteschlange.shift());
}

/** Zeigt eine Einblendung; ist schon eine offen, wartet die neue dahinter. */
function modal(optionen) {
  if (modalOffen()) { warteschlange.push(optionen); return; }
  const { titel, ober, absaetze = [], inhalt = null, knoepfe = [], klasse = '' } = optionen;
  el.modal.innerHTML = '';
  const titelId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  const knopfListe = knoepfe.map((k) => h('button', {
    class: `knopf ${k.klasse || ''}`,
    onclick: () => {
      klangWecken();
      modalSchliessen();
      if (k.aktion) k.aktion();
      naechstesModal();
    },
  }, k.text));
  const karte = h('div', { class: `modal ${klasse}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titelId },
    ober ? h('p', { class: 'ober' }, ober) : null,
    titel ? h('h2', { id: titelId }, titel) : null,
    absaetze.map((p) => h('p', {}, p)),
    inhalt,
    h('div', { class: 'modalknoepfe' }, knopfListe));
  el.modal.append(h('div', { class: 'schleier' }), karte);
  el.modal.classList.add('offen');
  const erster = knopfListe.find((b) => b.classList.contains('primaer')) || knopfListe[0];
  if (erster) setTimeout(() => erster.focus({ preventScroll: true }), 30);
}

function einfuehrung() {
  modal({
    klasse: 'intromodal',
    ober: `Rund ${halme(ladungGroesse(stand ? stand.ladung : 1))} Halme`,
    titel: 'Finde die Nadel',
    absaetze: GESCHICHTE.anfang,
    inhalt: h('ul', { class: 'anleitung' },
      h('li', {}, 'Tippe auf den Haufen, um Heu zu stechen. Unten wählst du das Werkzeug.'),
      h('li', {}, 'Volle Tasche zum Stand bringen. Mit dem Förderband geht das später von allein.'),
      h('li', {}, 'In der Forschung gibt es bessere Werkzeuge, dann Bänder, Arme und Maschinen.'),
      h('li', {}, 'Oben im Bild steht immer eine Mission. Sie zeigt dir den nächsten Schritt.')),
    knoepfe: [{ text: 'Los geht’s', klasse: 'primaer' }],
  });
}

function nadelGefunden(e, sofort = false) {
  klang.nadel();
  summen([30, 60, 30]);
  if (ui.reiter === 'haufen' && ui.bildschirm.glanz) ui.bildschirm.glanz();
  const art = NADELN[e.art];
  const ersteLadung = e.ladung === 1;
  const text = ersteLadung ? GESCHICHTE.nadeln[e.nr - 1]
    : `Nadel ${e.nr} von ${NADELN_JE_LADUNG} aus Ladung ${e.ladung}.${e.neu ? ' Diese Art hattest du noch nicht.' : ''}`;
  const zeigen = () => modal({
    klasse: `nadelmodal${e.nr === NADELN_JE_LADUNG ? ' gold' : ''}`,
    ober: `Nadel ${e.nr} von ${NADELN_JE_LADUNG}${ersteLadung ? '' : ` · Ladung ${e.ladung}`}`,
    titel: art.name,
    inhalt: h('div', {},
      h('div', { class: 'nadelgross', html: SYM.nadel }),
      h('p', { class: 'geschichte' }, text),
      h('p', { class: 'bonus' }, e.neu ? `Neu in der Sammlung: ${art.bonus}` : `Schon in der Sammlung (${art.bonus})`)),
    knoepfe: [{
      text: e.alle ? 'Weiter' : 'Weitersuchen',
      klasse: 'primaer',
      aktion: () => { if (e.alle) ladungFertig(e.ladung); },
    }],
  });
  // Erst den Moment im Bild zeigen, dann die Karte.
  if (sofort) zeigen(); else setTimeout(() => { if (!ui.passiv) zeigen(); }, 900);
  sichern();
}

function ladungFertig(nr) {
  if (ui.endeGezeigt >= nr) return;
  ui.endeGezeigt = nr;
  const erste = nr === 1;
  modal({
    klasse: 'endemodal',
    ober: erste ? 'Die Tore sind offen' : `Ladung ${nr} geschafft`,
    titel: erste ? 'Alle sechs Nadeln' : 'Sechs Nadeln mehr',
    absaetze: [erste ? 'Die Halle gehört dir. Draußen wartet der Lieferant mit der nächsten Ladung, '
      + 'und in der Sammlung sind noch 18 Nadelarten offen.' : GESCHICHTE.ladung],
    inhalt: h('dl', { class: 'werte' },
      h('dt', {}, 'Spielzeit'), h('dd', {}, dauer(stand.aktiv)),
      h('dt', {}, 'Halme abgetragen'), h('dd', {}, halme(stand.stat.abgetragen)),
      h('dt', {}, 'Nadelarten'), h('dd', {}, `${artenGefunden(stand)} von ${NADELN.length}`),
      h('dt', {}, 'Forschung'), h('dd', {}, `${techGekauft(stand)} von ${TECH_STUFEN_GESAMT} Stufen`)),
    knoepfe: [
      { text: 'Später' },
      { text: 'Zur nächsten Ladung', klasse: 'primaer', aktion: () => wechseln('nadeln') },
    ],
  });
}

function bestellenFragen() {
  const preis = ladungPreis(stand);
  const genug = stand.geld >= preis;
  const aufschlag = kreditAufschlag(stand);
  modal({
    ober: `Ladung ${stand.ladung + 1}`,
    titel: 'Neue Ladung bestellen',
    absaetze: [
      `${halme(ladungGroesse(stand.ladung + 1))} Halme mit sechs neuen Nadeln. Forschung und Maschinen bleiben. `
        + (rest(stand) > 0 ? `Die ${halme(rest(stand))} Halme, die noch liegen, nimmt der Laster mit.` : ''),
      genug ? `Kostet ${geld(preis)}.`
        : `Kostet ${geld(preis)}, du hast ${geld(stand.geld)}. Auf Rechnung wird der Rest mit `
          + `${prozent(aufschlag - 1)} Aufschlag zu Schulden; die Hälfte jeder Einnahme geht dann an die Tilgung.`,
    ],
    knoepfe: [
      { text: 'Noch nicht' },
      genug
        ? { text: `Bestellen · ${geld(preis)}`, klasse: 'primaer', aktion: () => bestellen(false) }
        : { text: 'Auf Rechnung bestellen', klasse: 'primaer', aktion: () => bestellen(true) },
    ],
  });
}

function bestellen(aufRechnung) {
  const r = ladungBestellen(stand, { aufRechnung });
  if (!r.ok) { klang.fehler(); return; }
  klang.kasse();
  sichern();
  toast(`Ladung ${stand.ladung}: ${halme(stand.haufen.gesamt)} Halme.`, 'gut');
  wechseln('haufen');
}

function abwesenheitsbericht(b) {
  if (!b) return;
  if (b.kurz) { ereignisse(b.ereignisse); return; }
  const wer = b.drohnenAllein ? 'Die Drohnen haben' : stand.drohnen ? 'Halle und Drohnen haben' : 'Die Halle hat';
  const zeilen = [`${wer} ${halme(b.halme)} Halme abgetragen und ${geld(b.verdient)} verdient.`];
  if (b.verdient > b.geld + 0.01) zeilen.push(`Davon gingen ${geld(b.verdient - b.geld)} an die Schulden.`);
  if (b.auftraege) zeilen.push(b.auftraege === 1 ? 'Ein Auftrag wurde geliefert.' : `${b.auftraege} Aufträge wurden geliefert.`);
  if (b.nadeln) zeilen.push(b.nadeln === 1 ? 'Und eine Nadel wurde gefunden.' : `Und ${b.nadeln} Nadeln wurden gefunden.`);
  for (const e of b.ereignisse) {
    if (e.typ === 'mission') zeilen.push(`Mission erfüllt: ${e.text}${belohnungText(e) ? ` · ${belohnungText(e)}` : ''}`);
  }
  if (b.abwesend > b.sekunden + 60) {
    zeilen.push(`Gezählt wurden ${dauer(b.sekunden)} von ${dauer(b.abwesend)}. Mehr schafft die Nachtschicht noch nicht.`);
  }
  modal({ ober: `Du warst ${dauer(b.abwesend)} weg`, titel: 'Während du weg warst', absaetze: zeilen, knoepfe: [{ text: 'Gut', klasse: 'primaer' }] });
  for (const e of b.ereignisse) if (e.typ === 'nadel') nadelGefunden(e, true);
}

/* ------------------------------------------------------------ Ereignisse */

/** "+10.000 $", "Heu-Generator geschenkt" oder "330 $ statt Greifarm". */
function belohnungText(e) {
  if (e.belohnung) return e.geld ? `${geld(e.geld)} ${e.belohnung}` : e.belohnung;
  return e.geld ? `+${geld(e.geld)}` : '';
}

function ereignisse(liste) {
  const missionen = liste.filter((e) => e.typ === 'mission');
  if (missionen.length) {
    klang.fund(2);
    const letzte = missionen[missionen.length - 1];
    if (missionen.length === 1) {
      toast(`Mission erfüllt: ${letzte.text}${belohnungText(letzte) ? ` · ${belohnungText(letzte)}` : ''}`, 'gut');
    } else {
      // Mehrere auf einmal: Geld zusammenzählen, Geschenke nennen.
      const summe = missionen.filter((e) => !e.belohnung).reduce((n, e) => n + (e.geld || 0), 0);
      const teile = [summe > 0 ? `+${geld(summe)}` : '', ...missionen.filter((e) => e.belohnung).map(belohnungText)].filter(Boolean);
      toast(`${missionen.length} Missionen erfüllt${teile.length ? ` · ${teile.join(' · ')}` : ''}`, 'gut');
    }
  }
  for (const e of liste) {
    if (e.typ === 'nadel') nadelGefunden(e);
    else if (e.typ === 'zurueck') {
      klang.fehler();
      toast('Eine Nadel ist ungescannt verkauft worden und zurück in den Haufen gefallen.', 'warn');
    } else if (e.typ === 'verkauft') {
      klang.kasse();
      if (ui.reiter === 'haufen' && ui.bildschirm.standText) ui.bildschirm.standText(`+${geld(e.betrag)}`);
    } else if (e.typ === 'ueberhitzt') {
      klang.heiss();
      toast('Der Sauger ist überhitzt und muss abkühlen.', 'warn');
    } else if (e.typ === 'auftrag') {
      klang.kasse();
      toast(`Auftrag geliefert: ${zahl(e.auftrag.menge)} ${PRODUKTE[e.auftrag.will].name} · +${geld(e.lohn)}`, 'gut');
    } else if (e.typ === 'radar') {
      if (ui.reiter === 'haufen' && ui.bildschirm.radar) ui.bildschirm.radar();
    }
  }
}

/* ================================================================ Haufen */

function bildHaufen() {
  const canvas = h('canvas', { class: 'haufencanvas', 'aria-label': 'Der Heuhaufen. Tippen zum Stechen.' });
  const missionText = h('span', { class: 'missiontext' });
  const missionLohn = h('span', { class: 'missionlohn' });
  const missionBalken = h('div', { class: 'fuellung' });
  const mission = h('div', { class: 'mission', 'aria-live': 'polite' }, sym(SYM.mission), h('div', { class: 'missionkern' },
    h('div', { class: 'missionzeile' }, missionText, missionLohn), h('div', { class: 'missionbalken' }, missionBalken)));
  const hinweisZeile = h('div', { class: 'hinweis' });
  const taschenFuellung = h('div', { class: 'fuellung' });
  const taschenText = h('span', {});
  const tasche = h('div', { class: 'balken tasche', role: 'progressbar', 'aria-label': 'Tasche', 'aria-valuemin': '0' }, taschenFuellung, sym(SYM.tasche), taschenText);
  const ausdauerFuellung = h('div', { class: 'fuellung' });
  const ausdauer = h('div', { class: 'balken ausdauer', title: 'Ausdauer', role: 'progressbar', 'aria-label': 'Ausdauer', 'aria-valuemin': '0', 'aria-valuemax': '100' }, ausdauerFuellung, sym(SYM.ausdauer));
  const hitzeFuellung = h('div', { class: 'fuellung' });
  const hitze = h('div', { class: 'balken hitze', title: 'Hitze des Saugers', role: 'progressbar', 'aria-label': 'Hitze des Saugers', 'aria-valuemin': '0', 'aria-valuemax': '100' }, hitzeFuellung, h('span', {}, 'Hitze'));
  const werkzeugSchild = h('div', { class: 'werkzeugschild' });
  const maschinenZeile = h('div', { class: 'maschinenzeile' });
  const balkenReihe = h('div', { class: 'balkenreihe' }, tasche, ausdauer, hitze);
  const schildReihe = h('div', { class: 'schildreihe' }, maschinenZeile, werkzeugSchild);
  const unten = h('div', { class: 'szeneunten' }, balkenReihe, schildReihe);
  const szeneBox = h('div', { class: 'szene' }, canvas, h('div', { class: 'szeneoben' }, mission, hinweisZeile), unten);

  const segmente = Array.from({ length: 12 }, () => h('span', { class: 'seg' }));
  const dText = h('span', { class: 'dtext' });
  const detektorLeiste = h('div', { class: 'detektorleiste' }, sym(SYM.lupe), h('div', { class: 'segmente' }, segmente), dText);

  const werkzeugKnoepfe = {};
  const leiste = h('div', { class: 'werkzeugleiste', role: 'toolbar', 'aria-label': 'Werkzeuge' }, WERKZEUGE.map((wz) => {
    const b = h('button', {
      class: 'wz', 'aria-label': wz.name, title: wz.text,
      onclick: () => {
        klangWecken();
        if (werkzeugWaehlen(stand, wz.id)) { klang.klick(); letzteAktualisierung(); }
      },
    }, sym(WERKZEUG_SYM[wz.id]), h('span', {}, wz.kurz || wz.name));
    werkzeugKnoepfe[wz.id] = b;
    return b;
  }));

  const vText = h('span', { class: 'zeile1' }, 'Zum Stand');
  const vKlein = h('small', {});
  const vBalken = h('div', { class: 'lauf' });
  const verkaufKnopf = h('button', {
    class: 'aktion gross', onclick: () => {
      klangWecken();
      if (!verkaufen(stand)) klang.fehler();
    },
  }, sym(SYM.ankauf), h('span', { class: 'aktiontext' }, vText, vKlein), vBalken);

  const dKlein = h('small', {});
  const drohnenKnopf = h('button', {
    class: 'aktion drohne', onclick: () => {
      klangWecken();
      const r = drohneKaufen(stand);
      if (r.ok) { klang.kauf(); toast('Eine Drohne mehr in der Luft.'); } else klang.fehler();
    },
  }, sym(SYM.drohne), h('span', { class: 'aktiontext' }, h('span', { class: 'zeile1' }, 'Drohne'), dKlein));

  const ladungKnopf = h('button', { class: 'aktion ladungknopf', onclick: () => { klangWecken(); bestellenFragen(); } },
    sym(SYM.ladung), h('span', { class: 'aktiontext' }, h('span', { class: 'zeile1' }, 'Neue Ladung'), h('small', {}, 'bestellen')));

  const aktionen = h('div', { class: 'aktionen' }, verkaufKnopf, ladungKnopf, drohnenKnopf);
  const seite = h('div', { class: 'haufenseite' }, detektorLeiste, leiste, aktionen);
  const wurzel = h('section', { class: 'bild haufenbild' }, szeneBox, seite);
  // Im Querformat stehen Balken und Schilder in der Seitenleiste, damit der Boden frei bleibt.
  const quer = typeof matchMedia === 'function' ? matchMedia('(orientation: landscape) and (max-height: 520px)') : null;
  const querLegen = () => {
    if (quer && quer.matches) { if (unten.parentNode !== seite) seite.prepend(unten); }
    else if (unten.parentNode !== szeneBox) szeneBox.append(unten);
  };
  querLegen();
  if (quer) quer.addEventListener('change', querLegen);
  el.buehne.append(wurzel);

  const szene = haufenSzene(canvas);

  const punkt = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    klangWecken();
    const { x, y } = punkt(ev);
    if (stand.werkzeug === 'sauger') {
      saugen(stand, true);
      canvas.setPointerCapture?.(ev.pointerId);
      const grund = saugerBlockiert(stand);
      if (grund) szene.text(x, y - 10, { heiss: 'Zu heiß!', unterwegs: 'Unterwegs …', leer: 'Der Haufen ist leer', voll: 'Tasche voll!' }[grund], '#ffb36b', 14);
      return;
    }
    const e = [];
    const erg = stich(stand, e);
    if (!erg) { szene.text(x, y - 10, 'Unterwegs …', '#fff4dc', 13); return; }
    if (erg.detektor) {
      const d = detektor(stand);
      klang.piep(Math.max(0.1, d.staerke));
      ui.blink = 1;
      szene.text(x, y - 10, d.abstand == null ? 'Keine Nadel mehr' : { still: 'Nichts …', kalt: 'Leises Piepen', warm: 'Es piept!', heiss: 'Ganz nah!' }[d.stufe], '#d6f5ff', 14);
    } else if (erg.menge > 0) {
      szene.stich(x, y, erg.menge, erg.krit, hatBand(werte(stand)));
      klang.stich(erg.krit);
      if (erg.krit) summen(15);
      if (erg.muede) szene.text(x, y + 14, 'Aus der Puste', '#ffb36b', 12);
    } else if (erg.leer) szene.text(x, y - 10, 'Der Haufen ist leer', '#ffb36b', 14);
    else if (erg.nichts) szene.text(x, y - 10, 'Nichts zu fegen', '#fff4dc', 13);
    else if (erg.voll) { szene.text(x, y - 10, 'Tasche voll!', '#ffb36b', 15); klang.fehler(); }
    ereignisse(e);
  });
  const saugEnde = () => saugen(stand, false);
  canvas.addEventListener('pointerup', saugEnde);
  canvas.addEventListener('pointercancel', saugEnde);
  canvas.addEventListener('lostpointercapture', saugEnde);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  let letzterHinweis = '';
  function letzteAktualisierung() {
    const w = werte(stand);
    for (const wz of WERKZEUGE) {
      const b = werkzeugKnoepfe[wz.id];
      b.hidden = !werkzeugFrei(stand, wz.id);
      schalte(b, 'gewaehlt', stand.werkzeug === wz.id);
      b.setAttribute('aria-pressed', String(stand.werkzeug === wz.id));
    }
    // Mission
    const ms = missionStand(stand);
    mission.hidden = !ms;
    if (ms) {
      setzeText(missionText, ms.m.text);
      const lohn = ms.m.geschenk || ms.m.geschenkTech ? 'Geschenk' : ms.m.geld ? `+${geld(ms.m.geld)}` : '';
      const zaehlbar = !['tech', 'werkzeug', 'ladungen', 'haelfte'].includes(ms.m.art) && ms.ziel > 1;
      // Große Ziele als Prozent: "456.834/1,00 Mio." liest keiner.
      const fortschritt = ms.m.art === 'haelfte' ? ` · ${prozentAb(ms.ist)} von 50 %`
        : zaehlbar && ms.ziel >= 1e5 ? ` · ${prozentAb(ms.ist / ms.ziel)}`
        : zaehlbar ? ` · ${zahl(ms.ist)}/${zahl(ms.ziel)}` : '';
      setzeText(missionLohn, `${lohn}${fortschritt}`);
      missionBalken.style.width = `${Math.min(100, (ms.ist / ms.ziel) * 100)}%`;
    }
    // Hinweis nur für das, was keine Mission sagt
    let hw = '';
    if (ladungMoeglich(stand)) hw = 'Alle Nadeln dieser Ladung gefunden. Unter „Nadeln“ bestellst du die nächste.';
    else if (ms && ms.m.art === 'gefegt' && !w.frei.has('besen')) hw = 'Den Besen gibt es in der Forschung unter Handarbeit.';
    else if (rest(stand) <= 0) hw = 'Der Haufen ist leer.';
    else if (!hatBand(w) && stand.laufen <= 0 && stand.tasche >= taschePlatz(w)) hw = 'Die Tasche ist voll. Bring das Heu zum Stand.';
    else if (hatBand(w) && w.frei.has('generator') && fabrik(stand).fluss > 0 && fabrik(stand).deckung < 0.95) {
      hw = w.frei.has('scanner') ? 'Nicht alles Heu auf dem Band wird gescannt. Nadeln können zurückfallen.'
        : 'Ohne Scanner fallen Nadeln, die Maschinen erwischen, zurück in den Haufen.';
    }
    if (hw !== letzterHinweis) {
      letzterHinweis = hw;
      setzeText(hinweisZeile, hw);
      schalte(hinweisZeile, 'sichtbar', !!hw);
    }
    // Tasche und Ausdauer
    const band = hatBand(w);
    const platz = taschePlatz(w);
    tasche.hidden = band && stand.tasche <= 0;
    taschenFuellung.style.width = `${Math.min(100, (stand.tasche / platz) * 100)}%`;
    setzeText(taschenText, `${halme(stand.tasche)} / ${halme(platz)}`);
    schalte(tasche, 'voll', stand.tasche >= platz);
    ausdauerFuellung.style.width = `${Math.min(100, (stand.ausdauer / w.ausdauer) * 100)}%`;
    tasche.setAttribute('aria-valuemax', String(Math.round(platz)));
    tasche.setAttribute('aria-valuenow', String(Math.round(stand.tasche)));
    ausdauer.setAttribute('aria-valuenow', String(Math.round((stand.ausdauer / w.ausdauer) * 100)));
    hitze.setAttribute('aria-valuenow', String(Math.round(stand.sauger.hitze * 100)));
    schalte(ausdauer, 'leer', stand.ausdauer < w.ausdauerKosten);
    hitze.hidden = stand.werkzeug !== 'sauger' && stand.sauger.hitze <= 0;
    hitzeFuellung.style.width = `${Math.round(stand.sauger.hitze * 100)}%`;
    schalte(hitze, 'heiss', stand.sauger.heiss);
    // Was in der Halle arbeitet, steht als Zeile unten im Bild, nicht auf die Leinwand gemalt.
    // Kurz, damit alles in eine Zeile passt; ausgeschrieben steht es im title.
    const liste = [['arm', 'Arm', 'Arme', 'Arme'], ['rechen', 'Rechen', 'Rechen', 'Rechen'], ['generator', 'Generator', 'Generatoren', 'Generatoren']]
      .filter(([id]) => stand.maschinen[id] > 0)
      .map(([id, eins, viele, kurz]) => {
        const n = stand.maschinen[id];
        const aus = stand.aus[id] ? ' (aus)' : '';
        return [`${n} ${n === 1 ? eins : viele}${aus}`, `${n} ${n === 1 ? eins : kurz}${aus}`];
      });
    // Drohnen stehen auf ihrem eigenen Knopf.
    const zaehl = liste.map((x) => x[0]);
    setzeText(maschinenZeile, liste.map((x) => x[1]).join(' · '));
    maschinenZeile.title = zaehl.join(' · ');
    maschinenZeile.hidden = !zaehl.length;
    // Ohne Tasche ist die obere Reihe frei: dann steht die Maschinenzeile dort und das Werkzeugschild allein.
    const oben = tasche.hidden && hitze.hidden ? balkenReihe : schildReihe;
    if (maschinenZeile.parentNode !== oben) oben.prepend(maschinenZeile);
    const wzName = WERKZEUGE.find((x) => x.id === stand.werkzeug).kurz;
    let info = '';
    if (['spaten', 'heugabel', 'sandschaufel'].includes(stand.werkzeug)) info = `${rate(stichMenge(w, stand.werkzeug))} pro Stich`;
    else if (stand.werkzeug === 'besen') info = `${halme(stand.boden)} am Boden`;
    else if (stand.werkzeug === 'sauger') {
      const grund = saugerBlockiert(stand);
      info = grund ? { heiss: 'kühlt ab', unterwegs: 'unterwegs', leer: 'Haufen leer', voll: 'Tasche voll' }[grund] : `${rate(w.saugerRate)}/s, gedrückt halten`;
    } else info = 'auf den Haufen tippen';
    // Mit Band sieht man, wohin das Heu geht; das Schild bleibt kurz.
    setzeText(werkzeugSchild, `${wzName} · ${info}`);
    // Detektor
    const d = detektor(stand);
    const inHand = stand.werkzeug === 'detektor';
    schalte(detektorLeiste, 'aus', !inHand && !stand.maschinen.radar);
    const an = inHand ? Math.round(d.staerke * segmente.length) : 0;
    segmente.forEach((sg, i) => {
      schalte(sg, 'an', i < an);
      schalte(sg, 'heiss', i < an && i >= segmente.length * 0.7);
    });
    let dt = '';
    if (d.abstand == null) dt = 'keine Nadel mehr im Haufen';
    else if (inHand && w.frei.has('piepser')) dt = { still: 'weit weg', kalt: 'kalt', warm: 'warm', heiss: 'heiß!' }[d.stufe];
    else if (inHand) dt = { still: 'still', kalt: 'piept leise', warm: 'piept', heiss: 'piept wild!' }[d.stufe];
    else dt = 'Detektor in die Hand nehmen';
    if (stand.maschinen.radar && stand.radar.abstand != null) {
      const vor = stand.zeit - stand.radar.zeit;
      dt = `Radar: ${halme(stand.radar.abstand)} Halme (vor ${dauer(vor)})${inHand ? ` · ${dt}` : ''}`;
    }
    setzeText(dText, dt);
    // Stand
    const unterwegs = stand.laufen > 0;
    verkaufKnopf.hidden = band && stand.tasche <= 0 && !unterwegs;
    setzeText(vText, unterwegs ? 'Unterwegs …' : 'Zum Stand');
    setzeText(vKlein, unterwegs ? `${rate(stand.laufen)} s` : `${halme(stand.tasche)} Halme · ${geld(stand.tasche * preisRoh(w))}`);
    vBalken.style.width = unterwegs ? `${Math.max(0, Math.min(1, 1 - stand.laufen / Math.max(stand.laufVoll, 0.01))) * 100}%` : '0%';
    verkaufKnopf.disabled = unterwegs || stand.tasche <= 0;
    schalte(verkaufKnopf, 'draengt', !unterwegs && stand.tasche >= platz);
    ladungKnopf.hidden = !ladungMoeglich(stand);
    drohnenKnopf.hidden = !w.frei.has('drohne');
    const voll = stand.drohnen >= w.drohnenMax;
    setzeText(dKlein, voll ? `${stand.drohnen}/${w.drohnenMax} voll` : geld(drohnenKosten(stand)));
    drohnenKnopf.disabled = voll || stand.geld < drohnenKosten(stand);
  }

  return {
    glanz: () => szene.nadelGlanz(),
    radar: () => szene.radarPing(),
    standText: (t) => szene.standText(t),
    zeichnen(dt) {
      const w = werte(stand);
      const f = hatBand(w) ? fabrik(stand) : null;
      szene.zeichnen(stand, {
        laufAnteil: stand.laufen > 0 ? 1 - stand.laufen / Math.max(stand.laufVoll, 0.01) : null,
        saugt: stand.sauger.an && !saugerBlockiert(stand),
        saugerAktiv: stand.werkzeug === 'sauger',
        hitze: stand.sauger.hitze,
        fabrik: f,
        torOffen: stand.ladung > 1 || alleNadeln(stand),
        boden: stand.boden,
        uhr: stand.aktiv,
        preisText: preisSchild(w),
      }, dt);
    },
    aktualisieren: letzteAktualisierung,
    weg() { saugen(stand, false); if (quer) quer.removeEventListener('change', querLegen); },
  };
}

/* ================================================================ Halle */

const GRUPPEN = [
  ['foerderung', 'Förderung'], ['suche', 'Suche'], ['strom', 'Strom'], ['wasser', 'Wasser'], ['verarbeitung', 'Verarbeitung'],
];

function freischaltTech(m) {
  return TECH.find((t) => t.effekt.some((e) => e[0] === 'frei' && e[1] === m.frei));
}

function bildHalle() {
  const w0 = werte(stand);
  const wurzel = h('section', { class: 'bild hallenbild' });
  el.buehne.append(wurzel);
  if (!hatBand(w0)) {
    const t = TECH_NACH_ID.foerderband;
    wurzel.append(h('div', { class: 'leerkarte' },
      h('div', { class: 'grosssym', html: SYM.halle }),
      h('h2', {}, 'Noch alles Handarbeit'),
      h('p', {}, `Förderbänder, Rechen, Arme und Maschinen gibt es, sobald du die „${t.name}“ erforscht hast.`),
      h('p', { class: 'leise' }, `Kostet ${geld(techKosten(stand, t.id))}.`),
      h('button', { class: 'knopf primaer', onclick: () => { ui.wahl = t.id; wechseln('forschung'); } }, 'Zur Forschung')));
    return { aktualisieren() { if (hatBand(werte(stand))) wechseln('halle'); } };
  }

  const canvas = h('canvas', { class: 'hallecanvas' });
  const szene = halleSzene(canvas);
  const kz = {};
  const kennzahl = (id, name) => {
    kz[id] = { wert: h('b', { class: 'num' }), unter: h('small', {}) };
    kz[id].box = h('div', { class: `kz kz-${id}` }, h('span', {}, name), kz[id].wert, kz[id].unter);
    return kz[id].box;
  };
  const warnungen = h('div', { class: 'warnungen' });

  // Auftrag
  const aTitel = h('b', {});
  const aKunde = h('p', { class: 'ober' }, 'Auftrag');
  const aInfo = h('small', {});
  const aBalken = h('div', { class: 'fuellung' });
  const aAblehnen = h('button', { class: 'knopf klein', onclick: () => {
    if (auftragAblehnen(stand)) { klang.klick(); toast('Auftrag abgelehnt. Der nächste kommt gleich.'); }
  } }, 'Ablehnen');
  const auftragKarte = h('div', { class: 'auftragkarte' },
    h('div', { class: 'kartenkopf' }, sym(SYM.laster), h('div', {}, aKunde, aTitel)),
    aInfo, h('div', { class: 'balken dünn' }, aBalken), h('div', { class: 'auftragknoepfe' }, aAblehnen));

  wurzel.append(
    h('div', { class: 'hallenszene' }, canvas),
    h('div', { class: 'kennzahlen' },
      kennzahl('einnahmen', 'Einnahmen'), kennzahl('foerderung', 'Förderung'),
      kennzahl('band', 'Förderband'), kennzahl('strom', 'Strom'),
      kennzahl('wasser', 'Wasser'), kennzahl('scanner', 'Scanner'),
      kennzahl('plaetze', 'Stellplätze')),
    warnungen, auftragKarte);

  const karten = {};
  for (const [gruppe, name] of GRUPPEN) {
    const liste = MASCHINEN.filter((m) => m.gruppe === gruppe);
    const kopf = h('h3', { class: 'gruppe' }, name);
    wurzel.append(kopf);
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
            if (r.grund === 'platz') toast('Keine Stellplätze frei. Mehr gibt es unter Hofbau in der Forschung.', 'warn');
          }
        },
      });
      const umschalten = h('button', {
        class: 'knopf klein', onclick: () => { maschineUmschalten(stand, m.id); klang.klick(); },
      });
      let sicher = -Infinity;
      const abbauen = h('button', {
        class: 'knopf klein', 'aria-label': `${m.name} abbauen`, onclick: () => {
          if (performance.now() - sicher > 2500) {
            sicher = performance.now();
            setzeText(abbauen, 'sicher?');
            setTimeout(() => setzeText(abbauen, '−'), 2500);
            return;
          }
          sicher = -Infinity;
          setzeText(abbauen, '−');
          const r = maschineAbbauen(stand, m.id);
          if (r.ok) toast(`${m.name} abgebaut, ${geld(r.erstattung)} zurück.`);
        },
      }, '−');
      const t = freischaltTech(m);
      const gesperrt = h('button', {
        class: 'knopf klein sperre', onclick: () => { ui.wahl = t.id; wechseln('forschung'); },
      }, `Forschung: ${t.name}`);
      const karte = h('div', { class: 'mkarte', style: { '--gruppenfarbe': GRUPPEN_FARBE[gruppe] } },
        h('div', { class: 'msym', html: MASCHINEN_SYM[m.id] }),
        h('div', { class: 'mtext' }, h('p', { class: 'mname' }, h('b', {}, m.name), anzahlEl), h('p', { class: 'mbeschr' }, m.text), status),
        h('div', { class: 'mknoepfe' }, kaufen, h('div', { class: 'mklein' }, umschalten, abbauen), gesperrt));
      karten[m.id] = { karte, anzahlEl, status, kaufen, umschalten, abbauen, gesperrt, kopf };
      wurzel.append(karte);
    }
  }

  let geldProSek = 0;
  return {
    zeichnen(dt) {
      const lasterDa = werte(stand).frei.has('auftraege') && stand.auftrag.pause <= 0;
      szene.zeichnen(stand, fabrik(stand), dt, geldProSek, lasterDa);
    },
    aktualisieren() {
      const wv = werte(stand);
      const f = fabrik(stand);
      geldProSek = f.einnahmen;
      const drohnenGeld = rest(stand) > 0 ? stand.drohnen * wv.drohnenRate * preisRoh(wv) : 0;
      setzeText(kz.einnahmen.wert, `${geld(f.einnahmen)}/s`);
      setzeText(kz.einnahmen.unter, stand.drohnen ? `dazu Drohnen ${geld(drohnenGeld)}/s` : 'am Verkaufsstand');
      setzeText(kz.foerderung.wert, `${rate(f.fluss)}/s`);
      setzeText(kz.foerderung.unter, f.foerderung > f.band + 0.01 ? `Arme und Rechen könnten ${rate(f.foerderung)}/s` : 'Halme vom Haufen');
      setzeText(kz.band.wert, `${rate(f.band)}/s`);
      setzeText(kz.band.unter, f.moeglich > 0 && f.foerderung >= f.band ? 'voll: Bandmotor erforschen' : `${prozent(f.band ? f.fluss / f.band : 0)} ausgelastet`);
      setzeText(kz.strom.wert, `${rate(f.erzeugt)} / ${rate(f.bedarf)}`);
      setzeText(kz.strom.unter, f.strom < 1 ? `nur ${prozentAb(f.strom)} Leistung` : 'reicht');
      kz.wasser.box.hidden = !wv.frei.has('brunnen');
      setzeText(kz.wasser.wert, `${rate(f.wasser)} / ${rate(f.wasserBedarf)}`);
      setzeText(kz.wasser.unter, f.wasserAnteil < 1 ? `nur ${prozentAb(f.wasserAnteil)} des Bedarfs` : 'reicht');
      setzeText(kz.scanner.wert, prozentAb(f.deckung));
      setzeText(kz.scanner.unter, 'des Heus gescannt');
      setzeText(kz.plaetze.wert, `${plaetzeBelegt(stand)} / ${wv.plaetze}`);
      setzeText(kz.plaetze.unter, plaetzeBelegt(stand) >= wv.plaetze ? 'voll: Hofbau erforschen' : 'belegt');
      schalte(kz.strom.box, 'schlecht', f.strom < 1 && f.bedarf > 0);
      schalte(kz.wasser.box, 'schlecht', f.wasserAnteil < 1);
      schalte(kz.scanner.box, 'schlecht', f.fluss > 0 && f.deckung < 1);
      schalte(kz.band.box, 'engpass', f.moeglich > 0 && f.foerderung >= f.band && f.fluss > 0);

      const warn = [];
      if (rest(stand) <= 0) warn.push('Der Haufen ist leer. Unter „Nadeln“ gibt es die nächste Ladung.');
      else if (f.strom < 1 && f.bedarf > 0) {
        warn.push(f.brennBedarf > 0 && f.fluss < f.brennBedarf
          ? 'Die Generatoren bekommen zu wenig Heu vom Band. Mehr Rechen oder Arme, oder weniger Maschinen.'
          : `Der Strom reicht nicht: alle Maschinen laufen mit ${prozentAb(f.strom)}.${wv.frei.has('generator') ? '' : ' Mehr Strom gibt es mit „Elektrizität“ in der Forschung.'}`);
      }
      if (f.fluss > 0 && f.deckung < 1) warn.push(`Nur ${prozentAb(f.deckung)} des Heus wird gescannt. Übersehene Nadeln fallen zurück in den Haufen.`);
      if (f.wasserAnteil < 1) warn.push('Das Wasser reicht nicht für alle Pulper und Papiermaschinen.');
      const warnText = warn.join('|');
      if (warnungen.dataset.text !== warnText) {
        warnungen.dataset.text = warnText;
        warnungen.replaceChildren(...warn.map((t) => h('p', {}, t)));
      }

      // Auftrag
      auftragKarte.hidden = !wv.frei.has('auftraege');
      if (!auftragKarte.hidden) {
        const au = auftrag(stand.auftrag.nr, stand.auftrag.skip);
        const name = PRODUKTE[au.will].name;
        setzeText(aKunde, stand.auftrag.pause > 0 || !au.titel ? 'Auftrag' : `Auftrag · ${au.titel}`);
        if (stand.auftrag.pause > 0) {
          setzeText(aTitel, 'Der Laster ist unterwegs');
          setzeText(aInfo, `Nächster Auftrag in ${dauer(stand.auftrag.pause)}.`);
          aBalken.style.width = '0%';
          aAblehnen.hidden = true;
        } else {
          const rateP = au.will === 'roh' ? f.roh : (f.produkte[au.will] || 0);
          setzeText(aTitel, `${zahl(au.menge)} ${name} · ${geld(auftragLohn(stand, au))}`);
          setzeText(aInfo, rateP > 0
            ? `${zahl(stand.auftrag.geliefert)} von ${zahl(au.menge)} geladen · ${rate(rateP)}/s`
            : `Gerade entsteht in der Halle nichts davon (${name}). Ablehnen, oder die passende Maschine bauen.`);
          aBalken.style.width = `${Math.min(100, (stand.auftrag.geliefert / au.menge) * 100)}%`;
          aAblehnen.hidden = false;
        }
      }

      const gruppeSichtbar = {};
      for (const m of MASCHINEN) {
        const k = karten[m.id];
        const frei = maschineFrei(stand, m.id);
        const n = anzahl(stand, m.id);
        const t = freischaltTech(m);
        // Gesperrtes erst zeigen, wenn es erreichbar ist: die Voraussetzungen der Forschung sind erfüllt.
        const inSicht = frei || (t && t.braucht.every((b) => techStufe(stand, b) > 0));
        k.karte.hidden = !inSicht;
        if (inSicht) gruppeSichtbar[m.gruppe] = true;
        schalte(k.karte, 'gesperrt', !frei);
        k.gesperrt.hidden = frei;
        k.kaufen.hidden = !frei;
        k.umschalten.hidden = !frei || n === 0;
        k.abbauen.hidden = !frei || n === 0;
        setzeText(k.anzahlEl, n ? `×${n}` : '');
        const preis = maschinenKosten(stand, m.id);
        const platzFehlt = !platzFrei(stand, m.id);
        setzeText(k.kaufen, platzFehlt ? 'kein Platz' : geld(preis));
        k.kaufen.disabled = !platzFehlt && stand.geld < preis;
        schalte(k.kaufen, 'ohneplatz', platzFehlt);
        const aus = !!stand.aus[m.id];
        setzeText(k.umschalten, aus ? 'aus' : 'läuft');
        k.umschalten.setAttribute('aria-pressed', String(!aus));
        k.umschalten.setAttribute('aria-label', `${m.name} ${aus ? 'einschalten' : 'ausschalten'}`);
        schalte(k.umschalten, 'aus', aus);
        schalte(k.karte, 'ausgeschaltet', aus && n > 0);
        let st = '';
        if (frei && n) {
          if (m.gruppe === 'strom') {
            const l = f.leistung[m.id] || 0;
            // Frisst, was wirklich ankommt, nicht was er gern hätte.
            const hunger = m.brennstoff && f.brennBedarf > 0 && f.brennstoff < f.brennBedarf * 0.95;
            st = aus ? 'ausgeschaltet' : `liefert ${rate(l)} Strom${m.brennstoff ? `, frisst ${rate(f.brennstoff)} Halme/s` : ''}${hunger ? ' · zu wenig Heu' : ''}`;
          } else if (m.id === 'arm' || m.id === 'rechen') st = `Auslastung ${prozent(f.auslastung.arm || 0)}`;
          else if (m.id === 'rohrwerfer') st = `Band +${prozent(n * m.rate * wv.werfer)}`;
          else if (m.id === 'scanner') st = `prüft ${rate(n * m.rate * wv.scanDeckung * wv.maschinenTempo * f.strom)} Halme/s`;
          else if (m.id === 'radar') st = `pingt alle ${dauer(wv.radarCD / n)}`;
          else if (m.id === 'brunnen') st = `pumpt ${rate(f.wasser)} Wasser/s`;
          else if (m.produkt) {
            const aus2 = f.auslastung[m.id] || 0;
            st = `Auslastung ${prozent(aus2)} · ${PRODUKTE[m.produkt].name} je ${geld(produktPreis(wv, m.produkt))}`;
            if (aus2 < 0.05 && !aus) st += m.rezept.halme ? ' · bekommt nichts vom Band' : ' · es fehlen Zutaten';
            else if (wv.verteilung < 1 && aus2 >= wv.verteilung - 0.01) st += ' · Stau, Weichen helfen';
          }
          if (m.strom > 0 && !aus) st += ` · braucht ${rate(m.strom * n * wv.verbrauch)} Strom`;
        } else if (frei && m.produkt) st = `${PRODUKTE[m.produkt].name} je ${geld(produktPreis(wv, m.produkt))}`;
        setzeText(k.status, st);
      }
      for (const m of MASCHINEN) karten[m.id].kopf.hidden = !gruppeSichtbar[m.gruppe];
    },
  };
}

/* ================================================================ Forschung */

const SPALTE = 192;
const ZEILE = 78;
const KARTE_B = 172;
const RAND_L = 34;
const RAND_O = 36;
/** Maßstab der Übersicht; muss zu .baum.uebersicht .brettrahmen in style.css passen. */
const UEBERSICHT = 0.6;

const schritteName = (n) => (n === 0 ? 'Start' : n === 1 ? '1 Schritt' : `${n} Schritte`);

function bildForschung() {
  const suchfeld = h('input', { class: 'suche', type: 'search', id: 'baum-suche', placeholder: 'Suchen', 'aria-label': 'Forschung durchsuchen', value: ui.suche });
  const zaehler = h('span', { class: 'num' });
  const treffer = h('span', { class: 'treffer' });
  const zoomKnopf = h('button', { class: 'rund', 'aria-label': 'Übersicht umschalten', onclick: () => {
    // Die Mitte des Blicks bleibt, wo sie war, oder die gewählte Karte.
    const f0 = ui.zoom ? UEBERSICHT : 1;
    const mx = (scroller.scrollLeft + scroller.clientWidth / 2) / f0;
    const my = (scroller.scrollTop + scroller.clientHeight / 2) / f0;
    ui.zoom = !ui.zoom;
    schalte(scroller, 'uebersicht', ui.zoom);
    zoomKnopf.innerHTML = '';
    zoomKnopf.append(sym(ui.zoom ? SYM.zoomEin : SYM.zoomAus));
    if (ui.wahl) zuKarte(ui.wahl, false);
    else {
      const f1 = ui.zoom ? UEBERSICHT : 1;
      scroller.scrollLeft = Math.max(0, mx * f1 - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, my * f1 - scroller.clientHeight / 2);
    }
  } }, sym(ui.zoom ? SYM.zoomEin : SYM.zoomAus));
  const kopf = h('div', { class: 'forschungskopf' },
    h('div', { class: 'fkopflinks' }, h('p', { class: 'ober' }, 'Hof-Forschung'), h('p', { class: 'fortschritt' }, zaehler, ' Stufen')),
    h('div', { class: 'suchbox' }, suchfeld, treffer), zoomKnopf);

  const chips = {};
  const chipReihe = h('div', { class: 'astchips' }, AESTE.map((a) => {
    const n = h('span', { class: 'num' });
    const c = h('button', {
      class: 'astchip', style: { '--astfarbe': a.farbe },
      onclick: () => {
        const b = BAUM.aeste.find((x) => x.ast === a.id);
        scroller.scrollTo({ top: Math.max(0, (RAND_O + b.von * ZEILE - 30) * (ui.zoom ? UEBERSICHT : 1)), behavior: 'smooth' });
      },
    }, a.name, n);
    chips[a.id] = { c, n };
    return c;
  }));

  const breite = RAND_L + BAUM.breite * SPALTE + 10;
  const hoehe = RAND_O + BAUM.hoehe * ZEILE + 30;
  const pos = (id) => {
    const l = BAUM.lage[id];
    return { x: RAND_L + l.x * SPALTE, y: RAND_O + l.y * ZEILE, h: l.h * ZEILE };
  };
  const gruppeVon = {};
  for (const gr of BAUM.gruppen) for (const id of gr.ids) gruppeVon[id] = gr;

  const ns = 'http://www.w3.org/2000/svg';
  const linien = document.createElementNS(ns, 'svg');
  linien.setAttribute('class', 'linien');
  linien.setAttribute('width', breite);
  linien.setAttribute('height', hoehe);
  const linienListe = [];
  const gezogen = new Set();
  for (const t of TECH) {
    for (const b of t.braucht) {
      if (b === 'scheune') continue;
      // Zu einer Gruppe führt nur eine Linie, zu ihrer Überschrift.
      const gr = gruppeVon[t.id];
      const zielKey = gr ? `g:${gr.name}:${gr.y}:${b}` : `${t.id}:${b}`;
      if (gezogen.has(zielKey)) continue;
      gezogen.add(zielKey);
      const a = pos(b);
      const x1 = a.x + KARTE_B;
      const y1 = a.y + a.h / 2;
      const x2 = gr ? RAND_L + gr.x * SPALTE : pos(t.id).x;
      const y2 = gr ? RAND_O + gr.y * ZEILE + (BAUM_MASS.kopf * ZEILE) / 2 : pos(t.id).y + pos(t.id).h / 2;
      const mx = (x1 + x2) / 2;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
      const fremd = TECH_NACH_ID[b].ast !== t.ast;
      if (fremd) p.setAttribute('class', 'fremd');
      linien.append(p);
      linienListe.push({ p, von: b });
    }
  }

  const baender = BAUM.aeste.map((a) => {
    const ast = AST_NACH_ID[a.ast];
    return h('div', {
      class: 'band', style: {
        top: `${RAND_O + a.von * ZEILE - 8}px`, height: `${(a.bis - a.von) * ZEILE + 16}px`, '--astfarbe': ast.farbe,
      },
    }, h('span', { class: 'bandname' }, ast.name));
  });

  const spaltenKopf = h('div', { class: 'spaltenkopf', style: { width: `${breite}px` } },
    Array.from({ length: BAUM.breite }, (_, i) => h('span', { style: { left: `${RAND_L + i * SPALTE}px` } }, schritteName(i))));

  const karten = {};
  const gruppenKoepfe = BAUM.gruppen.map((gr) => h('div', {
    class: 'gruppenkopf', style: {
      left: `${RAND_L + gr.x * SPALTE}px`, top: `${RAND_O + gr.y * ZEILE}px`, width: `${KARTE_B}px`,
      height: `${BAUM_MASS.kopf * ZEILE}px`, '--astfarbe': AST_NACH_ID[gr.ast].farbe,
    },
  }, gr.name));
  for (const t of TECH) {
    const p = pos(t.id);
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Lagerhalle', farbe: '#e8dcc4' };
    const preis = h('span', { class: 'preis num' });
    const stufe = h('span', { class: 'stufe num' });
    const kompakt = !!t.gruppe;
    const karte = h('button', {
      class: kompakt ? 'karte kompakt' : 'karte',
      style: { left: `${p.x}px`, top: `${p.y}px`, width: `${KARTE_B}px`, height: `${p.h - (kompakt ? 2 : 0)}px`, '--astfarbe': ast.farbe },
      onclick: () => { klangWecken(); ui.wahl = t.id; blattZeigen(); zuKarte(t.id); },
    }, kompakt ? [h('b', {}, t.name), preis, stufe]
      : [h('span', { class: 'astname' }, ast.name), h('b', {}, t.name), h('span', { class: 'kartenfuss' }, preis, stufe)]);
    karten[t.id] = { karte, preis, stufe };
  }

  const brett = h('div', { class: 'brett', style: { width: `${breite}px`, height: `${hoehe}px` } },
    baender, linien, gruppenKoepfe, Object.values(karten).map((k) => k.karte));
  const scroller = h('div', { class: `baum${ui.zoom ? ' uebersicht' : ''}` }, h('div', { class: 'brettrahmen' }, spaltenKopf, brett));
  const blatt = h('div', { class: 'blatt', role: 'region', 'aria-label': 'Forschungsdetails' });
  const wurzel = h('section', { class: 'bild forschungsbild' }, kopf, chipReihe, scroller, blatt);
  el.buehne.append(wurzel);

  function zuKarte(id, sanft = true) {
    const p = pos(id);
    const f = ui.zoom ? UEBERSICHT : 1;
    const sichtbar = scroller.clientHeight - (blatt.classList.contains('offen') ? blatt.offsetHeight + 16 : 0);
    scroller.scrollTo({
      left: Math.max(0, (p.x - scroller.clientWidth / 2 + KARTE_B / 2) * f),
      top: Math.max(0, p.y * f - Math.max(40, sichtbar / 2 - 30)),
      behavior: sanft ? 'smooth' : 'auto',
    });
  }

  requestAnimationFrame(() => {
    if (ui.wahl) zuKarte(ui.wahl, false);
    else if (ui.baumScroll) { scroller.scrollLeft = ui.baumScroll.x; scroller.scrollTop = ui.baumScroll.y; }
    else zuKarte('scheune', false);
  });
  scroller.addEventListener('scroll', () => { ui.baumScroll = { x: scroller.scrollLeft, y: scroller.scrollTop }; }, { passive: true });

  const passt = (t, q) => !q || t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
    || (t.ast && AST_NACH_ID[t.ast].name.toLowerCase().includes(q)) || (t.gruppe || '').toLowerCase().includes(q);
  const anwendenSuche = () => {
    const q = ui.suche.trim().toLowerCase();
    let n = 0;
    for (const t of TECH) {
      const ja = !q || passt(t, q);
      if (q && ja) n++;
      // Die gewählte Karte bleibt kräftig, auch wenn sie nicht zur Suche passt.
      schalte(karten[t.id].karte, 'blass', !!q && !ja && t.id !== ui.wahl);
    }
    setzeText(treffer, q ? (n ? `${n} Treffer` : 'keine Treffer') : '');
    return q;
  };
  suchfeld.addEventListener('input', () => {
    ui.suche = suchfeld.value;
    const q = anwendenSuche();
    const erste = q && TECH.find((t) => passt(t, q));
    if (erste) zuKarte(erste.id);
  });
  anwendenSuche();

  function blattZeigen() {
    anwendenSuche();
    const id = ui.wahl;
    for (const [k, v] of Object.entries(karten)) schalte(v.karte, 'gewaehlt', k === id);
    if (!id) { blatt.classList.remove('offen'); blatt.innerHTML = ''; blatt.aktualisieren = null; return; }
    const t = TECH_NACH_ID[id];
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Lagerhalle', farbe: '#e8dcc4' };
    const knopf = h('button', { class: 'knopf primaer breit', onclick: () => {
      klangWecken();
      const r = techKaufen(stand, id);
      if (r.ok) {
        if (r.ereignisse) ereignisse(r.ereignisse);
        klang.kauf();
        summen(8);
        const karte = karten[id].karte;
        karte.classList.remove('gekauft');
        void karte.offsetWidth;
        karte.classList.add('gekauft');
        if (t.effekt.some((e) => e[0] === 'frei') && techStufe(stand, id) === 1) toast(`${t.name} freigeschaltet.`, 'gut');
        // Wer die Heugabel kauft, will nicht weiter mit dem Spaten graben.
        if (id === 'heugabel' && stand.werkzeug === 'spaten') werkzeugWaehlen(stand, 'heugabel');
      } else klang.fehler();
      blattAktualisieren();
    } });
    const stufeEl = h('span', { class: 'num' });
    const vor = h('ul', { class: 'voraus' });
    blatt.replaceChildren(
      h('div', { class: 'blattkopf', style: { '--astfarbe': ast.farbe } },
        h('div', {}, h('p', { class: 'astname' }, t.gruppe ? `${ast.name} · ${t.gruppe}` : ast.name), h('h3', {}, t.name)),
        h('button', { class: 'rund', 'aria-label': 'Schließen', onclick: () => { ui.wahl = null; blattZeigen(); anwendenZustand(); } }, sym(SYM.zu))),
      h('p', { class: 'blatttext' }, t.text),
      h('p', { class: 'blattstufe' }, 'Stufe ', stufeEl),
      vor,
      knopf);
    blatt.classList.add('offen');
    function blattAktualisieren() {
      const st = techStatus(stand, id);
      setzeText(stufeEl, `${techStufe(stand, id)} von ${t.stufen}`);
      const vorText = t.braucht.filter((b) => b !== 'scheune').map((b) => `${b}:${techStufe(stand, b) > 0}`).join(',');
      if (vor.dataset.text !== vorText) {
        vor.dataset.text = vorText;
        vor.replaceChildren(...t.braucht.filter((b) => b !== 'scheune').map((b) => h('li', {}, h('button', {
          class: techStufe(stand, b) ? 'erfuellt' : 'fehlt',
          onclick: () => { ui.wahl = b; blattZeigen(); zuKarte(b); },
        }, sym(techStufe(stand, b) ? SYM.haken : SYM.schloss), `braucht ${TECH_NACH_ID[b].name}`))));
      }
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
    setzeText(zaehler, `${techGekauft(stand)} von ${TECH_STUFEN_GESAMT}`);
    const bereit = {};
    for (const t of TECH) {
      const k = karten[t.id];
      const st = techStatus(stand, t.id);
      if (st === 'kaufbar' && t.ast) bereit[t.ast] = (bereit[t.ast] || 0) + 1;
      for (const z of ['max', 'kaufbar', 'teuer', 'gesperrt']) schalte(k.karte, z, st === z);
      schalte(k.karte, 'begonnen', techStufe(stand, t.id) > 0);
      setzeText(k.preis, t.id === 'scheune' ? '' : st === 'max' ? (t.stufen > 1 ? 'fertig' : 'erforscht') : geld(techKosten(stand, t.id)));
      setzeText(k.stufe, t.id === 'scheune' ? '' : `${techStufe(stand, t.id)}/${t.stufen}`);
    }
    for (const a of AESTE) {
      setzeText(chips[a.id].n, bereit[a.id] ? String(bereit[a.id]) : '');
      schalte(chips[a.id].c, 'bereit', !!bereit[a.id]);
    }
    for (const l of linienListe) l.p.classList.toggle('offen', techStufe(stand, l.von) > 0);
    if (blatt.aktualisieren && ui.wahl) blatt.aktualisieren();
  }

  anwendenZustand();
  if (ui.wahl) blattZeigen();
  return { aktualisieren: anwendenZustand };
}

/* ================================================================ Nadeln */

function bildNadeln() {
  const wurzel = h('section', { class: 'bild nadelbild' });
  el.buehne.append(wurzel);

  const lTitel = h('h3', {});
  const lInfo = h('p', {});
  const lBalken = h('div', { class: 'fuellung' });
  const lKnopf = h('button', { class: 'knopf primaer breit', onclick: () => { klangWecken(); bestellenFragen(); } });
  const ladungKarte = h('div', { class: 'ladungkarte' },
    h('div', { class: 'kartenkopf' }, sym(SYM.ladung), lTitel), lInfo, h('div', { class: 'balken dünn' }, lBalken), lKnopf);

  const nadelKarten = Array.from({ length: NADELN_JE_LADUNG }, () => {
    const name = h('b', {});
    const info = h('small', {});
    const k = h('div', { class: 'nadelkarte' }, h('div', { class: 'nsym', html: SYM.nadel }), name, info);
    return { k, name, info };
  });

  const sammlungInfo = h('p', { class: 'leise' });
  const sammlung = NADELN.map((n, i) => {
    const name = h('b', {});
    const info = h('small', {});
    const k = h('div', { class: 'sammelkarte' }, h('div', { class: 'nsym', html: SYM.nadel }), name, info);
    return { k, name, info, i };
  });

  const stat = h('dl', { class: 'werte' });

  wurzel.append(
    ladungKarte,
    h('h3', { class: 'gruppe' }, 'Diese Ladung'),
    h('div', { class: 'nadelgitter' }, nadelKarten.map((n) => n.k)),
    h('h3', { class: 'gruppe' }, 'Sammlung'),
    sammlungInfo,
    h('div', { class: 'sammlung' }, sammlung.map((s) => s.k)),
    h('h3', { class: 'gruppe' }, 'Statistik'),
    stat);

  return {
    aktualisieren() {
      const fertig = ladungMoeglich(stand);
      setzeText(lTitel, `Ladung ${stand.ladung} · ${halme(stand.haufen.gesamt)} Halme`);
      const anteil = stand.haufen.entfernt / stand.haufen.gesamt;
      lBalken.style.width = `${Math.min(100, anteil * 100)}%`;
      setzeText(lInfo, fertig
        ? `Alle sechs Nadeln gefunden. Die nächste Ladung hat ${halme(ladungGroesse(stand.ladung + 1))} Halme und kostet ${geld(ladungPreis(stand))}.`
        : `${prozentAb(anteil)} abgetragen, ${nadelnGefunden(stand)} von ${NADELN_JE_LADUNG} Nadeln gefunden. Neue Ladungen gibt es, wenn alle sechs gefunden sind.`);
      lKnopf.hidden = !fertig;
      setzeText(lKnopf, stand.geld >= ladungPreis(stand) ? `Bestellen · ${geld(ladungPreis(stand))}` : 'Auf Rechnung bestellen');
      // Nach Art sortiert: so stehen sie in der Reihenfolge, in der man sie findet.
      [...stand.nadeln].sort((a, b) => a.art - b.art).forEach((n, i) => {
        const k = nadelKarten[i];
        const gef = n.zustand === 'gefunden';
        schalte(k.k, 'gefunden', gef);
        schalte(k.k, 'gold', gef && i === NADELN_JE_LADUNG - 1);
        setzeText(k.name, gef ? NADELN[n.art].name : `Nadel ${i + 1}`);
        setzeText(k.info, gef ? NADELN[n.art].bonus : 'noch im Haufen');
      });
      setzeText(sammlungInfo, `${artenGefunden(stand)} von ${NADELN.length} Arten. Jede Art gibt ihren winzigen Bonus einmal, für immer.`);
      for (const s of sammlung) {
        const n = stand.arten[s.i] || 0;
        schalte(s.k, 'gefunden', n > 0);
        setzeText(s.name, n > 0 ? NADELN[s.i].name : '???');
        setzeText(s.info, n > 0 ? `${NADELN[s.i].bonus}${n > 1 ? ` · ${n}×` : ''}` : `Ladung ${Math.floor(s.i / NADELN_JE_LADUNG) + 1}`);
      }
      const st = stand.stat;
      const z = [
        ['Spielzeit', dauer(stand.aktiv)],
        ['Erste Nadel nach', st.ersteNadel == null ? '–' : dauer(st.ersteNadel)],
        ['Erste Ladung geschafft nach', st.ersteLadung == null ? '–' : dauer(st.ersteLadung)],
        ['Halme abgetragen', halme(st.abgetragen)],
        ['davon von Hand', halme(st.hand)],
        ['davon Drohnen', halme(st.drohne)],
        ['davon Maschinen', halme(st.maschine)],
        ['Stiche', zahl(st.tipps)],
        ['Gänge zum Stand', zahl(st.gaenge)],
        ['Größter Verkauf', `${halme(st.besterVerkauf)} Halme`],
        ['Gefegt', `${halme(st.gefegt)} Halme`],
        ['Aufträge', zahl(st.auftraege)],
        ['Meiste Kasse', geld(st.maxGeld)],
        ['Verdient', geld(stand.verdient)],
        ['Missionen', `${Math.min(stand.mission, MISSIONEN.length)} von ${MISSIONEN.length}`],
      ];
      if (stat.children.length !== z.length * 2) {
        stat.replaceChildren(...z.flatMap(([a]) => [h('dt', {}, a), h('dd', { class: 'num' })]));
        z.forEach(([a], i) => setzeText(stat.children[i * 2], a));
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
    { text: 'Spiel mit Spielstand herunterladen', aktion: dateiSichern },
    { text: 'Spielstand löschen', klasse: 'gefahr', aktion: loeschenFragen },
    { text: 'Zurück' },
  ];
  modal({
    ober: `Ladung ${stand.ladung}`,
    titel: 'Menü',
    inhalt: h('p', { class: 'leise' }, 'Der Spielstand liegt auf diesem Gerät und wird alle paar Sekunden gesichert. '
      + 'Die Halle arbeitet weiter, während du weg bist. Die heruntergeladene Datei läuft ohne Netz und bringt deinen Stand mit.'),
    knoepfe,
    klasse: 'menuemodal',
  });
}

function loeschenFragen() {
  modal({
    titel: 'Wirklich von vorn?',
    absaetze: ['Geld, Forschung, Maschinen, Nadeln und Sammlung sind danach weg. Das lässt sich nicht rückgängig machen.'],
    knoepfe: [
      { text: 'Abbrechen' },
      { text: 'Löschen', klasse: 'gefahr', aktion: () => {
        warteschlange.length = 0;
        stand = neuerStand();
        ui.wahl = null;
        ui.baumScroll = null;
        ui.endeGezeigt = 0;
        sichern();
        wechseln('haufen');
        einfuehrung();
      } },
    ],
  });
}

/* ------------------------------------------------------------ Seite als Datei */

async function seitenQuelltext() {
  let css = document.getElementById('heuhaufen-css')?.textContent || '';
  let js = document.getElementById('heuhaufen-js')?.textContent || '';
  if (!css || !js) {
    // Webfassung: Stil und Skript liegen als eigene Dateien daneben.
    try {
      [css, js] = await Promise.all(['stil.css', 'spiel.js'].map((d) => fetch(d).then((r) => (r.ok ? r.text() : ''))));
    } catch { return null; }
    if (!css || !js) return null;
    js = js.replace(/^const SPIELE_BASIS = [^\n]*\n/m, '').replace(/^const OFFLINE_DATEI = [^\n]*\n/m, '');
  }
  js = js.replace(/^var HEUHAUFEN_MITGEBRACHT = [^\n]*\n/m, '');
  const mit = `var HEUHAUFEN_MITGEBRACHT = ${JSON.stringify(speichern(stand)).replace(/</g, '\\u003c')};\n`;
  const kopf = typeof SEITENKOPF === 'string' ? SEITENKOPF : '<meta charset="utf-8"><title>Heuhaufen</title>';
  return [
    '<!doctype html>', '<html lang="de">', '<head>', kopf,
    '<style id="heuhaufen-css">', css, '</style>', '</head>', '<body>',
    '<div id="app"></div>',
    '<script id="heuhaufen-js">', mit + js, '<' + '/script>',
    '</body>', '</html>', '',
  ].join('\n');
}

let downloadsVersprechen = null;
function downloadsFaehigkeit() {
  if (!downloadsVersprechen) {
    const c = typeof window !== 'undefined' ? window.claude : null;
    downloadsVersprechen = c && typeof c.use === 'function'
      ? Promise.resolve(c.use('downloads')).catch(() => null)
      : Promise.resolve(null);
  }
  return downloadsVersprechen;
}

async function dateiSichern() {
  const name = `Heuhaufen-Ladung-${stand.ladung}.html`;
  const html = await seitenQuelltext();
  if (!html) { toast('Die Datei lässt sich hier nicht zusammenbauen. In der gebauten Fassung geht es.', 'warn'); return; }
  // Im Artifact-Viewer gibt es Downloads nur über die Fähigkeit "downloads"; sonst null.
  const dl = await downloadsFaehigkeit();
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
  toast('Download gestartet. Die Datei bringt deinen Spielstand mit.', 'gut');
}

/* ================================================================ Schleife */

function schleife() {
  let letzte = performance.now();
  let letzteAnzeige = 0;
  const schritt = (jetzt) => {
    try {
      const dt = Math.min(0.25, Math.max(0, (jetzt - letzte) / 1000));
      letzte = jetzt;
      if (ui.passiv) return;
      if (dt > 0) ereignisse(tick(stand, dt));

      const saugt = stand.sauger.an && !saugerBlockiert(stand);
      if (saugt && !ui.saugerLaeuft) { saugerAn(); ui.saugerLaeuft = true; }
      if (!saugt && ui.saugerLaeuft) { saugerAus(); ui.saugerLaeuft = false; }
      if (saugt) saugerHitze(stand.sauger.hitze);

      // Der Detektor piept nur, wenn man ihn in der Hand hat.
      ui.blink = Math.max(0, ui.blink - dt * 6);
      if (ui.reiter === 'haufen' && stand.werkzeug === 'detektor' && !modalOffen()) {
        const d = detektor(stand);
        if (d.staerke > 0 && jetzt >= ui.naechsterPiep) {
          klang.piep(d.staerke);
          ui.blink = 1;
          ui.naechsterPiep = jetzt + (1300 - d.staerke * 1200);
        } else if (d.staerke <= 0) ui.naechsterPiep = jetzt;
      }

      // Speichern und Anzeige zuerst: ein Fehler beim Zeichnen darf beides nie aufhalten.
      if (jetzt - ui.gespeichert > 5000) sichern();
      if (jetzt - letzteAnzeige > 200) {
        letzteAnzeige = jetzt;
        kopfAktualisieren();
        if (ui.bildschirm) ui.bildschirm.aktualisieren();
      }
      if (ui.bildschirm && ui.bildschirm.zeichnen) {
        try { ui.bildschirm.zeichnen(dt); } catch (fehler) {
          if (!ui.zeichenFehler) { ui.zeichenFehler = true; if (typeof console !== 'undefined') console.error(fehler); }
        }
      }
    } catch (fehler) {
      // Ein Fehler in einem Bild darf nicht das ganze Spiel anhalten.
      if (typeof console !== 'undefined') console.error(fehler);
    } finally {
      requestAnimationFrame(schritt);
    }
  };
  requestAnimationFrame(schritt);
}

function anderesFenster() {
  if (ui.passiv) return;
  ui.passiv = true;
  saugen(stand, false);
  saugerAus();
  ui.saugerLaeuft = false;
  warteschlange.length = 0;
  modalSchliessen();
  modal({
    titel: 'Das Spiel läuft woanders',
    absaetze: ['In einem anderen Fenster wurde gerade weitergespielt. Damit sich die beiden nicht gegenseitig überschreiben, ruht es hier.'],
    knoepfe: [{ text: 'Hier weiterspielen', klasse: 'primaer', aktion: () => {
      const neu = einlesen();
      if (neu) stand = neu;
      ui.passiv = false;
      ui.endeGezeigt = alleNadeln(stand) ? stand.ladung : stand.ladung - 1;
      wechseln(ui.reiter);
      abwesenheitsbericht(offlineNachholen(stand));
      sichern();
    } }],
  });
}

function start() {
  let alteFassung = false;
  downloadsFaehigkeit();
  try {
    klangStumm(localStorage.getItem(TON_KEY) === 'aus');
    if (localStorage.getItem('heuhaufen-stand-v1')) {
      alteFassung = true;
      localStorage.removeItem('heuhaufen-stand-v1');
    }
  } catch { /* egal */ }
  stand = einlesen();
  const neu = !stand;
  if (neu) stand = neuerStand();
  ui.endeGezeigt = alleNadeln(stand) ? stand.ladung : stand.ladung - 1;
  geruest();
  wechseln('haufen');
  if (neu) einfuehrung();
  else abwesenheitsbericht(offlineNachholen(stand));
  if (neu && alteFassung) toast('Das Spiel wurde umgebaut. Der alte Spielstand passt nicht mehr, es geht von vorn los.', 'warn');
  if (stand.erstattet) toast(`Der Forschungsbaum wurde umgebaut. Für entfernte Forschung und Maschinen gab es ${geld(stand.erstattet)} zurück.`, 'gut');
  sichern();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saugen(stand, false);
      saugerAus();
      ui.saugerLaeuft = false;
      sichern();
    } else if (!ui.passiv) {
      abwesenheitsbericht(offlineNachholen(stand));
      sichern();
    }
  });
  window.addEventListener('pagehide', sichern);
  window.addEventListener('storage', (ev) => { if (ev.key === SPEICHER_KEY && ev.newValue) anderesFenster(); });
  schleife();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
