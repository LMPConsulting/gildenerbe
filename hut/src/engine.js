// Hütchenjagd — Spiellogik ohne DOM. Alles serialisierbar.
//
// Nach dem Vorbild von „Fang den Hut" (Ravensburger, 1927): ein Ring, in den
// Ecken die Höfe, und wer auf einem fremden Hut landet, nimmt ihn unter den
// eigenen und schleppt ihn mit. Brett und Name sind eigene — die Regeln
// stammen aus der Pachisi-Familie und sind frei.
//
// Wie beim Ärger zählt jeder Hut seine eigenen Schritte seit dem Hof. Das
// absolute Feld ergibt sich erst beim Zeichnen — damit sind die Regeln für
// beide Seiten dieselben.
//
// Der Weg geht einmal ganz herum und wieder in den eigenen Hof. Das ist keine
// Kosmetik: liefe jeder nur bis zum gegenüberliegenden Hof, benutzten die
// beiden Seiten je eine eigene Ringhälfte und könnten sich nie begegnen — in
// 2000 Probepartien fiel damit kein einziger Fang. Mit dem Rundlauf teilen sie
// sich jedes Feld, und es sind rund vier Fänge je Partie.

export const RING = 20;                   // 20 Felder = Rand eines 6×6-Rasters
export const HUETE = 4;
export const HOF = [0, RING / 2];         // die beiden Höfe liegen sich gegenüber
export const WEGLAENGE = RING;            // einmal herum und wieder heim
export const SAVE_VERSION = 1;

export const feldVon = (spieler, schritt) => (HOF[spieler] + schritt) % RING;

const anderer = (i) => (i === 0 ? 1 : 0);

export function neuerStand(namen = ['Monty', 'Christina']) {
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    huete: [0, 1].map(() => Array.from({ length: HUETE },
      () => ({ ort: 'hof', schritt: 0, traegt: [] }))),
    dran: 0,
    wurf: null,
    wuerfeUebrig: 1,
    siege: [0, 0],
    partie: 1,
    letzteAktion: null,
    fertig: null,
  };
}

/* ---------------------------------------------------------------- Abfragen */

/** Wer steht auf diesem absoluten Ringfeld? Höchstens einer. */
export function stapelAuf(stand, feld) {
  for (let spieler = 0; spieler < 2; spieler++) {
    for (let figur = 0; figur < stand.huete[spieler].length; figur++) {
      const h = stand.huete[spieler][figur];
      if (h.ort === 'bahn' && feldVon(spieler, h.schritt) === feld) return { spieler, figur };
    }
  }
  return null;
}

export const imZiel = (stand, spieler) =>
  stand.huete[spieler].filter((h) => h.ort === 'ziel').length;

/** Wie viele fremde Hüte schleppt diese Seite gerade mit sich herum? */
export const gefangene = (stand, spieler) =>
  stand.huete[spieler].reduce((n, h) => n + h.traegt.length, 0);

/** Ein Wurf je Zug — Sonderregeln wie beim Ärger gibt es hier nicht. */
export const wuerfeErlaubt = () => 1;

// `fertig` ist der Index des Siegers und darf 0 sein — nie auf Wahrheit prüfen.
export const vorbei = (stand) => stand.fertig !== null;
export const gewinner = (stand) => stand.fertig;

/* --------------------------------------------------------------- Würfeln */

export function wuerfeln(stand, rnd = Math.random) {
  if (vorbei(stand)) throw new Error('Die Partie ist vorbei.');
  if (stand.wurf !== null) throw new Error('Der Wurf ist noch nicht gezogen.');
  stand.wurf = 1 + Math.floor(rnd() * 6);
  stand.wuerfeUebrig = 0;
  stand.letzteAktion = { art: 'gewuerfelt', spieler: stand.dran, wurf: stand.wurf };
  return stand.wurf;
}

/* ----------------------------------------------------------- Züge finden */

