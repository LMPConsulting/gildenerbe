// „Hof-Forschung“: der Forschungsbaum als Vollbild-Tafel, wie im Vorbild
// (Yard Research): Spalten nach Schritten vom Start, Bänder je Ast, Suche,
// Gruppen als schmale Zeilen. Übernommen aus der 2D-Fassung.

import { TECH, AESTE } from '../daten.js';
import {
  techLage, techKaufen, techStatus, techStufe, techKosten, techGekauft, TECH_STUFEN_GESAMT, TECH_NACH_ID,
  AST_NACH_ID, BAUM_MASS,
} from '../wirtschaft.js';
import { geld } from '../format.js';
import { h, setzeText, icon } from './oberflaeche.js';

const SPALTE = 192;
const ZEILE = 78;
const KARTE_B = 172;
const RAND_L = 34;
const RAND_O = 36;
const UEBERSICHT = 0.6;
const schritteName = (n) => (n === 0 ? 'Start' : n === 1 ? '1 Schritt' : `${n} Schritte`);

let BAUM = null;
const forschungZustand = { suche: '', wahl: null, zoom: false, scroll: null };

/**
 * Öffnet die Tafel. s: Spielstand. rueck: { gekauft(id), zu() , klick() }.
 * Liefert { aktualisieren(), schliessen() }.
 */
