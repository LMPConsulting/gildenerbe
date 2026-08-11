// Cabo — Spiellogik ohne DOM. Alles serialisierbar (localStorage-tauglich).

// 52 Karten: 0 und 13 je zweimal, 1 bis 12 je viermal.
export const DECK_AUFBAU = [[0, 2], [13, 2], ...Array.from({ length: 12 }, (_, i) => [i + 1, 4])];

export const KRAEFTE = {
  peek: { titel: 'Peek', werte: [7, 8], text: 'Sieh dir eine eigene Karte an.' },
  spy: { titel: 'Spy', werte: [9, 10], text: 'Sieh dir eine Karte einer anderen Person an.' },
  swap: { titel: 'Swap', werte: [11, 12], text: 'Tausche eine eigene Karte blind gegen eine fremde.' },
};

export const HANDGROESSE = 4;
export const START_ANSEHEN = 2;      // die beiden unteren Karten
export const CABO_STRAFE = 5;
export const SPIELENDE_AB = 100;
export const HALBIERUNG_BEI = 100;   // genau 100 wird zu 50

export function kraftVon(wert) {
  for (const [art, k] of Object.entries(KRAEFTE)) if (k.werte.includes(wert)) return art;
  return null;
}

export function neuesDeck() {
  const deck = [];
  let n = 0;
  for (const [wert, anzahl] of DECK_AUFBAU) {
    for (let i = 0; i < anzahl; i++) deck.push({ id: `k${n++}`, w: wert });
  }
  return deck;
}

export function mischen(liste, rnd = Math.random) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const naechster = (i, n) => (i + 1) % n;

export function neuesSpiel(namen = ['Monty', 'Christina']) {
  return {
    v: 1,
    spieler: namen.map((name) => ({ name, hand: [] })),
    punkte: namen.map(() => 0),
    runde: 1,
    geber: 0,
    dran: 0,
    stapel: [],
    ablage: [],
    phase: 'aus',       // 'aus' | 'einpraegen' | 'zug' | 'gezogen' | 'kraft' | 'auswertung' | 'ende'
    gezogene: null,
    quelle: null,       // 'stapel' | 'ablage'
    kraft: null,        // { art, eigene: index|null }
    caboVon: null,
    restZuege: null,
    einpraegenIndex: 0,
    aufdecken: null,    // { wer, index, karte, text }
    auswertung: null,
    verlauf: [],
  };
}

/* ------------------------------------------------------------ Runde starten */

export function neueRunde(s, rnd = Math.random) {
  const n = s.spieler.length;
  const deck = mischen(neuesDeck(), rnd);
  for (const p of s.spieler) p.hand = deck.splice(0, HANDGROESSE);
  s.ablage = [deck.pop()];
  s.stapel = deck;

  s.phase = 'einpraegen';
  s.einpraegenIndex = 0;
  s.dran = naechster(s.geber, n);   // links vom Geber beginnt
  s.gezogene = null;
  s.quelle = null;
  s.kraft = null;
  s.caboVon = null;
  s.restZuege = null;
  s.aufdecken = null;
  s.auswertung = null;
  return s;
}

/** Die Karten, die man sich zu Beginn ansehen darf: die beiden unteren. */
export function startKarten(s, wer) {
  const hand = s.spieler[wer].hand;
  return Array.from({ length: START_ANSEHEN }, (_, i) => HANDGROESSE - START_ANSEHEN + i)
    .map((index) => ({ index, karte: hand[index] }));
}

export function einpraegenFertig(s) {
  s.einpraegenIndex += 1;
  if (s.einpraegenIndex >= s.spieler.length) {
    s.einpraegenIndex = 0;
    s.phase = 'zug';
  }
  return s;
}

/* ------------------------------------------------------------------- Zug */

/** Ist der Nachziehstapel leer, wandert die Ablage bis auf die oberste Karte zurück. */
function stapelAuffuellen(s, rnd) {
  if (s.stapel.length > 0 || s.ablage.length <= 1) return;
  const oben = s.ablage.pop();
  s.stapel = mischen(s.ablage, rnd);
  s.ablage = [oben];
}

export function obenAufAblage(s) {
  return s.ablage.length ? s.ablage[s.ablage.length - 1] : null;
}

export function ziehen(s, quelle, rnd = Math.random) {
  if (s.phase !== 'zug') return s;
  if (quelle === 'ablage') {
    if (!s.ablage.length) return s;
    s.gezogene = s.ablage.pop();
  } else {
    stapelAuffuellen(s, rnd);
    if (!s.stapel.length) return s;
    s.gezogene = s.stapel.pop();
  }
  s.quelle = quelle;
  s.phase = 'gezogen';
  return s;
}

/** Gezogene Karte gegen eine eigene tauschen. Die alte Karte kommt offen auf die Ablage. */
export function tauschen(s, index) {
  if (s.phase !== 'gezogen') return s;
  const hand = s.spieler[s.dran].hand;
  if (index < 0 || index >= hand.length) return s;
  const raus = hand[index];
  hand[index] = s.gezogene;
  s.ablage.push(raus);
  s.gezogene = null;
  s.quelle = null;
  return zugEnde(s);
}

/** Gezogene Karte abwerfen. Nur vom Stapel erlaubt, und nur so gibt es Kräfte. */
export function abwerfen(s) {
  if (s.phase !== 'gezogen' || s.quelle !== 'stapel') return s;
  const karte = s.gezogene;
  s.ablage.push(karte);
  s.gezogene = null;
  s.quelle = null;

  const art = kraftVon(karte.w);
  if (art) {
    s.kraft = { art, eigene: null };
    s.phase = 'kraft';
    return s;
  }
  return zugEnde(s);
}

