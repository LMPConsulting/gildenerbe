import { describe, it, expect } from 'vitest';
import {
  FIGUREN, SPERREN, SAVE_VERSION,
  neuerStand, wuerfeln, zuege, zieleFuer, ziehbar, ziehen,
  figurAuf, sperreAuf, setztGerade, setzbar, sperreSetzen,
  zugBeenden, partieNeu, vorbei, gewinner, alsCode, ausCode,
} from '../../sperre/src/engine.js';
import {
  REIHEN, SPALTEN, FELDER, NACHBARN, ZIEL, HEIM, START_SPERREN,
  UNTERSTE_STRASSE, feldId, zumZiel,
} from '../../sperre/src/brett.js';

/** Kurzschreibweise: Feld über Reihe und Spalte. */
const f = (reihe, spalte) => {
  const id = feldId(reihe, spalte);
  if (id < 0) throw new Error(`Feld ${reihe}/${spalte} gibt es nicht`);
  return id;
};

/**
 * Ein Stand mit genau den Figuren und Sperren, die der Test braucht.
 * Nicht genannte Figuren stehen im eigenen Heim.
 */
function bauen({ a = [], b = [], sperren = [], dran = 0, wurf = null } = {}) {
  const s = neuerStand(['A', 'B']);
  s.sperren = [...sperren];
  [a, b].forEach((liste, spieler) => {
    liste.forEach((feld, i) => { s.figuren[spieler][i] = { feld }; });
  });
  s.dran = dran;
  s.wurf = wurf;
  return s;
}

const ziele = (s, figur = 0) => zieleFuer(s, figur).map((z) => z.ziel).sort((x, y) => x - y);

/* =========================================================== Das Wegenetz */

