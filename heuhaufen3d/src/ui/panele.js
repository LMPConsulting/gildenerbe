// Tafeln, die man an Stationen in der Halle öffnet: Werkzeugstand,
// Lieferschalter (neue Ladung), Nadelbuch mit Sammlung und Bestwerten, Menü.

import { NADELN, GESCHICHTE } from '../daten.js';
import {
  techStatus, techStufe, techKosten, techKaufen, TECH_NACH_ID, nadelnGefunden, artenGefunden,
  ladungPreis, ladungMoeglich, kreditAufschlag, NADELN_JE_LADUNG,
} from '../wirtschaft.js';
import { geld, halme, dauer, prozent } from '../format.js';
import { h, setzeText, icon } from './oberflaeche.js';

/** Was der Werkzeugstand verkauft (je ein Forschungsknoten, wie am Stand im Vorbild). */
const LADEN = [
  { id: 'eimer', icon: 'eimer' },
  { id: 'spaten', icon: 'spaten' },
  { id: 'besen', icon: 'besen' },
  { id: 'heugabel', icon: 'heugabel' },
  { id: 'sauger', icon: 'sauger' },
  { id: 'schubkarre', icon: 'eimer' },
  { id: 'sack', icon: 'eimer' },
];

export function werkzeugstandZeigen(ui, s, { gekauft, fehler }) {
  const liste = h('div', { class: 'liste' });
  const zeilen = LADEN.map((eintrag) => {
    const t = TECH_NACH_ID[eintrag.id];
    const knopf = h('button', { class: 'knopf primaer' });
    const zeile = h('div', { class: 'zeile' }, icon(eintrag.icon), h('div', {}, h('b', {}, t.name), h('small', {}, t.text)), knopf);
    knopf.addEventListener('click', () => {
      const r = techKaufen(s, t.id);
      if (r.ok) gekauft(t.id); else fehler(r.grund);
      aktualisieren();
    });
    liste.append(zeile);
    return { t, knopf, zeile };
  });
  function aktualisieren() {
    for (const { t, knopf, zeile } of zeilen) {
      const st = techStatus(s, t.id);
      zeile.classList.toggle('gekauft', st === 'max');
      if (st === 'max') { setzeText(knopf, 'Gekauft'); knopf.disabled = true; }
      else if (st === 'gesperrt') {
        const fehlt = t.braucht.find((b) => !techStufe(s, b));
        setzeText(knopf, fehlt ? `erst ${TECH_NACH_ID[fehlt].name}` : 'Gesperrt');
        knopf.disabled = true;
      } else { setzeText(knopf, geld(techKosten(s, t.id))); knopf.disabled = st !== 'kaufbar'; }
    }
    // die Kasse oben mitführen
    const ober = liste.closest && liste.closest('.modal') ? liste.closest('.modal').querySelector('.ober') : null;
    if (ober) setzeText(ober, `Kasse: ${geld(s.geld)}`);
  }
  aktualisieren();
  ui.modal({
    klasse: 'werkzeugstand', ober: `Kasse: ${geld(s.geld)}`, titel: 'Werkzeugstand', inhalt: liste,
    absaetze: ['Upgrades für Werkzeuge, Eimer und Karre gibt es in der Forschung.'],
    knoepfe: [{ text: 'Fertig', klasse: 'primaer' }],
  });
}

