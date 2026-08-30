import { describe, it, expect } from 'vitest';
import {
  MODI, VORGABE, SAVE_VERSION,
  neuerStand, zuege, ziehen, ziehbar,
  mauerErlaubt, mauerSetzen, mauerZuege, mauernUebrig,
  wegLaenge, vorbei, gewinner, partieNeu, alsCode, ausCode,
} from '../../mauern/src/engine.js';

/** Ein Stand mit gesetzten Figuren, Mauern und Vorräten. */
function bauen({ regeln = {}, figuren, mauern = [], vorrat, ziele, dran = 0 } = {}) {
  const s = neuerStand(['A', 'B'], regeln);
  if (figuren) s.figuren = figuren.map((f) => ({ ...f }));
  if (ziele) s.ziele = [...ziele];
  if (vorrat) s.vorrat = [...vorrat];
  s.mauern = mauern.map((m) => ({ ...m }));
  s.dran = dran;
  return s;
}

const w = (r, c) => ({ r, c, a: 'waagerecht' });
const s = (r, c) => ({ r, c, a: 'senkrecht' });
const felder = (liste) => liste.map((x) => `${x.r},${x.c}`).sort();
const zielFelder = (stand) => felder(zuege(stand));

/* ============================================================== Aufstellung */

describe('Aufstellung', () => {
  it('spielt voreingestellt auf 9 × 9 mit zehn Mauern je Seite', () => {
    expect(VORGABE.groesse).toBe(9);
    expect(VORGABE.mauern).toBe(10);
    const st = neuerStand(['A', 'B']);
    expect(st.v).toBe(SAVE_VERSION);
    expect(st.vorrat).toEqual([10, 10]);
    expect(st.mauern).toEqual([]);
    expect(st.dran).toBe(0);
    expect(vorbei(st)).toBe(false);
  });

  it('stellt beide in die Mitte der eigenen Grundreihe, Ziel gegenüber', () => {
    const st = neuerStand(['A', 'B']);
    expect(st.figuren[0]).toEqual({ r: 8, c: 4 });
    expect(st.figuren[1]).toEqual({ r: 0, c: 4 });
    expect(st.ziele).toEqual([0, 8]);
  });

  it('kennt einen Modus je Fassung, alle mit eigener Kennung', () => {
    expect(MODI.length).toBeGreaterThanOrEqual(5);
    expect(new Set(MODI.map((m) => m.id)).size).toBe(MODI.length);
    expect(MODI[0].id).toBe('klassisch');
    for (const m of MODI) {
      expect(typeof m.titel).toBe('string');
      expect(typeof m.zeile).toBe('string');
      expect(m.regeln).toBeTruthy();
    }
  });

  it('macht im Modus Kurz ein kleineres Brett mit weniger Mauern', () => {
    const kurz = MODI.find((m) => m.id === 'kurz');
    const st = neuerStand(['A', 'B'], kurz.regeln);
    expect(st.regeln.groesse).toBe(7);
    expect(st.vorrat).toEqual([7, 7]);
    expect(st.figuren[0]).toEqual({ r: 6, c: 3 });
    expect(st.ziele).toEqual([0, 6]);
  });

  it('stellt im Wettlauf beide nebeneinander auf dieselbe Seite, mit gleichem Ziel', () => {
    const lauf = MODI.find((m) => m.id === 'wettlauf');
    const st = neuerStand(['A', 'B'], lauf.regeln);
    expect(st.regeln.wettlauf).toBe(true);
    expect(st.figuren[0].r).toBe(8);
    expect(st.figuren[1].r).toBe(8);
    expect(st.figuren[0].c).not.toBe(st.figuren[1].c);
    expect(st.ziele).toEqual([0, 0]);
  });

  it('behält den Modus im Spielstand — damit er beim Koppeln mitreist', () => {
    const st = neuerStand(['A', 'B'], { groesse: 7, mauern: 7 });
    expect(st.regeln.groesse).toBe(7);
    expect(JSON.parse(JSON.stringify(st)).regeln.groesse).toBe(7);
  });
});

/* ================================================================ Bewegung */

