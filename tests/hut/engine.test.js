import { describe, it, expect } from 'vitest';
import {
  RING, HUETE, HOF, WEGLAENGE,
  neuerStand, wuerfeln, zuege, ziehen, ziehbar, feldVon,
  stapelAuf, imZiel, gefangene, wuerfeErlaubt, zugBeenden, partieNeu,
  vorbei, gewinner, alsCode, ausCode,
} from '../../hut/src/engine.js';

/** Ein Stand mit gesetzten Hüten. */
function bauen(huete, extra = {}) {
  const s = neuerStand(['A', 'B']);
  Object.assign(s, extra);
  huete.forEach((liste, spieler) => {
    liste.forEach((h, i) => { s.huete[spieler][i] = { ...h, traegt: h.traegt ? [...h.traegt] : [] }; });
  });
  return s;
}

const hof = () => ({ ort: 'hof', schritt: 0, traegt: [] });
const bahn = (schritt, traegt = []) => ({ ort: 'bahn', schritt, traegt });
const ziel = () => ({ ort: 'ziel', schritt: 0, traegt: [] });

describe('Brett', () => {
  it('hat einen Ring aus 20 Feldern', () => {
    expect(RING).toBe(20);
  });

  it('gibt jedem vier Hüte', () => {
    expect(HUETE).toBe(4);
    const s = neuerStand(['A', 'B']);
    expect(s.huete[0]).toHaveLength(4);
    expect(s.huete[1]).toHaveLength(4);
  });

  it('setzt die Höfe sich gegenüber', () => {
    expect(HOF).toEqual([0, 10]);
  });

  it('schickt beide einmal ganz herum', () => {
    // Die entscheidende Regel: nur so laufen beide über dieselben Felder und
    // können sich überhaupt fangen.
    expect(WEGLAENGE).toBe(RING);
  });

  it('lässt beide Seiten jedes Feld benutzen', () => {
    const felderVon = (spieler) => new Set(
      Array.from({ length: WEGLAENGE }, (_, i) => feldVon(spieler, i)));
    const a = felderVon(0);
    const b = felderVon(1);
    expect(a.size).toBe(RING);
    expect([...a].every((f) => b.has(f))).toBe(true);
  });

  it('rechnet Schritte in absolute Felder um', () => {
    expect(feldVon(0, 0)).toBe(0);
    expect(feldVon(0, 5)).toBe(5);
    expect(feldVon(1, 0)).toBe(10);
    expect(feldVon(1, 15)).toBe(5);          // läuft über die 19 hinaus
  });

  it('bringt einen vollen Rundlauf wieder in den eigenen Hof', () => {
    expect(feldVon(0, WEGLAENGE)).toBe(HOF[0]);
    expect(feldVon(1, WEGLAENGE)).toBe(HOF[1]);
  });
});

describe('neuerStand', () => {
  it('stellt alle Hüte in den eigenen Hof', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.huete[0].every((h) => h.ort === 'hof')).toBe(true);
    expect(s.huete[0].every((h) => h.traegt.length === 0)).toBe(true);
  });

  it('beginnt bei Spieler 0 ohne Wurf', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.dran).toBe(0);
    expect(s.wurf).toBeNull();
    expect(s.fertig).toBeNull();
  });
});

describe('Würfeln', () => {
  it('liefert eine Zahl von eins bis sechs', () => {
    const s = neuerStand(['A', 'B']);
    for (let i = 0; i < 40; i++) {
      s.wurf = null;
      s.wuerfeUebrig = 1;
      const w = wuerfeln(s, Math.random);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(6);
    }
  });

  it('gibt genau einen Wurf je Zug', () => {
    const s = neuerStand(['A', 'B']);
    expect(wuerfeErlaubt(s, 0)).toBe(1);
    wuerfeln(s, Math.random);
    expect(() => wuerfeln(s, Math.random)).toThrow();
  });
});

