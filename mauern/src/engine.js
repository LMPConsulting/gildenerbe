// Mauern — Spiellogik ohne DOM. Alles serialisierbar.
//
// Nach dem Vorbild von Quoridor (Gigamic, Mirko Marchesi, 1997) — das Spiel,
// das auf barricade.gg gespielt wird. Regeln sind frei; Name und Gestaltung
// nicht, deshalb heißt es hier Mauern.
//
// Mit den Sperrsteinen hat es nur das Wort gemeinsam: kein Würfel, eine
// einzige Figur je Seite, und in jedem Zug entweder **ein Feld gehen** oder
// **eine Mauer bauen**. Wer zuerst die gegenüberliegende Reihe erreicht,
// gewinnt.
//
// Die Fugen: eine Mauer ist zwei Felder lang und sitzt zwischen den Feldern.
// Sie wird über ihre linke obere Fuge (r, c) angesprochen, mit
// 0 ≤ r, c ≤ groesse − 2:
//
//   waagerecht bei (r,c)  trennt (r,c)|(r+1,c)  und  (r,c+1)|(r+1,c+1)
//   senkrecht  bei (r,c)  trennt (r,c)|(r,c+1)  und  (r+1,c)|(r+1,c+1)
//
// Die wichtigste Regel im ganzen Spiel ist die Wegregel: eine Mauer darf
// niemals die letzte Verbindung einer Seite zu ihrer Zielreihe kappen. Ohne
// sie wäre das Spiel kaputt — man mauerte die Gegenseite einfach ein. Sie wird
// vor jedem Setzen mit einer Breitensuche geprüft, für **beide** Seiten.

export const SAVE_VERSION = 1;

export const VORGABE = {
  groesse: 9,        // Kantenlänge des Bretts
  mauern: 10,        // Mauern je Seite
  wettlauf: false,   // beide starten nebeneinander und wollen zur selben Reihe
};

export const MODI = [
  {
    id: 'klassisch',
    titel: 'Klassisch',
    zeile: '9 × 9, zehn Mauern, gegenüberliegende Seiten',
    regeln: {},
  },
  {
    id: 'kurz',
    titel: 'Kurz',
    zeile: '7 × 7 und sieben Mauern — für zwischendurch',
    regeln: { groesse: 7, mauern: 7 },
  },
  {
    id: 'wettlauf',
    titel: 'Wettlauf',
    zeile: 'Beide starten nebeneinander und wollen auf dieselbe Seite',
    regeln: { wettlauf: true },
  },
  {
    id: 'sparsam',
    titel: 'Sparsam',
    zeile: 'Großes Brett, nur fünf Mauern — fast ein Wettrennen',
    regeln: { mauern: 5 },
  },
  {
    id: 'festung',
    titel: 'Festung',
    zeile: 'Vierzehn Mauern je Seite — jeder Weg wird zum Labyrinth',
    regeln: { mauern: 14 },
  },
];

// Ausprobiert und wieder verworfen: ein Modus **ohne Springen**, in dem die
// Figuren einander wie Mauern blockieren. Er ist eine bekannte Hausregel, aber
// gemessen gewinnt die anziehende Seite 71 % der Partien: ohne Sprung müssen
// zwei Figuren einander frontal ausweichen, und wer ausweichen muss, entscheidet
// allein die Zugparität. Ein Modus, den der Anwurf zu zwei Dritteln entscheidet,
// ist kein besseres Spiel, sondern ein schlechteres.

const anderer = (i) => (i === 0 ? 1 : 0);

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}) {
  const r = { ...VORGABE, ...regeln };
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    regeln: r,
    figuren: startfelder(r),
    ziele: zielreihen(r),
    mauern: [],
    vorrat: [r.mauern, r.mauern],
    dran: 0,
    siege: [0, 0],
    partie: 1,
    letzteAktion: null,
    fertig: null,
  };
}

/** Wo beide beginnen. Im Wettlauf nebeneinander auf derselben Grundreihe. */
function startfelder(r) {
  const n = r.groesse;
  const mitte = (n - 1) / 2;
  if (r.wettlauf) {
    return [{ r: n - 1, c: mitte - 1 }, { r: n - 1, c: mitte + 1 }];
  }
  return [{ r: n - 1, c: mitte }, { r: 0, c: mitte }];
}

/** Welche Reihe jede Seite erreichen muss. Im Wettlauf für beide dieselbe. */
function zielreihen(r) {
  return r.wettlauf ? [0, 0] : [0, r.groesse - 1];
}

