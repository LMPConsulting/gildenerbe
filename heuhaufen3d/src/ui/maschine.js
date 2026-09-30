// Maschinentafel: was ein Bau gerade tut (Status mit farbigem Punkt, Werte aus
// maschinenZeilen) und die Schalter und Regler je Typ: Ein/Aus, Wurfweite,
// Weichenmodus, Greiffilter, Richtung und Weite des Rohrwerfers, Helligkeit,
// Brennstoffvorrat, Nadel aus dem Scanner, das ganze Netz am Mast. Abbauen
// fragt nach, wenn eine Nadel darin steckt. Solange die Tafel offen ist,
// frischt sie sich alle 250 ms auf; Eingestelltes wird aus dem Bau gelesen.

import { BAU_KATEGORIEN, PRODUKTE } from '../daten.js';
import { BAU_NACH_ID } from '../wirtschaft.js';
import { lauf } from '../welt.js';
import { STATUS_TEXT, maschinenZeilen, BRENN_MAX } from '../maschinen.js';
import { abbauInfo } from '../bauen.js';
import { netzVon } from '../versorgung.js';
import { drohnenListe } from '../drohnen.js';
import { geld, prozent } from '../format.js';
import { h, setzeText } from './oberflaeche.js';
import { kommaZahl, sichtbarSetzen, solangeOffen } from './bauen.js';

/** Farbe des Statuspunkts: gut (grün), warn (gelb), stoerung (rot), aus (grau). */
const STATUS_PUNKT = {
  laeuft: 'gut', bereit: 'gut', prueft: 'gut',
  wartet: 'warn', voll: 'warn', stau: 'warn', leer: 'warn',
  strom: 'stoerung', wasser: 'stoerung', aus: 'aus',
};
/** Bauten mit Ein/Aus auch ohne Strombedarf und Rezept. */
const EIN_AUS_TYPEN = new Set(['weiche', 'vereiniger', 'rohrwerfer', 'heutreppe', 'heulift', 'rechen', 'arm', 'scanner',
  'radar', 'brunnen', 'generator', 'lampe', 'drohnenstation']);
const WEICHEN_MODI = [['wechsel', 'Abwechselnd'], ['links', 'Nur links'], ['rechts', 'Nur rechts'],
  ['vorrangLinks', 'Vorrang links'], ['vorrangRechts', 'Vorrang rechts']];

/** Rohrwerfer: Schieber rechts = nach rechts drehen (winkel wächst gegen den Uhrzeigersinn). */
function richtungText(g) {
  if (g === 0) return '0°, geradeaus';
  if (Math.abs(g) >= 180) return '180°, nach hinten';
  return `${Math.abs(g)}° nach ${g > 0 ? 'rechts' : 'links'}`;
}

/**
 * Öffnet die Tafel zu einem Bau. rueck: { netz: () => netz, schalten(bau),
 * einstellen(bau, feld, wert), abbauen(bau), nadelnNehmen(bau), netzSchalten(mast) }.
 * Abbauen und Nadel herausnehmen schließen die Tafel, bevor sie zurückrufen.
 */