describe('Bewegung', () => {
  it('geht ein Feld waagerecht oder senkrecht, nicht schräg', () => {
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }] });
    expect(zielFelder(st)).toEqual(felder([
      { r: 3, c: 4 }, { r: 5, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 5 }]));
  });

  it('läuft nicht über den Rand hinaus', () => {
    const st = bauen({ figuren: [{ r: 0, c: 0 }, { r: 8, c: 8 }] });
    expect(zielFelder(st)).toEqual(felder([{ r: 1, c: 0 }, { r: 0, c: 1 }]));
  });

  it('kommt an einer waagerechten Mauer nicht vorbei', () => {
    // Waagerecht bei (4,4) trennt (4,4)|(5,4) und (4,5)|(5,5)
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }], mauern: [w(4, 4)] });
    expect(zielFelder(st)).not.toContain('5,4');
    expect(zielFelder(st)).toContain('3,4');
    const daneben = bauen({ figuren: [{ r: 4, c: 5 }, { r: 0, c: 0 }], mauern: [w(4, 4)] });
    expect(zielFelder(daneben)).not.toContain('5,5');
  });

  it('kommt an einer senkrechten Mauer nicht vorbei', () => {
    // Senkrecht bei (4,4) trennt (4,4)|(4,5) und (5,4)|(5,5)
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }], mauern: [s(4, 4)] });
    expect(zielFelder(st)).not.toContain('4,5');
    expect(zielFelder(st)).toContain('4,3');
    const drunter = bauen({ figuren: [{ r: 5, c: 5 }, { r: 0, c: 0 }], mauern: [s(4, 4)] });
    expect(zielFelder(drunter)).not.toContain('5,4');
  });

  it('sagt für ein einzelnes Feld, ob der Zug geht', () => {
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }] });
    expect(ziehbar(st, 3, 4)).toBe(true);
    expect(ziehbar(st, 3, 3)).toBe(false);
    expect(ziehbar(st, 9, 4)).toBe(false);
  });

  it('führt den Zug aus und gibt weiter', () => {
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }] });
    ziehen(st, 3, 4);
    expect(st.figuren[0]).toEqual({ r: 3, c: 4 });
    expect(st.dran).toBe(1);
  });

  it('nimmt keinen Zug an, den es nicht gibt', () => {
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 0, c: 0 }] });
    expect(() => ziehen(st, 3, 3)).toThrow();
  });
});

/* ================================================================ Springen */

describe('Springen', () => {
  it('springt über die Gegenfigur hinweg', () => {
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 3, c: 4 }] });
    const z = zielFelder(st);
    expect(z).not.toContain('3,4');          // nie auf die Gegenfigur
    expect(z).toContain('2,4');              // sondern darüber hinweg
  });

  it('geht schräg vorbei, wenn hinter der Gegenfigur eine Mauer steht', () => {
    // Gegner auf (3,4), waagerechte Mauer bei (2,4) trennt (2,4)|(3,4)
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 3, c: 4 }], mauern: [w(2, 4)] });
    const z = zielFelder(st);
    expect(z).not.toContain('2,4');
    expect(z).toContain('3,3');
    expect(z).toContain('3,5');
  });

  it('geht schräg vorbei, wenn hinter der Gegenfigur der Rand ist', () => {
    const st = bauen({ figuren: [{ r: 1, c: 4 }, { r: 0, c: 4 }] });
    const z = zielFelder(st);
    expect(z).toContain('0,3');
    expect(z).toContain('0,5');
  });

  it('bietet einen schrägen Ausweg nicht an, wenn auch dort eine Mauer steht', () => {
    // hinter dem Gegner der Rand; rechts daneben sperrt eine senkrechte Mauer
    const st = bauen({ figuren: [{ r: 1, c: 4 }, { r: 0, c: 4 }], mauern: [s(0, 4)] });
    const z = zielFelder(st);
    expect(z).toContain('0,3');
    expect(z).not.toContain('0,5');
  });

  it('kostet den Übersprungenen ein Tempo — das ist so gewollt', () => {
    // Der Sprung geht zwei Felder weit. Wer frontal aufeinander zuläuft und
    // dabei am Zug ist, verschenkt also einen Schritt an die Gegenseite. Genau
    // deshalb laufen gute Partien nicht in derselben Spalte aufeinander zu.
    const st = bauen({ figuren: [{ r: 4, c: 4 }, { r: 3, c: 4 }], dran: 1 });
    ziehen(st, 5, 4);
    expect(st.figuren[1]).toEqual({ r: 5, c: 4 });
    expect(wegLaenge(st, 1)).toBe(3);          // zwei Felder in einem Zug
  });
});

