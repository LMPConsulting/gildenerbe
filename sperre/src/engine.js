// Sperrsteine — Spiellogik ohne DOM. Alles serialisierbar.
//
// Nach dem Vorbild von Malefiz/Barricade (Ravensburger, 1960): fünf Figuren je
// Seite laufen über ein Wegenetz nach oben zum Ziel, elf weiße Steine stehen im
// Weg. Wer genau auf einem landet, nimmt ihn und setzt ihn irgendwo anders neu
// hin — am liebsten der Gegenseite vor die Nase. Die erste Figur im Ziel
// gewinnt. Regeln sind frei; Name und Brett sind hier eigene (siehe brett.js).
//
// Die zentrale Regel und zugleich das Fummeligste an der Umsetzung: ein Zug ist
// ein **Weg von genau `wurf` Schritten**, kein Vorwärtszählen auf einem Ring.
// Deshalb wird jeder Zug durch Suchen gefunden (`wegeSuchen`), nicht gerechnet.
//
//   - Richtung frei, aber innerhalb eines Zuges nicht sofort zurück.
//   - Figuren dürfen übersprungen werden, Sperren nicht.
//   - Ziel und Heimfelder dürfen nicht durchlaufen werden.
//
// Ein Zug wird über Figur **und** Zielfeld angesprochen: dieselbe Figur kann mit
// demselben Wurf mehrere verschiedene Felder erreichen.

import {
  FELDER, NACHBARN, ZIEL, HEIM, START_SPERREN, UNTERSTE_STRASSE, zumZiel,
} from './brett.js';

export const FIGUREN = 5;
export const SPERREN = START_SPERREN.length;
export const SAVE_VERSION = 1;

const anderer = (i) => (i === 0 ? 1 : 0);

export function neuerStand(namen = ['Monty', 'Christina']) {
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    figuren: [0, 1].map((s) => HEIM[s].map((feld) => ({ feld }))),
    sperren: [...START_SPERREN],
    dran: 0,
    wurf: null,
    setzen: null,             // { spieler } solange ein Stein neu zu setzen ist
    letzteAktion: null,
    siege: [0, 0],
    partie: 1,
    fertig: null,
  };
}

/* ---------------------------------------------------------------- Abfragen */

/** Wer steht auf diesem Feld? Höchstens einer. */
export function figurAuf(stand, feld) {
  for (let spieler = 0; spieler < 2; spieler++) {
    const i = stand.figuren[spieler].findIndex((x) => x.feld === feld);
    if (i >= 0) return { spieler, figur: i };
  }
  return null;
}

export const sperreAuf = (stand, feld) => stand.sperren.includes(feld);

// `fertig` ist der Index des Siegers und darf 0 sein — nie auf Wahrheit prüfen.
export const vorbei = (stand) => stand.fertig !== null;
export const gewinner = (stand) => stand.fertig;

/** Wartet das Spiel darauf, dass ein aufgenommener Stein neu gesetzt wird? */
export const setztGerade = (stand) => stand.setzen !== null;

/** Wie weit ist diese Seite? Kleinste Entfernung einer eigenen Figur zum Ziel. */
export const beste = (stand, spieler) =>
  Math.min(...stand.figuren[spieler].map((x) => zumZiel(x.feld)));

/* --------------------------------------------------------------- Würfeln */

export function wuerfeln(stand, rnd = Math.random) {
  if (vorbei(stand)) throw new Error('Die Partie ist vorbei.');
  if (setztGerade(stand)) throw new Error('Erst den Sperrstein setzen.');
  if (stand.wurf !== null) throw new Error('Der Wurf ist noch nicht gezogen.');
  stand.wurf = 1 + Math.floor(rnd() * 6);
  stand.letzteAktion = { art: 'gewuerfelt', spieler: stand.dran, wurf: stand.wurf };
  return stand.wurf;
}

/* ----------------------------------------------------------- Züge finden */

/** Darf der Weg über dieses Feld hinweggehen (also nicht dort enden)? */
const durchlaessig = (stand, feld) =>
  FELDER[feld].art === 'weg' && !sperreAuf(stand, feld);

/**
 * Alle Felder, die von `start` in genau `schritte` Schritten erreichbar sind.
 *
 * Ohne sofortiges Zurück (`her`), ohne Sperren, Ziel oder Heimfelder als
 * Zwischenstation. Der Verzweigungsgrad liegt bei drei, die Tiefe bei sechs —
 * die Suche bleibt also winzig. Mehrere Wege auf dasselbe Feld sind ein Zug.
 */
function wegeSuchen(stand, start, schritte) {
  const gefunden = new Set();
  const lauf = (hier, her, uebrig) => {
    if (uebrig === 0) { gefunden.add(hier); return; }
    for (const n of NACHBARN[hier]) {
      if (n === her) continue;                       // nicht sofort zurück
      if (uebrig > 1 && !durchlaessig(stand, n)) continue;
      if (uebrig === 1 && FELDER[n].art === 'heim') continue;
      lauf(n, hier, uebrig - 1);
    }
  };
  lauf(start, -1, schritte);
  return gefunden;
}

