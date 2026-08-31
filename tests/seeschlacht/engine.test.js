import { describe, it, expect } from 'vitest';
import {
  BREITE, HOEHE, FLOTTE, FELDER_GESAMT, SPALTEN, MODI,
  masse, flottenLaengen, imMeer, salveGroesse, markieren, salveFeuern,
  waffenVorrat, luftschlag, radar, mineLegen,
  neuerStand, leeresMeer, passt, setzen, entfernen, zufallsflotte, flotteFertig,
  schiessen, schiffAn, versenkt, alleVersenkt, umgebung, feldName, feldAus,
  bereit, phase, gegnerSicht, alsCode, ausCode, vorbei, flotteAuffuellen,
  nochUebrig, partieNeu,
} from '../../seeschlacht/src/engine.js';

/** Würfelersatz: liefert eine feste Folge zwischen 0 und 1. */
const folge = (...werte) => {
  let i = 0;
  return () => werte[Math.min(i++, werte.length - 1)];
};

/** Ein Meer mit einer Flotte, die von Hand gelegt wurde. */
function meerMit(schiffe) {
  const m = leeresMeer();
  schiffe.forEach(([x, y, laenge, quer]) => setzen(m, { x, y, laenge, quer }));
  return m;
}

describe('Maße', () => {
  it('ist zehn mal zehn', () => {
    expect(BREITE).toBe(10);
    expect(HOEHE).toBe(10);
    expect(SPALTEN).toHaveLength(10);
    expect(SPALTEN[0]).toBe('A');
    expect(SPALTEN[9]).toBe('J');
  });

  it('hat zehn Schiffe mit zusammen 30 Feldern', () => {
    expect(FLOTTE.reduce((n, s) => n + s.anzahl, 0)).toBe(10);
    expect(FELDER_GESAMT).toBe(30);
  });

  it('setzt die klassische Verteilung 1×5, 2×4, 3×3, 4×2', () => {
    expect(FLOTTE.map((s) => [s.laenge, s.anzahl])).toEqual([[5, 1], [4, 2], [3, 3], [2, 4]]);
  });
});

describe('Feldnamen', () => {
  it('schreibt A1 oben links und J10 unten rechts', () => {
    expect(feldName(0, 0)).toBe('A1');
    expect(feldName(9, 9)).toBe('J10');
    expect(feldName(2, 4)).toBe('C5');
  });

  it('liest sie auch wieder ein', () => {
    expect(feldAus('A1')).toEqual({ x: 0, y: 0 });
    expect(feldAus('j10')).toEqual({ x: 9, y: 9 });
    expect(feldAus('Quatsch')).toBeNull();
  });
});

describe('Schiffe legen', () => {
  it('nimmt ein Schiff im freien Wasser an', () => {
    const m = leeresMeer();
    expect(passt(m, { x: 0, y: 0, laenge: 5, quer: true })).toBe(true);
    setzen(m, { x: 0, y: 0, laenge: 5, quer: true });
    expect(m.schiffe).toHaveLength(1);
  });

  it('lässt kein Schiff über den Rand ragen', () => {
    const m = leeresMeer();
    expect(passt(m, { x: 6, y: 0, laenge: 5, quer: true })).toBe(false);
    expect(passt(m, { x: 0, y: 7, laenge: 4, quer: false })).toBe(false);
  });

  it('lässt zwei Schiffe sich nicht berühren — auch nicht über Eck', () => {
    const m = meerMit([[0, 0, 3, true]]);
    expect(passt(m, { x: 3, y: 0, laenge: 2, quer: true })).toBe(false);   // direkt daneben
    expect(passt(m, { x: 3, y: 1, laenge: 2, quer: true })).toBe(false);   // über Eck
    expect(passt(m, { x: 4, y: 1, laenge: 2, quer: true })).toBe(true);    // ein Feld Abstand
  });

  it('erlaubt Berührung, wenn die Abstandsregel aus ist', () => {
    const m = meerMit([[0, 0, 3, true]]);
    m.abstand = false;
    expect(passt(m, { x: 3, y: 0, laenge: 2, quer: true })).toBe(true);
    expect(passt(m, { x: 0, y: 0, laenge: 2, quer: true })).toBe(false);   // aber nie übereinander
  });

  it('nimmt ein Schiff wieder weg', () => {
    const m = meerMit([[0, 0, 3, true]]);
    expect(entfernen(m, 1, 0)).toBe(true);
    expect(m.schiffe).toHaveLength(0);
    expect(entfernen(m, 5, 5)).toBe(false);
  });

  it('meldet die Flotte erst als fertig, wenn alle zehn liegen', () => {
    const m = leeresMeer();
    expect(flotteFertig(m)).toBe(false);
    zufallsflotte(m, Math.random);
    expect(flotteFertig(m)).toBe(true);
    expect(m.schiffe).toHaveLength(10);
  });
});

