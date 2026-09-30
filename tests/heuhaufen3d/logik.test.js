import { describe, it, expect } from 'vitest';
import { TECH, BAUTEN, MISSIONEN, NADELN, WERKZEUGE, GRUND } from '../../heuhaufen3d/src/daten.js';
import {
  haufenNeu, haufenRest, haufenAbtragen, haufenSetzen, haufenHoehe, haufenStrahl, haufenPacken, haufenEntpacken, haufenGipfel,
} from '../../heuhaufen3d/src/haufen.js';
import {
  werte, techKaufen, techStufe, techStatus, TECH_STUFEN_GESAMT, techLage, missionStand, einnahme, auftrag, auftragLohn,
  bauKosten, TECH_NACH_ID, produktPreis, preisRoh,
} from '../../heuhaufen3d/src/wirtschaft.js';
import { AESTE } from '../../heuhaufen3d/src/daten.js';
import { standNeu, spielTakt, speichern, laden, ladungBestellen } from '../../heuhaufen3d/src/spiel.js';
import { stechen, standKippen, fegen, werkzeugWaehlen, werkzeugBesitz, platzFrei, saugerSchritt, pusteSchritt } from '../../heuhaufen3d/src/werkzeuge.js';
import { nadelnFreilegen, detektorMessen, nadelFinden, nadelZurueck } from '../../heuhaufen3d/src/nadeln.js';
import { loseAblegen, loseEinsammeln, loseSumme, LOSE_MAX } from '../../heuhaufen3d/src/lose.js';
import { zufallNeu } from '../../heuhaufen3d/src/zufall.js';

const reich = (s, geld = 1e9) => { s.geld = geld; return s; };

describe('Daten', () => {
  it('hat wie das Vorbild 351 Forschungsstufen in zehn Ästen (Hofbau 17, Heulinien 17, Strom 23, Verarbeitung 101)', () => {
    expect(TECH_STUFEN_GESAMT).toBe(351);
    const ast = (a) => TECH.filter((t) => t.ast === a).reduce((n, t) => n + t.stufen, 0);
    expect([ast('hofbau'), ast('linien'), ast('strom'), ast('verarbeitung')]).toEqual([17, 17, 23, 101]);
    expect(new Set(TECH.filter((t) => t.ast).map((t) => t.ast)).size).toBe(10);
    for (const t of TECH) for (const b of t.braucht) expect(TECH_NACH_ID[b], `${t.id} braucht ${b}`).toBeDefined();
  });
  it('hat für jeden Bau und jedes Werkzeug eine Forschung, die ihn freischaltet', () => {
    const frei = new Set(TECH.flatMap((t) => t.effekt.filter((e) => e[0] === 'frei').map((e) => e[1])));
    for (const b of BAUTEN) if (b.frei) expect(frei.has(b.frei), b.id).toBe(true);
    for (const w of WERKZEUGE) if (w.frei) expect(frei.has(w.frei), w.id).toBe(true);
  });
  it('Missionen verweisen nur auf Dinge, die es gibt', () => {
    const bauIds = new Set(BAUTEN.map((b) => b.id));
    for (const m of MISSIONEN) {
      if (m.art === 'tech') expect(TECH_NACH_ID[m.ziel], m.text).toBeDefined();
      if (m.art === 'gebaut') expect(bauIds.has(m.ziel[0]), m.text).toBe(true);
      if (m.geschenk) expect(bauIds.has(m.geschenk), m.text).toBe(true);
      if (m.geschenkTech) expect(TECH_NACH_ID[m.geschenkTech], m.text).toBeDefined();
    }
  });
  it('legt den Baum überschneidungsfrei aus', () => {
    const { lage } = techLage(AESTE);
    for (const t of TECH) expect(lage[t.id], t.id).toBeDefined();
  });
});

