import { describe, it, expect } from 'vitest';
import { WELT, BAUTEN } from '../../heuhaufen3d/src/daten.js';
import { haufenHoehe } from '../../heuhaufen3d/src/haufen.js';
import { werte, auftrag } from '../../heuhaufen3d/src/wirtschaft.js';
import { standNeu, spielTakt, speichern, laden, abwesenheit } from '../../heuhaufen3d/src/spiel.js';
import { STAND_TRICHTER, lauf } from '../../heuhaufen3d/src/welt.js';
import { gegenstandNeu, nadelMitgeben, gegenstandNehmen, heuWerfen } from '../../heuhaufen3d/src/gegenstaende.js';
import { bandEinlegen, bandLaenge, bandWeg, bandPunkt } from '../../heuhaufen3d/src/baender.js';
import { bauPruefen, bauSetzen, bandAnker, bandPlanen, bandSetzen, bauAbbauen, bautenUmgebung } from '../../heuhaufen3d/src/bauen.js';
import { annehmen, scannerLeeren, MASCHINE } from '../../heuhaufen3d/src/maschinen.js';
import { netzHolen, automatikSchritt } from '../../heuhaufen3d/src/automatik.js';
import { netzSchalten, netzVon } from '../../heuhaufen3d/src/versorgung.js';
import { lasterAnnehmen } from '../../heuhaufen3d/src/laster.js';
import { loseAblegen, loseSumme } from '../../heuhaufen3d/src/lose.js';

const ALLES = ['foerderband', 'kolbenrechen', 'elektrizitaet', 'strommast', 'weiche', 'silo', 'greifarm', 'drohne', 'auftraege', 'piepser', 'scanner', 'feilschen'];
function hof(seed = 11) {
  const s = standNeu(seed);
  s.geld = 1e7;
  for (const t of ALLES) s.tech[t] = 1;
  s.rev++;
  return s;
}
const laufen = (s, sekunden, dt = 1 / 30) => {
  const ev = [];
  for (let t = 0; t < sekunden; t += dt) ev.push(...spielTakt(s, dt, [automatikSchritt]));
  return ev;
};
function band(s, von, nach, opt = {}) {
  const a = bandAnker(s, von[0], von[1], false, opt);
  const b = bandAnker(s, nach[0], nach[1], true, opt);
  const plan = bandPlanen(s, a, b);
  expect(plan.ok, `Band ${von} → ${nach}: ${plan.grund}`).toBe(true);
  return bandSetzen(s, plan).bau;
}
/** Rechenplatz am Westrand des Haufens: Kamm im Heu, Körper nicht zu hoch. */
function rechenPlatz(s) {
  for (let x = WELT.haufenX - 9; x < WELT.haufenX; x += 0.25) {
    if (haufenHoehe(s.hf, x + 0.95, WELT.haufenZ) > 0.4 && bauPruefen(s, 'rechen', x, WELT.haufenZ, 0).ok) return x;
  }
  throw new Error('kein Platz für den Rechen');
}

