import { describe, it, expect } from 'vitest';
import {
  STUFEN, BUCHSTABEN, PUNKTE, TEILE,
  neuerStand, normalisieren, wortPruefen, musterBauen, erlaubteFehler,
  rundeStarten, raten, wortRaten, aufgeben, punkteFuer, rundeAbschliessen,
  rundeAbbrechen, wortZiehen, gezeichnet, offen, fuehrung, alsCode, ausCode,
} from '../../hangman/src/engine.js';
import { WOERTER, KATEGORIEN, ALLE } from '../../hangman/src/woerter.js';
import { galgenSvg, TEIL_PFADE, beschriftung } from '../../hangman/src/galgen.js';

const starten = (wort, extra = {}) => {
  const s = neuerStand();
  Object.assign(s, extra);
  rundeStarten(s, { wort, setzer: 1, rater: 0 });
  return s;
};

/** Rät alle Buchstaben des Wortes — der kürzeste Weg zum Sieg. */
const alleTreffer = (s) => {
  for (const b of new Set([...s.aktuell.wort].filter((z) => BUCHSTABEN.includes(z)))) {
    raten(s, b);
  }
  return s;
};

describe('normalisieren', () => {
  it('macht Großbuchstaben und wirft ß raus', () => {
    expect(normalisieren('straße')).toBe('STRASSE');
    expect(normalisieren('  fluss  ')).toBe('FLUSS');
  });

  it('fasst Leerzeichen zusammen', () => {
    expect(normalisieren('alter   markt')).toBe('ALTER MARKT');
  });

  it('lässt Umlaute stehen', () => {
    expect(normalisieren('köln')).toBe('KÖLN');
  });

  it('verträgt null und undefined', () => {
    expect(normalisieren(null)).toBe('');
    expect(normalisieren(undefined)).toBe('');
  });
});

describe('wortPruefen', () => {
  it('nimmt ein normales Wort an', () => {
    expect(wortPruefen('Flughafen')).toBeNull();
  });

  it('nimmt Umlaute, Leerzeichen und Bindestrich an', () => {
    expect(wortPruefen('Käse-Brot')).toBeNull();
    expect(wortPruefen('Alter Markt')).toBeNull();
  });

  it('lehnt Leeres ab', () => {
    expect(wortPruefen('')).toMatch(/nichts/);
    expect(wortPruefen('   ')).toMatch(/nichts/);
  });

  it('lehnt zu kurze Wörter ab', () => {
    expect(wortPruefen('AB')).toMatch(/drei Buchstaben/);
  });

  it('zählt nur Buchstaben für die Mindestlänge', () => {
    expect(wortPruefen('A B')).toMatch(/drei Buchstaben/);
  });

  it('lehnt Ziffern und Satzzeichen ab', () => {
    expect(wortPruefen('Haus7')).toMatch(/geht nicht/);
    expect(wortPruefen('Haus!')).toMatch(/geht nicht/);
  });

  it('lehnt zu lange Eingaben ab', () => {
    expect(wortPruefen('A'.repeat(25))).toMatch(/24 Zeichen/);
  });

  it('lehnt mehr als drei Wörter ab', () => {
    expect(wortPruefen('eins zwei drei vier')).toMatch(/drei Wörter/);
  });

  it('erlaubt ß, weil daraus SS wird', () => {
    expect(wortPruefen('Straße')).toBeNull();
  });
});

describe('musterBauen', () => {
  it('zeigt nur geratene Buchstaben', () => {
    expect(musterBauen('HALLO', ['L'])).toEqual([null, null, 'L', 'L', null]);
  });

  it('zeigt Trenner von Anfang an', () => {
    expect(musterBauen('AB-CD', [])).toEqual([null, null, '-', null, null]);
    expect(musterBauen('AB CD', [])).toEqual([null, null, ' ', null, null]);
  });
});

describe('Stufen', () => {
  it('lassen unterschiedlich viele Fehler zu', () => {
    expect(erlaubteFehler('leicht')).toBe(11);
    expect(erlaubteFehler('normal')).toBe(9);
    expect(erlaubteFehler('schwer')).toBe(7);
  });

  it('fallen bei Unsinn auf normal zurück', () => {
    expect(erlaubteFehler('gibtesnicht')).toBe(9);
  });

  it('summieren vorgezeichnete Teile und Fehler zur Gesamtzahl', () => {
    for (const [id, s] of Object.entries(STUFEN)) {
      expect(s.vorab + erlaubteFehler(id)).toBe(TEILE.length);
    }
  });
});

