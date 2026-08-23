// Ärger — Spiellogik ohne DOM. Alles serialisierbar.
//
// Das Brett ist ein Ring aus 40 Feldern. Jede Figur zählt ihre eigenen
// Schritte seit dem Start: 0 bis 39 auf der Bahn, danach vier Hausfelder.
// Das absolute Feld ergibt sich erst beim Zeichnen — dadurch sind alle
// Regeln für beide Seiten dieselben, und nichts muss gespiegelt werden.

export const RING = 40;
export const HAUSLAENGE = 4;
export const START = [0, 20];        // absolute Startfelder der beiden Seiten
export const SAVE_VERSION = 1;

export const VORGABE = {
  figuren: 4,          // 4 oder 2 — zwei macht eine kurze Partie
  mussSchlagen: false, // wenn an: gibt es einen Schlag, muss er gemacht werden
  strengeSechs: true,  // bei einer 6 zuerst herauskommen bzw. das Startfeld räumen
};

/** Absolutes Feld auf dem Ring für eine Figur dieses Spielers. */
export const feldVon = (spieler, schritt) => (START[spieler] + schritt) % RING;

const anderer = (i) => (i === 0 ? 1 : 0);

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}) {
  const r = { ...VORGABE, ...regeln };
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    figuren: [0, 1].map(() => Array.from({ length: r.figuren }, () => ({ ort: 'basis', schritt: 0 }))),
    dran: 0,
    wurf: null,
    wuerfeUebrig: 3,
    siege: [0, 0],
    partie: 1,
    regeln: r,
    letzteAktion: null,
    fertig: null,
  };
}

/* ---------------------------------------------------------------- Abfragen */

/** Wer steht auf diesem absoluten Ringfeld? */
export function figurenAuf(stand, feld) {
  const treffer = [];
  stand.figuren.forEach((seite, spieler) => {
    seite.forEach((f, figur) => {
      if (f.ort === 'bahn' && feldVon(spieler, f.schritt) === feld) treffer.push({ spieler, figur });
    });
  });
  return treffer;
}

export const alleImHaus = (stand, spieler) =>
  stand.figuren[spieler].every((f) => f.ort === 'haus');

/** Wie oft darf dieser Spieler werfen? Drei, solange nichts auf der Bahn steht. */
export function wuerfeErlaubt(stand, spieler) {
  return stand.figuren[spieler].some((f) => f.ort === 'bahn') ? 1 : 3;
}

/* --------------------------------------------------------------- Würfeln */

export function wuerfeln(stand, rnd = Math.random) {
  if (stand.fertig !== null) throw new Error('Die Partie ist vorbei.');
  if (stand.wurf !== null) throw new Error('Der Wurf ist noch nicht gezogen.');
  if (stand.wuerfeUebrig <= 0) throw new Error('Keine Würfe mehr in diesem Zug.');
  stand.wurf = 1 + Math.floor(rnd() * 6);
  stand.wuerfeUebrig -= 1;
  stand.letzteAktion = { art: 'gewuerfelt', spieler: stand.dran, wurf: stand.wurf };
  return stand.wurf;
}

/* ----------------------------------------------------------- Züge finden */

/** Wohin käme diese Figur mit diesem Wurf? `null`, wenn der Zug nicht geht. */
function zielVon(stand, spieler, figur, wurf) {
  const eigene = stand.figuren[spieler];
  const f = eigene[figur];

  if (f.ort === 'haus') {
    const ziel = f.schritt + wurf;
    if (ziel >= HAUSLAENGE) return null;                      // über das Ende hinaus
    for (let i = f.schritt + 1; i <= ziel; i++) {
      if (eigene.some((x) => x.ort === 'haus' && x.schritt === i)) return null;
    }
    return { ort: 'haus', schritt: ziel };
  }

  if (f.ort === 'basis') {
    if (wurf !== 6) return null;
    if (eigene.some((x) => x.ort === 'bahn' && x.schritt === 0)) return null;
    return { ort: 'bahn', schritt: 0 };
  }

  const ziel = f.schritt + wurf;
  if (ziel < RING) {
    if (eigene.some((x) => x.ort === 'bahn' && x.schritt === ziel)) return null;
    return { ort: 'bahn', schritt: ziel };
  }

  const imHaus = ziel - RING;
  if (imHaus >= HAUSLAENGE) return null;                      // Überwerfen ist kein Zug
  for (let i = 0; i <= imHaus; i++) {
    if (eigene.some((x) => x.ort === 'haus' && x.schritt === i)) return null;
  }
  return { ort: 'haus', schritt: imHaus };
}

