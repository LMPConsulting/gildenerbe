// Sky Team — Spiellogik ohne DOM. Kooperativ zu zweit: Pilot und Kopilot
// landen gemeinsam ein Flugzeug, indem sie abwechselnd Würfel ins Cockpit legen.

export const PILOT = 0;
export const KOPILOT = 1;
export const ROLLE = ['Pilot', 'Kopilot'];

export const WUERFEL_JE_RUNDE = 4;
export const FLUGLAGE_GRENZE = 3;        // darüber hinaus trudelt das Flugzeug
export const KAFFEE_MAX = 3;

// Aerodynamik: Motorsumme ≤ blau -> 0 Felder, ≤ orange -> 1 Feld, darüber 2.
export const AERO_START = { blau: 4, orange: 8 };

// Bremsstufe -> höchste Motorsumme, die bei der Landung noch zu bremsen ist.
export const BREMSWERTE = [2, 5, 8, 11];

// Welche Augenzahlen ein Schalter verlangt.
export const FAHRWERK_WERTE = [[1, 2], [3, 4], [5, 6]];
export const KLAPPEN_WERTE = [[1, 2], [2, 3], [3, 4], [4, 5]];
export const BREMSEN_WERTE = [[1, 2], [3, 4], [5, 6]];

/**
 * Elf Flughäfen mit steigender Schwierigkeit. Höhe bestimmt die Rundenzahl
 * (1000 Fuß pro Runde), Anflug die Zahl der Felder bis zur Landebahn.
 * Die Werte sind per Simulation auf eine ansteigende Kurve eingestellt.
 */
export const FLUGHAEFEN = [
  { kuerzel: 'YUL', name: 'Montréal', hoehe: 6000, anflug: 4, flugzeuge: [3], wind: false },
  { kuerzel: 'ZRH', name: 'Zürich', hoehe: 7000, anflug: 6, flugzeuge: [2, 4, 5], wind: false },
  { kuerzel: 'ORD', name: 'Chicago', hoehe: 7000, anflug: 6, flugzeuge: [2, 4], wind: true },
  { kuerzel: 'GRU', name: 'São Paulo', hoehe: 6000, anflug: 5, flugzeuge: [2, 4], wind: false },
  { kuerzel: 'LHR', name: 'London', hoehe: 8000, anflug: 8, flugzeuge: [2, 4, 6, 7], wind: false },
  { kuerzel: 'CPT', name: 'Kapstadt', hoehe: 7000, anflug: 7, flugzeuge: [2, 4, 6], wind: false },
  { kuerzel: 'KEF', name: 'Reykjavík', hoehe: 8000, anflug: 9, flugzeuge: [2, 4, 6, 8], wind: true },
  { kuerzel: 'DXB', name: 'Dubai', hoehe: 8000, anflug: 8, flugzeuge: [1, 3, 5, 7], wind: true },
  { kuerzel: 'SYD', name: 'Sydney', hoehe: 7000, anflug: 7, flugzeuge: [1, 3, 5], wind: true },
  { kuerzel: 'MEX', name: 'Mexiko-Stadt', hoehe: 9000, anflug: 10, flugzeuge: [1, 3, 5, 7, 9], wind: true },
  { kuerzel: 'HND', name: 'Tokio', hoehe: 9000, anflug: 11, flugzeuge: [1, 3, 5, 7, 9, 10], wind: true },
];

/* --------------------------------------------------------------- Cockpit */

