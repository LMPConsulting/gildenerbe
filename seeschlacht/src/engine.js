// Seeschlacht — Spiellogik ohne DOM. Alles serialisierbar.
//
// Jede Seite hat ein eigenes Meer. Darin liegen die Schiffe (nur der Besitzer
// kennt sie) und die Schüsse, die auf dieses Meer abgegeben wurden (die sehen
// beide). Diese Trennung ist der ganze Trick: beim Verschicken an das andere
// Handy werden einfach die Schiffe herausgenommen.

export const BREITE = 10;
export const HOEHE = 10;
export const SPALTEN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const SAVE_VERSION = 1;

/** Die klassische deutsche Flotte. */
export const FLOTTE = [
  { laenge: 5, anzahl: 1, name: 'Schlachtschiff' },
  { laenge: 4, anzahl: 2, name: 'Kreuzer' },
  { laenge: 3, anzahl: 3, name: 'Zerstörer' },
  { laenge: 2, anzahl: 4, name: 'U-Boot' },
];

export const FELDER_GESAMT = FLOTTE.reduce((n, s) => n + s.laenge * s.anzahl, 0);

/** Alle Längen einzeln, längste zuerst — so wird gelegt und gezählt. */
export const LAENGEN = FLOTTE.flatMap((s) => Array.from({ length: s.anzahl }, () => s.laenge));

export const VORGABE = {
  abstand: true,          // Schiffe dürfen sich nicht berühren, auch nicht über Eck
  trefferNochmal: true,   // ein Treffer bringt einen weiteren Schuss
};

/* ---------------------------------------------------------------- Felder */

export const imMeer = (x, y) => x >= 0 && y >= 0 && x < BREITE && y < HOEHE;
export const feldName = (x, y) => `${SPALTEN[x]}${y + 1}`;

export function feldAus(text) {
  const t = String(text || '').trim().toUpperCase();
  const m = t.match(/^([A-J])(10|[1-9])$/);
  if (!m) return null;
  return { x: SPALTEN.indexOf(m[1]), y: Number(m[2]) - 1 };
}

/** Die Felder eines Schiffs, das an (x,y) beginnt. */
const felderVon = ({ x, y, laenge, quer }) =>
  Array.from({ length: laenge }, (_, i) => (quer ? { x: x + i, y } : { x, y: y + i }));

/** Alle Nachbarfelder einer Feldmenge — ohne die Felder selbst, ohne Rand. */
export function umgebung(felder) {
  const eigen = new Set(felder.map((f) => `${f.x},${f.y}`));
  const raus = new Map();
  for (const f of felder) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = f.x + dx;
        const y = f.y + dy;
        if (!imMeer(x, y) || eigen.has(`${x},${y}`)) continue;
        raus.set(`${x},${y}`, { x, y });
      }
    }
  }
  return [...raus.values()];
}

/* ------------------------------------------------------------------ Meer */

export function leeresMeer(abstand = true) {
  return { schiffe: [], schuesse: {}, versenkte: [], abstand };
}

export const schiffAn = (meer, x, y) =>
  meer.schiffe.find((s) => s.felder.some((f) => f.x === x && f.y === y)) || null;

/** Passt ein Schiff an diese Stelle? */
export function passt(meer, form) {
  const felder = felderVon(form);
  if (felder.some((f) => !imMeer(f.x, f.y))) return false;
  if (felder.some((f) => schiffAn(meer, f.x, f.y))) return false;
  if (meer.abstand === false) return true;
  return !umgebung(felder).some((n) => schiffAn(meer, n.x, n.y));
}

export function setzen(meer, form) {
  if (!passt(meer, form)) return false;
  meer.schiffe.push({ ...form, felder: felderVon(form) });
  return true;
}

/** Nimmt das Schiff weg, das auf diesem Feld liegt. */
export function entfernen(meer, x, y) {
  const s = schiffAn(meer, x, y);
  if (!s) return false;
  meer.schiffe = meer.schiffe.filter((o) => o !== s);
  return true;
}

export const gelegteSchiffe = (meer) =>
  (typeof meer.anzahl === 'number' ? meer.anzahl : meer.schiffe.length);

export const flotteFertig = (meer) => gelegteSchiffe(meer) === LAENGEN.length;

/**
 * Legt eine vollständige Flotte zufällig aus. Die langen Schiffe zuerst —
 * sonst verstellen die kurzen die letzten freien Bahnen.
 */
export function zufallsflotte(meer, rnd = Math.random) {
  meer.schiffe = [];
  meer.schuesse = {};
  meer.versenkte = [];
  return flotteAuffuellen(meer, rnd);
}

/**
 * Legt die noch fehlenden Schiffe dazu und lässt liegen, was schon da ist.
 * Die langen zuerst — sonst verstellen die kurzen die letzten freien Bahnen.
 */