describe('rundeStarten', () => {
  it('legt Muster, Fehlerkonto und Rollen an', () => {
    const s = starten('HALLO');
    expect(s.aktuell.wort).toBe('HALLO');
    expect(s.aktuell.muster).toEqual([null, null, null, null, null]);
    expect(s.aktuell.fehler).toBe(0);
    expect(s.aktuell.erlaubt).toBe(9);
    expect(s.aktuell.rater).toBe(0);
    expect(s.aktuell.setzer).toBe(1);
  });

  it('normalisiert das Wort', () => {
    const s = starten('  Straße ');
    expect(s.aktuell.wort).toBe('STRASSE');
  });

  it('kürzt den Tipp', () => {
    const s = neuerStand();
    rundeStarten(s, { wort: 'HALLO', tipp: 'x'.repeat(90), setzer: 0, rater: 1 });
    expect(s.aktuell.tipp).toHaveLength(60);
  });

  it('wirft bei unbrauchbaren Wörtern', () => {
    const s = neuerStand();
    expect(() => rundeStarten(s, { wort: 'A1', setzer: 0, rater: 1 })).toThrow();
  });

  it('merkt sich nur gezogene Wörter, nicht selbst ausgedachte', () => {
    const s = neuerStand();
    rundeStarten(s, { wort: 'GEHEIM', setzer: 1, rater: 0 });
    expect(s.benutzt).toEqual([]);
    rundeAbbrechen(s);
    rundeStarten(s, { wort: 'GEZOGEN', setzer: -1, rater: 0 });
    expect(s.benutzt).toEqual(['GEZOGEN']);
  });

  it('zählt, wer gestellt hat — aber nicht beim Handy', () => {
    const s = starten('HALLO');
    expect(s.statistik.gestellt).toEqual([0, 1]);
    rundeAbbrechen(s);
    rundeStarten(s, { wort: 'BAUM', setzer: -1, rater: 0 });
    expect(s.statistik.gestellt).toEqual([0, 1]);
  });
});

describe('raten', () => {
  it('deckt Treffer auf, ohne Fehler zu zählen', () => {
    const s = starten('HALLO');
    const was = raten(s, 'L');
    expect(was.treffer).toBe(true);
    expect(s.aktuell.fehler).toBe(0);
    expect(s.aktuell.muster).toEqual([null, null, 'L', 'L', null]);
  });

  it('zählt Fehlgriffe', () => {
    const s = starten('HALLO');
    expect(raten(s, 'X').treffer).toBe(false);
    expect(s.aktuell.fehler).toBe(1);
    expect(s.aktuell.daneben).toEqual(['X']);
  });

  it('nimmt Kleinbuchstaben an', () => {
    const s = starten('HALLO');
    expect(raten(s, 'h').treffer).toBe(true);
  });

  it('ignoriert denselben Buchstaben zweimal', () => {
    const s = starten('HALLO');
    raten(s, 'X');
    expect(raten(s, 'X')).toBeNull();
    expect(s.aktuell.fehler).toBe(1);
  });

  it('ignoriert Zeichen, die es gar nicht gibt', () => {
    const s = starten('HALLO');
    expect(raten(s, '7')).toBeNull();
    expect(raten(s, ' ')).toBeNull();
    expect(s.aktuell.fehler).toBe(0);
  });

  it('deckt kein Ä auf, wenn A geraten wurde', () => {
    const s = starten('KÄSE');
    expect(raten(s, 'A').treffer).toBe(false);
    expect(raten(s, 'Ä').treffer).toBe(true);
  });

  it('gewinnt, sobald alle Buchstaben stehen', () => {
    const s = alleTreffer(starten('HALLO'));
    expect(s.aktuell.fertig).toBe('gewonnen');
  });

  it('gewinnt auch, wenn Trenner im Wort sind', () => {
    const s = alleTreffer(starten('AB-CD'));
    expect(s.aktuell.fertig).toBe('gewonnen');
  });

  it('verliert nach dem letzten erlaubten Fehler', () => {
    const s = starten('HALLO', { stufe: 'schwer' });
    for (const b of ['B', 'C', 'D', 'F', 'G', 'J', 'K']) raten(s, b);
    expect(s.aktuell.fehler).toBe(7);
    expect(s.aktuell.fertig).toBe('verloren');
  });

  it('nimmt nach dem Ende nichts mehr an', () => {
    const s = alleTreffer(starten('HALLO'));
    expect(raten(s, 'X')).toBeNull();
  });
});