/** Alle Felder des Cockpits. `wer` = wessen Würfel dort liegen dürfen. */
export const FELDER = [
  { id: 'achseP', wer: PILOT, gruppe: 'achse', titel: 'Ruder links', pflicht: true },
  { id: 'achseK', wer: KOPILOT, gruppe: 'achse', titel: 'Ruder rechts', pflicht: true },
  { id: 'motorP', wer: PILOT, gruppe: 'motor', titel: 'Schub links', pflicht: true },
  { id: 'motorK', wer: KOPILOT, gruppe: 'motor', titel: 'Schub rechts', pflicht: true },

  { id: 'fahrwerk0', wer: PILOT, gruppe: 'fahrwerk', nr: 0, titel: 'Fahrwerk 1' },
  { id: 'fahrwerk1', wer: PILOT, gruppe: 'fahrwerk', nr: 1, titel: 'Fahrwerk 2' },
  { id: 'fahrwerk2', wer: PILOT, gruppe: 'fahrwerk', nr: 2, titel: 'Fahrwerk 3' },

  { id: 'klappe0', wer: KOPILOT, gruppe: 'klappe', nr: 0, titel: 'Klappe 1' },
  { id: 'klappe1', wer: KOPILOT, gruppe: 'klappe', nr: 1, titel: 'Klappe 2' },
  { id: 'klappe2', wer: KOPILOT, gruppe: 'klappe', nr: 2, titel: 'Klappe 3' },
  { id: 'klappe3', wer: KOPILOT, gruppe: 'klappe', nr: 3, titel: 'Klappe 4' },

  { id: 'bremse0', wer: PILOT, gruppe: 'bremse', nr: 0, titel: 'Bremse 1' },
  { id: 'bremse1', wer: PILOT, gruppe: 'bremse', nr: 1, titel: 'Bremse 2' },
  { id: 'bremse2', wer: PILOT, gruppe: 'bremse', nr: 2, titel: 'Bremse 3' },

  { id: 'funkP', wer: PILOT, gruppe: 'funk', titel: 'Funk' },
  { id: 'funkK1', wer: KOPILOT, gruppe: 'funk', titel: 'Funk 1' },
  { id: 'funkK2', wer: KOPILOT, gruppe: 'funk', titel: 'Funk 2' },

  { id: 'kaffeeP', wer: PILOT, gruppe: 'kaffee', titel: 'Kaffee' },
  { id: 'kaffeeK', wer: KOPILOT, gruppe: 'kaffee', titel: 'Kaffee' },
];

export const feldMit = (id) => FELDER.find((f) => f.id === id);

/** Welche Augenzahlen verlangt dieses Feld? null = alle. */
export function feldWerte(feld) {
  if (feld.gruppe === 'fahrwerk') return FAHRWERK_WERTE[feld.nr];
  if (feld.gruppe === 'klappe') return KLAPPEN_WERTE[feld.nr];
  if (feld.gruppe === 'bremse') return BREMSEN_WERTE[feld.nr];
  return null;
}

/* ----------------------------------------------------------------- Aufbau */

export function neuesSpiel(flughafenIndex = 0, namen = ['Pilot', 'Kopilot']) {
  const f = FLUGHAEFEN[flughafenIndex];
  return {
    v: 1,
    flughafen: flughafenIndex,
    namen: namen.slice(0, 2),
    runde: 1,
    runden: f.hoehe / 1000,
    hoehe: f.hoehe,
    anflugLaenge: f.anflug,
    position: 0,
    flugzeuge: f.flugzeuge.slice(),
    wind: f.wind,
    windRichtung: 0,
    fluglage: 0,
    aero: { ...AERO_START },
    fahrwerk: [false, false, false],
    klappen: [false, false, false, false],
    bremsen: [false, false, false],
    kaffee: 0,
    wuerfel: [[], []],
    belegt: {},
    dran: PILOT,
    startspieler: PILOT,
    phase: 'briefing',      // 'briefing' | 'setzen' | 'auswertung' | 'gewonnen' | 'verloren'
    letzteRunde: null,
    grund: '',
  };
}

export const bremswert = (s) => BREMSWERTE[s.bremsen.filter(Boolean).length];
export const alleFahrwerke = (s) => s.fahrwerk.every(Boolean);
export const alleKlappen = (s) => s.klappen.every(Boolean);
export const luftraumFrei = (s) => s.flugzeuge.length === 0;
export const istLanderunde = (s) => s.runde >= s.runden;

/* ------------------------------------------------------------- Würfeln */

function d6(rnd) { return 1 + Math.floor(rnd() * 6); }

export function wuerfeln(s, rnd = Math.random) {
  if (s.phase !== 'briefing') return s;
  s.wuerfel = [
    Array.from({ length: WUERFEL_JE_RUNDE }, () => d6(rnd)),
    Array.from({ length: WUERFEL_JE_RUNDE }, () => d6(rnd)),
  ];
  s.belegt = {};
  s.dran = s.startspieler;
  s.windRichtung = s.wind ? [-1, 0, 1][Math.floor(rnd() * 3)] : 0;
  s.phase = 'setzen';
  return s;
}

/* ------------------------------------------------------------ Würfel setzen */

