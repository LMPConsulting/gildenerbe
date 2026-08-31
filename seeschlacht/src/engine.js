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
  breite: BREITE,
  hoehe: HOEHE,
  laengen: LAENGEN,       // die Flotte als Liste von Schiffslängen
  salve: false,           // wenn an: so viele Schüsse je Zug, wie man Schiffe hat
  waffen: false,          // wenn an: Luftschlag, Radar und Mine, je einmal
};

/** Die kleine Flotte für das 8 × 8-Meer: 16 Felder statt 30. */
export const KURZE_LAENGEN = [4, 3, 3, 2, 2, 2];

export const MODI = [
  {
    id: 'klassisch',
    titel: 'Klassisch',
    zeile: '10 × 10, zehn Schiffe, Treffer bringt einen Nachschuss',
    regeln: {},
  },
  {
    id: 'kurz',
    titel: 'Kurz',
    zeile: '8 × 8 und nur sechs Schiffe — halb so lang',
    regeln: { breite: 8, hoehe: 8, laengen: KURZE_LAENGEN },
  },
  {
    id: 'salve',
    titel: 'Salve',
    zeile: 'So viele Schüsse auf einmal, wie du noch Schiffe hast',
    regeln: { salve: true, trefferNochmal: false },
  },
  {
    id: 'waffen',
    titel: 'Sonderwaffen',
    zeile: 'Luftschlag, Radar und Mine — jede einmal je Partie',
    regeln: { waffen: true },
  },
];

const WAFFEN_LEER = { luftschlag: 0, radar: 0, mine: 0 };
const WAFFEN_VOLL = { luftschlag: 1, radar: 1, mine: 1 };

/* ---------------------------------------------------------------- Felder */

/**
 * Die Maße eines Meeres. Sie stehen am Meer selbst, nicht als Konstante —
 * nur so kann eine Fassung ein kleineres Brett haben. Ältere Spielstände
 * kennen die Felder nicht; für die gilt das klassische 10 × 10.
 */
export const masse = (meer) => ({
  breite: meer && meer.breite ? meer.breite : BREITE,
  hoehe: meer && meer.hoehe ? meer.hoehe : HOEHE,
});

/** Die Flotte dieses Meeres als Liste von Schiffslängen. */
export const flottenLaengen = (meer) =>
  (meer && Array.isArray(meer.laengen) ? meer.laengen : LAENGEN);

export function imMeer(meer, x, y) {
  const { breite, hoehe } = masse(meer);
  return x >= 0 && y >= 0 && x < breite && y < hoehe;
}

export const feldName = (x, y) => `${SPALTEN[x]}${y + 1}`;

export function feldAus(text, meer = null) {
  const t = String(text || '').trim().toUpperCase();
  const m = t.match(/^([A-J])(10|[1-9])$/);
  if (!m) return null;
  const feld = { x: SPALTEN.indexOf(m[1]), y: Number(m[2]) - 1 };
  return meer && !imMeer(meer, feld.x, feld.y) ? null : feld;
}

/** Die Felder eines Schiffs, das an (x,y) beginnt. */
const felderVon = ({ x, y, laenge, quer }) =>
  Array.from({ length: laenge }, (_, i) => (quer ? { x: x + i, y } : { x, y: y + i }));

/** Alle Nachbarfelder einer Feldmenge — ohne die Felder selbst, ohne Rand. */
export function umgebung(meer, felder) {
  const eigen = new Set(felder.map((f) => `${f.x},${f.y}`));
  const raus = new Map();
  for (const f of felder) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = f.x + dx;
        const y = f.y + dy;
        if (!imMeer(meer, x, y) || eigen.has(`${x},${y}`)) continue;
        raus.set(`${x},${y}`, { x, y });
      }
    }
  }
  return [...raus.values()];
}

/* ------------------------------------------------------------------ Meer */

export function leeresMeer(regeln = {}) {
  const r = { ...VORGABE, ...regeln };
  return {
    schiffe: [], schuesse: {}, versenkte: [],
    abstand: r.abstand,
    breite: r.breite, hoehe: r.hoehe, laengen: [...r.laengen],
    minen: [], radare: [],
  };
}

export const schiffAn = (meer, x, y) =>
  meer.schiffe.find((s) => s.felder.some((f) => f.x === x && f.y === y)) || null;

