// Spiellogik ohne DOM: ein Stand-Objekt, das sich als JSON speichern lässt,
// und reine Funktionen darauf. Zufall kommt aus einem eigenen Generator im
// Stand, damit Tests und Simulation reproduzierbar bleiben.

import {
  GRUND, HAUFEN_GROESSE, NADEL_BEREICHE, NADELN, TECH, MASCHINEN, VERARBEITUNG_REIHE,
  PRODUKTE, SELTENHEIT, FUNDE, SAMMELBONUS, AUSSCHUSS_TIPPS, NEUER_HAUFEN_FAKTOR,
} from './daten.js';

export const STAND_VERSION = 1;
export const TECH_NACH_ID = Object.fromEntries(TECH.map((t) => [t.id, t]));
export const MASCHINE_NACH_ID = Object.fromEntries(MASCHINEN.map((m) => [m.id, m]));
export const FUND_NACH_ID = Object.fromEntries(FUNDE.map((f) => [f.id, f]));
export const TECH_STUFEN_GESAMT = TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : t.stufen), 0);

/** Strom, den die Halle auch ohne Generator hat (eine Handkurbel in der Ecke). */
export const GRUNDSTROM = 5;
/** Grundpreis der ersten Drohne und Faktor je weiterer. */
const DROHNE_KOSTEN = 250;
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

