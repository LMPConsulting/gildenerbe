// Galgenmännchen — Spiellogik ohne DOM. Alles serialisierbar.
//
// Eine Runde: einer stellt ein Wort (oder das Handy zieht eins), der andere rät
// Buchstaben. Jeder Fehlgriff zeichnet ein Teil am Galgen. Danach wird
// getauscht. Die Punkte laufen über den ganzen Urlaub weiter.

import { KATEGORIEN, WOERTER, ALLE } from './woerter.js';

export const SAVE_VERSION = 1;

/** Die elf Teile der Zeichnung, in genau dieser Reihenfolge. */
export const TEILE = [
  'boden', 'pfosten', 'querbalken', 'strebe', 'seil',
  'kopf', 'rumpf', 'armLinks', 'armRechts', 'beinLinks', 'beinRechts',
];

// Schwierigkeit heißt hier: wie viel vom Galgen schon steht, bevor es losgeht.
// „Schwer“ beginnt mit fertigem Gerüst — es bleiben sieben Fehlgriffe.
export const STUFEN = {
  leicht: { titel: 'Leicht', unter: '11 Fehler — der Galgen wird erst gebaut', vorab: 0 },
  normal: { titel: 'Normal', unter: '9 Fehler — Boden und Pfosten stehen', vorab: 2 },
  schwer: { titel: 'Schwer', unter: '7 Fehler — der Galgen steht komplett', vorab: 4 },
};

export const BUCHSTABEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'.split('');

/** Vokale — nur die Fassung „Vokale kosten" interessiert sich dafür. */
export const VOKALE = ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü'];

export const VORGABE = {
  vokaleKosten: false,   // A, E, I, O, U kosten auch bei einem Treffer
  doppelwort: false,     // das Handy zieht zwei Wörter statt einem
  tippZeigen: true,      // den Tipp bzw. die Wortliste anzeigen
};

export const MODI = [
  {
    id: 'klassisch',
    titel: 'Klassisch',
    zeile: 'Ein Wort, Schwierigkeit im Menü einstellbar',
    regeln: {},
  },
  {
    id: 'hart',
    titel: 'Hart',
    zeile: 'Nur sieben Fehler — und keine Tipps',
    regeln: { tippZeigen: false },
    stufe: 'schwer',
  },
  {
    id: 'vokale',
    titel: 'Vokale kosten',
    zeile: 'A, E, I, O, U kosten einen Fehler — auch wenn sie drin sind',
    regeln: { vokaleKosten: true },
  },
  {
    id: 'doppelwort',
    titel: 'Doppelwort',
    zeile: 'Zwei Wörter auf einmal, ein einziger Strichvorrat',
    regeln: { doppelwort: true },
  },
];

/**
 * Regel lesen, mit Rückfall auf die Vorgabe. Ein Spielstand von vor den
 * Fassungen kennt die Schlüssel nicht und soll sich wie der Klassiker
 * verhalten.
 */
export const regel = (stand, name) => {
  const wert = stand && stand.regeln ? stand.regeln[name] : undefined;
  return wert === undefined ? VORGABE[name] : wert;
};

export const PUNKTE = {
  grundGewonnen: 10,     // fürs Erraten überhaupt
  jeUebrigerFehler: 3,   // pro nicht verbrauchtem Fehlversuch
  langesWort: 5,         // Bonus ab 12 Zeichen
  setzerGewinnt: 15,     // Wort nicht erraten — Punkt für den, der es stellte
};

export { KATEGORIEN };

/* ------------------------------------------------------------------ Wörter */

/**
 * Bringt Eingetipptes in die Form, in der gespielt wird: Großbuchstaben,
 * ß wird zu SS (Großschrift kennt kein ß), Mehrfach-Leerzeichen zusammen.
 */
export function normalisieren(roh) {
  return String(roh ?? '')
    .toUpperCase()
    .replace(/ß/g, 'SS')
    .replace(/\s+/g, ' ')
    .trim();
}

