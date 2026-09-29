// Spiellogik ohne DOM: ein Stand-Objekt, das sich als JSON speichern lässt,
// und reine Funktionen darauf. Zufall kommt aus einem eigenen Generator im
// Stand, damit Tests und Simulation reproduzierbar bleiben.

import {
  GRUND, LADUNGEN, LADUNG_WACHSTUM, LADUNG_PREIS, LADUNG_PREIS_FAKTOR, KREDIT_AUFSCHLAG,
  KREDIT_AUFSCHLAG_GUT, KREDIT_TILGUNG, NADEL_BEREICHE, NADELN, WERKZEUGE, TECH, MASCHINEN, VERARBEITUNG_REIHE, ZWISCHEN,
  PRODUKTE, AUFTRAEGE, AUFTRAG_PAUSE, MISSIONEN, KUNDEN,
} from './daten.js';

export const STAND_VERSION = 2;
export const TECH_NACH_ID = Object.fromEntries(TECH.map((t) => [t.id, t]));
export const MASCHINE_NACH_ID = Object.fromEntries(MASCHINEN.map((m) => [m.id, m]));
/** Welcher Knoten schaltet was frei: frei-Name → Knoten-ID. */
const PLAN_FUER = Object.fromEntries(TECH.flatMap((t) => t.effekt.filter((e) => e[0] === 'frei').map((e) => [e[1], t.id])));
export const WERKZEUG_NACH_ID = Object.fromEntries(WERKZEUGE.map((w) => [w.id, w]));
export const TECH_STUFEN_GESAMT = TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : t.stufen), 0);
export const NADELN_JE_LADUNG = NADEL_BEREICHE.length;

/** Strom, den die Halle auch ohne Generator hat (eine Handkurbel in der Ecke). */
export const GRUNDSTROM = 5;
/** Wie tief eine übersehene Nadel höchstens zurückrutscht, als Anteil des Haufens. */
export const NADEL_RUTSCH = 0.03;
const DROHNE_KOSTEN = 55;
const DROHNE_FAKTOR = 1.35;

/* ------------------------------------------------------------ Zufall */

