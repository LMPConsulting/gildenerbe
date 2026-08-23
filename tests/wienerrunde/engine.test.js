import { describe, it, expect } from 'vitest';
import {
  FELDER, FELDER_GESAMT, GRUPPEN, GRUPPENFELDER, KAUFBAR, LOS_GELD, STARTGELD,
  GEFAENGNIS_FELD, KAUTION, LINIENMIETE, WERKFAKTOR, EREIGNIS, KAFFEEHAUS,
} from '../../wienerrunde/src/brett.js';
import {
  neuerStand, wuerfeln, ziehen, kaufen, kaufVerzichten, miete, besitzer,
  gruppeKomplett, bauen, abreissen, beleihen, ausloesen, karteZiehen, karteAusfuehren,
  kautionZahlen, freikarteNutzen, wuerfelnImKnast, zugBeenden, vermoegen, pleite,
  vorbei, handelAnbieten, handelAnnehmen, handelAblehnen, alsCode, ausCode, phase,
} from '../../wienerrunde/src/engine.js';

/** Ein Stand mit gesetztem Zufall — auch der Kartenstapel liegt fest. */
function neu(extra = {}) {
  let x = 20250823;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const s = neuerStand(['A', 'B'], {}, rnd);
  Object.assign(s, extra);
  return s;
}

/** Würfel, der eine feste Folge liefert (Paare als [a, b]). */
const wuerfelFolge = (...paare) => {
  const flach = paare.flat();
  let i = 0;
  return () => ((flach[Math.min(i++, flach.length - 1)] - 0.5) / 6);
};

describe('Das Brett', () => {
  it('hat vierzig Felder, lückenlos nummeriert', () => {
    expect(FELDER).toHaveLength(FELDER_GESAMT);
    expect(FELDER.map((f) => f.feld)).toEqual([...Array(40).keys()]);
  });

  it('hat 22 Orte in acht Gruppen', () => {
    const orte = FELDER.filter((f) => f.art === 'ort');
    expect(orte).toHaveLength(22);
    expect(Object.keys(GRUPPEN)).toHaveLength(8);
    expect(orte.every((o) => GRUPPEN[o.gruppe])).toBe(true);
  });

  it('gibt jeder Gruppe zwei oder drei Orte', () => {
    for (const [g, felder] of Object.entries(GRUPPENFELDER)) {
      expect(felder.length, g).toBeGreaterThanOrEqual(2);
      expect(felder.length, g).toBeLessThanOrEqual(3);
    }
  });

  it('hat vier Linien und zwei Werke', () => {
    expect(FELDER.filter((f) => f.art === 'linie')).toHaveLength(4);
    expect(FELDER.filter((f) => f.art === 'werk')).toHaveLength(2);
  });

  it('zählt 28 kaufbare Felder', () => {
    expect(KAUFBAR).toHaveLength(28);
  });

  it('gibt jedem Ort sechs Mietstufen, die ansteigen', () => {
    for (const o of FELDER.filter((f) => f.art === 'ort')) {
      expect(o.miete, o.name).toHaveLength(6);
      for (let i = 1; i < 6; i++) {
        expect(o.miete[i], `${o.name} Stufe ${i}`).toBeGreaterThan(o.miete[i - 1]);
      }
      expect(o.preis).toBeGreaterThan(0);
      expect(o.haus).toBeGreaterThan(0);
    }
  });

  it('macht teurere Gruppen auch teurer', () => {
    const schnitt = (g) => GRUPPENFELDER[g]
      .map((f) => FELDER[f].preis).reduce((a, b) => a + b, 0) / GRUPPENFELDER[g].length;
    const reihe = Object.keys(GRUPPEN).map(schnitt);
    for (let i = 1; i < reihe.length; i++) expect(reihe[i]).toBeGreaterThan(reihe[i - 1]);
  });

  it('setzt Gefängnis, Los und Ab-ins-Kommissariat an die Ecken', () => {
    expect(FELDER[0].art).toBe('los');
    expect(FELDER[10].art).toBe('besuch');
    expect(FELDER[20].art).toBe('parken');
    expect(FELDER[30].art).toBe('inHaft');
  });

  it('hat je zwölf Karten mit eindeutigen Kennungen', () => {
    expect(EREIGNIS).toHaveLength(12);
    expect(KAFFEEHAUS).toHaveLength(12);
    const ids = [...EREIGNIS, ...KAFFEEHAUS].map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of [...EREIGNIS, ...KAFFEEHAUS]) {
      expect(k.text.length, k.id).toBeGreaterThan(10);
      expect(k.art, k.id).toBeTruthy();
    }
  });
});