describe('Zufallsflotte', () => {
  it('legt hundertmal eine gültige Flotte', () => {
    for (let saat = 1; saat <= 100; saat++) {
      let x = saat;
      const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
      const m = leeresMeer();
      zufallsflotte(m, rnd);
      expect(m.schiffe, `Saat ${saat}`).toHaveLength(10);
      // richtige Längen
      const laengen = m.schiffe.map((s) => s.laenge).sort((a, b) => b - a);
      expect(laengen).toEqual([5, 4, 4, 3, 3, 3, 2, 2, 2, 2]);
      // keine Überschneidung, kein Berühren
      const belegt = new Set();
      for (const s of m.schiffe) {
        for (const f of s.felder) {
          expect(belegt.has(`${f.x},${f.y}`), `Saat ${saat}: doppelt belegt`).toBe(false);
          belegt.add(`${f.x},${f.y}`);
        }
      }
      for (const s of m.schiffe) {
        for (const n of umgebung(m, s.felder)) {
          const fremd = m.schiffe.some((o) => o !== s
            && o.felder.some((f) => f.x === n.x && f.y === n.y));
          expect(fremd, `Saat ${saat}: Schiffe berühren sich`).toBe(false);
        }
      }
    }
  });

  it('räumt ein halb belegtes Meer vorher ab', () => {
    const m = meerMit([[0, 0, 3, true]]);
    zufallsflotte(m, Math.random);
    expect(m.schiffe).toHaveLength(10);
  });
});

describe('Schießen', () => {
  /**
   * Ein spielbereiter Stand: die genannten Schiffe liegen an bekannter Stelle,
   * der Rest wird zufällig dazugelegt. Ohne vollständige Flotten lässt die
   * Engine keinen Schuss zu — und das ist auch richtig so.
   */
  const spielMit = (schiffe, extra = {}) => {
    let x = 4711;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = neuerStand(['A', 'B']);
    Object.assign(s, extra);
    s.meere = [leeresMeer(), meerMit(schiffe)];
    flotteAuffuellen(s.meere[0], rnd);
    flotteAuffuellen(s.meere[1], rnd);
    return s;
  };

  /** Versenkt alles im Meer der Gegenseite — für die Prüfung des Spielendes. */
  const allesVersenken = (s) => {
    for (const schiff of s.meere[1].schiffe.slice()) {
      for (const f of schiff.felder) {
        s.dran = 0;
        schiessen(s, f.x, f.y);
        if (vorbei(s)) return;
      }
    }
  };

  it('meldet Wasser und gibt ab', () => {
    const s = spielMit([[0, 0, 2, true]]);
    const was = schiessen(s, 5, 5);
    expect(was.treffer).toBe(false);
    expect(s.dran).toBe(1);
    expect(s.meere[1].schuesse['5,5']).toBe('wasser');
  });

  it('meldet einen Treffer und lässt weiterschießen', () => {
    const s = spielMit([[0, 0, 2, true]]);
    const was = schiessen(s, 0, 0);
    expect(was.treffer).toBe(true);
    expect(was.versenkt).toBe(false);
    expect(s.dran).toBe(0);
    expect(s.meere[1].schuesse['0,0']).toBe('treffer');
  });

  it('gibt nach einem Treffer ab, wenn die Regel aus ist', () => {
    const s = spielMit([[0, 0, 2, true]], { regeln: { trefferNochmal: false, abstand: true } });
    schiessen(s, 0, 0);
    expect(s.dran).toBe(1);
  });

  it('meldet versenkt, sobald alle Felder getroffen sind', () => {
    const s = spielMit([[0, 0, 2, true]]);
    schiessen(s, 0, 0);
    const was = schiessen(s, 1, 0);
    expect(was.versenkt).toBe(true);
    expect(versenkt(s.meere[1], s.meere[1].schiffe[0])).toBe(true);
  });

  it('markiert die Umgebung eines versenkten Schiffs als Wasser', () => {
    const s = spielMit([[0, 0, 2, true]]);
    schiessen(s, 0, 0);
    schiessen(s, 1, 0);
    expect(s.meere[1].schuesse['0,1']).toBe('wasser');
    expect(s.meere[1].schuesse['2,1']).toBe('wasser');
    expect(s.meere[1].schuesse['2,0']).toBe('wasser');
  });

  it('nimmt keinen zweiten Schuss auf dasselbe Feld', () => {
    const s = spielMit([[0, 0, 2, true]]);
    schiessen(s, 5, 5);
    s.dran = 0;
    expect(schiessen(s, 5, 5)).toBeNull();
  });

  it('nimmt keinen Schuss außerhalb der Karte', () => {
    const s = spielMit([[0, 0, 2, true]]);
    expect(schiessen(s, -1, 0)).toBeNull();
    expect(schiessen(s, 0, 10)).toBeNull();
  });

  it('nimmt keinen Schuss, solange nicht alle Flotten stehen', () => {
    const s = neuerStand(['A', 'B']);
    expect(schiessen(s, 0, 0)).toBeNull();
  });

  it('beendet das Spiel, wenn alles versenkt ist', () => {
    const s = spielMit([[0, 0, 2, true]]);
    allesVersenken(s);
    expect(alleVersenkt(s.meere[1])).toBe(true);
    expect(vorbei(s)).toBe(true);
    expect(s.fertig).toBe(0);
    expect(s.siege).toEqual([1, 0]);
  });

  it('nimmt nach dem Ende keinen Schuss mehr', () => {
    const s = spielMit([[0, 0, 2, true]]);
    allesVersenken(s);
    expect(schiessen(s, 9, 9)).toBeNull();
  });
});