describe('Haufen', () => {
  const z = zufallNeu(3);
  it('zählt genau so viele Halme, wie die Ladung hat', () => {
    const hf = haufenNeu({ halme: 6e6, radius: 7.2, hoehe: 5.2, zufall: z });
    expect(haufenRest(hf)).toBeCloseTo(6e6, -2);
  });
  it('nimmt ab, was es gibt, und rutscht am Rand nach', () => {
    const hf = haufenNeu({ halme: 6e6, radius: 7.2, hoehe: 5.2, zufall: z });
    const innen = haufenHoehe(hf, 4.2, 0);
    let weg = 0;
    for (let i = 0; i < 3000; i++) { weg += haufenAbtragen(hf, 5.8, 0, 300, 0.8); haufenSetzen(hf, 3); }
    expect(weg).toBeGreaterThan(150000);
    expect(haufenRest(hf)).toBeCloseTo(6e6 - weg, -3);
    // Das Loch am Rand ist nachgerutscht: weiter innen ist der Haufen niedriger geworden.
    expect(haufenHoehe(hf, 4.2, 0)).toBeLessThan(innen - 0.2);
    expect(haufenGipfel(hf)).toBeGreaterThan(4);
  });
  it('trifft mit dem Blickstrahl die Oberfläche und nicht den Boden', () => {
    const hf = haufenNeu({ halme: 6e6, radius: 7.2, hoehe: 5.2, zufall: z });
    const t = haufenStrahl(hf, -10, 1.6, 0, 1, -0.05, 0, 20);
    expect(t).not.toBeNull();
    expect(t.y).toBeGreaterThan(0.1);
    expect(haufenStrahl(hf, -10, 1.6, 0, -1, -0.2, 0, 20)).toBeNull();
  });
  it('überlebt Packen und Entpacken fast verlustfrei', () => {
    const hf = haufenNeu({ halme: 6e6, radius: 7.2, hoehe: 5.2, zufall: z });
    const q = haufenEntpacken(haufenPacken(hf));
    expect(haufenRest(q)).toBeCloseTo(haufenRest(hf), -3);
    expect(haufenEntpacken({ n: 5, h: 'kaputt' })).toBeNull();
  });
});