describe('Ziehen', () => {
  it('bringt einen Hut aus dem Hof auf die Bahn', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 3;
    const z = zuege(s);
    expect(z.length).toBeGreaterThan(0);
    expect(z[0].nach).toEqual({ ort: 'bahn', schritt: 3 });
  });

  it('braucht keine Sechs zum Losfahren', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 1;
    expect(zuege(s).length).toBeGreaterThan(0);
  });

  it('zieht auf der Bahn im Uhrzeigersinn weiter', () => {
    const s = bauen([[bahn(2), hof(), hof(), hof()], []], { wurf: 4 });
    const z = zuege(s).find((x) => x.figur === 0);
    expect(z.nach).toEqual({ ort: 'bahn', schritt: 6 });
  });

  it('lässt nicht auf den eigenen Hut ziehen', () => {
    const s = bauen([[bahn(2), bahn(6), hof(), hof()], []], { wurf: 4 });
    expect(zuege(s).map((z) => z.figur)).not.toContain(0);
  });

  it('setzt den Wurf um und gibt danach ab', () => {
    const s = bauen([[bahn(2), hof(), hof(), hof()], []], { wurf: 4 });
    ziehen(s, 0);
    expect(s.huete[0][0].schritt).toBe(6);
    expect(s.dran).toBe(1);
    expect(s.wurf).toBeNull();
  });

  it('weist einen unmöglichen Zug ab', () => {
    const s = bauen([[bahn(2), bahn(6), hof(), hof()], []], { wurf: 4 });
    expect(() => ziehen(s, 0)).toThrow();
  });
});

describe('Fangen', () => {
  it('nimmt einen fremden Hut unter den eigenen', () => {
    // A zieht auf Feld 6; für B ist das Schritt 16 (10 + 16 = 26 → Feld 6).
    const s = bauen([[bahn(2), hof(), hof(), hof()],
      [bahn(16), hof(), hof(), hof()]], { wurf: 4 });
    const z = zuege(s).find((x) => x.figur === 0);
    expect(z.faengt).toEqual({ spieler: 1, figur: 0 });
    ziehen(s, 0);
    expect(s.huete[0][0].traegt).toEqual([1]);
    expect(s.huete[1][0].ort).toBe('gefangen');
  });

  it('nimmt einen ganzen Stapel mit', () => {
    const s = bauen([[bahn(2), hof(), hof(), hof()],
      [bahn(16, [0]), hof(), hof(), hof()]], { wurf: 4 });
    ziehen(s, 0);
    // Der eigene Hut trägt jetzt den Fänger samt dessen Beute.
    expect(s.huete[0][0].traegt).toEqual([1, 0]);
  });

  it('zählt, wie viele einer trägt', () => {
    const s = bauen([[bahn(2, [1, 1]), hof(), hof(), hof()], []]);
    expect(gefangene(s, 0)).toBe(2);
  });
});

describe('Ins Ziel', () => {
  it('braucht den genauen Wurf', () => {
    const s = bauen([[bahn(18), hof(), hof(), hof()], []], { wurf: 3 });
    expect(zuege(s).some((z) => z.figur === 0)).toBe(false);   // 21 > 20
    const s2 = bauen([[bahn(18), hof(), hof(), hof()], []], { wurf: 2 });
    expect(zuege(s2).find((z) => z.figur === 0).nach.ort).toBe('ziel');
  });

  it('stellt den Hut ins Ziel', () => {
    const s = bauen([[bahn(18), hof(), hof(), hof()], []], { wurf: 2 });
    ziehen(s, 0);
    expect(s.huete[0][0].ort).toBe('ziel');
    expect(imZiel(s, 0)).toBe(1);
  });

  it('gibt getragene Hüte an ihren Besitzer zurück — in dessen Hof', () => {
    const s = bauen([[bahn(18, [1, 1]), hof(), hof(), hof()],
      [{ ort: 'gefangen', schritt: 0, traegt: [] },
        { ort: 'gefangen', schritt: 0, traegt: [] }, hof(), hof()]], { wurf: 2 });
    ziehen(s, 0);
    expect(s.huete[0][0].traegt).toEqual([]);
    expect(s.huete[1].filter((h) => h.ort === 'hof')).toHaveLength(4);
  });

  it('lässt einen Hut im Ziel stehen', () => {
    const s = bauen([[ziel(), hof(), hof(), hof()], []], { wurf: 3 });
    expect(zuege(s).some((z) => z.figur === 0)).toBe(false);
  });

  it('erlaubt mehrere Hüte im selben Ziel', () => {
    const s = bauen([[ziel(), bahn(18), hof(), hof()], []], { wurf: 2 });
    ziehen(s, 1);
    expect(imZiel(s, 0)).toBe(2);
  });
});

