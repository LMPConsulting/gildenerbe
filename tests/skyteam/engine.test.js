import {
  PILOT, KOPILOT, FELDER, FLUGHAEFEN, WUERFEL_JE_RUNDE, FLUGLAGE_GRENZE,
  AERO_START, BREMSWERTE, KAFFEE_MAX,
  FAHRWERK_WERTE, KLAPPEN_WERTE, BREMSEN_WERTE,
  neuesSpiel, wuerfeln, setzen, passt, darfSetzen, moeglicheFelder, feldMit, feldWerte,
  geschwindigkeit, rundeAuswerten, landung, bremswert, kaffeeNutzen, feldFrei, lage,
  windAufschlag, neuWuerfeln, NEUWURF_MARKEN,
} from '../../skyteam/src/engine.js';

const ohneZufall = () => 0;

/** Spiel mit vorgegebenen Würfeln in die Setzphase bringen. */
function bereit(pilotWuerfel, kopilotWuerfel, flughafen = 0) {
  const s = neuesSpiel(flughafen);
  wuerfeln(s, ohneZufall);
  s.wuerfel = [pilotWuerfel.slice(), kopilotWuerfel.slice()];
  s.windRichtung = 0;
  s.dran = PILOT;
  return s;
}

/** Pflichtfelder füllen und die Runde abschließen. */
function runde(s, { achseP, achseK, motorP, motorK }) {
  s.dran = PILOT; setzen(s, PILOT, 'achseP', achseP);
  s.dran = KOPILOT; setzen(s, KOPILOT, 'achseK', achseK);
  s.dran = PILOT; setzen(s, PILOT, 'motorP', motorP);
  s.dran = KOPILOT; setzen(s, KOPILOT, 'motorK', motorK);
  // Übrige Würfel verfallen — die Runde wird ausgewertet.
  if (s.phase === 'setzen') { s.wuerfel = [[], []]; rundeAuswerten(s); }
  return s;
}

describe('Cockpit', () => {
  it('teilt die Felder auf beide Rollen auf', () => {
    const pilot = FELDER.filter((f) => f.wer === PILOT).map((f) => f.gruppe);
    const kopilot = FELDER.filter((f) => f.wer === KOPILOT).map((f) => f.gruppe);
    expect(pilot).toContain('fahrwerk');
    expect(pilot).toContain('bremse');
    expect(kopilot).toContain('klappe');
    expect(kopilot.filter((g) => g === 'klappe')).toHaveLength(4);
    expect(pilot.filter((g) => g === 'fahrwerk')).toHaveLength(3);
    expect(pilot.filter((g) => g === 'bremse')).toHaveLength(3);
  });

  it('gibt dem Kopiloten zwei Funkfelder, dem Piloten eines', () => {
    const funk = FELDER.filter((f) => f.gruppe === 'funk');
    expect(funk.filter((f) => f.wer === PILOT)).toHaveLength(1);
    expect(funk.filter((f) => f.wer === KOPILOT)).toHaveLength(2);
  });

  it('macht Ruder und Schub zur Pflicht — je einmal pro Rolle', () => {
    const pflicht = FELDER.filter((f) => f.pflicht);
    expect(pflicht.map((f) => f.id).sort()).toEqual(['achseK', 'achseP', 'motorK', 'motorP']);
  });

  it('verlangt auf Schaltern bestimmte Augenzahlen', () => {
    expect(feldWerte(feldMit('fahrwerk0'))).toEqual(FAHRWERK_WERTE[0]);
    expect(feldWerte(feldMit('klappe1'))).toEqual(KLAPPEN_WERTE[1]);
    expect(feldWerte(feldMit('bremse2'))).toEqual(BREMSEN_WERTE[2]);
    expect(feldWerte(feldMit('achseP'))).toBe(null);
  });
});