describe('Werkzeuge und Verkauf', () => {
  it('sticht Heu in die Arme, verschüttet etwas und verkauft am Stand', () => {
    const s = standNeu(5);
    const hf = s.hf;
    const t = haufenStrahl(hf, s.spieler.x, 1.6, s.spieler.z, ...(() => { const dx = hf.mitteX - s.spieler.x; const dz = hf.mitteZ - s.spieler.z; const l = Math.hypot(dx, dz); return [dx / l, -0.05, dz / l]; })(), 30);
    expect(t).not.toBeNull();
    const e = [];
    const r = stechen(s, hf, t, zufallNeu(1), e);
    expect(r.menge).toBe(Math.round(GRUND.griff * GRUND.hand * (1 - 0) ));
    expect(s.spieler.last).toBe(r.menge);
    expect(loseSumme(s)).toBeGreaterThanOrEqual(0);
    expect(s.stat.tipps).toBe(1);
    const betrag = standKippen(s, e);
    expect(betrag).toBeCloseTo(r.menge * 0.0222, 6);
    expect(s.spieler.last).toBe(0);
    expect(s.stat.verkauft).toBe(r.menge);
  });
  it('füllt die Arme nicht über 30 Halme, der Eimer fasst gut 100', () => {
    const s = standNeu(5);
    s.spieler.last = 30;
    expect(platzFrei(s)).toBe(0);
    reich(s);
    techKaufen(s, 'eimer');
    expect(platzFrei(s)).toBe(72);
  });
  it('kostet mit dem Spaten Puste, mit der Kinderschaufel nicht', () => {
    const s = reich(standNeu(5));
    techKaufen(s, 'spaten');
    expect(werkzeugBesitz(s, 'spaten')).toBe(true);
    const t = { x: s.hf.mitteX - 3, y: 2, z: s.hf.mitteZ };
    werkzeugWaehlen(s, 'spaten');
    const p = s.spieler.puste;
    stechen(s, s.hf, t, zufallNeu(1), []);
    expect(s.spieler.puste).toBe(p - 1);
    werkzeugWaehlen(s, 'sandschaufel');
    s.spieler.last = 0;
    stechen(s, s.hf, t, zufallNeu(1), []);
    expect(s.spieler.puste).toBe(p - 1);
  });
  it('fegt lose Halme mit dem Besen zurück', () => {
    const s = reich(standNeu(5));
    techKaufen(s, 'besen');
    loseAblegen(s, null, -10, 3, 40, zufallNeu(2), { rollen: false, streuen: 0 });
    const r = fegen(s, -10, 3, []);
    expect(r.menge).toBe(30); // Arme voll
    expect(s.stat.gefegt).toBe(30);
  });
  it('hält die Zahl der Büschel klein', () => {
    const s = standNeu(5);
    const z = zufallNeu(4);
    for (let i = 0; i < 2000; i++) loseAblegen(s, null, (z() - 0.5) * 30, (z() - 0.5) * 24, 3, z, { rollen: false });
    expect(s.lose.length).toBeLessThanOrEqual(LOSE_MAX);
    expect(loseSumme(s)).toBeCloseTo(6000, 0);
    expect(loseEinsammeln(s, 0, 0, 100, 10000)).toBeCloseTo(6000, 0);
  });
  it('lässt den Sauger heiß laufen und abkühlen', () => {
    const s = reich(standNeu(5));
    techKaufen(s, 'spaten'); techKaufen(s, 'heugabel'); techKaufen(s, 'sauger'); techKaufen(s, 'eimer');
    werkzeugWaehlen(s, 'sauger');
    const t = { x: s.hf.mitteX - 3, y: 2, z: s.hf.mitteZ };
    const e = [];
    let gesaugt = 0;
    for (let i = 0; i < 70; i++) { saugerSchritt(s, s.hf, 0.1, true, t, null, zufallNeu(1), e); gesaugt += s.spieler.last; s.spieler.last = 0; }
    expect(e.some((x) => x.typ === 'ueberhitzt')).toBe(true);
    expect(gesaugt).toBeGreaterThan(200);
    for (let i = 0; i < 60; i++) saugerSchritt(s, s.hf, 0.1, false, t, null, zufallNeu(1), e);
    expect(s.spieler.sauger.heiss).toBe(false);
  });
  it('Rennen kostet Puste, Ruhe bringt sie zurück', () => {
    const s = standNeu(5);
    pusteSchritt(s, 2, true);
    expect(s.spieler.puste).toBeLessThan(GRUND.ausdauer);
    pusteSchritt(s, 20, false);
    pusteSchritt(s, 20, false);
    expect(s.spieler.puste).toBe(GRUND.ausdauer);
  });
});

describe('Nadeln', () => {
  it('versteckt sechs Nadeln im Haufen, die erste flach und erreichbar', () => {
    const s = standNeu(9);
    expect(s.nadeln).toHaveLength(6);
    const erste = s.nadeln[0];
    expect(erste.y).toBeLessThanOrEqual(1.5);
    expect(haufenHoehe(s.hf, erste.x, erste.z)).toBeGreaterThan(erste.y);
    for (const n of s.nadeln) expect(n.zustand).toBe('versteckt');
  });
  it('springt heraus, wenn man darüber gräbt, und der Detektor findet sie vorher', () => {
    const s = standNeu(9);
    const n = s.nadeln[0];
    const d = detektorMessen(s, n.x, n.y + 0.8, n.z);
    expect(d.staerke).toBeGreaterThan(0.5);
    const e = [];
    for (let i = 0; i < 4000 && n.zustand === 'versteckt'; i++) {
      haufenAbtragen(s.hf, n.x, n.z, 60, 0.5);
      nadelnFreilegen(s, s.hf, { art: 'spieler', x: n.x, z: n.z, radius: 0.5, werkzeug: 'spaten' }, e);
    }
    expect(n.zustand).toBe('lose');
    expect(e.some((x) => x.typ === 'nadelFrei')).toBe(true);
    nadelFinden(s, n, e);
    expect(s.nadelnGesamt).toBe(1);
    expect(s.arten[n.art]).toBe(1);
    expect(e.some((x) => x.typ === 'nadel')).toBe(true);
  });
  it('geht mit dem Heu einer Maschine aufs Band und fällt beim Verkauf zurück', () => {
    const s = standNeu(9);
    const n = s.nadeln[1];
    let mit = [];
    for (let i = 0; i < 20000 && !mit.length; i++) {
      haufenAbtragen(s.hf, n.x, n.z, 200, 0.6);
      mit = nadelnFreilegen(s, s.hf, { art: 'maschine', x: n.x, z: n.z, radius: 0.6 }, []);
    }
    expect(mit).toContain(n);
    expect(n.zustand).toBe('unterwegs');
    nadelZurueck(s, s.hf, n, zufallNeu(3), []);
    expect(n.zustand).toBe('versteckt');
  });
});