/** mulberry32: klein, schnell, und der ganze Zustand ist eine Zahl im Stand. */
export function zufall(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------ Ladungen */

export function ladungGroesse(nr) {
  if (nr <= LADUNGEN.length) return LADUNGEN[nr - 1];
  return Math.round(LADUNGEN[LADUNGEN.length - 1] * Math.pow(LADUNG_WACHSTUM, nr - LADUNGEN.length));
}

export function ladungPreis(s) {
  return Math.round(LADUNG_PREIS * Math.pow(LADUNG_PREIS_FAKTOR, s.ladung - 1));
}

/** Welche Nadelarten in Ladung nr stecken: erst die 24 der Reihe nach, danach gemischt. */
function nadelArten(s, nr) {
  const start = (nr - 1) * NADELN_JE_LADUNG;
  if (start + NADELN_JE_LADUNG <= NADELN.length) {
    return Array.from({ length: NADELN_JE_LADUNG }, (_, i) => start + i);
  }
  const arten = NADELN.map((_, i) => i);
  for (let i = arten.length - 1; i > 0; i--) {
    const j = Math.floor(zufall(s) * (i + 1));
    [arten[i], arten[j]] = [arten[j], arten[i]];
  }
  return arten.slice(0, NADELN_JE_LADUNG);
}

function nadelnVerstecken(s, nr, gesamt) {
  const arten = nadelArten(s, nr);
  return NADEL_BEREICHE.map(([von, bis], i) => ({
    art: arten[i],
    tiefe: Math.round(gesamt * (von + zufall(s) * (bis - von))),
    zustand: 'versteckt',
    zeit: null,
  }));
}

/* ------------------------------------------------------------ Stand */

export function neuerStand(seed = Date.now()) {
  const s = {
    version: STAND_VERSION,
    rng: seed | 0,
    rev: 0,
    zeit: 0,
    aktiv: 0,
    geld: 0,
    verdient: 0,
    schulden: 0,
    ladung: 1,
    haufen: { gesamt: ladungGroesse(1), entfernt: 0 },
    werkzeug: 'spaten',
    tasche: 0,
    laufen: 0,
    laufVoll: 0,
    autoRest: 0,
    ausdauer: GRUND.ausdauer,
    boden: 0,
    tech: { scheune: 1 },
    maschinen: {},
    aus: {},
    drohnen: 0,
    nadeln: [],
    arten: {},
    nadelnGesamt: 0,
    sauger: { an: false, hitze: 0, heiss: false },
    radar: { rest: 0, abstand: null, zeit: null },
    auftrag: { nr: 0, skip: 0, geliefert: 0, pause: 0 },
    mission: 0,
    stat: {
      tipps: 0, hand: 0, drohne: 0, maschine: 0, gaenge: 0, verkauft: 0, gefegt: 0,
      abgetragen: 0, auftraege: 0, besterVerkauf: 0, maxGeld: 0, ersteNadel: null, ersteLadung: null,
      produziert: {}, werkzeug: {},
    },
    zuletzt: Date.now(),
  };
  s.nadeln = nadelnVerstecken(s, 1, s.haufen.gesamt);
  return s;
}

export const rest = (s) => Math.max(0, s.haufen.gesamt - s.haufen.entfernt);
export const nadelnGefunden = (s) => s.nadeln.filter((n) => n.zustand === 'gefunden').length;
export const alleNadeln = (s) => s.nadeln.every((n) => n.zustand === 'gefunden');
export const artenGefunden = (s) => Object.values(s.arten).filter((n) => n > 0).length;

/* ------------------------------------------------------------ Werte */

const cache = new WeakMap();

/** Alle abgeleiteten Zahlen: Grundwerte, darauf Forschung und gesammelte Nadelarten. */
export function werte(s) {
  const alt = cache.get(s);
  if (alt && alt.rev === s.rev) return alt.w;

  const plus = {};
  const mal = {};
  const frei = new Set();
  const anwenden = (effekte, n) => {
    for (const e of effekte) {
      if (e[0] === 'frei') { frei.add(e[1]); continue; }
      if (e[1] === '+') plus[e[0]] = (plus[e[0]] || 0) + e[2] * n;
      else mal[e[0]] = (mal[e[0]] || 1) * Math.pow(e[2], n);
    }
  };
  for (const t of TECH) {
    const n = s.tech[t.id] || 0;
    if (n > 0) anwenden(t.effekt, Math.min(n, t.stufen));
  }
  // Jede Nadelart zählt einmal, egal wie oft man sie gefunden hat.
  for (const [art, n] of Object.entries(s.arten)) if (n > 0 && NADELN[art]) anwenden(NADELN[art].effekt, 1);

  const w = { ...GRUND };
  for (const key of new Set([...Object.keys(plus), ...Object.keys(mal)])) {
    const basis = key in GRUND ? GRUND[key] : (key in plus ? 0 : 1);
    w[key] = (basis + (plus[key] || 0)) * (mal[key] || 1);
  }
  w.frei = frei;
  cache.set(s, { rev: s.rev, w });
  return w;
}

const faktor = (w, key) => (key in w ? w[key] : 1);

export const taschePlatz = (w) => Math.floor(w.tasche);
export const preisRoh = (w) => w.preisRoh * w.preisAlle;
export const hatBand = (w) => w.frei.has('band');

export function produktPreis(w, p) {
  if (p === 'roh') return preisRoh(w);
  return PRODUKTE[p].wert * (w.preisRoh / GRUND.preisRoh) * w.preisAlle * w.preisProdukt * faktor(w, 'preis_' + p);
}

/** Halme pro Stich mit dem Werkzeug, ohne Ausdauer und Glück. */
export function stichMenge(w, werkzeug) {
  if (werkzeug === 'heugabel') return w.griff * w.heugabel;
  if (werkzeug === 'sandschaufel') return w.griff * w.sandschaufel;
  return w.griff;
}

/** Das beste Grabwerkzeug, das man hat — für Muskelgedächtnis und Anzeige. */
export const bestesWerkzeug = (w) => (w.frei.has('heugabel') ? 'heugabel' : 'spaten');

export function werkzeugFrei(s, id) {
  const wz = WERKZEUG_NACH_ID[id];
  return !!wz && (wz.frei === null || werte(s).frei.has(wz.frei));
}

/* ------------------------------------------------------------ Geld */

/** Jede Einnahme läuft hier durch: Schulden werden zuerst anteilig getilgt. */
function einnahme(s, betrag) {
  if (!(betrag > 0)) return 0;
  s.verdient += betrag;
  if (s.schulden > 0) {
    const tilgung = Math.min(s.schulden, betrag * KREDIT_TILGUNG);
    s.schulden -= tilgung;
    betrag -= tilgung;
    if (s.schulden < 1e-6) s.schulden = 0;
  }
  s.geld += betrag;
  if (s.geld > s.stat.maxGeld) s.stat.maxGeld = s.geld;
  return betrag;
}

/* ------------------------------------------------------------ Haufen abtragen */

function nadelFinden(s, i, ereignisse) {
  const nd = s.nadeln[i];
  // Die Arten werden in der Reihenfolge des Findens vergeben, damit die
  // Geschichte stimmt, auch wenn eine zurückgefallene Nadel eine andere überholt.
  for (const andere of s.nadeln) {
    if (andere !== nd && andere.zustand === 'versteckt' && andere.art < nd.art) {
      [andere.art, nd.art] = [nd.art, andere.art];
    }
  }
  nd.zustand = 'gefunden';
  nd.zeit = s.aktiv;
  s.arten[nd.art] = (s.arten[nd.art] || 0) + 1;
  s.nadelnGesamt++;
  if (s.stat.ersteNadel == null) s.stat.ersteNadel = s.aktiv;
  s.rev++;
  ereignisse.push({
    typ: 'nadel', i, art: nd.art, nr: nadelnGefunden(s), alle: alleNadeln(s), ladung: s.ladung,
    neu: s.arten[nd.art] === 1,
  });
}

/**
 * Nimmt Halme vom Haufen. quelle: 'hand' und 'drohne' sehen jede Nadel;
 * 'maschine' nur mit der Wahrscheinlichkeit der Scannerabdeckung. Eine
 * übersehene Nadel wird mit dem Heu verkauft — und landet wie im Vorbild
 * wieder irgendwo im restlichen Haufen.
 */
export function abtragen(s, menge, quelle, ereignisse = [], deckung = 1) {
  const vorher = s.haufen.entfernt;
  menge = Math.min(menge, rest(s));
  if (!(menge > 0)) return 0;
  const nachher = vorher + menge;
  s.haufen.entfernt = nachher;
  s.stat[quelle] = (s.stat[quelle] || 0) + menge;
  s.stat.abgetragen += menge;

  s.nadeln.forEach((nd, i) => {
    if (nd.zustand !== 'versteckt' || nd.tiefe <= vorher || nd.tiefe > nachher) return;
    if (quelle !== 'maschine' || zufall(s) < deckung) { nadelFinden(s, i, ereignisse); return; }
    // Sie rutscht nicht bis ganz nach unten, sondern landet in den nächsten
    // paar Prozent des Haufens.
    const uebrig = Math.min(s.haufen.gesamt - nachher, s.haufen.gesamt * NADEL_RUTSCH);
    if (uebrig < 1) { nadelFinden(s, i, ereignisse); return; }
    nd.tiefe = Math.min(s.haufen.gesamt, nachher + Math.max(1, Math.round(zufall(s) * uebrig)));
    ereignisse.push({ typ: 'zurueck', i });
  });
  return menge;
}

/* ------------------------------------------------------------ Hände und Werkzeug */

export function werkzeugWaehlen(s, id) {
  if (!werkzeugFrei(s, id)) return false;
  s.werkzeug = id;
  if (id !== 'sauger') s.sauger.an = false;
  return true;
}

/** Legt Halme ab: mit Förderband direkt aufs Band und verkauft, sonst in die Tasche. */
function ablegen(s, w, menge) {
  if (hatBand(w)) {
    const betrag = menge * preisRoh(w);
    einnahme(s, betrag);
    s.stat.verkauft += menge;
    return betrag;
  }
  s.tasche += menge;
  return 0;
}

function platzFuerHand(s, w) {
  return hatBand(w) ? Infinity : Math.max(0, taschePlatz(w) - s.tasche);
}

/**
 * Ein Stich in den Haufen mit dem gewählten Werkzeug. auto: Muskelgedächtnis,
 * kostet keine Ausdauer. Liefert null, wenn gerade niemand da ist.
 */
export function stich(s, ereignisse = [], { auto = false } = {}) {
  if (s.laufen > 0) return null;
  const w = werte(s);
  const wz = auto ? bestesWerkzeug(w) : s.werkzeug;
  if (!auto) s.stat.werkzeug[wz] = (s.stat.werkzeug[wz] || 0) + 1;

  if (wz === 'detektor') return { menge: 0, detektor: true, ereignisse };
  if (wz === 'sauger') return { menge: 0, sauger: true, ereignisse };
  if (wz === 'besen') return fegen(s, w, ereignisse);

  if (rest(s) <= 0) return { menge: 0, leer: true, ereignisse };
  const frei = platzFuerHand(s, w);
  if (frei <= 0) return { menge: 0, voll: true, ereignisse };

  let menge = stichMenge(w, wz);
  let muede = false;
  if (!auto && wz !== 'sandschaufel') {
    if (s.ausdauer >= w.ausdauerKosten) s.ausdauer -= w.ausdauerKosten;
    else { menge *= w.erschoepft; muede = true; }
  }
  const krit = w.krit > 0 && zufall(s) < w.krit;
  if (krit) menge *= w.kritFaktor;
  menge = Math.min(menge, frei);
  // Etwas fällt immer daneben; ohne Besen hört das Verschütten irgendwann auf.
  const daneben = w.frei.has('besen') || s.boden < 400 ? menge * w.verschuetten : 0;
  const weg = abtragen(s, menge + daneben, 'hand', ereignisse);
  const inHand = Math.min(menge, weg);
  s.boden += weg - inHand;
  const betrag = ablegen(s, w, inHand);
  if (!auto) s.stat.tipps++;
  return {
    menge: inHand, betrag, krit, muede,
    voll: !hatBand(w) && s.tasche >= taschePlatz(w), ereignisse,
  };
}

function fegen(s, w, ereignisse) {
  if (s.boden < 0.5) return { menge: 0, nichts: true, ereignisse };
  const menge = Math.min(s.boden, w.besen, platzFuerHand(s, w));
  if (menge <= 0) return { menge: 0, voll: true, ereignisse };
  s.boden -= menge;
  s.stat.gefegt += menge;
  const betrag = ablegen(s, w, menge);
  return { menge, betrag, gefegt: true, voll: !hatBand(w) && s.tasche >= taschePlatz(w), ereignisse };
}

export function saugen(s, an) {
  const w = werte(s);
  s.sauger.an = !!an && w.frei.has('sauger') && s.werkzeug === 'sauger' && !s.sauger.heiss;
}

/** Warum der Sauger gerade nichts tut, oder null. */
export function saugerBlockiert(s) {
  const w = werte(s);
  if (s.sauger.heiss) return 'heiss';
  if (s.laufen > 0) return 'unterwegs';
  if (rest(s) <= 0) return 'leer';
  if (platzFuerHand(s, w) <= 0) return 'voll';
  return null;
}

/** Los zum Stand. Bezahlt wird bei der Ankunft (siehe tick). */
export function verkaufen(s) {
  if (s.laufen > 0 || s.tasche <= 0) return false;
  s.laufen = Math.max(0.05, werte(s).laufzeit);
  s.laufVoll = s.laufen;
  s.sauger.an = false;
  return true;
}

function ankommen(s, ereignisse) {
  const w = werte(s);
  const betrag = s.tasche * preisRoh(w);
  einnahme(s, betrag);
  s.stat.verkauft += s.tasche;
  if (s.tasche > s.stat.besterVerkauf) s.stat.besterVerkauf = s.tasche;
  ereignisse.push({ typ: 'verkauft', menge: s.tasche, betrag });
  s.tasche = 0;
  s.stat.gaenge++;
}

/* ------------------------------------------------------------ Drohnen */

export function drohnenKosten(s) {
  return Math.ceil(DROHNE_KOSTEN * Math.pow(DROHNE_FAKTOR, s.drohnen));
}

export function drohneKaufen(s) {
  const w = werte(s);
  if (!w.frei.has('drohne')) return { ok: false, grund: 'gesperrt' };
  if (s.drohnen >= w.drohnenMax) return { ok: false, grund: 'voll' };
  const preis = drohnenKosten(s);
  if (s.geld < preis) return { ok: false, grund: 'geld' };
  s.geld -= preis;
  s.drohnen++;
  return { ok: true };
}

/* ------------------------------------------------------------ Forschung */

export const techStufe = (s, id) => s.tech[id] || 0;

/** Rundet erst das Gleitkommarauschen weg, dann auf 10 Cent bzw. ganze Dollar. */
function preisRunden(c) {
  c = Math.round(c * 1e6) / 1e6;
  return c < 100 ? Math.ceil(c * 10) / 10 : Math.ceil(c);
}

export function techKosten(s, id) {
  const t = TECH_NACH_ID[id];
  if (!t) return Infinity;
  return preisRunden(t.kosten * Math.pow(t.faktor, techStufe(s, id)));
}

export const techOffen = (s, id) => !!TECH_NACH_ID[id] && TECH_NACH_ID[id].braucht.every((b) => techStufe(s, b) > 0);

/** 'max' | 'kaufbar' | 'teuer' | 'gesperrt' */
export function techStatus(s, id) {
  const t = TECH_NACH_ID[id];
  if (!t) return 'gesperrt';
  if (techStufe(s, id) >= t.stufen) return 'max';
  if (!techOffen(s, id)) return 'gesperrt';
  return s.geld >= techKosten(s, id) ? 'kaufbar' : 'teuer';
}

export function techKaufen(s, id) {
  const status = techStatus(s, id);
  if (status !== 'kaufbar') return { ok: false, grund: status };
  s.geld -= techKosten(s, id);
  if (s.geld < 0 && s.geld > -1e-9) s.geld = 0;
  s.tech[id] = techStufe(s, id) + 1;
  s.rev++;
  return { ok: true };
}

export const techGekauft = (s) => TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : Math.min(techStufe(s, t.id), t.stufen)), 0);