describe('wortRaten', () => {
  it('gewinnt bei richtiger Eingabe und deckt alles auf', () => {
    const s = starten('HALLO');
    const was = wortRaten(s, 'hallo');
    expect(was.treffer).toBe(true);
    expect(s.aktuell.fertig).toBe('gewonnen');
    expect(s.aktuell.muster.join('')).toBe('HALLO');
  });

  it('kostet bei falscher Eingabe einen Fehlversuch', () => {
    const s = starten('HALLO');
    expect(wortRaten(s, 'TSCHÜSS').treffer).toBe(false);
    expect(s.aktuell.fehler).toBe(1);
  });

  it('kann die Runde beenden', () => {
    const s = starten('HALLO', { stufe: 'schwer' });
    for (let i = 0; i < 7; i++) wortRaten(s, `FALSCH${i}`);
    expect(s.aktuell.fertig).toBe('verloren');
  });

  it('ignoriert leere Eingaben', () => {
    const s = starten('HALLO');
    expect(wortRaten(s, '   ')).toBeNull();
    expect(s.aktuell.fehler).toBe(0);
  });
});

describe('aufgeben', () => {
  it('beendet die Runde als verloren', () => {
    const s = starten('HALLO');
    expect(aufgeben(s)).toBe('verloren');
    expect(s.aktuell.fehler).toBe(s.aktuell.erlaubt);
  });

  it('tut nach dem Ende nichts mehr', () => {
    const s = starten('HALLO');
    aufgeben(s);
    expect(aufgeben(s)).toBeNull();
  });
});

describe('Punkte', () => {
  it('belohnen fehlerfreies Raten am meisten', () => {
    const s = alleTreffer(starten('HALLO'));
    const gut = punkteFuer(s.aktuell);
    expect(gut[0]).toBe(PUNKTE.grundGewonnen + 9 * PUNKTE.jeUebrigerFehler);
    expect(gut[1]).toBe(0);
  });

  it('ziehen für jeden Fehlgriff ab', () => {
    const s = starten('HALLO');
    raten(s, 'X');
    alleTreffer(s);
    expect(punkteFuer(s.aktuell)[0])
      .toBe(PUNKTE.grundGewonnen + 8 * PUNKTE.jeUebrigerFehler);
  });

  it('geben einen Zuschlag für lange Wörter', () => {
    const s = alleTreffer(starten('DONAUDAMPFSCHIFF'));
    expect(punkteFuer(s.aktuell)[0])
      .toBe(PUNKTE.grundGewonnen + 9 * PUNKTE.jeUebrigerFehler + PUNKTE.langesWort);
  });

  it('gehen an den Setzer, wenn niemand es errät', () => {
    const s = starten('HALLO');
    aufgeben(s);
    expect(punkteFuer(s.aktuell)).toEqual([0, PUNKTE.setzerGewinnt]);
  });

  it('gehen an niemanden, wenn das Handy das Wort stellte', () => {
    const s = neuerStand();
    rundeStarten(s, { wort: 'HALLO', setzer: -1, rater: 0 });
    aufgeben(s);
    expect(punkteFuer(s.aktuell)).toEqual([0, 0]);
  });

  it('sind vor dem Ende null', () => {
    const s = starten('HALLO');
    expect(punkteFuer(s.aktuell)).toEqual([0, 0]);
  });
});