/* ================================================================== Mauern */

describe('Mauern setzen', () => {
  it('nimmt eine Mauer an und zieht sie vom Vorrat ab', () => {
    const st = neuerStand(['A', 'B']);
    expect(mauerErlaubt(st, 4, 4, 'waagerecht')).toBe(true);
    mauerSetzen(st, 4, 4, 'waagerecht');
    expect(st.mauern).toHaveLength(1);
    expect(mauernUebrig(st, 0)).toBe(9);
    expect(st.dran).toBe(1);
  });

  it('lässt keine Mauer außerhalb des Gitters zu', () => {
    const st = neuerStand(['A', 'B']);
    // Fugen gibt es nur zwischen den Feldern: 0 bis groesse-2
    expect(mauerErlaubt(st, 8, 4, 'waagerecht')).toBe(false);
    expect(mauerErlaubt(st, 4, 8, 'senkrecht')).toBe(false);
    expect(mauerErlaubt(st, -1, 4, 'waagerecht')).toBe(false);
  });

  it('lässt zwei Mauern nicht dieselbe Fuge belegen', () => {
    const st = bauen({ mauern: [w(4, 4)] });
    expect(mauerErlaubt(st, 4, 4, 'waagerecht')).toBe(false);
  });

  it('lässt Mauern gleicher Richtung sich nicht überlappen', () => {
    const st = bauen({ mauern: [w(4, 4)] });
    expect(mauerErlaubt(st, 4, 3, 'waagerecht')).toBe(false);
    expect(mauerErlaubt(st, 4, 5, 'waagerecht')).toBe(false);
    expect(mauerErlaubt(st, 4, 6, 'waagerecht')).toBe(true);
    const senk = bauen({ mauern: [s(4, 4)] });
    expect(mauerErlaubt(senk, 3, 4, 'senkrecht')).toBe(false);
    expect(mauerErlaubt(senk, 5, 4, 'senkrecht')).toBe(false);
    expect(mauerErlaubt(senk, 6, 4, 'senkrecht')).toBe(true);
  });

  it('lässt Mauern sich nicht kreuzen', () => {
    const st = bauen({ mauern: [w(4, 4)] });
    expect(mauerErlaubt(st, 4, 4, 'senkrecht')).toBe(false);
    // versetzt ist erlaubt — das kreuzt nicht
    expect(mauerErlaubt(st, 4, 5, 'senkrecht')).toBe(true);
    expect(mauerErlaubt(st, 3, 4, 'senkrecht')).toBe(true);
  });

  it('lässt ohne Vorrat keine Mauer mehr zu', () => {
    const st = bauen({ vorrat: [0, 10] });
    expect(mauerErlaubt(st, 4, 4, 'waagerecht')).toBe(false);
    expect(() => mauerSetzen(st, 4, 4, 'waagerecht')).toThrow();
    expect(zuege(st).length).toBeGreaterThan(0);      // laufen geht weiterhin
  });

  it('verweigert die Mauer, die den letzten Weg zusperrt — die wichtigste Regel', () => {
    // A steckt in der Ecke (0,0) und muss nach ganz unten. Die senkrechte Mauer
    // bei (0,0) schließt die Ecke zur Seite; die waagerechte bei (1,0) würde die
    // Tasche {(0,0),(1,0)} vollständig zumauern.
    const zu = bauen({ figuren: [{ r: 0, c: 0 }, { r: 8, c: 8 }], ziele: [8, 0], mauern: [s(0, 0)] });
    expect(mauerErlaubt(zu, 1, 0, 'waagerecht')).toBe(false);
    expect(() => mauerSetzen(zu, 1, 0, 'waagerecht')).toThrow();
    // Ohne die senkrechte Mauer ist genau dieselbe Mauer erlaubt.
    const offen = bauen({ figuren: [{ r: 0, c: 0 }, { r: 8, c: 8 }], ziele: [8, 0] });
    expect(mauerErlaubt(offen, 1, 0, 'waagerecht')).toBe(true);
  });

  it('schützt auch die Gegenseite vor dem Zumauern', () => {
    const st = bauen({ figuren: [{ r: 8, c: 8 }, { r: 0, c: 0 }], ziele: [0, 8], mauern: [s(0, 0)], dran: 0 });
    expect(mauerErlaubt(st, 1, 0, 'waagerecht')).toBe(false);
  });

  it('zählt alle erlaubten Mauern auf', () => {
    const st = neuerStand(['A', 'B']);
    const alle = mauerZuege(st);
    expect(alle).toHaveLength(2 * 8 * 8);            // leeres Brett: alle Fugen frei
    const nach = bauen({ mauern: [w(4, 4)] });
    // dieselbe Fuge waagerecht und senkrecht, plus die beiden Überlappungen
    expect(mauerZuege(nach)).toHaveLength(2 * 8 * 8 - 4);
  });

  it('gibt ohne Vorrat gar keine Mauerzüge zurück', () => {
    expect(mauerZuege(bauen({ vorrat: [0, 10] }))).toEqual([]);
  });
});