/** Passt ein Schiff an diese Stelle? */
export function passt(meer, form) {
  const felder = felderVon(form);
  if (felder.some((f) => !imMeer(meer, f.x, f.y))) return false;
  if (felder.some((f) => schiffAn(meer, f.x, f.y))) return false;
  if (meer.abstand === false) return true;
  return !umgebung(meer, felder).some((n) => schiffAn(meer, n.x, n.y));
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

export const flotteFertig = (meer) => gelegteSchiffe(meer) === flottenLaengen(meer).length;

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
  const { breite, hoehe } = masse(meer);
  const vorher = meer.schiffe.slice();
  // Schleife statt Rekursion, und mit Deckel: bei einem Zufallsgeber, der immer
  // dieselbe Zahl liefert, lief sich die alte Fassung in den Stapelüberlauf.
  // Mit echtem Zufall greift der Deckel praktisch nie — beim ersten Anlauf
  // klappt es fast immer.
  for (let anlauf = 0; anlauf < 60; anlauf++) {
    meer.schiffe = vorher.slice();
    const fehlt = flottenLaengen(meer).slice();
    for (const s of meer.schiffe) {
      const i = fehlt.indexOf(s.laenge);
      if (i >= 0) fehlt.splice(i, 1);
    }
    let alleGelegt = true;
    for (const laenge of fehlt) {
      let gelegt = false;
      for (let versuch = 0; versuch < 800 && !gelegt; versuch++) {
        const quer = rnd() < 0.5;
        const x = Math.floor(rnd() * (quer ? breite - laenge + 1 : breite));
        const y = Math.floor(rnd() * (quer ? hoehe : hoehe - laenge + 1));
        gelegt = setzen(meer, { x, y, laenge, quer });
      }
      if (!gelegt) { alleGelegt = false; break; }
    }
    if (alleGelegt) return meer;
  }
  meer.schiffe = vorher.slice();
  throw new Error('Für diese Flotte ist im Meer kein Platz.');
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
    meere: [leeresMeer(r), leeresMeer(r)],
    dran: 0,
    siege: [0, 0],
    partie: 1,
    regeln: r,
    waffen: [{ ...(r.waffen ? WAFFEN_VOLL : WAFFEN_LEER) },
      { ...(r.waffen ? WAFFEN_VOLL : WAFFEN_LEER) }],
    salve: [],
    aussetzen: [0, 0],
    letzterSchuss: null,
    letzteWaffe: null,
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
  const ziel = anderer(stand.dran);
  const meer = stand.meere[ziel];
  if (!imMeer(meer, x, y)) return null;
  if (meer.schuesse[`${x},${y}`]) return null;
  return treffenUndPruefen(stand, x, y);
}

/**
 * Ein einzelnes Feld beschießen und alles daran hängende auflösen: versenkt,
 * Umgebung aufdecken, Mine ausgelöst, Sieg. Gibt weder ab noch prüft es, ob
 * geschossen werden darf — das machen die Aufrufer, weil Salve und Luftschlag
 * mehrere Felder auf einmal treffen.
 */
function treffenUndPruefen(stand, x, y, abgeben = true) {
  const ziel = anderer(stand.dran);
  const meer = stand.meere[ziel];
  const schiff = schiffAn(meer, x, y);
  meer.schuesse[`${x},${y}`] = schiff ? 'treffer' : 'wasser';

  let istVersenkt = false;
  if (schiff && versenkt(meer, schiff)) {
    istVersenkt = true;
    // Rund um ein versenktes Schiff kann nichts mehr liegen — das deckt sich auf.
    for (const n of umgebung(meer, schiff.felder)) {
      if (!meer.schuesse[`${n.x},${n.y}`]) meer.schuesse[`${n.x},${n.y}`] = 'wasser';
    }
    meer.versenkte.push({ laenge: schiff.laenge, felder: schiff.felder.map((f) => ({ ...f })) });
  }

  // Eine Mine der Gegenseite: sie fliegt auf, und der Schütze setzt aus.
  const mine = (meer.minen || []).find((m) => m.x === x && m.y === y && !m.ausgeloest);
  if (mine) {
    mine.ausgeloest = true;
    stand.aussetzen[stand.dran] = 1;
  }

  const ergebnis = {
    treffer: !!schiff, versenkt: istVersenkt, mine: !!mine, x, y, schuetze: stand.dran,
  };
  stand.letzterSchuss = ergebnis;

  if (alleVersenkt(meer)) {
    stand.fertig = stand.dran;
    stand.siege[stand.dran] += 1;
    return ergebnis;
  }
  if (abgeben && !(schiff && !mine && stand.regeln.trefferNochmal)) abgeben1(stand);
  return ergebnis;
}