describe('neuerStand', () => {
  it('gibt beiden Startgeld und stellt sie auf Los', () => {
    const s = neu();
    expect(s.geld).toEqual([STARTGELD, STARTGELD]);
    expect(s.ort).toEqual([0, 0]);
    expect(s.dran).toBe(0);
    expect(s.fertig).toBeNull();
  });

  it('lässt alle Felder unverkauft', () => {
    const s = neu();
    expect(Object.keys(s.besitz)).toHaveLength(0);
  });
});

describe('Würfeln und Ziehen', () => {
  it('liefert zwei Würfel', () => {
    const s = neu();
    const w = wuerfeln(s, wuerfelFolge([3, 4]));
    expect(w.wuerfel).toEqual([3, 4]);
    expect(w.summe).toBe(7);
    expect(w.pasch).toBe(false);
  });

  it('erkennt einen Pasch', () => {
    const s = neu();
    expect(wuerfeln(s, wuerfelFolge([5, 5])).pasch).toBe(true);
  });

  it('zieht um die Augensumme weiter', () => {
    // Feld 6 ist ein Ort. Auf einem Kartenfeld würde die Karte gleich
    // weiterschicken — dann prüfte der Test etwas anderes als gemeint.
    const s = neu();
    wuerfeln(s, wuerfelFolge([3, 3]));
    ziehen(s);
    expect(s.ort[0]).toBe(6);
  });

  it('zahlt beim Überschreiten von Los', () => {
    const s = neu({ ort: [38, 0] });
    wuerfeln(s, wuerfelFolge([3, 4]));
    ziehen(s);
    expect(s.ort[0]).toBe(5);
    expect(s.geld[0]).toBe(STARTGELD + LOS_GELD);
  });

  it('schickt von Feld 30 direkt ins Kommissariat', () => {
    const s = neu({ ort: [23, 0] });
    wuerfeln(s, wuerfelFolge([3, 4]));
    ziehen(s);
    expect(s.ort[0]).toBe(GEFAENGNIS_FELD);
    expect(s.haft[0]).toBeGreaterThan(0);
  });

  it('lässt nach einem Pasch noch einmal würfeln', () => {
    const s = neu();
    wuerfeln(s, wuerfelFolge([2, 2]));
    ziehen(s);
    zugBeenden(s);
    expect(s.dran).toBe(0);
  });

  it('schickt nach drei Paschs ins Kommissariat', () => {
    const s = neu();
    for (let i = 0; i < 3; i++) {
      wuerfeln(s, wuerfelFolge([2, 2]));
      ziehen(s);
      if (s.haft[0] === 0) zugBeenden(s);
    }
    expect(s.ort[0]).toBe(GEFAENGNIS_FELD);
    expect(s.haft[0]).toBeGreaterThan(0);
  });

  it('zieht Steuern ein', () => {
    const s = neu({ ort: [0, 0] });
    wuerfeln(s, wuerfelFolge([2, 2]));
    ziehen(s);
    expect(s.geld[0]).toBe(STARTGELD - 200);
  });
});

describe('Kaufen', () => {
  it('überträgt Feld und Geld', () => {
    const s = neu({ ort: [1, 0] });
    s.phase = 'kaufen';
    kaufen(s);
    expect(besitzer(s, 1)).toBe(0);
    expect(s.geld[0]).toBe(STARTGELD - 60);
  });

  it('lässt ein fremdes Feld nicht kaufen', () => {
    const s = neu({ ort: [1, 0], besitz: { 1: 1 } });
    expect(kaufen(s)).toBe(false);
  });

  it('lässt nicht kaufen, wenn das Geld fehlt', () => {
    const s = neu({ ort: [39, 0], geld: [100, 1500] });
    s.phase = 'kaufen';
    expect(kaufen(s)).toBe(false);
  });

  it('lässt sich ablehnen — keine Versteigerung', () => {
    const s = neu({ ort: [1, 0] });
    s.phase = 'kaufen';
    kaufVerzichten(s);
    expect(besitzer(s, 1)).toBeNull();
    expect(s.geld[0]).toBe(STARTGELD);
  });
});