/** Ist dieses Feld für diese Person noch frei? */
export function feldFrei(s, feld) {
  if (s.belegt[feld.id] !== undefined) return false;
  if (feld.gruppe === 'fahrwerk') return !s.fahrwerk[feld.nr];
  if (feld.gruppe === 'klappe') {
    if (s.klappen[feld.nr]) return false;
    return feld.nr === 0 || s.klappen[feld.nr - 1];      // nur der Reihe nach
  }
  if (feld.gruppe === 'bremse') {
    if (s.bremsen[feld.nr]) return false;
    return feld.nr === 0 || s.bremsen[feld.nr - 1];
  }
  if (feld.gruppe === 'kaffee') return s.kaffee < KAFFEE_MAX;
  return true;
}

/** Wie viele Pflichtfelder muss diese Person noch belegen? */
function offenePflicht(s, wer) {
  return FELDER.filter((f) => f.pflicht && f.wer === wer && s.belegt[f.id] === undefined).length;
}

/**
 * Passt der Würfel auf das Feld? Prüft Besitz, Verfügbarkeit, geforderte
 * Augenzahl und ob danach noch genug Würfel für die Pflichtfelder bleiben —
 * aber nicht, wer gerade dran ist. So lässt sich auch die Gegenseite prüfen.
 */
export function passt(s, wer, feldId, wert) {
  if (s.phase !== 'setzen') return false;
  const feld = feldMit(feldId);
  if (!feld || feld.wer !== wer) return false;
  if (!feldFrei(s, feld)) return false;
  if (!s.wuerfel[wer].includes(wert)) return false;

  const werte = feldWerte(feld);
  if (werte && !werte.includes(wert)) return false;

  if (!feld.pflicht) {
    const uebrigDanach = s.wuerfel[wer].length - 1;
    if (uebrigDanach < offenePflicht(s, wer)) return false;
  }
  return true;
}

/** Zusätzlich zur Passform: ist diese Person überhaupt am Zug? */
export function darfSetzen(s, wer, feldId, wert) {
  return s.dran === wer && passt(s, wer, feldId, wert);
}

export function moeglicheFelder(s, wer, wert) {
  return FELDER.filter((f) => passt(s, wer, f.id, wert)).map((f) => f.id);
}

export function kannUeberhauptSetzen(s, wer) {
  return s.wuerfel[wer].some((w) => moeglicheFelder(s, wer, w).length > 0);
}

/** Kaffee ausgeben: einen eigenen Würfel um ±1 verändern. */
export function kaffeeNutzen(s, wer, index, richtung) {
  if (s.phase !== 'setzen' || s.kaffee < 1) return s;
  const wuerfel = s.wuerfel[wer];
  if (index < 0 || index >= wuerfel.length) return s;
  const neu = wuerfel[index] + (richtung < 0 ? -1 : 1);
  if (neu < 1 || neu > 6) return s;
  wuerfel[index] = neu;
  s.kaffee -= 1;
  return s;
}

/** Würfel legen. Sofortwirkungen (Fahrwerk, Klappen, Bremsen, Funk, Kaffee) greifen gleich. */
export function setzen(s, wer, feldId, wert) {
  if (!darfSetzen(s, wer, feldId, wert)) return s;
  const feld = feldMit(feldId);

  const i = s.wuerfel[wer].indexOf(wert);
  s.wuerfel[wer].splice(i, 1);
  s.belegt[feldId] = wert;

  if (feld.gruppe === 'fahrwerk') { s.fahrwerk[feld.nr] = true; s.aero.blau += 1; }
  if (feld.gruppe === 'klappe') { s.klappen[feld.nr] = true; s.aero.orange += 1; }
  if (feld.gruppe === 'bremse') { s.bremsen[feld.nr] = true; }
  if (feld.gruppe === 'kaffee') { s.kaffee = Math.min(KAFFEE_MAX, s.kaffee + 1); }
  if (feld.gruppe === 'funk') {
    const ziel = s.position + wert;
    const j = s.flugzeuge.indexOf(ziel);
    if (j !== -1) s.flugzeuge.splice(j, 1);
  }

  naechsterDran(s);
  if (s.wuerfel[PILOT].length === 0 && s.wuerfel[KOPILOT].length === 0) rundeAuswerten(s);
  return s;
}