/**
 * Den Zug abgeben — und dabei ein Aussetzen einlösen. Wer auf eine Mine
 * geschossen hat, wird beim nächsten Mal übersprungen; dadurch kommt die
 * Gegenseite zweimal hintereinander an die Reihe.
 */
function abgeben1(stand) {
  const naechster = anderer(stand.dran);
  if (stand.aussetzen && stand.aussetzen[naechster] > 0) {
    stand.aussetzen[naechster] -= 1;
    return;                                   // derselbe bleibt dran
  }
  stand.dran = naechster;
}

/* ------------------------------------------------------------------ Salve */

/** Wie viele Schüsse hat man diesen Zug? 0, wenn nicht im Salve-Modus. */
export function salveGroesse(stand) {
  if (!stand.regeln.salve || vorbei(stand) || phase(stand) !== 'schiessen') return 0;
  return nochUebrig(stand.meere[stand.dran]);
}

/** Ein Feld für die Salve vormerken — oder die Vormerkung zurücknehmen. */
export function markieren(stand, x, y) {
  if (!stand.regeln.salve) throw new Error('Diese Fassung kennt keine Salve.');
  if (salveGroesse(stand) <= 0) throw new Error('Gerade ist keine Salve möglich.');
  const meer = stand.meere[anderer(stand.dran)];
  if (!imMeer(meer, x, y)) return false;
  if (meer.schuesse[`${x},${y}`]) return false;
  const i = stand.salve.findIndex((f) => f.x === x && f.y === y);
  if (i >= 0) { stand.salve.splice(i, 1); return false; }
  if (stand.salve.length >= salveGroesse(stand)) return false;
  stand.salve.push({ x, y });
  return true;
}

/** Die vorgemerkten Felder alle auf einmal beschießen. */
export function salveFeuern(stand) {
  if (!stand.regeln.salve) throw new Error('Diese Fassung kennt keine Salve.');
  const soll = salveGroesse(stand);
  const meer = stand.meere[anderer(stand.dran)];
  // Am Ende sind vielleicht weniger freie Felder übrig als Schüsse.
  const { breite, hoehe } = masse(meer);
  let frei = 0;
  for (let x = 0; x < breite; x++) {
    for (let y = 0; y < hoehe; y++) if (!meer.schuesse[`${x},${y}`]) frei += 1;
  }
  if (stand.salve.length < Math.min(soll, frei)) {
    throw new Error('Es fehlen noch Ziele für die Salve.');
  }
  const felder = stand.salve.slice();
  stand.salve = [];
  const ergebnisse = [];
  for (const f of felder) {
    // Kein Abgeben zwischendurch: erst wenn die ganze Salve draußen ist.
    ergebnisse.push(treffenUndPruefen(stand, f.x, f.y, false));
    if (vorbei(stand)) break;
  }
  if (!vorbei(stand)) abgeben1(stand);
  return ergebnisse;
}

/* ------------------------------------------------------------ Sonderwaffen */

export const waffenVorrat = (stand, spieler) =>
  ({ ...WAFFEN_LEER, ...((stand.waffen || [])[spieler] || {}) });

function waffePruefen(stand, name) {
  if (vorbei(stand)) throw new Error('Die Partie ist vorbei.');
  if (phase(stand) !== 'schiessen') throw new Error('Erst müssen beide Flotten liegen.');
  if (stand.salve && stand.salve.length) throw new Error('Erst die Salve abschließen.');
  if (waffenVorrat(stand, stand.dran)[name] <= 0) {
    throw new Error('Diese Waffe ist schon verbraucht.');
  }
}

/**
 * Luftschlag: drei Felder in einer Reihe, waagerecht oder senkrecht.
 * Beendet den Zug in jedem Fall — auch bei Treffern. Sonst wäre er zu stark.
 */