describe('Miete', () => {
  it('kostet nichts, wenn man auf eigenem Grund landet', () => {
    // `miete` sagt, was der Ort wert ist — ob gezahlt wird, entscheidet der Zug.
    const s = neu({ ort: [0, 0], besitz: { 6: 0 } });
    wuerfeln(s, wuerfelFolge([3, 3]));
    ziehen(s);
    expect(s.ort[0]).toBe(6);
    expect(s.geld[0]).toBe(STARTGELD);
    expect(s.geld[1]).toBe(STARTGELD);
  });

  it('kostet die Grundmiete bei einzelnem Ort', () => {
    const s = neu({ besitz: { 1: 1 } });
    expect(miete(s, 1, 7)).toBe(2);
  });

  it('verdoppelt sie bei vollständiger Gruppe ohne Häuser', () => {
    const s = neu({ besitz: { 1: 1, 3: 1 } });
    expect(gruppeKomplett(s, 'vorstadt', 1)).toBe(true);
    expect(miete(s, 1, 7)).toBe(4);
  });

  it('richtet sich nach der Zahl der Häuser', () => {
    const s = neu({ besitz: { 1: 1, 3: 1 }, haeuser: { 1: 3 } });
    expect(miete(s, 1, 7)).toBe(90);
  });

  it('nimmt beim Hotel die höchste Stufe', () => {
    const s = neu({ besitz: { 1: 1, 3: 1 }, haeuser: { 1: 5 } });
    expect(miete(s, 1, 7)).toBe(250);
  });

  it('zahlt für Linien nach deren Anzahl', () => {
    const s = neu({ besitz: { 5: 1 } });
    expect(miete(s, 5, 7)).toBe(LINIENMIETE[1]);
    s.besitz[15] = 1;
    s.besitz[25] = 1;
    expect(miete(s, 5, 7)).toBe(LINIENMIETE[3]);
  });

  it('zahlt für Werke nach dem Wurf', () => {
    const s = neu({ besitz: { 12: 1 } });
    expect(miete(s, 12, 8)).toBe(8 * WERKFAKTOR[1]);
    s.besitz[28] = 1;
    expect(miete(s, 12, 8)).toBe(8 * WERKFAKTOR[2]);
  });

  it('entfällt bei Hypothek', () => {
    const s = neu({ besitz: { 1: 1 }, hypothek: { 1: true } });
    expect(miete(s, 1, 7)).toBe(0);
  });

  it('wird beim Ziehen abgebucht', () => {
    const s = neu({ ort: [0, 0], besitz: { 7: 1 } });
    s.besitz = { 6: 1 };
    wuerfeln(s, wuerfelFolge([3, 3]));
    ziehen(s);
    expect(s.ort[0]).toBe(6);
    expect(s.geld[0]).toBe(STARTGELD - 6);
    expect(s.geld[1]).toBe(STARTGELD + 6);
  });
});