describe('schiffAn', () => {
  it('findet das Schiff auf einem Feld', () => {
    const m = meerMit([[3, 3, 3, false]]);
    expect(schiffAn(m, 3, 4)).toBe(m.schiffe[0]);
    expect(schiffAn(m, 4, 4)).toBeNull();
  });
});

describe('Umgebung', () => {
  it('umschließt ein Schiff ohne die eigenen Felder', () => {
    const felder = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const u = umgebung(leeresMeer(), felder);
    const alsText = u.map((f) => `${f.x},${f.y}`);
    expect(alsText).toContain('2,0');
    expect(alsText).toContain('0,1');
    expect(alsText).toContain('2,1');
    expect(alsText).not.toContain('0,0');
    expect(alsText).not.toContain('1,0');
  });

  it('lässt nichts außerhalb der Karte übrig', () => {
    for (const f of umgebung(leeresMeer(), [{ x: 0, y: 0 }])) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThan(BREITE);
      expect(f.y).toBeLessThan(HOEHE);
    }
  });
});

describe('Phasen', () => {
  it('beginnt beim Legen', () => {
    const s = neuerStand(['A', 'B']);
    expect(phase(s)).toBe('legen');
    expect(bereit(s, 0)).toBe(false);
  });

  it('geht erst zum Schießen über, wenn beide fertig sind', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], Math.random);
    expect(phase(s)).toBe('legen');
    zufallsflotte(s.meere[1], Math.random);
    expect(bereit(s, 0)).toBe(true);
    expect(bereit(s, 1)).toBe(true);
    expect(phase(s)).toBe('schiessen');
  });
});

