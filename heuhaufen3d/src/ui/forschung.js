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

// Kleine graue Symbole links auf den Karten (Vorbild: research_cards.png). Linien-Icons 24×24.
const SYMBOL = {
  hand: '<path d="M8 21c-2-3-3-6-3-9V8a1.5 1.5 0 0 1 3 0v4M8 11V5a1.5 1.5 0 0 1 3 0v6M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2 7-6 7H8"/>',
  eimer: '<path d="M5 8h14l-2 12H7Z"/><path d="M5 8c0-3 3-5 7-5s7 2 7 5"/>',
  spaten: '<path d="M12 2v11"/><path d="M9 2h6"/><path d="M8 13h8l-1 7c-1 2-5 2-6 0Z"/>',
  heugabel: '<path d="M12 11v11"/><path d="M6 3v5c0 2 2 3 6 3s6-1 6-3V3M9 3v6M12 3v7M15 3v6"/>',
  besen: '<path d="M16 3 9 14"/><path d="M5 13l6 3-2 6c-2 0-5-2-6-4Z"/>',
  sauger: '<path d="M4 20l7-7"/><rect x="11" y="5" width="9" height="8" rx="2"/><path d="M13 5V3h5v2"/>',
  detektor: '<path d="M6 21 12 9"/><circle cx="15" cy="6" r="3"/><path d="M4 17l3 1"/>',
  haus: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
  wand: '<rect x="3" y="5" width="18" height="14"/><path d="M3 12h18M9 5v7M15 12v7"/>',
  dach: '<path d="M2 13 12 5l10 8"/><path d="M5 11v9h14v-9"/>',
  treppe: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  lampe: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z"/>',
  band: '<rect x="2" y="9" width="20" height="6" rx="3"/><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/><path d="M6 15v5M18 15v5"/>',
  weiche: '<path d="M3 12h7l4-6h7M10 12l4 6h7"/>',
  blitz: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  mast: '<path d="M12 3v18M7 21h10M5 7h14M7 7l5 5 5-5"/>',
  kessel: '<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V4h3v4M9 14h6"/>',
  zahnrad: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  ballen: '<rect x="3" y="7" width="18" height="11" rx="1"/><path d="M8 7v11M16 7v11"/>',
  silo: '<path d="M6 21V8a6 4 0 0 1 12 0v13M6 21h12M6 12h12"/>',
  arm: '<path d="M4 21h8M8 21v-5l5-7 5 3"/><circle cx="13" cy="9" r="1.5"/><path d="M18 12l2 3M18 12l3 0"/>',
  rechen: '<path d="M3 6h18M5 6v6M9 6v6M13 6v6M17 6v6M12 6V2M8 16h8v4H8Z"/>',
  drohne: '<rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9 11 5 7M15 11l4-4M9 13l-4 4M15 13l4 4"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/>',
  tropfen: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/>',
  lupe: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  radar: '<path d="M12 12 19 5"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  nadel: '<path d="M4 20 17 7"/><ellipse cx="18.5" cy="5.5" rx="2.2" ry="1.2" transform="rotate(-45 18.5 5.5)"/>',
  muenze: '<circle cx="12" cy="12" r="9"/><path d="M15 9c-.5-1-1.6-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.6-.6-3.1-1.6M12 6v1.5M12 16.5V18"/>',
  laster: '<path d="M2 16V7h11v9M13 10h4l3 3v3h-7"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  herz: '<path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z"/>',
  schuh: '<path d="M3 17h17c1 0 1.5-1.5.5-2.2L15 12l-2-5H8v5l-5 2Z"/>',
};
const SYMBOL_AST = {
  hand: 'hand', hofbau: 'haus', linien: 'band', strom: 'blitz', verarbeitung: 'zahnrad', auto: 'arm',
  wasser: 'tropfen', suche: 'lupe', verkauf: 'muenze', fitness: 'herz',
};
const SYMBOL_TECH = {
  eimer: 'eimer', eimer2: 'eimer', schubkarre: 'eimer', mulde: 'eimer', sack: 'eimer', spaten: 'spaten',
  heugabel: 'heugabel', zinken: 'heugabel', sauger: 'sauger', sauger2: 'sauger', kuehlung: 'sauger', industriesauger: 'sauger',
  besen: 'besen', besen2: 'besen', waende: 'wand', schuppen: 'haus', daecher: 'dach', heutreppe: 'treppe', heulift: 'treppe',
  arbeitslampen: 'lampe', weiche: 'weiche', vereiniger: 'weiche', vorrangarm: 'arm', kessel: 'kessel', feuerbox: 'kessel',
  strommast: 'mast', spannweite: 'mast', abspannung: 'mast', erdkabel: 'mast', silo: 'silo', silo2: 'silo',
  presse: 'ballen', ballenkammer: 'ballen', ballenpresse: 'ballen', ballenqualitaet: 'ballen', kolbenrechen: 'rechen', hub: 'rechen',
  drohne: 'drohne', schwarm: 'drohne', rotoren: 'drohne', drohnenhafen: 'drohne', spule: 'detektor', piepser: 'detektor',
  radar: 'radar', radar2: 'radar', laster: 'laster', tempo1: 'schuh', tempo2: 'schuh', kraft: 'hand', handschuh: 'hand',
};
function kartenSymbol(t) {
  const name = SYMBOL_TECH[t.id] || SYMBOL_AST[t.ast] || 'haus';
  return h('span', {
    class: 'ksymbol', 'aria-hidden': 'true',
    style: { flex: 'none', width: '22px', height: '22px', alignSelf: 'center', color: '#8a8f94', display: 'inline-flex' },
    html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SYMBOL[name]}</svg>`,
  });
}

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
    const stil = { left: `${p.x}px`, top: `${p.y}px`, width: `${KARTE_B}px`, height: `${p.h - (kompakt ? 2 : 0)}px`, '--astfarbe': ast.farbe };
    // Große Karten: Symbolspalte links (30 px), rechts Ast, Name, Preis und Stufe
    if (!kompakt) Object.assign(stil, { flexDirection: 'row', alignItems: 'stretch', gap: '6px', paddingLeft: '4px' });
    const karte = h('button', {
      class: kompakt ? 'karte kompakt' : 'karte',
      style: stil,
      onclick: () => { rueck.klick && rueck.klick(); ui.wahl = t.id; blattZeigen(); zuKarte(t.id); },
    }, kompakt ? [h('b', {}, t.name), preis, stufe]
      : [kartenSymbol(t), h('span', {
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: '1', minWidth: '0' },
      }, h('span', { class: 'astname' }, ast.name), h('b', {}, t.name), h('span', { class: 'kartenfuss' }, preis, stufe))]);
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
      if (st === 'max') { setzeText(knopf, t.stufen > 1 ? 'Voll ausgebaut' : 'Besitzt'); knopf.disabled = true; }
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
      setzeText(k.preis, t.id === 'scheune' ? '' : st === 'max' ? (t.stufen > 1 ? 'FERTIG' : 'BESITZT') : geld(techKosten(s, t.id)));
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