function nadelnVerstecken(s, gesamt) {
  return NADEL_BEREICHE.map(([von, bis]) => ({
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
    geld: 0,
    verdient: 0,
    haufen: { gesamt: HAUFEN_GROESSE, entfernt: 0 },
    tasche: 0,
    laufen: 0,
    autoRest: 0,
    tech: { scheune: 1 },
    maschinen: {},
    aus: {},
    drohnen: 0,
    nadeln: [],
    ausschuss: 0,
    funde: {},
    sauger: { an: false, hitze: 0, heiss: false },
    stat: { tipps: 0, hand: 0, drohne: 0, maschine: 0, funde: 0, gaenge: 0 },
    lauf: 1,
    erledigt: 0,
    gezeigt: [],
    zuletzt: Date.now(),
  };
  s.nadeln = nadelnVerstecken(s, s.haufen.gesamt);
  return s;
}

export const rest = (s) => Math.max(0, s.haufen.gesamt - s.haufen.entfernt);
export const nadelnGefunden = (s) => s.nadeln.filter((n) => n.zustand === 'gefunden').length;
export const alleNadeln = (s) => s.nadeln.every((n) => n.zustand === 'gefunden');
export const imAusschuss = (s) => s.nadeln.filter((n) => n.zustand === 'ausschuss').length;
export const fundArten = (s) => Object.values(s.funde).filter((f) => f.ges > 0).length;

/* ------------------------------------------------------------ Werte */

const cache = new WeakMap();

/** Alle abgeleiteten Zahlen: Grundwerte, darauf Techtree, Nadeln, Neustarts und Sammelbonus. */
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
    if (n > 0) anwenden(t.effekt, n);
  }
  s.nadeln.forEach((nd, i) => { if (nd.zustand === 'gefunden') anwenden(NADELN[i].effekt, 1); });
  if (s.erledigt > 0) {
    anwenden([['preisAlle', '*', 1 + 0.5 * s.erledigt], ['griff', '*', 1 + 0.25 * s.erledigt]], 1);
  }
  const arten = fundArten(s);
  if (arten > 0) anwenden([['preisAlle', '*', 1 + SAMMELBONUS * arten]], 1);

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

export const griffMenge = (w) => w.griff * w.werkzeug;
export const taschePlatz = (w) => Math.floor(w.tasche);
export const preisRoh = (w) => w.preisRoh * w.preisAlle;

export function produktPreis(w, p) {
  if (p === 'roh') return preisRoh(w);
  return PRODUKTE[p].wert * (w.preisRoh / GRUND.preisRoh) * w.preisAlle * w.preisProdukt * faktor(w, 'preis_' + p);
}

export function fundPreis(w, id) {
  return FUND_NACH_ID[id].wert * w.fundWert * Math.sqrt(w.preisRoh / GRUND.preisRoh) * w.preisAlle;
}

/* ------------------------------------------------------------ Haufen abtragen */

function fundZiehen(s) {
  const summe = SELTENHEIT.reduce((n, r) => n + r.gewicht, 0);
  let x = zufall(s) * summe;
  let stufe = SELTENHEIT[SELTENHEIT.length - 1].id;
  for (const r of SELTENHEIT) {
    if (x < r.gewicht) { stufe = r.id; break; }
    x -= r.gewicht;
  }
  const kandidaten = FUNDE.filter((f) => f.stufe === stufe);
  return kandidaten[Math.floor(zufall(s) * kandidaten.length)];
}

function nadelFinden(s, i, ereignisse) {
  const nd = s.nadeln[i];
  nd.zustand = 'gefunden';
  nd.zeit = s.zeit;
  s.rev++;
  ereignisse.push({ typ: 'nadel', i });
}

/**
 * Nimmt Halme vom Haufen. quelle: 'hand' und 'drohne' sehen jede Nadel;
 * 'maschine' nur mit der Wahrscheinlichkeit der Scannerabdeckung, sonst fällt
 * sie in den Ausschuss. Fundstücke landen bei Maschinen nur im Anteil, den
 * die Sortierer schaffen, in der Kiste.
 */
export function abtragen(s, menge, quelle, ereignisse = [], deckung = 1, sortiert = 1) {
  const vorher = s.haufen.entfernt;
  menge = Math.min(menge, rest(s));
  if (!(menge > 0)) return 0;
  const nachher = vorher + menge;
  s.haufen.entfernt = nachher;
  s.stat[quelle] = (s.stat[quelle] || 0) + menge;

  s.nadeln.forEach((nd, i) => {
    if (nd.zustand !== 'versteckt' || nd.tiefe <= vorher || nd.tiefe > nachher) return;
    if (quelle !== 'maschine' || zufall(s) < deckung) nadelFinden(s, i, ereignisse);
    else {
      nd.zustand = 'ausschuss';
      ereignisse.push({ typ: 'ausschuss', i });
    }
  });

  const w = werte(s);
  const erwartet = menge * w.fundChance * (quelle === 'maschine' ? sortiert : 1);
  let anzahl = Math.floor(erwartet) + (zufall(s) < erwartet % 1 ? 1 : 0);
  anzahl = Math.min(anzahl, 200);
  for (let n = 0; n < anzahl; n++) {
    const f = fundZiehen(s);
    const e = s.funde[f.id] || (s.funde[f.id] = { n: 0, ges: 0 });
    e.n++;
    e.ges++;
    s.stat.funde++;
    if (e.ges === 1) s.rev++;
    ereignisse.push({ typ: 'fund', id: f.id, neu: e.ges === 1 });
  }
  return menge;
}

/* ------------------------------------------------------------ Hände und Werkzeug */

/** Ein Griff in den Haufen. Liefert null, wenn gerade niemand da ist. */
export function tippen(s, ereignisse = []) {
  if (s.laufen > 0) return null;
  const w = werte(s);
  const frei = taschePlatz(w) - s.tasche;
  if (frei <= 0) return { menge: 0, voll: true, ereignisse };
  let menge = griffMenge(w);
  const krit = w.krit > 0 && zufall(s) < w.krit;
  if (krit) menge *= w.kritFaktor;
  menge = abtragen(s, Math.min(menge, frei), 'hand', ereignisse);
  s.tasche += menge;
  s.stat.tipps++;
  return { menge, krit, voll: s.tasche >= taschePlatz(w), ereignisse };
}

export function saugen(s, an) {
  const w = werte(s);
  s.sauger.an = !!an && w.frei.has('sauger') && !s.sauger.heiss;
}

/** Los zum Ankauf. Bezahlt wird bei der Ankunft (siehe tick). */
export function verkaufen(s) {
  if (s.laufen > 0 || s.tasche <= 0) return false;
  s.laufen = Math.max(0.05, werte(s).laufzeit);
  s.sauger.an = false;
  return true;
}

function ankommen(s, ereignisse) {
  const w = werte(s);
  const betrag = s.tasche * preisRoh(w);
  s.geld += betrag;
  s.verdient += betrag;
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

/* ------------------------------------------------------------ Techtree */

export const techStufe = (s, id) => s.tech[id] || 0;

export function techKosten(s, id) {
  const t = TECH_NACH_ID[id];
  const c = t.kosten * Math.pow(t.faktor, techStufe(s, id));
  return c < 100 ? Math.ceil(c * 10) / 10 : Math.ceil(c);
}

export const techOffen = (s, id) => TECH_NACH_ID[id].braucht.every((b) => techStufe(s, b) > 0);

/** 'max' | 'kaufbar' | 'teuer' | 'gesperrt' */
export function techStatus(s, id) {
  const t = TECH_NACH_ID[id];
  if (techStufe(s, id) >= t.stufen) return 'max';
  if (!techOffen(s, id)) return 'gesperrt';
  return s.geld >= techKosten(s, id) ? 'kaufbar' : 'teuer';
}

export function techKaufen(s, id) {
  const status = techStatus(s, id);
  if (status !== 'kaufbar') return { ok: false, grund: status };
  s.geld -= techKosten(s, id);
  s.tech[id] = techStufe(s, id) + 1;
  s.rev++;
  return { ok: true };
}

export const techGekauft = (s) => TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : techStufe(s, t.id)), 0);

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

