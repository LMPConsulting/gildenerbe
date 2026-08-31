// Wiener Runde — Spiellogik ohne DOM. Alles serialisierbar.
//
// Ablauf eines klassischen Straßenkaufspiels für zwei: würfeln, ziehen,
// kaufen oder Miete zahlen, bauen, handeln. Gewonnen hat, wer die Gegenseite
// zahlungsunfähig macht — oder, in der kurzen Partie, wer nach der letzten
// Runde mehr besitzt.
//
// Der Zug läuft in Phasen, damit die Oberfläche immer weiß, was gerade dran
// ist: 'wuerfeln' → (nach dem Ziehen) 'kaufen' oder 'handeln' → 'ende'.

import {
  FELDER, FELDER_GESAMT, GRUPPENFELDER, LOS_GELD, STARTGELD,
  GEFAENGNIS_FELD, KAUTION, LINIENMIETE, WERKFAKTOR, EREIGNIS, KAFFEEHAUS, KAUFBAR,
} from './brett.js';

export const SAVE_VERSION = 1;
export const HAFTVERSUCHE = 3;

export const VORGABE = {
  // Zwei Messungen über je 400 Selbstspiele haben die Zahl bestimmt:
  //
  // 1. Bis zur Pleite dauert eine Partie im Schnitt 149 Runden, und jede fünfte
  //    war nach 300 Runden noch offen. Nichts fürs Handy im Urlaub.
  // 2. In 30 Runden werden zwar 20 Felder verkauft, aber nur 3,3 Häuser gebaut.
  //    Bei 40 Runden sind es 3,7 volle Farbgruppen und 6,6 Häuser — erst dann
  //    kommt der Teil des Spiels vor, um den es eigentlich geht.
  //
  // (Beide Zahlen mit einem Testspieler, der auch handelt. Ohne Handel bleiben
  // die Gruppen fast immer unvollständig — Handeln ist keine Zugabe, sondern
  // die Voraussetzung dafür, dass gebaut wird.)
  runden: 40,       // 0 = bis zur Pleite, sonst so viele Runden
  schnellstart: 0,  // so viele zufällige Orte bekommt jede Seite vorab
  versteigerung: false,  // wer nicht kauft, dem bietet die Gegenseite mit
};

export const MODI = [
  {
    id: 'klassisch',
    titel: 'Klassisch',
    zeile: '40 Runden, alles wird erlaufen',
    regeln: {},
  },
  {
    id: 'schnellstart',
    titel: 'Schnellstart',
    zeile: 'Jede Seite beginnt mit drei Orten — Handel und Bau kommen sofort in Gang',
    regeln: { schnellstart: 3 },
  },
  {
    id: 'versteigerung',
    titel: 'Versteigerung',
    zeile: 'Wer nicht kauft, dem greift die Gegenseite den Ort weg',
    regeln: { versteigerung: true },
  },
  {
    id: 'pleite',
    titel: 'Bis zur Pleite',
    zeile: 'Kein Rundenlimit — es endet, wenn einer nicht mehr zahlen kann',
    regeln: { runden: 0 },
  },
];

/** Regel lesen, mit Rückfall auf die Vorgabe — alte Spielstände bleiben gültig. */
export const regel = (stand, name) => {
  const wert = stand && stand.regeln ? stand.regeln[name] : undefined;
  return wert === undefined ? VORGABE[name] : wert;
};

const anderer = (i) => (i === 0 ? 1 : 0);
const karteIds = (liste) => liste.map((k) => k.id);
const ALLE_KARTEN = [...EREIGNIS, ...KAFFEEHAUS];

function mischen(liste, rnd) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function neuerStand(namen = ['Monty', 'Christina'], regeln = {}, rnd = Math.random) {
  return {
    v: SAVE_VERSION,
    spieler: namen.map((name) => ({ name })),
    geld: [STARTGELD, STARTGELD],
    ort: [0, 0],
    haft: [0, 0],              // verbleibende Versuche, 0 = frei
    freikarten: [0, 0],
    besitz: {},                // Feld -> Spielerindex
    haeuser: {},               // Feld -> 0..5 (5 = Hotel)
    hypothek: {},              // Feld -> true
    stapel: {
      ereignis: mischen(karteIds(EREIGNIS), rnd),
      kaffeehaus: mischen(karteIds(KAFFEEHAUS), rnd),
    },
    dran: 0,
    phase: 'wuerfeln',
    wurf: null,                // { wuerfel: [a, b], summe, pasch }
    paschFolge: 0,
    letzteKarte: null,
    handel: null,
    runde: 1,
    siege: [0, 0],
    partie: 1,
    regeln: { ...VORGABE, ...regeln },
    angebot: null,             // { feld, an } — Versteigerung an die Gegenseite
    verlauf: [],
    fertig: null,
  };
}