describe('Bauen', () => {
  const mitGruppe = () => neu({ besitz: { 1: 0, 3: 0 } });

  it('braucht die vollständige Gruppe', () => {
    const s = neu({ besitz: { 1: 0 } });
    expect(bauen(s, 1)).toBe(false);
  });

  it('kostet den Hauspreis', () => {
    const s = mitGruppe();
    expect(bauen(s, 1)).toBe(true);
    expect(s.haeuser[1]).toBe(1);
    expect(s.geld[0]).toBe(STARTGELD - 50);
  });

  it('baut nur gleichmäßig', () => {
    const s = mitGruppe();
    bauen(s, 1);
    expect(bauen(s, 1)).toBe(false);      // Feld 3 hinkt hinterher
    expect(bauen(s, 3)).toBe(true);
    expect(bauen(s, 1)).toBe(true);
  });

  it('hört beim Hotel auf', () => {
    const s = mitGruppe();
    s.geld = [5000, 1500];
    for (let i = 0; i < 5; i++) { bauen(s, 1); bauen(s, 3); }
    expect(s.haeuser[1]).toBe(5);
    expect(bauen(s, 1)).toBe(false);
  });

  it('baut nicht ohne Geld', () => {
    const s = neu({ besitz: { 1: 0, 3: 0 }, geld: [10, 1500] });
    expect(bauen(s, 1)).toBe(false);
  });

  it('baut nicht auf beliehenem Grund', () => {
    const s = mitGruppe();
    s.hypothek[3] = true;
    expect(bauen(s, 1)).toBe(false);
  });

  it('bringt beim Abreißen die Hälfte', () => {
    const s = mitGruppe();
    bauen(s, 1); bauen(s, 3);
    const vorher = s.geld[0];
    expect(abreissen(s, 1)).toBe(true);
    expect(s.haeuser[1] || 0).toBe(0);
    expect(s.geld[0]).toBe(vorher + 25);
  });
});

describe('Hypothek', () => {
  it('bringt die Hälfte des Preises', () => {
    const s = neu({ besitz: { 1: 0 } });
    expect(beleihen(s, 1)).toBe(true);
    expect(s.geld[0]).toBe(STARTGELD + 30);
    expect(s.hypothek[1]).toBe(true);
  });

  it('kostet beim Auslösen zehn Prozent Aufschlag', () => {
    const s = neu({ besitz: { 1: 0 } });
    beleihen(s, 1);
    expect(ausloesen(s, 1)).toBe(true);
    expect(s.geld[0]).toBe(STARTGELD + 30 - 33);
    expect(s.hypothek[1]).toBeUndefined();
  });

  it('geht nicht bei bebautem Grund', () => {
    const s = neu({ besitz: { 1: 0, 3: 0 } });
    bauen(s, 1);
    expect(beleihen(s, 1)).toBe(false);
  });

  it('geht nicht auf fremdem Grund', () => {
    const s = neu({ besitz: { 1: 1 } });      // gehört der Gegenseite
    expect(beleihen(s, 1)).toBe(false);
    expect(s.geld[1]).toBe(STARTGELD);
  });

  it('lässt auch fremde Häuser nicht abreißen', () => {
    const s = neu({ besitz: { 1: 1, 3: 1 }, haeuser: { 1: 1, 3: 1 } });
    expect(abreissen(s, 1)).toBe(false);
  });
});

describe('Gefängnis', () => {
  it('lässt gegen Kaution frei', () => {
    const s = neu({ ort: [10, 0], haft: [3, 0] });
    expect(kautionZahlen(s)).toBe(true);
    expect(s.haft[0]).toBe(0);
    expect(s.geld[0]).toBe(STARTGELD - KAUTION);
  });

  it('lässt mit Freikarte frei', () => {
    const s = neu({ ort: [10, 0], haft: [3, 0], freikarten: [1, 0] });
    expect(freikarteNutzen(s)).toBe(true);
    expect(s.haft[0]).toBe(0);
    expect(s.freikarten[0]).toBe(0);
  });

  it('lässt mit einem Pasch frei', () => {
    const s = neu({ ort: [10, 0], haft: [3, 0] });
    const raus = wuerfelnImKnast(s, wuerfelFolge([4, 4]));
    expect(raus.frei).toBe(true);
    expect(s.haft[0]).toBe(0);
    expect(s.ort[0]).toBe(18);
  });

  it('zählt sonst einen Versuch herunter', () => {
    const s = neu({ ort: [10, 0], haft: [3, 0] });
    const raus = wuerfelnImKnast(s, wuerfelFolge([2, 5]));
    expect(raus.frei).toBe(false);
    expect(s.haft[0]).toBe(2);
    expect(s.ort[0]).toBe(10);
  });

  it('lässt nach dem dritten Fehlversuch gegen Kaution raus', () => {
    const s = neu({ ort: [10, 0], haft: [1, 0] });
    const raus = wuerfelnImKnast(s, wuerfelFolge([2, 4]));   // 6 → Feld 16, ein Ort
    expect(raus.frei).toBe(true);
    expect(raus.gezahlt).toBe(KAUTION);
    expect(s.geld[0]).toBe(STARTGELD - KAUTION);
    expect(s.ort[0]).toBe(16);
  });
});