function zielVon(stand, spieler, figur, wurf) {
  const h = stand.huete[spieler][figur];
  if (h.ort === 'ziel' || h.ort === 'gefangen') return null;

  const von = h.ort === 'hof' ? 0 : h.schritt;
  const ziel = h.ort === 'hof' ? wurf : von + wurf;
  if (ziel > WEGLAENGE) return null;                 // Überwerfen ist kein Zug
  if (ziel === WEGLAENGE) return { ort: 'ziel', schritt: 0 };

  // Auf dem eigenen Hut darf nicht gestapelt werden.
  const eigenerDort = stand.huete[spieler].some((x, i) =>
    i !== figur && x.ort === 'bahn' && x.schritt === ziel);
  if (eigenerDort) return null;
  return { ort: 'bahn', schritt: ziel };
}

/** Wen würde dieser Zug fangen? */
function fangOpfer(stand, spieler, nach) {
  if (nach.ort !== 'bahn') return null;
  const drauf = stapelAuf(stand, feldVon(spieler, nach.schritt));
  return drauf && drauf.spieler !== spieler ? drauf : null;
}

export function zuege(stand) {
  if (vorbei(stand) || stand.wurf === null) return [];
  const spieler = stand.dran;
  const alle = [];
  stand.huete[spieler].forEach((h, figur) => {
    const nach = zielVon(stand, spieler, figur, stand.wurf);
    if (!nach) return;
    alle.push({ figur, von: { ...h }, nach, faengt: fangOpfer(stand, spieler, nach) });
  });
  return alle;
}

export const ziehbar = (stand, figur) => zuege(stand).some((z) => z.figur === figur);

/* ------------------------------------------------------------------ Ziehen */

export function ziehen(stand, figur) {
  const zug = zuege(stand).find((z) => z.figur === figur);
  if (!zug) throw new Error('Dieser Zug ist nicht erlaubt.');
  const spieler = stand.dran;
  const hut = stand.huete[spieler][figur];

  if (zug.faengt) {
    const opfer = stand.huete[zug.faengt.spieler][zug.faengt.figur];
    // Der gefangene Hut wandert unter den eigenen — mitsamt seiner Beute.
    hut.traegt = [...hut.traegt, zug.faengt.spieler, ...opfer.traegt];
    opfer.traegt = [];
    opfer.ort = 'gefangen';
    opfer.schritt = 0;
  }

  hut.ort = zug.nach.ort;
  hut.schritt = zug.nach.schritt;

  if (zug.nach.ort === 'ziel' && hut.traegt.length) {
    // Angekommen: die Beute geht frei und stellt sich in ihren eigenen Hof.
    for (const besitzer of hut.traegt) {
      const heim = stand.huete[besitzer].find((x) => x.ort === 'gefangen');
      if (heim) { heim.ort = 'hof'; heim.schritt = 0; }
    }
    hut.traegt = [];
  }

  stand.letzteAktion = zug.faengt
    ? { art: 'gefangen', spieler, figur, opfer: zug.faengt }
    : { art: 'gezogen', spieler, figur, nach: { ...zug.nach } };
  stand.wurf = null;

  if (imZiel(stand, spieler) === HUETE) {
    stand.fertig = spieler;
    stand.siege[spieler] += 1;
    return stand;
  }

  stand.dran = anderer(spieler);
  stand.wuerfeUebrig = 1;
  return stand;
}

export function zugBeenden(stand) {
  stand.wurf = null;
  stand.dran = anderer(stand.dran);
  stand.wuerfeUebrig = 1;
  return stand;
}

export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.huete = [0, 1].map(() => Array.from({ length: HUETE },
    () => ({ ort: 'hof', schritt: 0, traegt: [] })));
  stand.dran = beginnt;
  stand.wurf = null;
  stand.wuerfeUebrig = 1;
  stand.letzteAktion = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = { v: SAVE_VERSION, n: stand.spieler.map((s) => s.name), s: stand.siege, p: stand.partie };
  return `HUT1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('HUT1-')) throw new Error('Das ist kein Hütchenjagd-Punktestand.');
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