// `fertig` ist der Index des Siegers und darf 0 sein — nie auf Wahrheit prüfen.
export const vorbei = (stand) => stand.fertig !== null;
export const phase = (stand) => (vorbei(stand) ? 'ende' : stand.phase);

/* ---------------------------------------------------------------- Abfragen */

export const besitzer = (stand, feld) =>
  (Object.prototype.hasOwnProperty.call(stand.besitz, feld) ? stand.besitz[feld] : null);

export const haeuserAuf = (stand, feld) => stand.haeuser[feld] || 0;
export const beliehen = (stand, feld) => !!stand.hypothek[feld];

/** Gehören einem Spieler alle Orte einer Farbgruppe? */
export function gruppeKomplett(stand, gruppe, spieler) {
  const felder = GRUPPENFELDER[gruppe] || [];
  return felder.length > 0 && felder.every((f) => besitzer(stand, f) === spieler);
}

const anzahlArt = (stand, art, spieler) =>
  FELDER.filter((f) => f.art === art && besitzer(stand, f.feld) === spieler).length;

/** Was kostet es, hier zu landen? `wurf` zählt nur bei den Werken. */
export function miete(stand, feld, wurf = 7) {
  const wem = besitzer(stand, feld);
  if (wem === null || beliehen(stand, feld)) return 0;
  const f = FELDER[feld];

  if (f.art === 'linie') return LINIENMIETE[anzahlArt(stand, 'linie', wem)] || 0;
  if (f.art === 'werk') return wurf * (WERKFAKTOR[anzahlArt(stand, 'werk', wem)] || 0);
  if (f.art !== 'ort') return 0;

  const h = haeuserAuf(stand, feld);
  if (h > 0) return f.miete[h];
  return gruppeKomplett(stand, f.gruppe, wem) ? f.miete[0] * 2 : f.miete[0];
}

/** Geld plus halber Grundwert plus halbe Bauten — so viel ist einer wert. */
export function vermoegen(stand, spieler) {
  let summe = stand.geld[spieler];
  for (const f of FELDER) {
    if (besitzer(stand, f.feld) !== spieler) continue;
    summe += beliehen(stand, f.feld) ? Math.floor(f.preis / 2) : f.preis;
    summe += haeuserAuf(stand, f.feld) * Math.floor((f.haus || 0) / 2);
  }
  return summe;
}

/** Schulden, aus denen sich niemand mehr herauswinden kann. */
export function pleite(stand, spieler) {
  if (stand.geld[spieler] >= 0) return false;
  const rettung = FELDER.reduce((n, f) => {
    if (besitzer(stand, f.feld) !== spieler) return n;
    const haus = haeuserAuf(stand, f.feld) * Math.floor((f.haus || 0) / 2);
    const grund = beliehen(stand, f.feld) ? 0 : Math.floor(f.preis / 2);
    return n + haus + grund;
  }, 0);
  return stand.geld[spieler] + rettung < 0;
}

function pruefePleite(stand, spieler) {
  if (!pleite(stand, spieler)) return false;
  stand.fertig = anderer(spieler);
  stand.siege[stand.fertig] += 1;
  stand.phase = 'ende';
  return true;
}

/** Geld bewegen — negativ heißt zahlen. */
function buchen(stand, spieler, betrag, an = null) {
  stand.geld[spieler] += betrag;
  if (an !== null) stand.geld[an] -= betrag;
  if (betrag < 0) pruefePleite(stand, spieler);
  else if (an !== null) pruefePleite(stand, an);
}

/* --------------------------------------------------------------- Würfeln */