/* ---------------------------------------------------------------- Abfragen */

// `fertig` ist der Index des Siegers und darf 0 sein — nie auf Wahrheit prüfen.
export const vorbei = (stand) => stand.fertig !== null;
export const gewinner = (stand) => stand.fertig;
export const mauernUebrig = (stand, spieler) => stand.vorrat[spieler];

const imBrett = (stand, r, c) =>
  r >= 0 && c >= 0 && r < stand.regeln.groesse && c < stand.regeln.groesse;

const hatMauer = (stand, r, c, a) =>
  stand.mauern.some((m) => m.r === r && m.c === c && m.a === a);

/**
 * Steht zwischen zwei benachbarten Feldern eine Mauer?
 *
 * Jede Kante wird von zwei möglichen Mauern versperrt — die Mauer ist zwei
 * Felder lang, also kann sie mit ihrer linken oder ihrer rechten Hälfte hier
 * liegen. Genau das ist die Stelle, an der man sich beim Nachbauen leicht
 * vertut.
 */
export function versperrt(stand, von, nach) {
  const dr = nach.r - von.r;
  const dc = nach.c - von.c;
  if (dr === 1) return hatMauer(stand, von.r, von.c, 'waagerecht')
    || hatMauer(stand, von.r, von.c - 1, 'waagerecht');
  if (dr === -1) return hatMauer(stand, nach.r, von.c, 'waagerecht')
    || hatMauer(stand, nach.r, von.c - 1, 'waagerecht');
  if (dc === 1) return hatMauer(stand, von.r, von.c, 'senkrecht')
    || hatMauer(stand, von.r - 1, von.c, 'senkrecht');
  if (dc === -1) return hatMauer(stand, von.r, nach.c, 'senkrecht')
    || hatMauer(stand, von.r - 1, nach.c, 'senkrecht');
  return true;                                   // kein Nachbarfeld
}

/** Erreichbare Nachbarfelder ohne Rücksicht auf Figuren — für die Wegsuche. */
function nachbarn(stand, feld) {
  const raus = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const n = { r: feld.r + dr, c: feld.c + dc };
    if (imBrett(stand, n.r, n.c) && !versperrt(stand, feld, n)) raus.push(n);
  }
  return raus;
}

/* --------------------------------------------------------------- Wegsuche */

/**
 * Kürzester Weg dieser Seite zu ihrer Zielreihe, in Schritten.
 * `Infinity`, wenn es keinen gibt. Figuren werden dabei ignoriert — eine
 * Figur kann übersprungen werden und versperrt darum nie dauerhaft.
 */
export function wegLaenge(stand, spieler) {
  const ziel = stand.ziele[spieler];
  const start = stand.figuren[spieler];
  if (start.r === ziel) return 0;
  const n = stand.regeln.groesse;
  const gesehen = new Uint8Array(n * n);
  let welle = [start];
  gesehen[start.r * n + start.c] = 1;
  let schritte = 0;
  while (welle.length) {
    schritte += 1;
    const naechste = [];
    for (const feld of welle) {
      for (const nb of nachbarn(stand, feld)) {
        const i = nb.r * n + nb.c;
        if (gesehen[i]) continue;
        if (nb.r === ziel) return schritte;
        gesehen[i] = 1;
        naechste.push(nb);
      }
    }
    welle = naechste;
  }
  return Infinity;
}

/* ----------------------------------------------------------- Züge finden */

/**
 * Wohin darf die Figur, die dran ist?
 *
 * Auf die Gegenfigur nie. Steht sie im Weg, springt man über sie hinweg;
 * geht das nicht (Mauer oder Rand dahinter), weicht man schräg an ihr vorbei.
 * Im Modus „Ohne Sprung" entfällt beides und die Figur blockiert schlicht.
 */