describe('Spielende', () => {
  it('gewinnt, wer alle vier Hüte ins Ziel bringt', () => {
    const s = bauen([[ziel(), ziel(), ziel(), bahn(18)], []], { wurf: 2 });
    ziehen(s, 3);
    expect(imZiel(s, 0)).toBe(4);
    expect(vorbei(s)).toBe(true);
    expect(gewinner(s)).toBe(0);
    expect(s.siege).toEqual([1, 0]);
  });

  it('meldet einen Sieg von Spieler 0, obwohl der Index falsy ist', () => {
    const s = neuerStand(['A', 'B']);
    s.fertig = 0;
    expect(vorbei(s)).toBe(true);
    expect(Boolean(s.fertig)).toBe(false);
  });
});

describe('Gefangene Hüte', () => {
  it('können nicht selbst ziehen', () => {
    const s = bauen([[bahn(2), hof(), hof(), hof()],
      [{ ort: 'gefangen', schritt: 0, traegt: [] }, hof(), hof(), hof()]],
    { wurf: 3, dran: 1 });
    expect(zuege(s).some((z) => z.figur === 0)).toBe(false);
  });

  it('lassen die Partie weitergehen, solange noch etwas im Hof steht', () => {
    const s = bauen([[hof(), hof(), hof(), hof()],
      [{ ort: 'gefangen', schritt: 0, traegt: [] }, hof(), hof(), hof()]],
    { wurf: 3, dran: 1 });
    expect(zuege(s).length).toBe(3);
  });
});

describe('stapelAuf', () => {
  it('findet den Hut auf einem Feld', () => {
    const s = bauen([[bahn(2), hof(), hof(), hof()],
      [bahn(16), hof(), hof(), hof()]], {});
    expect(stapelAuf(s, 2)).toEqual({ spieler: 0, figur: 0 });
    expect(stapelAuf(s, 6)).toEqual({ spieler: 1, figur: 0 });
    expect(stapelAuf(s, 9)).toBeNull();
  });
});

describe('Zug beenden', () => {
  it('gibt ab, wenn kein Zug möglich war', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 3;
    zugBeenden(s);
    expect(s.dran).toBe(1);
    expect(s.wurf).toBeNull();
  });
});

describe('Neue Partie', () => {
  it('räumt das Brett, behält die Siege, der Verlierer beginnt', () => {
    const s = bauen([[ziel(), ziel(), ziel(), ziel()], []], { siege: [2, 1], fertig: 0, dran: 0 });
    partieNeu(s);
    expect(s.huete[0].every((h) => h.ort === 'hof')).toBe(true);
    expect(s.siege).toEqual([2, 1]);
    expect(s.fertig).toBeNull();
    expect(s.dran).toBe(1);
  });
});

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.siege = [2, 6];
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([2, 6]);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('SEE1-abc')).toThrow();
  });
});