describe('Bänder', () => {
  it('finden einen Weg um den Haufen herum zum Stand', () => {
    const s = hof();
    const von = bandAnker(s, WELT.haufenX, WELT.haufenZ + 9, false);
    const nach = bandAnker(s, STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z, true);
    expect(nach.art).toBe('stand');
    const weg = bandWeg(s, von, nach);
    expect(weg.fehler).toBeUndefined();
    expect(weg.laenge).toBeGreaterThan(15);
    expect(weg.laenge).toBeLessThan(45);
    // nirgends durch den Haufen
    for (let i = 1; i < weg.punkte.length; i++) {
      const [ax, , az] = weg.punkte[i - 1];
      const [bx, , bz] = weg.punkte[i];
      for (let t = 0; t <= 1; t += 0.1) expect(haufenHoehe(s.hf, ax + (bx - ax) * t, az + (bz - az) * t)).toBeLessThan(0.3);
    }
  });

  it('tragen Stücke zum Stand und verkaufen sie dort', () => {
    const s = hof();
    const b = band(s, [-8, -9], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    expect(lauf(b).ziel).toBeUndefined(); // Ziel entsteht erst mit dem Netz
    netzHolen(s);
    expect(lauf(b).ziel.art).toBe('stand');
    const geldVor = s.geld;
    for (let i = 0; i < 4; i++) bandEinlegen(b, gegenstandNeu(s, 'roh', 50, 0, 0, 0), i * 0.6);
    const ev = laufen(s, bandLaenge(b) / werte(s).band + 3);
    expect(s.gegenstaende.length).toBe(0);
    expect(s.geld).toBeGreaterThan(geldVor);
    expect(s.stat.verkauft).toBe(200);
    expect(ev.filter((e) => e.typ === 'verkauft' && e.wo === 'band').length).toBe(4);
  });

  it('lassen fallen, was am Ende niemand annimmt, und fangen, was auf sie fällt', () => {
    const s = hof();
    const b = band(s, [-10, -10], [-4, -10]);
    netzHolen(s);
    expect(lauf(b).ziel).toBeNull();
    const g = gegenstandNeu(s, 'roh', 20, -9, 3, -10, { ort: 'flug', vx: 0, vy: 0, vz: 0, flug: 0 });
    laufen(s, 1);
    expect(g.ort).toBe('band');
    laufen(s, 10);
    expect(g.ort).toBe('boden');
    expect(g.x).toBeGreaterThan(-4.2);
    expect(g.y).toBeLessThan(0.05);
  });

  it('halten Abstand und stauen sich vor einem vollen Ziel', () => {
    const s = hof();
    const b = band(s, [-12, 10], [-6, 10]);
    const silo = bauSetzen(s, 'silo', -5.1, 10, 0);
    expect(silo.ok).toBe(true);
    // Band neu ans Silo legen
    bauAbbauen(s, b);
    const b2 = band(s, [-12, 10], [-6, 10]);
    netzHolen(s);
    expect(lauf(b2).ziel.art).toBe('bau');
    silo.bau.aus = true;
    silo.bau.lager.halme = 999; // voll
    for (let i = 0; i < 8; i++) bandEinlegen(b2, gegenstandNeu(s, 'roh', 20, 0, 0, 0), i * 0.5);
    laufen(s, 12);
    const ts = s.gegenstaende.filter((g) => g.ort === 'band').map((g) => g.t).sort((x, y) => y - x);
    expect(ts.length).toBe(8);
    for (let i = 1; i < ts.length; i++) expect(ts[i - 1] - ts[i]).toBeGreaterThan(0.45);
  });
});

describe('Kolbenrechen und Strom', () => {
  it('ohne Strom steht der Rechen, am Netz wirft er Heu aufs Band zum Stand', () => {
    const s = hof();
    const x = rechenPlatz(s);
    const r = bauSetzen(s, 'rechen', x, WELT.haufenZ, 0);
    expect(r.ok).toBe(true);
    const landung = x - 0.5 - r.bau.weite;
    band(s, [landung, WELT.haufenZ], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    laufen(s, 6);
    expect(s.stat.maschine).toBe(0);
    expect(lauf(r.bau).status).toBe('strom');
    // zwei Masten vom Hausanschluss zum Rechen
    expect(bauSetzen(s, 'mast', -11, 4, 0).ok).toBe(true);
    expect(bauSetzen(s, 'mast', x - 1, 3.4, 0).ok).toBe(true);
    const netz = netzHolen(s);
    expect(lauf(r.bau).netz).toBeGreaterThanOrEqual(0);
    expect(netzVon(netz, r.bau).haus).toBe(true);
    const geldVor = s.geld;
    laufen(s, 60);
    expect(s.stat.rechenMitStrom).toBe(1);
    expect(s.stat.maschine).toBeGreaterThan(300);
    expect(s.stat.verkauft).toBeGreaterThan(200);
    expect(s.geld).toBeGreaterThan(geldVor);
    // fast nichts daneben geworfen
    expect(s.gegenstaende.filter((g) => g.ort === 'boden').length).toBeLessThan(3);
  });

  it('Masten verbinden sich nur in Spannweite; Tippen schaltet das ganze Netz', () => {
    const s = hof();
    const m1 = bauSetzen(s, 'mast', -11, 4, 0).bau;
    const m2 = bauSetzen(s, 'mast', -2, 12, 0).bau; // zu weit weg
    const silo = bauSetzen(s, 'silo', -11, 6, 0).bau;
    let netz = netzHolen(s);
    expect(netzVon(netz, m1).haus).toBe(true);
    expect(netzVon(netz, m2).haus).toBe(false);
    expect(netzVon(netz, silo)).toBe(netzVon(netz, m1));
    laufen(s, 0.1);
    expect(lauf(silo).strom).toBe(1);
    expect(netzSchalten(s, netz, m1)).toBe(false);
    laufen(s, 0.1);
    expect(lauf(silo).strom).toBe(0);
    netzSchalten(s, netz, m1);
    laufen(s, 0.1);
    expect(lauf(silo).strom).toBe(1);
    // längere Spannweite erforscht: jetzt reicht es
    s.tech.spannweite = 5;
    s.rev++;
    netz = netzHolen(s);
    expect(werte(s).spannweite).toBeGreaterThan(12);
  });

  it('der Generator verbrennt Heu und speist ins Netz', () => {
    const s = hof();
    const m = bauSetzen(s, 'mast', -11, 4, 0).bau;
    const gen = bauSetzen(s, 'generator', -11, 6.2, 0).bau;
    const netz = netzHolen(s);
    expect(annehmen(s, netz, gen, gegenstandNeu(s, 'roh', 60, 0, 0, 0))).toBe(true);
    laufen(s, 1);
    expect(netzVon(netz, m).angebot).toBeCloseTo(5 + 15, 5);
    expect(gen.brenn).toBeLessThan(60);
    laufen(s, 40);
    expect(gen.brenn).toBe(0);
    expect(netzVon(netz, m).angebot).toBe(5);
    // nicht brennbar
    expect(annehmen(s, netz, gen, gegenstandNeu(s, 'brei', 0, 0, 0, 0))).toBe(false);
  });
});

describe('Suche und Verarbeitung', () => {
  it('der Scanner hält eine Nadel fest, der Rest fährt weiter zum Stand', () => {
    const s = hof();
    bauSetzen(s, 'mast', -12, -1, 0);
    const sc = bauSetzen(s, 'scanner', -10, -4, 0).bau;
    const b1 = band(s, [-14.5, -4], [-10.7, -4]);
    band(s, [-9.3, -4], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    const netz = netzHolen(s);
    expect(lauf(b1).ziel.art).toBe('bau');
    expect(lauf(sc).aus[0].art).toBe('band');
    const n = s.nadeln[0];
    const g = gegenstandNeu(s, 'roh', 30, 0, 0, 0);
    nadelMitgeben(s, g, n);
    bandEinlegen(b1, g, 0);
    laufen(s, 25);
    expect(n.zustand).toBe('scanner');
    expect(sc.nadeln).toEqual([n.nr]);
    expect(s.stat.verkauft).toBe(30);
    const ev = [];
    expect(scannerLeeren(s, sc, ev)).toBe(1);
    expect(n.zustand).toBe('gefunden');
    expect(ev.some((e) => e.typ === 'nadel')).toBe(true);
    expect(netz.leitungen.length).toBeGreaterThan(0);
  });

  it('das Silo presst Heu zu Knäueln und packt eine Nadel mit ein', () => {
    const s = hof();
    const silo = bauSetzen(s, 'silo', -15.3, 4.6, 0).bau;
    const netz = netzHolen(s);
    const mitNadel = gegenstandNeu(s, 'roh', 20, 0, 0, 0);
    nadelMitgeben(s, mitNadel, s.nadeln[1]);
    expect(annehmen(s, netz, silo, mitNadel)).toBe(true);
    expect(annehmen(s, netz, silo, gegenstandNeu(s, 'roh', 40, 0, 0, 0))).toBe(true);
    expect(s.nadeln[1].zustand).toBe('maschine');
    laufen(s, 5);
    const knaeuel = s.gegenstaende.filter((g) => g.art === 'knaeuel');
    expect(knaeuel.length).toBe(3);
    expect(s.stat.produziert.knaeuel).toBe(3);
    expect(knaeuel.filter((g) => g.nadel === 1).length).toBe(1);
    expect(s.nadeln[1].zustand).toBe('unterwegs');
    // Wer das Knäuel aufhebt, findet die Nadel
    const ev = [];
    const k = knaeuel.find((g) => g.nadel === 1);
    k.ort = 'boden';
    expect(gegenstandNehmen(s, k, ev).ok).toBe(true);
    expect(s.nadeln[1].zustand).toBe('gefunden');
  });

  it('die Weiche verteilt abwechselnd auf beide Ausgänge', () => {
    const s = hof();
    const w = bauSetzen(s, 'weiche', -8, 9, 0).bau;
    const ein = band(s, [-13, 9], [-8.6, 9]);
    const links = band(s, [-7.4, 8.65], [-2.5, 11.5]);
    const rechts = band(s, [-7.4, 9.35], [-2.5, 7]);
    netzHolen(s);
    expect(lauf(w).aus.map((a) => a && a.band)).toEqual([links, rechts]);
    for (let i = 0; i < 6; i++) bandEinlegen(ein, gegenstandNeu(s, 'roh', 10, 0, 0, 0), i * 0.5);
    let aufLinks = 0;
    let aufRechts = 0;
    for (let t = 0; t < 14; t += 1 / 30) {
      spielTakt(s, 1 / 30, [automatikSchritt]);
      for (const g of s.gegenstaende) {
        if (g.ort === 'band' && g.band === links.id && !g.gezaehlt) { g.gezaehlt = true; aufLinks++; }
        if (g.ort === 'band' && g.band === rechts.id && !g.gezaehlt) { g.gezaehlt = true; aufRechts++; }
      }
    }
    expect(aufLinks).toBe(3);
    expect(aufRechts).toBe(3);
  });
});

describe('Arm, Drohnen, Laster', () => {
  it('der Greifarm hebt Heu vom Haufen aufs Band vor ihm', () => {
    const s = hof();
    // Arm am Nordrand des Haufens, Blick nach Norden (weg vom Haufen), Band davor
    let z = WELT.haufenZ + 8;
    while (z > WELT.haufenZ && !(haufenHoehe(s.hf, WELT.haufenX, z - 1.3) > 0.5 && bauPruefen(s, 'arm', WELT.haufenX, z, -Math.PI / 2).ok)) z -= 0.25;
    const arm = bauSetzen(s, 'arm', WELT.haufenX, z, -Math.PI / 2);
    expect(arm.ok).toBe(true);
    for (const [mx, mz] of [[-11.5, 5.5], [-5.5, 8.5], [0.5, 10.5]]) expect(bauSetzen(s, 'mast', mx, mz, 0).ok).toBe(true);
    band(s, [WELT.haufenX - 3, z + 1.5], [WELT.haufenX + 3, z + 1.5]);
    laufen(s, 20);
    expect(lauf(arm.bau).status).not.toBe('strom');
    expect(s.stat.maschine).toBeGreaterThan(100);
  });

  it('Drohnen sammeln lose Halme ein und bringen sie zum Stand', () => {
    const s = hof();
    bauSetzen(s, 'drohnenstation', -10, -5, 0);
    const z = () => 0.5;
    for (let i = 0; i < 5; i++) loseAblegen(s, null, -6 - i, -9, 30, z, { rollen: false, streuen: 0 });
    const vor = loseSumme(s);
    laufen(s, 40);
    expect(loseSumme(s)).toBeLessThan(vor * 0.5);
    expect(s.stat.drohne).toBeGreaterThan(60);
    expect(s.stat.verkauft).toBeGreaterThan(60);
  });

  it('der Laster kommt, lädt den Auftrag und zahlt den Lohn', () => {
    const s = hof();
    laufen(s, 8);
    expect(s.laster.zustand).toBe('steht');
    const a = auftrag(0);
    expect(a.will).toBe('roh');
    const geldVor = s.geld;
    const ev = [];
    let n = 0;
    while (s.laster.zustand === 'steht' && n++ < 100) lasterAnnehmen(s, gegenstandNeu(s, 'roh', 250, 0, 0, 0), ev);
    expect(n).toBe(Math.ceil(a.menge / 250));
    expect(s.stat.auftraege).toBe(1);
    expect(s.geld - geldVor).toBeGreaterThanOrEqual(a.lohn);
    expect(s.laster.zustand).toBe('faehrt');
    expect(ev.some((e) => e.typ === 'auftrag')).toBe(true);
  });
});

describe('Bauen', () => {
  it('prüft Wand, Haufen, Stationen und Geld; Geschenke kosten nichts', () => {
    const s = hof();
    expect(bauPruefen(s, 'silo', WELT.xMin + 0.3, 0, 0).grund).toBe('wand');
    expect(bauPruefen(s, 'silo', WELT.haufenX, WELT.haufenZ, 0).grund).toBe('haufen');
    expect(bauPruefen(s, 'silo', WELT.werkzeugX, WELT.werkzeugZ, 0).grund).toBe('belegt');
    s.geld = 0;
    expect(bauPruefen(s, 'silo', -10, 8, 0).grund).toBe('geld');
    s.geschenke.rechen = 1;
    const r = bauSetzen(s, 'rechen', -10, 8, 0);
    expect(r.ok).toBe(true);
    expect(r.bau.geschenk).toBe(true);
    expect(s.geschenke.rechen).toBeUndefined();
    bauAbbauen(s, r.bau);
    expect(s.geschenke.rechen).toBe(1);
  });

  it('Bauten stehen im Weg, oben kann man stehen', () => {
    const s = hof();
    bauSetzen(s, 'silo', -10, 8, 0);
    const u = bautenUmgebung(s);
    expect(u.kollider.some((k) => k.x0 < -10 && k.x1 > -10 && k.h > 4)).toBe(true);
  });

  it('jeder Bau hat einen Grundzustand und passt in die Halle', () => {
    for (const b of BAUTEN) expect(b.b * b.t).toBeGreaterThan(0);
  });
});

describe('Spielstand mit Automatik', () => {
  it('speichert Bauten, Bänder und Stücke und läuft nach dem Laden weiter', () => {
    const s = hof();
    const b = band(s, [-8, -9], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    bauSetzen(s, 'silo', -15.3, 4.6, 0);
    for (let i = 0; i < 3; i++) bandEinlegen(b, gegenstandNeu(s, 'roh', 40, 0, 0, 0), i * 0.7);
    laufen(s, 1);
    const text = speichern(s);
    expect(text).not.toContain('"_l"');
    const t = laden(text);
    expect(t).not.toBeNull();
    expect(t.bauten.length).toBe(2);
    expect(t.gegenstaende.filter((g) => g.ort === 'band').length).toBe(3);
    laufen(t, 30);
    expect(t.stat.verkauft).toBe(120);
  });

  it('das Werfen aus dem Behälter landet auf einem Band', () => {
    const s = hof();
    const b = band(s, [-10, -10], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    s.spieler.last = 30;
    const p = bandPunkt(b, 1.5);
    const g = heuWerfen(s, [p.x, 1.4, p.z + 1.45], [0, 0, -1], 30, 2.2);
    expect(g).not.toBeNull();
    laufen(s, 1.5);
    expect(g.ort === 'band' || g.ort === 'weg').toBe(true);
    expect(lauf(b).ziel.art).toBe('stand');
  });
});

describe('Abwesenheit', () => {
  it('rechnet drei Minuten genau nach und schätzt den Rest', () => {
    const s = hof();
    const x = rechenPlatz(s);
    const r = bauSetzen(s, 'rechen', x, WELT.haufenZ, 0);
    band(s, [x - 0.5 - r.bau.weite, WELT.haufenZ], [STAND_TRICHTER.x + 0.5, STAND_TRICHTER.z]);
    bauSetzen(s, 'mast', -11, 4, 0);
    bauSetzen(s, 'mast', x - 1, 3.4, 0);
    s.zuletzt = Date.now() - 3600 * 1000;
    const erg = abwesenheit(s, Date.now(), [automatikSchritt]);
    expect(erg.kurz).toBe(false);
    expect(erg.halme).toBeGreaterThan(600);
    // drei Minuten genau, dazu 57 Minuten zur Hälfte geschätzt: gut das Zehnfache
    const genauGeld = erg.halme * werte(s).preisRoh;
    expect(erg.verdient).toBeGreaterThan(genauGeld * 5);
    expect(abwesenheit(s, Date.now(), [automatikSchritt])).toBeNull();
  });
});

describe('Maschinenverzeichnis', () => {
  it('hat für jede Maschine mit Anschlüssen einen Schritt', () => {
    for (const b of BAUTEN) if ((b.ein.length || b.aus.length) && b.id !== 'band') expect(MASCHINE[b.id], b.id).toBeDefined();
  });
});

describe('Plattformen', () => {
  it('oben darf gebaut werden, darunter passt, was niedriger ist', () => {
    const s = hof();
    s.tech.plattform = 1;
    s.rev++;
    const pl = bauSetzen(s, 'plattform', -10, 8, 0);
    expect(pl.ok).toBe(true);
    // Scanner (1,5 m hoch) passt darunter, das Silo (4,2 m) nicht
    expect(bauPruefen(s, 'scanner', -10, 8, 0).ok).toBe(true);
    expect(bauPruefen(s, 'silo', -10, 8, 0).grund).toBe('belegt');
    // oben: ganz auf dem Deck, der Rechen gehört an den Haufen
    expect(bauPruefen(s, 'scanner', -10, 8, 0, { y: 2.2 }).ok).toBe(true);
    expect(bauPruefen(s, 'scanner', -9.2, 8, 0, { y: 2.2 }).grund).toBe('kante');
    expect(bauPruefen(s, 'rechen', -10, 8, 0, { y: 2.2 }).grund).toBe('boden');
    const oben = bauSetzen(s, 'scanner', -10, 8, 0, { y: 2.2 });
    expect(oben.ok).toBe(true);
    // ein Band vom Boden hinauf in den Scanner steigt an
    const von = bandAnker(s, -16, 8, false);
    const nach = bandAnker(s, -10.7, 8, true, { y: 2.2 });
    expect(nach.art).toBe('ein');
    const plan = bandPlanen(s, von, nach);
    expect(plan.ok).toBe(true);
    expect(plan.punkte[plan.punkte.length - 1][1]).toBeCloseTo(2.2 + 0.55, 5);
    // Stücke landen oben auf dem Deck
    const u = bautenUmgebung(s);
    expect(u.flaechen.some((f) => f.plattform === pl.bau.id && Math.abs(f.h - 2.2) < 1e-6)).toBe(true);
  });
});