describe('Karten', () => {
  it('zieht eine Ereigniskarte und legt sie unten wieder ein', () => {
    const s = neu();
    const k = karteZiehen(s, 'ereignis');
    expect(EREIGNIS.some((e) => e.id === k.id)).toBe(true);
    expect(s.stapel.ereignis[s.stapel.ereignis.length - 1]).toBe(k.id);
  });

  it('führt Geldkarten aus', () => {
    const s = neu();
    karteAusfuehren(s, { art: 'geld', betrag: 100 });
    expect(s.geld[0]).toBe(STARTGELD + 100);
  });

  it('führt Gehe-Karten aus und zahlt Los', () => {
    const s = neu({ ort: [35, 0] });
    karteAusfuehren(s, { art: 'gehe', feld: 0 });
    expect(s.ort[0]).toBe(0);
    expect(s.geld[0]).toBe(STARTGELD + LOS_GELD);
  });

  it('schickt Haft-Karten ins Kommissariat, ohne Los zu zahlen', () => {
    const s = neu({ ort: [35, 0] });
    karteAusfuehren(s, { art: 'haft' });
    expect(s.ort[0]).toBe(GEFAENGNIS_FELD);
    expect(s.geld[0]).toBe(STARTGELD);
    expect(s.haft[0]).toBe(3);
  });

  it('zieht bei „drei Felder zurück" auch die Rückseite in Betracht', () => {
    const s = neu({ ort: [2, 0] });
    karteAusfuehren(s, { art: 'zurueck', schritte: 3 });
    expect(s.ort[0]).toBe(39);
  });

  it('verschiebt Geld zwischen den Seiten', () => {
    const s = neu();
    karteAusfuehren(s, { art: 'vomAnderen', betrag: 50 });
    expect(s.geld[0]).toBe(STARTGELD + 50);
    expect(s.geld[1]).toBe(STARTGELD - 50);
  });

  it('legt Freikarten auf die Hand', () => {
    const s = neu();
    karteAusfuehren(s, { art: 'freikarte' });
    expect(s.freikarten[0]).toBe(1);
  });

  it('rechnet die Bauabgabe über alle eigenen Felder', () => {
    const s = neu({ besitz: { 1: 0, 3: 0 }, haeuser: { 1: 2, 3: 5 } });
    karteAusfuehren(s, { art: 'bauabgabe', proHaus: 40, proHotel: 115 });
    expect(s.geld[0]).toBe(STARTGELD - (2 * 40 + 115));
  });

  it('führt zur nächsten Linie', () => {
    const s = neu({ ort: [7, 0] });
    karteAusfuehren(s, { art: 'naechsteLinie' });
    expect(s.ort[0]).toBe(15);
  });
});

describe('Vermögen und Pleite', () => {
  it('zählt Geld, Grundwert und halbe Häuser', () => {
    const s = neu({ besitz: { 1: 0, 3: 0 }, haeuser: { 1: 2 } });
    expect(vermoegen(s, 0)).toBe(STARTGELD + 60 + 60 + 2 * 25);
  });

  it('zählt beliehene Felder nur halb', () => {
    const s = neu({ besitz: { 1: 0 }, hypothek: { 1: true } });
    expect(vermoegen(s, 0)).toBe(STARTGELD + 30);
  });

  it('meldet Pleite, wenn nichts mehr zu holen ist', () => {
    const s = neu({ geld: [-50, 1500] });
    expect(pleite(s, 0)).toBe(true);
  });

  it('meldet keine Pleite, solange etwas zu beleihen ist', () => {
    const s = neu({ geld: [-50, 1500], besitz: { 39: 0 } });
    expect(pleite(s, 0)).toBe(false);
  });

  it('beendet das Spiel bei Pleite', () => {
    const s = neu({ geld: [10, 1500], besitz: { 6: 1 }, ort: [0, 0] });
    s.besitz = { 6: 1 };
    s.haeuser = {};
    // Miete 6 € ist bezahlbar; erst eine große Miete macht pleite.
    s.besitz[39] = 1;
    s.ort = [37, 0];
    wuerfeln(s, wuerfelFolge([1, 1]));
    ziehen(s);
    expect(s.ort[0]).toBe(39);
    expect(vorbei(s)).toBe(true);
    expect(s.fertig).toBe(1);
  });
});