/* ------------------------------------------------------------------ Kräfte */

export function kraftAuslassen(s) {
  if (s.phase !== 'kraft') return s;
  s.kraft = null;
  return zugEnde(s);
}

/** Peek: eigene Karte ansehen. */
export function peek(s, index) {
  if (s.phase !== 'kraft' || s.kraft.art !== 'peek') return s;
  s.aufdecken = { wer: s.dran, index, karte: s.spieler[s.dran].hand[index], text: 'Deine Karte' };
  s.kraft.erledigt = true;
  return s;
}

/** Spy: fremde Karte ansehen. */
export function spy(s, wer, index) {
  if (s.phase !== 'kraft' || s.kraft.art !== 'spy' || wer === s.dran) return s;
  s.aufdecken = {
    wer, index, karte: s.spieler[wer].hand[index],
    text: `Karte von ${s.spieler[wer].name}`,
  };
  s.kraft.erledigt = true;
  return s;
}

/** Swap, Schritt 1: eigene Karte vormerken. */
export function swapEigene(s, index) {
  if (s.phase !== 'kraft' || s.kraft.art !== 'swap') return s;
  s.kraft.eigene = s.kraft.eigene === index ? null : index;
  return s;
}

/** Swap, Schritt 2: fremde Karte wählen — getauscht wird blind. */
export function swapFremde(s, wer, index) {
  if (s.phase !== 'kraft' || s.kraft.art !== 'swap') return s;
  if (s.kraft.eigene === null || wer === s.dran) return s;
  const meine = s.spieler[s.dran].hand;
  const deine = s.spieler[wer].hand;
  const i = s.kraft.eigene;
  [meine[i], deine[index]] = [deine[index], meine[i]];
  s.kraft = null;
  return zugEnde(s);
}

/** Eine Enthüllung wegtippen. Danach ist der Zug vorbei. */
export function aufdeckenSchliessen(s) {
  if (!s.aufdecken) return s;
  s.aufdecken = null;
  if (s.phase === 'kraft') return zugEnde(s);
  return s;
}

/* -------------------------------------------------------------------- Cabo */

export function caboRufen(s) {
  if (s.phase !== 'zug' || s.caboVon !== null) return s;
  s.caboVon = s.dran;
  s.restZuege = s.spieler.length - 1;   // alle anderen bekommen genau einen Zug
  return zugEnde(s, true);
}

function zugEnde(s, warCabo = false) {
  s.kraft = null;
  s.gezogene = null;
  s.quelle = null;

  if (s.caboVon !== null && !warCabo) {
    s.restZuege -= 1;
    if (s.restZuege <= 0) return auswerten(s);
  }
  s.dran = naechster(s.dran, s.spieler.length);
  s.phase = 'zug';
  return s;
}

/* --------------------------------------------------------------- Auswertung */

export function handSumme(spieler) {
  return spieler.hand.reduce((sum, k) => sum + k.w, 0);
}

export function auswerten(s) {
  const summen = s.spieler.map(handSumme);
  const niedrigste = Math.min(...summen);
  const rufer = s.caboVon;
  // Bei Gleichstand gewinnt, wer Cabo gerufen hat.
  const caboGeglueckt = rufer !== null && summen[rufer] <= niedrigste;

  const zeilen = s.spieler.map((p, i) => {
    if (rufer === i) {
      return caboGeglueckt
        ? { p: i, summe: summen[i], punkte: 0, text: 'Cabo gerufen und behalten' }
        : { p: i, summe: summen[i], punkte: summen[i] + CABO_STRAFE, text: `Cabo verpatzt — ${summen[i]} + ${CABO_STRAFE}` };
    }
    return { p: i, summe: summen[i], punkte: summen[i], text: 'Kartenwert' };
  });

  for (const z of zeilen) s.punkte[z.p] += z.punkte;

  // Genau 100 ist ein Geschenk: zurück auf 50.
  for (let i = 0; i < s.punkte.length; i++) {
    if (s.punkte[i] === HALBIERUNG_BEI) s.punkte[i] = HALBIERUNG_BEI / 2;
  }

  s.auswertung = { zeilen, caboVon: rufer, caboGeglueckt, niedrigste };
  s.verlauf.unshift({
    runde: s.runde,
    caboVon: rufer,
    caboGeglueckt,
    punkte: zeilen.map((z) => z.punkte),
    summen,
  });
  if (s.verlauf.length > 100) s.verlauf.length = 100;

  s.phase = Math.max(...s.punkte) >= SPIELENDE_AB ? 'ende' : 'auswertung';
  return s;
}

export function naechsteRunde(s, rnd = Math.random) {
  if (s.phase !== 'auswertung') return s;
  s.runde += 1;
  s.geber = naechster(s.geber, s.spieler.length);
  return neueRunde(s, rnd);
}

export function endstand(s) {
  return s.spieler
    .map((p, i) => ({ index: i, name: p.name, punkte: s.punkte[i] }))
    .sort((a, b) => a.punkte - b.punkte);
}

/** Wer muss das Handy in der Hand haben? */
export function amZug(s) {
  if (s.phase === 'einpraegen') return s.einpraegenIndex;
  if (s.phase === 'zug' || s.phase === 'gezogen' || s.phase === 'kraft') return s.dran;
  return null;
}
