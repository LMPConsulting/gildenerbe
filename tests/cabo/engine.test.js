import {
  HANDGROESSE, CABO_STRAFE, SPIELENDE_AB, KRAEFTE,
  neuesDeck, kraftVon, neuesSpiel, neueRunde, startKarten, einpraegenFertig,
  ziehen, tauschen, abwerfen, kraftAuslassen, peek, spy, swapEigene, swapFremde,
  aufdeckenSchliessen, caboRufen, auswerten, handSumme, naechsteRunde, endstand,
  amZug, obenAufAblage,
  paarStarten, paarWaehlen, paarAbbrechen, paarAufdecken, paarBestaetigen,
} from '../../cabo/src/engine.js';

/** Nicht mischen — so weiß der Test, welche Karte wo liegt. */
const ohneZufall = () => 0;

function starte(namen = ['A', 'B']) {
  const s = neuesSpiel(namen);
  s.geber = namen.length - 1;      // damit die erste Person anfängt
  neueRunde(s, ohneZufall);
  while (s.phase === 'einpraegen') einpraegenFertig(s);
  return s;
}

/** Hand direkt setzen, um Wertungen gezielt zu prüfen. */
const setzeHand = (s, p, werte) => {
  s.spieler[p].hand = werte.map((w, i) => ({ id: `t${p}${i}`, w }));
};

describe('Kartendeck', () => {
  it('hat 52 Karten', () => {
    expect(neuesDeck()).toHaveLength(52);
  });

  it('enthält 0 und 13 doppelt, 1 bis 12 je viermal', () => {
    const deck = neuesDeck();
    const zaehle = (w) => deck.filter((k) => k.w === w).length;
    expect(zaehle(0)).toBe(2);
    expect(zaehle(13)).toBe(2);
    for (let w = 1; w <= 12; w++) expect(zaehle(w), `Wert ${w}`).toBe(4);
  });

  it('vergibt eindeutige Karten-ids', () => {
    const ids = neuesDeck().map((k) => k.id);
    expect(new Set(ids).size).toBe(52);
  });
});

describe('Kräfte', () => {
  it('ordnet 7 und 8 dem Peek zu, 9 und 10 dem Spy, 11 und 12 dem Swap', () => {
    expect([7, 8].map(kraftVon)).toEqual(['peek', 'peek']);
    expect([9, 10].map(kraftVon)).toEqual(['spy', 'spy']);
    expect([11, 12].map(kraftVon)).toEqual(['swap', 'swap']);
  });

  it('lässt alle übrigen Werte ohne Kraft', () => {
    for (const w of [0, 1, 2, 3, 4, 5, 6, 13]) expect(kraftVon(w), `Wert ${w}`).toBe(null);
  });

  it('deckt mit den drei Kräften genau die Werte 7 bis 12 ab', () => {
    const alle = Object.values(KRAEFTE).flatMap((k) => k.werte).sort((a, b) => a - b);
    expect(alle).toEqual([7, 8, 9, 10, 11, 12]);
  });
});

describe('Rundenaufbau', () => {
  it('gibt jedem vier Karten und deckt eine Ablagekarte auf', () => {
    const s = neuesSpiel(['A', 'B']);
    neueRunde(s, ohneZufall);
    expect(s.spieler[0].hand).toHaveLength(HANDGROESSE);
    expect(s.spieler[1].hand).toHaveLength(HANDGROESSE);
    expect(s.ablage).toHaveLength(1);
    expect(s.stapel).toHaveLength(52 - 2 * HANDGROESSE - 1);
  });

  it('lässt vor dem ersten Zug beide zwei Karten ansehen', () => {
    const s = neuesSpiel(['A', 'B']);
    neueRunde(s, ohneZufall);
    expect(s.phase).toBe('einpraegen');
    expect(startKarten(s, 0).map((x) => x.index)).toEqual([2, 3]);
    expect(amZug(s)).toBe(0);
    einpraegenFertig(s);
    expect(amZug(s)).toBe(1);
    einpraegenFertig(s);
    expect(s.phase).toBe('zug');
  });

  it('lässt links vom Geber anfangen', () => {
    const s = neuesSpiel(['A', 'B', 'C']);
    s.geber = 1;
    neueRunde(s, ohneZufall);
    expect(s.dran).toBe(2);
  });
});