describe('Handel', () => {
  it('bietet Feld gegen Geld an', () => {
    const s = neu({ besitz: { 1: 0 } });
    expect(handelAnbieten(s, { von: 0, feld: 1, preis: 100 })).toBe(true);
    expect(s.handel).toEqual({ von: 0, feld: 1, preis: 100 });
  });

  it('lässt kein fremdes Feld anbieten', () => {
    const s = neu({ besitz: { 1: 1 } });
    expect(handelAnbieten(s, { von: 0, feld: 1, preis: 100 })).toBe(false);
  });

  it('lässt bebauten Grund nicht anbieten', () => {
    const s = neu({ besitz: { 1: 0, 3: 0 } });
    bauen(s, 1);
    expect(handelAnbieten(s, { von: 0, feld: 1, preis: 100 })).toBe(false);
  });

  it('überträgt beim Annehmen Feld und Geld', () => {
    const s = neu({ besitz: { 1: 0 } });
    handelAnbieten(s, { von: 0, feld: 1, preis: 100 });
    expect(handelAnnehmen(s)).toBe(true);
    expect(besitzer(s, 1)).toBe(1);
    expect(s.geld[0]).toBe(STARTGELD + 100);
    expect(s.geld[1]).toBe(STARTGELD - 100);
    expect(s.handel).toBeNull();
  });

  it('lehnt ab, wenn das Geld fehlt', () => {
    const s = neu({ besitz: { 1: 0 }, geld: [1500, 50] });
    handelAnbieten(s, { von: 0, feld: 1, preis: 100 });
    expect(handelAnnehmen(s)).toBe(false);
  });

  it('lässt sich ablehnen', () => {
    const s = neu({ besitz: { 1: 0 } });
    handelAnbieten(s, { von: 0, feld: 1, preis: 100 });
    handelAblehnen(s);
    expect(s.handel).toBeNull();
    expect(besitzer(s, 1)).toBe(0);
  });
});

describe('Kurze Partie', () => {
  it('endet nach der eingestellten Rundenzahl zugunsten des Vermögenderen', () => {
    const s = neu({ regeln: { runden: 2 }, runde: 2, geld: [2000, 500] });
    s.dran = 1;
    wuerfeln(s, wuerfelFolge([1, 2]));
    ziehen(s);
    zugBeenden(s);
    expect(vorbei(s)).toBe(true);
    expect(s.fertig).toBe(0);
  });
});

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.siege = [1, 3];
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([1, 3]);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('HUT1-abc')).toThrow();
  });
});

