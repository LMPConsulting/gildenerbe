import { describe, it, expect } from 'vitest';
import {
  GRUND, HAUFEN_GROESSE, NADEL_BEREICHE, NADELN, TECH, AESTE, MASCHINEN, FUNDE, PRODUKTE,
  AUSSCHUSS_TIPPS, GESCHICHTE,
} from '../../heuhaufen/src/daten.js';
import {
  neuerStand, werte, tippen, verkaufen, tick, techKaufen, techKosten, techStatus, techStufe,
  techLage, TECH_NACH_ID, TECH_SCHRITTE, TECH_STUFEN_GESAMT, abtragen, ausschussTippen, imAusschuss,
  nadelnGefunden, alleNadeln, maschineKaufen, maschinenKosten, maschineAbbauen, maschineUmschalten,
  fabrik, produktPreis, preisRoh, speichern, laden, offlineNachholen, neuerHaufen, detektor,
  drohneKaufen, drohnenKosten, saugen, fundeVerkaufen, rest, griffMenge, taschePlatz, zufall,
  GRUNDSTROM,
} from '../../heuhaufen/src/engine.js';

/** Schaltet Techknoten samt Voraussetzungen frei, ohne zu bezahlen. */
function freischalten(s, ...ids) {
  const setzen = (id) => {
    for (const b of TECH_NACH_ID[id].braucht) if (!s.tech[b]) setzen(b);
    s.tech[id] = Math.max(1, s.tech[id] || 0);
  };
  ids.forEach(setzen);
  s.rev++;
}

describe('Daten', () => {
  it('hat über 300 Upgrade-Stufen, wie das Vorbild', () => {
    expect(TECH_STUFEN_GESAMT).toBeGreaterThanOrEqual(300);
  });

  it('kennt jede Voraussetzung und hat keine doppelten ids', () => {
    const ids = new Set();
    for (const t of TECH) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      for (const b of t.braucht) expect(TECH_NACH_ID[b], `${t.id} braucht ${b}`).toBeDefined();
      if (t.id !== 'scheune') expect(AESTE.some((a) => a.id === t.ast)).toBe(true);
    }
  });

  it('kann jede Maschine irgendwo im Techtree freischalten', () => {
    const frei = new Set(TECH.flatMap((t) => t.effekt.filter((e) => e[0] === 'frei').map((e) => e[1])));
    for (const m of MASCHINEN) expect(frei.has(m.frei), m.id).toBe(true);
  });

  it('hat für jedes Produkt einen Preis und für jede Nadel eine Geschichte', () => {
    for (const m of MASCHINEN) if (m.produkt) expect(PRODUKTE[m.produkt]).toBeDefined();
    expect(GESCHICHTE.nadeln).toHaveLength(NADELN.length);
    expect(NADEL_BEREICHE).toHaveLength(NADELN.length);
  });

  it('macht jede Verarbeitungsstufe pro Halm wertvoller als rohes Heu', () => {
    const w = werte(neuerStand(1));
    const proHalm = { ballen: 20, pellet: 5, brei: 10, silage: 20, papier: 20, ziegel: 40 };
    for (const [p, halme] of Object.entries(proHalm)) {
      expect(produktPreis(w, p) / halme, p).toBeGreaterThan(preisRoh(w));
    }
  });
});