describe('Wirtschaft', () => {
  it('tilgt Schulden aus jeder Einnahme zur Hälfte', () => {
    const s = standNeu(1);
    s.schulden = 100;
    expect(einnahme(s, 50)).toBe(25);
    expect(s.schulden).toBe(75);
  });
  it('rechnet Missionen der Reihe nach ab, auch die Anleitung', () => {
    const s = standNeu(1);
    expect(missionStand(s).m.art).toBe('umgesehen');
    s.stat.umgesehen = 3; s.stat.gelaufen = 10; s.stat.tipps = 5;
    const e = spielTakt(s, 0.1);
    expect(e.filter((x) => x.typ === 'mission')).toHaveLength(3);
    expect(missionStand(s).m.art).toBe('verkauft');
  });
  it('schenkt beim Förderband den Rechen samt Plänen', () => {
    const s = reich(standNeu(1));
    s.mission = MISSIONEN.findIndex((m) => m.art === 'tech' && m.ziel === 'foerderband');
    techKaufen(s, 'foerderband');
    const e = spielTakt(s, 0.1);
    expect(s.geschenke.rechen).toBe(1);
    expect(techStufe(s, 'kolbenrechen')).toBe(1);
    expect(e.some((x) => x.typ === 'mission' && /rechen/i.test(x.belohnung))).toBe(true);
  });
  it('Aufträge zahlen mehr als der Stand', () => {
    const s = standNeu(1);
    const w = werte(s);
    for (let nr = 0; nr < 20; nr++) {
      const a = auftrag(nr);
      const stand = a.will === 'roh' ? a.menge * preisRoh(w) : a.menge * produktPreis(w, a.will);
      expect(auftragLohn(s, a), `Auftrag ${nr}`).toBeGreaterThan(stand);
    }
  });
  it('Bauten werden mit jedem Stück teurer, Bänder kosten je Meter', () => {
    const s = standNeu(1);
    expect(bauKosten(s, 'band', 10)).toBeCloseTo(30, 5);
    const eins = bauKosten(s, 'rechen');
    s.bauten.push({ id: 1, typ: 'rechen', x: 0, z: 0 });
    expect(bauKosten(s, 'rechen')).toBeGreaterThan(eins);
  });
});

describe('Spielstand', () => {
  it('speichert und lädt samt Haufen, Nadeln und Werkzeug', () => {
    const s = reich(standNeu(12));
    techKaufen(s, 'spaten');
    s.spieler.werkzeug = 'spaten';
    haufenAbtragen(s.hf, s.hf.mitteX - 4, s.hf.mitteZ, 5000, 1);
    const t = speichern(s);
    const g = laden(t);
    expect(g).not.toBeNull();
    expect(g.spieler.werkzeug).toBe('spaten');
    expect(g.nadeln).toHaveLength(6);
    expect(haufenRest(g.hf)).toBeCloseTo(haufenRest(s.hf), -3);
    expect(laden('{}')).toBeNull();
    expect(laden('kaputt')).toBeNull();
  });
  it('bestellt nach sechs Nadeln eine größere Ladung', () => {
    const s = reich(standNeu(12));
    for (const n of s.nadeln) nadelFinden(s, n, []);
    const vorher = s.haufenStart;
    expect(ladungBestellen(s).ok).toBe(true);
    expect(s.ladung).toBe(2);
    expect(s.haufenStart).toBeGreaterThan(vorher);
    expect(s.nadeln.every((n) => n.zustand === 'versteckt')).toBe(true);
  });
});