/** Schritte vom Start: der längste Weg über alle Voraussetzungen. */
export const TECH_SCHRITTE = (() => {
  const schritte = {};
  const tiefe = (id) => {
    if (id in schritte) return schritte[id];
    const t = TECH_NACH_ID[id];
    schritte[id] = t.braucht.length ? 1 + Math.max(...t.braucht.map(tiefe)) : 0;
    return schritte[id];
  };
  for (const t of TECH) tiefe(t.id);
  return schritte;
})();

/** Maße im Forschungsbaum in Zeileneinheiten. */
export const BAUM_MASS = { karte: 0.82, zeile: 0.42, kopf: 0.36, luecke: 0.2, astLuecke: 0.6 };

/**
 * Lage im Forschungsbaum: die Spalte ist die Zahl der Schritte vom Start, die
 * Zeile kommt aus einem ordentlich gelegten Baum je Ast (Blätter untereinander,
 * Eltern mittig neben ihren Kindern). Upgrades mit gleicher Gruppe stehen wie
 * im Vorbild als schmale Zeilen unter einer Überschrift.
 * Liefert { lage: {id: {x, y, h}}, gruppen: [{name, ast, x, y, ids}], aeste, hoehe, breite }.
 */
export function techLage(aeste) {
  const M = BAUM_MASS;
  const lage = {};
  const gruppen = [];
  const baender = [];

  // Ein Block ist ein fertig gelegter Teilbaum mit eigener Umrisslinie je Spalte.
  // Blöcke werden untereinander gestapelt und rücken so weit nach oben, wie ihre
  // Spalten es zulassen: ein kurzer Ast braucht dann keine eigene Zeile über die ganze Breite.
  const block = () => ({ karten: [], koepfe: [], oben: new Map(), unten: new Map(), anker: 0 });
  const belege = (bl, x, y, h) => {
    bl.oben.set(x, Math.min(bl.oben.has(x) ? bl.oben.get(x) : Infinity, y));
    bl.unten.set(x, Math.max(bl.unten.has(x) ? bl.unten.get(x) : -Infinity, y + h));
  };
  const schiebe = (bl, d) => {
    for (const k of bl.karten) k.y += d;
    for (const k of bl.koepfe) k.y += d;
    for (const [x, v] of bl.oben) bl.oben.set(x, v + d);
    for (const [x, v] of bl.unten) bl.unten.set(x, v + d);
    bl.anker += d;
  };
  const stapeln = (bloecke) => {
    const ges = block();
    const anker = [];
    let zuletzt = 0;
    for (const bl of bloecke) {
      let d = zuletzt;
      for (const [x, v] of bl.oben) {
        if (ges.unten.has(x)) d = Math.max(d, ges.unten.get(x) + M.luecke - v);
      }
      schiebe(bl, d);
      zuletzt = d;
      ges.karten.push(...bl.karten);
      ges.koepfe.push(...bl.koepfe);
      for (const [x, v] of bl.oben) belege(ges, x, v, bl.unten.get(x) - v);
      anker.push(bl.anker);
    }
    ges.anker = anker.length ? (anker[0] + anker[anker.length - 1]) / 2 : 0;
    return ges;
  };

  for (const ast of aeste) {
    const knoten = TECH.filter((t) => t.ast === ast.id);
    const imAst = new Set(knoten.map((t) => t.id));
    const vater = (t) => t.braucht.find((b) => imAst.has(b)) || null;
    // Gruppen nach hinten, damit die großen Karten oben stehen.
    const ordnen = (ks) => ks.sort((a, b) => (a.gruppe ? 1 : 0) - (b.gruppe ? 1 : 0));

    const einheiten = (ks) => {
      const liste = [];
      for (let i = 0; i < ks.length;) {
        const kk = ks[i];
        if (kk.gruppe) {
          let j = i;
          const ids = [];
          while (j < ks.length && ks[j].gruppe === kk.gruppe) ids.push(ks[j++].id);
          const x = Math.max(...ids.map((id) => TECH_SCHRITTE[id]));
          const bl = block();
          bl.koepfe.push({ name: kk.gruppe, ast: ast.id, x, y: 0, ids });
          ids.forEach((id, n) => bl.karten.push({ id, x, y: M.kopf + n * M.zeile, h: M.zeile }));
          const hoch = M.kopf + ids.length * M.zeile;
          belege(bl, x, 0, hoch);
          bl.anker = hoch / 2;
          liste.push(bl);
          i = j;
        } else {
          liste.push(teilbaum(kk));
          i++;
        }
      }
      return liste;
    };
    const teilbaum = (t) => {
      const x = TECH_SCHRITTE[t.id];
      const ks = ordnen(knoten.filter((kk) => vater(kk) === t.id));
      if (!ks.length) {
        const bl = block();
        bl.karten.push({ id: t.id, x, y: 0, h: M.karte });
        belege(bl, x, 0, M.karte);
        bl.anker = M.karte / 2;
        return bl;
      }
      const bl = stapeln(einheiten(ks));
      const y = bl.anker - M.karte / 2;
      bl.karten.push({ id: t.id, x, y, h: M.karte });
      belege(bl, x, y, M.karte);
      const oberkante = Math.min(...bl.oben.values());
      if (oberkante < 0) schiebe(bl, -oberkante);
      return bl;
    };

    const von = baender.length ? baender[baender.length - 1].bis + M.astLuecke : 0;
    const bl = stapeln(einheiten(ordnen(knoten.filter((kk) => !vater(kk)))));
    schiebe(bl, von - Math.min(...bl.oben.values()));
    for (const k of bl.karten) lage[k.id] = { x: k.x, y: k.y, h: k.h };
    gruppen.push(...bl.koepfe);
    baender.push({ ast: ast.id, von, bis: Math.max(...bl.unten.values()) });
  }
  const hoehe = baender[baender.length - 1].bis;
  const erster = baender[0];
  lage.scheune = { x: 0, y: (erster.von + erster.bis) / 2 - M.karte / 2, h: M.karte };
  const breite = Math.max(...Object.values(lage).map((l) => l.x)) + 1;
  return { lage, gruppen, aeste: baender, hoehe, breite };
}