const IST_BUCHSTABE = (z) => BUCHSTABEN.includes(z);

/** Alles, was von Anfang an sichtbar bleibt: Leerzeichen und Bindestriche. */
const IST_TRENNER = (z) => z === ' ' || z === '-';

/**
 * Prüft ein selbst gestelltes Wort. Gibt einen Klartext-Grund zurück oder
 * null, wenn es in Ordnung geht.
 */
export function wortPruefen(roh) {
  const wort = normalisieren(roh);
  if (!wort) return 'Da steht noch nichts.';
  const buchstaben = [...wort].filter(IST_BUCHSTABE).length;
  if (buchstaben < 3) return 'Mindestens drei Buchstaben, sonst ist es kein Rätsel.';
  if (wort.length > 24) return 'Höchstens 24 Zeichen — sonst passt es nicht auf den Bildschirm.';
  for (const z of wort) {
    if (!IST_BUCHSTABE(z) && !IST_TRENNER(z)) {
      return `„${z}“ geht nicht — nur Buchstaben, Leerzeichen und Bindestriche.`;
    }
  }
  if (wort.split(' ').length > 3) return 'Höchstens drei Wörter.';
  return null;
}

function mischen(liste, rnd) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Zieht ein Wort aus einer Kategorie („alle“ = quer durch alles). Schon
 * benutzte werden übersprungen; ist alles durch, fängt die Kategorie von vorn
 * an — lieber eine Wiederholung als „keine Wörter mehr“ mitten im Urlaub.
 */
export function wortZiehen(stand, kategorie = 'allerlei', rnd = Math.random) {
  const quelle = kategorie === 'alle'
    ? ALLE
    : (WOERTER[kategorie] || WOERTER.allerlei).map((wort) => ({ wort, kategorie }));
  const frisch = quelle.filter((e) => !stand.benutzt.includes(e.wort));
  const topf = frisch.length ? frisch : quelle;
  if (!frisch.length) stand.benutzt = [];
  const gemischt = mischen(topf, rnd);
  if (!regel(stand, 'doppelwort')) return gemischt[0];

  // Doppelwort: zwei Wörter, durch ein Leerzeichen getrennt. Leerzeichen sind
  // ohnehin Trenner und stehen von Anfang an da — es braucht also keine zweite
  // Runde nebenher, und beide Wörter teilen sich denselben Strichvorrat.
  const zweites = gemischt.find((e) => e.wort !== gemischt[0].wort) || gemischt[0];
  return {
    wort: `${gemischt[0].wort} ${zweites.wort}`,
    kategorie: gemischt[0].kategorie,
    doppelt: [gemischt[0].wort, zweites.wort],
  };
}

/* ------------------------------------------------------------------- Stand */

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}) {
  return {
    v: SAVE_VERSION,
    regeln: { ...VORGABE, ...regeln },
    spieler: namen.map((name) => ({ name })),
    punkte: namen.map(() => 0),
    runde: 1,
    dran: 0,               // wer als Nächstes rät (das Wort stellt der andere)
    stufe: 'normal',
    kategorie: 'allerlei',
    benutzt: [],
    stellt: null,          // wer gerade ein Wort eintippt (nur fürs zweite Handy)
    verlauf: [],
    statistik: { erraten: [0, 0], gescheitert: [0, 0], gestellt: [0, 0] },
    aktuell: null,
  };
}

const anderer = (i) => (i === 0 ? 1 : 0);

/** Wie viele Fehlgriffe diese Stufe zulässt. */
export const erlaubteFehler = (stufe) => TEILE.length - (STUFEN[stufe] || STUFEN.normal).vorab;

/** Das sichtbare Muster: geratene Buchstaben und Trenner, sonst null. */
export function musterBauen(wort, geraten) {
  return [...wort].map((z) => (IST_TRENNER(z) || geraten.includes(z) ? z : null));
}

/* -------------------------------------------------------------- Runde */

