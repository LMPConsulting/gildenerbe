// Dreikampf — Spiellogik ohne DOM. Alles serialisierbar.

import { WISSEN } from './wissen.js';
import { WAHRHEIT } from './wahrheit.js';
import { WAGNIS } from './wagnis.js';

export const STAPEL = { wissen: WISSEN, wahrheit: WAHRHEIT, wagnis: WAGNIS };

export const TYPEN = ['wissen', 'wahrheit', 'wagnis'];

export const TYP_INFO = {
  wissen:   { titel: 'Wissen',   unter: 'Beide antworten — Richtige punkten' },
  wahrheit: { titel: 'Wahrheit', unter: 'Beide antworten, der andere bewertet' },
  wagnis:   { titel: 'Wagnis',   unter: 'Einer macht es, der andere entscheidet' },
};

export const PUNKTE = {
  wissenRichtig: 10,     // richtige Antwort
  wissenAllein: 5,       // Bonus, wenn nur einer richtig lag
  wahrheitEhrlich: 20,   // ehrlich geantwortet, vom anderen bestätigt
  wagnisGemacht: 40,     // Mutprobe durchgezogen und anerkannt
  wagnisVerweigert: -15, // gekniffen
};

export const ORTE = {
  egal:  { titel: 'Egal',      unter: 'Alle Mutproben' },
  flug:  { titel: 'Unterwegs', unter: 'Flieger, Bahn, Flughafen' },
  stadt: { titel: 'In Wien',   unter: 'Draußen unter Leuten' },
  abend: { titel: 'Abends',    unter: 'Bar, Restaurant, spät' },
};

export const SAVE_VERSION = 1;

export function neuerStand(namen = ['Monty', 'Christina'], reise = 'Wien') {
  return {
    v: SAVE_VERSION,
    reise,
    spieler: namen.map((name) => ({ name })),
    punkte: namen.map(() => 0),
    dran: 0,
    runde: 1,
    ort: 'egal',
    benutzt: { wissen: [], wahrheit: [], wagnis: [] },
    verlauf: [],
    statistik: {
      wissenRichtig: [0, 0],
      wahrheitEhrlich: [0, 0],
      wagnisGemacht: [0, 0],
      wagnisVerweigert: [0, 0],
    },
    aktuell: null,
  };
}

const gegner = (i) => (i === 0 ? 1 : 0);

/* ------------------------------------------------------------ Karten ziehen */

function mischen(liste, rnd) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Karten des Stapels, die zum aktuellen Ort passen (nur für Wagnis relevant). */
export function passend(typ, ort) {
  if (typ !== 'wagnis' || ort === 'egal') return STAPEL[typ];
  return STAPEL.wagnis.filter((k) => k.ort === ort || k.ort === 'überall');
}

/**
 * Zieht eine ungenutzte Karte. Ist der Stapel durch, wird er zurückgesetzt —
 * lieber Wiederholung als „keine Karten mehr“ mitten im Urlaub.
 */
export function ziehen(stand, typ, rnd = Math.random) {
  const auswahl = passend(typ, stand.ort);
  let frei = auswahl.filter((k) => !stand.benutzt[typ].includes(k.id));
  if (frei.length === 0) {
    stand.benutzt[typ] = stand.benutzt[typ].filter(
      (id) => !auswahl.some((k) => k.id === id),
    );
    frei = auswahl;
  }
  const karte = frei[Math.floor(rnd() * frei.length)];
  stand.benutzt[typ].push(karte.id);
  return karte;
}

/** Wissenskarte für die Anzeige: Optionen gemischt, richtige Position gemerkt. */
export function aufbereiten(karte, rnd = Math.random) {
  const richtigeAntwort = karte.o[0];
  const optionen = mischen(karte.o, rnd);
  return {
    id: karte.id,
    cat: karte.cat,
    q: karte.q,
    optionen,
    richtig: optionen.indexOf(richtigeAntwort),
  };
}

/* ----------------------------------------------------------------- Runde */

export function neueRunde(stand, typ, rnd = Math.random) {
  const roh = ziehen(stand, typ, rnd);
  const ich = stand.dran;
  const du = gegner(ich);

  const runde = {
    typ,
    wer: ich,
    antworten: [null, null],
    urteile: [null, null],   // urteile[i] = Urteil ÜBER Spieler i
    gemacht: null,
    i: 0,
  };

  if (typ === 'wissen') {
    runde.karte = aufbereiten(roh, rnd);
    runde.schritte = [
      { art: 'antwort', p: ich },
      { art: 'antwort', p: du },
      { art: 'auflösung' },
    ];
  } else if (typ === 'wahrheit') {
    runde.karte = { id: roh.id, q: roh.q, tiefe: roh.tiefe, thema: roh.thema };
    runde.schritte = [
      { art: 'reden' },
      { art: 'urteil', p: ich, ueber: du },
      { art: 'urteil', p: du, ueber: ich },
      { art: 'auflösung' },
    ];
  } else {
    runde.karte = { id: roh.id, q: roh.q, ort: roh.ort };
    runde.schritte = [
      { art: 'ausführen', p: ich },
      { art: 'urteil', p: du, ueber: ich },
      { art: 'auflösung' },
    ];
  }

  stand.aktuell = runde;
  return stand;
}

