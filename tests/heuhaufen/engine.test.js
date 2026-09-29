import { describe, it, expect } from 'vitest';
import {
  GRUND, LADUNGEN, NADEL_BEREICHE, NADELN, TECH, AESTE, MASCHINEN, PRODUKTE, GESCHICHTE, WERKZEUGE,
  MISSIONEN, AUFTRAEGE, AUFTRAG_PAUSE, KREDIT_AUFSCHLAG,
} from '../../heuhaufen/src/daten.js';
import {
  neuerStand, werte, stich, verkaufen, tick, techKaufen, techKosten, techStatus, techStufe,
  techLage, TECH_NACH_ID, TECH_SCHRITTE, TECH_STUFEN_GESAMT, abtragen, nadelnGefunden, alleNadeln,
  maschineKaufen, maschinenKosten, maschineAbbauen, maschineUmschalten, fabrik, produktPreis, preisRoh,
  speichern, laden, offlineNachholen, detektor, drohneKaufen, drohnenKosten, saugen, rest, stichMenge,
  taschePlatz, zufall, GRUNDSTROM, werkzeugWaehlen, werkzeugFrei, missionStand, auftrag, auftragAblehnen,
  ladungBestellen, ladungPreis, ladungGroesse, NADEL_RUTSCH, saugerBlockiert, artenGefunden,
} from '../../heuhaufen/src/engine.js';
import { zahl, geld, dauer, prozent, halme } from '../../heuhaufen/src/format.js';

/** Schaltet Forschung samt Voraussetzungen frei, ohne zu bezahlen. */
function freischalten(s, ...ids) {
  const setzen = (id) => {
    for (const b of TECH_NACH_ID[id].braucht) if (!s.tech[b]) setzen(b);
    s.tech[id] = Math.max(1, s.tech[id] || 0);
  };
  ids.forEach(setzen);
  s.rev++;
}

describe('Daten', () => {
  it('hat über 350 Stufen im Forschungsbaum, wie das Vorbild', () => {
    expect(TECH_STUFEN_GESAMT).toBeGreaterThanOrEqual(351);
  });

  it('kennt jede Voraussetzung und hat keine doppelten ids', () => {
    const ids = new Set();
    for (const t of TECH) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      for (const b of t.braucht) expect(TECH_NACH_ID[b], `${t.id} braucht ${b}`).toBeDefined();
      if (t.id !== 'scheune') expect(AESTE.some((a) => a.id === t.ast), t.id).toBe(true);
    }
  });

  it('hat zehn Äste wie das Vorbild', () => {
    expect(AESTE.map((a) => a.name)).toEqual([
      'Handarbeit', 'Hofbau', 'Heulinien', 'Strom', 'Verarbeitung', 'Automatisierung', 'Wasser', 'Suche', 'Verkauf', 'Fitness',
    ]);
  });

  it('lässt Upgrade-Gruppen ohne Nachfolger und mit gleichen Voraussetzungen', () => {
    for (const t of TECH.filter((x) => x.gruppe)) {
      expect(TECH.some((x) => x.braucht.includes(t.id)), `${t.id} hat Nachfolger`).toBe(false);
      const geschwister = TECH.filter((x) => x.gruppe === t.gruppe && x.ast === t.ast);
      for (const g of geschwister) expect(g.braucht, `${t.id} / ${g.id}`).toEqual(t.braucht);
    }
  });

  it('kann jede Maschine und jedes Werkzeug freischalten', () => {
    const frei = new Set(TECH.flatMap((t) => t.effekt.filter((e) => e[0] === 'frei').map((e) => e[1])));
    for (const m of MASCHINEN) expect(frei.has(m.frei), m.id).toBe(true);
    for (const w of WERKZEUGE) if (w.frei) expect(frei.has(w.frei), w.id).toBe(true);
  });

  it('hat 24 Nadelarten, eine Geschichte je Nadel der ersten Ladung und passende Produkte', () => {
    expect(NADELN).toHaveLength(24);
    expect(GESCHICHTE.nadeln).toHaveLength(NADEL_BEREICHE.length);
    for (const m of MASCHINEN) if (m.produkt) expect(PRODUKTE[m.produkt], m.id).toBeDefined();
    for (const a of AUFTRAEGE) expect(PRODUKTE[a.will], a.will).toBeDefined();
  });

  it('macht jede Verarbeitungsstufe pro Halm wertvoller als loses Heu', () => {
    const w = werte(neuerStand(1));
    for (const [p, d] of Object.entries(PRODUKTE)) {
      if (p === 'roh') continue;
      expect(produktPreis(w, p) / d.halme, p).toBeGreaterThan(preisRoh(w));
    }
    // Der Wickler darf keine Falle sein: Wickelballen sind mehr wert als der Ballen, aus dem sie werden.
    expect(produktPreis(w, 'silage')).toBeGreaterThan(produktPreis(w, 'ballen') * 1.5);
  });

  it('verlangt in jeder Mission etwas, das es gibt', () => {
    for (const m of MISSIONEN) {
      if (m.art === 'tech') expect(TECH_NACH_ID[m.ziel], m.text).toBeDefined();
      if (m.art === 'maschine') expect(MASCHINEN.some((x) => x.id === m.ziel[0]), m.text).toBe(true);
      if (m.art === 'produziert') expect(PRODUKTE[m.ziel[0]], m.text).toBeDefined();
      if (m.art === 'werkzeug') expect(WERKZEUGE.some((x) => x.id === m.ziel), m.text).toBe(true);
    }
  });
});