/* ================================================================ Wegsuche */

describe('Weg zum Ziel', () => {
  it('misst die kürzeste Entfernung zur eigenen Zielreihe', () => {
    const st = neuerStand(['A', 'B']);
    expect(wegLaenge(st, 0)).toBe(8);
    expect(wegLaenge(st, 1)).toBe(8);
  });

  it('wird durch Mauern länger', () => {
    const st = bauen({ figuren: [{ r: 8, c: 4 }, { r: 0, c: 4 }], mauern: [w(7, 3), w(7, 5)] });
    expect(wegLaenge(st, 0)).toBeGreaterThan(8);
  });

  it('meldet Unendlich, wenn kein Weg da ist', () => {
    const zu = bauen({ figuren: [{ r: 0, c: 0 }, { r: 8, c: 8 }], ziele: [8, 0], mauern: [s(0, 0), w(1, 0)] });
    expect(Number.isFinite(wegLaenge(zu, 0))).toBe(false);
  });
});

/* ==================================================================== Sieg */

describe('Sieg', () => {
  it('gewinnt, wer die gegenüberliegende Reihe erreicht', () => {
    const st = bauen({ figuren: [{ r: 1, c: 4 }, { r: 8, c: 0 }] });
    ziehen(st, 0, 4);
    expect(vorbei(st)).toBe(true);
    expect(gewinner(st)).toBe(0);
    expect(st.siege).toEqual([1, 0]);
  });

  it('behandelt Spieler 0 als Sieger, nicht als Nichts', () => {
    const st = bauen({ figuren: [{ r: 1, c: 4 }, { r: 8, c: 0 }] });
    ziehen(st, 0, 4);
    expect(st.fertig).toBe(0);
    expect(vorbei(st)).toBe(true);
  });

  it('gewinnt im Wettlauf, wer zuerst oben ist — für beide dieselbe Reihe', () => {
    const lauf = MODI.find((m) => m.id === 'wettlauf');
    const st = neuerStand(['A', 'B'], lauf.regeln);
    st.figuren = [{ r: 4, c: 3 }, { r: 1, c: 5 }];
    st.dran = 1;
    ziehen(st, 0, 5);
    expect(gewinner(st)).toBe(1);
  });

  it('lässt nach dem Sieg nichts mehr zu', () => {
    const st = bauen({ figuren: [{ r: 1, c: 4 }, { r: 8, c: 0 }] });
    ziehen(st, 0, 4);
    expect(zuege(st)).toEqual([]);
    expect(mauerZuege(st)).toEqual([]);
    expect(() => ziehen(st, 0, 3)).toThrow();
  });
});

/* ============================================================= Neue Partie */

describe('Neue Partie', () => {
  it('stellt alles zurück, behält Modus und Siege, der Verlierer beginnt', () => {
    const st = neuerStand(['A', 'B'], { groesse: 7, mauern: 7 });
    st.figuren = [{ r: 1, c: 3 }, { r: 6, c: 0 }];
    ziehen(st, 0, 3);
    partieNeu(st);
    expect(st.fertig).toBeNull();
    expect(st.partie).toBe(2);
    expect(st.siege).toEqual([1, 0]);
    expect(st.dran).toBe(1);
    expect(st.regeln.groesse).toBe(7);
    expect(st.vorrat).toEqual([7, 7]);
    expect(st.mauern).toEqual([]);
    expect(st.figuren[0]).toEqual({ r: 6, c: 3 });
  });
});