export function luftschlag(stand, x, y, quer) {
  waffePruefen(stand, 'luftschlag');
  const meer = stand.meere[anderer(stand.dran)];
  const felder = Array.from({ length: 3 }, (_, i) => (quer ? { x: x + i, y } : { x, y: y + i }));
  if (felder.some((f) => !imMeer(meer, f.x, f.y))) {
    throw new Error('Der Luftschlag ginge über den Rand hinaus.');
  }
  stand.waffen[stand.dran].luftschlag -= 1;
  const ergebnisse = [];
  for (const f of felder) {
    if (meer.schuesse[`${f.x},${f.y}`]) continue;      // schon beschossen: überspringen
    ergebnisse.push(treffenUndPruefen(stand, f.x, f.y, false));
    if (vorbei(stand)) break;
  }
  stand.letzteWaffe = { art: 'luftschlag', spieler: stand.dran, x, y, quer };
  if (!vorbei(stand)) abgeben1(stand);
  return ergebnisse;
}

/**
 * Radar: meldet, wie viele Schiffsfelder in einem 3 × 3-Feld liegen — mehr
 * nicht. Es deckt nichts auf und markiert nichts; man weiß danach nur, dass
 * dort etwas ist. Die Gegenseite sieht, wo geschaut wurde: in der Papierfassung
 * müsste sie die Frage ja beantworten.
 */
export function radar(stand, x, y) {
  waffePruefen(stand, 'radar');
  const meer = stand.meere[anderer(stand.dran)];
  if (!imMeer(meer, x, y)) throw new Error('Dieses Feld gibt es nicht.');
  stand.waffen[stand.dran].radar -= 1;
  let anzahl = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (imMeer(meer, x + dx, y + dy) && schiffAn(meer, x + dx, y + dy)) anzahl += 1;
    }
  }
  meer.radare = [...(meer.radare || []), { x, y, anzahl }];
  stand.letzteWaffe = { art: 'radar', spieler: stand.dran, x, y, anzahl };
  abgeben1(stand);
  return anzahl;
}

/**
 * Mine: auf das **eigene** Meer gelegt und bis zur Auslösung geheim. Wer
 * daraufschießt, setzt einen Zug aus.
 */
export function mineLegen(stand, x, y) {
  waffePruefen(stand, 'mine');
  const meer = stand.meere[stand.dran];
  if (!imMeer(meer, x, y)) throw new Error('Dieses Feld gibt es nicht.');
  if (meer.schuesse[`${x},${y}`]) throw new Error('Auf dieses Feld wurde schon geschossen.');
  if ((meer.minen || []).some((m) => m.x === x && m.y === y)) {
    throw new Error('Dort liegt schon eine Mine.');
  }
  stand.waffen[stand.dran].mine -= 1;
  meer.minen = [...(meer.minen || []), { x, y, ausgeloest: false }];
  stand.letzteWaffe = { art: 'mine', spieler: stand.dran, x, y };
  abgeben1(stand);
  return true;
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
    // Eine Mine ist so geheim wie ein Schiff — bis sie hochgeht.
    minen: (stand.meere[gegner].minen || []).filter((m) => m.ausgeloest).map((m) => ({ ...m })),
  };
  return k;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = {
    v: SAVE_VERSION, n: stand.spieler.map((s) => s.name),
    s: stand.siege, p: stand.partie, r: stand.regeln,
  };
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
  const stand = neuerStand(
    Array.isArray(kern.n) && kern.n.length === 2 ? kern.n : undefined,
    kern.r && typeof kern.r === 'object' ? kern.r : {},
  );
  stand.siege = kern.s.map((n) => (Number.isFinite(n) ? n : 0));
  stand.partie = Number.isFinite(kern.p) ? kern.p : 1;
  return stand;
}

/** Neue Partie: Meere leer, Punkte bleiben. Der Verlierer beginnt. */
export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.meere = [leeresMeer(stand.regeln), leeresMeer(stand.regeln)];
  stand.dran = beginnt;
  stand.waffen = [0, 1].map(() => ({ ...(stand.regeln.waffen ? WAFFEN_VOLL : WAFFEN_LEER) }));
  stand.salve = [];
  stand.aussetzen = [0, 0];
  stand.letzterSchuss = null;
  stand.letzteWaffe = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}