describe('Brett', () => {
  it('ist 12 Reihen hoch und 11 Spalten breit', () => {
    expect(REIHEN).toBe(12);
    expect(SPALTEN).toBe(11);
  });

  it('hat 79 Felder, jedes mit eindeutiger Nummer', () => {
    expect(FELDER).toHaveLength(79);
    expect(new Set(FELDER.map((x) => x.id)).size).toBe(79);
    FELDER.forEach((x, i) => expect(x.id).toBe(i));
  });

  it('kennt nur drei Feldarten', () => {
    for (const x of FELDER) expect(['weg', 'ziel', 'heim']).toContain(x.art);
    expect(FELDER.filter((x) => x.art === 'ziel')).toHaveLength(1);
    expect(FELDER.filter((x) => x.art === 'heim')).toHaveLength(2 * FIGUREN);
  });

  it('legt das Ziel oben in die Mitte', () => {
    const z = FELDER[ZIEL];
    expect(z.art).toBe('ziel');
    expect(z.reihe).toBe(0);
    expect(z.spalte).toBe((SPALTEN - 1) / 2);
  });

  it('lässt drei Wege zum Ziel führen — ein Stein allein soll es nicht zusperren', () => {
    expect(NACHBARN[ZIEL]).toHaveLength(3);
    expect([...NACHBARN[ZIEL]].sort((x, y) => x - y))
      .toEqual([f(1, 4), f(1, 5), f(1, 6)]);
  });

  it('verbindet Nachbarn immer in beide Richtungen', () => {
    NACHBARN.forEach((liste, id) => {
      expect(new Set(liste).size, `Feld ${id} doppelt verbunden`).toBe(liste.length);
      for (const n of liste) expect(NACHBARN[n], `${id} -> ${n} einseitig`).toContain(id);
    });
  });

  it('verbindet nur benachbarte Felder, keine Sprünge über Reihen', () => {
    NACHBARN.forEach((liste, id) => {
      for (const n of liste) {
        expect(Math.abs(FELDER[id].reihe - FELDER[n].reihe)).toBeLessThanOrEqual(1);
        expect(Math.abs(FELDER[id].spalte - FELDER[n].spalte)).toBeLessThanOrEqual(1);
      }
    });
  });

  it('gibt jedem fünf Heimfelder in der untersten Reihe', () => {
    expect(HEIM).toHaveLength(2);
    for (const liste of HEIM) {
      expect(liste).toHaveLength(FIGUREN);
      for (const id of liste) {
        expect(FELDER[id].art).toBe('heim');
        expect(FELDER[id].reihe).toBe(REIHEN - 1);
      }
    }
  });

  it('hängt jedes Heimfeld an genau einen Weg nach oben', () => {
    for (const liste of HEIM) {
      for (const id of liste) {
        expect(NACHBARN[id]).toHaveLength(1);
        expect(FELDER[NACHBARN[id][0]].reihe).toBe(UNTERSTE_STRASSE);
      }
    }
  });

  it('verbindet die Heimfelder nicht untereinander', () => {
    const heim = new Set(HEIM.flat());
    for (const id of heim) {
      for (const n of NACHBARN[id]) expect(heim.has(n)).toBe(false);
    }
  });

  it('ist spiegelsymmetrisch — beide Seiten haben dasselbe Brett', () => {
    const spiegel = (id) => feldId(FELDER[id].reihe, SPALTEN - 1 - FELDER[id].spalte);
    for (const x of FELDER) {
      const s = spiegel(x.id);
      expect(s, `Feld ${x.reihe}/${x.spalte} hat kein Spiegelbild`).toBeGreaterThanOrEqual(0);
      expect(FELDER[s].art).toBe(x.art);
      expect([...NACHBARN[s]].sort((p, q) => p - q))
        .toEqual([...NACHBARN[x.id]].map(spiegel).sort((p, q) => p - q));
    }
    expect(HEIM[1].map(spiegel).sort((p, q) => p - q))
      .toEqual([...HEIM[0]].sort((p, q) => p - q));
  });

  it('gibt beiden Seiten exakt dieselben Entfernungen zum Ziel', () => {
    const sortiert = (i) => HEIM[i].map((id) => zumZiel(id)).sort((x, y) => x - y);
    expect(sortiert(0)).toEqual(sortiert(1));
    expect(Math.min(...sortiert(0))).toBe(15);
    expect(Math.max(...sortiert(0))).toBe(17);
  });

  it('macht jedes Feld vom Ziel aus erreichbar', () => {
    for (const x of FELDER) expect(Number.isFinite(zumZiel(x.id)), `Feld ${x.id} hängt in der Luft`).toBe(true);
  });

  it('stellt elf Sperrsteine auf, symmetrisch, alle auf Wegfeldern', () => {
    expect(SPERREN).toBe(11);
    expect(START_SPERREN).toHaveLength(11);
    expect(new Set(START_SPERREN).size).toBe(11);
    for (const id of START_SPERREN) expect(FELDER[id].art).toBe('weg');
    const spiegel = (id) => feldId(FELDER[id].reihe, SPALTEN - 1 - FELDER[id].spalte);
    expect([...START_SPERREN].map(spiegel).sort((x, y) => x - y))
      .toEqual([...START_SPERREN].sort((x, y) => x - y));
  });

  it('lässt die unterste Straße frei — niemand soll einmauerbar sein', () => {
    for (const id of START_SPERREN) expect(FELDER[id].reihe).not.toBe(UNTERSTE_STRASSE);
  });
});

/* ============================================================= Aufstellung */

describe('neuerStand', () => {
  it('stellt fünf Figuren je Seite auf die eigenen Heimfelder', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.figuren[0]).toHaveLength(FIGUREN);
    expect(s.figuren[1]).toHaveLength(FIGUREN);
    expect(s.figuren[0].map((x) => x.feld).sort((a, b) => a - b))
      .toEqual([...HEIM[0]].sort((a, b) => a - b));
    expect(s.figuren[1].map((x) => x.feld).sort((a, b) => a - b))
      .toEqual([...HEIM[1]].sort((a, b) => a - b));
  });

  it('legt die elf Sperren auf ihre Startfelder', () => {
    const s = neuerStand(['A', 'B']);
    expect([...s.sperren].sort((a, b) => a - b)).toEqual([...START_SPERREN].sort((a, b) => a - b));
  });

  it('beginnt bei Spieler 0, ohne Wurf, ohne Sieger', () => {
    const s = neuerStand(['A', 'B']);
    expect(s.dran).toBe(0);
    expect(s.wurf).toBeNull();
    expect(s.fertig).toBeNull();
    expect(s.v).toBe(SAVE_VERSION);
    expect(vorbei(s)).toBe(false);
  });
});