export function lieferschalterZeigen(ui, s, { bestellen }) {
  const gefunden = nadelnGefunden(s);
  if (!ladungMoeglich(s)) {
    ui.modal({
      ober: 'Lieferungen', titel: 'Neue Ladung',
      absaetze: [
        `Eine neue Ladung gibt es erst, wenn alle sechs Nadeln dieser Ladung gefunden sind. Bisher: ${gefunden} von ${NADELN_JE_LADUNG}.`,
        `Die nächste kostet ${geld(ladungPreis(s))}.`,
      ],
      knoepfe: [{ text: 'Verstanden', klasse: 'primaer' }],
    });
    return;
  }
  const preis = ladungPreis(s);
  const aufschlag = kreditAufschlag(s);
  const knoepfe = [];
  if (s.geld >= preis) knoepfe.push({ text: `Bar bezahlen · ${geld(preis)}`, klasse: 'primaer', aktion: () => bestellen(false) });
  if (s.geld < preis) knoepfe.push({ text: `Auf Rechnung · ${geld((preis - s.geld) * aufschlag)} Schulden`, aktion: () => bestellen(true) });
  knoepfe.push({ text: 'Später' });
  ui.modal({
    ober: `Ladung ${s.ladung + 1}`, titel: 'Neue Ladung bestellen',
    absaetze: [
      GESCHICHTE.ladung,
      `Preis ${geld(preis)}. Auf Rechnung kommt ${prozent(aufschlag - 1)} Aufschlag dazu; die Hälfte jeder Einnahme tilgt dann die Schulden.`,
      s.haufenRest > 1000 ? `Der Rest dieser Ladung (${halme(s.haufenRest)} Halme) wird dabei abgeholt. Wer ihn noch verkaufen will, wartet besser.` : null,
      'Maschinen, Bänder und Forschung bleiben stehen.',
    ].filter(Boolean),
    knoepfe,
  });
}

export function nadelbuchZeigen(ui, s) {
  const reihe = h('div', { class: 'sammlung' },
    s.nadeln.map((n, i) => h('div', { class: `sammelkarte${n.zustand === 'gefunden' ? '' : ' fehlt'}` },
      h('small', {}, `Nadel ${i + 1}`), h('b', {}, n.zustand === 'gefunden' ? NADELN[n.art].name : '?'),
      h('small', {}, n.zustand === 'gefunden' ? NADELN[n.art].bonus : n.zustand === 'lose' ? 'liegt irgendwo frei' : n.zustand === 'scanner' ? 'wartet im Scanner' : 'im Haufen'))));
  const sammlung = h('div', { class: 'sammlung' },
    NADELN.map((n, i) => h('div', { class: `sammelkarte${s.arten[i] ? '' : ' fehlt'}` },
      h('b', {}, s.arten[i] ? n.name : '?'), h('small', {}, s.arten[i] ? n.bonus : `Ladung ${Math.floor(i / 6) + 1}`))));
  const st = s.stat;
  const werteListe = h('dl', { class: 'werte' },
    h('dt', {}, 'Gespielt'), h('dd', {}, dauer(s.zeit)),
    h('dt', {}, 'Erste Nadel'), h('dd', {}, st.ersteNadel != null ? dauer(st.ersteNadel) : '–'),
    h('dt', {}, 'Erste Ladung geschafft'), h('dd', {}, st.ersteLadung != null ? dauer(st.ersteLadung) : '–'),
    h('dt', {}, 'Halme verkauft'), h('dd', {}, halme(st.verkauft)),
    h('dt', {}, 'Größter Verkauf'), h('dd', {}, st.besterVerkauf ? `${geld(st.besterVerkauf)} (${halme(st.besterVerkaufHalme)} Halme)` : '–'),
    h('dt', {}, 'Meiste Kasse'), h('dd', {}, geld(st.maxGeld)),
    h('dt', {}, 'Verdient'), h('dd', {}, geld(s.verdient)),
    h('dt', {}, 'Nadelarten'), h('dd', {}, `${artenGefunden(s)} von ${NADELN.length}`));
  ui.modal({
    ober: `Ladung ${s.ladung} · ${nadelnGefunden(s)} von ${NADELN_JE_LADUNG} Nadeln`, titel: 'Nadelbuch',
    inhalt: h('div', {}, reihe, h('p', { class: 'ober' }, 'Sammlung'), sammlung, h('p', { class: 'ober' }, 'Bestwerte'), werteListe),
    knoepfe: [{ text: 'Schließen', klasse: 'primaer' }],
  });
}

