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
  sechsNoetig: true,   // wenn aus: jede Augenzahl bringt aus der Basis heraus
  zweiWuerfel: false,  // wenn an: zwei Würfel werfen und einen davon benutzen
};

/**
 * Die Fassungen. Was hier steht, landet als `regeln` im Spielstand — dadurch
 * reist die gewählte Fassung beim Koppeln von selbst mit, ohne eine einzige
 * zusätzliche Nachricht.
 */
export const MODI = [
  {
    id: 'klassisch',
    titel: 'Klassisch',
    zeile: 'Vier Figuren, nur mit einer Sechs heraus',
    regeln: {},
  },
  {
    id: 'blitz',
    titel: 'Blitz',
    zeile: 'Zwei Figuren, jede Zahl bringt heraus — halbe Spielzeit',
    regeln: { figuren: 2, sechsNoetig: false },
  },
  {
    id: 'boesartig',
    titel: 'Bösartig',
    zeile: 'Schlagen ist Pflicht — wer kann, muss',
    regeln: { mussSchlagen: true },
  },
  {
    id: 'zweiWuerfel',
    titel: 'Zwei Würfel',
    zeile: 'Beide werfen, einen davon benutzen — viel mehr zu entscheiden',
    regeln: { zweiWuerfel: true },
  },
];

/** Absolutes Feld auf dem Ring für eine Figur dieses Spielers. */
export const feldVon = (spieler, schritt) => (START[spieler] + schritt) % RING;

const anderer = (i) => (i === 0 ? 1 : 0);

/**
 * Eine Regel lesen — mit Rückfall auf die Vorgabe.
 *
 * Nicht bloß Vorsicht: ein Spielstand, der vor dieser Fassung gespeichert
 * wurde, kennt die neuen Schlüssel nicht. Würde man direkt `stand.regeln.x`
 * lesen, käme `undefined` heraus, und aus „Sechs nötig" würde stillschweigend
 * „jede Zahl bringt heraus". Ein altes Spiel darf sich nicht plötzlich anders
 * verhalten, nur weil ein Schlüssel dazugekommen ist.
 */
const regel = (stand, name) => {
  const wert = stand.regeln ? stand.regeln[name] : undefined;
  return wert === undefined ? VORGABE[name] : wert;
};

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}) {
  const r = { ...VORGABE, ...regeln };
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    figuren: [0, 1].map(() => Array.from({ length: r.figuren }, () => ({ ort: 'basis', schritt: 0 }))),
    dran: 0,
    wurf: null,
    offen: [],           // bei zwei Würfeln: die beiden Zahlen zur Auswahl
    wuerfeUebrig: r.zweiWuerfel ? 2 : 3,
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

/**
 * Wie oft darf dieser Spieler werfen?
 *
 * Die drei Würfe gibt es nur, weil man ohne Sechs nicht aus der Basis kommt.
 * Fällt diese Hürde weg (Blitz), fällt auch der Grund weg. Mit zwei Würfeln
 * hat man je Wurf schon zwei Chancen — dann reichen zwei.
 */
export function wuerfeErlaubt(stand, spieler) {
  if (!regel(stand, 'sechsNoetig')) return 1;
  if (stand.figuren[spieler].some((f) => f.ort === 'bahn')) return 1;
  return regel(stand, 'zweiWuerfel') ? 2 : 3;
}

/** Die noch nicht gewählten Zahlen — nur bei zwei Würfeln je etwas darin. */
export const offeneWuerfe = (stand) => stand.offen || [];

/* --------------------------------------------------------------- Würfeln */

export function wuerfeln(stand, rnd = Math.random) {
  if (stand.fertig !== null) throw new Error('Die Partie ist vorbei.');
  if (offeneWuerfe(stand).length) throw new Error('Erst eine der beiden Zahlen wählen.');
  if (stand.wurf !== null) throw new Error('Der Wurf ist noch nicht gezogen.');
  if (stand.wuerfeUebrig <= 0) throw new Error('Keine Würfe mehr in diesem Zug.');
  stand.wuerfeUebrig -= 1;

  if (regel(stand, 'zweiWuerfel')) {
    stand.offen = [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];
    stand.letzteAktion = { art: 'gewuerfelt', spieler: stand.dran, offen: [...stand.offen] };
    return stand.offen;
  }
  stand.wurf = 1 + Math.floor(rnd() * 6);
  stand.letzteAktion = { art: 'gewuerfelt', spieler: stand.dran, wurf: stand.wurf };
  return stand.wurf;
}

/** Eine der beiden geworfenen Zahlen nehmen. Die andere verfällt. */
export function wurfWaehlen(stand, nummer) {
  const offen = offeneWuerfe(stand);
  if (!offen.length) throw new Error('Es liegt keine Wahl an.');
  if (!Number.isInteger(nummer) || nummer < 0 || nummer >= offen.length) {
    throw new Error('Diese Zahl wurde nicht geworfen.');
  }
  stand.wurf = offen[nummer];
  stand.offen = [];
  stand.letzteAktion = { art: 'gewaehlt', spieler: stand.dran, wurf: stand.wurf };
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
    if (regel(stand, 'sechsNoetig') && wurf !== 6) return null;
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
  if (offeneWuerfe(stand).length) return [];       // erst wählen, dann ziehen
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

  // Sechs-Pflicht: erst heraus, sonst das eigene Startfeld frei machen. Ohne
  // die Sechs-Hürde gibt es auch keine Sechs-Pflicht.
  if (regel(stand, 'sechsNoetig') && regel(stand, 'strengeSechs') && wurf === 6
    && eigene.some((f) => f.ort === 'basis')) {
    const raus = alle.filter((z) => z.von.ort === 'basis');
    if (raus.length) return [raus[0]];
    const vomStart = alle.filter((z) => z.von.ort === 'bahn' && z.von.schritt === 0);
    if (vomStart.length) return vomStart;
  }

  if (regel(stand, 'mussSchlagen')) {
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
  stand.offen = [];
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
    Array.from({ length: regel(stand, 'figuren') }, () => ({ ort: 'basis', schritt: 0 })));
  stand.dran = beginnt;
  stand.wurf = null;
  stand.offen = [];
  stand.wuerfeUebrig = wuerfeErlaubt(stand, beginnt);
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
  const stand = neuerStand(
    Array.isArray(kern.n) && kern.n.length === 2 ? kern.n : undefined,
    kern.r && typeof kern.r === 'object' ? kern.r : {},
  );
  stand.siege = kern.s.map((n) => (Number.isFinite(n) ? n : 0));
  stand.partie = Number.isFinite(kern.p) ? kern.p : 1;
  return stand;
}