/* ------------------------------------------------------------ Maschinen */

export const anzahl = (s, id) => s.maschinen[id] || 0;
export const maschineFrei = (s, id) => !!MASCHINE_NACH_ID[id] && werte(s).frei.has(MASCHINE_NACH_ID[id].frei);

export function maschinenKosten(s, id) {
  const m = MASCHINE_NACH_ID[id];
  if (!m) return Infinity;
  const c = Math.round(m.kosten * Math.pow(m.faktor, anzahl(s, id)) * werte(s).maschinenKosten * 1e6) / 1e6;
  return Math.ceil(c);
}

export function plaetzeBelegt(s) {
  return MASCHINEN.reduce((n, m) => n + anzahl(s, m.id) * m.plaetze, 0);
}

export const platzFrei = (s, id) => plaetzeBelegt(s) + MASCHINE_NACH_ID[id].plaetze <= werte(s).plaetze;

export function maschineKaufen(s, id) {
  if (!maschineFrei(s, id)) return { ok: false, grund: 'gesperrt' };
  if (!platzFrei(s, id)) return { ok: false, grund: 'platz' };
  const preis = maschinenKosten(s, id);
  if (s.geld < preis) return { ok: false, grund: 'geld' };
  s.geld -= preis;
  s.maschinen[id] = anzahl(s, id) + 1;
  return { ok: true };
}