export function wuerfeln(stand, rnd = Math.random) {
  if (vorbei(stand)) throw new Error('Die Partie ist vorbei.');
  if (stand.phase !== 'wuerfeln') throw new Error('Jetzt wird nicht gewürfelt.');
  const a = 1 + Math.floor(rnd() * 6);
  const b = 1 + Math.floor(rnd() * 6);
  stand.wurf = { wuerfel: [a, b], summe: a + b, pasch: a === b };
  stand.phase = 'ziehen';
  return stand.wurf;
}

/** Setzt die Figur weiter und wertet das Feld aus. */
export function ziehen(stand) {
  if (stand.phase !== 'ziehen' || !stand.wurf) return null;
  const wer = stand.dran;

  if (stand.wurf.pasch) {
    stand.paschFolge += 1;
    if (stand.paschFolge >= 3) {
      insKommissariat(stand, wer);
      stand.phase = 'ende';
      return { art: 'haft' };
    }
  } else {
    stand.paschFolge = 0;
  }

  const ziel = (stand.ort[wer] + stand.wurf.summe) % FELDER_GESAMT;
  if (ziel < stand.ort[wer]) buchen(stand, wer, LOS_GELD);
  stand.ort[wer] = ziel;
  return feldAuswerten(stand, stand.wurf.summe);
}

function insKommissariat(stand, spieler) {
  stand.ort[spieler] = GEFAENGNIS_FELD;
  stand.haft[spieler] = HAFTVERSUCHE;
  stand.paschFolge = 0;
}

/** Was passiert auf dem Feld, auf dem man steht. */
function feldAuswerten(stand, wurf) {
  const wer = stand.dran;
  const f = FELDER[stand.ort[wer]];
  stand.phase = 'ende';

  if (f.art === 'los' || f.art === 'besuch' || f.art === 'parken') return { art: f.art };

  if (f.art === 'inHaft') {
    insKommissariat(stand, wer);
    return { art: 'haft' };
  }

  if (f.art === 'steuer') {
    buchen(stand, wer, -f.betrag);
    return { art: 'steuer', betrag: f.betrag };
  }

  if (f.art === 'ereignis' || f.art === 'kaffeehaus') {
    const karte = karteZiehen(stand, f.art === 'ereignis' ? 'ereignis' : 'kaffeehaus');
    karteAusfuehren(stand, karte, wurf);
    return { art: 'karte', karte };
  }

  const wem = besitzer(stand, f.feld);
  if (wem === null) {
    if (stand.geld[wer] >= f.preis) stand.phase = 'kaufen';
    return { art: 'frei', feld: f.feld };
  }
  if (wem === wer) return { art: 'eigen', feld: f.feld };

  const betrag = miete(stand, f.feld, wurf);
  if (betrag > 0) buchen(stand, wer, -betrag, wem);
  return { art: 'miete', feld: f.feld, betrag };
}

/* --------------------------------------------------------------- Kaufen */

export function kaufen(stand) {
  if (stand.phase !== 'kaufen') return false;
  const wer = stand.dran;
  const f = FELDER[stand.ort[wer]];
  if (besitzer(stand, f.feld) !== null) return false;
  if (stand.geld[wer] < f.preis) return false;
  stand.geld[wer] -= f.preis;
  stand.besitz[f.feld] = wer;
  stand.phase = 'ende';
  return true;
}

export function kaufVerzichten(stand) {
  if (stand.phase !== 'kaufen') return false;
  const f = FELDER[stand.ort[stand.dran]];
  const gegner = anderer(stand.dran);
  // Zu zweit ist eine echte Auktion sinnlos — es gäbe nur ein Gebot. Die
  // Fassung „Versteigerung" bietet der Gegenseite den Ort deshalb schlicht zum
  // Listenpreis an: nimmt sie ihn, ist er weg.
  if (regel(stand, 'versteigerung') && besitzer(stand, f.feld) === null
    && stand.geld[gegner] >= f.preis) {
    // Entscheiden muss die Gegenseite — also wandert `dran` für diesen einen
    // Schritt hinüber. Sonst hinge auf dem zweiten Handy der Knopf beim
    // Falschen, und in der Kopfzeile stünde der falsche Name.
    stand.angebot = { feld: f.feld, an: gegner, zurueck: stand.dran };
    stand.dran = gegner;
    stand.phase = 'angebot';
    return true;
  }
  stand.phase = 'ende';
  return true;
}