describe('rundeAbschliessen', () => {
  it('bucht die Punkte und räumt die Runde weg', () => {
    const s = alleTreffer(starten('HALLO'));
    const erwartet = punkteFuer(s.aktuell)[0];
    rundeAbschliessen(s);
    expect(s.punkte[0]).toBe(erwartet);
    expect(s.aktuell).toBeNull();
    expect(s.runde).toBe(2);
  });

  it('tauscht die Rollen', () => {
    const s = neuerStand();
    expect(s.dran).toBe(0);
    rundeStarten(s, { wort: 'HALLO', setzer: 1, rater: 0 });
    alleTreffer(s);
    rundeAbschliessen(s);
    expect(s.dran).toBe(1);
  });

  it('schreibt in den Verlauf, neueste zuerst', () => {
    const s = neuerStand();
    rundeStarten(s, { wort: 'HALLO', setzer: 1, rater: 0 });
    alleTreffer(s);
    rundeAbschliessen(s);
    rundeStarten(s, { wort: 'BAUM', setzer: 0, rater: 1 });
    alleTreffer(s);
    rundeAbschliessen(s);
    expect(s.verlauf.map((z) => z.wort)).toEqual(['BAUM', 'HALLO']);
  });

  it('tut nichts, solange die Runde läuft', () => {
    const s = starten('HALLO');
    rundeAbschliessen(s);
    expect(s.aktuell).not.toBeNull();
    expect(s.runde).toBe(1);
  });

  it('zählt Erfolge und Fehlschläge getrennt', () => {
    const s = neuerStand();
    rundeStarten(s, { wort: 'HALLO', setzer: 1, rater: 0 });
    alleTreffer(s);
    rundeAbschliessen(s);
    rundeStarten(s, { wort: 'BAUM', setzer: 0, rater: 1 });
    aufgeben(s);
    rundeAbschliessen(s);
    expect(s.statistik.erraten).toEqual([1, 0]);
    expect(s.statistik.gescheitert).toEqual([0, 1]);
  });
});

describe('gezeichnet und offen', () => {
  it('zählt vorgezeichnete Teile mit', () => {
    const s = starten('HALLO', { stufe: 'schwer' });
    expect(gezeichnet(s.aktuell)).toBe(4);
    raten(s, 'X');
    expect(gezeichnet(s.aktuell)).toBe(5);
  });

  it('meldet benutzte Buchstaben als vergeben', () => {
    const s = starten('HALLO');
    expect(offen(s.aktuell, 'L')).toBe(true);
    raten(s, 'L');
    expect(offen(s.aktuell, 'L')).toBe(false);
  });

  it('meldet nach dem Ende alles als vergeben', () => {
    const s = alleTreffer(starten('HALLO'));
    expect(offen(s.aktuell, 'X')).toBe(false);
  });
});

describe('wortZiehen', () => {
  it('liefert ein Wort mit Kategorie', () => {
    const s = neuerStand();
    const zug = wortZiehen(s, 'reise', () => 0);
    expect(WOERTER.reise).toContain(zug.wort);
    expect(zug.kategorie).toBe('reise');
  });

  it('überspringt schon benutzte Wörter', () => {
    const s = neuerStand();
    s.benutzt = WOERTER.reise.slice(0, WOERTER.reise.length - 1);
    const zug = wortZiehen(s, 'reise', () => 0);
    expect(zug.wort).toBe(WOERTER.reise[WOERTER.reise.length - 1]);
  });

  it('fängt von vorn an, wenn alles durch ist', () => {
    const s = neuerStand();
    s.benutzt = [...WOERTER.reise];
    const zug = wortZiehen(s, 'reise', () => 0);
    expect(WOERTER.reise).toContain(zug.wort);
    expect(s.benutzt).toEqual([]);
  });

  it('zieht bei „alle“ quer durch die Listen', () => {
    const s = neuerStand();
    const zug = wortZiehen(s, 'alle', () => 0);
    expect(ALLE.some((e) => e.wort === zug.wort)).toBe(true);
  });

  it('fällt bei unbekannter Kategorie auf Allerlei zurück', () => {
    const s = neuerStand();
    const zug = wortZiehen(s, 'gibtesnicht', () => 0);
    expect(WOERTER.allerlei).toContain(zug.wort);
  });
});