export function menueZeigen(ui, einstellungen, { aendern, anleitung, herunterladen, loeschen }) {
  const ton = h('button', { class: 'knopf' });
  const beben = h('button', { class: 'knopf' });
  const empf = h('input', { type: 'range', min: '0.4', max: '2', step: '0.1', value: String(einstellungen.empfindlichkeit), class: 'regler', 'aria-label': 'Blickempfindlichkeit' });
  const empfText = h('span', { class: 'num' });
  const grafik = h('div', { class: 'wahlreihe' }, ['niedrig', 'mittel', 'hoch'].map((q) => h('button', {
    class: `knopf${einstellungen.grafik === q ? ' primaer' : ''}`, onclick: () => { aendern({ grafik: q }); ui.modalSchliessen(); },
  }, q)));
  const zeige = () => {
    setzeText(ton, einstellungen.ton ? 'Ton: an' : 'Ton: aus');
    setzeText(beben, einstellungen.beben === false ? 'Vibration: aus' : 'Vibration: an');
    setzeText(empfText, `${Number(einstellungen.empfindlichkeit).toFixed(1)}×`);
  };
  ton.addEventListener('click', () => { aendern({ ton: !einstellungen.ton }); zeige(); });
  beben.addEventListener('click', () => { aendern({ beben: einstellungen.beben === false }); zeige(); });
  empf.addEventListener('input', () => { aendern({ empfindlichkeit: Number(empf.value) }); zeige(); });
  empf.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  zeige();
  ui.modal({
    klasse: 'menue', ober: 'Heuhaufen 3D', titel: 'Menü',
    inhalt: h('div', { class: 'liste' },
      ton, beben,
      h('div', { class: 'zeile ohneicon umsehen' }, h('div', {}, h('b', {}, 'Umsehen'), h('small', {}, 'Wie schnell sich der Blick beim Wischen dreht.')), h('div', { class: 'reglerzeile' }, empf, empfText)),
      h('div', {}, h('p', { class: 'ober' }, 'Grafik (lädt neu)'), grafik)),
    knoepfe: [
      { text: 'Anleitung', aktion: anleitung },
      ...(herunterladen ? [{ text: 'Spiel mit Spielstand herunterladen', aktion: herunterladen }] : []),
      { text: 'Spielstand löschen', klasse: 'gefahr', aktion: loeschen },
      { text: 'Weiter', klasse: 'primaer' },
    ],
  });
}

export function nadelModal(ui, ev, s) {
  const n = NADELN[ev.art];
  const gold = ev.nr === NADELN_JE_LADUNG;
  const geschichte = s.ladung === 1 ? GESCHICHTE.nadeln[Math.min(ev.nr - 1, GESCHICHTE.nadeln.length - 1)] : null;
  ui.modal({
    klasse: gold ? 'gold' : '',
    ober: `Nadel ${ev.nr} von ${NADELN_JE_LADUNG} · Ladung ${s.ladung}`,
    titel: n.name,
    inhalt: h('div', { class: 'nadelgross', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20 17 7"/><ellipse cx="18.5" cy="5.5" rx="2.2" ry="1.2" transform="rotate(-45 18.5 5.5)"/></svg>' }),
    absaetze: [
      geschichte,
      ev.neu ? `Neu in der Sammlung: ${n.bonus}` : 'Diese Art hattest du schon.',
      gold ? 'Das war die letzte dieser Ladung. Am Lieferschalter hinter dem Haufen bestellst du die nächste.' : null,
    ].filter(Boolean),
    knoepfe: [{ text: 'Weitersuchen', klasse: 'primaer' }],
  });
}

export function anleitungZeigen(ui) {
  ui.modal({
    ober: 'Rund sechs Millionen Halme', titel: 'Finde die Nadel',
    // Erst die Steuerung (ohne Scrollen sichtbar), dann die Geschichte
    inhalt: h('div', {}, h('ul', { class: 'anleitung' },
      h('li', {}, 'Links den Daumen aufsetzen und schieben: gehen. Ganz nach außen: rennen.'),
      h('li', {}, 'Rechts wischen: umsehen. Tippen oder der runde Knopf: die Aktion (graben, verkaufen, aufheben).'),
      h('li', {}, 'Unten wählst du das Werkzeug. Heu kommt in die Arme, später in Eimer und Schubkarre.'),
      h('li', {}, 'Am Stand „Heu verkaufen“ kippst du alles in den Trichter. Am Werkzeugstand gibt es Spaten, Heugabel, Besen.'),
      h('li', {}, 'Der Metalldetektor piept, je näher eine Nadel ist. Oben links steht immer der nächste Schritt.')),
      GESCHICHTE.anfang.map((p) => h('p', {}, p))),
    knoepfe: [{ text: 'Los geht’s', klasse: 'primaer' }],
  });
}