describe('Was die Gegenseite sehen darf', () => {
  it('schickt die eigenen Schiffe nicht mit', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], Math.random);
    zufallsflotte(s.meere[1], Math.random);
    const fuerB = gegnerSicht(s, 1);
    expect(fuerB.meere[0].schiffe).toEqual([]);   // Bs Gegner ist A
    expect(fuerB.meere[1].schiffe).toHaveLength(10);
  });

  it('lässt Treffer und Wasser stehen', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], Math.random);
    zufallsflotte(s.meere[1], Math.random);
    schiessen(s, 4, 4);
    const fuerB = gegnerSicht(s, 1);
    expect(Object.keys(fuerB.meere[1].schuesse).length).toBeGreaterThan(0);
  });

  it('verrät auch versenkte Schiffe erst, wenn sie versenkt sind', () => {
    const s = neuerStand(['A', 'B']);
    s.meere = [leeresMeer(), leeresMeer()];
    setzen(s.meere[1], { x: 0, y: 0, laenge: 2, quer: true });
    flotteAuffuellen(s.meere[0], Math.random);
    flotteAuffuellen(s.meere[1], Math.random);
    const fuerA = gegnerSicht(s, 0);
    expect(fuerA.meere[1].schiffe).toEqual([]);
    expect(fuerA.meere[1].versenkte).toEqual([]);
    schiessen(s, 0, 0);
    schiessen(s, 1, 0);
    const danach = gegnerSicht(s, 0);
    expect(danach.meere[1].schiffe).toEqual([]);      // die übrigen bleiben geheim
    expect(danach.meere[1].versenkte).toHaveLength(1);
  });
});

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.siege = [3, 5];
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([3, 5]);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('AER1-abc')).toThrow();
  });

  it('nimmt keine Schiffe mit', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], Math.random);
    expect(ausCode(alsCode(s)).meere[0].schiffe).toEqual([]);
  });
});

describe('Hundert Partien gegen sich selbst', () => {
  function partieSpielen(saat) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], rnd);
    zufallsflotte(s.meere[1], rnd);
    let schuesse = 0;
    while (!vorbei(s) && schuesse < 500) {
      schuesse += 1;
      const ziel = s.dran === 0 ? 1 : 0;
      const frei = [];
      for (let fx = 0; fx < BREITE; fx++) {
        for (let fy = 0; fy < HOEHE; fy++) {
          if (!s.meere[ziel].schuesse[`${fx},${fy}`]) frei.push([fx, fy]);
        }
      }
      if (!frei.length) break;
      const [gx, gy] = frei[Math.floor(rnd() * frei.length)];
      schiessen(s, gx, gy);
    }
    return { s, schuesse };
  }

  it('läuft jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 100; saat++) {
      const { s, schuesse } = partieSpielen(saat);
      expect(vorbei(s), `Saat ${saat} hängt nach ${schuesse} Schüssen`).toBe(true);
    }
  });

  it('braucht dafür eine plausible Zahl an Schüssen', () => {
    let summe = 0;
    for (let saat = 1; saat <= 100; saat++) summe += partieSpielen(saat).schuesse;
    const schnitt = summe / 100;
    expect(schnitt).toBeGreaterThan(60);     // blind gestreut kommt man nicht schneller durch
    expect(schnitt).toBeLessThan(220);
  });

  it('lässt am Ende kein Schiff übrig', () => {
    for (let saat = 1; saat <= 100; saat++) {
      const { s } = partieSpielen(saat);
      expect(alleVersenkt(s.meere[s.fertig === 0 ? 1 : 0])).toBe(true);
    }
  });
});

describe('Bereitschaft über zwei Geräte', () => {
  it('lässt den Empfänger erkennen, dass die Gegenseite fertig ist', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], Math.random);
    zufallsflotte(s.meere[1], Math.random);
    const fuerB = gegnerSicht(s, 1);
    // Bs Gerät sieht As Schiffe nicht — muss aber wissen, dass As Flotte steht.
    expect(fuerB.meere[0].schiffe).toEqual([]);
    expect(bereit(fuerB, 0)).toBe(true);
    expect(phase(fuerB)).toBe('schiessen');
  });

  it('meldet eine halbe Flotte auch als halb', () => {
    const s = neuerStand(['A', 'B']);
    setzen(s.meere[0], { x: 0, y: 0, laenge: 5, quer: true });
    zufallsflotte(s.meere[1], Math.random);
    const fuerB = gegnerSicht(s, 1);
    expect(bereit(fuerB, 0)).toBe(false);
    expect(phase(fuerB)).toBe('legen');
  });
});