export function maschinePanelZeigen(ui, s, bau, rueck) {
  const d = BAU_NACH_ID[bau.typ];
  if (!d) return;
  const kat = BAU_KATEGORIEN.find((k) => k.id === d.kat);
  const netzInfo = () => {
    const netz = rueck.netz ? rueck.netz() : null;
    return netz ? netzVon(netz, bau) : null;
  };
  const netzAus = () => {
    const n = netzInfo();
    return n ? n.masten.some((m) => m.aus) : !!bau.aus;
  };
  const eigeneDrohnen = () => drohnenListe(s).filter((dr) => dr.station === bau.id);
  const auffrischen = [];

  // Kopf: Status links, Schalter rechts
  const punkt = h('span', { class: 'statuspunkt' });
  const statusText = h('span', {});
  const status = h('div', { class: 'tafelstatus', role: 'status' }, punkt, statusText);
  let schalter = null;
  if (bau.typ === 'mast') {
    schalter = h('button', { class: 'knopf', type: 'button', onclick: () => { rueck.netzSchalten(bau); aktualisieren(); } });
  } else if (d.kw !== 0 || d.rezept || EIN_AUS_TYPEN.has(bau.typ)) {
    schalter = h('button', { class: 'knopf', type: 'button', onclick: () => { rueck.schalten(bau); aktualisieren(); } });
  }
  const kopf = h('div', { class: 'mtkopf' }, status, schalter);

  function statusJetzt() {
    if (bau.typ === 'mast') {
      const n = netzInfo();
      if (netzAus()) return ['aus', 'Netz aus'];
      if (!n) return ['aus', 'Nicht verbunden'];
      return [n.anteil >= 0.999 ? 'gut' : 'warn',
        `${kommaZahl(n.angebot)} kW da, ${kommaZahl(n.bedarf)} kW gebraucht, ${prozent(n.anteil)}`];
    }
    let st = lauf(bau).status;
    if (bau.aus) st = 'aus';
    else if (bau.typ === 'drohnenstation') st = eigeneDrohnen().some((dr) => dr.zustand !== 'ruht') ? 'laeuft' : 'bereit';
    else if (!st && d.kw > 0) st = (lauf(bau).strom || 0) > 0 ? 'laeuft' : 'strom';
    else if (!st && schalter) st = 'bereit';
    if (!st) return null;
    // „leer“ heißt beim Rechen: kein Heu am Kamm; beim Generator: nichts zum Verbrennen.
    const wort = bau.typ === 'generator' && st === 'leer' ? 'Kein Brennstoff' : STATUS_TEXT[st] || st;
    return [STATUS_PUNKT[st] || 'aus', wort];
  }

  // Werte: maschinenZeilen und was nur die Tafel kennt
  const zeilen = h('dl', { class: 'werte' });
  let zeilenSchluessel = null;
  let zellen = [];
  function zeilenJetzt() {
    const liste = maschinenZeilen(s, bau);
    if (bau.typ === 'mast') {
      const n = netzInfo();
      if (n) {
        const imNetz = [`${n.masten.length} ${n.masten.length === 1 ? 'Mast' : 'Masten'}`];
        if (n.erzeuger.length) imNetz.push(`${n.erzeuger.length} ${n.erzeuger.length === 1 ? 'Generator' : 'Generatoren'}`);
        imNetz.push(`${n.verbraucher.length} ${n.verbraucher.length === 1 ? 'Maschine' : 'Maschinen'}`);
        liste.push(['Im Netz', imNetz.join(', ')], ['Hausanschluss', n.haus ? 'verbunden' : 'nicht verbunden']);
      }
    }
    if (bau.typ === 'drohnenstation') {
      const eigene = eigeneDrohnen();
      const unterwegs = eigene.filter((dr) => dr.zustand !== 'ruht').length;
      liste.push(['Drohnen', eigene.length ? `${eigene.length}${unterwegs ? ` (${unterwegs} unterwegs)` : ''}` : 'keine']);
    }
    return liste;
  }
  function zeilenZeigen() {
    const liste = zeilenJetzt();
    const schluessel = liste.map((z) => z[0]).join('|');
    if (schluessel !== zeilenSchluessel) {
      zeilenSchluessel = schluessel;
      zellen = liste.map(() => h('dd', { class: 'num' }));
      zeilen.replaceChildren(...liste.flatMap((z, i) => [h('dt', {}, z[0]), zellen[i]]));
    }
    liste.forEach((z, i) => setzeText(zellen[i], z[1]));
    sichtbarSetzen(zeilen, liste.length > 0);
  }

  // Bausteine für Regler und Auswahl; beide lesen den Wert nach dem Rückruf aus dem Bau.
  function regler(titel, min, max, schritt, lesen, schreiben, text) {
    const wert = h('span', { class: 'num' });
    const eingabe = h('input', {
      type: 'range', class: 'regler', min: String(min), max: String(max), step: String(schritt),
      value: String(lesen()), 'aria-label': titel,
    });
    const zeigen = () => setzeText(wert, text(lesen()));
    eingabe.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    eingabe.addEventListener('input', () => { schreiben(Number(eingabe.value)); zeigen(); });
    eingabe.addEventListener('change', () => { eingabe.value = String(lesen()); zeigen(); });
    zeigen();
    return h('div', { class: 'mtteil' }, h('div', { class: 'regelkopf' }, h('span', {}, titel), wert), eingabe);
  }
  function wahl(titel, optionen, lesen, schreiben) {
    const knoepfe = optionen.map(([id, name]) => h('button', {
      class: 'chip', type: 'button', onclick: () => { schreiben(id); markieren(); },
    }, name));
    const markieren = () => {
      const jetzt = lesen();
      optionen.forEach(([id], i) => {
        knoepfe[i].classList.toggle('gewaehlt', id === jetzt);
        knoepfe[i].setAttribute('aria-pressed', id === jetzt ? 'true' : 'false');
      });
    };
    markieren();
    auffrischen.push(markieren);
    const reihe = h('div', { class: 'chips' }, knoepfe);
    reihe.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    return h('div', { class: 'mtteil' }, h('p', { class: 'ober' }, titel), reihe);
  }

  const teile = [];
  let nadelKnopf = null;
  if (bau.typ === 'scanner') {
    nadelKnopf = h('button', {
      class: 'knopf nadelknopf', type: 'button', hidden: true,
      onclick: () => {
        if (!(bau.nadeln || []).length) return;
        ui.modalSchliessen();
        rueck.nadelnNehmen(bau);
      },
    });
    auffrischen.push(() => {
      const n = (bau.nadeln || []).length;
      setzeText(nadelKnopf, n > 1 ? `${n} Nadeln herausnehmen` : 'Nadel herausnehmen');
      sichtbarSetzen(nadelKnopf, n > 0);
    });
  }
  if (bau.typ === 'rechen' || bau.typ === 'pellet') {
    const standard = bau.typ === 'rechen' ? 2.5 : 3;
    teile.push(regler('Wurfweite', d.wurf[0], d.wurf[1], 0.1, () => bau.weite ?? standard,
      (v) => rueck.einstellen(bau, 'weite', v), (v) => `${kommaZahl(v)} m`));
  }
  if (bau.typ === 'weiche') {
    teile.push(wahl('Verteilung', WEICHEN_MODI, () => bau.modus || 'wechsel', (id) => rueck.einstellen(bau, 'modus', id)));
  }
  if (bau.typ === 'arm' || bau.typ === 'vorrangarm') {
    const filter = [['alle', 'Alles'], ...Object.entries(PRODUKTE).map(([id, p]) => [id, p.name])];
    teile.push(wahl('Greift nach', filter, () => bau.filter || 'alle', (id) => rueck.einstellen(bau, 'filter', id)));
  }
  if (bau.typ === 'rohrwerfer') {
    teile.push(regler('Richtung', -180, 180, 5, () => Math.round((-(bau.winkel || 0) * 180) / Math.PI),
      (v) => rueck.einstellen(bau, 'winkel', (-v * Math.PI) / 180), richtungText));
    teile.push(regler('Weite', 2, 20, 0.5, () => bau.weite ?? 8,
      (v) => rueck.einstellen(bau, 'weite', v), (v) => `${kommaZahl(v)} m`));
  }
  if (bau.typ === 'lampe') {
    teile.push(regler('Helligkeit', 0, 100, 5, () => Math.round((bau.hell ?? 1) * 100),
      (v) => rueck.einstellen(bau, 'hell', v / 100), (v) => `${v} %`));
  }
  if (bau.typ === 'generator') {
    const fuellung = h('div', { class: 'fuellung' });
    const vorrat = h('span', { class: 'num' });
    teile.push(h('div', { class: 'mtteil' }, h('div', { class: 'regelkopf' }, h('span', {}, 'Vorrat'), vorrat),
      h('div', { class: 'fortschritt brenn', role: 'img', 'aria-label': 'Brennstoffvorrat' }, fuellung)));
    auffrischen.push(() => {
      const teil = Math.max(0, Math.min(1, (bau.brenn || 0) / BRENN_MAX));
      const breite = `${Math.round(teil * 100)}%`;
      if (fuellung.style.width !== breite) fuellung.style.width = breite;
      setzeText(vorrat, prozent(teil));
    });
  }

  // Abbauen, mit Rückfrage, wenn eine Nadel darin steckt
  const abbauKnopf = h('button', { class: 'knopf gefahr breit mtabbau', type: 'button' });
  const rueckfrage = h('div', { class: 'rueckfrage', hidden: true },
    h('p', {}, 'In der Maschine steckt eine Nadel. Sie fällt zurück in den Haufen.'),
    h('div', { class: 'rueckfragewahl' },
      h('button', { class: 'knopf gefahr', type: 'button', onclick: () => { ui.modalSchliessen(); rueck.abbauen(bau); } }, 'Trotzdem abbauen'),
      h('button', {
        class: 'knopf primaer', type: 'button',
        onclick: () => { sichtbarSetzen(rueckfrage, false); sichtbarSetzen(abbauKnopf, true); },
      }, 'Behalten')));
  abbauKnopf.addEventListener('click', () => {
    if (abbauInfo(s, bau).warnung === 'nadel') {
      sichtbarSetzen(rueckfrage, true);
      sichtbarSetzen(abbauKnopf, false);
      return;
    }
    ui.modalSchliessen();
    rueck.abbauen(bau);
  });
  auffrischen.push(() => {
    const info = abbauInfo(s, bau);
    setzeText(abbauKnopf, info.geschenk ? 'Abbauen (Geschenk zurück)'
      : info.erstattung > 0 ? `Abbauen (+${geld(info.erstattung)} zurück)` : 'Abbauen');
  });

  function aktualisieren() {
    const st = statusJetzt();
    sichtbarSetzen(status, !!st);
    if (st) {
      for (const f of ['gut', 'warn', 'stoerung', 'aus']) punkt.classList.toggle(f, f === st[0]);
      setzeText(statusText, st[1]);
    }
    if (schalter) {
      setzeText(schalter, bau.typ === 'mast' ? (netzAus() ? 'Netz einschalten' : 'Netz ausschalten')
        : bau.aus ? 'Einschalten' : 'Ausschalten');
    }
    sichtbarSetzen(kopf, !!st || !!schalter);
    zeilenZeigen();
    for (const f of auffrischen) f();
  }

  const inhalt = h('div', { class: 'maschineninhalt' }, kopf, nadelKnopf, zeilen, teile, abbauKnopf, rueckfrage);
  aktualisieren();
  ui.modal({
    ober: kat ? kat.name : '', titel: d.name, inhalt, klasse: 'maschinentafel',
    knoepfe: [{ text: 'Schließen', klasse: 'primaer' }],
  });
  solangeOffen(inhalt, 250, () => {
    // Anderswo abgebaut: Tafel zu, sie zeigte sonst einen Bau, den es nicht mehr gibt.
    if (!s.bauten.includes(bau)) { ui.modalSchliessen(); return; }
    aktualisieren();
  });
}