describe('Ziehen und ablegen', () => {
  it('nimmt eine Karte vom Nachziehstapel', () => {
    const s = starte();
    const vorher = s.stapel.length;
    ziehen(s, 'stapel');
    expect(s.phase).toBe('gezogen');
    expect(s.gezogene).toBeTruthy();
    expect(s.stapel).toHaveLength(vorher - 1);
  });

  it('nimmt die oberste Ablagekarte', () => {
    const s = starte();
    const oben = obenAufAblage(s);
    ziehen(s, 'ablage');
    expect(s.gezogene).toEqual(oben);
    expect(s.quelle).toBe('ablage');
  });

  it('legt beim Tauschen die alte Karte offen ab und beendet den Zug', () => {
    const s = starte();
    ziehen(s, 'stapel');
    const gezogene = s.gezogene;
    const alte = s.spieler[0].hand[1];
    tauschen(s, 1);
    expect(s.spieler[0].hand[1]).toEqual(gezogene);
    expect(obenAufAblage(s)).toEqual(alte);
    expect(s.dran).toBe(1);
    expect(s.phase).toBe('zug');
  });

  it('verbietet das Abwerfen einer von der Ablage genommenen Karte', () => {
    const s = starte();
    ziehen(s, 'ablage');
    const vorher = JSON.stringify(s);
    abwerfen(s);
    expect(JSON.stringify(s)).toBe(vorher);
  });

  it('beendet den Zug beim Abwerfen einer Karte ohne Kraft', () => {
    const s = starte();
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 3 };
    abwerfen(s);
    expect(s.phase).toBe('zug');
    expect(s.dran).toBe(1);
    expect(obenAufAblage(s).w).toBe(3);
  });
});

describe('Peek, Spy und Swap', () => {
  it('löst beim Abwerfen einer 7 den Peek aus', () => {
    const s = starte();
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 7 };
    abwerfen(s);
    expect(s.phase).toBe('kraft');
    expect(s.kraft.art).toBe('peek');
  });

  it('zeigt beim Peek die eigene Karte und beendet danach den Zug', () => {
    const s = starte();
    setzeHand(s, 0, [1, 2, 3, 4]);
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 8 };
    abwerfen(s);
    peek(s, 2);
    expect(s.aufdecken).toMatchObject({ wer: 0, index: 2 });
    expect(s.aufdecken.karte.w).toBe(3);
    aufdeckenSchliessen(s);
    expect(s.dran).toBe(1);
    expect(s.phase).toBe('zug');
  });

  it('zeigt beim Spy eine fremde Karte', () => {
    const s = starte();
    setzeHand(s, 1, [9, 9, 9, 12]);
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 10 };
    abwerfen(s);
    spy(s, 1, 3);
    expect(s.aufdecken.karte.w).toBe(12);
    expect(s.aufdecken.wer).toBe(1);
  });

  it('lässt den Spy nicht auf eigene Karten los', () => {
    const s = starte();
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 9 };
    abwerfen(s);
    spy(s, 0, 0);
    expect(s.aufdecken).toBe(null);
    expect(s.kraft.art).toBe('spy');
  });

  it('tauscht beim Swap blind zwei Karten und beendet den Zug', () => {
    const s = starte();
    setzeHand(s, 0, [1, 2, 3, 4]);
    setzeHand(s, 1, [10, 11, 12, 13]);
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 11 };
    abwerfen(s);
    swapEigene(s, 0);
    swapFremde(s, 1, 3);
    expect(s.spieler[0].hand[0].w).toBe(13);
    expect(s.spieler[1].hand[3].w).toBe(1);
    expect(s.aufdecken).toBe(null);   // blind, niemand sieht etwas
    expect(s.phase).toBe('zug');
  });

  it('verlangt beim Swap zuerst die eigene Karte', () => {
    const s = starte();
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 12 };
    abwerfen(s);
    swapFremde(s, 1, 0);
    expect(s.phase).toBe('kraft');
  });

  it('lässt sich die Kraft auch auslassen', () => {
    const s = starte();
    ziehen(s, 'stapel');
    s.gezogene = { id: 'x', w: 7 };
    abwerfen(s);
    kraftAuslassen(s);
    expect(s.phase).toBe('zug');
    expect(s.dran).toBe(1);
  });
});