describe('Neuer Stand', () => {
  it('beginnt mit rund sechs Millionen Halmen und sechs versteckten Nadeln der ersten Arten', () => {
    const s = neuerStand(42);
    expect(s.haufen.gesamt).toBe(LADUNGEN[0]);
    expect(rest(s)).toBe(6_000_000);
    expect(s.nadeln.map((n) => n.art)).toEqual([0, 1, 2, 3, 4, 5]);
    s.nadeln.forEach((n, i) => {
      const [von, bis] = NADEL_BEREICHE[i];
      expect(n.tiefe).toBeGreaterThanOrEqual(Math.floor(s.haufen.gesamt * von));
      expect(n.tiefe).toBeLessThanOrEqual(Math.ceil(s.haufen.gesamt * bis));
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

describe('Werkzeuge und Tragen', () => {
  it('sticht mit dem Spaten den Griff heraus, legt ihn in die Tasche und verschüttet etwas', () => {
    const s = neuerStand(1);
    const r = stich(s);
    expect(r.menge).toBe(GRUND.griff);
    expect(s.tasche).toBe(GRUND.griff);
    expect(s.boden).toBeCloseTo(GRUND.griff * GRUND.verschuetten);
    expect(rest(s)).toBeCloseTo(6_000_000 - GRUND.griff * (1 + GRUND.verschuetten));
  });

  it('holt mit der Heugabel mehr heraus und mit der Sandschaufel weniger, die aber ohne Puste', () => {
    const s = neuerStand(1);
    freischalten(s, 'heugabel', 'sandschaufel', 'eimer', 'schubkarre');
    expect(werkzeugWaehlen(s, 'heugabel')).toBe(true);
    expect(stich(s).menge).toBeCloseTo(GRUND.griff * GRUND.heugabel);
    werkzeugWaehlen(s, 'sandschaufel');
    const vorher = s.ausdauer;
    expect(stich(s).menge).toBeCloseTo(GRUND.griff * GRUND.sandschaufel);
    expect(s.ausdauer).toBe(vorher);
  });

  it('lässt gesperrte Werkzeuge nicht wählen', () => {
    const s = neuerStand(1);
    expect(werkzeugFrei(s, 'heugabel')).toBe(false);
    expect(werkzeugWaehlen(s, 'heugabel')).toBe(false);
    expect(s.werkzeug).toBe('spaten');
    expect(werkzeugWaehlen(s, 'detektor')).toBe(true);
    expect(stich(s).detektor).toBe(true);
  });

  it('wird ohne Ausdauer müde und erholt sich', () => {
    const s = neuerStand(1);
    freischalten(s, 'foerderband');
    s.ausdauer = 0;
    const r = stich(s);
    expect(r.muede).toBe(true);
    expect(r.menge).toBeCloseTo(GRUND.griff * GRUND.erschoepft);
    tick(s, 100);
    expect(s.ausdauer).toBe(GRUND.ausdauer);
  });

  it('fegt verschüttetes Heu mit dem Besen zurück', () => {
    const s = neuerStand(1);
    freischalten(s, 'besen', 'foerderband');
    for (let i = 0; i < 50; i++) stich(s);
    const boden = s.boden;
    expect(boden).toBeGreaterThan(0);
    werkzeugWaehlen(s, 'besen');
    const r = stich(s);
    expect(r.gefegt).toBe(true);
    expect(s.boden).toBeCloseTo(Math.max(0, boden - GRUND.besen));
    expect(s.stat.gefegt).toBeCloseTo(Math.min(boden, GRUND.besen));
  });

  it('hört auf, wenn die Tasche voll ist, und bezahlt erst am Stand', () => {
    const s = neuerStand(1);
    for (let i = 0; i < 100; i++) stich(s);
    expect(s.tasche).toBe(GRUND.tasche);
    expect(stich(s).voll).toBe(true);
    expect(verkaufen(s)).toBe(true);
    expect(stich(s)).toBeNull();
    s.mission = MISSIONEN.length; // sonst zahlen Missionen Kleinigkeiten dazwischen
    tick(s, GRUND.laufzeit / 2);
    expect(s.geld).toBe(0);
    const e = tick(s, GRUND.laufzeit);
    expect(e.some((x) => x.typ === 'verkauft')).toBe(true);
    expect(s.geld).toBeGreaterThanOrEqual(GRUND.tasche * GRUND.preisRoh);
    expect(s.tasche).toBe(0);
  });

  it('verkauft mit Förderband sofort, ohne Tasche', () => {
    const s = neuerStand(1);
    freischalten(s, 'foerderband');
    for (let i = 0; i < 20; i++) stich(s);
    expect(s.tasche).toBe(0);
    expect(s.geld).toBeCloseTo(20 * GRUND.griff * GRUND.preisRoh, 6);
  });

  it('saugt mit dem Hofsauger, überhitzt, kühlt ab — und heizt nicht, wenn er nichts zu tun hat', () => {
    const s = neuerStand(1);
    freischalten(s, 'sauger', 'foerderband');
    werkzeugWaehlen(s, 'sauger');
    saugen(s, true);
    let ueberhitzt = false;
    for (let t = 0; t < GRUND.saugerHitze + 1; t += 0.1) {
      if (tick(s, 0.1).some((e) => e.typ === 'ueberhitzt')) ueberhitzt = true;
    }
    expect(ueberhitzt).toBe(true);
    expect(saugerBlockiert(s)).toBe('heiss');
    for (let t = 0; t < GRUND.saugerHitze; t += 0.1) tick(s, 0.1);
    expect(s.sauger.heiss).toBe(false);
    s.haufen.entfernt = s.haufen.gesamt;
    saugen(s, true);
    tick(s, 1);
    expect(s.sauger.hitze).toBe(0);
  });
});

describe('Forschung', () => {
  it('kostet, was dransteht, und wird mit jeder Stufe teurer — ohne Rundungsrauschen', () => {
    const s = neuerStand(1);
    s.geld = 1000;
    const vorher = techKosten(s, 'kraft');
    expect(techKaufen(s, 'kraft').ok).toBe(true);
    expect(s.geld).toBeCloseTo(1000 - vorher);
    expect(techKosten(s, 'kraft')).toBe(1.7);
    expect(stichMenge(werte(s), 'spaten')).toBe(GRUND.griff + 1);
    for (const t of TECH) {
      for (let n = 0; n < t.stufen; n++) {
        const ideal = t.kosten * Math.pow(t.faktor, n);
        const s2 = neuerStand(1);
        s2.tech[t.id] = n;
        const k = techKosten(s2, t.id);
        expect(k - ideal, `${t.id} Stufe ${n}`).toBeLessThan(ideal < 100 ? 0.1 + 1e-9 : 1);
        expect(k).toBeGreaterThanOrEqual(ideal - 1e-6);
      }
    }
  });

  it('verlangt die Voraussetzungen und endet bei der letzten Stufe', () => {
    const s = neuerStand(1);
    s.geld = 1e9;
    expect(techStatus(s, 'mulde')).toBe('gesperrt');
    expect(techKaufen(s, 'mulde').ok).toBe(false);
    for (let i = 0; i < 10; i++) techKaufen(s, 'kraft');
    expect(techStufe(s, 'kraft')).toBe(TECH_NACH_ID.kraft.stufen);
    expect(techStatus(s, 'kraft')).toBe('max');
    expect(techKaufen(s, 'gibtsnicht').ok).toBe(false);
  });

  it('legt Karten und Gruppen überschneidungsfrei nach Schritten vom Start', () => {
    const { lage, gruppen } = techLage(AESTE);
    const kaesten = [];
    for (const t of TECH) {
      const l = lage[t.id];
      expect(l, t.id).toBeDefined();
      if (!t.gruppe) expect(l.x).toBe(TECH_SCHRITTE[t.id]);
      for (const b of t.braucht) expect(lage[b].x, `${b} → ${t.id}`).toBeLessThan(l.x);
      kaesten.push({ id: t.id, x: l.x, y: l.y, h: l.h });
    }
    for (const g of gruppen) kaesten.push({ id: `Gruppe ${g.name}`, x: g.x, y: g.y, h: 0.36 });
    for (let i = 0; i < kaesten.length; i++) {
      for (let j = i + 1; j < kaesten.length; j++) {
        const a = kaesten[i];
        const b = kaesten[j];
        if (a.x !== b.x) continue;
        const ueber = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ueber, `${a.id} und ${b.id}`).toBeLessThan(0.01);
      }
    }
  });
});

describe('Nadeln', () => {
  it('findet eine Nadel sofort, wenn man sie mit der Hand erwischt, und merkt sich die Art', () => {
    const s = neuerStand(5);
    const e = [];
    abtragen(s, s.nadeln[0].tiefe, 'hand', e);
    const n = e.find((x) => x.typ === 'nadel');
    expect(n).toMatchObject({ i: 0, art: 0, nr: 1, alle: false, neu: true });
    expect(artenGefunden(s)).toBe(1);
    expect(werte(s).griff).toBeCloseTo(GRUND.griff * 1.01);
  });

  it('zählt bei mehreren Nadeln in einem Rutsch richtig hoch', () => {
    const s = neuerStand(5);
    const e = [];
    abtragen(s, s.haufen.gesamt, 'hand', e);
    const nr = e.filter((x) => x.typ === 'nadel').map((x) => x.nr);
    expect(nr).toEqual([1, 2, 3, 4, 5, 6]);
    expect(e.filter((x) => x.typ === 'nadel' && x.alle)).toHaveLength(1);
  });

  it('lässt ungescannte Nadeln zurück in den Haufen fallen, aber nicht bis ganz nach unten', () => {
    const s = neuerStand(5);
    const e = [];
    const alt = s.nadeln[0].tiefe;
    abtragen(s, alt, 'maschine', e, 0);
    expect(e.some((x) => x.typ === 'zurueck')).toBe(true);
    expect(nadelnGefunden(s)).toBe(0);
    expect(s.nadeln[0].tiefe).toBeGreaterThan(s.haufen.entfernt);
    expect(s.nadeln[0].tiefe).toBeLessThanOrEqual(s.haufen.entfernt + s.haufen.gesamt * NADEL_RUTSCH + 1);
  });

  it('findet am Ende jede Nadel, auch ohne Scanner', () => {
    const s = neuerStand(9);
    for (let i = 0; i < 1000 && !alleNadeln(s); i++) abtragen(s, s.haufen.gesamt / 200, 'maschine', [], 0);
    expect(alleNadeln(s)).toBe(true);
    expect(rest(s)).toBeLessThanOrEqual(1);
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
  });
});

describe('Halle', () => {
  const halle = () => {
    const s = neuerStand(11);
    freischalten(s, 'greifarm', 'kolbenrechen', 'elektrizitaet');
    s.geld = 1e9;
    return s;
  };

  it('kauft Greifarme, bis die Stellplätze voll sind, und baut wieder ab', () => {
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
  });

  it('rechnet Strom und Brennstoff im Gleichgewicht: die Generatoren liefern, was sie verbrennen', () => {
    const s = halle();
    freischalten(s, 'presse');
    s.tech.lange_halle = 8; s.tech.schuppen = 6; s.rev++;
    for (let i = 0; i < 5; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 15; i++) maschineKaufen(s, 'generator');
    for (let i = 0; i < 40; i++) maschineKaufen(s, 'presse');
    const f = fabrik(s);
    const w = werte(s);
    const erwartet = 5 + 15 * 15 * w.generatorMul * w.stromMul * Math.min(1, f.fluss / f.brennBedarf);
    expect(f.erzeugt).toBeCloseTo(erwartet, 3);
    expect(f.strom).toBeCloseTo(Math.min(1, f.erzeugt / f.bedarf), 6);
  });

  it('lässt nicht mehr durch, als das Band trägt', () => {
    const s = halle();
    for (let i = 0; i < 6; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 3; i++) maschineKaufen(s, 'generator');
    const f = fabrik(s);
    expect(f.strom).toBe(1);
    expect(f.foerderung).toBeGreaterThan(GRUND.band);
    expect(f.fluss).toBe(GRUND.band);
  });

  it('verdient mit Pressballen mehr als mit losem Heu', () => {
    const s = halle();
    freischalten(s, 'presse');
    for (let i = 0; i < 2; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 3; i++) maschineKaufen(s, 'generator');
    const ohne = fabrik(s).einnahmen;
    maschineKaufen(s, 'presse');
    const mit = fabrik(s);
    expect(mit.produkte.ballen).toBeGreaterThan(0);
    expect(mit.einnahmen).toBeGreaterThan(ohne);
    maschineUmschalten(s, 'presse');
    expect(fabrik(s).einnahmen).toBeCloseTo(ohne);
  });

  it('braucht Wasser für den Pulper', () => {
    const s = halle();
    freischalten(s, 'pulper');
    for (let i = 0; i < 3; i++) maschineKaufen(s, 'arm');
    for (let i = 0; i < 4; i++) maschineKaufen(s, 'generator');
    maschineKaufen(s, 'pulper');
    expect(fabrik(s).produkte.brei || 0).toBe(0);
    maschineKaufen(s, 'brunnen');
    expect(fabrik(s).produkte.brei).toBeGreaterThan(0);
  });

  it('zahlt pro Sekunde, was die Halle verspricht', () => {
    const s = halle();
    for (let i = 0; i < 2; i++) maschineKaufen(s, 'arm');
    s.geld = 0;
    const f = fabrik(s);
    tick(s, 10);
    expect(s.geld).toBeCloseTo(f.einnahmen * 10, 5);
  });

  it('lässt Drohnen nur bis zur Obergrenze kaufen', () => {
    const s = neuerStand(1);
    s.geld = 1e6;
    expect(drohneKaufen(s).grund).toBe('gesperrt');
    freischalten(s, 'drohne');
    for (let i = 0; i < 3; i++) expect(drohneKaufen(s).ok).toBe(true);
    expect(drohneKaufen(s).grund).toBe('voll');
    expect(drohnenKosten(s)).toBeGreaterThan(55);
  });
});

describe('Aufträge und Missionen', () => {
  it('beliefert den Laster zuerst und zahlt den Lohn', () => {
    const s = neuerStand(3);
    freischalten(s, 'auftraege', 'kolbenrechen');
    s.maschinen.rechen = 4;
    const au = auftrag(0);
    expect(au.will).toBe('roh');
    let bezahlt = null;
    for (let i = 0; i < 400 && !bezahlt; i++) bezahlt = tick(s, 1).find((e) => e.typ === 'auftrag');
    expect(bezahlt.lohn).toBeCloseTo(au.lohn);
    expect(s.auftrag.nr).toBe(1);
    expect(s.auftrag.pause).toBe(AUFTRAG_PAUSE);
  });

  it('lässt Aufträge ablehnen und erfindet nach der Liste neue', () => {
    const s = neuerStand(3);
    freischalten(s, 'auftraege');
    expect(auftragAblehnen(s)).toBe(true);
    expect(auftragAblehnen(s)).toBe(false); // Pause
    const spaet = auftrag(AUFTRAEGE.length + 3);
    expect(spaet.menge).toBeGreaterThan(0);
    expect(spaet.lohn).toBeGreaterThan(spaet.menge * PRODUKTE[spaet.will].wert);
  });

  it('arbeitet das Missionsbuch der Reihe nach ab und verschenkt Maschinen', () => {
    const s = neuerStand(3);
    expect(missionStand(s).m.text).toBe(MISSIONEN[0].text);
    stich(s);
    const e = tick(s, 0.1);
    expect(e.some((x) => x.typ === 'mission')).toBe(true);
    expect(s.mission).toBe(1);
    s.mission = MISSIONEN.findIndex((m) => m.geschenk === 'rechen');
    freischalten(s, 'foerderband');
    tick(s, 0.1);
    expect(s.maschinen.rechen).toBe(1);
  });
});

describe('Ladungen und Schulden', () => {
  const fertig = () => {
    const s = neuerStand(4);
    abtragen(s, s.haufen.gesamt * 0.995, 'hand');
    expect(alleNadeln(s)).toBe(true);
    return s;
  };

  it('bestellt die nächste Ladung erst, wenn alle Nadeln gefunden sind', () => {
    const s = neuerStand(4);
    s.geld = 1e9;
    expect(ladungBestellen(s).ok).toBe(false);
    const f = fertig();
    f.geld = ladungPreis(f);
    freischalten(f, 'greifarm');
    f.maschinen.arm = 3;
    expect(ladungBestellen(f).ok).toBe(true);
    expect(f.ladung).toBe(2);
    expect(f.haufen.gesamt).toBe(ladungGroesse(2));
    expect(f.nadeln.map((n) => n.art)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(f.maschinen.arm).toBe(3);
    expect(f.geld).toBe(0);
  });

  it('bestellt auf Rechnung auch ohne Geld und tilgt aus den Einnahmen', () => {
    const s = fertig();
    s.geld = 1000;
    expect(ladungBestellen(s).ok).toBe(false);
    expect(ladungBestellen(s, { aufRechnung: true }).ok).toBe(true);
    const schulden = s.schulden;
    expect(schulden).toBeCloseTo((ladungPreis({ ladung: 1 }) - 1000) * KREDIT_AUFSCHLAG);
    freischalten(s, 'foerderband');
    s.ausdauer = 1e9;
    for (let i = 0; i < 100; i++) stich(s);
    expect(s.schulden).toBeLessThan(schulden);
    expect(s.geld).toBeGreaterThan(0);
  });

  it('hat nach 24 Arten weiter gemischte Nadeln', () => {
    const s = neuerStand(4);
    for (let l = 1; l <= 5; l++) {
      abtragen(s, s.haufen.gesamt, 'hand');
      ladungBestellen(s, { aufRechnung: true });
    }
    expect(s.ladung).toBe(6);
    expect(new Set(s.nadeln.map((n) => n.art)).size).toBe(6);
    expect(artenGefunden(s)).toBe(24);
  });
});

describe('Speichern und Abwesenheit', () => {
  it('überlebt Speichern und Laden', () => {
    const s = neuerStand(3);
    s.geld = 123.5;
    freischalten(s, 'heugabel');
    werkzeugWaehlen(s, 'heugabel');
    for (let i = 0; i < 3; i++) stich(s);
    const zurueck = laden(speichern(s));
    expect(zurueck.geld).toBe(123.5);
    expect(zurueck.tasche).toBe(s.tasche);
    expect(zurueck.werkzeug).toBe('heugabel');
    expect(zurueck.nadeln).toEqual(s.nadeln);
    expect(stichMenge(werte(zurueck), 'heugabel')).toBe(stichMenge(werte(s), 'heugabel'));
  });

  it('weist kaputte Stände zurück und repariert Kleinigkeiten', () => {
    expect(laden('kein json')).toBeNull();
    expect(laden('{"version": 99}')).toBeNull();
    expect(laden('null')).toBeNull();
    const s = JSON.parse(speichern(neuerStand(3)));
    expect(laden(JSON.stringify({ ...s, haufen: null }))).toBeNull();
    expect(laden(JSON.stringify({ ...s, nadeln: [null, 1, 2, 3, 4, 5] }))).toBeNull();
    const repariert = laden(JSON.stringify({
      ...s, geld: '12', tech: [], stat: null, sauger: { an: true, hitze: 0.2 }, maschinen: { weg: 3, arm: 2 },
      arten: { 99: 1, 0: 1 }, werkzeug: 'hammer',
    }));
    expect(repariert.geld).toBe(0);
    expect(repariert.tech.scheune).toBe(1);
    expect(repariert.sauger.an).toBe(false);
    expect(repariert.maschinen).toEqual({ arm: 2 });
    expect(repariert.arten).toEqual({ 0: 1 });
    expect(repariert.werkzeug).toBe('spaten');
    expect(() => { werte(repariert); tick(repariert, 1); techStatus(repariert, 'kraft'); }).not.toThrow();
  });

  it('lässt den Laufweg bei kurzer Abwesenheit weiterlaufen statt ihn zu überspringen', () => {
    const s = neuerStand(3);
    s.tasche = 20;
    verkaufen(s);
    s.zuletzt = 1000;
    offlineNachholen(s, 1100);
    expect(s.laufen).toBeCloseTo(GRUND.laufzeit - 0.1);
    expect(s.geld).toBe(0);
    offlineNachholen(s, 10000);
    expect(s.laufen).toBe(0);
    expect(s.geld).toBeGreaterThan(0);
  });

  it('lässt die Halle während der Abwesenheit mit halber Kraft weiterlaufen, begrenzt auf die Nachtschicht', () => {
    const s = neuerStand(3);
    freischalten(s, 'kolbenrechen');
    s.maschinen.rechen = 2;
    s.geld = 0;
    const f = fabrik(s);
    s.zuletzt = 0;
    const bericht = offlineNachholen(s, 3600 * 1000);
    expect(bericht.sekunden).toBe(3600);
    expect(bericht.geld).toBeCloseTo(f.einnahmen * 3600 * GRUND.offlineEff, 3);
    s.zuletzt = 0;
    expect(offlineNachholen(s, 48 * 3600 * 1000).sekunden).toBe(GRUND.offlineStunden * 3600);
  });

  it('zählt keine Zeit, wenn die Uhr zurückgestellt wurde, und erzählt nichts, wenn nichts läuft', () => {
    const s = neuerStand(3);
    s.zuletzt = 5000;
    expect(offlineNachholen(s, 1000)).toBeNull();
    s.zuletzt = 0;
    expect(offlineNachholen(s, 3600 * 1000)).toBeNull();
  });

  it('bleibt bei unsinnigen Zeitschritten stabil', () => {
    const s = neuerStand(3);
    for (const dt of [0, -1, NaN, Infinity]) tick(s, dt);
    expect(s.zeit).toBe(0);
    tick(s, 1e7);
    expect(Number.isFinite(s.geld)).toBe(true);
  });
});

describe('Zahlen', () => {
  it('schreibt deutsch, kürzt große Zahlen und bricht nicht zwischen Zahl und Einheit um', () => {
    expect(zahl(1234567)).toBe('1,23 Mio.');
    expect(zahl(9.999e6)).toBe('10,0 Mio.');
    expect(zahl(999.9e6)).toBe('1,00 Mrd.');
    expect(zahl(-0.4)).toBe('0');
    expect(zahl(1e300).length).toBeLessThan(14);
    expect(geld(2.5)).toBe('2,50 $');
    expect(geld(-0)).toBe('0,00 $');
    expect(dauer(NaN)).toBe('0 s');
    expect(prozent(NaN)).toBe('0 %');
    expect(halme(5999999.7)).toBe('5.999.999');
  });
});