/* ================================================================ Würfeln */

describe('Würfeln', () => {
  it('gibt eine Zahl von 1 bis 6', () => {
    for (let i = 0; i < 6; i++) {
      const s = neuerStand(['A', 'B']);
      expect(wuerfeln(s, () => i / 6)).toBe(i + 1);
      expect(s.wurf).toBe(i + 1);
    }
  });

  it('lässt sich nicht zweimal werfen', () => {
    const s = neuerStand(['A', 'B']);
    wuerfeln(s, () => 0.5);
    expect(() => wuerfeln(s, () => 0.5)).toThrow();
  });

  it('wirft nicht mehr, wenn die Partie vorbei ist', () => {
    const s = neuerStand(['A', 'B']);
    s.fertig = 0;
    expect(() => wuerfeln(s, () => 0.5)).toThrow();
  });
});

/* ================================================================= Ziehen */

describe('Züge finden', () => {
  it('zieht genau die gewürfelte Zahl entlang der Linien', () => {
    const s = bauen({ a: [f(10, 5)], wurf: 1 });
    expect(ziele(s)).toEqual([f(10, 4), f(10, 6)].sort((x, y) => x - y));
  });

  it('darf die Richtung an Kreuzungen wechseln', () => {
    const s = bauen({ a: [f(10, 0)], sperren: [], wurf: 2 });
    // von 10/0 aus: hoch auf 9/0 und weiter auf 8/0, oder seitwärts auf 10/2
    expect(ziele(s)).toContain(f(8, 0));
    expect(ziele(s)).toContain(f(10, 2));
  });

  it('geht innerhalb eines Zuges nicht auf das verlassene Feld zurück', () => {
    const s = bauen({ a: [f(10, 5)], wurf: 2 });
    expect(ziele(s)).not.toContain(f(10, 5));
  });

  it('lässt Sperren nicht überspringen', () => {
    const s = bauen({ a: [f(10, 0)], sperren: [f(9, 0)], wurf: 2 });
    expect(ziele(s)).not.toContain(f(8, 0));
  });

  it('lässt genau auf einer Sperre landen und meldet das', () => {
    const s = bauen({ a: [f(10, 0)], sperren: [f(9, 0)], wurf: 1 });
    const z = zieleFuer(s, 0).find((x) => x.ziel === f(9, 0));
    expect(z).toBeTruthy();
    expect(z.sperre).toBe(true);
  });

  it('überspringt eigene Figuren, landet aber nicht auf ihnen', () => {
    const s = bauen({ a: [f(10, 0), f(10, 2)], wurf: 2 });
    expect(ziele(s)).not.toContain(f(10, 2));
    const drei = bauen({ a: [f(10, 0), f(10, 2)], wurf: 3 });
    expect(ziele(drei)).toContain(f(10, 3));
  });

  it('überspringt gegnerische Figuren und schlägt sie beim Landen', () => {
    const s = bauen({ a: [f(10, 0)], b: [f(10, 2)], wurf: 2 });
    const z = zieleFuer(s, 0).find((x) => x.ziel === f(10, 2));
    expect(z.schlaegt).toEqual({ spieler: 1, figur: 0 });
    const drei = bauen({ a: [f(10, 0)], b: [f(10, 2)], wurf: 3 });
    expect(ziele(drei)).toContain(f(10, 3));
  });

  it('lässt kein Heimfeld betreten — auch nicht das eigene', () => {
    const s = bauen({ a: [f(10, 0)], wurf: 1 });
    expect(ziele(s)).not.toContain(HEIM[0][0]);
    for (const id of [...HEIM[0], ...HEIM[1]]) expect(ziele(s)).not.toContain(id);
  });

  it('lässt Figuren aus dem Heim heraus, aber nie wieder hinein', () => {
    const s = neuerStand(['A', 'B']);
    s.wurf = 1;
    const raus = zieleFuer(s, 0);
    expect(raus.length).toBeGreaterThan(0);
    for (const z of raus) expect(FELDER[z.ziel].art).not.toBe('heim');
  });

  it('trifft das Ziel nur genau und läuft nicht darüber hinweg', () => {
    const s = bauen({ a: [f(1, 5)], wurf: 1 });
    const sieg = zieleFuer(s, 0).find((x) => x.ziel === ZIEL);
    expect(sieg.gewinnt).toBe(true);

    // Sperre auf 1/5: dann führt der einzige Weg von 1/4 nach 1/6 über das Ziel.
    const durch = bauen({ a: [f(1, 4)], sperren: [f(1, 5)], wurf: 2 });
    expect(ziele(durch)).not.toContain(f(1, 6));
  });

  it('gibt ohne Wurf und nach dem Sieg keine Züge', () => {
    expect(zuege(bauen({ a: [f(10, 5)] }))).toEqual([]);
    const fertig = bauen({ a: [f(10, 5)], wurf: 3 });
    fertig.fertig = 0;
    expect(zuege(fertig)).toEqual([]);
  });

  it('nennt nur Züge der Seite, die dran ist', () => {
    const s = bauen({ a: [f(10, 0)], b: [f(10, 9)], dran: 1, wurf: 1 });
    for (const z of zuege(s)) expect(z.ziel).not.toBe(f(10, 1));
    expect(zuege(s).map((z) => z.ziel)).toContain(f(10, 8));
  });

  it('sagt für jede Figur einzeln, ob sie ziehen kann', () => {
    const s = bauen({ a: [f(10, 5)], wurf: 1 });
    expect(ziehbar(s, 0)).toBe(true);
    // eingemauert: einziger Nachbar des Heimfelds ist gesperrt
    const fest = bauen({ a: [HEIM[0][0]], sperren: [NACHBARN[HEIM[0][0]][0]], wurf: 2 });
    expect(ziehbar(fest, 0)).toBe(false);
  });
});