/** Die Gegenseite greift zu, nachdem der Läufer verzichtet hat. */
export function angebotAnnehmen(stand) {
  if (stand.phase !== 'angebot' || !stand.angebot) return false;
  const { feld, an } = stand.angebot;
  const f = FELDER[feld];
  if (besitzer(stand, feld) !== null || stand.geld[an] < f.preis) return false;
  stand.geld[an] -= f.preis;
  stand.besitz[feld] = an;
  stand.dran = stand.angebot.zurueck;
  stand.angebot = null;
  stand.phase = 'ende';
  return true;
}

export function angebotAblehnen(stand) {
  if (stand.phase !== 'angebot') return false;
  stand.dran = stand.angebot.zurueck;
  stand.angebot = null;
  stand.phase = 'ende';
  return true;
}

/**
 * Verteilt zu Beginn ein paar Orte. Grund: gemessen bleiben die Farbgruppen
 * sonst fast immer unvollständig, und der Bauteil des Spiels kommt gar nicht
 * vor. Wer schon drei Orte hat, hat auch etwas zu handeln.
 */
export function schnellstartVerteilen(stand, rnd = Math.random) {
  const anzahl = regel(stand, 'schnellstart');
  if (!anzahl) return stand;
  const frei = mischen(KAUFBAR.filter((f) => besitzer(stand, f) === null), rnd);
  for (let i = 0; i < anzahl * 2 && i < frei.length; i++) {
    stand.besitz[frei[i]] = i % 2;      // abwechselnd, damit beide gleich viele bekommen
  }
  return stand;
}

/* ---------------------------------------------------------------- Bauen */

export function bauen(stand, feld) {
  const f = FELDER[feld];
  if (!f || f.art !== 'ort') return false;
  const wer = besitzer(stand, feld);
  if (wer === null || wer !== stand.dran) return false;
  if (!gruppeKomplett(stand, f.gruppe, wer)) return false;
  if (GRUPPENFELDER[f.gruppe].some((g) => beliehen(stand, g))) return false;
  const jetzt = haeuserAuf(stand, feld);
  if (jetzt >= 5) return false;
  // Gleichmäßig bauen: kein Feld darf mehr als eines vorausbauen.
  const kleinste = Math.min(...GRUPPENFELDER[f.gruppe].map((g) => haeuserAuf(stand, g)));
  if (jetzt > kleinste) return false;
  if (stand.geld[wer] < f.haus) return false;
  stand.geld[wer] -= f.haus;
  stand.haeuser[feld] = jetzt + 1;
  return true;
}

export function abreissen(stand, feld) {
  const f = FELDER[feld];
  if (!f || f.art !== 'ort') return false;
  const wer = besitzer(stand, feld);
  if (wer === null || wer !== stand.dran) return false;   // nur eigener Grund
  const jetzt = haeuserAuf(stand, feld);
  if (jetzt <= 0) return false;
  const groesste = Math.max(...GRUPPENFELDER[f.gruppe].map((g) => haeuserAuf(stand, g)));
  if (jetzt < groesste) return false;             // auch beim Abreißen gleichmäßig
  stand.haeuser[feld] = jetzt - 1;
  if (!stand.haeuser[feld]) delete stand.haeuser[feld];
  stand.geld[wer] += Math.floor(f.haus / 2);
  return true;
}

/* -------------------------------------------------------------- Hypothek */

export function beleihen(stand, feld) {
  const f = FELDER[feld];
  if (!f || !f.preis) return false;
  const wer = besitzer(stand, feld);
  if (wer === null || wer !== stand.dran) return false;   // nur eigener Grund
  if (beliehen(stand, feld)) return false;
  if (haeuserAuf(stand, feld) > 0) return false;
  stand.hypothek[feld] = true;
  stand.geld[wer] += Math.floor(f.preis / 2);
  return true;
}

export function ausloesen(stand, feld) {
  const f = FELDER[feld];
  if (!f || !beliehen(stand, feld)) return false;
  const wer = besitzer(stand, feld);
  if (wer === null || wer !== stand.dran) return false;   // nur eigener Grund
  const kosten = Math.ceil(Math.floor(f.preis / 2) * 1.1);
  if (stand.geld[wer] < kosten) return false;
  stand.geld[wer] -= kosten;
  delete stand.hypothek[feld];
  return true;
}