describe('Würfeln', () => {
  it('gibt beiden vier Würfel und übergibt an den Startspieler', () => {
    const s = neuesSpiel(0);
    wuerfeln(s, () => 0.5);
    expect(s.wuerfel[PILOT]).toHaveLength(WUERFEL_JE_RUNDE);
    expect(s.wuerfel[KOPILOT]).toHaveLength(WUERFEL_JE_RUNDE);
    expect(s.phase).toBe('setzen');
    expect(s.dran).toBe(s.startspieler);
  });

  it('würfelt nur Werte von 1 bis 6', () => {
    for (let i = 0; i < 200; i++) {
      const s = neuesSpiel(0);
      wuerfeln(s);
      for (const w of [...s.wuerfel[0], ...s.wuerfel[1]]) {
        expect(w).toBeGreaterThanOrEqual(1);
        expect(w).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('Würfel setzen', () => {
  it('lässt nur eigene Felder zu', () => {
    const s = bereit([3, 3, 3, 3], [3, 3, 3, 3]);
    expect(passt(s, PILOT, 'achseP', 3)).toBe(true);
    expect(passt(s, PILOT, 'achseK', 3)).toBe(false);
    expect(passt(s, KOPILOT, 'klappe0', 3)).toBe(false);   // Klappe 1 will 1 oder 2
  });

  it('achtet auf die geforderte Augenzahl', () => {
    const s = bereit([1, 3, 5, 6], [1, 2, 3, 4]);
    expect(passt(s, PILOT, 'fahrwerk0', 1)).toBe(true);
    expect(passt(s, PILOT, 'fahrwerk0', 3)).toBe(false);
    expect(passt(s, PILOT, 'fahrwerk1', 3)).toBe(true);
    expect(passt(s, PILOT, 'fahrwerk2', 5)).toBe(true);
  });

  it('lässt Fahrwerke in beliebiger Reihenfolge zu', () => {
    const s = bereit([5, 1, 2, 3], [1, 2, 3, 4]);
    expect(passt(s, PILOT, 'fahrwerk2', 5)).toBe(true);
    setzen(s, PILOT, 'fahrwerk2', 5);
    expect(s.fahrwerk).toEqual([false, false, true]);
  });

  it('verlangt Klappen und Bremsen der Reihe nach', () => {
    const s = bereit([2, 4, 4, 4], [2, 3, 4, 5]);
    expect(passt(s, KOPILOT, 'klappe1', 2)).toBe(false);   // Klappe 1 fehlt noch
    expect(passt(s, PILOT, 'bremse1', 4)).toBe(false);     // Bremse 1 fehlt noch
    expect(passt(s, PILOT, 'bremse0', 4)).toBe(false);     // Bremse 1 will genau die 2
    setzen(s, PILOT, 'bremse0', 2);
    expect(passt(s, PILOT, 'bremse1', 4)).toBe(true);
  });

  it('hält so viele Würfel zurück, dass Ruder und Schub noch gehen', () => {
    const s = bereit([1, 1, 1, 1], [1, 1, 1, 1]);
    // Zwei freie Würfel sind da, danach müssen zwei Pflichtfelder bedient werden
    expect(passt(s, PILOT, 'fahrwerk0', 1)).toBe(true);
    setzen(s, PILOT, 'fahrwerk0', 1);
    s.dran = PILOT;
    expect(passt(s, PILOT, 'kaffeeP', 1)).toBe(true);
    setzen(s, PILOT, 'kaffeeP', 1);
    s.dran = PILOT;
    expect(passt(s, PILOT, 'kaffeeP', 1)).toBe(false);     // sonst fehlt ein Pflichtwürfel
    expect(passt(s, PILOT, 'achseP', 1)).toBe(true);
  });

  it('gibt nur Felder zurück, auf die der Würfel wirklich passt', () => {
    const s = bereit([6, 1, 1, 1], [1, 1, 1, 1]);
    const felder = moeglicheFelder(s, PILOT, 6);
    expect(felder).toContain('fahrwerk2');
    expect(felder).not.toContain('fahrwerk0');           // 6 passt dort nicht
    expect(felder).not.toContain('bremse2');             // Bremse 1 und 2 fehlen noch
    s.bremsen = [true, true, false];
    expect(moeglicheFelder(s, PILOT, 6)).toContain('bremse2');
  });

  it('trennt Zugrecht von Passform', () => {
    const s = bereit([2, 2, 2, 2], [2, 2, 2, 2]);
    s.dran = PILOT;
    expect(passt(s, KOPILOT, 'achseK', 2)).toBe(true);
    expect(darfSetzen(s, KOPILOT, 'achseK', 2)).toBe(false);
  });

  it('wechselt nach jedem Würfel die Seite', () => {
    const s = bereit([2, 2, 2, 2], [3, 3, 3, 3]);
    expect(s.dran).toBe(PILOT);
    setzen(s, PILOT, 'achseP', 2);
    expect(s.dran).toBe(KOPILOT);
    setzen(s, KOPILOT, 'achseK', 3);
    expect(s.dran).toBe(PILOT);
  });
});

describe('Sofortwirkungen', () => {
  it('schiebt mit jedem Fahrwerk den blauen Marker', () => {
    const s = bereit([1, 3, 5, 2], [1, 1, 1, 1]);
    expect(s.aero.blau).toBe(AERO_START.blau);
    setzen(s, PILOT, 'fahrwerk0', 1);
    expect(s.aero.blau).toBe(AERO_START.blau + 1);
  });

  it('schiebt mit jeder Klappe den orangen Marker', () => {
    const s = bereit([1, 1, 1, 1], [1, 2, 3, 4]);
    s.dran = KOPILOT;
    setzen(s, KOPILOT, 'klappe0', 1);
    expect(s.aero.orange).toBe(AERO_START.orange + 1);
  });

  it('hebt mit jeder Bremse den zulässigen Landewert', () => {
    const s = bereit([2, 3, 5, 2], [1, 1, 1, 1]);
    expect(bremswert(s)).toBe(BREMSWERTE[0]);
    setzen(s, PILOT, 'bremse0', 2);
    expect(bremswert(s)).toBe(BREMSWERTE[1]);
  });

  it('funkt genau das Flugzeug weg, das in dieser Entfernung liegt', () => {
    const s = bereit([3, 1, 1, 1], [1, 1, 1, 1]);
    s.flugzeuge = [3, 5];
    s.position = 0;
    setzen(s, PILOT, 'funkP', 3);
    expect(s.flugzeuge).toEqual([5]);
  });

  it('funkt ins Leere, wenn dort nichts fliegt', () => {
    const s = bereit([2, 1, 1, 1], [1, 1, 1, 1]);
    s.flugzeuge = [3];
    setzen(s, PILOT, 'funkP', 2);
    expect(s.flugzeuge).toEqual([3]);
  });

  it('rechnet die Entfernung ab der aktuellen Position', () => {
    const s = bereit([2, 1, 1, 1], [1, 1, 1, 1]);
    s.position = 3;
    s.flugzeuge = [5];
    setzen(s, PILOT, 'funkP', 2);
    expect(s.flugzeuge).toEqual([]);
  });

  it('sammelt Kaffee bis zum Maximum', () => {
    const s = bereit([1, 1, 1, 1], [1, 1, 1, 1]);
    s.kaffee = KAFFEE_MAX;
    expect(feldFrei(s, feldMit('kaffeeP'))).toBe(false);
  });

  it('verändert mit Kaffee einen eigenen Würfel um eins', () => {
    const s = bereit([3, 1, 1, 1], [1, 1, 1, 1]);
    s.kaffee = 1;
    kaffeeNutzen(s, PILOT, 0, +1);
    expect(s.wuerfel[PILOT][0]).toBe(4);
    expect(s.kaffee).toBe(0);
    kaffeeNutzen(s, PILOT, 0, +1);
    expect(s.wuerfel[PILOT][0]).toBe(4);                  // ohne Kaffee passiert nichts
  });

  it('lässt Kaffee nicht über 6 oder unter 1 schieben', () => {
    const s = bereit([6, 1, 1, 1], [1, 1, 1, 1]);
    s.kaffee = 2;
    kaffeeNutzen(s, PILOT, 0, +1);
    expect(s.wuerfel[PILOT][0]).toBe(6);
    expect(s.kaffee).toBe(2);
  });
});

describe('Geschwindigkeit', () => {
  it('folgt den beiden Aerodynamik-Markern', () => {
    const s = neuesSpiel(0);
    expect(geschwindigkeit(s, 4)).toBe(0);
    expect(geschwindigkeit(s, 5)).toBe(1);
    expect(geschwindigkeit(s, 8)).toBe(1);
    expect(geschwindigkeit(s, 9)).toBe(2);
  });

  it('wird träger, je mehr ausgefahren ist', () => {
    const s = neuesSpiel(0);
    s.aero = { blau: 7, orange: 12 };
    expect(geschwindigkeit(s, 7)).toBe(0);
    expect(geschwindigkeit(s, 8)).toBe(1);
    expect(geschwindigkeit(s, 12)).toBe(1);              // Tempo 2 ist dann praktisch weg
  });
});

describe('Rundenauswertung', () => {
  it('kippt das Flugzeug um die Differenz der Ruderwürfel', () => {
    const s = bereit([5, 3, 1, 1], [3, 3, 1, 1]);
    runde(s, { achseP: 5, achseK: 3, motorP: 3, motorK: 3 });
    expect(s.fluglage).toBe(2);
  });

  it('summiert die Schräglage über die Runden', () => {
    const s = bereit([4, 3, 1, 1], [3, 3, 1, 1]);
    runde(s, { achseP: 4, achseK: 3, motorP: 3, motorK: 3 });
    expect(s.fluglage).toBe(1);
    wuerfeln(s, ohneZufall);
    s.wuerfel = [[4, 3, 1, 1], [3, 3, 1, 1]];
    runde(s, { achseP: 4, achseK: 3, motorP: 3, motorK: 3 });
    expect(s.fluglage).toBe(2);
  });

  it('lässt das Flugzeug jenseits der Grenze trudeln', () => {
    const s = bereit([6, 3, 1, 1], [2, 3, 1, 1]);
    runde(s, { achseP: 6, achseK: 2, motorP: 3, motorK: 3 });
    expect(s.phase).toBe('verloren');
    expect(s.grund).toMatch(/trudelt/);
    expect(Math.abs(s.fluglage)).toBeGreaterThan(FLUGLAGE_GRENZE);
  });

  it('bewegt das Flugzeug gemäß der Motorsumme', () => {
    const s = bereit([3, 3, 1, 1], [3, 3, 1, 1]);
    s.flugzeuge = [];
    const hoeheVorher = s.hoehe;
    runde(s, { achseP: 3, achseK: 3, motorP: 3, motorK: 3 });   // Summe 6 -> ein Feld
    expect(s.position).toBe(1);
    expect(s.hoehe).toBe(hoeheVorher - 1000);
    expect(s.runde).toBe(2);
  });

  it('bleibt bei zu wenig Schub stehen', () => {
    const s = bereit([2, 3, 1, 1], [2, 3, 1, 1]);
    s.flugzeuge = [];
    runde(s, { achseP: 3, achseK: 3, motorP: 2, motorK: 2 });   // Summe 4 -> null Felder
    expect(s.position).toBe(0);
  });

  it('erkennt den Zusammenstoß mit einer fremden Maschine', () => {
    const s = bereit([3, 3, 1, 1], [3, 3, 1, 1]);
    s.flugzeuge = [1];
    runde(s, { achseP: 3, achseK: 3, motorP: 3, motorK: 3 });
    expect(s.phase).toBe('verloren');
    expect(s.grund).toMatch(/Zusammenstoß/);
  });

  it('verliert beim Überschießen der Landebahn', () => {
    const s = bereit([5, 3, 1, 1], [5, 3, 1, 1]);
    s.flugzeuge = [];
    s.position = s.anflugLaenge;
    runde(s, { achseP: 3, achseK: 3, motorP: 5, motorK: 5 });   // Summe 10 -> zwei Felder
    expect(s.phase).toBe('verloren');
    expect(s.grund).toMatch(/hinaus/);
  });

  it('verliert, wenn das Ruder unbedient bleibt', () => {
    const s = bereit([3, 3, 3, 3], [3, 3, 3, 3]);
    s.belegt = { motorP: 3, motorK: 3 };
    rundeAuswerten(s);
    expect(s.phase).toBe('verloren');
    expect(s.grund).toMatch(/Ruder/);
  });

  it('wechselt nach jeder Runde den Startspieler', () => {
    const s = bereit([3, 3, 1, 1], [3, 3, 1, 1]);
    s.flugzeuge = [];
    const vorher = s.startspieler;
    runde(s, { achseP: 3, achseK: 3, motorP: 3, motorK: 3 });
    expect(s.startspieler).toBe(vorher === PILOT ? KOPILOT : PILOT);
  });
});

describe('Landung', () => {
  /** Ein Spiel kurz vor der perfekten Landung. */
  function kurzVorSchluss() {
    const s = neuesSpiel(0);
    s.position = s.anflugLaenge;
    s.fluglage = 0;
    s.fahrwerk = [true, true, true];
    s.klappen = [true, true, true, true];
    s.bremsen = [true, true, true];
    s.flugzeuge = [];
    return s;
  }

  it('gelingt, wenn alles stimmt', () => {
    const s = kurzVorSchluss();
    landung(s, bremswert(s));
    expect(s.phase).toBe('gewonnen');
  });

  it('scheitert bei Schräglage', () => {
    const s = kurzVorSchluss();
    s.fluglage = 1;
    landung(s, 8);
    expect(s.phase).toBe('verloren');
    expect(s.grund).toMatch(/schräg/);
  });

  it('scheitert ohne vollständiges Fahrwerk', () => {
    const s = kurzVorSchluss();
    s.fahrwerk = [true, true, false];
    landung(s, 8);
    expect(s.grund).toMatch(/Fahrwerk/);
  });

  it('scheitert ohne vollständige Landeklappen', () => {
    const s = kurzVorSchluss();
    s.klappen = [true, true, true, false];
    landung(s, 8);
    expect(s.grund).toMatch(/Landeklappen/);
  });

  it('scheitert bei fremdem Verkehr im Anflug', () => {
    const s = kurzVorSchluss();
    s.flugzeuge = [2];
    landung(s, 8);
    expect(s.grund).toMatch(/fremde/);
  });

  it('scheitert, wenn die Bremsen das Tempo nicht halten', () => {
    const s = kurzVorSchluss();
    s.bremsen = [true, false, false];             // erlaubt höchstens 5
    landung(s, 8);
    expect(s.grund).toMatch(/bremsen/i);
  });

  it('scheitert, wenn die Landebahn nicht erreicht ist', () => {
    const s = kurzVorSchluss();
    s.position = s.anflugLaenge - 1;
    landung(s, 8);
    expect(s.grund).toMatch(/Landebahn/);
  });

  it('nennt alle Mängel auf einmal', () => {
    const s = kurzVorSchluss();
    s.fluglage = 2;
    s.klappen = [true, false, false, false];
    landung(s, 12);
    expect(s.grund).toMatch(/schräg/);
    expect(s.grund).toMatch(/Landeklappen/);
  });
});

describe('Flughäfen', () => {
  it('bietet elf Ziele mit steigender Strecke', () => {
    expect(FLUGHAEFEN).toHaveLength(11);
    expect(FLUGHAEFEN[0].name).toBe('Montréal');
    expect(FLUGHAEFEN[10].name).toBe('Tokio');
  });

  it('hält jeden Anflug in der Rundenzahl erreichbar', () => {
    for (const f of FLUGHAEFEN) {
      const runden = f.hoehe / 1000;
      expect(f.anflug, f.name).toBeLessThanOrEqual(runden * 2);
      expect(f.anflug, f.name).toBeGreaterThan(0);
    }
  });

  it('stellt fremde Maschinen nur auf erreichbare Felder', () => {
    for (const f of FLUGHAEFEN) {
      for (const pos of f.flugzeuge) {
        expect(pos, `${f.name} ${pos}`).toBeGreaterThan(0);
        expect(pos, `${f.name} ${pos}`).toBeLessThanOrEqual(f.anflug);
      }
      expect(new Set(f.flugzeuge).size, f.name).toBe(f.flugzeuge.length);
    }
  });

  it('liefert einen Lagebericht für die Anzeige', () => {
    const s = neuesSpiel(4);
    const l = lage(s);
    expect(l.flughafen.name).toBe(FLUGHAEFEN[4].name);
    expect(l.rest).toBe(FLUGHAEFEN[4].anflug);
    expect(l.offen.fahrwerk).toBe(3);
    expect(l.offen.klappen).toBe(4);
  });
});

describe('Wind', () => {
  it('bleibt wirkungslos, solange das Flugzeug gerade liegt', () => {
    const s = neuesSpiel(4);                      // Kapstadt: böig
    expect(s.wind).toBe(true);
    expect(windAufschlag(s)).toBe(0);
  });

  it('schiebt umso mehr, je schräger das Flugzeug liegt', () => {
    const s = neuesSpiel(4);
    s.fluglage = -2;
    expect(windAufschlag(s)).toBe(2);
  });

  it('lässt ruhige Flughäfen in Ruhe', () => {
    const s = neuesSpiel(0);
    s.fluglage = 2;
    expect(windAufschlag(s)).toBe(0);
  });

  it('rechnet den Aufschlag auf die Motorsumme drauf', () => {
    const s = neuesSpiel(4);
    wuerfeln(s, () => 0);
    s.wuerfel = [[4, 1, 1, 1], [4, 1, 1, 1]];
    s.fluglage = 1;                                // Wind +1
    s.flugzeuge = [];
    s.dran = PILOT;
    setzen(s, PILOT, 'achseP', 4);
    setzen(s, KOPILOT, 'achseK', 4);              // Lage bleibt +1
    setzen(s, PILOT, 'motorP', 1);
    setzen(s, KOPILOT, 'motorK', 1);
    s.wuerfel = [[], []];
    rundeAuswerten(s);
    expect(s.letzteRunde.summe).toBe(2);
    expect(s.letzteRunde.wind).toBe(1);
    expect(s.letzteRunde.tempo).toBe(3);
  });
});

describe('Verkehrswürfel', () => {
  it('setzt zu Rundenbeginn eine Maschine voraus ein', () => {
    const s = neuesSpiel(0);
    s.verkehr = [0];
    s.flugzeuge = [];
    wuerfeln(s, () => 0.5);                        // d6 = 4
    expect(s.flugzeuge).toEqual([4]);
    expect(s.neueMaschinen).toEqual([4]);
  });

  it('rollt nur auf dem markierten Feld', () => {
    const s = neuesSpiel(0);
    s.verkehr = [2];
    s.position = 1;
    s.flugzeuge = [];
    wuerfeln(s, () => 0.5);
    expect(s.flugzeuge).toEqual([]);
  });

  it('setzt nichts hinter die Landebahn', () => {
    const s = neuesSpiel(0);
    s.verkehr = [0];
    s.flugzeuge = [];
    s.anflugLaenge = 2;
    wuerfeln(s, () => 0.9);                        // d6 = 6, aber Bahn liegt bei 2
    expect(s.flugzeuge).toEqual([]);
  });
});

describe('Neuwurf', () => {
  it('gibt es zweimal pro Spiel und würfelt beide Sätze neu', () => {
    const s = bereit([1, 1, 1, 1], [1, 1, 1, 1]);
    expect(s.neuwurf).toBe(NEUWURF_MARKEN);
    neuWuerfeln(s, () => 0.9);                     // alles wird zur 6
    expect(s.wuerfel[PILOT]).toEqual([6, 6, 6, 6]);
    expect(s.wuerfel[KOPILOT]).toEqual([6, 6, 6, 6]);
    expect(s.neuwurf).toBe(NEUWURF_MARKEN - 1);
  });

  it('lässt gesetzte Würfel in Ruhe', () => {
    const s = bereit([3, 1, 1, 1], [1, 1, 1, 1]);
    setzen(s, PILOT, 'achseP', 3);
    neuWuerfeln(s, () => 0.9);
    expect(s.belegt.achseP).toBe(3);
    expect(s.wuerfel[PILOT]).toHaveLength(3);
  });

  it('hört auf, wenn keine Marke mehr da ist', () => {
    const s = bereit([1, 1, 1, 1], [1, 1, 1, 1]);
    s.neuwurf = 0;
    neuWuerfeln(s, () => 0.9);
    expect(s.wuerfel[PILOT]).toEqual([1, 1, 1, 1]);
  });
});

describe('Bremsen', () => {
  it('verlangt genau die 2, die 4 und die 6', () => {
    expect(BREMSEN_WERTE).toEqual([[2], [4], [6]]);
  });

  it('hält ohne Bremse nicht einmal die kleinste Summe', () => {
    const s = neuesSpiel(0);
    expect(bremswert(s)).toBeLessThan(2);
  });

  it('kommt mit allen drei Bremsen auf vier', () => {
    const s = neuesSpiel(0);
    s.bremsen = [true, true, true];
    expect(bremswert(s)).toBe(4);
  });

  it('lässt genau den Bremswert noch durchgehen', () => {
    const s = neuesSpiel(0);
    s.position = s.anflugLaenge;
    s.fahrwerk = [true, true, true];
    s.klappen = [true, true, true, true];
    s.bremsen = [true, true, true];
    s.flugzeuge = [];
    landung(s, 4);
    expect(s.phase).toBe('gewonnen');
  });
});