export function forschungOeffnen(wurzel, s, rueck) {
  if (!BAUM) BAUM = techLage(AESTE);
  const ui = forschungZustand;
  const suchfeld = h('input', { class: 'suche', type: 'search', placeholder: 'Baum durchsuchen', 'aria-label': 'Forschung durchsuchen', value: ui.suche });
  const zaehler = h('span', { class: 'num' });
  const treffer = h('span', { class: 'treffer' });
  const geldAnzeige = h('span', { class: 'fgeld num' });
  const zoomKnopf = h('button', { class: 'fknopf', 'aria-label': 'Übersicht umschalten' }, 'Übersicht');
  const zuKnopf = h('button', { class: 'fknopf zu', 'aria-label': 'Schließen' }, icon('zu'));
  const kopf = h('div', { class: 'forschungskopf' },
    h('div', { class: 'ftitel' }, 'Hof-Forschung'),
    h('div', { class: 'suchbox' }, suchfeld, treffer), geldAnzeige, zoomKnopf, zuKnopf);

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
      // rechtwinklig wie im Vorbild
      p.setAttribute('d', `M${x1} ${y1} H${mx} V${y2} H${x2}`);
      if (TECH_NACH_ID[b].ast !== t.ast) p.setAttribute('class', 'fremd');
      linien.append(p);
      linienListe.push({ p, von: b });
    }
  }

  const baender = BAUM.aeste.map((a) => {
    const ast = AST_NACH_ID[a.ast];
    return h('div', {
      class: 'band', style: { top: `${RAND_O + a.von * ZEILE - 8}px`, height: `${(a.bis - a.von) * ZEILE + 16}px`, '--astfarbe': ast.farbe },
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
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Handarbeit', farbe: '#e0a53c' };
    const preis = h('span', { class: 'preis num' });
    const stufe = h('span', { class: 'stufe num' });
    const kompakt = !!t.gruppe;
    const karte = h('button', {
      class: kompakt ? 'karte kompakt' : 'karte',
      style: { left: `${p.x}px`, top: `${p.y}px`, width: `${KARTE_B}px`, height: `${p.h - (kompakt ? 2 : 0)}px`, '--astfarbe': ast.farbe },
      onclick: () => { rueck.klick && rueck.klick(); ui.wahl = t.id; blattZeigen(); zuKarte(t.id); },
    }, kompakt ? [h('b', {}, t.name), preis, stufe]
      : [h('span', { class: 'astname' }, ast.name), h('b', {}, t.name), h('span', { class: 'kartenfuss' }, preis, stufe)]);
    karten[t.id] = { karte, preis, stufe };
  }

  const brett = h('div', { class: 'brett', style: { width: `${breite}px`, height: `${hoehe}px` } },
    baender, linien, gruppenKoepfe, Object.values(karten).map((k) => k.karte));
  const scroller = h('div', { class: `baum${ui.zoom ? ' uebersicht' : ''}` }, h('div', { class: 'brettrahmen' }, spaltenKopf, brett));
  const blatt = h('div', { class: 'blatt', role: 'region', 'aria-label': 'Forschungsdetails' });
  const fuss = h('div', { class: 'forschungsfuss num' });
  const tafel = h('section', { class: 'tafel forschung', role: 'dialog', 'aria-label': 'Hof-Forschung' }, kopf, chipReihe, scroller, blatt, fuss);
  wurzel.append(tafel);

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
  zoomKnopf.addEventListener('click', () => {
    const f0 = ui.zoom ? UEBERSICHT : 1;
    const mx = (scroller.scrollLeft + scroller.clientWidth / 2) / f0;
    const my = (scroller.scrollTop + scroller.clientHeight / 2) / f0;
    ui.zoom = !ui.zoom;
    scroller.classList.toggle('uebersicht', ui.zoom);
    if (ui.wahl) zuKarte(ui.wahl, false);
    else {
      const f1 = ui.zoom ? UEBERSICHT : 1;
      scroller.scrollLeft = Math.max(0, mx * f1 - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, my * f1 - scroller.clientHeight / 2);
    }
  });
  requestAnimationFrame(() => {
    if (ui.wahl) zuKarte(ui.wahl, false);
    else if (ui.scroll) { scroller.scrollLeft = ui.scroll.x; scroller.scrollTop = ui.scroll.y; }
    else zuKarte('scheune', false);
  });
  scroller.addEventListener('scroll', () => { ui.scroll = { x: scroller.scrollLeft, y: scroller.scrollTop }; }, { passive: true });

  const passt = (t, q) => !q || t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
    || (t.ast && AST_NACH_ID[t.ast].name.toLowerCase().includes(q)) || (t.gruppe || '').toLowerCase().includes(q);
  const anwendenSuche = () => {
    const q = ui.suche.trim().toLowerCase();
    let n = 0;
    for (const t of TECH) {
      const ja = !q || passt(t, q);
      if (q && ja) n++;
      karten[t.id].karte.classList.toggle('blass', !!q && !ja && t.id !== ui.wahl);
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
  suchfeld.addEventListener('keydown', (ev) => ev.stopPropagation());
  anwendenSuche();

  let blattAktualisieren = null;
  function blattZeigen() {
    anwendenSuche();
    const id = ui.wahl;
    for (const [k, v] of Object.entries(karten)) v.karte.classList.toggle('gewaehlt', k === id);
    if (!id) { blatt.classList.remove('offen'); blatt.innerHTML = ''; blattAktualisieren = null; return; }
    const t = TECH_NACH_ID[id];
    const ast = t.ast ? AST_NACH_ID[t.ast] : { name: 'Handarbeit', farbe: '#e0a53c' };
    const knopf = h('button', { class: 'knopf primaer breit' });
    knopf.addEventListener('click', () => {
      const r = techKaufen(s, id);
      if (r.ok) {
        const karte = karten[id].karte;
        karte.classList.remove('gekauft');
        void karte.offsetWidth;
        karte.classList.add('gekauft');
        rueck.gekauft && rueck.gekauft(id);
      } else rueck.fehler && rueck.fehler();
      anwendenZustand();
    });
    const stufeEl = h('span', { class: 'num' });
    const vor = h('ul', { class: 'voraus' });
    blatt.replaceChildren(
      h('div', { class: 'blattkopf', style: { '--astfarbe': ast.farbe } },
        h('div', {}, h('p', { class: 'astname' }, t.gruppe ? `${ast.name} · ${t.gruppe}` : ast.name), h('h3', {}, t.name)),
        h('button', { class: 'fknopf zu', 'aria-label': 'Schließen', onclick: () => { ui.wahl = null; blattZeigen(); anwendenZustand(); } }, icon('zu'))),
      h('p', { class: 'blatttext' }, t.text),
      h('p', { class: 'blattstufe' }, 'Stufe ', stufeEl),
      vor,
      knopf);
    blatt.classList.add('offen');
    blattAktualisieren = () => {
      const st = techStatus(s, id);
      setzeText(stufeEl, `${techStufe(s, id)} von ${t.stufen}`);
      const vorText = t.braucht.filter((b) => b !== 'scheune').map((b) => `${b}:${techStufe(s, b) > 0}`).join(',');
      if (vor.dataset.text !== vorText) {
        vor.dataset.text = vorText;
        vor.replaceChildren(...t.braucht.filter((b) => b !== 'scheune').map((b) => h('li', {}, h('button', {
          class: techStufe(s, b) ? 'erfuellt' : 'fehlt',
          onclick: () => { ui.wahl = b; blattZeigen(); zuKarte(b); },
        }, `${techStufe(s, b) ? '✓' : '✕'} braucht ${TECH_NACH_ID[b].name}`))));
      }
      if (st === 'max') { setzeText(knopf, t.stufen > 1 ? 'Voll ausgebaut' : 'Erforscht'); knopf.disabled = true; }
      else if (st === 'gesperrt') { setzeText(knopf, `Gesperrt · ${geld(techKosten(s, id))}`); knopf.disabled = true; }
      else {
        setzeText(knopf, `${techStufe(s, id) ? 'Ausbauen' : 'Erforschen'} · ${geld(techKosten(s, id))}`);
        knopf.disabled = st !== 'kaufbar';
      }
    };
    blattAktualisieren();
  }

  function anwendenZustand() {
    setzeText(zaehler, `${techGekauft(s)} von ${TECH_STUFEN_GESAMT}`);
    setzeText(geldAnzeige, geld(s.geld));
    setzeText(fuss, `${techGekauft(s)} von ${TECH_STUFEN_GESAMT} Stufen gekauft · Karte antippen, im Blatt kaufen`);
    const bereit = {};
    for (const t of TECH) {
      const k = karten[t.id];
      const st = techStatus(s, t.id);
      if (st === 'kaufbar' && t.ast) bereit[t.ast] = (bereit[t.ast] || 0) + 1;
      for (const z of ['max', 'kaufbar', 'teuer', 'gesperrt']) k.karte.classList.toggle(z, st === z);
      k.karte.classList.toggle('begonnen', techStufe(s, t.id) > 0);
      setzeText(k.preis, t.id === 'scheune' ? '' : st === 'max' ? (t.stufen > 1 ? 'FERTIG' : 'ERFORSCHT') : geld(techKosten(s, t.id)));
      setzeText(k.stufe, t.id === 'scheune' ? '' : `${techStufe(s, t.id)}/${t.stufen}`);
    }
    for (const a of AESTE) {
      setzeText(chips[a.id].n, bereit[a.id] ? String(bereit[a.id]) : '');
      chips[a.id].c.classList.toggle('bereit', !!bereit[a.id]);
    }
    for (const l of linienListe) l.p.classList.toggle('offen', techStufe(s, l.von) > 0);
    if (blattAktualisieren && ui.wahl) blattAktualisieren();
  }

  anwendenZustand();
  if (ui.wahl) blattZeigen();
  const schliessen = () => { tafel.remove(); rueck.zu && rueck.zu(); };
  zuKnopf.addEventListener('click', schliessen);
  return { aktualisieren: anwendenZustand, schliessen, tafel };
}