/* ----------------------------------------------------------- Gefängnis */

export function kautionZahlen(stand) {
  const wer = stand.dran;
  if (stand.haft[wer] <= 0) return false;
  if (stand.geld[wer] < KAUTION) return false;
  stand.geld[wer] -= KAUTION;
  stand.haft[wer] = 0;
  return true;
}

export function freikarteNutzen(stand) {
  const wer = stand.dran;
  if (stand.haft[wer] <= 0 || stand.freikarten[wer] <= 0) return false;
  stand.freikarten[wer] -= 1;
  stand.haft[wer] = 0;
  return true;
}

/**
 * Im Kommissariat wird auf einen Pasch gewürfelt. Beim dritten Fehlversuch
 * wird die Kaution fällig und es geht trotzdem weiter.
 */
export function wuerfelnImKnast(stand, rnd = Math.random) {
  const wer = stand.dran;
  if (stand.haft[wer] <= 0) return null;
  const a = 1 + Math.floor(rnd() * 6);
  const b = 1 + Math.floor(rnd() * 6);
  stand.wurf = { wuerfel: [a, b], summe: a + b, pasch: a === b };

  if (a === b) {
    stand.haft[wer] = 0;
    stand.phase = 'ziehen';
    ziehenAusHaft(stand);
    return { frei: true, pasch: true, gezahlt: 0, wuerfel: [a, b] };
  }

  stand.haft[wer] -= 1;
  if (stand.haft[wer] > 0) return { frei: false, pasch: false, gezahlt: 0, wuerfel: [a, b] };

  const gezahlt = Math.min(KAUTION, Math.max(0, stand.geld[wer]));
  buchen(stand, wer, -KAUTION);
  if (vorbei(stand)) return { frei: true, pasch: false, gezahlt, wuerfel: [a, b] };
  stand.phase = 'ziehen';
  ziehenAusHaft(stand);
  return { frei: true, pasch: false, gezahlt: KAUTION, wuerfel: [a, b] };
}

/** Nach der Freilassung wird sofort gezogen — aber ohne Pasch-Bonus. */
function ziehenAusHaft(stand) {
  const wer = stand.dran;
  const ziel = (stand.ort[wer] + stand.wurf.summe) % FELDER_GESAMT;
  if (ziel < stand.ort[wer]) buchen(stand, wer, LOS_GELD);
  stand.ort[wer] = ziel;
  stand.paschFolge = 0;
  feldAuswerten(stand, stand.wurf.summe);
}

/* ----------------------------------------------------------------- Karten */

export function karteZiehen(stand, welcher) {
  const stapel = stand.stapel[welcher];
  const id = stapel.shift();
  stapel.push(id);                        // unten wieder einlegen
  const karte = ALLE_KARTEN.find((k) => k.id === id);
  stand.letzteKarte = karte;
  return karte;
}

export function karteAusfuehren(stand, karte, wurf = 7) {
  const wer = stand.dran;
  if (!karte) return null;

  if (karte.art === 'geld') { buchen(stand, wer, karte.betrag); return karte; }
  if (karte.art === 'vomAnderen') { buchen(stand, wer, karte.betrag, anderer(wer)); return karte; }
  if (karte.art === 'freikarte') { stand.freikarten[wer] += 1; return karte; }
  if (karte.art === 'haft') { insKommissariat(stand, wer); stand.phase = 'ende'; return karte; }

  if (karte.art === 'gehe') {
    if (karte.feld <= stand.ort[wer]) buchen(stand, wer, LOS_GELD);
    stand.ort[wer] = karte.feld;
    feldAuswerten(stand, wurf);
    return karte;
  }

  if (karte.art === 'zurueck') {
    stand.ort[wer] = (stand.ort[wer] - karte.schritte + FELDER_GESAMT) % FELDER_GESAMT;
    feldAuswerten(stand, wurf);
    return karte;
  }

  if (karte.art === 'naechsteLinie') {
    const linien = FELDER.filter((f) => f.art === 'linie').map((f) => f.feld);
    const naechste = linien.find((f) => f > stand.ort[wer]);
    const ziel = naechste === undefined ? linien[0] : naechste;
    if (ziel <= stand.ort[wer]) buchen(stand, wer, LOS_GELD);
    stand.ort[wer] = ziel;
    feldAuswerten(stand, wurf);
    return karte;
  }

  if (karte.art === 'bauabgabe') {
    let summe = 0;
    for (const f of FELDER) {
      if (besitzer(stand, f.feld) !== wer) continue;
      const h = haeuserAuf(stand, f.feld);
      summe += h === 5 ? karte.proHotel : h * karte.proHaus;
    }
    buchen(stand, wer, -summe);
    return karte;
  }

  return karte;
}