/* ======================================================== Punktestand-Code */

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück, samt Modus', () => {
    const st = neuerStand(['Anna', 'Bert'], { groesse: 7, mauern: 7 });
    st.siege = [2, 4];
    st.partie = 7;
    const zurueck = ausCode(alsCode(st));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.siege).toEqual([2, 4]);
    expect(zurueck.partie).toBe(7);
    expect(zurueck.regeln.groesse).toBe(7);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('SPR1-abc')).toThrow();
    expect(() => ausCode('MAU1-kaputt')).toThrow();
  });
});

/* ================================================ Partien gegen sich selbst */

describe('Partien gegen sich selbst', () => {
  /* Ein Spieler, der beide Zugarten mit **derselben** Zahl bewertet: wie steht
     der Abstand zum Ziel nachher? Laufen bringt immer genau +1, eine Mauer
     ihren Nutzen — damit entscheidet sich von selbst, was besser ist.

     Der erste Anlauf hatte stattdessen die übliche Faustregel „mauere, wenn du
     hinten liegst". Die kippt schon bei einem Schritt Rückstand: wer anzieht,
     liegt sofort vorn und wird prompt bemauert. Ergebnis war 36 zu 64 — und
     das lag an der Faustregel, nicht am Spiel. */
  function partie(saat, regeln = {}, grenze = 400) {
    let a = saat >>> 0;
    const rnd = () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const beste = (liste, wert) => {
      let hoch = -Infinity;
      let gleich = [];
      for (const k of liste) {
        const v = wert(k);
        if (v > hoch) { hoch = v; gleich = [k]; } else if (v === hoch) gleich.push(k);
      }
      return gleich.length ? gleich[Math.floor(rnd() * gleich.length)] : null;
    };
    const st = neuerStand(['A', 'B'], regeln);
    let zaehler = 0;
    let gemauert = 0;
    while (!vorbei(st) && zaehler < grenze) {
      zaehler += 1;
      const ich = st.dran;
      const du = ich === 0 ? 1 : 0;
      const bewerten = (nachher) => wegLaenge(nachher, du) - wegLaenge(nachher, ich);
      const kandidaten = [
        ...zuege(st).map((z) => ({ art: 'lauf', z })),
        ...(mauernUebrig(st, ich) > 0 ? mauerZuege(st).map((m) => ({ art: 'mauer', m })) : []),
      ];
      const wahl = beste(kandidaten, (k) => (k.art === 'lauf'
        ? bewerten({ ...st, figuren: st.figuren.map((f, i) => (i === ich ? k.z : f)) })
        : bewerten({ ...st, mauern: [...st.mauern, k.m] })));
      if (!wahl) break;
      if (wahl.art === 'mauer') { mauerSetzen(st, wahl.m.r, wahl.m.c, wahl.m.a); gemauert += 1; }
      else ziehen(st, wahl.z.r, wahl.z.c);
    }
    return { st, zaehler, gemauert, beendet: vorbei(st) };
  }

  const kurz = MODI.find((m) => m.id === 'kurz').regeln;

  it('läuft jede Partie zu Ende', () => {
    for (let saat = 1; saat <= 20; saat++) {
      const p = partie(saat, kurz);
      expect(p.beendet, `Saat ${saat} hängt nach ${p.zaehler} Zügen`).toBe(true);
    }
  });

  it('läuft in jedem Modus zu Ende', () => {
    for (const modus of MODI) {
      for (let saat = 1; saat <= 3; saat++) {
        expect(partie(saat, modus.regeln).beendet, `${modus.id}, Saat ${saat}`).toBe(true);
      }
    }
  });

  it('setzt tatsächlich Mauern — sonst wäre es ein Laufwettbewerb', () => {
    let gemauert = 0;
    let ohne = 0;
    for (let saat = 1; saat <= 20; saat++) {
      const p = partie(saat, kurz);
      gemauert += p.gemauert;
      if (!p.gemauert) ohne += 1;
    }
    expect(gemauert / 20).toBeGreaterThan(4);
    expect(ohne).toBe(0);
  });

  it('erreicht nie einen ungültigen Zustand', () => {
    for (let saat = 1; saat <= 20; saat++) {
      const { st } = partie(saat, kurz);
      const n = st.regeln.groesse;
      for (const f of st.figuren) {
        expect(f.r).toBeGreaterThanOrEqual(0); expect(f.r).toBeLessThan(n);
        expect(f.c).toBeGreaterThanOrEqual(0); expect(f.c).toBeLessThan(n);
      }
      expect(st.figuren[0]).not.toEqual(st.figuren[1]);
      expect(st.mauern.length).toBe(2 * st.regeln.mauern - st.vorrat[0] - st.vorrat[1]);
      for (const m of st.mauern) {
        expect(m.r).toBeGreaterThanOrEqual(0); expect(m.r).toBeLessThan(n - 1);
        expect(m.c).toBeGreaterThanOrEqual(0); expect(m.c).toBeLessThan(n - 1);
      }
      // Beide hatten zu jedem Zeitpunkt einen Weg — die Wegregel hat gehalten.
      expect(Number.isFinite(wegLaenge(st, 0))).toBe(true);
      expect(Number.isFinite(wegLaenge(st, 1))).toBe(true);
    }
  });

  it('lässt keine Seite alles gewinnen', () => {
    // Bewusst weite Grenzen: die genaue Quote hängt am Testspieler, nicht am
    // Spiel. Dass keine Seite bevorzugt ist, belegt die Spiegelprobe darunter —
    // die kommt ohne Testspieler aus und ist deshalb das härtere Argument.
    let a = 0;
    for (let saat = 1; saat <= 40; saat++) if (partie(saat, kurz).st.fertig === 0) a += 1;
    expect(a).toBeGreaterThan(10);
    expect(a).toBeLessThan(30);
  });
});