/**
 * Startet eine Runde. `wort` kommt entweder vom Mitspieler oder aus der Liste;
 * `setzer` ist -1, wenn das Handy es gezogen hat.
 */
export function rundeStarten(stand, { wort, tipp = '', setzer, rater }) {
  const sauber = normalisieren(wort);
  const fehler = wortPruefen(sauber);
  if (fehler) throw new Error(fehler);
  const erlaubt = erlaubteFehler(stand.stufe);
  stand.aktuell = {
    setzer,
    rater,
    wort: sauber,
    tipp: String(tipp || '').slice(0, 60),
    geraten: [],
    daneben: [],
    fehler: 0,
    erlaubt,
    vorab: (STUFEN[stand.stufe] || STUFEN.normal).vorab,
    muster: musterBauen(sauber, []),
    fertig: null,
    gutschrift: null,
  };
  stand.stellt = null;
  if (setzer >= 0) stand.statistik.gestellt[setzer] += 1;
  // Nur gezogene Wörter merken — die Liste soll Wiederholungen aus dem Vorrat
  // verhindern. Selbst ausgedachte gehören da nicht hinein.
  if (setzer < 0 && !stand.benutzt.includes(sauber)) stand.benutzt.push(sauber);
  return stand.aktuell;
}

/** Wie viele Teile der Zeichnung gerade zu sehen sind. */
export const gezeichnet = (r) => (r ? r.vorab + r.fehler : 0);

/** Steht der Buchstabe noch zur Wahl? */
export function offen(runde, buchstabe) {
  return !!runde && !runde.fertig && !runde.geraten.includes(buchstabe)
    && !runde.daneben.includes(buchstabe);
}

/**
 * Ein Buchstabe wird geraten. Gibt zurück, was passiert ist:
 * `{ treffer, fertig }` — oder null, wenn der Zug gar nicht zulässig war.
 */
export function raten(stand, buchstabe) {
  const r = stand.aktuell;
  const b = normalisieren(buchstabe);
  if (!r || r.fertig || !IST_BUCHSTABE(b) || !offen(r, b)) return null;

  const treffer = r.wort.includes(b);
  // „Vokale kosten": ein Vokal zieht auch dann einen Fehler nach sich, wenn er
  // im Wort steht. Man muss also mit Konsonanten anfangen.
  const kostet = regel(stand, 'vokaleKosten') && VOKALE.includes(b);
  if (treffer) {
    r.geraten.push(b);
    r.muster = musterBauen(r.wort, r.geraten);
    if (kostet) r.fehler += 1;
    if (r.muster.every((z) => z !== null)) beenden(stand, 'gewonnen');
    else if (kostet && r.fehler >= r.erlaubt) beenden(stand, 'verloren');
  } else {
    r.daneben.push(b);
    r.fehler += 1;
    if (r.fehler >= r.erlaubt) beenden(stand, 'verloren');
  }
  return { treffer, kostet, fertig: r.fertig };
}

/**
 * Das ganze Wort auf einmal. Falsch geraten kostet einen Fehlversuch —
 * sonst wäre Durchprobieren gratis.
 */
export function wortRaten(stand, versuch) {
  const r = stand.aktuell;
  if (!r || r.fertig) return null;
  const v = normalisieren(versuch);
  if (!v) return null;
  if (v === r.wort) {
    r.geraten = [...new Set([...r.geraten, ...[...r.wort].filter(IST_BUCHSTABE)])];
    r.muster = musterBauen(r.wort, r.geraten);
    beenden(stand, 'gewonnen');
    return { treffer: true, fertig: r.fertig };
  }
  r.fehler += 1;
  if (r.fehler >= r.erlaubt) beenden(stand, 'verloren');
  return { treffer: false, fertig: r.fertig };
}

/** Der Rater gibt auf — zählt wie verloren. */
export function aufgeben(stand) {
  const r = stand.aktuell;
  if (!r || r.fertig) return null;
  r.fehler = r.erlaubt;
  beenden(stand, 'verloren');
  return r.fertig;
}