/** Welche fremde Figur stünde im Weg? */
function schlagOpfer(stand, spieler, ziel) {
  if (ziel.ort !== 'bahn') return null;
  const feld = feldVon(spieler, ziel.schritt);
  const fremd = figurenAuf(stand, feld).find((t) => t.spieler !== spieler);
  return fremd || null;
}

/**
 * Alle Züge, die mit dem geworfenen Wurf erlaubt sind — schon gefiltert nach
 * Sechs-Pflicht und „Schlagen ist Pflicht".
 */
export function zuege(stand) {
  if (stand.fertig !== null || stand.wurf === null) return [];
  const spieler = stand.dran;
  const wurf = stand.wurf;
  const eigene = stand.figuren[spieler];

  const alle = [];
  eigene.forEach((f, figur) => {
    const nach = zielVon(stand, spieler, figur, wurf);
    if (!nach) return;
    alle.push({ figur, von: { ...f }, nach, schlaegt: schlagOpfer(stand, spieler, nach) });
  });
  if (!alle.length) return [];

  // Sechs-Pflicht: erst heraus, sonst das eigene Startfeld frei machen.
  if (stand.regeln.strengeSechs && wurf === 6 && eigene.some((f) => f.ort === 'basis')) {
    const raus = alle.filter((z) => z.von.ort === 'basis');
    if (raus.length) return [raus[0]];
    const vomStart = alle.filter((z) => z.von.ort === 'bahn' && z.von.schritt === 0);
    if (vomStart.length) return vomStart;
  }

  if (stand.regeln.mussSchlagen) {
    const schlaege = alle.filter((z) => z.schlaegt);
    if (schlaege.length) return schlaege;
  }

  return alle;
}

/** Kann genau diese Figur gerade ziehen? */
export const ziehbar = (stand, figur) => zuege(stand).some((z) => z.figur === figur);

/* ------------------------------------------------------------------ Ziehen */

export function ziehen(stand, figur) {
  const zug = zuege(stand).find((z) => z.figur === figur);
  if (!zug) throw new Error('Dieser Zug ist nicht erlaubt.');
  const spieler = stand.dran;
  const wurf = stand.wurf;

  if (zug.schlaegt) {
    stand.figuren[zug.schlaegt.spieler][zug.schlaegt.figur] = { ort: 'basis', schritt: 0 };
  }
  stand.figuren[spieler][figur] = { ...zug.nach };

  stand.letzteAktion = zug.schlaegt
    ? { art: 'geschlagen', spieler, figur, opfer: zug.schlaegt }
    : { art: 'gezogen', spieler, figur, nach: { ...zug.nach } };
  stand.wurf = null;

  if (alleImHaus(stand, spieler)) {
    stand.fertig = spieler;
    stand.siege[spieler] += 1;
    stand.wuerfeUebrig = 0;
    return stand;
  }

  if (wurf === 6) {
    stand.wuerfeUebrig = 1;                 // eine Sechs bringt einen weiteren Wurf
  } else {
    stand.dran = anderer(spieler);
    stand.wuerfeUebrig = wuerfeErlaubt(stand, stand.dran);
  }
  return stand;
}

/**
 * Der Wurf war nicht zu gebrauchen. Solange noch Würfe übrig sind, bleibt der
 * Spieler dran; sonst wechselt die Seite.
 */
export function zugBeenden(stand) {
  stand.wurf = null;
  if (stand.wuerfeUebrig > 0) return stand;
  stand.dran = anderer(stand.dran);
  stand.wuerfeUebrig = wuerfeErlaubt(stand, stand.dran);
  return stand;
}

export const gewinner = (stand) => stand.fertig;

// Vorsicht: `fertig` ist der Index des Siegers und darf 0 sein — `if (stand.fertig)`
// würde einen Sieg von Spieler 0 verschlucken. Darum diese Abfrage benutzen.
export const vorbei = (stand) => stand.fertig !== null;

/** Neue Partie auf demselben Konto — der Verlierer fängt an. */
export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.figuren = [0, 1].map(() =>
    Array.from({ length: stand.regeln.figuren }, () => ({ ort: 'basis', schritt: 0 })));
  stand.dran = beginnt;
  stand.wurf = null;
  stand.wuerfeUebrig = 3;
  stand.letzteAktion = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = { v: SAVE_VERSION, n: stand.spieler.map((s) => s.name), s: stand.siege, p: stand.partie };
  return `AER1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('AER1-')) throw new Error('Das ist kein Ärger-Punktestand.');
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