export function flotteAuffuellen(meer, rnd = Math.random) {
  const fehlt = LAENGEN.slice();
  for (const s of meer.schiffe) {
    const i = fehlt.indexOf(s.laenge);
    if (i >= 0) fehlt.splice(i, 1);
  }
  const vorher = meer.schiffe.slice();
  for (const laenge of fehlt) {
    let gelegt = false;
    for (let versuch = 0; versuch < 800 && !gelegt; versuch++) {
      const quer = rnd() < 0.5;
      const x = Math.floor(rnd() * (quer ? BREITE - laenge + 1 : BREITE));
      const y = Math.floor(rnd() * (quer ? HOEHE : HOEHE - laenge + 1));
      gelegt = setzen(meer, { x, y, laenge, quer });
    }
    if (!gelegt) {
      // In einer engen Ecke gelandet — lieber von vorn als halb fertig. Was
      // von Hand gelegt wurde, bleibt dabei stehen.
      meer.schiffe = vorher.slice();
      return flotteAuffuellen(meer, rnd);
    }
  }
  return meer;
}

export const versenkt = (meer, schiff) =>
  schiff.felder.every((f) => meer.schuesse[`${f.x},${f.y}`] === 'treffer');

export const alleVersenkt = (meer) =>
  meer.schiffe.length > 0 && meer.schiffe.every((s) => versenkt(meer, s));

/* ------------------------------------------------------------------ Stand */

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}) {
  const r = { ...VORGABE, ...regeln };
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    meere: [leeresMeer(r.abstand), leeresMeer(r.abstand)],
    dran: 0,
    siege: [0, 0],
    partie: 1,
    regeln: r,
    letzterSchuss: null,
    fertig: null,
  };
}

export const bereit = (stand, spieler) => flotteFertig(stand.meere[spieler]);

/**
 * 'legen', solange eine Flotte fehlt — danach 'schiessen'. Bewusst berechnet
 * und nicht im Zustand abgelegt: ein zweites Feld daneben könnte der Wahrheit
 * widersprechen, und genau das war schon einmal der Fall.
 */
export function phase(stand) {
  if (stand.fertig !== null) return 'ende';
  return bereit(stand, 0) && bereit(stand, 1) ? 'schiessen' : 'legen';
}

// `fertig` ist der Index des Siegers und darf 0 sein — nie auf Wahrheit prüfen.
export const vorbei = (stand) => stand.fertig !== null;

const anderer = (i) => (i === 0 ? 1 : 0);

/* --------------------------------------------------------------- Schießen */

/**
 * Ein Schuss auf das Meer der Gegenseite. Gibt zurück, was passiert ist,
 * oder null, wenn der Schuss gar nicht zulässig war.
 */
export function schiessen(stand, x, y) {
  if (vorbei(stand)) return null;
  if (phase(stand) !== 'schiessen') return null;
  if (!imMeer(x, y)) return null;
  const ziel = anderer(stand.dran);
  const meer = stand.meere[ziel];
  if (meer.schuesse[`${x},${y}`]) return null;

  const schiff = schiffAn(meer, x, y);
  meer.schuesse[`${x},${y}`] = schiff ? 'treffer' : 'wasser';

  let istVersenkt = false;
  if (schiff && versenkt(meer, schiff)) {
    istVersenkt = true;
    // Rund um ein versenktes Schiff kann nichts mehr liegen — das deckt sich auf.
    for (const n of umgebung(schiff.felder)) {
      if (!meer.schuesse[`${n.x},${n.y}`]) meer.schuesse[`${n.x},${n.y}`] = 'wasser';
    }
    meer.versenkte.push({ laenge: schiff.laenge, felder: schiff.felder.map((f) => ({ ...f })) });
  }

  const ergebnis = { treffer: !!schiff, versenkt: istVersenkt, x, y, schuetze: stand.dran };
  stand.letzterSchuss = ergebnis;

  if (alleVersenkt(meer)) {
    stand.fertig = stand.dran;
    stand.siege[stand.dran] += 1;
    return ergebnis;
  }
  if (!(schiff && stand.regeln.trefferNochmal)) stand.dran = ziel;
  return ergebnis;
}

/** Wie viele Schiffe stehen hier noch? */
export const nochUebrig = (meer) =>
  meer.schiffe.filter((s) => !versenkt(meer, s)).length;

/* -------------------------------------------- Was das andere Handy sehen darf */

/**
 * Der Stand aus Sicht eines Geräts. Die Schiffe des Gegners werden
 * herausgenommen — nur Treffer, Wasser und schon versenkte Schiffe bleiben.
 */
export function gegnerSicht(stand, empfaenger) {
  const k = JSON.parse(JSON.stringify(stand));
  const gegner = anderer(empfaenger);
  // `anzahl` bleibt: wie viele Schiffe drüben liegen, weiß ohnehin jeder — und
  // ohne diese Zahl käme der Empfänger nie aus der Legephase heraus.
  k.meere[gegner] = {
    ...k.meere[gegner],
    schiffe: [],
    anzahl: stand.meere[gegner].schiffe.length,
  };
  return k;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = { v: SAVE_VERSION, n: stand.spieler.map((s) => s.name), s: stand.siege, p: stand.partie };
  return `SEE1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('SEE1-')) throw new Error('Das ist kein Seeschlacht-Punktestand.');
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

/** Neue Partie: Meere leer, Punkte bleiben. Der Verlierer beginnt. */
export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.meere = [leeresMeer(stand.regeln.abstand), leeresMeer(stand.regeln.abstand)];
  stand.dran = beginnt;
  stand.letzterSchuss = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}