export function zuege(stand) {
  if (vorbei(stand)) return [];
  const ich = stand.figuren[stand.dran];
  const du = stand.figuren[anderer(stand.dran)];
  const raus = [];
  const merken = (f) => {
    if (!raus.some((x) => x.r === f.r && x.c === f.c)) raus.push(f);
  };

  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nah = { r: ich.r + dr, c: ich.c + dc };
    if (!imBrett(stand, nah.r, nah.c) || versperrt(stand, ich, nah)) continue;
    if (nah.r !== du.r || nah.c !== du.c) { merken(nah); continue; }

    const weit = { r: nah.r + dr, c: nah.c + dc };
    if (imBrett(stand, weit.r, weit.c) && !versperrt(stand, nah, weit)) {
      merken(weit);                                    // gerade darüber hinweg
      continue;
    }
    // Dahinter geht es nicht weiter — also schräg an der Gegenfigur vorbei.
    for (const [qr, qc] of dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]]) {
      const schraeg = { r: nah.r + qr, c: nah.c + qc };
      if (imBrett(stand, schraeg.r, schraeg.c) && !versperrt(stand, nah, schraeg)) {
        merken(schraeg);
      }
    }
  }
  return raus;
}

export const ziehbar = (stand, r, c) => zuege(stand).some((z) => z.r === r && z.c === c);

export function ziehen(stand, r, c) {
  if (!ziehbar(stand, r, c)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const spieler = stand.dran;
  stand.figuren[spieler] = { r, c };
  stand.letzteAktion = { art: 'gezogen', spieler, r, c };

  if (r === stand.ziele[spieler]) {
    stand.fertig = spieler;
    stand.siege[spieler] += 1;
    stand.letzteAktion = { art: 'gewonnen', spieler, r, c };
    return stand;
  }
  stand.dran = anderer(spieler);
  return stand;
}

/* ------------------------------------------------------------------ Mauern */

/**
 * Darf hier eine Mauer stehen?
 *
 * Vier Bedingungen: im Gitter, Vorrat da, keine Überschneidung — und die
 * Wegregel. Die letzte kostet zwei Breitensuchen und ist trotzdem die
 * billigste Stelle, sie zu prüfen.
 */
export function mauerErlaubt(stand, r, c, a) {
  if (vorbei(stand)) return false;
  if (a !== 'waagerecht' && a !== 'senkrecht') return false;
  const grenze = stand.regeln.groesse - 1;
  if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
  if (r < 0 || c < 0 || r >= grenze || c >= grenze) return false;
  if (mauernUebrig(stand, stand.dran) <= 0) return false;

  // Dieselbe Fuge ist belegt — gleiche Richtung oder gekreuzt.
  if (stand.mauern.some((m) => m.r === r && m.c === c)) return false;
  // Gleiche Richtung, um ein Feld versetzt: die beiden überlappen sich.
  if (a === 'waagerecht' && (hatMauer(stand, r, c - 1, a) || hatMauer(stand, r, c + 1, a))) return false;
  if (a === 'senkrecht' && (hatMauer(stand, r - 1, c, a) || hatMauer(stand, r + 1, c, a))) return false;

  const probe = { ...stand, mauern: [...stand.mauern, { r, c, a }] };
  return Number.isFinite(wegLaenge(probe, 0)) && Number.isFinite(wegLaenge(probe, 1));
}

export function mauerZuege(stand) {
  if (vorbei(stand) || mauernUebrig(stand, stand.dran) <= 0) return [];
  const raus = [];
  const grenze = stand.regeln.groesse - 1;
  for (let r = 0; r < grenze; r++) {
    for (let c = 0; c < grenze; c++) {
      for (const a of ['waagerecht', 'senkrecht']) {
        if (mauerErlaubt(stand, r, c, a)) raus.push({ r, c, a });
      }
    }
  }
  return raus;
}

export function mauerSetzen(stand, r, c, a) {
  if (!mauerErlaubt(stand, r, c, a)) throw new Error('Dort darf keine Mauer stehen.');
  const spieler = stand.dran;
  stand.mauern = [...stand.mauern, { r, c, a }];
  stand.vorrat[spieler] -= 1;
  stand.letzteAktion = { art: 'gemauert', spieler, r, c, a };
  stand.dran = anderer(spieler);
  return stand;
}

/* --------------------------------------------------------- Neue Partie */

export function partieNeu(stand) {
  const beginnt = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  stand.figuren = startfelder(stand.regeln);
  stand.ziele = zielreihen(stand.regeln);
  stand.mauern = [];
  stand.vorrat = [stand.regeln.mauern, stand.regeln.mauern];
  stand.dran = beginnt;
  stand.letzteAktion = null;
  stand.fertig = null;
  stand.partie += 1;
  return stand;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = {
    v: SAVE_VERSION, n: stand.spieler.map((s) => s.name),
    s: stand.siege, p: stand.partie, r: stand.regeln,
  };
  return `MAU1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('MAU1-')) throw new Error('Das ist kein Mauern-Punktestand.');
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