/** Wer eigene Würfel nicht mehr unterbringt, wird übersprungen. */
function naechsterDran(s) {
  const anderer = s.dran === PILOT ? KOPILOT : PILOT;
  if (s.wuerfel[anderer].length > 0 && kannUeberhauptSetzen(s, anderer)) { s.dran = anderer; return; }
  if (s.wuerfel[s.dran].length > 0 && kannUeberhauptSetzen(s, s.dran)) return;
  // Keiner kann mehr: die übrigen Würfel verfallen.
  s.wuerfel = [[], []];
}

/* ---------------------------------------------------------- Rundenauswertung */

export function geschwindigkeit(s, summe) {
  if (summe <= s.aero.blau) return 0;
  if (summe <= s.aero.orange) return 1;
  return 2;
}

function verloren(s, grund) {
  s.phase = 'verloren';
  s.grund = grund;
  return s;
}

export function rundeAuswerten(s) {
  const achseP = s.belegt.achseP;
  const achseK = s.belegt.achseK;
  const motorP = s.belegt.motorP;
  const motorK = s.belegt.motorK;

  if (achseP === undefined || achseK === undefined) {
    return verloren(s, 'Das Ruder blieb unbedient — das Flugzeug bricht aus.');
  }
  if (motorP === undefined || motorK === undefined) {
    return verloren(s, 'Der Schub blieb unbedient — die Triebwerke fallen aus.');
  }

  // Fluglage: die Differenz kippt das Flugzeug, dazu bei Bedarf der Wind.
  s.fluglage += (achseP - achseK) + s.windRichtung;
  if (Math.abs(s.fluglage) > FLUGLAGE_GRENZE) {
    return verloren(s, `Schräglage ${s.fluglage > 0 ? '+' : ''}${s.fluglage} — das Flugzeug trudelt.`);
  }

  // Schub: Summe gegen die Aerodynamik-Marker.
  const summe = motorP + motorK;
  const tempo = geschwindigkeit(s, summe);
  const ziel = s.position + tempo;

  for (let feld = s.position + 1; feld <= Math.min(ziel, s.anflugLaenge); feld++) {
    if (s.flugzeuge.includes(feld)) {
      return verloren(s, `Zusammenstoß mit einer fremden Maschine ${feld - s.position} Felder voraus.`);
    }
  }
  if (ziel > s.anflugLaenge) {
    return verloren(s, 'Zu schnell — ihr schießt über die Landebahn hinaus.');
  }

  s.position = ziel;
  s.letzteRunde = { achseP, achseK, motorP, motorK, summe, tempo, fluglage: s.fluglage };
  s.hoehe -= 1000;

  if (s.hoehe > 0) {
    s.runde += 1;
    s.startspieler = s.startspieler === PILOT ? KOPILOT : PILOT;
    s.phase = 'briefing';
    return s;
  }
  return landung(s, summe);
}

export function landung(s, summe) {
  const fehler = [];
  if (s.position < s.anflugLaenge) fehler.push('Die Landebahn ist noch nicht erreicht');
  if (s.fluglage !== 0) fehler.push('Das Flugzeug liegt schräg');
  if (!alleFahrwerke(s)) fehler.push('Das Fahrwerk ist nicht komplett ausgefahren');
  if (!alleKlappen(s)) fehler.push('Die Landeklappen sind nicht komplett ausgefahren');
  if (!luftraumFrei(s)) fehler.push('Es sind noch fremde Maschinen im Anflug');
  if (summe > bremswert(s)) fehler.push(`Zu schnell zum Bremsen (${summe} statt höchstens ${bremswert(s)})`);

  if (fehler.length) {
    s.phase = 'verloren';
    s.grund = `${fehler.join('. ')}.`;
  } else {
    s.phase = 'gewonnen';
    s.grund = 'Sauber aufgesetzt. Willkommen am Boden.';
  }
  return s;
}

/* ------------------------------------------------------------- Auswertung */

/** Kurzer Statusüberblick für die Anzeige. */
export function lage(s) {
  return {
    flughafen: FLUGHAEFEN[s.flughafen],
    runde: s.runde,
    runden: s.runden,
    hoehe: s.hoehe,
    position: s.position,
    rest: s.anflugLaenge - s.position,
    fluglage: s.fluglage,
    bremswert: bremswert(s),
    tempoGrenzen: { blau: s.aero.blau, orange: s.aero.orange },
    offen: {
      fahrwerk: s.fahrwerk.filter((x) => !x).length,
      klappen: s.klappen.filter((x) => !x).length,
      flugzeuge: s.flugzeuge.length,
    },
  };
}