/** Ein einfacher, aber wirklich streuender Zufallsgeber für die Fixtures. */
function streu(saat) {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ==================================================================== Modi */

describe('Modi', () => {
  const modus = (id) => MODI.find((m) => m.id === id);
  const standMit = (id, namen = ['A', 'B']) => {
    const s = neuerStand(namen, modus(id).regeln);
    s.modusId = id;
    return s;
  };

  it('kennt vier Fassungen, jede mit eigener Kennung und Erklärung', () => {
    expect(MODI).toHaveLength(4);
    expect(new Set(MODI.map((m) => m.id)).size).toBe(4);
    expect(MODI[0].id).toBe('klassisch');
    for (const m of MODI) {
      expect(typeof m.titel).toBe('string');
      expect(typeof m.zeile).toBe('string');
      expect(m.regeln).toBeTruthy();
    }
  });

  it('behält die Regeln im Spielstand — damit sie beim Koppeln mitreisen', () => {
    const s = standMit('kurz');
    expect(JSON.parse(JSON.stringify(s)).regeln.breite).toBe(8);
  });

  it('Kurz: kleineres Meer und kleinere Flotte', () => {
    const s = standMit('kurz');
    expect(masse(s.meere[0])).toEqual({ breite: 8, hoehe: 8 });
    expect(flottenLaengen(s.meere[0])).toHaveLength(6);
    expect(imMeer(s.meere[0], 7, 7)).toBe(true);
    expect(imMeer(s.meere[0], 8, 0)).toBe(false);
    expect(imMeer(s.meere[0], 0, 8)).toBe(false);
  });

  it('Kurz: eine Zufallsflotte passt ins kleinere Meer', () => {
    const s = standMit('kurz');
    zufallsflotte(s.meere[0], streu(5));
    expect(flotteFertig(s.meere[0])).toBe(true);
    for (const schiff of s.meere[0].schiffe) {
      for (const f of schiff.felder) expect(imMeer(s.meere[0], f.x, f.y)).toBe(true);
    }
  });

  it('Klassisch bleibt, wie es war', () => {
    const s = standMit('klassisch');
    expect(masse(s.meere[0])).toEqual({ breite: 10, hoehe: 10 });
    expect(flottenLaengen(s.meere[0])).toHaveLength(10);
  });
});

/* =================================================================== Salve */

describe('Salve', () => {
  const salveStand = () => {
    const s = neuerStand(['A', 'B'], MODI.find((m) => m.id === 'salve').regeln);
    s.modusId = 'salve';
    zufallsflotte(s.meere[0], streu(7));
    zufallsflotte(s.meere[1], streu(23));
    return s;
  };

  it('gibt so viele Schüsse, wie man selbst noch Schiffe hat', () => {
    const s = salveStand();
    expect(salveGroesse(s)).toBe(nochUebrig(s.meere[0]));
    expect(salveGroesse(s)).toBe(10);
  });

  it('markiert Felder, ohne sie schon aufzudecken', () => {
    const s = salveStand();
    markieren(s, 0, 0);
    markieren(s, 1, 0);
    expect(s.salve).toHaveLength(2);
    expect(s.meere[1].schuesse['0,0']).toBeUndefined();
  });

  it('nimmt eine Markierung durch nochmaliges Antippen zurück', () => {
    const s = salveStand();
    markieren(s, 3, 3);
    markieren(s, 3, 3);
    expect(s.salve).toHaveLength(0);
  });

  it('markiert kein Feld doppelt und keins, auf das schon geschossen wurde', () => {
    const s = salveStand();
    s.meere[1].schuesse['4,4'] = 'wasser';
    expect(markieren(s, 4, 4)).toBe(false);
    markieren(s, 5, 5);
    expect(markieren(s, 5, 5)).toBe(false);   // zweites Antippen nimmt zurück …
    expect(s.salve).toHaveLength(0);
  });

  it('feuert erst, wenn die Salve voll ist', () => {
    const s = salveStand();
    markieren(s, 0, 0);
    expect(() => salveFeuern(s)).toThrow();
  });

  it('deckt alle Treffer erst nach dem Feuern auf und gibt dann ab', () => {
    const s = salveStand();
    const felder = [];
    for (let i = 0; i < salveGroesse(s); i++) felder.push({ x: i, y: 0 });
    for (const f of felder) markieren(s, f.x, f.y);
    const ergebnisse = salveFeuern(s);
    expect(ergebnisse).toHaveLength(felder.length);
    for (const f of felder) expect(s.meere[1].schuesse[`${f.x},${f.y}`]).toBeTruthy();
    expect(s.salve).toHaveLength(0);
    expect(s.dran).toBe(1);                  // ein Treffer bringt hier keinen Nachschuss
  });

  it('wird kleiner, wenn die eigene Flotte schrumpft', () => {
    const s = salveStand();
    const opfer = s.meere[0].schiffe[0];
    for (const f of opfer.felder) s.meere[0].schuesse[`${f.x},${f.y}`] = 'treffer';
    expect(salveGroesse(s)).toBe(9);
  });

  it('gibt es in den anderen Fassungen nicht', () => {
    const s = neuerStand(['A', 'B']);
    zufallsflotte(s.meere[0], streu(3));
    zufallsflotte(s.meere[1], streu(9));
    expect(salveGroesse(s)).toBe(0);
    expect(() => markieren(s, 0, 0)).toThrow();
  });
});

/* ============================================================ Sonderwaffen */

describe('Sonderwaffen', () => {
  const waffenStand = () => {
    const s = neuerStand(['A', 'B'], MODI.find((m) => m.id === 'waffen').regeln);
    s.modusId = 'waffen';
    // Ein bekanntes Meer für die Gegenseite: ein 5er waagerecht auf Zeile 0.
    s.meere[1].schiffe = [];
    s.meere[1].laengen = [5];
    setzen(s.meere[1], { x: 0, y: 0, laenge: 5, quer: true });
    s.meere[0].laengen = [5];
    setzen(s.meere[0], { x: 0, y: 9, laenge: 5, quer: true });
    return s;
  };

  it('gibt jeder Seite von jeder Waffe genau eine', () => {
    const s = waffenStand();
    expect(waffenVorrat(s, 0)).toEqual({ luftschlag: 1, radar: 1, mine: 1 });
    expect(waffenVorrat(s, 1)).toEqual({ luftschlag: 1, radar: 1, mine: 1 });
  });

  it('gibt es in den anderen Fassungen nicht', () => {
    const s = neuerStand(['A', 'B']);
    expect(waffenVorrat(s, 0)).toEqual({ luftschlag: 0, radar: 0, mine: 0 });
  });

  it('Luftschlag trifft drei Felder in einer Reihe', () => {
    const s = waffenStand();
    const treffer = luftschlag(s, 1, 0, true);
    expect(treffer).toHaveLength(3);
    expect(s.meere[1].schuesse['1,0']).toBe('treffer');
    expect(s.meere[1].schuesse['2,0']).toBe('treffer');
    expect(s.meere[1].schuesse['3,0']).toBe('treffer');
    expect(waffenVorrat(s, 0).luftschlag).toBe(0);
  });

  it('Luftschlag beendet den Zug auch bei Treffern', () => {
    const s = waffenStand();
    luftschlag(s, 1, 0, true);
    expect(s.dran).toBe(1);
  });

  it('Luftschlag geht nicht über den Rand hinaus', () => {
    const s = waffenStand();
    expect(() => luftschlag(s, 9, 0, true)).toThrow();
    expect(() => luftschlag(s, 0, 9, false)).toThrow();
    expect(waffenVorrat(s, 0).luftschlag).toBe(1);
  });

  it('Luftschlag gibt es nur einmal', () => {
    const s = waffenStand();
    luftschlag(s, 1, 0, true);
    s.dran = 0;
    expect(() => luftschlag(s, 5, 5, true)).toThrow();
  });

  it('Radar meldet nur die Anzahl, deckt aber nichts auf', () => {
    const s = waffenStand();
    const anzahl = radar(s, 1, 1);            // 3x3 um (1,1) enthält (0,0)…(2,0)
    expect(anzahl).toBe(3);
    expect(s.meere[1].schuesse['0,0']).toBeUndefined();
    expect(s.meere[1].schuesse['1,0']).toBeUndefined();
    expect(waffenVorrat(s, 0).radar).toBe(0);
    expect(s.dran).toBe(1);
  });

  it('Radar merkt sich, wo geschaut wurde — beide sehen das', () => {
    const s = waffenStand();
    radar(s, 1, 1);
    expect(s.meere[1].radare).toEqual([{ x: 1, y: 1, anzahl: 3 }]);
  });

  it('Mine wird auf das eigene Meer gelegt und bleibt geheim', () => {
    const s = waffenStand();
    mineLegen(s, 4, 4);
    expect(s.meere[0].minen).toEqual([{ x: 4, y: 4, ausgeloest: false }]);
    expect(waffenVorrat(s, 0).mine).toBe(0);
    expect(s.dran).toBe(1);
    // Die Gegenseite darf sie nicht sehen.
    const sicht = gegnerSicht(s, 1);
    expect(sicht.meere[0].minen).toEqual([]);
  });

  it('Mine liegt nicht auf einem schon beschossenen Feld', () => {
    const s = waffenStand();
    s.meere[0].schuesse['4,4'] = 'wasser';
    expect(() => mineLegen(s, 4, 4)).toThrow();
  });

  it('Wer auf eine Mine schießt, setzt einen Zug aus', () => {
    const s = waffenStand();
    mineLegen(s, 4, 4);                       // A legt, B ist dran
    schiessen(s, 4, 4);                       // B trifft die Mine
    expect(s.meere[0].minen[0].ausgeloest).toBe(true);
    // B setzt aus: A ist dran, und danach gleich wieder A.
    expect(s.dran).toBe(0);
    schiessen(s, 9, 9);
    expect(s.dran).toBe(0);
  });

  it('Eine ausgelöste Mine ist danach für beide sichtbar', () => {
    const s = waffenStand();
    mineLegen(s, 4, 4);
    schiessen(s, 4, 4);
    expect(gegnerSicht(s, 1).meere[0].minen).toEqual([{ x: 4, y: 4, ausgeloest: true }]);
  });

  it('Waffen gehen nur, wenn man dran ist und geschossen werden darf', () => {
    const s = waffenStand();
    s.dran = 1;
    expect(() => luftschlag(s, 1, 5, true)).not.toThrow();   // B darf
    s.fertig = 0;
    expect(() => radar(s, 3, 3)).toThrow();
  });

  it('Neue Partie füllt die Waffen wieder auf', () => {
    const s = waffenStand();
    luftschlag(s, 1, 0, true);
    partieNeu(s);
    expect(waffenVorrat(s, 0)).toEqual({ luftschlag: 1, radar: 1, mine: 1 });
  });
});

/* ============================================== Jeder Modus spielt sich durch */

describe('Jeder Modus spielt sich durch', () => {
  function partie(saat, modus, grenze = 4000) {
    let a = saat >>> 0;
    const rnd = () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const s = neuerStand(['A', 'B'], modus.regeln);
    s.modusId = modus.id;
    zufallsflotte(s.meere[0], rnd);
    zufallsflotte(s.meere[1], rnd);
    const { breite, hoehe } = masse(s.meere[0]);
    let n = 0;
    while (!vorbei(s) && n < grenze) {
      n += 1;
      const ziel = s.meere[s.dran === 0 ? 1 : 0];
      const frei = [];
      for (let x = 0; x < breite; x++) {
        for (let y = 0; y < hoehe; y++) if (!ziel.schuesse[`${x},${y}`]) frei.push({ x, y });
      }
      if (!frei.length) break;
      const f = frei[Math.floor(rnd() * frei.length)];
      if (salveGroesse(s) > 0) {
        markieren(s, f.x, f.y);
        if (s.salve.length >= Math.min(salveGroesse(s), frei.length)) salveFeuern(s);
        continue;
      }
      schiessen(s, f.x, f.y);
    }
    return { s, n, beendet: vorbei(s) };
  }

  for (const m of MODI) {
    it(`${m.titel}: 30 Partien, jede endet mit einem Sieger`, () => {
      for (let saat = 1; saat <= 30; saat++) {
        const p = partie(saat, m);
        expect(p.beendet, `${m.id}, Saat ${saat} hängt nach ${p.n} Zügen`).toBe(true);
      }
    });
  }

  it('Kurz braucht deutlich weniger Schüsse als Klassisch', () => {
    const mittel = (id) => {
      let summe = 0;
      for (let saat = 1; saat <= 30; saat++) summe += partie(saat, MODI.find((m) => m.id === id)).n;
      return summe / 30;
    };
    expect(mittel('kurz')).toBeLessThan(mittel('klassisch') * 0.75);
  });
});