/** Punkte einer beendeten Runde, ohne sie schon gutzuschreiben. */
export function punkteFuer(runde) {
  const gut = [0, 0];
  if (!runde || !runde.fertig) return gut;
  if (runde.fertig === 'gewonnen') {
    const uebrig = Math.max(0, runde.erlaubt - runde.fehler);
    const lang = [...runde.wort].filter(IST_BUCHSTABE).length >= 12 ? PUNKTE.langesWort : 0;
    gut[runde.rater] = PUNKTE.grundGewonnen + uebrig * PUNKTE.jeUebrigerFehler + lang;
  } else if (runde.setzer >= 0) {
    gut[runde.setzer] = PUNKTE.setzerGewinnt;
  }
  return gut;
}

function beenden(stand, wie) {
  const r = stand.aktuell;
  r.fertig = wie;
  r.gutschrift = punkteFuer(r);
  if (wie === 'gewonnen') stand.statistik.erraten[r.rater] += 1;
  else stand.statistik.gescheitert[r.rater] += 1;
}

/**
 * Runde abhaken: Punkte buchen, Rollen tauschen, Zähler weiter.
 * Danach ist `aktuell` leer und die nächste Runde kann gestellt werden.
 */
export function rundeAbschliessen(stand) {
  const r = stand.aktuell;
  if (!r || !r.fertig) return stand;
  const gut = r.gutschrift || punkteFuer(r);
  stand.punkte = stand.punkte.map((p, i) => p + (gut[i] || 0));
  stand.verlauf.unshift({
    runde: stand.runde,
    wort: r.wort,
    rater: r.rater,
    setzer: r.setzer,
    fertig: r.fertig,
    fehler: r.fehler,
    gutschrift: gut,
  });
  stand.verlauf = stand.verlauf.slice(0, 40);
  stand.runde += 1;
  stand.dran = anderer(r.rater);
  stand.aktuell = null;
  return stand;
}

/** Runde wegwerfen, ohne dass jemand Punkte bekommt. */
export function rundeAbbrechen(stand) {
  stand.aktuell = null;
  return stand;
}

/** Wer führt? `{ index, vorsprung }` oder null bei Gleichstand. */
export function fuehrung(stand) {
  const [a, b] = stand.punkte;
  if (a === b) return null;
  return a > b ? { index: 0, vorsprung: a - b } : { index: 1, vorsprung: b - a };
}

/* --------------------------------------------------- Punktestand mitnehmen */

/** Kurzcode für den Punktestand — zum Sichern oder auf ein anderes Handy. */
export function alsCode(stand) {
  const kern = {
    v: SAVE_VERSION,
    n: stand.spieler.map((s) => s.name),
    p: stand.punkte,
    r: stand.runde,
    d: stand.dran,
    s: stand.statistik,
  };
  return `HMS1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

/** Kurzcode zurück in einen Spielstand. Wirft bei Unsinn. */
export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('HMS1-')) throw new Error('Das ist kein Galgenmännchen-Punktestand.');
  let kern;
  try {
    kern = JSON.parse(decodeURIComponent(escape(atob(roh.slice(5)))));
  } catch {
    throw new Error('Der Code ist unvollständig oder verrutscht.');
  }
  if (!kern || !Array.isArray(kern.p) || kern.p.length !== 2) {
    throw new Error('Der Code passt nicht zu diesem Spiel.');
  }
  const stand = neuerStand(Array.isArray(kern.n) && kern.n.length === 2 ? kern.n : undefined);
  stand.punkte = kern.p.map((n) => (Number.isFinite(n) ? n : 0));
  stand.runde = Number.isFinite(kern.r) ? kern.r : 1;
  stand.dran = kern.d === 1 ? 1 : 0;
  if (kern.s && Array.isArray(kern.s.erraten)) stand.statistik = kern.s;
  return stand;
}
