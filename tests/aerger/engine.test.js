import { describe, it, expect } from 'vitest';
import {
  RING, HAUSLAENGE, START,
  neuerStand, wuerfeln, zuege, ziehen, ziehbar, feldVon, gewinner,
  figurenAuf, alleImHaus, wuerfeErlaubt, zugBeenden, partieNeu, alsCode, ausCode, vorbei,
} from '../../aerger/src/engine.js';

/** Ein Stand mit gesetzten Figuren — kürzt das Aufbauen in den Tests ab. */
function bauen(figuren, extra = {}) {
  const s = neuerStand(['A', 'B']);
  Object.assign(s, extra);
  figuren.forEach((liste, spieler) => {
    liste.forEach((f, i) => { s.figuren[spieler][i] = { ...f }; });
  });
  return s;
}

const basis = () => ({ ort: 'basis', schritt: 0 });
const bahn = (schritt) => ({ ort: 'bahn', schritt });
const haus = (schritt) => ({ ort: 'haus', schritt });

/** Würfel, der eine feste Folge liefert. */
const folge = (...zahlen) => {
  let i = 0;
  return () => (zahlen[Math.min(i++, zahlen.length - 1)] - 0.5) / 6;
};

describe('Brett', () => {
  it('hat 40 Felder und vier Hausfelder', () => {
    expect(RING).toBe(40);
    expect(HAUSLAENGE).toBe(4);
  });

  it('setzt die Startfelder gegenüber', () => {
    expect(START).toEqual([0, 20]);
  });

  it('rechnet Schritte in absolute Felder um', () => {
    expect(feldVon(0, 0)).toBe(0);
    expect(feldVon(0, 39)).toBe(39);
    expect(feldVon(1, 0)).toBe(20);
    expect(feldVon(1, 25)).toBe(5);       // läuft über die 39 hinaus
  });
});

describe('neuerStand', () => {
  it('stellt alle Figuren in die Basis', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.figuren).toHaveLength(2);
    expect(s.figuren[0]).toHaveLength(4);
    expect(s.figuren[0].every((f) => f.ort === 'basis')).toBe(true);
  });

  it('beginnt bei Spieler 0 ohne Wurf', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.dran).toBe(0);
    expect(s.wurf).toBeNull();
    expect(s.fertig).toBeNull();
  });

  it('nimmt die Regelvorgaben an', () => {
    const s = neuerStand(['A', 'B'], { figuren: 2, mussSchlagen: true });
    expect(s.figuren[0]).toHaveLength(2);
    expect(s.regeln.mussSchlagen).toBe(true);
  });
});

describe('Würfeln', () => {
  it('liefert eine Zahl von eins bis sechs', () => {
    const s = neuerStand(['A', 'B']);
    for (let i = 0; i < 50; i++) {
      s.wurf = null;
      s.wuerfeUebrig = 3;
      const w = wuerfeln(s, Math.random);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(6);
    }
  });

  it('erlaubt drei Würfe, solange keine Figur auf der Bahn steht', () => {
    const s = neuerStand(['A', 'B']);
    expect(wuerfeErlaubt(s, 0)).toBe(3);
  });

  it('erlaubt nur einen Wurf, sobald eine Figur auf der Bahn steht', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()], []]);
    expect(wuerfeErlaubt(s, 0)).toBe(1);
  });

  it('erlaubt drei Würfe, wenn alle übrigen Figuren schon im Haus sind', () => {
    const s = bauen([[haus(0), haus(1), haus(2), basis()], []]);
    expect(wuerfeErlaubt(s, 0)).toBe(3);
  });

  it('würfelt nicht zweimal, ohne den Wurf zu verbrauchen', () => {
    const s = neuerStand(['A', 'B']);
    wuerfeln(s, folge(4));
    expect(() => wuerfeln(s, folge(4))).toThrow();
  });
});

