// Baukatalog und Bau-Einblendung. Der Katalog zeigt je Kategorie eine Karte
// pro Bau mit Preis, Strombedarf und Stückzahl; Gesperrtes nennt die
// Forschung, die es freischaltet, Geschenke stehen in Gold. Die Einblendung
// begleitet das Platzieren: oben eine Karte mit Bau, Preis und Hinderungsgrund,
// rechts über dem Aktionsknopf Bestätigen, Drehen, Näher, Weiter, Einrasten.
// Dazu kleine Helfer, die auch Maschinentafel und Auftragstafel nutzen.

import { BAU_KATEGORIEN, BAUTEN } from '../daten.js';
import { bauFrei, bauKosten, bauAnzahl, PLAN_FUER, TECH_NACH_ID, BAU_NACH_ID } from '../wirtschaft.js';
import { geld } from '../format.js';
import { h, setzeText, icon } from './oberflaeche.js';

/** Zuletzt gewählter Reiter im Katalog; null, bis der Katalog einmal offen war. */
let katalogReiter = null;

/** Zahl mit Komma und höchstens einer Nachkommastelle: 2,5 · 15 · 0,5. */
export function kommaZahl(v) {
  return String(Math.round(v * 10) / 10).replace('.', ',');
}

/** hidden nur anfassen, wenn es sich ändert. */
export function sichtbarSetzen(e, sichtbar) {
  if (e.hidden === sichtbar) e.hidden = !sichtbar;
}

/**
 * Ruft fn alle ms Millisekunden, solange el im Dokument hängt. Steht die Tafel
 * noch in der Warteschlange der Modals, wartet die Uhr bis zu einer Minute.
 */
export function solangeOffen(el, ms, fn) {
  let warDrin = false;
  let leer = 0;
  const uhr = setInterval(() => {
    if (!el.isConnected) {
      leer += ms;
      if (warDrin || leer > 60000) clearInterval(uhr);
      return;
    }
    warDrin = true;
    fn();
  }, ms);
  return uhr;
}

function stromHinweis(kw) {
  if (kw > 0) return `braucht ${kommaZahl(kw)} kW`;
  if (kw < 0) return `liefert ${kommaZahl(-kw)} kW`;
  return '';
}

function planHinweis(b) {
  const t = b.frei ? TECH_NACH_ID[PLAN_FUER[b.frei]] : null;
  return t ? `Forschung: ${t.name}` : 'Noch gesperrt';
}

/**
 * Baukatalog als Modal. rueck: { waehlen(typ), abbauen() }.
 * Antippen einer freien Karte schließt den Katalog und ruft waehlen(typ);
 * zu teure Bauten bleiben wählbar, das Platzieren erklärt dann den Grund.
 */