export function schritt(stand) {
  const r = stand.aktuell;
  return r ? r.schritte[r.i] : null;
}

/** Antwort auf eine Wissensfrage abgeben. */
export function antworten(stand, optionIndex) {
  const r = stand.aktuell;
  const s = schritt(stand);
  if (!r || !s || s.art !== 'antwort') return stand;
  r.antworten[s.p] = optionIndex;
  r.i += 1;
  return stand;
}

/** Urteil abgeben: bei Wahrheit „ehrlich?“, bei Wagnis „gemacht?“. */
export function bewerten(stand, ja) {
  const r = stand.aktuell;
  const s = schritt(stand);
  if (!r || !s || s.art !== 'urteil') return stand;
  if (r.typ === 'wagnis') r.gemacht = !!ja;
  else r.urteile[s.ueber] = !!ja;
  r.i += 1;
  return stand;
}

/** Schritte ohne Eingabe („beide antworten jetzt mündlich“) abhaken. */
export function weiter(stand) {
  const r = stand.aktuell;
  const s = schritt(stand);
  if (!r || !s) return stand;
  if (s.art === 'reden' || s.art === 'ausführen') r.i += 1;
  return stand;
}

/** Punkte der laufenden Runde — reine Rechnung, ändert nichts. */
export function ergebnis(runde) {
  const deltas = [0, 0];
  const zeilen = [];

  if (runde.typ === 'wissen') {
    const richtig = [0, 1].map((i) => runde.antworten[i] === runde.karte.richtig);
    const allein = richtig[0] !== richtig[1];
    for (const i of [0, 1]) {
      if (!richtig[i]) { zeilen.push({ p: i, text: 'daneben', punkte: 0 }); continue; }
      const p = PUNKTE.wissenRichtig + (allein ? PUNKTE.wissenAllein : 0);
      deltas[i] = p;
      zeilen.push({ p: i, text: allein ? 'als Einzige richtig' : 'richtig', punkte: p });
    }
  } else if (runde.typ === 'wahrheit') {
    for (const i of [0, 1]) {
      const ehrlich = runde.urteile[i] === true;
      const p = ehrlich ? PUNKTE.wahrheitEhrlich : 0;
      deltas[i] = p;
      zeilen.push({ p: i, text: ehrlich ? 'ehrlich geantwortet' : 'ausgewichen', punkte: p });
    }
  } else {
    const p = runde.gemacht ? PUNKTE.wagnisGemacht : PUNKTE.wagnisVerweigert;
    deltas[runde.wer] = p;
    zeilen.push({
      p: runde.wer,
      text: runde.gemacht ? 'Mutprobe bestanden' : 'gekniffen',
      punkte: p,
    });
  }

  return { deltas, zeilen };
}

export function rundeFertig(stand) {
  const s = schritt(stand);
  return !!s && s.art === 'auflösung';
}

/** Punkte gutschreiben, Runde in den Verlauf legen, Zug wechseln. */
export function rundeAbschliessen(stand) {
  const r = stand.aktuell;
  if (!r) return stand;
  const { deltas, zeilen } = ergebnis(r);

  for (const i of [0, 1]) stand.punkte[i] += deltas[i];

  const st = stand.statistik;
  if (r.typ === 'wissen') {
    for (const i of [0, 1]) if (r.antworten[i] === r.karte.richtig) st.wissenRichtig[i] += 1;
  } else if (r.typ === 'wahrheit') {
    for (const i of [0, 1]) if (r.urteile[i] === true) st.wahrheitEhrlich[i] += 1;
  } else if (r.gemacht) {
    st.wagnisGemacht[r.wer] += 1;
  } else {
    st.wagnisVerweigert[r.wer] += 1;
  }

  stand.verlauf.unshift({
    runde: stand.runde,
    typ: r.typ,
    wer: r.wer,
    frage: r.karte.q,
    deltas,
    zeilen,
  });
  if (stand.verlauf.length > 200) stand.verlauf.length = 200;

  stand.runde += 1;
  stand.dran = gegner(stand.dran);
  stand.aktuell = null;
  return stand;
}

/** Laufende Runde verwerfen, ohne Punkte und ohne Zugwechsel. */
export function rundeAbbrechen(stand) {
  stand.aktuell = null;
  return stand;
}

/* -------------------------------------------------------------- Auswertung */

export function fuehrung(stand) {
  const [a, b] = stand.punkte;
  if (a === b) return { gleich: true, vorne: null, abstand: 0 };
  const vorne = a > b ? 0 : 1;
  return { gleich: false, vorne, abstand: Math.abs(a - b) };
}

export function stapelRest(stand, typ) {
  const auswahl = passend(typ, stand.ort);
  const offen = auswahl.filter((k) => !stand.benutzt[typ].includes(k.id)).length;
  return { offen, gesamt: auswahl.length };
}

/* ------------------------------------------------ Sichern & Wiederherstellen */

/** Punktestand als Text, der sich kopieren und woanders einfügen lässt. */
export function alsCode(stand) {
  const json = JSON.stringify(stand);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function ausCode(code) {
  try {
    const bin = atob(String(code).trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const stand = JSON.parse(new TextDecoder().decode(bytes));
    if (stand && stand.v === SAVE_VERSION && Array.isArray(stand.punkte)) return stand;
  } catch { /* unbrauchbarer Code */ }
  return null;
}