describe('Zweihundert Partien gegen sich selbst', () => {
  /** Kauft alles Bezahlbare, baut wenn möglich, zahlt Kaution. */
  function partieSpielen(saat, maxRunden = 400) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = neuerStand(['A', 'B']);
    let schritte = 0;
    while (!vorbei(s) && schritte < 6000) {
      schritte += 1;
      const wer = s.dran;
      if (s.haft[wer] > 0) {
        if (s.geld[wer] > 200) kautionZahlen(s);
        else wuerfelnImKnast(s, rnd);
        if (s.haft[wer] > 0) { zugBeenden(s); continue; }
      }
      if (phase(s) === 'wuerfeln') {
        wuerfeln(s, rnd);
        ziehen(s);
      }
      if (phase(s) === 'kaufen') {
        const feld = FELDER[s.ort[wer]];
        if (s.geld[wer] > feld.preis + 100) kaufen(s); else kaufVerzichten(s);
      }
      // bauen, wo es geht
      for (const f of KAUFBAR) {
        if (FELDER[f].art !== 'ort') continue;
        if (besitzer(s, f) !== wer) continue;
        if (s.geld[wer] > 600) bauen(s, f);
      }
      if (!vorbei(s)) zugBeenden(s);
      if (s.runde > maxRunden) break;
    }
    return { s, schritte };
  }

  it('läuft jede Partie zu Ende oder erreicht das Rundenlimit', () => {
    for (let saat = 1; saat <= 200; saat++) {
      const { s, schritte } = partieSpielen(saat);
      expect(schritte, `Saat ${saat} hängt`).toBeLessThan(6000);
      expect(s.geld.every((g) => Number.isFinite(g)), `Saat ${saat}: Geld kaputt`).toBe(true);
    }
  });

  it('erreicht nie einen ungültigen Zustand', () => {
    for (let saat = 1; saat <= 100; saat++) {
      const { s } = partieSpielen(saat);
      for (let p = 0; p < 2; p++) {
        expect(s.ort[p]).toBeGreaterThanOrEqual(0);
        expect(s.ort[p]).toBeLessThan(FELDER_GESAMT);
      }
      for (const [feld, anzahl] of Object.entries(s.haeuser)) {
        expect(anzahl).toBeGreaterThanOrEqual(0);
        expect(anzahl).toBeLessThanOrEqual(5);
        expect(besitzer(s, Number(feld)), `Feld ${feld} bebaut ohne Besitzer`).not.toBeNull();
      }
      for (const feld of Object.keys(s.hypothek)) {
        expect(s.haeuser[feld] || 0, `Feld ${feld} beliehen und bebaut`).toBe(0);
      }
    }
  });

  it('führt meistens zu einer Entscheidung', () => {
    let entschieden = 0;
    for (let saat = 1; saat <= 200; saat++) if (vorbei(partieSpielen(saat).s)) entschieden += 1;
    expect(entschieden).toBeGreaterThan(100);
  });
});

describe('Voreinstellung', () => {
  it('spielt standardmäßig die kurze Partie über 40 Runden', () => {
    // Gemessen: bis zur Pleite dauert es im Schnitt 149 Runden und jede fünfte
    // Partie endet gar nicht. 40 Runden sind lang genug, dass gebaut wird.
    expect(neuerStand(['A', 'B']).regeln.runden).toBe(40);
  });

  it('lässt sich auf „bis zur Pleite" stellen', () => {
    const s = neuerStand(['A', 'B'], { runden: 0 });
    s.runde = 999;
    s.dran = 1;
    wuerfeln(s, wuerfelFolge([1, 2]));
    ziehen(s);
    zugBeenden(s);
    expect(vorbei(s)).toBe(false);
  });
});

describe('Brettgeometrie', () => {
  it('legt 40 Felder auf den Rand eines 11×11-Rasters', async () => {
    const { FELDPUNKTE, RASTER } = await import('../../wienerrunde/src/geometrie.js');
    expect(RASTER).toBe(11);
    expect(FELDPUNKTE).toHaveLength(40);
    expect(new Set(FELDPUNKTE.map(([x, y]) => `${x},${y}`)).size).toBe(40);
  });

  it('läuft lückenlos herum', async () => {
    const { FELDPUNKTE } = await import('../../wienerrunde/src/geometrie.js');
    for (let i = 0; i < 40; i++) {
      const [x1, y1] = FELDPUNKTE[i];
      const [x2, y2] = FELDPUNKTE[(i + 1) % 40];
      expect(Math.abs(x1 - x2) + Math.abs(y1 - y2), `Lücke bei ${i}`).toBe(1);
    }
  });

  it('setzt die vier Sonderfelder in die Ecken', async () => {
    const { FELDPUNKTE } = await import('../../wienerrunde/src/geometrie.js');
    expect(FELDPUNKTE[0]).toEqual([10, 10]);     // Los
    expect(FELDPUNKTE[10]).toEqual([0, 10]);     // Kommissariat
    expect(FELDPUNKTE[20]).toEqual([0, 0]);      // Freier Platz
    expect(FELDPUNKTE[30]).toEqual([10, 0]);     // Ab ins Kommissariat
  });

  it('sagt zu jedem Feld, an welcher Kante es liegt', async () => {
    const { KANTE } = await import('../../wienerrunde/src/geometrie.js');
    expect(KANTE[0]).toBe('unten');
    expect(KANTE[5]).toBe('unten');
    expect(KANTE[15]).toBe('links');
    expect(KANTE[25]).toBe('oben');
    expect(KANTE[35]).toBe('rechts');
  });
});