/** Baut eine Maschine ab und gibt die Hälfte des letzten Kaufpreises zurück. */
export function maschineAbbauen(s, id) {
  if (anzahl(s, id) <= 0) return { ok: false };
  s.maschinen[id]--;
  const erstattung = Math.floor(maschinenKosten(s, id) / 2);
  s.geld += erstattung;
  return { ok: true, erstattung };
}

export function maschineUmschalten(s, id) {
  if (s.aus[id]) delete s.aus[id];
  else s.aus[id] = true;
}

/**
 * Momentaufnahme der Halle in Raten pro Sekunde. Strom, Brennstoff, Band,
 * Wasser, Scanner und Verarbeiter begrenzen sich gegenseitig. Strom und
 * Brennstoff hängen im Kreis voneinander ab (Generatoren fressen vom Band, das
 * Band braucht Strom); das wird bis zum Gleichgewicht nachgerechnet.
 */
export function fabrik(s) {
  const w = werte(s);
  const f = {
    aktiv: hatBand(w), foerderung: 0, moeglich: 0, band: w.band, fluss: 0, strom: 1,
    erzeugt: GRUNDSTROM, bedarf: 0, deckung: 1, brennstoff: 0, brennBedarf: 0,
    wasser: 0, wasserBedarf: 0, wasserAnteil: 1, roh: 0, produkte: {}, einnahmen: 0,
    auslastung: {}, leistung: {},
  };
  if (!f.aktiv) return f;
  const n = (id) => (s.aus[id] ? 0 : anzahl(s, id));
  const mt = w.maschinenTempo;
  const M = MASCHINE_NACH_ID;

  f.moeglich = (n('rechen') * M.rechen.rate * w.rechenTempo + n('arm') * M.arm.rate * w.armTempo) * mt;
  f.band = w.band * (1 + n('rohrwerfer') * M.rohrwerfer.rate * w.werfer);
  const voll = rest(s) > 0;

  for (const m of MASCHINEN) if (m.strom > 0) f.bedarf += n(m.id) * m.strom * w.verbrauch;
  f.brennBedarf = MASCHINEN.reduce((sum, m) => sum + (m.brennstoff ? n(m.id) * m.brennstoff * w.brennstoff : 0), 0);

  // Erzeugt(p) wächst mit der Leistung p. Von p = 1 aus abwärts iteriert
  // landet man beim größten Gleichgewicht; danach einmal sauber auswerten.
  const erzeugtBei = (p) => {
    const fluss = voll ? Math.min(f.moeglich * p, f.band) : 0;
    const brennAnteil = f.brennBedarf > 0 ? Math.min(1, fluss / f.brennBedarf) : 1;
    let summe = GRUNDSTROM;
    f.leistung = {};
    for (const m of MASCHINEN) {
      if (m.strom >= 0 || !n(m.id)) continue;
      const l = -m.strom * n(m.id) * w.generatorMul * w.stromMul * (m.brennstoff ? brennAnteil : 1);
      f.leistung[m.id] = l;
      summe += l;
    }
    return summe;
  };
  const leistungBei = (p) => (f.bedarf > 0 ? Math.min(1, erzeugtBei(p) / f.bedarf) : 1);
  let strom = 1;
  for (let runde = 0; runde < 200; runde++) {
    const neu = leistungBei(strom);
    if (strom - neu < 1e-10) { strom = Math.min(strom, neu); break; }
    strom = neu;
  }
  f.erzeugt = erzeugtBei(strom);
  f.strom = strom;
  f.foerderung = f.moeglich * strom;
  f.fluss = voll ? Math.min(f.foerderung, f.band) : 0;
  f.brennstoff = Math.min(f.brennBedarf, f.fluss);
  f.auslastung.arm = f.moeglich > 0 ? f.fluss / f.moeglich : 0;
  f.auslastung.rechen = f.auslastung.arm;

  const scan = n('scanner') * M.scanner.rate * w.scanDeckung * mt * strom;
  f.deckung = f.fluss > 0 ? Math.min(1, scan / f.fluss) : (n('scanner') > 0 ? 1 : 0);

  f.wasser = n('brunnen') * -M.brunnen.wasser * w.wasserMul * mt * strom;
  let wasser = f.wasser;

  const lager = { halme: Math.max(0, f.fluss - f.brennstoff), ballen: 0, brei: 0 };
  const verteilung = Math.min(1, w.verteilung);
  for (const id of VERARBEITUNG_REIHE) {
    const zahl = n(id);
    if (!zahl) continue;
    const m = M[id];
    const nenn = zahl * m.rate * w.verarbeitung * mt * faktor(w, id) * strom;
    const max = nenn * verteilung;
    let stueck = max;
    for (const [zutat, menge] of Object.entries(m.rezept)) {
      const bedarf = zutat === 'halme' ? menge * w.ausbeute : menge;
      stueck = Math.min(stueck, lager[zutat] / bedarf);
    }
    if (m.wasser) {
      f.wasserBedarf += Math.max(0, stueck) * m.wasser;
      stueck = Math.min(stueck, wasser / m.wasser);
      wasser -= Math.max(0, stueck) * m.wasser;
    }
    stueck = Math.max(0, stueck);
    for (const [zutat, menge] of Object.entries(m.rezept)) {
      lager[zutat] -= stueck * (zutat === 'halme' ? menge * w.ausbeute : menge);
    }
    if (m.produkt in lager) lager[m.produkt] += stueck;
    else f.produkte[m.produkt] = (f.produkte[m.produkt] || 0) + stueck;
    f.auslastung[id] = nenn > 0 ? stueck / nenn : 0;
  }
  f.wasserAnteil = f.wasserBedarf > 0 ? Math.min(1, f.wasser / f.wasserBedarf) : 1;
  for (const p of ZWISCHEN) if (lager[p] > 1e-9) f.produkte[p] = (f.produkte[p] || 0) + lager[p];
  f.roh = Math.max(0, lager.halme);

  f.einnahmen = f.roh * preisRoh(w);
  for (const [p, rate] of Object.entries(f.produkte)) f.einnahmen += rate * produktPreis(w, p);
  return f;
}