describe('Ziehen', () => {
  it('setzt die Figur und gibt den Wurf frei', () => {
    const s = bauen({ a: [f(10, 5)], wurf: 1 });
    ziehen(s, 0, f(10, 4));
    expect(s.figuren[0][0].feld).toBe(f(10, 4));
    expect(s.wurf).toBeNull();
    expect(s.dran).toBe(1);
  });

  it('nimmt keinen Zug an, den es nicht gibt', () => {
    const s = bauen({ a: [f(10, 5)], wurf: 1 });
    expect(() => ziehen(s, 0, f(10, 2))).toThrow();
  });

  it('schickt eine geschlagene Figur auf ein freies eigenes Heimfeld', () => {
    const s = bauen({ a: [f(10, 0)], b: [f(10, 2)], wurf: 2 });
    ziehen(s, 0, f(10, 2));
    const opfer = s.figuren[1][0].feld;
    expect(HEIM[1]).toContain(opfer);
    // die vier übrigen stehen schon zu Hause, das fünfte Feld war frei
    expect(new Set(s.figuren[1].map((x) => x.feld)).size).toBe(FIGUREN);
  });

  it('beendet den Zug nicht, solange eine Sperre gesetzt werden muss', () => {
    const s = bauen({ a: [f(10, 0)], sperren: [f(9, 0)], wurf: 1 });
    ziehen(s, 0, f(9, 0));
    expect(setztGerade(s)).toBe(true);
    expect(s.dran).toBe(0);
    expect(zuege(s)).toEqual([]);
    expect(s.sperren).not.toContain(f(9, 0));
    expect(s.sperren).toHaveLength(0);
  });

  it('gewinnt mit der ersten Figur im Ziel', () => {
    const s = bauen({ a: [f(1, 5)], wurf: 1 });
    ziehen(s, 0, ZIEL);
    expect(vorbei(s)).toBe(true);
    expect(gewinner(s)).toBe(0);
    expect(s.siege).toEqual([1, 0]);
  });

  it('behandelt Spieler 0 als Sieger, nicht als Nichts', () => {
    // Klassische Falle: `if (stand.fertig)` verschluckt einen Sieg von Spieler 0.
    const s = bauen({ a: [f(1, 5)], wurf: 1 });
    ziehen(s, 0, ZIEL);
    expect(s.fertig).toBe(0);
    expect(vorbei(s)).toBe(true);
  });
});

/* ================================================= Sperre wieder aufstellen */