export function baukatalogZeigen(ui, s, rueck) {
  const geschenkDa = (typ) => (s.geschenke[typ] || 0) > 0;
  if (!BAU_KATEGORIEN.some((k) => k.id === katalogReiter)) {
    const mitGeschenk = BAUTEN.find((b) => geschenkDa(b.id));
    katalogReiter = mitGeschenk ? mitGeschenk.kat : BAU_KATEGORIEN[0].id;
  }
  const hinweis = h('p', { class: 'baugeschenke', hidden: true });
  const reiter = {};
  const reiterReihe = h('div', { class: 'bautabs', role: 'tablist', 'aria-label': 'Kategorien' },
    BAU_KATEGORIEN.map((k) => {
      reiter[k.id] = h('button', {
        class: 'bautab', type: 'button', role: 'tab',
        onclick: () => { katalogReiter = k.id; zeichnen(); },
      }, k.name);
      return reiter[k.id];
    }));
  const raster = h('div', { class: 'baukarten', role: 'tabpanel' });
  const inhalt = h('div', {}, hinweis, reiterReihe, raster);
  let karten = [];

  function karteBauen(b) {
    const preis = h('span', { class: 'bkpreis num' });
    const anzahl = h('span', { class: 'bkgebaut num' });
    const strom = stromHinweis(b.kw);
    const plan = h('span', { class: 'bkplan' });
    const knopf = h('button', {
      class: 'baukarte', type: 'button',
      onclick: () => {
        if (!bauFrei(s, b.id)) return;
        ui.modalSchliessen();
        rueck.waehlen(b.id);
      },
    }, h('b', { class: 'bkname' }, b.name), h('span', { class: 'bktext' }, b.text || ''),
    strom ? h('span', { class: 'bkstrom' }, strom) : null, plan, h('span', { class: 'bkfuss' }, preis, anzahl));
    const aktualisieren = () => {
      const frei = bauFrei(s, b.id);
      const geschenke = s.geschenke[b.id] || 0;
      const kosten = bauKosten(s, b.id, b.prometer ? 1 : 0);
      const n = bauAnzahl(s, b.id);
      if (knopf.disabled === frei) knopf.disabled = !frei;
      knopf.classList.toggle('gesperrt', !frei);
      knopf.classList.toggle('geschenk', geschenke > 0);
      if (geschenke > 0) setzeText(preis, geschenke > 1 ? `${geschenke} Geschenke` : 'Geschenk');
      else setzeText(preis, b.prometer ? `je Meter ${geld(kosten)}` : geld(kosten));
      preis.classList.toggle('geschenk', geschenke > 0);
      preis.classList.toggle('teuer', frei && !geschenke && s.geld < kosten);
      setzeText(anzahl, n > 0 ? `gebaut: ${n}` : '');
      sichtbarSetzen(anzahl, n > 0);
      setzeText(plan, frei ? '' : planHinweis(b));
      sichtbarSetzen(plan, !frei);
    };
    return { knopf, aktualisieren };
  }

  function aktualisieren() {
    const warten = Object.entries(s.geschenke).filter(([typ, n]) => n > 0 && BAU_NACH_ID[typ]);
    const summe = warten.reduce((n, [, m]) => n + m, 0);
    setzeText(hinweis, summe ? `${summe > 1 ? 'Geschenke warten' : 'Geschenk wartet'}: ${
      warten.map(([typ, n]) => (n > 1 ? `${n}× ${BAU_NACH_ID[typ].name}` : BAU_NACH_ID[typ].name)).join(', ')}` : '');
    sichtbarSetzen(hinweis, summe > 0);
    for (const k of BAU_KATEGORIEN) reiter[k.id].classList.toggle('geschenk', BAUTEN.some((b) => b.kat === k.id && geschenkDa(b.id)));
    for (const k of karten) k.aktualisieren();
    const kasse = inhalt.closest('.modal')?.querySelector(':scope > .ober');
    if (kasse) setzeText(kasse, `Kasse: ${geld(s.geld)}`);
  }

  function zeichnen() {
    for (const k of BAU_KATEGORIEN) {
      reiter[k.id].classList.toggle('gewaehlt', k.id === katalogReiter);
      reiter[k.id].setAttribute('aria-selected', k.id === katalogReiter ? 'true' : 'false');
    }
    karten = BAUTEN.filter((b) => b.kat === katalogReiter).map(karteBauen);
    raster.replaceChildren(...karten.map((k) => k.knopf));
    aktualisieren();
  }

  zeichnen();
  ui.modal({
    ober: `Kasse: ${geld(s.geld)}`, titel: 'Baukatalog', inhalt, klasse: 'baukatalog',
    knoepfe: [{ text: 'Abbauen', aktion: () => rueck.abbauen() }, { text: 'Schließen', klasse: 'primaer' }],
  });
  // Den gemerkten Reiter in die Reihe holen, falls er rechts außerhalb liegt.
  const tab = reiter[katalogReiter];
  if (tab.isConnected) reiterReihe.scrollLeft += tab.getBoundingClientRect().left - reiterReihe.getBoundingClientRect().left - 16;
  solangeOffen(inhalt, 500, aktualisieren);
}

/**
 * Einblendung beim Platzieren, hängt unter wurzel (dort, wo auch das HUD liegt).
 * rueck: { setzen(), drehen(), naeher(), weiter(), hoeher(), tiefer(), einrasten(), abbrechen() }.
 * zeigen(info) darf jedes Bild laufen, es ändert das DOM nur bei neuen Werten.
 * info: { titel, zeile, grund, ok, schritt: 'setzen'|'anfang'|'ende'|'abbau',
 *         einrasten: true|false|null (null blendet den Schalter aus), drehen, abstand,
 *         hoehe: Zahl (Bandenden anheben: blendet Höher/Tiefer ein) }.
 */