/* ------------------------------------------------------------ Aufträge */

/** Der Auftrag mit Nummer nr; nach der festen Liste wachsen sie weiter. */
export function auftrag(nr, skip = 0) {
  if (nr < AUFTRAEGE.length) return AUFTRAEGE[nr];
  const reihe = ['ballen', 'silage', 'papier', 'brikett', 'pellet', 'brei'];
  const will = reihe[(nr + skip - AUFTRAEGE.length) % reihe.length];
  const wachstum = Math.pow(1.35, nr - AUFTRAEGE.length + 1);
  const menge = Math.round((600 * wachstum * 20) / PRODUKTE[will].halme);
  const titel = KUNDEN[(nr + skip) % KUNDEN.length];
  return { titel, will, menge, lohn: Math.round(menge * PRODUKTE[will].wert * 1.5) };
}

/** Der Lohn zieht mit den Preisen mit, damit ein Auftrag nie weniger bringt als der Stand. */
export const auftragLohn = (s, a) => {
  const w = werte(s);
  return a.lohn * w.auftragLohn * (produktPreis(w, a.will) / PRODUKTE[a.will].wert);
};

/** Den laufenden Auftrag ablehnen; nach der Pause kommt der nächste. Geliefertes ist verloren. */
export function auftragAblehnen(s) {
  if (!werte(s).frei.has('auftraege') || s.auftrag.pause > 0) return false;
  // Ablehnen überspringt die Ware, lässt die Aufträge aber nicht wachsen.
  if (s.auftrag.nr < AUFTRAEGE.length) s.auftrag.nr++;
  else s.auftrag.skip = (s.auftrag.skip || 0) + 1;
  s.auftrag.geliefert = 0;
  s.auftrag.pause = AUFTRAG_PAUSE;
  return true;
}

/* ------------------------------------------------------------ Missionen */

/** Wie weit die offene Mission ist. null, wenn alle erledigt sind. */
export function missionStand(s) {
  const m = MISSIONEN[s.mission];
  if (!m) return null;
  const st = s.stat;
  let ist = 0;
  let ziel = typeof m.ziel === 'number' ? m.ziel : 1;
  switch (m.art) {
    case 'tipps': ist = st.tipps; break;
    case 'verkauft': ist = st.verkauft; break;
    case 'tech': ist = techStufe(s, m.ziel) > 0 ? 1 : 0; break;
    case 'werkzeug': ist = st.werkzeug[m.ziel] ? 1 : 0; break;
    case 'verdient': ist = s.verdient; break;
    case 'gefegt': ist = st.gefegt; break;
    case 'maschine': ist = anzahl(s, m.ziel[0]); ziel = m.ziel[1]; break;
    case 'nadeln': ist = s.nadelnGesamt; break;
    case 'auftraege': ist = st.auftraege; break;
    case 'produziert': ist = st.produziert[m.ziel[0]] || 0; ziel = m.ziel[1]; break;
    case 'abgetragen': ist = st.abgetragen; break;
    case 'haelfte': ist = s.ladung > 1 ? 1 : s.haufen.entfernt / s.haufen.gesamt; break;
    case 'ladungen': ist = s.ladung; break;
    case 'forschung': ist = techGekauft(s); break;
    case 'arten': ist = artenGefunden(s); break;
    default: ist = 0;
  }
  return { m, ist: Math.min(ist, ziel), ziel, erfuellt: ist >= ziel };
}

function missionenPruefen(s, ereignisse) {
  for (let schutz = 0; schutz < 5; schutz++) {
    const ms = missionStand(s);
    if (!ms || !ms.erfuellt) return;
    const { m } = ms;
    let text = '';
    let betrag = 0;
    if (m.geschenk) {
      const mm = MASCHINE_NACH_ID[m.geschenk];
      // Wer die Maschine geschenkt bekommt, darf sie auch nachkaufen.
      const plan = PLAN_FUER[mm.frei];
      if (plan && !techStufe(s, plan) && techOffen(s, plan)) { s.tech[plan] = 1; s.rev++; }
      if (platzFrei(s, m.geschenk)) {
        s.maschinen[m.geschenk] = anzahl(s, m.geschenk) + 1;
        s.rev++;
        text = `${mm.name} geschenkt`;
      } else {
        einnahme(s, mm.kosten);
        betrag = mm.kosten;
        text = `statt ${mm.name}`;
      }
    } else if (m.geschenkTech) {
      const t = TECH_NACH_ID[m.geschenkTech];
      if (techStufe(s, t.id) < t.stufen) {
        s.tech[t.id] = techStufe(s, t.id) + 1;
        s.rev++;
        text = `${t.name} geschenkt`;
      } else {
        const preis = t.kosten;
        einnahme(s, preis);
        betrag = preis;
        text = `statt ${t.name}`;
      }
    } else if (m.geld) {
      einnahme(s, m.geld);
      betrag = m.geld;
    }
    s.mission++;
    // belohnung ist nur der Text zum Geschenk; den Betrag formatiert die Oberfläche.
    ereignisse.push({ typ: 'mission', text: m.text, belohnung: text, geld: betrag });
  }
}

/* ------------------------------------------------------------ Detektor */

export function naechsteNadel(s) {
  const offen = s.nadeln.filter((n) => n.zustand === 'versteckt' && n.tiefe > s.haufen.entfernt);
  if (!offen.length) return null;
  return Math.min(...offen.map((n) => n.tiefe)) - s.haufen.entfernt;
}

/** stufe: 'still' | 'kalt' | 'warm' | 'heiss'; abstand in Halmen oder null. */
export function detektor(s) {
  const w = werte(s);
  const abstand = naechsteNadel(s);
  if (abstand == null) return { abstand: null, staerke: 0, stufe: 'still' };
  const staerke = Math.max(0, Math.min(1, 1 - abstand / w.detektor));
  const stufe = staerke <= 0 ? 'still' : staerke < 0.4 ? 'kalt' : staerke < 0.8 ? 'warm' : 'heiss';
  return { abstand, staerke, stufe };
}