/** Alle Züge einer einzelnen Figur mit dem aktuellen Wurf. */
export function zieleFuer(stand, figur) {
  if (vorbei(stand) || setztGerade(stand) || stand.wurf === null) return [];
  const spieler = stand.dran;
  const eigene = stand.figuren[spieler][figur];
  if (!eigene || eigene.feld === ZIEL) return [];

  const treffer = [];
  for (const ziel of wegeSuchen(stand, eigene.feld, stand.wurf)) {
    const drauf = figurAuf(stand, ziel);
    if (drauf && drauf.spieler === spieler) continue;   // nie auf die eigene Figur
    treffer.push({
      figur,
      ziel,
      schlaegt: drauf || null,
      sperre: sperreAuf(stand, ziel),
      gewinnt: ziel === ZIEL,
    });
  }
  return treffer.sort((a, b) => a.ziel - b.ziel);
}

export function zuege(stand) {
  if (vorbei(stand) || setztGerade(stand) || stand.wurf === null) return [];
  const alle = [];
  for (let figur = 0; figur < stand.figuren[stand.dran].length; figur++) {
    alle.push(...zieleFuer(stand, figur));
  }
  return alle;
}

export const ziehbar = (stand, figur) => zieleFuer(stand, figur).length > 0;

/* ------------------------------------------------------------------ Ziehen */

/** Ein freies Heimfeld dieser Seite — es gibt immer eins, fünf Felder für fünf Figuren. */
function heimPlatz(stand, spieler) {
  const belegt = new Set(stand.figuren[spieler].map((x) => x.feld));
  return HEIM[spieler].find((id) => !belegt.has(id));
}

export function ziehen(stand, figur, ziel) {
  const zug = zieleFuer(stand, figur).find((z) => z.ziel === ziel);
  if (!zug) throw new Error('Dieser Zug ist nicht erlaubt.');
  const spieler = stand.dran;

  if (zug.schlaegt) {
    const opfer = stand.figuren[zug.schlaegt.spieler][zug.schlaegt.figur];
    opfer.feld = heimPlatz(stand, zug.schlaegt.spieler);
  }

  stand.figuren[spieler][figur].feld = ziel;
  stand.wurf = null;
  stand.letzteAktion = {
    art: zug.gewinnt ? 'gewonnen' : zug.sperre ? 'sperre' : zug.schlaegt ? 'geschlagen' : 'gezogen',
    spieler, figur, ziel, schlaegt: zug.schlaegt || null,
  };

  if (zug.gewinnt) {
    stand.fertig = spieler;
    stand.siege[spieler] += 1;
    return stand;
  }

  if (zug.sperre) {
    // Der Stein ist aufgenommen. Der Zug endet erst, wenn er neu steht.
    stand.sperren = stand.sperren.filter((id) => id !== ziel);
    stand.setzen = { spieler };
    return stand;
  }

  stand.dran = anderer(spieler);
  return stand;
}

/* --------------------------------------------------- Sperre wieder setzen */

/**
 * Wohin darf der aufgenommene Stein? Auf jedes freie Wegfeld — aber nicht auf
 * die unterste Straße. Sonst könnte man jemanden in seinem eigenen Heim
 * einmauern, denn jedes Heimfeld hängt an genau einem Feld dieser Reihe.
 */
export function setzbar(stand) {
  if (!setztGerade(stand)) return [];
  return FELDER.filter((x) => x.art === 'weg'
    && x.reihe !== UNTERSTE_STRASSE
    && !sperreAuf(stand, x.id)
    && !figurAuf(stand, x.id)).map((x) => x.id);
}

export function sperreSetzen(stand, feld) {
  if (!setztGerade(stand)) throw new Error('Gerade ist kein Stein aufzunehmen.');
  if (!setzbar(stand).includes(feld)) throw new Error('Dorthin darf der Stein nicht.');
  const spieler = stand.setzen.spieler;
  stand.sperren = [...stand.sperren, feld];
  stand.setzen = null;
  stand.letzteAktion = { art: 'gesetzt', spieler, ziel: feld };
  stand.dran = anderer(spieler);
  return stand;
}

/* ------------------------------------------------------- Zug abgeben */

export function zugBeenden(stand) {
  if (setztGerade(stand)) throw new Error('Erst den Sperrstein setzen.');
  stand.wurf = null;
  stand.letzteAktion = { art: 'ausgesetzt', spieler: stand.dran };
  stand.dran = anderer(stand.dran);
  return stand;
}

/* --------------------------------------------------------- Neue Partie */

export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.figuren = [0, 1].map((s) => HEIM[s].map((feld) => ({ feld })));
  stand.sperren = [...START_SPERREN];
  stand.dran = beginnt;
  stand.wurf = null;
  stand.setzen = null;
  stand.letzteAktion = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = { v: SAVE_VERSION, n: stand.spieler.map((s) => s.name), s: stand.siege, p: stand.partie };
  return `SPR1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('SPR1-')) throw new Error('Das ist kein Sperrsteine-Punktestand.');
  let kern;
  try {
    kern = JSON.parse(decodeURIComponent(escape(atob(roh.slice(5)))));
  } catch {
    throw new Error('Der Code ist unvollständig oder verrutscht.');
  }
  if (!kern || !Array.isArray(kern.s) || kern.s.length !== 2) {
    throw new Error('Der Code passt nicht zu diesem Spiel.');
  }
  const stand = neuerStand(Array.isArray(kern.n) && kern.n.length === 2 ? kern.n : undefined);
  stand.siege = kern.s.map((n) => (Number.isFinite(n) ? n : 0));
  stand.partie = Number.isFinite(kern.p) ? kern.p : 1;
  return stand;
}