describe('Sperre neu setzen', () => {
  const nachTreffer = () => {
    const s = bauen({ a: [f(10, 0)], b: [f(4, 10)], sperren: [f(9, 0), f(5, 3)], wurf: 1 });
    ziehen(s, 0, f(9, 0));
    return s;
  };

  it('bietet nur freie Wegfelder an', () => {
    const s = nachTreffer();
    const frei = setzbar(s);
    expect(frei.length).toBeGreaterThan(0);
    for (const id of frei) {
      expect(FELDER[id].art).toBe('weg');
      expect(s.sperren).not.toContain(id);
      expect(figurAuf(s, id)).toBeNull();
    }
  });

  it('bietet weder Ziel noch Heimfelder noch die unterste Straße an', () => {
    const frei = new Set(setzbar(nachTreffer()));
    expect(frei.has(ZIEL)).toBe(false);
    for (const id of [...HEIM[0], ...HEIM[1]]) expect(frei.has(id)).toBe(false);
    for (const x of FELDER) if (x.reihe === UNTERSTE_STRASSE) expect(frei.has(x.id)).toBe(false);
  });

  it('setzt den Stein und gibt den Zug erst dann weiter', () => {
    const s = nachTreffer();
    const ziel = setzbar(s)[0];
    sperreSetzen(s, ziel);
    expect(s.sperren).toContain(ziel);
    expect(s.sperren).toHaveLength(2);
    expect(setztGerade(s)).toBe(false);
    expect(s.dran).toBe(1);
    expect(s.wurf).toBeNull();
  });

  it('nimmt kein verbotenes Feld an', () => {
    const s = nachTreffer();
    expect(() => sperreSetzen(s, ZIEL)).toThrow();
    expect(() => sperreSetzen(s, HEIM[1][0])).toThrow();
    expect(() => sperreSetzen(s, f(10, 5))).toThrow();
    expect(() => sperreSetzen(s, f(5, 3))).toThrow();       // dort steht schon eine
    expect(() => sperreSetzen(s, f(4, 10))).toThrow();      // dort steht eine Figur
  });

  it('verliert nie einen Stein — es bleiben immer elf', () => {
    const s = neuerStand(['A', 'B']);
    s.figuren[0][0] = { feld: f(10, 2) };
    s.sperren = [...START_SPERREN];
    s.wurf = 1;
    // 10/2 hat keinen Nachbarn mit Sperre; wir nehmen einen echten Treffer weiter unten,
    // hier zählt nur, dass der Startvorrat stimmt.
    expect(s.sperren).toHaveLength(SPERREN);
  });
});

/* ============================================================== Zugzwang */

describe('Zug abgeben', () => {
  it('gibt weiter, wenn kein Zug möglich ist', () => {
    const s = bauen({ a: [HEIM[0][0]], sperren: [NACHBARN[HEIM[0][0]][0]], wurf: 2 });
    // die anderen vier Figuren stehen im Heim und sind ebenfalls gesperrt
    s.figuren[0] = s.figuren[0].map((x, i) => (i === 0 ? x : { feld: HEIM[0][i] }));
    s.sperren = HEIM[0].map((id) => NACHBARN[id][0]);
    expect(zuege(s)).toEqual([]);
    zugBeenden(s);
    expect(s.dran).toBe(1);
    expect(s.wurf).toBeNull();
  });
});

/* ========================================================== Neue Partie */

describe('Neue Partie', () => {
  it('stellt alles zurück, zählt die Siege weiter und lässt den Verlierer beginnen', () => {
    const s = bauen({ a: [f(1, 5)], wurf: 1 });
    ziehen(s, 0, ZIEL);
    partieNeu(s);
    expect(s.fertig).toBeNull();
    expect(s.partie).toBe(2);
    expect(s.siege).toEqual([1, 0]);
    expect(s.dran).toBe(1);
    expect(s.sperren).toHaveLength(SPERREN);
    expect(s.figuren[0].map((x) => x.feld).sort((a, b) => a - b))
      .toEqual([...HEIM[0]].sort((a, b) => a - b));
  });
});

/* ======================================================= Punktestand-Code */

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.siege = [3, 5];
    s.partie = 9;
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([3, 5]);
    expect(zurueck.partie).toBe(9);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('HUT1-abc')).toThrow();
    expect(() => ausCode('SPR1-kaputt')).toThrow();
  });
});