describe('Cabo rufen', () => {
  it('gibt allen anderen genau einen Zug', () => {
    const s = starte(['A', 'B', 'C']);
    caboRufen(s);
    expect(s.caboVon).toBe(0);
    expect(s.restZuege).toBe(2);
    expect(s.dran).toBe(1);

    ziehen(s, 'stapel'); abwerfen(s);
    if (s.phase === 'kraft') kraftAuslassen(s);
    expect(s.restZuege).toBe(1);
    expect(s.dran).toBe(2);

    ziehen(s, 'stapel'); abwerfen(s);
    if (s.phase === 'kraft') kraftAuslassen(s);
    expect(['auswertung', 'ende']).toContain(s.phase);
  });

  it('lässt sich nicht zweimal rufen', () => {
    const s = starte(['A', 'B', 'C']);
    caboRufen(s);
    const vorher = s.caboVon;
    caboRufen(s);
    expect(s.caboVon).toBe(vorher);
    expect(s.restZuege).toBe(2);
  });

  it('beendet bei zwei Personen die Runde nach dem Gegenzug', () => {
    const s = starte();
    caboRufen(s);
    expect(s.dran).toBe(1);
    ziehen(s, 'stapel'); abwerfen(s);
    if (s.phase === 'kraft') kraftAuslassen(s);
    expect(['auswertung', 'ende']).toContain(s.phase);
  });
});

describe('Wertung', () => {
  it('gibt dem Rufer 0 Punkte, wenn er wirklich vorne liegt', () => {
    const s = starte();
    setzeHand(s, 0, [1, 0, 2, 1]);   // 4
    setzeHand(s, 1, [5, 5, 5, 5]);   // 20
    s.caboVon = 0;
    auswerten(s);
    expect(s.auswertung.caboGeglueckt).toBe(true);
    expect(s.punkte).toEqual([0, 20]);
  });

  it('bestraft den Rufer mit 5 Punkten obendrauf, wenn er danebenliegt', () => {
    const s = starte();
    setzeHand(s, 0, [6, 6, 0, 0]);   // 12
    setzeHand(s, 1, [1, 1, 1, 1]);   // 4
    s.caboVon = 0;
    auswerten(s);
    expect(s.auswertung.caboGeglueckt).toBe(false);
    expect(s.punkte).toEqual([12 + CABO_STRAFE, 4]);
  });

  it('lässt bei Gleichstand den Rufer gewinnen', () => {
    const s = starte();
    setzeHand(s, 0, [3, 3, 0, 0]);   // 6
    setzeHand(s, 1, [3, 3, 0, 0]);   // 6
    s.caboVon = 1;
    auswerten(s);
    expect(s.auswertung.caboGeglueckt).toBe(true);
    expect(s.punkte).toEqual([6, 0]);
  });

  it('summiert Handkarten korrekt', () => {
    const s = starte();
    setzeHand(s, 0, [0, 13, 7, 1]);
    expect(handSumme(s.spieler[0])).toBe(21);
  });

  it('setzt genau 100 Punkte auf 50 zurück', () => {
    const s = starte();
    s.punkte = [90, 30];
    setzeHand(s, 0, [10, 0, 0, 0]);  // 10 -> genau 100
    setzeHand(s, 1, [1, 0, 0, 0]);
    s.caboVon = 1;
    auswerten(s);
    expect(s.punkte[0]).toBe(50);
  });

  it('beendet das Spiel ab 100 Punkten', () => {
    const s = starte();
    s.punkte = [95, 10];
    setzeHand(s, 0, [9, 9, 0, 0]);   // 18 -> 113
    setzeHand(s, 1, [1, 0, 0, 0]);
    s.caboVon = 1;
    auswerten(s);
    expect(s.punkte[0]).toBeGreaterThanOrEqual(SPIELENDE_AB);
    expect(s.phase).toBe('ende');
  });

  it('spielt sonst eine neue Runde mit wechselndem Geber', () => {
    const s = starte();
    s.caboVon = 0;
    auswerten(s);
    expect(s.phase).toBe('auswertung');
    const geberVorher = s.geber;
    naechsteRunde(s, ohneZufall);
    expect(s.runde).toBe(2);
    expect(s.geber).toBe((geberVorher + 1) % s.spieler.length);
    expect(s.phase).toBe('einpraegen');
    expect(s.spieler[0].hand).toHaveLength(HANDGROESSE);
  });

  it('sortiert den Endstand aufsteigend — wenig ist gut', () => {
    const s = starte();
    s.punkte = [80, 40];
    const tabelle = endstand(s);
    expect(tabelle[0].name).toBe('B');
    expect(tabelle[0].punkte).toBe(40);
  });
});

describe('Nachziehstapel', () => {
  it('mischt die Ablage zurück, wenn der Stapel leer ist', () => {
    const s = starte();
    s.ablage = [...s.stapel, ...s.ablage];
    s.stapel = [];
    const vorrat = s.ablage.length;
    ziehen(s, 'stapel');
    expect(s.gezogene).toBeTruthy();
    expect(s.ablage).toHaveLength(1);
    expect(s.stapel).toHaveLength(vorrat - 2);
  });
});