describe('Ducken', () => {
  it('senkt den Blick um 0,63 m, macht langsamer und passt unter eine Plattform', async () => {
    const { spielerNeu, spielerBewegen, augenHoehe } = await import('../../heuhaufen3d/src/spieler.js');
    const sp = { ...spielerNeu(), x: 0, z: 0, y: 0, gier: 0 };
    // Plattformkante: Unterseite 1,15 m, direkt vor dem Spieler (Blick nach -z)
    const umgebung = { kollider: [{ x0: -2, x1: 2, z0: -12, z1: -1, h: 1.5, unten: 1.15 }], flaechen: [], haufen: null };
    for (let i = 0; i < 60; i++) spielerBewegen(sp, { vor: 1, seit: 0, blickX: 0, blickY: 0 }, 1 / 30, umgebung);
    expect(sp.z).toBeGreaterThan(-0.75); // stehend kommt man nicht drunter
    for (let i = 0; i < 90; i++) spielerBewegen(sp, { vor: 1, seit: 0, blickX: 0, blickY: 0, ducken: true }, 1 / 30, umgebung);
    expect(sp.duck).toBe(1);
    expect(augenHoehe(sp)).toBeCloseTo(1.03, 2);
    expect(sp.z).toBeLessThan(-1.5); // geduckt drunter durch
    // Loslassen unter der Plattform: man bleibt unten
    spielerBewegen(sp, { vor: 0, seit: 0, blickX: 0, blickY: 0, ducken: false }, 1 / 30, umgebung);
    expect(sp.duck).toBeGreaterThan(0.9);
    // geduckt halb so schnell
    const a = { ...spielerNeu(), x: 0, z: 10, y: 0, gier: 0, duck: 1 };
    const b = { ...spielerNeu(), x: 0, z: 10, y: 0, gier: 0 };
    const leer = { kollider: [], flaechen: [], haufen: null };
    for (let i = 0; i < 30; i++) {
      spielerBewegen(a, { vor: 1, seit: 0, blickX: 0, blickY: 0, ducken: true }, 1 / 30, leer);
      spielerBewegen(b, { vor: 1, seit: 0, blickX: 0, blickY: 0 }, 1 / 30, leer);
    }
    expect((10 - a.z) / (10 - b.z)).toBeCloseTo(0.5, 1);
  });
});

describe('Zyklus 2: Spielfigur', () => {
  it('steigt ohne Sprung über ein Band und läuft auch schnell nicht durch eine dünne Wand', async () => {
    const { spielerNeu, spielerBewegen } = await import('../../heuhaufen3d/src/spieler.js');
    const band = { x0: -2, x1: 2, z0: -1.3, z1: -0.7, h: 0.61 };
    const umgebung = { kollider: [band], flaechen: [{ ...band }], haufen: null };
    const sp = { ...spielerNeu(), x: 0, z: 0.5, y: 0, gier: 0 };
    for (const fps of [60, 20]) {
      Object.assign(sp, { x: 0, z: 0.5, y: 0, vx: 0, vz: 0, amBoden: true });
      for (let i = 0; i < fps * 1.5; i++) spielerBewegen(sp, { vor: 1, seit: 0, blickX: 0, blickY: 0 }, 1 / fps, umgebung);
      expect(sp.z, `bei ${fps} fps`).toBeLessThan(-2);
    }
    const wand = { x0: -3, x1: 3, z0: -1.05, z1: -0.95, h: 2.5 };
    const u2 = { kollider: [wand], flaechen: [], haufen: null };
    const sp2 = { ...spielerNeu(), x: 0, z: 0.5, y: 0, gier: 0 };
    for (let i = 0; i < 40; i++) spielerBewegen(sp2, { vor: 1, seit: 0, blickX: 0, blickY: 0, rennen: true }, 1 / 12, u2, 3);
    expect(sp2.z).toBeGreaterThan(-0.95);
  });
});