describe('Tausend Partien gegen sich selbst', () => {
  /* Der wichtigste Fall überhaupt: In der ersten Fassung lief jeder nur bis
     zum gegenüberliegenden Hof. Beide benutzten damit je eine eigene
     Ringhälfte, und in 2000 Probepartien wurde kein einziges Mal gefangen —
     obwohl alle Einzeltests grün waren. Dieser Test hätte das gemerkt. */

  function partieSpielen(saat) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = neuerStand(['A', 'B']);
    let schritte = 0;
    while (!vorbei(s) && schritte < 30000) {
      schritte += 1;
      if (s.wurf === null) wuerfeln(s, rnd);
      const moeglich = zuege(s);
      if (moeglich.length) ziehen(s, moeglich[Math.floor(rnd() * moeglich.length)].figur);
      else zugBeenden(s);
    }
    return { s, schritte };
  }

  it('läuft jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 1000; saat++) {
      const { s, schritte } = partieSpielen(saat);
      expect(vorbei(s), `Saat ${saat} hängt nach ${schritte} Schritten`).toBe(true);
    }
  });

  it('fängt regelmäßig — sonst wäre es ein anderes Spiel', () => {
    let faenge = 0;
    let ohneFang = 0;
    for (let saat = 1; saat <= 200; saat++) {
      let x = saat;
      const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
      const s = neuerStand(['A', 'B']);
      let n = 0;
      let hier = 0;
      while (!vorbei(s) && n < 30000) {
        n += 1;
        if (s.wurf === null) wuerfeln(s, rnd);
        const m = zuege(s);
        if (m.length) {
          const z = m[Math.floor(rnd() * m.length)];
          if (z.faengt) hier += 1;
          ziehen(s, z.figur);
        } else zugBeenden(s);
      }
      faenge += hier;
      if (!hier) ohneFang += 1;
    }
    expect(faenge / 200).toBeGreaterThan(2);
    expect(ohneFang).toBeLessThan(20);
  });

  it('verteilt die Siege ungefähr gleich', () => {
    let a = 0;
    for (let saat = 1; saat <= 1000; saat++) if (partieSpielen(saat).s.fertig === 0) a += 1;
    expect(a).toBeGreaterThan(350);
    expect(a).toBeLessThan(650);
  });

  it('verliert nie einen Hut und erreicht nie einen ungültigen Zustand', () => {
    for (let saat = 1; saat <= 200; saat++) {
      const { s } = partieSpielen(saat);
      for (let spieler = 0; spieler < 2; spieler++) {
        expect(s.huete[spieler]).toHaveLength(HUETE);
        for (const h of s.huete[spieler]) {
          expect(['hof', 'bahn', 'ziel', 'gefangen']).toContain(h.ort);
          if (h.ort === 'bahn') {
            expect(h.schritt).toBeGreaterThanOrEqual(0);
            expect(h.schritt).toBeLessThan(WEGLAENGE);
          }
        }
        // Zwei eigene Hüte nie auf demselben Bahnfeld.
        const felder = s.huete[spieler].filter((h) => h.ort === 'bahn').map((h) => h.schritt);
        expect(new Set(felder).size).toBe(felder.length);
      }
      // Auch über beide Seiten hinweg steht nie mehr als ein Stapel auf einem Feld.
      const alle = [];
      for (let spieler = 0; spieler < 2; spieler++) {
        for (const h of s.huete[spieler]) {
          if (h.ort === 'bahn') alle.push(feldVon(spieler, h.schritt));
        }
      }
      expect(new Set(alle).size, `Saat ${saat}: zwei Stapel auf einem Feld`).toBe(alle.length);
    }
  });
});

/* --------------------------------------------------------------- Das Brett */

describe('Brettgeometrie', () => {
  it('hat 20 Ringfelder, alle verschieden', async () => {
    const { RINGFELDER } = await import('../../hut/src/brett.js');
    expect(RINGFELDER).toHaveLength(20);
    expect(new Set(RINGFELDER.map(([x, y]) => `${x},${y}`)).size).toBe(20);
  });

  it('läuft lückenlos herum, ohne Diagonalen', async () => {
    const { RINGFELDER } = await import('../../hut/src/brett.js');
    for (let i = 0; i < RINGFELDER.length; i++) {
      const [x1, y1] = RINGFELDER[i];
      const [x2, y2] = RINGFELDER[(i + 1) % RINGFELDER.length];
      expect(Math.abs(x1 - x2) + Math.abs(y1 - y2), `Lücke bei ${i}`).toBe(1);
    }
  });

  it('legt die Höfe in gegenüberliegende Ecken', async () => {
    const { RINGFELDER } = await import('../../hut/src/brett.js');
    expect(RINGFELDER[HOF[0]]).toEqual([0, 0]);
    expect(RINGFELDER[HOF[1]]).toEqual([5, 5]);
  });

  it('gibt jedem vier Warteplätze und vier Zielplätze, ohne Überschneidung', async () => {
    const { RINGFELDER, HOFFELDER, ZIELFELDER } = await import('../../hut/src/brett.js');
    for (const liste of [...HOFFELDER, ...ZIELFELDER]) expect(liste).toHaveLength(4);
    const alle = [...RINGFELDER, ...HOFFELDER.flat(), ...ZIELFELDER.flat()]
      .map(([x, y]) => `${x},${y}`);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('bleibt im 6×6-Raster', async () => {
    const { RINGFELDER, HOFFELDER, ZIELFELDER, BRETTGROESSE } = await import('../../hut/src/brett.js');
    expect(BRETTGROESSE).toBe(6);
    for (const [x, y] of [...RINGFELDER, ...HOFFELDER.flat(), ...ZIELFELDER.flat()]) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(6);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(6);
    }
  });
});