describe('Wer hält das Handy', () => {
  it('folgt beim Einprägen der Reihe und danach dem Zug', () => {
    const s = neuesSpiel(['A', 'B']);
    neueRunde(s, ohneZufall);
    expect(amZug(s)).toBe(0);
    einpraegenFertig(s);
    expect(amZug(s)).toBe(1);
    einpraegenFertig(s);
    expect(amZug(s)).toBe(s.dran);
    ziehen(s, 'stapel');
    expect(amZug(s)).toBe(s.dran);
  });

  it('gibt in der Auswertung niemanden mehr vor', () => {
    const s = starte();
    s.caboVon = 0;
    auswerten(s);
    expect(amZug(s)).toBe(null);
  });
});

describe('Gleiche Karten abwerfen', () => {
  /** Zug bis zur Paarwahl vorbereiten. */
  function bisPaar(s, werte, gezogenerWert = 5) {
    setzeHand(s, 0, werte);
    ziehen(s, 'stapel');
    s.gezogene = { id: 'gez', w: gezogenerWert };
    paarStarten(s);
    return s;
  }

  it('geht erst nach dem Ziehen', () => {
    const s = starte();
    paarStarten(s);
    expect(s.phase).toBe('zug');
    expect(s.paar).toBe(null);
  });

  it('braucht mindestens zwei Karten', () => {
    const s = starte();
    bisPaar(s, [4, 4, 9, 2]);
    paarWaehlen(s, 0);
    paarAufdecken(s);
    expect(s.paar.ergebnis).toBe(null);
  });

  it('lässt die Auswahl wieder abwählen', () => {
    const s = starte();
    bisPaar(s, [4, 4, 9, 2]);
    paarWaehlen(s, 0);
    paarWaehlen(s, 1);
    paarWaehlen(s, 0);
    expect(s.paar.gewaehlt).toEqual([1]);
  });

  it('verkleinert die Hand bei einem echten Pärchen', () => {
    const s = starte();
    bisPaar(s, [4, 9, 4, 2], 5);
    paarWaehlen(s, 0);
    paarWaehlen(s, 2);
    paarAufdecken(s);
    expect(s.paar.ergebnis.stimmt).toBe(true);
    paarBestaetigen(s);

    const hand = s.spieler[0].hand;
    expect(hand).toHaveLength(3);
    expect(hand.map((k) => k.w)).toEqual([5, 9, 2]);   // gezogene rückt auf Platz 0
    expect(s.ablage.slice(-2).every((k) => k.w === 4)).toBe(true);
  });

  it('räumt auch ein Triplett ab', () => {
    const s = starte();
    bisPaar(s, [7, 7, 7, 1], 0);
    [0, 1, 2].forEach((i) => paarWaehlen(s, i));
    paarAufdecken(s);
    paarBestaetigen(s);
    expect(s.spieler[0].hand.map((k) => k.w)).toEqual([0, 1]);
    expect(handSumme(s.spieler[0])).toBe(1);
  });

  it('kostet bei falscher Behauptung den Zug, ohne die Hand zu ändern', () => {
    const s = starte();
    bisPaar(s, [4, 9, 4, 2], 5);
    paarWaehlen(s, 0);
    paarWaehlen(s, 1);                                  // 4 und 9 — passt nicht
    paarAufdecken(s);
    expect(s.paar.ergebnis.stimmt).toBe(false);
    paarBestaetigen(s);

    expect(s.spieler[0].hand.map((k) => k.w)).toEqual([4, 9, 4, 2]);
    expect(obenAufAblage(s).w).toBe(5);                 // gezogene Karte ist futsch
    expect(s.dran).toBe(1);
    expect(s.phase).toBe('zug');
  });

  it('lässt sich vor dem Aufdecken folgenlos abbrechen', () => {
    const s = starte();
    bisPaar(s, [4, 4, 9, 2]);
    paarWaehlen(s, 0);
    paarAbbrechen(s);
    expect(s.phase).toBe('gezogen');
    expect(s.paar).toBe(null);
    expect(s.spieler[0].hand).toHaveLength(4);
  });

  it('geht auch mit einer Karte von der Ablage', () => {
    const s = starte();
    setzeHand(s, 0, [6, 6, 1, 3]);
    ziehen(s, 'ablage');
    paarStarten(s);
    expect(s.phase).toBe('paar');
  });

  it('lässt sich mit allen vier Karten auf eine Handkarte eindampfen', () => {
    const s = starte();
    bisPaar(s, [8, 8, 8, 8], 2);
    [0, 1, 2, 3].forEach((i) => paarWaehlen(s, i));
    paarAufdecken(s);
    paarBestaetigen(s);
    expect(s.spieler[0].hand.map((k) => k.w)).toEqual([2]);
  });
});