/* ============================================================ Spiegelprobe */

describe('Spiegelprobe', () => {
  /* Der eigentliche Fairnessbeweis, und er braucht keinen Testspieler: dreht
     man eine beliebige Stellung um (Zeilen spiegeln, Seiten tauschen), müssen
     genau die gespiegelten Züge und Mauern herauskommen. Wäre eine Seite
     strukturell bevorzugt, ginge das schief. */
  const N = 9;
  const spiegelFeld = (f) => ({ r: N - 1 - f.r, c: f.c });
  const spiegelMauer = (m) => ({ r: N - 2 - m.r, c: m.c, a: m.a });

  function spiegeln(stand) {
    const kopie = JSON.parse(JSON.stringify(stand));
    kopie.figuren = [spiegelFeld(stand.figuren[1]), spiegelFeld(stand.figuren[0])];
    kopie.vorrat = [stand.vorrat[1], stand.vorrat[0]];
    kopie.mauern = stand.mauern.map(spiegelMauer);
    kopie.dran = stand.dran === 0 ? 1 : 0;
    return kopie;
  }

  const alsText = (liste) => liste.map((x) => JSON.stringify(x)).sort().join('|');

  it('spiegelt Läufe und Mauern in beliebigen Stellungen genau', () => {
    let x = 7;
    const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    for (let runde = 0; runde < 40; runde++) {
      const st = neuerStand(['A', 'B']);
      // ein paar zufällige, aber gültige Mauern und Figurstellungen
      for (let i = 0; i < 6; i++) {
        const alle = mauerZuege(st);
        const m = alle[Math.floor(rnd() * alle.length)];
        st.mauern = [...st.mauern, m];
        st.vorrat[i % 2] -= 1;
      }
      st.figuren = [{ r: 2 + Math.floor(rnd() * 5), c: Math.floor(rnd() * 9) },
        { r: 2 + Math.floor(rnd() * 5), c: Math.floor(rnd() * 9) }];
      if (st.figuren[0].r === st.figuren[1].r && st.figuren[0].c === st.figuren[1].c) continue;
      st.dran = runde % 2;

      const gespiegelt = spiegeln(st);
      expect(alsText(zuege(gespiegelt)), `Runde ${runde}: Läufe`)
        .toBe(alsText(zuege(st).map(spiegelFeld)));
      expect(alsText(mauerZuege(gespiegelt)), `Runde ${runde}: Mauern`)
        .toBe(alsText(mauerZuege(st).map(spiegelMauer)));
      expect(wegLaenge(gespiegelt, 1)).toBe(wegLaenge(st, 0));
      expect(wegLaenge(gespiegelt, 0)).toBe(wegLaenge(st, 1));
    }
  });
});