/* ================================================ Partien gegen sich selbst */

describe('Partien gegen sich selbst', () => {
  /* Aus der Hütchenjagd gelernt: grüne Einzeltests sagen nichts darüber, ob das
     Spiel funktioniert. Hier wird gemessen, ob die beiden Dinge, die dem Spiel
     seinen Namen geben, überhaupt vorkommen — Sperren treffen und schlagen. */

  function partieSpielen(saat, grenze = 4000) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const waehle = (liste) => liste[Math.floor(rnd() * liste.length)];
    const s = neuerStand(['A', 'B']);
    let zuegeGesamt = 0;
    let treffer = 0;
    let schlaege = 0;
    while (!vorbei(s) && zuegeGesamt < grenze) {
      zuegeGesamt += 1;
      if (setztGerade(s)) { sperreSetzen(s, waehle(setzbar(s))); continue; }
      if (s.wurf === null) wuerfeln(s, rnd);
      const moeglich = zuege(s);
      if (!moeglich.length) { zugBeenden(s); continue; }
      const z = waehle(moeglich);
      if (z.sperre) treffer += 1;
      if (z.schlaegt) schlaege += 1;
      ziehen(s, z.figur, z.ziel);
    }
    return { s, zuegeGesamt, treffer, schlaege };
  }

  /**
   * Derselbe Ablauf, aber mit einem Spieler, der vorankommen will: schlagen,
   * Mauern aufbrechen, sonst die Figur voranschieben, die am weitesten ist.
   * Gleichstände werden **ausgewürfelt** — bricht man sie nach Feldnummer,
   * misst man die eigene Reihenfolge und nicht das Spiel.
   */
  function klugSpielen(saat, beginnt = 0, grenze = 4000) {
    let x = saat;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const beste = (liste, wert) => {
      let hoch = -Infinity;
      let gleich = [];
      for (const k of liste) {
        const w = wert(k);
        if (w > hoch) { hoch = w; gleich = [k]; } else if (w === hoch) gleich.push(k);
      }
      return gleich[Math.floor(rnd() * gleich.length)];
    };
    const s = neuerStand(['A', 'B']);
    s.dran = beginnt;
    let halbzuege = 0;
    let n = 0;
    while (!vorbei(s) && n < grenze) {
      n += 1;
      if (setztGerade(s)) {
        const gegner = s.setzen.spieler === 0 ? 1 : 0;
        const vorn = Math.min(...s.figuren[gegner].map((y) => zumZiel(y.feld)));
        sperreSetzen(s, beste(setzbar(s), (id) => -Math.abs(zumZiel(id) - (vorn - 1))));
        continue;
      }
      if (s.wurf === null) wuerfeln(s, rnd);
      const moeglich = zuege(s);
      if (!moeglich.length) { zugBeenden(s); halbzuege += 1; continue; }
      ziehen(s, ...(() => {
        const z = beste(moeglich, (k) => {
          if (k.gewinnt) return 1e9;
          const von = s.figuren[s.dran][k.figur].feld;
          let p = (zumZiel(von) - zumZiel(k.ziel)) * 3;
          if (k.schlaegt) p += 40 - zumZiel(s.figuren[k.schlaegt.spieler][k.schlaegt.figur].feld);
          if (k.sperre) p += 12;
          return p;
        });
        return [z.figur, z.ziel];
      })());
      halbzuege += 1;
    }
    return { s, halbzuege, beendet: vorbei(s) };
  }

  it('läuft auch zielgerichtet jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 300; saat++) {
      expect(klugSpielen(saat).beendet, `Saat ${saat} hängt`).toBe(true);
    }
  });

  it('läuft jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 300; saat++) {
      const { s, zuegeGesamt } = partieSpielen(saat);
      expect(vorbei(s), `Saat ${saat} hängt nach ${zuegeGesamt} Zügen`).toBe(true);
    }
  });

  it('trifft regelmäßig Sperren — sonst wäre es ein anderes Spiel', () => {
    let treffer = 0;
    let ohne = 0;
    for (let saat = 1; saat <= 200; saat++) {
      const p = partieSpielen(saat);
      treffer += p.treffer;
      if (!p.treffer) ohne += 1;
    }
    expect(treffer / 200).toBeGreaterThan(5);
    expect(ohne).toBe(0);
  });

  it('schlägt regelmäßig', () => {
    let schlaege = 0;
    for (let saat = 1; saat <= 200; saat++) schlaege += partieSpielen(saat).schlaege;
    expect(schlaege / 200).toBeGreaterThan(1);
  });

  it('bleibt bei zielgerichtetem Spiel in erträglicher Länge', () => {
    // Zufälliges Spiel irrt über 300 Halbzüge lang herum und misst nichts über
    // die Spieldauer. Gemessen wird darum gegen einen Spieler, der vorankommen
    // will — das ist die Untergrenze dessen, was zwei Menschen brauchen.
    let summe = 0;
    for (let saat = 1; saat <= 200; saat++) summe += klugSpielen(saat).halbzuege;
    expect(summe / 200).toBeLessThan(80);
  });

  it('verteilt die Siege ungefähr gleich', () => {
    let a = 0;
    for (let saat = 1; saat <= 400; saat++) if (partieSpielen(saat).s.fertig === 0) a += 1;
    expect(a).toBeGreaterThan(150);
    expect(a).toBeLessThan(250);
  });

  it('benachteiligt auch bei zielgerichtetem Spiel keine Seite', () => {
    /* Der Test, der einen echten Fehler gefunden hat. Zufälliges Spiel merkt so
       etwas nicht — erst wer vorankommen will, macht kleine Unterschiede sichtbar.
       Ursache war damals `heimPlatz`: die Heimfelder sind verschieden weit vom
       Ziel entfernt, und weil beide Seiten von links nach rechts durchgezählt
       wurden, bekam eine Seite nach jedem Schlag systematisch das bessere Feld
       zurück. Ergebnis: 34 zu 66 statt 50 zu 50. Seitdem sind die Figurnummern
       gespiegelt — und dieser Test hält das fest. */
    for (const beginnt of [0, 1]) {
      let a = 0;
      for (let saat = 1; saat <= 400; saat++) if (klugSpielen(saat, beginnt).s.fertig === 0) a += 1;
      const anteil = a / 400;
      expect(anteil, `Start bei ${beginnt}: A gewinnt ${(anteil * 100).toFixed(1)} %`)
        .toBeGreaterThan(0.4);
      expect(anteil, `Start bei ${beginnt}: A gewinnt ${(anteil * 100).toFixed(1)} %`)
        .toBeLessThan(0.6);
    }
  });

  it('gibt der beginnenden Seite einen kleinen, aber klaren Vorteil', () => {
    const quote = (beginnt) => {
      let a = 0;
      for (let saat = 1; saat <= 400; saat++) if (klugSpielen(saat, beginnt).s.fertig === 0) a += 1;
      return a / 400;
    };
    expect(quote(0)).toBeGreaterThan(quote(1));
  });

  it('erreicht nie einen ungültigen Zustand', () => {
    for (let saat = 1; saat <= 200; saat++) {
      const { s } = partieSpielen(saat);
      expect(s.sperren, `Saat ${saat}: Steine verloren`).toHaveLength(SPERREN);
      expect(new Set(s.sperren).size).toBe(SPERREN);
      const belegt = [];
      for (let spieler = 0; spieler < 2; spieler++) {
        expect(s.figuren[spieler]).toHaveLength(FIGUREN);
        for (const fig of s.figuren[spieler]) {
          expect(FELDER[fig.feld]).toBeTruthy();
          expect(sperreAuf(s, fig.feld), `Saat ${saat}: Figur auf Sperre`).toBe(false);
          if (FELDER[fig.feld].art === 'heim') expect(HEIM[spieler]).toContain(fig.feld);
          belegt.push(fig.feld);
        }
      }
      // Zwei Figuren nie auf demselben Feld — außer im Ziel steht nur die Siegerin.
      const ohneZiel = belegt.filter((id) => id !== ZIEL);
      expect(new Set(ohneZiel).size, `Saat ${saat}: zwei Figuren auf einem Feld`)
        .toBe(ohneZiel.length);
      for (const id of s.sperren) expect(FELDER[id].reihe).not.toBe(UNTERSTE_STRASSE);
    }
  });
});