describe('Züge finden', () => {
  it('bietet ohne Sechs keinen Ausstieg aus der Basis', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 3;
    expect(zuege(s)).toEqual([]);
  });

  it('bringt mit einer Sechs eine Figur auf das Startfeld', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 6;
    const z = zuege(s);
    expect(z).toHaveLength(1);
    expect(z[0].nach).toEqual({ ort: 'bahn', schritt: 0 });
  });

  it('zieht auf der Bahn um die Augenzahl weiter', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()], []], { wurf: 4 });
    expect(zuege(s)[0].nach).toEqual({ ort: 'bahn', schritt: 7 });
  });

  it('lässt nicht auf die eigene Figur ziehen', () => {
    const s = bauen([[bahn(3), bahn(7), basis(), basis()], []], { wurf: 4 });
    const z = zuege(s);
    expect(z.map((x) => x.figur)).not.toContain(0);
  });

  it('erlaubt das Schlagen einer fremden Figur', () => {
    // A steht auf Schritt 3 (Feld 3), B auf Feld 7 — das ist Bs Schritt 27.
    const s = bauen([[bahn(3), basis(), basis(), basis()],
      [bahn(27), basis(), basis(), basis()]], { wurf: 4 });
    const z = zuege(s);
    expect(z[0].schlaegt).toEqual({ spieler: 1, figur: 0 });
  });

  it('führt ins Haus, wenn es genau passt', () => {
    const s = bauen([[bahn(38), basis(), basis(), basis()], []], { wurf: 3 });
    expect(zuege(s)[0].nach).toEqual({ ort: 'haus', schritt: 1 });
  });

  it('lässt nicht über das Haus hinausziehen', () => {
    // Keine Figur in der Basis, sonst greift die Sechs-Pflicht statt der Hausregel.
    const s = bauen([[bahn(38), haus(0), haus(1), haus(2)], []], { wurf: 6 });
    expect(zuege(s)).toEqual([]);
  });

  it('lässt im Haus keine eigene Figur überspringen', () => {
    const s = bauen([[bahn(39), haus(1), basis(), basis()], []], { wurf: 3 });
    expect(zuege(s)).toEqual([]);      // müsste über Hausfeld 1 hinweg
  });

  it('zieht innerhalb des Hauses weiter', () => {
    const s = bauen([[haus(0), basis(), basis(), basis()], []], { wurf: 2 });
    expect(zuege(s)[0].nach).toEqual({ ort: 'haus', schritt: 2 });
  });

  it('gibt keine Züge, wenn alle Figuren im Haus stehen', () => {
    const s = bauen([[haus(0), haus(1), haus(2), haus(3)], []], { wurf: 6 });
    expect(zuege(s)).toEqual([]);
  });
});

describe('Sechs-Pflicht', () => {
  it('zwingt bei einer Sechs zum Herauskommen', () => {
    const s = bauen([[bahn(10), basis(), basis(), basis()], []], { wurf: 6 });
    const z = zuege(s);
    expect(z).toHaveLength(1);
    expect(z[0].nach).toEqual({ ort: 'bahn', schritt: 0 });
  });

  it('zwingt die Figur vom eigenen Startfeld, wenn dort eine steht', () => {
    const s = bauen([[bahn(0), bahn(10), basis(), basis()], []], { wurf: 6 });
    const z = zuege(s);
    expect(z).toHaveLength(1);
    expect(z[0].figur).toBe(0);
    expect(z[0].nach).toEqual({ ort: 'bahn', schritt: 6 });
  });

  it('lässt alles zu, wenn keine Figur mehr in der Basis ist', () => {
    const s = bauen([[bahn(0), bahn(10), bahn(20), bahn(30)], []], { wurf: 6 });
    expect(zuege(s)).toHaveLength(4);
  });

  it('lässt sich abschalten', () => {
    const s = bauen([[bahn(10), basis(), basis(), basis()], []],
      { wurf: 6, regeln: { figuren: 4, mussSchlagen: false, strengeSechs: false } });
    expect(zuege(s).length).toBeGreaterThan(1);
  });
});

describe('Schlagen ist Pflicht', () => {
  it('lässt nur schlagende Züge übrig, wenn eingeschaltet', () => {
    const s = bauen([[bahn(3), bahn(10), basis(), basis()],
      [bahn(27), basis(), basis(), basis()]],
    { wurf: 4, regeln: { figuren: 4, mussSchlagen: true, strengeSechs: true } });
    const z = zuege(s);
    expect(z).toHaveLength(1);
    expect(z[0].figur).toBe(0);
  });

  it('ändert nichts, wenn nichts zu schlagen ist', () => {
    const s = bauen([[bahn(3), bahn(10), basis(), basis()], []],
      { wurf: 4, regeln: { figuren: 4, mussSchlagen: true, strengeSechs: true } });
    expect(zuege(s)).toHaveLength(2);
  });
});