export function bauHudBauen(wurzel, rueck) {
  const BESTAETIGEN = { setzen: 'Hier bauen', anfang: 'Anfang setzen', ende: 'Ende setzen', abbau: 'Abbauen' };
  const knopf = (klasse, text, fn) => h('button', {
    class: `bhknopf${klasse ? ` ${klasse}` : ''}`, type: 'button',
    onclick: (ev) => { ev.stopPropagation(); fn(); },
  }, text);
  const titel = h('b', { class: 'bhtitel' });
  const zeile = h('span', { class: 'bhzeile num' });
  const grund = h('span', { class: 'bhgrund', hidden: true });
  const zu = h('button', {
    class: 'bhzu', type: 'button', 'aria-label': 'Abbrechen', title: 'Abbrechen',
    onclick: (ev) => { ev.stopPropagation(); rueck.abbrechen(); },
  }, icon('zu'));
  const karte = h('div', { class: 'bhkarte', role: 'status' }, h('div', { class: 'bhtexte' }, titel, zeile, grund), zu);
  const naeher = knopf('', 'Näher', () => rueck.naeher());
  const weiter = knopf('', 'Weiter', () => rueck.weiter());
  // Bandenden anheben: für Rampen und um über andere Bänder zu kreuzen
  const tiefer = knopf('', 'Tiefer', () => rueck.tiefer && rueck.tiefer());
  const hoeher = knopf('', 'Höher', () => rueck.hoeher && rueck.hoeher());
  const drehen = knopf('', 'Drehen', () => rueck.drehen());
  const einrasten = knopf('schalter', 'Einrasten: an', () => rueck.einrasten());
  const bestaetigen = knopf('bestaetigen', BESTAETIGEN.setzen, () => rueck.setzen());
  const reiheAbstand = h('div', { class: 'bhreihe' }, naeher, weiter, tiefer, hoeher);
  const reiheDrehen = h('div', { class: 'bhreihe' }, drehen, einrasten);
  const leiste = h('div', { class: 'bhleiste' }, reiheAbstand, reiheDrehen, bestaetigen);
  const el = h('div', { class: 'bauhud', hidden: true }, h('div', { class: 'bhband' }, karte), leiste);
  // Nichts davon darf bis zur 3D-Fläche durchgehen (Tippen hieße dort: Aktion).
  for (const x of [karte, leiste]) x.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  wurzel.append(el);

  const alt = { an: false, ok: undefined, schritt: undefined, rast: undefined };
  function zeigen(info) {
    sichtbarSetzen(el, true);
    if (!alt.an) { alt.an = true; wurzel.classList.add('bauend'); }
    setzeText(titel, info.titel || '');
    setzeText(zeile, info.zeile || '');
    sichtbarSetzen(zeile, !!info.zeile);
    setzeText(grund, info.grund || '');
    sichtbarSetzen(grund, !!info.grund);
    const ok = !!info.ok;
    if (alt.ok !== ok) {
      alt.ok = ok;
      karte.classList.toggle('nein', !ok);
      bestaetigen.classList.toggle('matt', !ok);
      bestaetigen.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
    const schritt = BESTAETIGEN[info.schritt] ? info.schritt : 'setzen';
    if (alt.schritt !== schritt) {
      alt.schritt = schritt;
      setzeText(bestaetigen, BESTAETIGEN[schritt]);
      bestaetigen.classList.toggle('gefahr', schritt === 'abbau');
    }
    const rast = info.einrasten == null ? null : !!info.einrasten;
    if (alt.rast !== rast) {
      alt.rast = rast;
      sichtbarSetzen(einrasten, rast !== null);
      if (rast !== null) {
        setzeText(einrasten, rast ? 'Einrasten: an' : 'Einrasten: aus');
        einrasten.classList.toggle('an', rast);
        einrasten.setAttribute('aria-pressed', rast ? 'true' : 'false');
      }
    }
    sichtbarSetzen(drehen, !!info.drehen);
    sichtbarSetzen(naeher, !!info.abstand);
    sichtbarSetzen(weiter, !!info.abstand);
    const hub = typeof info.hoehe === 'number';
    sichtbarSetzen(tiefer, hub);
    sichtbarSetzen(hoeher, hub);
    if (hub) {
      tiefer.classList.toggle('matt', info.hoehe <= 0);
      hoeher.classList.toggle('matt', info.hoehe >= 3);
    }
    sichtbarSetzen(reiheAbstand, !!info.abstand || hub);
    sichtbarSetzen(reiheDrehen, !!info.drehen || rast !== null);
  }
  function verstecken() {
    sichtbarSetzen(el, false);
    if (alt.an) { alt.an = false; wurzel.classList.remove('bauend'); }
  }
  return { zeigen, verstecken, el };
}