describe('Wortlisten', () => {
  it('enthalten nur erlaubte Zeichen', () => {
    for (const [kat, liste] of Object.entries(WOERTER)) {
      for (const wort of liste) {
        expect(wortPruefen(wort), `${kat}: ${wort}`).toBeNull();
        expect(wort, `${kat}: ${wort}`).toBe(normalisieren(wort));
      }
    }
  });

  it('haben zu jeder Kategorie eine Liste und umgekehrt', () => {
    expect(KATEGORIEN.map((k) => k.id).sort()).toEqual(Object.keys(WOERTER).sort());
  });

  it('wiederholen sich innerhalb einer Liste nicht', () => {
    for (const [kat, liste] of Object.entries(WOERTER)) {
      expect(new Set(liste).size, kat).toBe(liste.length);
    }
  });

  it('bringen genug Nachschub für einen Urlaub mit', () => {
    expect(ALLE.length).toBeGreaterThan(200);
  });
});

describe('fuehrung', () => {
  it('meldet Gleichstand als null', () => {
    expect(fuehrung(neuerStand())).toBeNull();
  });

  it('nennt Vorsprung und Person', () => {
    const s = neuerStand();
    s.punkte = [30, 12];
    expect(fuehrung(s)).toEqual({ index: 0, vorsprung: 18 });
    s.punkte = [4, 12];
    expect(fuehrung(s)).toEqual({ index: 1, vorsprung: 8 });
  });
});

describe('Punktestand als Code', () => {
  it('überlebt den Weg hin und zurück', () => {
    const s = neuerStand(['Anna', 'Bert']);
    s.punkte = [42, 17];
    s.runde = 6;
    s.dran = 1;
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler.map((x) => x.name)).toEqual(['Anna', 'Bert']);
    expect(zurueck.punkte).toEqual([42, 17]);
    expect(zurueck.runde).toBe(6);
    expect(zurueck.dran).toBe(1);
  });

  it('nimmt keinen fremden Code an', () => {
    expect(() => ausCode('DKS1-abc')).toThrow(/Galgenmännchen/);
    expect(() => ausCode('')).toThrow();
  });

  it('meldet kaputte Codes statt zu raten', () => {
    expect(() => ausCode('HMS1-###')).toThrow(/unvollständig|verrutscht/);
  });

  it('nimmt das laufende Wort nicht mit', () => {
    const s = starten('GEHEIM');
    expect(alsCode(s)).not.toMatch(/GEHEIM/);
    expect(ausCode(alsCode(s)).aktuell).toBeNull();
  });
});

describe('Zeichnung', () => {
  it('zeigt am Anfang nichts', () => {
    expect(galgenSvg(0)).not.toMatch(/<path/);
  });

  it('zeichnet je Fehler einen Strich mehr', () => {
    const zaehlen = (n) => (galgenSvg(n).match(/<path/g) || []).length;
    expect(zaehlen(3)).toBe(3);
    expect(zaehlen(5)).toBe(5);
  });

  it('setzt ein Gesicht auf, sobald der Kopf steht', () => {
    const ohneKopf = galgenSvg(5);
    const mitKopf = galgenSvg(6);
    expect(ohneKopf).not.toMatch(/strich--gesicht/);
    expect(mitKopf).toMatch(/strich--gesicht/);
  });

  it('hört bei elf Strichen auf', () => {
    const alles = galgenSvg(99);
    expect((alles.match(/<path/g) || []).length).toBe(TEIL_PFADE.length + 1);
  });

  it('markiert vorgezeichnete Teile', () => {
    expect(galgenSvg(4, { vorab: 4 })).toMatch(/strich--vorab/);
    expect(galgenSvg(4, { vorab: 0 })).not.toMatch(/strich--vorab/);
  });

  it('färbt Sieg und Niederlage verschieden', () => {
    expect(galgenSvg(6, { zustand: 'froh' })).toMatch(/galgen--froh/);
    expect(galgenSvg(6, { zustand: 'weg' })).toMatch(/galgen--weg/);
  });

  it('beschriftet für Screenreader', () => {
    expect(beschriftung(0, 'laeuft')).toMatch(/kein Strich/);
    expect(beschriftung(4, 'laeuft')).toMatch(/4 von 11/);
    expect(beschriftung(11, 'froh')).toMatch(/Gerettet/);
    expect(beschriftung(11, 'weg')).toMatch(/hängt/);
  });

  it('hat für jedes Teil genau einen Pfad', () => {
    expect(TEIL_PFADE).toHaveLength(TEILE.length);
    expect(TEIL_PFADE.map((t) => t.id)).toEqual(TEILE);
  });
});