/* ----------------------------------------------------------------- Handel */

export function handelAnbieten(stand, { von, feld, preis }) {
  if (vorbei(stand)) return false;
  if (besitzer(stand, feld) !== von) return false;
  if (haeuserAuf(stand, feld) > 0) return false;
  const f = FELDER[feld];
  if (f.art === 'ort' && GRUPPENFELDER[f.gruppe].some((g) => haeuserAuf(stand, g) > 0)) return false;
  const p = Math.max(0, Math.round(preis));
  stand.handel = { von, feld, preis: p };
  return true;
}

export function handelAnnehmen(stand) {
  const h = stand.handel;
  if (!h) return false;
  const an = anderer(h.von);
  if (stand.geld[an] < h.preis) return false;
  stand.geld[an] -= h.preis;
  stand.geld[h.von] += h.preis;
  stand.besitz[h.feld] = an;
  stand.handel = null;
  return true;
}

export function handelAblehnen(stand) {
  stand.handel = null;
  return true;
}

/* ------------------------------------------------------------- Zug beenden */

export function zugBeenden(stand) {
  if (vorbei(stand)) return stand;
  const wer = stand.dran;
  const nochmal = stand.wurf && stand.wurf.pasch && stand.haft[wer] === 0 && stand.paschFolge > 0;

  stand.handel = null;
  stand.wurf = null;
  stand.phase = 'wuerfeln';

  if (nochmal) return stand;                    // Pasch: derselbe bleibt dran

  stand.paschFolge = 0;
  stand.dran = anderer(wer);
  if (stand.dran === 0) {
    stand.runde += 1;
    const grenze = stand.regeln.runden;
    if (grenze > 0 && stand.runde > grenze) kurzeParteiEnde(stand);
  }
  return stand;
}

function kurzeParteiEnde(stand) {
  const a = vermoegen(stand, 0);
  const b = vermoegen(stand, 1);
  stand.fertig = a === b ? 0 : (a > b ? 0 : 1);
  stand.siege[stand.fertig] += 1;
  stand.phase = 'ende';
}

export function partieNeu(stand, rnd = Math.random) {
  const frisch = neuerStand(stand.spieler.map((s) => s.name), stand.regeln, rnd);
  frisch.siege = stand.siege.slice();
  frisch.partie = stand.partie + 1;
  frisch.dran = stand.fertig === null ? stand.dran : anderer(stand.fertig);
  return frisch;
}

/* --------------------------------------------------- Punktestand mitnehmen */

export function alsCode(stand) {
  const kern = { v: SAVE_VERSION, n: stand.spieler.map((s) => s.name), s: stand.siege, p: stand.partie };
  return `WR1-${btoa(unescape(encodeURIComponent(JSON.stringify(kern))))}`;
}

export function ausCode(code) {
  const roh = String(code || '').trim();
  if (!roh.startsWith('WR1-')) throw new Error('Das ist kein Wiener-Runde-Punktestand.');
  let kern;
  try {
    kern = JSON.parse(decodeURIComponent(escape(atob(roh.slice(4)))));
  } catch {
    throw new Error('Der Code ist unvollständig oder verrutscht.');
  }
  if (!kern || !Array.isArray(kern.s) || kern.s.length !== 2) {
    throw new Error('Der Code passt nicht zu diesem Spiel.');
  }
  const stand = neuerStand(Array.isArray(kern.n) && kern.n.length === 2 ? kern.n : undefined);
  stand.siege = kern.s.map((n) => (Number.isFinite(n) ? n : 0));
  stand.partie = Number.isFinite(kern.p) ? kern.p : 1;
  return stand;
}