/**
 * Lage der Karten im Forschungsbaum: die Spalte ist die Zahl der Schritte vom
 * Start, die Zeile kommt aus einem ordentlich gelegten Baum je Ast (Blätter
 * untereinander, Eltern mittig neben ihren Kindern). Voraussetzungen aus
 * anderen Ästen zählen für die Spalte, nicht für die Zeile.
 */
export function techLage(aeste) {
  const lage = {};
  const baender = [];
  let zeile = 0;
  for (const ast of aeste) {
    const knoten = TECH.filter((t) => t.ast === ast.id);
    const imAst = new Set(knoten.map((t) => t.id));
    const vater = (t) => t.braucht.find((b) => imAst.has(b)) || null;
    const von = zeile;
    const setzen = (t) => {
      const ks = knoten.filter((kk) => vater(kk) === t.id);
      let y;
      if (!ks.length) y = zeile++;
      else {
        const ys = ks.map(setzen);
        y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      lage[t.id] = { x: TECH_SCHRITTE[t.id], y };
      return y;
    };
    for (const t of knoten.filter((kk) => !vater(kk))) setzen(t);
    baender.push({ ast: ast.id, von, bis: zeile - 1 });
    zeile += 0.5;
  }
  const hoehe = zeile - 0.5;
  // Start steht neben dem ersten Ast, dort, wo das Spiel beginnt.
  const erster = baender[0];
  lage.scheune = { x: 0, y: (erster.von + erster.bis) / 2 };
  const breite = Math.max(...Object.values(lage).map((l) => l.x)) + 1;
  return { lage, aeste: baender, hoehe, breite };
}

/* ------------------------------------------------------------ Maschinen */

export const anzahl = (s, id) => s.maschinen[id] || 0;
export const maschineFrei = (s, id) => werte(s).frei.has(MASCHINE_NACH_ID[id].frei);

export function maschinenKosten(s, id) {
  const m = MASCHINE_NACH_ID[id];
  return Math.ceil(m.kosten * Math.pow(m.faktor, anzahl(s, id)) * werte(s).maschinenKosten);
}

export function plaetzeBelegt(s) {
  return MASCHINEN.reduce((n, m) => n + anzahl(s, m.id) * m.plaetze, 0);
}

export function maschineKaufen(s, id) {
  const m = MASCHINE_NACH_ID[id];
  if (!maschineFrei(s, id)) return { ok: false, grund: 'gesperrt' };
  if (plaetzeBelegt(s) + m.plaetze > werte(s).plaetze) return { ok: false, grund: 'platz' };
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
 * Momentaufnahme der Halle in Raten pro Sekunde. Strom, Band, Scanner und
 * Verarbeiter begrenzen sich gegenseitig; wer zuerst in VERARBEITUNG_REIHE
 * steht, bekommt zuerst vom Band.
 */
export function fabrik(s) {
  const w = werte(s);
  const f = {
    aktiv: w.frei.has('halle'), foerderung: 0, band: w.band, fluss: 0, strom: 1,
    erzeugt: 0, bedarf: 0, deckung: 1, sortiert: 0, brennstoff: 0, roh: 0,
    produkte: {}, einnahmen: 0, auslastung: {},
  };
  if (!f.aktiv) return f;
  const n = (id) => (s.aus[id] ? 0 : anzahl(s, id));
  const mt = w.maschinenTempo;

  const moeglich = (n('arm') * MASCHINE_NACH_ID.arm.rate * w.armTempo
    + n('bagger') * MASCHINE_NACH_ID.bagger.rate * w.baggerTempo) * mt;
  const brennBedarf = MASCHINEN.reduce((sum, m) => sum + (m.brennstoff ? n(m.id) * m.brennstoff : 0), 0);
  const vorFluss = rest(s) > 0 ? Math.min(moeglich, w.band) : 0;
  const brennAnteil = brennBedarf > 0 ? Math.min(1, vorFluss / brennBedarf) : 1;

  for (const m of MASCHINEN) {
    const zahl = n(m.id);
    if (!zahl) continue;
    if (m.strom > 0) f.bedarf += zahl * m.strom * w.verbrauch;
    else {
      let leistung = -m.strom * zahl;
      if (m.brennstoff) leistung *= brennAnteil * (m.id === 'kessel' ? w.kesselMul : 1);
      f.erzeugt += leistung * w.stromMul;
    }
  }
  f.erzeugt += GRUNDSTROM;
  f.strom = f.bedarf > 0 ? Math.min(1, f.erzeugt / f.bedarf) : 1;

  f.foerderung = moeglich * f.strom;
  f.fluss = rest(s) > 0 ? Math.min(f.foerderung, w.band) : 0;
  f.brennstoff = Math.min(brennBedarf, f.fluss);
  f.auslastung.arm = moeglich > 0 ? f.fluss / moeglich : 0;

  const scan = n('scanner') * MASCHINE_NACH_ID.scanner.rate * w.scanDeckung * mt * f.strom;
  f.deckung = f.fluss > 0 ? Math.min(1, scan / f.fluss) : (n('scanner') > 0 ? 1 : 0);
  const sort = n('sortierer') * MASCHINE_NACH_ID.sortierer.rate * w.sortDeckung * mt * f.strom;
  f.sortiert = f.fluss > 0 ? Math.min(1, sort / f.fluss) : 0;

  const lager = { halme: f.fluss - f.brennstoff, ballen: 0, brei: 0 };
  for (const id of VERARBEITUNG_REIHE) {
    const zahl = n(id);
    if (!zahl) continue;
    const m = MASCHINE_NACH_ID[id];
    const max = zahl * m.rate * w.verarbeitung * mt * faktor(w, id) * f.strom;
    let stueck = max;
    for (const [zutat, menge] of Object.entries(m.rezept)) {
      const bedarf = zutat === 'halme' ? menge * w.ausbeute : menge;
      stueck = Math.min(stueck, lager[zutat] / bedarf);
    }
    stueck = Math.max(0, stueck);
    for (const [zutat, menge] of Object.entries(m.rezept)) {
      lager[zutat] -= stueck * (zutat === 'halme' ? menge * w.ausbeute : menge);
    }
    if (m.produkt in lager) lager[m.produkt] += stueck;
    else f.produkte[m.produkt] = (f.produkte[m.produkt] || 0) + stueck;
    f.auslastung[id] = max > 0 ? stueck / max : 0;
  }
  for (const p of ['ballen', 'brei']) if (lager[p] > 1e-9) f.produkte[p] = (f.produkte[p] || 0) + lager[p];
  f.roh = Math.max(0, lager.halme);

  f.einnahmen = f.roh * preisRoh(w);
  for (const [p, rate] of Object.entries(f.produkte)) f.einnahmen += rate * produktPreis(w, p);
  return f;
}

/* ------------------------------------------------------------ Ausschuss und Funde */

/** Ein Griff in den Ausschuss. Nach AUSSCHUSS_TIPPS Griffen ist die Nadel da. */
export function ausschussTippen(s, ereignisse = []) {
  if (!imAusschuss(s)) return null;
  s.ausschuss += 1 / AUSSCHUSS_TIPPS;
  if (s.ausschuss >= 1 - 1e-9) {
    s.ausschuss = 0;
    nadelFinden(s, s.nadeln.findIndex((n) => n.zustand === 'ausschuss'), ereignisse);
  }
  return { fortschritt: s.ausschuss, ereignisse };
}

export function fundeVerkaufen(s) {
  const w = werte(s);
  let betrag = 0;
  for (const [id, e] of Object.entries(s.funde)) {
    betrag += e.n * fundPreis(w, id);
    e.n = 0;
  }
  s.geld += betrag;
  s.verdient += betrag;
  return betrag;
}

export function fundWert(s) {
  const w = werte(s);
  return Object.entries(s.funde).reduce((sum, [id, e]) => sum + e.n * fundPreis(w, id), 0);
}

/* ------------------------------------------------------------ Detektor */

/** stufe: 'still' | 'kalt' | 'warm' | 'heiss'; abstand in Halmen oder null. */
export function detektor(s) {
  const w = werte(s);
  const offen = s.nadeln.filter((n) => n.zustand === 'versteckt' && n.tiefe > s.haufen.entfernt);
  if (!offen.length) return { abstand: null, staerke: 0, stufe: 'still' };
  const abstand = Math.min(...offen.map((n) => n.tiefe)) - s.haufen.entfernt;
  const staerke = Math.max(0, Math.min(1, 1 - abstand / w.detektor));
  const stufe = staerke <= 0 ? 'still' : staerke < 0.4 ? 'kalt' : staerke < 0.8 ? 'warm' : 'heiss';
  return { abstand, staerke, stufe };
}

/* ------------------------------------------------------------ Zeit */

/**
 * Lässt dt Sekunden vergehen. offline: nur was auch ohne dich läuft (Drohnen,
 * Halle), und das mit dem Wirkungsgrad aus dem Techtree.
 */
export function tick(s, dt, { offline = false } = {}) {
  const ereignisse = [];
  if (!(dt > 0)) return ereignisse;
  s.zeit += dt;
  let w = werte(s);

  if (s.laufen > 0) {
    s.laufen -= dt;
    if (s.laufen <= 0) { s.laufen = 0; ankommen(s, ereignisse); }
  }

  if (!offline) {
    // Sauger
    const sg = s.sauger;
    if (sg.an && !sg.heiss && s.laufen <= 0 && w.frei.has('sauger')) {
      const frei = taschePlatz(w) - s.tasche;
      if (frei > 0) {
        const weg = abtragen(s, Math.min(frei, w.saugerRate * dt), 'hand', ereignisse);
        s.tasche += weg;
        sg.hitze += dt / w.saugerHitze;
        if (sg.hitze >= 1) {
          sg.hitze = 1; sg.heiss = true; sg.an = false;
          ereignisse.push({ typ: 'ueberhitzt' });
        }
      }
    } else {
      sg.hitze = Math.max(0, sg.hitze - dt / (w.saugerHitze * 0.6));
      if (sg.heiss && sg.hitze <= 0) sg.heiss = false;
    }

    // Muskelgedächtnis
    if (w.autotipp > 0) {
      s.autoRest += w.autotipp * dt;
      let runden = Math.min(Math.floor(s.autoRest), 100);
      s.autoRest -= Math.floor(s.autoRest);
      while (runden-- > 0 && s.laufen <= 0) {
        const r = tippen(s, ereignisse);
        if (r && r.voll) verkaufen(s);
      }
    }
  }

  const wirkung = offline ? Math.min(1, w.offlineEff) : 1;

  // Drohnen: sehen jede Nadel und fliegen direkt zum Ankauf.
  if (s.drohnen > 0 && rest(s) > 0) {
    const weg = abtragen(s, s.drohnen * w.drohnenRate * dt * wirkung, 'drohne', ereignisse);
    const betrag = weg * preisRoh(w);
    s.geld += betrag;
    s.verdient += betrag;
  }

  // Halle
  w = werte(s);
  if (w.frei.has('halle')) {
    const f = fabrik(s);
    const soll = f.fluss * dt * wirkung;
    if (soll > 0) {
      const weg = abtragen(s, soll, 'maschine', ereignisse, f.deckung, f.sortiert);
      const betrag = f.einnahmen * dt * wirkung * (weg / soll);
      s.geld += betrag;
      s.verdient += betrag;
    }
    // Nadelsichter im Ausschuss
    const sichter = s.aus.sichter ? 0 : anzahl(s, 'sichter');
    if (sichter > 0 && imAusschuss(s)) {
      s.ausschuss += dt * sichter * MASCHINE_NACH_ID.sichter.rate * f.strom * wirkung;
      while (s.ausschuss >= 1 && imAusschuss(s)) {
        s.ausschuss -= 1;
        nadelFinden(s, s.nadeln.findIndex((n) => n.zustand === 'ausschuss'), ereignisse);
      }
      if (!imAusschuss(s)) s.ausschuss = 0;
    }
  }
  return ereignisse;
}

/**
 * Holt nach, was während der Abwesenheit passiert ist. Liefert eine
 * Zusammenfassung oder null, wenn es sich nicht lohnt, davon zu erzählen.
 */
export function offlineNachholen(s, jetzt = Date.now()) {
  const w = werte(s);
  const weg = Math.max(0, (jetzt - (s.zuletzt ?? jetzt)) / 1000);
  s.zuletzt = jetzt;
  if (s.laufen > 0 && weg > 0) {
    const e = [];
    s.laufen = 0;
    ankommen(s, e);
  }
  const sek = Math.min(weg, w.offlineStunden * 3600);
  if (sek < 30 || (s.drohnen === 0 && !w.frei.has('halle'))) return null;
  const geldVor = s.geld;
  const halmeVor = s.haufen.entfernt;
  const nadelnVor = nadelnGefunden(s);
  const ausschussVor = imAusschuss(s);
  const schritte = Math.min(600, Math.ceil(sek));
  const dt = sek / schritte;
  const ereignisse = [];
  for (let i = 0; i < schritte; i++) ereignisse.push(...tick(s, dt, { offline: true }));
  return {
    sekunden: sek,
    abwesend: weg,
    geld: s.geld - geldVor,
    halme: s.haufen.entfernt - halmeVor,
    nadeln: nadelnGefunden(s) - nadelnVor,
    ausschuss: Math.max(0, imAusschuss(s) - ausschussVor),
    funde: ereignisse.filter((e) => e.typ === 'fund').length,
    ereignisse,
  };
}

/* ------------------------------------------------------------ Neuer Haufen */

/** Nach der sechsten Nadel: alles auf Anfang, aber mit Bonus, Album und größerem Haufen. */
export function neuerHaufen(s) {
  if (!alleNadeln(s)) return null;
  const neu = neuerStand(s.rng);
  neu.rng = s.rng;
  neu.erledigt = s.erledigt + 1;
  neu.lauf = s.lauf + 1;
  neu.haufen.gesamt = Math.round(s.haufen.gesamt * NEUER_HAUFEN_FAKTOR);
  neu.nadeln = nadelnVerstecken(neu, neu.haufen.gesamt);
  for (const [id, e] of Object.entries(s.funde)) neu.funde[id] = { n: 0, ges: e.ges };
  neu.stat = { ...s.stat };
  neu.zeitGesamt = (s.zeitGesamt || 0) + s.zeit;
  return neu;
}

/* ------------------------------------------------------------ Speichern */

export function speichern(s, jetzt = Date.now()) {
  s.zuletzt = jetzt;
  return JSON.stringify(s);
}

/** Liest einen gespeicherten Stand; fehlende Felder kommen aus einem frischen Stand. */
export function laden(text) {
  let roh;
  try { roh = JSON.parse(text); } catch { return null; }
  if (!roh || typeof roh !== 'object' || roh.version !== STAND_VERSION) return null;
  if (!Array.isArray(roh.nadeln) || roh.nadeln.length !== NADELN.length) return null;
  const s = neuerStand(roh.rng || 1);
  for (const [key, wert] of Object.entries(roh)) {
    if (wert && typeof wert === 'object' && !Array.isArray(wert) && s[key] && typeof s[key] === 'object'
      && !Array.isArray(s[key])) s[key] = { ...s[key], ...wert };
    else s[key] = wert;
  }
  s.rev = 0;
  return s;
}