describe('Neuer Stand', () => {
  it('beginnt mit sechs Millionen Halmen und sechs versteckten Nadeln', () => {
    const s = neuerStand(42);
    expect(s.haufen.gesamt).toBe(HAUFEN_GROESSE);
    expect(rest(s)).toBe(HAUFEN_GROESSE);
    expect(s.nadeln).toHaveLength(6);
    s.nadeln.forEach((n, i) => {
      const [von, bis] = NADEL_BEREICHE[i];
      expect(n.tiefe).toBeGreaterThanOrEqual(Math.floor(HAUFEN_GROESSE * von));
      expect(n.tiefe).toBeLessThanOrEqual(Math.ceil(HAUFEN_GROESSE * bis));
      expect(n.zustand).toBe('versteckt');
    });
  });

  it('ist bei gleichem Seed gleich und bei anderem anders', () => {
    expect(neuerStand(7).nadeln).toEqual(neuerStand(7).nadeln);
    expect(neuerStand(7).nadeln).not.toEqual(neuerStand(8).nadeln);
  });

  it('zieht Zufallszahlen zwischen 0 und 1', () => {
    const s = neuerStand(3);
    for (let i = 0; i < 1000; i++) {
      const x = zufall(s);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('Schaufeln und Verkaufen', () => {
  it('nimmt pro Stich den Griff vom Haufen und legt ihn in die Tasche', () => {
    const s = neuerStand(1);
    const r = tippen(s);
    expect(r.menge).toBe(GRUND.griff);
    expect(s.tasche).toBe(GRUND.griff);
    expect(rest(s)).toBe(HAUFEN_GROESSE - GRUND.griff);
  });

  it('hört auf, wenn die Tasche voll ist', () => {
    const s = neuerStand(1);
    for (let i = 0; i < 100; i++) tippen(s);
    expect(s.tasche).toBe(GRUND.tasche);
    expect(tippen(s).voll).toBe(true);
  });

  it('bezahlt erst, wenn man am Ankauf angekommen ist', () => {
    const s = neuerStand(1);
    for (let i = 0; i < 5; i++) tippen(s);
    expect(verkaufen(s)).toBe(true);
    expect(tippen(s)).toBeNull(); // unterwegs
    tick(s, GRUND.laufzeit / 2);
    expect(s.geld).toBe(0);
    const e = tick(s, GRUND.laufzeit);
    expect(e.some((x) => x.typ === 'verkauft')).toBe(true);
    expect(s.geld).toBeCloseTo(10 * GRUND.preisRoh);
    expect(s.tasche).toBe(0);
  });

  it('geht nicht mit leerer Tasche los', () => {
    expect(verkaufen(neuerStand(1))).toBe(false);
  });

  it('saugt mit dem Staubsauger, bis er überhitzt, und kühlt dann ab', () => {
    const s = neuerStand(1);
    freischalten(s, 'sauger');
    s.tech.schuppen = 4; s.tech.tasche2 = 5; s.rev++;
    saugen(s, true);
    let ueberhitzt = false;
    for (let t = 0; t < GRUND.saugerHitze + 1; t += 0.1) {
      if (tick(s, 0.1).some((e) => e.typ === 'ueberhitzt')) ueberhitzt = true;
    }
    expect(ueberhitzt).toBe(true);
    expect(s.sauger.heiss).toBe(true);
    expect(s.tasche).toBeGreaterThan(GRUND.saugerRate * (GRUND.saugerHitze - 0.5));
    saugen(s, true);
    expect(s.sauger.an).toBe(false); // zu heiß
    for (let t = 0; t < GRUND.saugerHitze; t += 0.1) tick(s, 0.1);
    expect(s.sauger.heiss).toBe(false);
  });
});

describe('Techtree', () => {
  it('kostet, was dransteht, und wird mit jeder Stufe teurer', () => {
    const s = neuerStand(1);
    s.geld = 100;
    const vorher = techKosten(s, 'griff1');
    expect(techKaufen(s, 'griff1').ok).toBe(true);
    expect(s.geld).toBeCloseTo(100 - vorher);
    expect(techKosten(s, 'griff1')).toBeGreaterThan(vorher);
    expect(griffMenge(werte(s))).toBe(GRUND.griff + 1);
  });

  it('verlangt die Voraussetzungen', () => {
    const s = neuerStand(1);
    s.geld = 1e9;
    expect(techStatus(s, 'griff2')).toBe('gesperrt');
    expect(techKaufen(s, 'griff2').ok).toBe(false);
    techKaufen(s, 'griff1');
    expect(techKaufen(s, 'griff2').ok).toBe(true);
  });

  it('endet bei der letzten Stufe', () => {
    const s = neuerStand(1);
    s.geld = 1e9;
    for (let i = 0; i < 10; i++) techKaufen(s, 'griff1');
    expect(techStufe(s, 'griff1')).toBe(TECH_NACH_ID.griff1.stufen);
    expect(techStatus(s, 'griff1')).toBe('max');
  });

  it('verrechnet Werkzeuge mit dem Griff', () => {
    const s = neuerStand(1);
    freischalten(s, 'heugabel');
    expect(griffMenge(werte(s))).toBeCloseTo(GRUND.griff * 1.5);
    s.tech.eimer = 1; s.rev++;
    expect(taschePlatz(werte(s))).toBe(GRUND.tasche + 25);
  });

  it('legt alle Karten überschneidungsfrei nach Schritten vom Start', () => {
    const { lage } = techLage(AESTE);
    const belegt = new Set();
    for (const t of TECH) {
      const l = lage[t.id];
      expect(l, t.id).toBeDefined();
      expect(l.x).toBe(TECH_SCHRITTE[t.id]);
      const key = `${l.x}:${l.y}`;
      expect(belegt.has(key), `${t.id} liegt auf ${key}`).toBe(false);
      belegt.add(key);
      for (const b of t.braucht) expect(lage[b].x).toBeLessThan(l.x);
    }
  });
});

describe('Nadeln', () => {
  it('findet eine Nadel sofort, wenn man sie mit der Hand erwischt', () => {
    const s = neuerStand(5);
    const e = [];
    abtragen(s, s.nadeln[0].tiefe, 'hand', e);
    expect(e.some((x) => x.typ === 'nadel' && x.i === 0)).toBe(true);
    expect(nadelnGefunden(s)).toBe(1);
  });

  it('verliert sie ohne Scanner in den Ausschuss und findet sie dort nach genug Griffen', () => {
    const s = neuerStand(5);
    const e = [];
    abtragen(s, s.nadeln[0].tiefe, 'maschine', e, 0);
    expect(imAusschuss(s)).toBe(1);
    expect(nadelnGefunden(s)).toBe(0);
    for (let i = 0; i < AUSSCHUSS_TIPPS - 1; i++) ausschussTippen(s);
    expect(nadelnGefunden(s)).toBe(0);
    ausschussTippen(s);
    expect(nadelnGefunden(s)).toBe(1);
    expect(imAusschuss(s)).toBe(0);
  });

  it('gibt jeder gefundenen Nadel ihren winzigen Bonus', () => {
    const s = neuerStand(5);
    const vorher = werte(s).griff;
    abtragen(s, s.nadeln[0].tiefe, 'hand');
    expect(werte(s).griff).toBeCloseTo(vorher * 1.01);
  });

  it('piepst lauter, je näher die nächste Nadel ist', () => {
    const s = neuerStand(5);
    const ziel = s.nadeln[0].tiefe;
    abtragen(s, ziel - GRUND.detektor * 2, 'hand');
    expect(detektor(s).stufe).toBe('still');
    abtragen(s, GRUND.detektor * 1.2, 'hand');
    expect(detektor(s).stufe).toBe('kalt');
    abtragen(s, GRUND.detektor * 0.3, 'hand');
    expect(detektor(s).stufe).toBe('warm');
    abtragen(s, GRUND.detektor * 0.45, 'hand');
    expect(detektor(s).stufe).toBe('heiss');
    expect(detektor(s).abstand).toBeCloseTo(GRUND.detektor * 0.05);
  });

  it('findet Fundstücke und verkauft sie', () => {
    const s = neuerStand(9);
    const e = [];
    abtragen(s, 200000, 'hand', e);
    const funde = e.filter((x) => x.typ === 'fund');
    expect(funde.length).toBeGreaterThan(20);
    for (const f of funde) expect(FUNDE.some((x) => x.id === f.id)).toBe(true);
    const betrag = fundeVerkaufen(s);
    expect(betrag).toBeGreaterThan(0);
    expect(fundeVerkaufen(s)).toBe(0);
  });
});

describe('Halle', () => {
  const halle = () => {
    const s = neuerStand(11);
    freischalten(s, 'automatisierung');
    s.geld = 1e9;
    return s;
  };

  it('kauft Greifarme, bis die Stellplätze voll sind', () => {
    const s = halle();
    const erster = maschinenKosten(s, 'arm');
    expect(maschineKaufen(s, 'arm').ok).toBe(true);
    expect(maschinenKosten(s, 'arm')).toBeGreaterThan(erster);
    for (let i = 0; i < 100; i++) maschineKaufen(s, 'arm');
    expect(s.maschinen.arm).toBe(werte(s).plaetze);
    expect(maschineKaufen(s, 'arm').grund).toBe('platz');
    expect(maschineAbbauen(s, 'arm').ok).toBe(true);
    expect(maschineKaufen(s, 'arm').ok).toBe(true);
  });

  it('bremst Maschinen, wenn der Strom nicht reicht', () => {
    const s = halle();
    for (let i = 0; i < 10; i++) maschineKaufen(s, 'arm');
    const f = fabrik(s);
    expect(f.bedarf).toBe(20);
    expect(f.strom).toBeCloseTo(GRUNDSTROM / 20);
    expect(f.foerderung).toBeCloseTo(10 * 8 * f.strom);
  });

  it('lässt nicht mehr durch, als das Band trägt', () => {
    const s = halle();
    freischalten(s, 'stromnetz');
    for (let i = 0; i < 15; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 5; i++) maschineKaufen(s, 'generator');
    const f = fabrik(s);
    expect(f.strom).toBe(1);
    expect(f.foerderung).toBeGreaterThan(GRUND.band);
    expect(f.fluss).toBe(GRUND.band);
    expect(f.brennstoff).toBe(10); // fünf Generatoren essen mit
  });

  it('verliert ohne Scanner Nadeln, mit genug Scannern keine', () => {
    const s = halle();
    freischalten(s, 'scanner');
    maschineKaufen(s, 'arm');
    expect(fabrik(s).deckung).toBe(0);
    maschineKaufen(s, 'scanner');
    expect(fabrik(s).deckung).toBe(1);
  });

  it('verdient mit Pressballen mehr als mit losem Heu', () => {
    const s = halle();
    freischalten(s, 'presse', 'stromnetz');
    for (let i = 0; i < 5; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 3; i++) maschineKaufen(s, 'generator');
    const ohne = fabrik(s).einnahmen;
    maschineKaufen(s, 'presse');
    const mit = fabrik(s);
    expect(mit.produkte.ballen).toBeGreaterThan(0);
    expect(mit.einnahmen).toBeGreaterThan(ohne);
    maschineUmschalten(s, 'presse');
    expect(fabrik(s).einnahmen).toBeCloseTo(ohne);
  });

  it('zahlt pro Sekunde, was die Halle verspricht', () => {
    const s = halle();
    for (let i = 0; i < 2; i++) maschineKaufen(s, 'arm');
    s.geld = 0;
    const f = fabrik(s);
    tick(s, 10);
    expect(s.geld).toBeCloseTo(f.einnahmen * 10, 5);
    expect(s.haufen.entfernt).toBeCloseTo(f.fluss * 10, 5);
  });

  it('lässt Drohnen nur bis zur Obergrenze kaufen', () => {
    const s = neuerStand(1);
    s.geld = 1e6;
    expect(drohneKaufen(s).grund).toBe('gesperrt');
    freischalten(s, 'drohne');
    for (let i = 0; i < 3; i++) expect(drohneKaufen(s).ok).toBe(true);
    expect(drohneKaufen(s).grund).toBe('voll');
    expect(drohnenKosten(s)).toBeGreaterThan(250);
  });
});

describe('Speichern, Abwesenheit, neuer Haufen', () => {
  it('überlebt Speichern und Laden', () => {
    const s = neuerStand(3);
    s.geld = 123.5;
    freischalten(s, 'heugabel');
    for (let i = 0; i < 4; i++) tippen(s);
    const zurueck = laden(speichern(s));
    expect(zurueck.geld).toBe(123.5);
    expect(zurueck.tasche).toBe(s.tasche);
    expect(zurueck.nadeln).toEqual(s.nadeln);
    expect(griffMenge(werte(zurueck))).toBe(griffMenge(werte(s)));
  });

  it('weist Unsinn zurück', () => {
    expect(laden('kein json')).toBeNull();
    expect(laden('{"version": 99}')).toBeNull();
    expect(laden('null')).toBeNull();
  });

  it('lässt die Halle während der Abwesenheit mit halber Kraft weiterlaufen', () => {
    const s = neuerStand(3);
    freischalten(s, 'automatisierung');
    s.geld = 1e6;
    maschineKaufen(s, 'arm');
    s.geld = 0;
    const f = fabrik(s);
    s.zuletzt = 0;
    const bericht = offlineNachholen(s, 3600 * 1000);
    expect(bericht.sekunden).toBe(3600);
    expect(bericht.geld).toBeCloseTo(f.einnahmen * 3600 * GRUND.offlineEff, 3);
  });

  it('begrenzt die Abwesenheit auf die Nachtschicht', () => {
    const s = neuerStand(3);
    freischalten(s, 'automatisierung');
    s.zuletzt = 0;
    expect(offlineNachholen(s, 48 * 3600 * 1000).sekunden).toBe(GRUND.offlineStunden * 3600);
  });

  it('erzählt nichts, wenn nichts läuft', () => {
    const s = neuerStand(3);
    s.zuletzt = 0;
    expect(offlineNachholen(s, 3600 * 1000)).toBeNull();
  });

  it('beginnt nach sechs Nadeln einen größeren Haufen mit Bonus und behält das Album', () => {
    const s = neuerStand(4);
    expect(neuerHaufen(s)).toBeNull();
    abtragen(s, s.haufen.gesamt, 'hand');
    expect(alleNadeln(s)).toBe(true);
    const neu = neuerHaufen(s);
    expect(neu.haufen.gesamt).toBe(HAUFEN_GROESSE * 1.5);
    expect(neu.erledigt).toBe(1);
    expect(neu.geld).toBe(0);
    expect(nadelnGefunden(neu)).toBe(0);
    expect(Object.keys(neu.funde).length).toBe(Object.keys(s.funde).length);
    expect(werte(neu).preisAlle).toBeGreaterThan(werte(neuerStand(4)).preisAlle);
  });
});