/* ------------------------------------------------------------ Neue Ladung */

export const ladungMoeglich = (s) => alleNadeln(s);
export const kreditAufschlag = (s) => (werte(s).frei.has('kredit') ? KREDIT_AUFSCHLAG_GUT : KREDIT_AUFSCHLAG);

/**
 * Bestellt die nächste Ladung. aufRechnung: fehlendes Geld wird mit Aufschlag
 * zu Schulden. Forschung und Maschinen bleiben; der Rest der alten Ladung wird
 * mit abgeholt.
 */
export function ladungBestellen(s, { aufRechnung = false } = {}) {
  if (!ladungMoeglich(s)) return { ok: false, grund: 'nadeln' };
  const preis = ladungPreis(s);
  if (s.geld >= preis) s.geld -= preis;
  else if (aufRechnung) {
    s.schulden += (preis - s.geld) * kreditAufschlag(s);
    s.geld = 0;
  } else return { ok: false, grund: 'geld' };
  if (s.stat.ersteLadung == null) s.stat.ersteLadung = s.aktiv;
  s.ladung++;
  s.haufen = { gesamt: ladungGroesse(s.ladung), entfernt: 0 };
  s.nadeln = nadelnVerstecken(s, s.ladung, s.haufen.gesamt);
  s.boden = 0;
  s.radar = { rest: 0, abstand: null, zeit: null };
  s.rev++;
  return { ok: true };
}

/* ------------------------------------------------------------ Zeit */

/**
 * Lässt dt Sekunden vergehen. offline: nur was auch ohne dich läuft (Drohnen,
 * Halle, Aufträge, Radar), mit dem Wirkungsgrad aus der Forschung.
 */
export function tick(s, dt, { offline = false } = {}) {
  const ereignisse = [];
  if (!(dt > 0) || !Number.isFinite(dt)) return ereignisse;
  s.zeit += dt;
  if (!offline) s.aktiv += dt;
  let w = werte(s);

  if (s.laufen > 0) {
    s.laufen -= dt;
    if (s.laufen <= 0) { s.laufen = 0; ankommen(s, ereignisse); }
  }
  s.ausdauer = Math.min(w.ausdauer, s.ausdauer + w.ausdauerRegen * dt);

  if (!offline) {
    // Hofsauger
    const sg = s.sauger;
    const frei = platzFuerHand(s, w);
    if (sg.an && !sg.heiss && s.laufen <= 0 && w.frei.has('sauger') && frei > 0 && rest(s) > 0) {
      const weg = abtragen(s, Math.min(frei, w.saugerRate * dt), 'hand', ereignisse);
      ablegen(s, w, weg);
      sg.hitze += dt / w.saugerHitze;
      if (sg.hitze >= 1) {
        sg.hitze = 1; sg.heiss = true; sg.an = false;
        ereignisse.push({ typ: 'ueberhitzt' });
      }
    } else {
      sg.hitze = Math.max(0, sg.hitze - dt / (w.saugerHitze * 0.6));
      if (sg.heiss && sg.hitze <= 0) sg.heiss = false;
    }

    // Muskelgedächtnis
    if (w.autotipp > 0 && rest(s) > 0) {
      s.autoRest += w.autotipp * dt;
      let runden = Math.min(Math.floor(s.autoRest), 100);
      s.autoRest -= Math.floor(s.autoRest);
      while (runden-- > 0 && s.laufen <= 0) {
        const r = stich(s, ereignisse, { auto: true });
        if (r && r.voll) { verkaufen(s); break; }
      }
    }
  }

  const wirkung = offline ? Math.min(1, w.offlineEff) : 1;

  // Drohnen: sehen jede Nadel und fliegen direkt zum Stand.
  if (s.drohnen > 0 && rest(s) > 0) {
    const weg = abtragen(s, s.drohnen * w.drohnenRate * dt * wirkung, 'drohne', ereignisse);
    einnahme(s, weg * preisRoh(w));
  }

  // Halle
  w = werte(s);
  if (hatBand(w)) {
    const f = fabrik(s);
    const soll = f.fluss * dt * wirkung;
    let anteil = 0;
    if (soll > 0) {
      const weg = abtragen(s, soll, 'maschine', ereignisse, f.deckung);
      anteil = (weg / soll) * dt * wirkung;
    }
    if (w.frei.has('auftraege') && s.auftrag.pause > 0) s.auftrag.pause = Math.max(0, s.auftrag.pause - dt);
    if (anteil > 0) {
      let betrag = f.einnahmen * anteil;
      for (const [p, r] of Object.entries(f.produkte)) {
        s.stat.produziert[p] = (s.stat.produziert[p] || 0) + r * anteil;
      }
      // Laster: nimmt die gewünschte Ware, bevor sie am Stand verkauft wird.
      if (w.frei.has('auftraege') && s.auftrag.pause <= 0) {
        const a = s.auftrag;
        const au = auftrag(a.nr, a.skip);
        const verfuegbar = (au.will === 'roh' ? f.roh : (f.produkte[au.will] || 0)) * anteil;
        const nimmt = Math.min(verfuegbar, au.menge - a.geliefert);
        if (nimmt > 0) {
          a.geliefert += nimmt;
          betrag -= nimmt * produktPreis(w, au.will);
        }
        if (a.geliefert >= au.menge - 1e-9) {
          const lohn = auftragLohn(s, au);
          einnahme(s, lohn);
          s.stat.auftraege++;
          ereignisse.push({ typ: 'auftrag', auftrag: au, lohn });
          a.nr++;
          a.geliefert = 0;
          a.pause = AUFTRAG_PAUSE;
        }
      }
      einnahme(s, Math.max(0, betrag));
    }

    // Nadelradar
    const radare = s.aus.radar ? 0 : anzahl(s, 'radar');
    if (radare > 0 && f.strom > 0) {
      s.radar.rest -= dt * radare * f.strom;
      if (s.radar.rest <= 0) {
        s.radar.rest = w.radarCD;
        s.radar.abstand = naechsteNadel(s);
        s.radar.zeit = s.zeit;
        ereignisse.push({ typ: 'radar', abstand: s.radar.abstand });
      }
    }
  }

  missionenPruefen(s, ereignisse);
  return ereignisse;
}

/**
 * Holt nach, was während der Abwesenheit passiert ist. Liefert eine
 * Zusammenfassung oder null, wenn es sich nicht lohnt, davon zu erzählen.
 */