describe('Ziehen', () => {
  it('setzt die Figur und verbraucht den Wurf', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()], []], { wurf: 4 });
    ziehen(s, 0);
    expect(s.figuren[0][0]).toEqual({ ort: 'bahn', schritt: 7 });
    expect(s.wurf).toBeNull();
  });

  it('schickt die geschlagene Figur in die Basis', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()],
      [bahn(27), basis(), basis(), basis()]], { wurf: 4 });
    ziehen(s, 0);
    expect(s.figuren[1][0].ort).toBe('basis');
    expect(s.letzteAktion.art).toBe('geschlagen');
  });

  it('gibt nach einer Sechs denselben Spieler wieder dran', () => {
    const s = bauen([[bahn(3), bahn(10), bahn(20), bahn(30)], []], { wurf: 6 });
    ziehen(s, 0);
    expect(s.dran).toBe(0);
    expect(s.wuerfeUebrig).toBe(1);
  });

  it('gibt sonst an die Gegenseite ab', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()], []], { wurf: 4 });
    ziehen(s, 0);
    expect(s.dran).toBe(1);
  });

  it('weist einen unmöglichen Zug ab', () => {
    const s = bauen([[bahn(3), bahn(7), basis(), basis()], []], { wurf: 4 });
    expect(() => ziehen(s, 0)).toThrow();
  });

  it('erkennt das Spielende', () => {
    const s = bauen([[haus(1), haus(2), haus(3), bahn(39)], []], { wurf: 1 });
    ziehen(s, 3);
    expect(alleImHaus(s, 0)).toBe(true);
    expect(gewinner(s)).toBe(0);
    expect(s.fertig).toBe(0);
  });

  it('zählt den Sieg auf das Konto', () => {
    const s = bauen([[haus(1), haus(2), haus(3), bahn(39)], []], { wurf: 1 });
    ziehen(s, 3);
    expect(s.siege).toEqual([1, 0]);
  });
});

describe('vorbei', () => {
  it('meldet einen Sieg von Spieler 0, obwohl der Index falsy ist', () => {
    const s = neuerStand(['A', 'B']);
    expect(vorbei(s)).toBe(false);
    s.fertig = 0;
    expect(vorbei(s)).toBe(true);
    expect(Boolean(s.fertig)).toBe(false);   // genau deshalb gibt es die Funktion
  });
});

describe('Zug beenden', () => {
  it('gibt ab, wenn es keinen Zug gibt und die Würfe alle sind', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 3;
    s.wuerfeUebrig = 0;
    zugBeenden(s);
    expect(s.dran).toBe(1);
    expect(s.wurf).toBeNull();
  });

  it('lässt weiterwürfeln, solange Würfe übrig sind', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 3;
    s.wuerfeUebrig = 2;
    zugBeenden(s);
    expect(s.dran).toBe(0);
    expect(s.wurf).toBeNull();
  });
});

describe('Hilfsfunktionen', () => {
  it('findet die Figuren auf einem Feld', () => {
    const s = bauen([[bahn(3), basis(), basis(), basis()],
      [bahn(0), basis(), basis(), basis()]], {});
    expect(figurenAuf(s, 3)).toEqual([{ spieler: 0, figur: 0 }]);
    expect(figurenAuf(s, 20)).toEqual([{ spieler: 1, figur: 0 }]);   // Bs Startfeld
    expect(figurenAuf(s, 7)).toEqual([]);
  });

  it('findet beide, wenn sie auf demselben Feld stünden', () => {
    // Bs Schritt 23 ist absolut Feld 3 — dasselbe wie As Schritt 3.
    const s = bauen([[bahn(3), basis(), basis(), basis()],
      [bahn(23), basis(), basis(), basis()]], {});
    expect(figurenAuf(s, 3)).toHaveLength(2);
  });

  it('sagt, ob eine Figur ziehen kann', () => {
    const s = bauen([[bahn(3), bahn(7), basis(), basis()], []], { wurf: 4 });
    expect(ziehbar(s, 0)).toBe(false);
    expect(ziehbar(s, 1)).toBe(true);
  });
});

describe('Neue Partie', () => {
  it('räumt das Brett, behält aber die Siege', () => {
    const s = bauen([[haus(0), haus(1), haus(2), haus(3)], []], { siege: [3, 1], fertig: 0 });
    partieNeu(s);
    expect(s.figuren[0].every((f) => f.ort === 'basis')).toBe(true);
    expect(s.siege).toEqual([3, 1]);
    expect(s.fertig).toBeNull();
  });

  it('lässt den Verlierer anfangen', () => {
    const s = bauen([[haus(0), haus(1), haus(2), haus(3)], []], { fertig: 0, dran: 0 });
    partieNeu(s);
    expect(s.dran).toBe(1);
  });
});

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.siege = [4, 2];
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([4, 2]);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('HMS1-abc')).toThrow();
  });
});

