import { describe, it, expect } from 'vitest';
import {
  BREITE, HOEHE, FLOTTE, FELDER_GESAMT, SPALTEN,
  neuerStand, leeresMeer, passt, setzen, entfernen, zufallsflotte, flotteFertig,
  schiessen, schiffAn, versenkt, alleVersenkt, umgebung, feldName, feldAus,
  bereit, phase, gegnerSicht, alsCode, ausCode, vorbei, flotteAuffuellen,
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
        for (const n of umgebung(s.felder)) {
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
    const u = umgebung(felder);
    const alsText = u.map((f) => `${f.x},${f.y}`);
    expect(alsText).toContain('2,0');
    expect(alsText).toContain('0,1');
    expect(alsText).toContain('2,1');
    expect(alsText).not.toContain('0,0');
    expect(alsText).not.toContain('1,0');
  });

  it('lässt nichts außerhalb der Karte übrig', () => {
    for (const f of umgebung([{ x: 0, y: 0 }])) {
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