export function offlineNachholen(s, jetzt = Date.now()) {
  const w = werte(s);
  const zuletzt = Number.isFinite(s.zuletzt) ? s.zuletzt : jetzt;
  const weg = Math.max(0, (jetzt - zuletzt) / 1000);
  s.zuletzt = jetzt;
  const e0 = [];
  if (s.laufen > 0 && weg > 0) {
    s.laufen -= weg;
    if (s.laufen <= 0) { s.laufen = 0; ankommen(s, e0); }
  }
  s.ausdauer = Math.min(w.ausdauer, s.ausdauer + w.ausdauerRegen * weg);
  s.sauger.an = false;
  s.sauger.hitze = 0;
  s.sauger.heiss = false;
  const sek = Math.min(weg, w.offlineStunden * 3600);
  if (sek <= 0 || (s.drohnen === 0 && !hatBand(w))) return null;
  const geldVor = s.geld;
  const verdientVor = s.verdient;
  const halmeVor = s.stat.abgetragen;
  const nadelnVor = s.nadelnGesamt;
  const auftraegeVor = s.stat.auftraege;
  const schritte = Math.min(600, Math.ceil(sek));
  const dt = sek / schritte;
  const ereignisse = [...e0];
  for (let i = 0; i < schritte; i++) ereignisse.push(...tick(s, dt, { offline: true }));
  // Auch kurze Abwesenheiten zählen; erzählt wird erst ab einer halben Minute.
  if (sek < 30) return null;
  return {
    sekunden: sek,
    abwesend: weg,
    geld: s.geld - geldVor,
    verdient: s.verdient - verdientVor,
    halme: s.stat.abgetragen - halmeVor,
    nadeln: s.nadelnGesamt - nadelnVor,
    auftraege: s.stat.auftraege - auftraegeVor,
    drohnenAllein: !hatBand(w),
    ereignisse,
  };
}

/* ------------------------------------------------------------ Speichern */

export function speichern(s, jetzt = Date.now()) {
  s.zuletzt = jetzt;
  return JSON.stringify(s);
}

const istObjekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const zahlOder = (x, ersatz) => (typeof x === 'number' && Number.isFinite(x) ? x : ersatz);

/**
 * Liest einen gespeicherten Stand. Kaputte oder fremde Stände werden
 * abgelehnt, Kleinigkeiten repariert: unbekannte ids fliegen raus, Zahlen
 * werden Zahlen, der Sauger ist nach dem Laden aus.
 */
export function laden(text) {
  let roh;
  try { roh = JSON.parse(text); } catch { return null; }
  if (!istObjekt(roh) || roh.version !== STAND_VERSION) return null;
  if (!istObjekt(roh.haufen) || !Number.isFinite(roh.haufen.gesamt) || !Number.isFinite(roh.haufen.entfernt)
    || roh.haufen.gesamt <= 0) return null;
  if (!Array.isArray(roh.nadeln) || roh.nadeln.length !== NADELN_JE_LADUNG) return null;
  for (const n of roh.nadeln) {
    if (!istObjekt(n) || !Number.isFinite(n.tiefe) || !['versteckt', 'gefunden'].includes(n.zustand)
      || !Number.isInteger(n.art) || !NADELN[n.art]) return null;
  }
  const s = neuerStand(zahlOder(roh.rng, 1));
  for (const [key, wert] of Object.entries(roh)) {
    if (!(key in s)) continue;
    if (istObjekt(s[key])) {
      if (istObjekt(wert)) s[key] = { ...s[key], ...wert };
    } else if (Array.isArray(s[key])) {
      if (Array.isArray(wert)) s[key] = wert;
    } else if (typeof s[key] === 'number') {
      s[key] = zahlOder(wert, s[key]);
    } else if (typeof wert === typeof s[key]) {
      s[key] = wert;
    }
  }
  s.tech = Object.fromEntries(Object.entries(s.tech).filter(([id, n]) => TECH_NACH_ID[id] && Number.isFinite(n) && n > 0));
  s.tech.scheune = 1;
  s.maschinen = Object.fromEntries(Object.entries(s.maschinen)
    .filter(([id, n]) => MASCHINE_NACH_ID[id] && Number.isFinite(n) && n >= 0));
  s.aus = Object.fromEntries(Object.entries(s.aus).filter(([id]) => MASCHINE_NACH_ID[id]));
  s.arten = Object.fromEntries(Object.entries(s.arten).filter(([a, n]) => NADELN[a] && Number.isFinite(n)));
  if (!WERKZEUG_NACH_ID[s.werkzeug]) s.werkzeug = 'spaten';
  if (!istObjekt(s.stat.produziert)) s.stat.produziert = {};
  if (!istObjekt(s.stat.werkzeug)) s.stat.werkzeug = {};
  for (const k of ['tipps', 'hand', 'drohne', 'maschine', 'gaenge', 'verkauft', 'gefegt', 'abgetragen',
    'auftraege', 'besterVerkauf', 'maxGeld']) s.stat[k] = zahlOder(s.stat[k], 0);
  for (const k of ['nr', 'skip', 'geliefert', 'pause']) s.auftrag[k] = Math.max(0, zahlOder(s.auftrag[k], 0));
  s.auftrag.nr = Math.floor(s.auftrag.nr);
  s.mission = Math.max(0, Math.floor(s.mission));
  s.ladung = Math.max(1, Math.floor(s.ladung));
  s.stat.produziert = Object.fromEntries(Object.entries(s.stat.produziert).filter(([p, n]) => PRODUKTE[p] && Number.isFinite(n)));
  s.haufen.entfernt = Math.max(0, Math.min(s.haufen.entfernt, s.haufen.gesamt));
  for (const n of s.nadeln) {
    if (n.zustand === 'versteckt' && (n.tiefe <= s.haufen.entfernt || n.tiefe > s.haufen.gesamt)) {
      n.tiefe = Math.min(s.haufen.gesamt, Math.floor(s.haufen.entfernt) + 1);
    }
  }
  s.radar = { rest: zahlOder(s.radar.rest, 0), abstand: zahlOder(s.radar.abstand, null), zeit: zahlOder(s.radar.zeit, null) };
  s.sauger = { an: false, hitze: zahlOder(s.sauger.hitze, 0), heiss: !!s.sauger.heiss };
  s.rev = 0;
  return s;
}