describe('Tausend Partien gegen sich selbst', () => {
  /** Wählt immer den ersten möglichen Zug — reicht, um Abläufe zu prüfen. */
  function partieSpielen(saat) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = neuerStand(['A', 'B']);
    let zuegeGesamt = 0;
    while (!vorbei(s) && zuegeGesamt < 20000) {
      zuegeGesamt += 1;
      if (s.wurf === null) wuerfeln(s, rnd);
      const moeglich = zuege(s);
      if (moeglich.length) ziehen(s, moeglich[0].figur);
      else zugBeenden(s);
    }
    return { s, zuegeGesamt };
  }

  it('läuft jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 1000; saat++) {
      const { s, zuegeGesamt } = partieSpielen(saat);
      expect(vorbei(s), `Saat ${saat} hängt nach ${zuegeGesamt} Schritten`).toBe(true);
    }
  });

  it('verteilt die Siege ungefähr gleich', () => {
    let a = 0;
    for (let saat = 1; saat <= 1000; saat++) if (partieSpielen(saat).s.fertig === 0) a += 1;
    expect(a).toBeGreaterThan(350);
    expect(a).toBeLessThan(650);
  });

  it('erreicht nie einen ungültigen Zustand', () => {
    for (let saat = 1; saat <= 200; saat++) {
      const { s } = partieSpielen(saat);
      for (const seite of s.figuren) {
        for (const f of seite) {
          expect(['basis', 'bahn', 'haus']).toContain(f.ort);
          if (f.ort === 'bahn') expect(f.schritt).toBeLessThan(RING);
          if (f.ort === 'haus') expect(f.schritt).toBeLessThan(HAUSLAENGE);
        }
        // Zwei eigene Figuren dürfen nie auf demselben Feld stehen.
        const bahnfelder = seite.filter((f) => f.ort === 'bahn').map((f) => f.schritt);
        expect(new Set(bahnfelder).size).toBe(bahnfelder.length);
        const hausfelder = seite.filter((f) => f.ort === 'haus').map((f) => f.schritt);
        expect(new Set(hausfelder).size).toBe(hausfelder.length);
      }
    }
  });
});

/* --------------------------------------------------------------- Das Brett */

describe('Brettgeometrie', () => {
  it('hat 40 Ringfelder, alle verschieden', async () => {
    const { RINGFELDER } = await import('../../aerger/src/brett.js');
    expect(RINGFELDER).toHaveLength(40);
    expect(new Set(RINGFELDER.map(([x, y]) => `${x},${y}`)).size).toBe(40);
  });

  it('bleibt im 11×11-Raster', async () => {
    const { RINGFELDER, HAUSFELDER, BASISFELDER } = await import('../../aerger/src/brett.js');
    for (const liste of [RINGFELDER, ...HAUSFELDER, ...BASISFELDER]) {
      for (const [x, y] of liste) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(10);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(10);
      }
    }
  });

  it('legt die Startfelder diagonal gegenüber', async () => {
    const { RINGFELDER } = await import('../../aerger/src/brett.js');
    expect(RINGFELDER[START[0]]).toEqual([0, 4]);
    expect(RINGFELDER[START[1]]).toEqual([10, 6]);
  });

  it('lässt den Ring lückenlos laufen — jedes Feld grenzt ans nächste', async () => {
    const { RINGFELDER } = await import('../../aerger/src/brett.js');
    for (let i = 0; i < 40; i++) {
      const [x1, y1] = RINGFELDER[i];
      const [x2, y2] = RINGFELDER[(i + 1) % 40];
      expect(Math.abs(x1 - x2) + Math.abs(y1 - y2), `Lücke zwischen ${i} und ${i + 1}`).toBe(1);
    }
  });

  it('setzt die Häuser ans Ende der jeweiligen Bahn', async () => {
    const { RINGFELDER, HAUSFELDER } = await import('../../aerger/src/brett.js');
    for (const spieler of [0, 1]) {
      expect(HAUSFELDER[spieler]).toHaveLength(4);
      const letztesRing = RINGFELDER[(START[spieler] + 39) % 40];
      const erstesHaus = HAUSFELDER[spieler][0];
      expect(Math.abs(letztesRing[0] - erstesHaus[0])
        + Math.abs(letztesRing[1] - erstesHaus[1])).toBe(1);
    }
  });

  it('gibt jedem vier Basisplätze, die sich nicht überschneiden', async () => {
    const { RINGFELDER, HAUSFELDER, BASISFELDER } = await import('../../aerger/src/brett.js');
    expect(BASISFELDER[0]).toHaveLength(4);
    expect(BASISFELDER[1]).toHaveLength(4);
    const alle = [...RINGFELDER, ...HAUSFELDER.flat(), ...BASISFELDER.flat()]
      .map(([x, y]) => `${x},${y}`);
    expect(new Set(alle).size).toBe(alle.length);
  });
});
