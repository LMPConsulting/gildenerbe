// Alle Zahlen des Spiels an einem Ort. Maße in Metern, Zeiten in Sekunden,
// Geld in Dollar wie im Vorbild. Forschung, Nadeln, Produkte und Aufträge
// folgen der 2D-Fassung (und damit dem Vorbild); was physisch ist – Wege,
// Werkzeuge, Maschinen mit Anschlüssen, Strommasten – steht hier neu.
//
// Vorbild ist Find The Needle: rund sechs Millionen Halme, Verkauf zu
// 0,0222 $ pro Halm, ein Forschungsbaum mit zehn Ästen, sechs Nadeln pro Ladung.
/* ------------------------------------------------------------ Welt */

export const WELT = {
  // Innenmaße der Halle
  xMin: -18, xMax: 18, zMin: -14, zMax: 14,
  wandHoehe: 5.0,
  bandHoehe: 0.25, // dunkler Abschlussbalken statt Wellblech
  pfostenAbstand: 4,
  boegen: [-14, -7, 0, 7, 14], // x-Lage der Stahlbögen
  bogenHoehe: 11,
  // Tor in der Rückwand (z = zMin)
  torX: -7, torBreite: 3.4, torHoehe: 3.1,
  // Verkaufsstand an der linken Wand, Blick in die Halle (+x)
  standX: -16.4, standZ: -8.5, standBreite: 2.8, standTiefe: 1.6,
  // Haufen
  haufenX: 2.5, haufenZ: 0.5,
  // Start des Spielers
  startX: -11.5, startZ: -3.5, startBlick: -Math.PI / 2 + 0.25,
  // feste Stationen
  werkzeugX: -8.5, werkzeugZ: 12.6, // Werkzeugstand an der Vorderwand, Blick in die Halle (−z)
  bankX: -13.2, bankZ: 5.2, // Werkbank mit den Startwerkzeugen
  lieferX: 11, lieferZ: -12.9, // Lieferschalter an der Rückwand
  anschlussX: -17.75, anschlussZ: 2.5, // Hausanschluss an der linken Wand
  tafelX: -3.8, tafelZ: -13.2, // Auftragstafel neben dem Tor
};

/** Größe jeder Ladung: Halme, Radius, Höhe. Spätere Ladungen werden vor allem höher. */
export const LADUNGEN_3D = [
  { halme: 6_000_000, radius: 7.2, hoehe: 4.6 },
  { halme: 10_000_000, radius: 8.0, hoehe: 6.8 },
  { halme: 16_000_000, radius: 8.6, hoehe: 9.0 },
  { halme: 26_000_000, radius: 9.2, hoehe: 12.5 },
];

/* ------------------------------------------------------------ Spieler */

export const SPIELER = {
  augenHoehe: 1.66, // wie im Vorbild (EYE)
  duckTiefe: 0.63, // Ducken senkt den Blick auf gut einen Meter
  duckTempo: 0.5, // geduckt halb so schnell
  radius: 0.32,
  gehen: 4.2, // m/s
  rennen: 7.0,
  sprung: 4.6, // m/s nach oben
  schwerkraft: 14,
  stufe: 0.65, // so hoch kommt man ohne Springen (über Bänder hinweg, wie am Handy nötig)
  reichweite: 3.2, // bis hierhin wirkt ein Werkzeug
  blickEmpfindlichkeit: 0.0042, // rad je Pixel Wischen
};

/* ------------------------------------------------------------ Grundwerte */

/** Grundwerte, bevor irgendein Upgrade greift. Namen wie in der 2D-Fassung. */
export const GRUND = {
  griff: 6,            // Halme pro Stich mit dem Spaten
  hand: 0.34,          // Faktor der bloßen Hand auf den Griff
  sandschaufel: 0.5,   // Faktor der Kinderschaufel (kostet keine Puste)
  heugabel: 2,         // Faktor der Heugabel
  krit: 0,             // Chance auf einen Glücksstich
  kritFaktor: 5,
  tasche: 30,          // Halme, die man in den Armen trägt (Eimer und Karre erhöhen)
  laufzeit: 1,         // Kehrwert des Tempos: kleiner = schneller
  ausdauer: 25,        // volle Puste
  ausdauerRegen: 3,    // pro Sekunde, wenn man nicht sticht oder rennt
  ausdauerKosten: 1,   // pro Stich
  rennKosten: 1.2,     // pro Sekunde Rennen (am Handy rennt man schnell aus Versehen)
  erschoepft: 0.3,     // Anteil des Griffs ohne Puste
  verschuetten: 0.12,  // so viel fällt bei jedem Stich daneben
  besen: 60,           // Halme pro Besenstrich
  autotipp: 0,         // zusätzliche Stiche pro Sekunde beim Halten
  saugerRate: 40,      // Halme pro Sekunde
  saugerHitze: 6,      // Sekunden bis zu heiß
  drohnenMax: 0,
  drohnenRate: 4,      // Halme pro Sekunde je Drohne
  detektor: 3.2,       // Reichweite in Metern
  radarCD: 60,         // Sekunden zwischen zwei Radarpings
  preisRoh: 0.0222,    // was der Stand pro Halm zahlt
  preisAlle: 1,
  preisProdukt: 1,
  auftragLohn: 1,
  armTempo: 1,
  rechenTempo: 1,
  band: 1.2,           // Bandtempo in m/s
  scanDeckung: 1,
  stromMul: 1,
  verbrauch: 1,
  generatorMul: 1,
  brennstoff: 1,
  wasserMul: 1,
  verarbeitung: 1,
  ausbeute: 1,
  maschinenKosten: 1,
  maschinenTempo: 1,
  spannweite: 7,       // Meter zwischen zwei Masten
  abspannung: 3,       // Meter von Mast zu Maschine
  hallenFelder: 0,     // zusätzliche Felder à 4 m
  offlineStunden: 2,
  offlineEff: 0.5,
  // Maschinengeschwindigkeiten (Faktoren, von Upgrades gehoben)
  silo: 1, presse: 1, pellet: 1, wickler: 1, pulper: 1, papier: 1, brikett: 1,
};

/** Grundstrom aus dem Hausanschluss an der Wand, in kW. */
export const HAUSANSCHLUSS_KW = 5;

/* ------------------------------------------------------------ Werkzeuge */

// Die Werkzeugleiste wie im Vorbild: 1 Hand, dann gekaufte Werkzeuge; B Bauen, Q Fallenlassen.
// faktor: auf den Griff; puste: kostet der Stich Ausdauer; frei: Forschung, die es freischaltet.
export const WERKZEUGE = [
  { id: 'hand', name: 'Hand', kurz: 'Hand', frei: null, faktor: 'hand', puste: true, laenge: 0,
    text: 'Zupft Halme aus dem Haufen, hebt Nadeln und Gegenstände auf.' },
  { id: 'sandschaufel', name: 'Kinderschaufel', kurz: 'Schaufel', frei: null, faktor: 'sandschaufel', puste: false, laenge: 0.65,
    text: 'Gelb, aus Plastik, winzig. Kostet keine Puste und hebt Nadeln sanft heraus.' },
  { id: 'spaten', name: 'Spaten', kurz: 'Spaten', frei: 'spaten', faktor: 1, puste: true, laenge: 1.1,
    text: 'Sticht doppelt so viel wie die Kinderschaufel.' },
  { id: 'heugabel', name: 'Heugabel', kurz: 'Gabel', frei: 'heugabel', faktor: 'heugabel', puste: true, laenge: 1.35,
    text: 'Sechs Zinken. Doppelt so viel wie der Spaten.' },
  { id: 'besen', name: 'Besen', kurz: 'Besen', frei: 'besen', faktor: 0, puste: false, laenge: 1.3,
    text: 'Fegt lose Halme vom Boden in den Eimer.' },
  { id: 'detektor', name: 'Metalldetektor', kurz: 'Detektor', frei: null, faktor: 0, puste: false, laenge: 0.55,
    text: 'Piept, je näher eine Nadel ist. Auf den Haufen richten.' },
  { id: 'sauger', name: 'Hofsauger', kurz: 'Sauger', frei: 'sauger', faktor: 0, puste: false, laenge: 1.0,
    text: 'Gedrückt halten: saugt Heu und lose Halme, bis er zu heiß wird.' },
];

/** Behälter, die man trägt. Die Kapazität kommt aus werte().tasche. */
export const BEHAELTER = [
  { id: 'arme', name: 'Arme', frei: null },
  { id: 'eimer', name: 'Eimer', frei: 'eimer' },
  { id: 'schubkarre', name: 'Schubkarre', frei: 'schubkarre' },
];

/* ------------------------------------------------------------ Nadeln */

/** 24 Nadelarten, sechs je Ladung. Die Boni sind absichtlich lächerlich. */
export const NADELN = [
  { name: 'Rostige Nähnadel', bonus: 'Griff +1 %', effekt: [['griff', '*', 1.01]] },
  { name: 'Stopfnadel', bonus: 'Tasche +1 Halm', effekt: [['tasche', '+', 1]] },
  { name: 'Stecknadel', bonus: 'Verkauf +1 %', effekt: [['preisRoh', '*', 1.01]] },
  { name: 'Sticknadel', bonus: 'Greifarme +2 %', effekt: [['armTempo', '*', 1.02]] },
  { name: 'Kompassnadel', bonus: 'Detektor +5 %', effekt: [['detektor', '*', 1.05]] },
  { name: 'Goldene Nadel', bonus: 'Alles 5 % mehr wert', effekt: [['preisAlle', '*', 1.05]] },
  { name: 'Sicherheitsnadel', bonus: 'Ausdauer +2', effekt: [['ausdauer', '+', 2]] },
  { name: 'Hutnadel', bonus: 'Glücksstich +1 %', effekt: [['krit', '+', 0.01]] },
  { name: 'Häkelnadel', bonus: 'Band +1 %', effekt: [['band', '*', 1.01]] },
  { name: 'Stricknadel', bonus: 'Sauger +3 %', effekt: [['saugerRate', '*', 1.03]] },
  { name: 'Tannennadel', bonus: 'Riecht gut. Sonst nichts.', effekt: [] },
  { name: 'Grammofonnadel', bonus: 'Aufträge +2 %', effekt: [['auftragLohn', '*', 1.02]] },
  { name: 'Polsternadel', bonus: 'Drohnen +3 %', effekt: [['drohnenRate', '*', 1.03]] },
  { name: 'Segelmachernadel', bonus: 'Wasser +2 %', effekt: [['wasserMul', '*', 1.02]] },
  { name: 'Ledernadel', bonus: 'Laufweg −2 %', effekt: [['laufzeit', '*', 0.98]] },
  { name: 'Perlnadel', bonus: 'Produkte +2 %', effekt: [['preisProdukt', '*', 1.02]] },
  { name: 'Magnetnadel', bonus: 'Scanner +3 %', effekt: [['scanDeckung', '*', 1.03]] },
  { name: 'Silberne Nadel', bonus: 'Alles 5 % mehr wert', effekt: [['preisAlle', '*', 1.05]] },
  { name: 'Krawattennadel', bonus: 'Strom +2 %', effekt: [['stromMul', '*', 1.02]] },
  { name: 'Haarnadel', bonus: 'Rechen +3 %', effekt: [['rechenTempo', '*', 1.03]] },
  { name: 'Radiernadel', bonus: 'Maschinen 1 % billiger', effekt: [['maschinenKosten', '*', 0.99]] },
  { name: 'Wünschelnadel', bonus: 'Radar 5 % schneller', effekt: [['radarCD', '*', 0.95]] },
  { name: 'Uhrzeigernadel', bonus: 'Nachtschicht +5 %', effekt: [['offlineEff', '+', 0.05]] },
  { name: 'Diamantnadel', bonus: 'Alles 10 % mehr wert', effekt: [['preisAlle', '*', 1.1]] },
];


/**
 * Wo die sechs Nadeln einer Ladung stecken: tiefe = Anteil der Säulenhöhe unter
 * der Oberfläche (0 oben, 1 am Boden), rand = Abstand von der Mitte als Anteil des
 * Radius. Die erste liegt flach am Hang, gut von Hand zu erreichen; die letzten
 * tief im Kern, die findet man, wenn Maschinen den Haufen abgetragen haben.
 */
export const NADEL_LAGEN = [
  { tiefe: [0.06, 0.12], rand: [0.55, 0.78] },
  { tiefe: [0.18, 0.3], rand: [0.45, 0.7] },
  { tiefe: [0.32, 0.48], rand: [0.3, 0.6] },
  { tiefe: [0.5, 0.66], rand: [0.2, 0.5] },
  { tiefe: [0.68, 0.82], rand: [0.1, 0.4] },
  { tiefe: [0.86, 0.96], rand: [0.0, 0.25] },
];

export const GESCHICHTE = {
  anfang: [
    'Du stehst in einer Lagerhalle. Das Dach ist offen, darüber blauer Himmel. '
      + 'Das Tor ist zu, und du weißt nicht, wie du hergekommen bist.',
    'Vor dir ein Heuhaufen, höher als die Wände. Auf einem Zettel am Pfosten steht: '
      + '„Rund sechs Millionen Halme. Sechs Nadeln. Finde sie.“',
    'Auf der Werkbank liegen eine gelbe Kinderschaufel und ein Metalldetektor. Am Stand '
      + 'hinten links steht „Heu verkaufen“. Wer dort bezahlt, sieht man nicht.',
  ],
  nadeln: [
    'Etwas glitzert im Heu. Eine Nähnadel, rostig, völlig wertlos. '
      + 'Auf der Rückseite des Zettels steht plötzlich: „Eine.“',
    'Die zweite Nadel ist dicker, eine Stopfnadel. Irgendwo hinter dem Haufen klackt ein Schloss. '
      + 'Das Tor bleibt trotzdem zu.',
    'Eine Stecknadel mit rotem Kopf. Jemand hat sie mit Absicht hier versteckt, '
      + 'da bist du dir jetzt sicher. Am Stand liegt ein neuer Zettel: „Weiter.“',
    'Die Sticknadel liegt in einem Bett aus besonders ordentlichem Heu. '
      + 'Hat hier jemand vor dir gesucht? Auf dem Boden: Kratzspuren, die zum Haufen führen.',
    'Eine Kompassnadel. Sie zeigt nicht nach Norden, sondern stur auf den Verkaufsstand. '
      + 'Von drüben hörst du jemanden lachen.',
    'Die sechste Nadel ist aus Gold. Das Tor rollt hoch, draußen ist heller Tag. '
      + 'Auf dem Zettel steht nur noch: „Danke. Die nächste Ladung kommt, wenn du sie bestellst.“',
  ],
  ladung: 'Ein Laster setzt rückwärts ans Tor, kippt, fährt wieder. Neue Ladung, neue Nadeln.',
};

/* ------------------------------------------------------------ Ladungen */

export const LADUNG_WACHSTUM = 1.4;
/** Preis der nächsten Ladung: Grundpreis mal Faktor je schon bestellter Ladung. */
export const LADUNG_PREIS = 90_000;
export const LADUNG_PREIS_FAKTOR = 2.5;
/** Wer auf Rechnung bestellt, zahlt so viel mehr (mit „Heu auf Rechnung“ weniger), und so viel
 *  jeder Einnahme geht an die Schulden. Auf Rechnung geht immer, damit niemand mit leerem Haufen
 *  und leerer Kasse feststeckt. */
export const KREDIT_AUFSCHLAG = 1.5;
export const KREDIT_AUFSCHLAG_GUT = 1.1;
export const KREDIT_TILGUNG = 0.5;


/* ------------------------------------------------------------ Forschung */

// Reihenfolge wie im Vorbild. Die Zeile unter dem Namen steht neben jedem Ast.
export const AESTE = [
  { id: 'hand', name: 'Handarbeit', zeile: 'Werkzeuge und Tragen', farbe: '#e0a53c' },
  { id: 'hofbau', name: 'Hofbau', zeile: 'Plattformen, Wände und Dächer', farbe: '#c49a6c' },
  { id: 'linien', name: 'Heulinien', zeile: 'Bänder, Weichen und der Werfer', farbe: '#8fc46a' },
  { id: 'strom', name: 'Strom', zeile: 'Der Generator und seine Leitungen', farbe: '#e8c547' },
  { id: 'verarbeitung', name: 'Verarbeitung', zeile: 'Ballen, Folien, Ziegel und das Silo', farbe: '#5fc4b0' },
  { id: 'auto', name: 'Automatisierung', zeile: 'Rechen, Arme und Drohnen', farbe: '#e8783a' },
  { id: 'wasser', name: 'Wasser', zeile: 'Brunnen und Leitungen', farbe: '#5aa7e0' },
  { id: 'suche', name: 'Suche', zeile: 'Detektor, Scanner und Radar', farbe: '#b58be8' },
  { id: 'verkauf', name: 'Verkauf', zeile: 'Preise, Aufträge und Ladungen', farbe: '#e0657a' },
  { id: 'fitness', name: 'Fitness', zeile: 'Ausdauer, Kraft und Tempo', farbe: '#d4d4d4' },
];

// Kurzschreibweise: id, Ast, Name, Stufen, Grundkosten, Kostenfaktor je Stufe,
// Voraussetzungen, Effekte je Stufe, Beschreibung, Upgrade-Gruppe.
// Effekt: [wert, '+', x] addiert je Stufe, [wert, '*', x] multipliziert je
// Stufe, ['frei', name] schaltet etwas frei. Knoten mit Gruppe erscheinen wie
// im Vorbild als schmale Zeilen unter einer gemeinsamen Überschrift; sie haben
// keine Nachfolger.
const k = (id, ast, name, stufen, kosten, faktor, braucht, effekt, text, gruppe = null) =>
  ({ id, ast, name, stufen, kosten, faktor, braucht, effekt, text, gruppe });

export const TECH = [
  k('scheune', null, 'Bloße Hände', 1, 0, 1, [], [], 'Zwei Hände, eine gelbe Kinderschaufel, ein Metalldetektor und sehr viel Heu.'),

  // Handarbeit
  k('eimer', 'hand', 'Eimer', 1, 3, 1, ['scheune'], [['tasche', '+', 70], ['frei', 'eimer']],
    'Ein Holzeimer. Trägt 100 statt 30 Halme.'),
  k('eimer2', 'hand', 'Größerer Eimer', 6, 2, 1.7, ['eimer'], [['tasche', '+', 83]],
    'Dreiundachtzig Halme mehr pro Gang. Voll ausgebaut fasst der Eimer 600.', 'Eimer-Upgrades'),
  k('schubkarre', 'hand', 'Schubkarre', 1, 15, 1, ['eimer'], [['tasche', '*', 2], ['frei', 'schubkarre']],
    'Doppelt so viel pro Gang. Beim Schieben hat man keine Hand frei, gestochen wird trotzdem.'),
  k('mulde', 'hand', 'Tiefere Mulde', 6, 45, 1.9, ['schubkarre'], [['tasche', '+', 60]],
    'Sechzig Halme mehr pro Gang.', 'Schubkarren-Upgrades'),
  k('sack', 'hand', 'Heusack', 1, 150, 1, ['schubkarre'], [['tasche', '+', 150]],
    'Ein Sack obendrauf. Hundertfünfzig Halme mehr.'),
  k('spaten', 'hand', 'Spaten', 1, 12, 1, ['scheune'], [['frei', 'spaten']],
    'Der Spaten vom Werkzeugstand. Sticht doppelt so viel wie die Kinderschaufel, kostet aber Puste.'),
  k('heugabel', 'hand', 'Heugabel', 1, 45, 1, ['spaten'], [['frei', 'heugabel']],
    'Sechs Zinken. Holt doppelt so viel pro Stich wie der Spaten.'),
  k('zinken', 'hand', 'Mehr Zinken', 4, 12, 2, ['heugabel'], [['heugabel', '+', 0.25]],
    'Die Heugabel greift ein Viertel mehr.', 'Heugabel-Upgrades'),
  k('sauger', 'hand', 'Hofsauger', 1, 15, 1, ['heugabel'], [['frei', 'sauger']],
    'Gedrückt halten: saugt 40 Halme pro Sekunde, bis er zu heiß wird.'),
  k('sauger2', 'hand', 'Stärkerer Motor', 6, 110, 2, ['sauger'], [['saugerRate', '*', 1.2]],
    '20 % mehr Sog.', 'Sauger-Upgrades'),
  k('kuehlung', 'hand', 'Kühlrippen', 5, 130, 2, ['sauger'], [['saugerHitze', '*', 1.3]],
    'Hält 30 % länger durch.', 'Sauger-Upgrades'),
  k('industriesauger', 'hand', 'Industriesauger', 1, 8100, 1, ['sauger'], [['saugerRate', '*', 1.5], ['saugerHitze', '*', 1.5]],
    '50 % mehr Sog, länger kühl.'),
  k('besen', 'hand', 'Besen', 1, 8, 1, ['scheune'], [['frei', 'besen']],
    'Bei jedem Stich fällt etwas daneben. Der Besen fegt lose Halme vom Boden in den Eimer.'),
  k('besen2', 'hand', 'Breiterer Besen', 4, 30, 2, ['besen'], [['besen', '*', 1.6]],
    'Fegt 60 % mehr pro Strich.', 'Besen-Upgrades'),

  // Hofbau
  k('plattform', 'hofbau', 'Plattform-Pläne', 1, 40, 1, ['scheune'], [['frei', 'plattform'], ['frei', 'treppe']],
    'Holzplattformen mit Treppen. Oben ist Platz für Maschinen, unten für Bänder.'),
  k('waende', 'hofbau', 'Wand-Pläne', 1, 80, 1, ['plattform'], [['offlineEff', '+', 0.05], ['frei', 'wand'], ['frei', 'gelaender']],
    'Wände und Geländer. Sie halten den Wind ab: nachts wird 5 % mehr geschafft.'),
  k('schuppen', 'hofbau', 'Schuppen erweitern', 6, 150, 2.4, ['waende'], [['hallenFelder', '+', 1]],
    'Die Halle wird um ein Feld von vier Metern länger.'),
  k('material', 'hofbau', 'Weniger Materialverschnitt', 3, 100, 2.4, ['waende'], [['maschinenKosten', '*', 0.95]],
    'Alles, was du baust, wird 5 % billiger.'),
  k('daecher', 'hofbau', 'Dach-Pläne', 1, 1100, 1, ['waende'], [['maschinenTempo', '*', 1.03], ['frei', 'dach']],
    'Ein Dach über den Maschinen. Sie laufen 3 % schneller.'),
  k('arbeitslampen', 'hofbau', 'Arbeitslampen', 1, 2400, 1, ['daecher'], [['maschinenTempo', '*', 1.03], ['frei', 'lampe']],
    'Lampen über den Maschinen. Alles läuft 3 % schneller, weil man sieht, was man tut.'),
  k('heutreppe', 'hofbau', 'Heutreppe', 1, 900, 1, ['plattform'], [['frei', 'heutreppe']],
    'Ein schräges Band mit Sprossen: bringt Heu von unten auf die Plattform.'),
  k('heulift', 'hofbau', 'Heulift', 1, 2700, 1, ['heutreppe'], [['frei', 'heulift']],
    'Ein Gitterturm mit Motor. Hebt Heu senkrecht nach oben, damit Bänder sich kreuzen können.'),
  k('klappe', 'hofbau', 'Abwurfklappe', 1, 1800, 1, ['waende'], [['frei', 'klappe']],
    'Eine Klappe in der Plattform, durch die Heu nach unten auf ein Band fällt.'),
  k('schrank', 'hofbau', 'Werkzeugschrank', 1, 720, 1, ['plattform'], [['tasche', '+', 50], ['frei', 'schrank']],
    'Alles an seinem Platz. Fünfzig Halme mehr pro Gang, und ein Schrank für die Halle.'),
  // Heulinien
  k('foerderband', 'linien', 'Förderband-Pläne', 1, 250, 1, ['scheune'], [['frei', 'band']],
    'Bänder, die du selbst verlegst: Anfang und Ende wählen, der Weg dazwischen findet sich. Am Stand wird verkauft.'),
  k('bandmotor', 'linien', 'Schnellerer Bandmotor', 12, 15, 2.2, ['foerderband'], [['band', '*', 1.12]],
    'Alle Bänder laufen 12 % schneller.', 'Band-Upgrades'),
  k('weiche', 'linien', 'Wechselweiche', 1, 120, 1, ['foerderband'], [['frei', 'weiche']],
    'Verteilt das Heu abwechselnd auf zwei Bänder. Man kann auch eine Seite festlegen oder bevorzugen.'),
  k('vereiniger', 'linien', 'Bandvereiniger', 1, 200, 1, ['weiche'], [['frei', 'vereiniger']],
    'Führt zwei Bänder wieder zusammen.'),
  k('vorrangarm', 'linien', 'Vorrangarm', 1, 300, 1, ['weiche'], [['frei', 'vorrangarm']],
    'Ein kleiner Arm zwischen zwei Bändern: nimmt vom einen und legt aufs andere, wenn dort Platz ist.'),
  k('rohrwerfer', 'linien', 'Rohrwerfer-Pläne', 1, 260, 1, ['weiche'], [['frei', 'rohrwerfer']],
    'Schießt Heu im Bogen durch die Luft, dorthin, wo du zielst. Kein Band nötig.'),
  // Strom
  k('elektrizitaet', 'strom', 'Elektrizität', 1, 500, 1, ['foerderband'], [['frei', 'generator']],
    'Ein Heu-Generator. Er frisst Halme vom Band und macht daraus Strom.'),
  k('kessel', 'strom', 'Größerer Kessel', 6, 80, 1.8, ['elektrizitaet'], [['generatorMul', '*', 1.2]],
    'Generatoren liefern 20 % mehr.', 'Generator-Upgrades'),
  k('feuerbox', 'strom', 'Größere Feuerbox', 5, 60, 1.8, ['elektrizitaet'], [['brennstoff', '*', 0.88]],
    'Generatoren brauchen 12 % weniger Heu.', 'Generator-Upgrades'),
  k('strommast', 'strom', 'Strommast', 1, 300, 1, ['elektrizitaet'], [['frei', 'mast']],
    'Masten mit Leitungen: tragen den Strom quer durch die Halle.'),
  k('spannweite', 'strom', 'Längere Spannweiten', 5, 100, 1.9, ['strommast'], [['spannweite', '+', 1.5]],
    'Zwischen zwei Masten darf die Leitung 1,5 m länger sein.', 'Mast-Upgrades'),
  k('abspannung', 'strom', 'Längere Abspannungen', 4, 90, 1.9, ['strommast'], [['abspannung', '+', 1]],
    'Maschinen dürfen einen Meter weiter vom Mast weg stehen.', 'Mast-Upgrades'),
  k('erdkabel', 'strom', 'Erdkabel', 1, 3000, 1, ['strommast'], [['frei', 'erdkabel'], ['abspannung', '+', 4]],
    'Kabel unter dem Boden: Maschinen hängen auch ohne Mast in der Nähe am Netz.'),
  // Verarbeitung
  k('silo', 'verarbeitung', 'Silo-Pläne', 1, 720, 1, ['foerderband'], [['frei', 'silo']],
    'Presst loses Heu zu Heuknäueln. Knäuel bringen 25 % mehr pro Halm.'),
  k('silo2', 'verarbeitung', 'Größeres Silo', 5, 60, 1.8, ['silo'], [['silo', '*', 1.3]],
    'Silos 30 % schneller.', 'Silo-Upgrades'),
  k('knaeuel', 'verarbeitung', 'Festere Knäuel', 5, 80, 1.8, ['silo'], [['preis_knaeuel', '*', 1.1]],
    'Knäuel 10 % mehr wert.', 'Silo-Upgrades'),
  k('presse', 'verarbeitung', 'Kompressor-Pläne', 1, 1600, 1, ['silo'], [['frei', 'presse']],
    'Presst lose Halme zu Pressballen. Ballen bringen 50 % mehr pro Halm.'),
  k('ballenkammer', 'verarbeitung', 'Größere Ballenkammer', 6, 50, 1.9, ['presse'], [['presse', '*', 1.15]],
    'Mehr Heu pro Pressgang.', 'Kompressor-Upgrades'),
  k('ballenpresse', 'verarbeitung', 'Schnellere Ballenpresse', 6, 50, 1.9, ['presse'], [['presse', '*', 1.2]],
    'Pressen 20 % schneller.', 'Kompressor-Upgrades'),
  k('ballenqualitaet', 'verarbeitung', 'Bessere Ballenqualität', 5, 50, 1.9, ['presse'], [['preis_ballen', '*', 1.12]],
    'Ballen 12 % mehr wert.', 'Kompressor-Upgrades'),
  k('pellet', 'verarbeitung', 'Pelletpresse-Pläne', 1, 5000, 1, ['presse'], [['frei', 'pellet']],
    'Die Pellet-Scheibenmaschine mahlt Halme zu Pellets.'),
  k('pellet2', 'verarbeitung', 'Schnellere Scheibe', 6, 1300, 1.9, ['pellet'], [['pellet', '*', 1.2]],
    'Pelletpressen 20 % schneller.', 'Pellet-Upgrades'),
  k('pelletwert', 'verarbeitung', 'Härtere Pellets', 5, 1400, 1.9, ['pellet'], [['preis_pellet', '*', 1.12]],
    'Pellets 12 % mehr wert.', 'Pellet-Upgrades'),
  k('wickler', 'verarbeitung', 'Wickler-Pläne', 1, 20000, 1, ['presse'], [['frei', 'wickler']],
    'Wickelt Ballen in Folie. Ein Wickelballen ist dreimal so viel wert wie ein Pressballen.'),
  k('wickler2', 'verarbeitung', 'Schnellerer Wickler', 6, 4500, 1.9, ['wickler'], [['wickler', '*', 1.2]],
    'Wickler 20 % schneller.', 'Wickler-Upgrades'),
  k('folie', 'verarbeitung', 'Bessere Folie', 5, 5400, 1.9, ['wickler'], [['preis_silage', '*', 1.12]],
    'Wickelballen 12 % mehr wert.', 'Wickler-Upgrades'),
  k('pulper', 'verarbeitung', 'Pulper-Pläne', 1, 23400, 1, ['presse', 'brunnen'], [['frei', 'pulper']],
    'Weicht Heu in Wasser zu Brei auf.'),
  k('bottich', 'verarbeitung', 'Größerer Bottich', 6, 3600, 1.9, ['pulper'], [['pulper', '*', 1.2]],
    'Pulper 20 % schneller.', 'Pulper-Upgrades'),
  k('feinbrei', 'verarbeitung', 'Feinerer Brei', 5, 4000, 1.9, ['pulper'], [['preis_brei', '*', 1.12]],
    'Heubrei 12 % mehr wert.', 'Pulper-Upgrades'),
  k('papier', 'verarbeitung', 'Papiermaschinen-Pläne', 1, 81000, 1, ['pulper'], [['frei', 'papier']],
    'Macht aus Heubrei Heupapier.'),
  k('papier2', 'verarbeitung', 'Schnellere Walzen', 6, 10800, 1.9, ['papier'], [['papier', '*', 1.2]],
    'Papiermaschinen 20 % schneller.', 'Papier-Upgrades'),
  k('buette', 'verarbeitung', 'Büttenrand', 5, 12600, 1.9, ['papier'], [['preis_papier', '*', 1.12]],
    'Heupapier 12 % mehr wert.', 'Papier-Upgrades'),
  k('brikett', 'verarbeitung', 'Ziegelpresse-Pläne', 1, 234000, 1, ['pulper', 'wickler'], [['frei', 'brikett']],
    'Ballen und Brei werden zu Öko-Ziegeln. Das Beste, was aus Heu werden kann.'),
  k('brikett2', 'verarbeitung', 'Stärkerer Stempel', 6, 32400, 1.9, ['brikett'], [['brikett', '*', 1.2]],
    'Ziegelpressen 20 % schneller.', 'Ziegel-Upgrades'),
  k('brennofen', 'verarbeitung', 'Brennofen', 5, 36000, 1.9, ['brikett'], [['preis_brikett', '*', 1.12]],
    'Öko-Ziegel 12 % mehr wert.', 'Ziegel-Upgrades'),
  k('schnitt', 'verarbeitung', 'Sauberer Schnitt', 5, 99000, 2.4, ['pellet'], [['ausbeute', '*', 0.93]],
    'Jedes Produkt braucht 7 % weniger Heu.'),
  k('qualitaet', 'verarbeitung', 'Qualitätskontrolle', 5, 198000, 2.5, ['wickler'], [['preisProdukt', '*', 1.1]],
    'Alle verarbeiteten Waren 10 % mehr wert.'),

  // Automatisierung
  k('kolbenrechen', 'auto', 'Kolbenrechen', 1, 60, 1, ['foerderband'], [['frei', 'rechen']],
    'Ein Kolben schiebt Heu vom Haufen aufs Band. Langsam, aber er macht es von allein.'),
  k('hub', 'auto', 'Längerer Hub', 5, 40, 2, ['kolbenrechen'], [['rechenTempo', '*', 1.3]],
    'Rechen schieben 30 % mehr.', 'Rechen-Upgrades'),
  k('greifarm', 'auto', 'Greifarm-Pläne', 1, 1600, 1, ['kolbenrechen', 'elektrizitaet'], [['frei', 'arm']],
    'Orange Roboterarme greifen Heu vom Haufen und legen es aufs Band.'),
  k('servos', 'auto', 'Stärkere Servos', 8, 2700, 2.1, ['greifarm'], [['armTempo', '*', 1.15]],
    'Greifarme 15 % schneller.', 'Arm-Upgrades'),
  k('doppelgreifer', 'auto', 'Doppelgreifer', 5, 19800, 2.5, ['greifarm'], [['armTempo', '*', 1.15]],
    'Zwei Greifer an jedem Arm.'),
  k('robotik', 'auto', 'Robotik', 5, 198000, 3, ['doppelgreifer'], [['armTempo', '*', 1.2]],
    'Greifarme 20 % schneller.'),
  k('serie', 'auto', 'Serienfertigung', 5, 8100, 2.3, ['greifarm'], [['maschinenKosten', '*', 0.9]],
    'Alle Maschinen 10 % billiger.'),
  k('sparmotor', 'auto', 'Sparmotoren', 5, 5900, 2.2, ['greifarm'], [['verbrauch', '*', 0.9]],
    'Maschinen brauchen 10 % weniger Strom.'),
  k('kran', 'auto', 'Hallenkran', 3, 16200, 2.5, ['greifarm'], [['maschinenKosten', '*', 0.9]],
    'Aufbauen wird 10 % billiger.'),
  k('ordnung', 'auto', 'Ordnung muss sein', 3, 81000, 3, ['greifarm'], [['maschinenTempo', '*', 1.1]],
    'Alle Maschinen 10 % schneller.'),
  k('drohne', 'auto', 'Heudrohne', 1, 25, 1, ['scheune'], [['frei', 'drohne'], ['drohnenMax', '+', 3]],
    'Kleine Drohnen sammeln lose Halme und liegengebliebenes Heu ein und fliegen es zum Stand. Bis zu drei.'),
  k('schwarm', 'auto', 'Drohnenschwarm', 5, 330, 2, ['drohne'], [['drohnenMax', '+', 2]],
    'Zwei Drohnen mehr.', 'Drohnen-Upgrades'),
  k('rotoren', 'auto', 'Leichtbaurotoren', 5, 810, 2.2, ['drohne'], [['drohnenRate', '*', 1.2]],
    'Drohnen tragen 20 % mehr.', 'Drohnen-Upgrades'),
  k('drohnenhafen', 'auto', 'Drohnenhafen', 1, 8100, 1, ['drohne', 'foerderband'], [['drohnenRate', '*', 2]],
    'Ein besserer Landeplatz. Drohnen tragen doppelt.'),

  // Wasser
  k('brunnen', 'wasser', 'Brunnenbohrung', 1, 7200, 1, ['elektrizitaet'], [['frei', 'brunnen']],
    'Ein Bohrloch im Hallenboden. Pulper und Papiermaschinen brauchen Wasser.'),
  k('wasserleitung', 'wasser', 'Wasserleitung', 1, 2700, 1, ['brunnen'], [['wasserMul', '*', 1.2], ['frei', 'leitung']],
    'Rohre vom Brunnen zu den Maschinen. 20 % mehr Wasser.'),
  k('pumpe', 'wasser', 'Stärkere Pumpe', 6, 3600, 2, ['brunnen'], [['wasserMul', '*', 1.2]],
    'Brunnen fördern 20 % mehr.', 'Brunnen-Upgrades'),
  k('tiefer', 'wasser', 'Tiefer bohren', 4, 6300, 2.2, ['brunnen'], [['wasserMul', '*', 1.15]],
    'Mehr Grundwasser.', 'Brunnen-Upgrades'),
  k('wasserweiche', 'wasser', 'Wasserweiche', 1, 5400, 1, ['wasserleitung'], [['wasserMul', '*', 1.1], ['frei', 'wasserweiche']],
    'Teilt eine Leitung auf zwei Maschinen auf.'),
  k('filter', 'wasser', 'Wasserfilter', 3, 36000, 2.5, ['wasserweiche'], [['preis_brei', '*', 1.1], ['preis_papier', '*', 1.05]],
    'Sauberes Wasser, feinerer Brei.'),

  // Suche
  k('spule', 'suche', 'Empfindliche Spule', 5, 5, 2.2, ['scheune'], [['detektor', '*', 1.35]],
    'Der Metalldetektor reicht 35 % weiter.', 'Detektor-Upgrades'),
  k('piepser', 'suche', 'Lauter Piepser', 1, 25, 1, ['scheune'], [['frei', 'piepser']],
    'Der Detektor zeigt die Entfernung zur Nadel in Metern.'),
  k('scanner', 'suche', 'Scanner-Pläne', 1, 900, 1, ['piepser', 'foerderband'], [['frei', 'scanner']],
    'Das Band läuft hindurch, der Scanner holt Nadeln aus dem Heu. Ohne Scanner werden sie mitverkauft und fallen zurück in den Haufen.'),
  k('scanner2', 'suche', 'Breitbandscanner', 5, 8100, 2.2, ['scanner'], [['scanDeckung', '*', 1.5]],
    'Jeder Scanner prüft 50 % mehr Heu pro Sekunde.', 'Scanner-Upgrades'),
  k('roentgen', 'suche', 'Röntgentunnel', 3, 117000, 3, ['scanner'], [['scanDeckung', '*', 2]],
    'Doppelte Scanleistung.'),
  k('radar', 'suche', 'Nadelradar-Pläne', 1, 16200, 1, ['scanner'], [['frei', 'radar']],
    'Ein Radar, das in Abständen die nächste Nadel im Haufen aufleuchten lässt.'),
  k('radar2', 'suche', 'Schnellerer Radar', 5, 21600, 2.2, ['radar'], [['radarCD', '*', 0.8]],
    'Der Radar pingt 20 % öfter.', 'Radar-Upgrades'),

  // Verkauf
  k('sauber', 'verkauf', 'Sauberes Heu', 5, 3, 1.9, ['scheune'], [['preisRoh', '*', 1.1]],
    'Ohne Staub und Steine zahlt der Stand 10 % mehr pro Halm.'),
  k('feilschen', 'verkauf', 'Feilschen', 5, 55, 2.1, ['sauber'], [['preisRoh', '*', 1.08]],
    'Mit dem Stand lässt sich reden. +8 % auf loses Heu.'),
  k('auftraege', 'verkauf', 'Auftragsbuch', 1, 1300, 1, ['feilschen', 'foerderband'], [['frei', 'auftraege']],
    'Ein Laster setzt ans Tor und will eine bestimmte Ware. Was auf seine Ladefläche fällt, zählt.'),
  k('laster', 'verkauf', 'Größerer Laster', 5, 5400, 2.2, ['auftraege'], [['auftragLohn', '*', 1.1]],
    'Aufträge bringen 10 % mehr.', 'Auftrags-Upgrades'),
  k('stand', 'verkauf', 'Verkaufsstand ausbauen', 1, 2300, 1, ['feilschen'], [['preisAlle', '*', 1.1]],
    'Ein richtiger Tresen mit Registrierkasse. Alles 10 % mehr wert.'),
  k('markt', 'verkauf', 'Wochenmarkt', 5, 9900, 2.2, ['stand'], [['preisAlle', '*', 1.1]],
    'Jeden Samstag. +10 % auf alle Preise.'),
  k('kredit', 'verkauf', 'Heu auf Rechnung', 1, 3600, 1, ['stand'], [['frei', 'kredit']],
    'Wer auf Rechnung bestellt, zahlt nur noch 10 % Aufschlag statt 50 %.'),
  k('nachtschicht', 'verkauf', 'Nachtschicht', 5, 3200, 2.2, ['stand'], [['offlineStunden', '+', 2]],
    'Die Halle läuft 2 Stunden länger weiter, während du weg bist.', 'Nacht-Upgrades'),
  k('nachtwaechter', 'verkauf', 'Nachtwächter', 5, 11900, 2.2, ['stand'], [['offlineEff', '+', 0.05]],
    'Nachts wird 9 % mehr geschafft.', 'Nacht-Upgrades'),

  // Fitness
  k('kraft', 'fitness', 'Mehr aufnehmen', 6, 1, 1.7, ['scheune'], [['griff', '+', 1]],
    'Ein Halm mehr pro Stich.', 'Kraft'),
  k('kondition', 'fitness', 'Kondition', 6, 4, 1.8, ['scheune'], [['ausdauer', '+', 15]],
    'Fünfzehn Ausdauer mehr.', 'Ausdauer'),
  k('atmung', 'fitness', 'Gleichmäßig atmen', 6, 6, 1.8, ['scheune'], [['ausdauerKosten', '*', 0.88]],
    'Jeder Stich kostet 12 % weniger Ausdauer.', 'Ausdauer'),
  k('erholung', 'fitness', 'Erholung', 5, 30, 2, ['scheune'], [['ausdauerRegen', '*', 1.3]],
    'Die Ausdauer kommt 30 % schneller zurück.', 'Ausdauer'),
  k('zweiter_atem', 'fitness', 'Zweiter Atem', 4, 60, 2, ['scheune'], [['erschoepft', '+', 0.1]],
    'Auch erschöpft schaffst du 10 % mehr.', 'Ausdauer'),
  k('blatt', 'fitness', 'Breiteres Blatt', 5, 35, 2, ['scheune'], [['griff', '+', 2]],
    'Zwei Halme mehr pro Stich.'),
  k('handschuh', 'fitness', 'Arbeitshandschuhe', 3, 90, 2.5, ['blatt'], [['krit', '+', 0.03]],
    '3 % Chance auf einen Glücksstich mit fünffacher Menge.'),
  k('staerke', 'fitness', 'Kräftiger Stich', 5, 2000, 2.2, ['handschuh'], [['griff', '+', 2]],
    'Zwei Halme mehr pro Stich.'),
  k('fluesterer', 'fitness', 'Heuflüsterer', 5, 39600, 2.5, ['staerke'], [['griff', '+', 2]],
    'Das Heu kommt dir entgegen. Zwei Halme mehr pro Stich.'),
  k('tempo1', 'fitness', 'Flinke Füße', 5, 2, 1.8, ['scheune'], [['laufzeit', '*', 0.93]],
    'Du gehst 7 % schneller.', 'Tempo'),
  k('tempo2', 'fitness', 'Lange Beine', 5, 180, 2, ['scheune'], [['laufzeit', '*', 0.9]],
    'Noch einmal 10 % schneller, und Rennen kostet weniger Puste.', 'Tempo'),
  k('autotipp', 'fitness', 'Muskelgedächtnis', 3, 810, 2.5, ['blatt'], [['autotipp', '+', 0.5]],
    'Wer die Aktion gedrückt hält, sticht einen halben Stich pro Sekunde schneller.'),
  k('autotipp2', 'fitness', 'Rhythmus', 3, 23400, 2.5, ['autotipp'], [['autotipp', '+', 0.5]],
    'Noch ein halber Stich pro Sekunde.'),
];


/* ------------------------------------------------------------ Bauten */

// Alles, was man im Baukatalog (B) findet. Maße in Metern: b (quer, x), t (tief, z),
// h (hoch). kw: Strombedarf (negativ = erzeugt). ein/aus: Anschlüsse in lokalen
// Koordinaten (Blick der Maschine nach +x), an die Bänder einrasten.
// kosten: Grundpreis; faktor: Preisanstieg je schon gebautem Stück.
// prometer: Linienbauten (Band, Leitung, Geländer, Wand) kosten je Meter.
export const BAU_KATEGORIEN = [
  { id: 'linien', name: 'Heulinien' },
  { id: 'auto', name: 'Automatisierung' },
  { id: 'strom', name: 'Strom' },
  { id: 'suche', name: 'Suche' },
  { id: 'verarbeitung', name: 'Verarbeitung' },
  { id: 'wasser', name: 'Wasser' },
  { id: 'hofbau', name: 'Hofbau' },
];

const bau = (id, name, kat, frei, kosten, faktor, masse, extra = {}) => ({
  id, name, kat, frei, kosten, faktor, b: masse[0], t: masse[1], h: masse[2], kw: 0, ein: [], aus: [], ...extra,
});

export const BAUTEN = [
  // Heulinien
  bau('band', 'Förderband', 'linien', 'band', 0, 1, [0.7, 0.7, 0.55], {
    prometer: 3, linie: true, text: 'Anfang und Ende wählen, der Weg dazwischen findet sich. Rastet an Stand und Maschinen ein.' }),
  bau('weiche', 'Wechselweiche', 'linien', 'weiche', 60, 1.05, [1.2, 1.2, 0.6], {
    ein: [[-0.6, 0]], aus: [[0.6, -0.35], [0.6, 0.35]], text: 'Ein Band hinein, zwei hinaus. Abwechselnd, fest oder mit Vorrang.' }),
  bau('vereiniger', 'Bandvereiniger', 'linien', 'vereiniger', 80, 1.05, [1.2, 1.2, 0.6], {
    ein: [[-0.6, -0.35], [-0.6, 0.35]], aus: [[0.6, 0]], text: 'Zwei Bänder hinein, eines hinaus.' }),
  bau('vorrangarm', 'Vorrangarm', 'linien', 'vorrangarm', 400, 1.1, [0.7, 0.7, 1.1], {
    kw: 1, takt: 1.2, menge: 40, reichweite: 1.8, text: 'Nimmt vom nächsten Band und legt aufs andere, wenn dort Platz ist.' }),
  bau('rohrwerfer', 'Rohrwerfer', 'linien', 'rohrwerfer', 2500, 1.3, [1.0, 1.0, 1.3], {
    kw: 2, ein: [[-0.5, 0]], text: 'Schießt, was hineinfällt, im Bogen dorthin, wo du zielst.' }),
  // Automatisierung
  bau('rechen', 'Kolbenrechen', 'auto', 'rechen', 60, 1.15, [1.0, 1.4, 0.9], {
    kw: 1, takt: 2.5, menge: 25, wurf: [1, 5], text: 'An den Haufen stellen: schiebt Heu heraus und wirft es ein Stück weit, am besten auf ein Band. Braucht Strom.' }),
  bau('arm', 'Greifarm', 'auto', 'arm', 800, 1.18, [0.9, 0.9, 1.6], {
    kw: 2, takt: 1.6, menge: 60, reichweite: 2.6, text: 'Greift Heu vom Haufen oder von einem Band und legt es aufs nächste Band in Reichweite. Braucht Strom.' }),
  bau('drohnenstation', 'Drohnenstation', 'auto', 'drohne', 100, 1.5, [1.2, 1.2, 0.5], {
    text: 'Hier starten und landen die Heudrohnen. Sie sammeln lose Halme und liegengebliebenes Heu ein.' }),
  // Strom
  bau('generator', 'Heu-Generator', 'strom', 'generator', 330, 1.15, [1.6, 1.2, 1.7], {
    kw: -15, brennstoff: 2, ein: [[-0.8, 0]], text: 'Heu hinein, Strom heraus: verbrennt 2 Halme pro Sekunde für 15 kW.' }),
  bau('mast', 'Strommast', 'strom', 'mast', 40, 1.03, [0.3, 0.3, 4.6], {
    text: 'Verbindet sich mit Masten und Maschinen in Reichweite. Tippen am Mast schaltet das ganze Netz.' }),
  // Suche
  bau('scanner', 'Scanner', 'suche', 'scanner', 700, 1.15, [1.4, 1.2, 1.5], {
    kw: 3, rate: 100, ein: [[-0.7, 0]], aus: [[0.7, 0]], text: 'Das Band läuft hindurch. Prüft 100 Halme pro Sekunde und hält gefundene Nadeln fest.' }),
  bau('radar', 'Nadelradar', 'suche', 'radar', 4000, 1.5, [0.9, 0.9, 2.2], {
    kw: 2, text: 'Lässt in Abständen die nächste Nadel im Haufen aufleuchten.' }),
  // Verarbeitung
  bau('silo', 'Silo', 'verarbeitung', 'silo', 90, 1.14, [1.7, 1.7, 4.2], {
    kw: 2, rate: 1, rezept: { halme: 20 }, produkt: 'knaeuel', ein: [[-0.85, 0]], aus: [[0.85, 0]],
    text: 'Presst lose Halme zu festen Heuknäueln. Eine Nadel im Heu wird mit eingepackt.' }),
  bau('presse', 'Kompressor', 'verarbeitung', 'presse', 700, 1.14, [2.0, 1.4, 1.6], {
    kw: 4, rate: 0.5, rezept: { halme: 80 }, produkt: 'ballen', ein: [[-1.0, 0]], aus: [[1.0, 0]],
    text: 'Presst Heu zu Pressballen.' }),
  bau('pellet', 'Pellet-Scheibenmaschine', 'verarbeitung', 'pellet', 7000, 1.15, [1.6, 1.6, 1.6], {
    kw: 6, rate: 1.5, rezept: { halme: 20 }, produkt: 'pellet', ein: [[-0.8, 0]], wurf: [1, 5],
    text: 'Mahlt Heu zu Pellets und wirft sie ein Stück weit hinaus.' }),
  bau('wickler', 'Wickler', 'verarbeitung', 'wickler', 28000, 1.15, [2.0, 1.6, 1.8], {
    kw: 5, rate: 0.5, rezept: { ballen: 1 }, produkt: 'silage', ein: [[-1.0, 0]], aus: [[1.0, 0]],
    text: 'Wickelt Pressballen in Folie.' }),
  bau('pulper', 'Pulper', 'verarbeitung', 'pulper', 17000, 1.15, [1.8, 1.8, 1.6], {
    kw: 8, wasser: 4, rate: 0.75, rezept: { halme: 40 }, produkt: 'brei', ein: [[-0.9, 0]], aus: [[0.9, 0]],
    text: 'Weicht Heu in Wasser zu Heubrei auf. Braucht Wasser.' }),
  bau('papier', 'Papiermaschine', 'verarbeitung', 'papier', 50000, 1.16, [3.0, 1.6, 1.6], {
    kw: 10, wasser: 3, rate: 0.375, rezept: { brei: 2 }, produkt: 'papier', ein: [[-1.5, 0]], aus: [[1.5, 0]],
    text: 'Macht aus Heubrei Bögen aus Heupapier. Braucht Wasser.' }),
  bau('brikett', 'Ziegelpresse', 'verarbeitung', 'brikett', 170000, 1.17, [2.4, 1.8, 1.8], {
    kw: 14, rate: 0.5, rezept: { ballen: 1, brei: 2 }, produkt: 'brikett', ein: [[-1.2, -0.45], [-1.2, 0.45]], aus: [[1.2, 0]],
    text: 'Ein Pressballen und zwei Heubrei werden zu einem Öko-Ziegel.' }),
  // Wasser
  bau('brunnen', 'Brunnen', 'wasser', 'brunnen', 1400, 1.15, [1.3, 1.3, 1.8], {
    kw: 3, wasser: -10, text: 'Pumpt 10 Wasser pro Sekunde. Mit Leitungen zu Pulper und Papiermaschine.' }),
  bau('leitung', 'Wasserleitung', 'wasser', 'leitung', 0, 1, [0.3, 0.3, 0.3], {
    prometer: 5, linie: true, text: 'Rohr vom Brunnen zu den Maschinen.' }),
  bau('wasserweiche', 'Wasserweiche', 'wasser', 'wasserweiche', 200, 1.1, [0.6, 0.6, 0.5], {
    text: 'Teilt eine Leitung auf zwei Maschinen auf.' }),
  // Hofbau
  bau('plattform', 'Plattform', 'hofbau', 'plattform', 60, 1, [2.0, 2.0, 2.2], {
    begehbar: true, text: 'Eine Holzplattform auf Pfosten. Oben darf gebaut werden.' }),
  bau('treppe', 'Treppe', 'hofbau', 'treppe', 40, 1, [1.0, 3.0, 2.2], {
    begehbar: true, text: 'Führt auf eine Plattform.' }),
  bau('gelaender', 'Geländer', 'hofbau', 'gelaender', 0, 1, [0.1, 0.1, 1.0], { prometer: 8, linie: true, text: 'Damit niemand herunterfällt.' }),
  bau('wand', 'Wand', 'hofbau', 'wand', 0, 1, [0.15, 0.15, 3.0], { prometer: 20, linie: true, text: 'Eine Bretterwand.' }),
  bau('dach', 'Dach', 'hofbau', 'dach', 40, 1, [3.0, 3.0, 3.0], { text: 'Wellblech auf Pfosten. Maschinen darunter laufen 3 % schneller.' }),
  bau('lampe', 'Arbeitslampe', 'hofbau', 'lampe', 30, 1, [0.4, 0.4, 2.4], { kw: 0.5, text: 'Macht Licht. Helligkeit am Schalter.' }),
  bau('staffelei', 'Malbrett', 'hofbau', null, 20, 1, [0.9, 0.6, 1.7], { text: 'Eine Staffelei zum Zeichnen. Deine Bilder kommen ins Skizzenbuch.' }),
  bau('schrank', 'Werkzeugschrank', 'hofbau', 'schrank', 150, 1.2, [1.0, 0.5, 1.9], { text: 'Ein Schrank für die Halle.' }),
  bau('heutreppe', 'Heutreppe', 'hofbau', 'heutreppe', 900, 1.2, [0.8, 4.0, 2.2], {
    kw: 2, ein: [[0, -2]], aus: [[0, 2]], text: 'Ein schräges Sprossenband: bringt Heu vom Boden auf Plattformhöhe.' }),
  bau('heulift', 'Heulift', 'hofbau', 'heulift', 2700, 1.2, [1.2, 1.2, 4.0], {
    kw: 3, ein: [[-0.6, 0]], aus: [[0.6, 0]], text: 'Hebt Heu senkrecht auf Plattformhöhe.' }),
  bau('klappe', 'Abwurfklappe', 'hofbau', 'klappe', 300, 1.1, [1.0, 1.0, 0.2], {
    text: 'In eine Plattform gebaut: was hineinfällt, landet unten.' }),
];

/* ------------------------------------------------------------ Produkte */

// Wie in der 2D-Fassung: wert je Stück bei 0,0222 $ pro losem Halm, halme je Stück.
// In 3D sind die Stücke viermal so groß (ein Ballen sind 80 Halme), der Preis
// pro Halm bleibt gleich. 'roh' ist ein Bündel loses Heu auf dem Band; seine
// Halmzahl hängt davon ab, wer es aufs Band gelegt hat.
/** wert: Preis pro Stück bei 0,0222 pro losem Halm. Zahlt der Stand mehr, ziehen alle mit. */
export const PRODUKTE_2D = {
  roh: { name: 'Loses Heu', wert: 0.0222, halme: 1 },
  knaeuel: { name: 'Heuknäuel', wert: 0.139, halme: 5 },
  ballen: { name: 'Pressballen', wert: 0.666, halme: 20 },
  pellet: { name: 'Pellets', wert: 0.244, halme: 5 },
  brei: { name: 'Heubrei', wert: 0.71, halme: 10 },
  silage: { name: 'Wickelballen', wert: 2.0, halme: 20 },
  papier: { name: 'Heupapier', wert: 3.0, halme: 20 },
  brikett: { name: 'Öko-Ziegel', wert: 6.5, halme: 40 },
};


export const STUECK_FAKTOR = 4;
export const PRODUKTE = Object.fromEntries(Object.entries(PRODUKTE_2D).map(([id, p]) => [
  id, id === 'roh' ? { ...p } : { name: p.name, wert: p.wert * STUECK_FAKTOR, halme: p.halme * STUECK_FAKTOR },
]));

/* ------------------------------------------------------------ Aufträge */

// Der Laster nimmt die ersten Stücke der gewünschten Ware, bis der Auftrag voll
// ist, und zahlt dann den Lohn. Nach der Liste geht es mit wachsenden Aufträgen
// weiter (siehe auftrag() in der Engine).
export const AUFTRAEGE = [
  { titel: 'Pferdehof Lindner', will: 'roh', menge: 2000, lohn: 90 },
  { titel: 'Kleintierzucht Wagner', will: 'knaeuel', menge: 100, lohn: 40 },
  { titel: 'Reitstall Brandt', will: 'ballen', menge: 20, lohn: 40 },
  { titel: 'Gärtnerei Moosbach', will: 'roh', menge: 20000, lohn: 800 },
  { titel: 'Bastelladen Kunterbunt', will: 'knaeuel', menge: 800, lohn: 300 },
  { titel: 'Reitstall Brandt', will: 'ballen', menge: 150, lohn: 280 },
  { titel: 'Pelletofen Nord', will: 'pellet', menge: 600, lohn: 400 },
  { titel: 'Gut Eichenhof', will: 'ballen', menge: 500, lohn: 900 },
  { titel: 'Milchhof Berger', will: 'silage', menge: 200, lohn: 700 },
  { titel: 'Papierwerk Seeburg', will: 'brei', menge: 300, lohn: 600 },
  { titel: 'Molkerei Almtal', will: 'papier', menge: 200, lohn: 1200 },
  { titel: 'Druckerei Feder', will: 'silage', menge: 1000, lohn: 3400 },
  { titel: 'Ökobau Grünwerk', will: 'papier', menge: 800, lohn: 4600 },
  { titel: 'Passivhaus Hansen', will: 'brikett', menge: 150, lohn: 2400 },
  { titel: 'Hühnerhof Petersen', will: 'brikett', menge: 600, lohn: 9000 },
];
/** Kunden für die Aufträge nach der festen Liste. */
export const KUNDEN = ['Reitstall Brandt', 'Papierwerk Seeburg', 'Ökobau Grünwerk', 'Gut Eichenhof', 'Molkerei Almtal',
  'Pelletofen Nord', 'Zoo am Stadtrand', 'Baumarkt Kellner', 'Theater Kulisse', 'Landhandel Voss'];
/** Pause zwischen zwei Aufträgen in Sekunden. */
export const AUFTRAG_PAUSE = 20;


/* ------------------------------------------------------------ Missionen */

// Das Missionsbuch, wie im Vorbild zugleich die Anleitung: immer ein Schritt,
// der Reihe nach, mit Zähler. Belohnung: Geld, ein geschenkter Bau (geschenk:
// id aus BAUTEN, liegt dann im Baukatalog bereit) oder eine Forschungsstufe.
// art: umgesehen, gelaufen, tipps, verkauft, tech, werkzeug, verdient, gefegt,
// gebaut [typ, n], nadeln, auftraege, produziert [p, n], abgetragen, haelfte,
// ladungen, forschung, arten, strom (ein Rechen läuft).
export const MISSIONEN = [
  { text: 'Schau dich um', hilfe: 'Rechts über den Bildschirm wischen.', art: 'umgesehen', ziel: 2, geld: 0 },
  { text: 'Geh zum Haufen', hilfe: 'Links den Daumen aufsetzen und schieben.', art: 'gelaufen', ziel: 5, geld: 0 },
  { text: 'Heb etwas Heu auf', hilfe: 'Auf den Haufen zielen und den runden Knopf drücken.', art: 'tipps', ziel: 5, geld: 1 },
  { text: 'Bring 25 Halme zum Stand', hilfe: 'Am Stand hinten links auf „Verkaufen“ tippen.', art: 'verkauft', ziel: 25, geld: 1 },
  { text: 'Kauf einen Eimer', hilfe: 'Am Werkzeugstand oder in der Forschung.', art: 'tech', ziel: 'eimer', geld: 2 },
  { text: 'Kauf den Spaten', hilfe: 'Am Werkzeugstand: 12 $.', art: 'tech', ziel: 'spaten', geld: 3 },
  { text: 'Halte den Detektor an den Haufen', hilfe: 'Den Detektor unten in der Leiste wählen und auf den Haufen zielen.', art: 'werkzeug', ziel: 'detektor', geld: 2 },
  { text: 'Verdiene 30 $', art: 'verdient', ziel: 30, geld: 5 },
  { text: 'Kauf den Besen und feg verschüttetes Heu zusammen', hilfe: 'Beim Graben fällt Heu daneben und rollt an den Fuß des Haufens. Dort zusammenfegen.', art: 'gefegt', ziel: 20, geld: 10 },
  { text: 'Kauf die Förderband-Pläne', hilfe: 'In der Forschung unter Heulinien.', art: 'tech', ziel: 'foerderband', geschenk: 'rechen' },
  { text: 'Leg ein Band vom Haufen zum Stand', hilfe: 'Unten auf BAUEN tippen, Förderband wählen, Anfang beim Haufen und Ende am Stand setzen.', art: 'gebaut', ziel: ['band', 1], geschenk: 'mast' },
  { text: 'Stell den Kolbenrechen an den Haufen', hilfe: 'Im Baukatalog liegt er als Geschenk bereit.', art: 'gebaut', ziel: ['rechen', 1], geschenk: 'mast' },
  { text: 'Bring den Rechen ans Netz', hilfe: 'Der Hausanschluss hängt an der linken Wand. Masten verlängern die Leitung.', art: 'strom', ziel: 1, geld: 40 },
  { text: 'Finde die erste Nadel', hilfe: 'Der Detektor piept, je näher sie ist. Dort graben.', art: 'nadeln', ziel: 1, geld: 120 },
  { text: 'Stell einen zweiten Kolbenrechen auf', art: 'gebaut', ziel: ['rechen', 2], geld: 150 },
  { text: 'Kauf Elektrizität', art: 'tech', ziel: 'elektrizitaet', geschenkTech: 'strommast' },
  { text: 'Bau einen Heu-Generator', hilfe: 'Ein Band hinein, dann brennt er.', art: 'gebaut', ziel: ['generator', 1], geschenk: 'mast' },
  { text: 'Bau einen Scanner', hilfe: 'Das Band zum Stand durch den Scanner führen.', art: 'gebaut', ziel: ['scanner', 1], geld: 600 },
  { text: 'Bau ein Silo', art: 'gebaut', ziel: ['silo', 1], geld: 800 },
  { text: 'Kauf die Plattform-Pläne', art: 'tech', ziel: 'plattform', geschenk: 'schrank' },
  { text: 'Bau einen Greifarm', art: 'gebaut', ziel: ['arm', 1], geld: 3000 },
  { text: 'Erfülle einen Auftrag', hilfe: 'Der Laster steht am Tor. Was auf seine Ladefläche fällt, zählt.', art: 'auftraege', ziel: 1, geld: 3000 },
  { text: 'Presse 100 Pressballen', art: 'produziert', ziel: ['ballen', 100], geld: 4000 },
  { text: 'Trag eine Million Halme ab', art: 'abgetragen', ziel: 1_000_000, geld: 5000 },
  { text: 'Finde drei Nadeln', art: 'nadeln', ziel: 3, geld: 6000 },
  { text: 'Bohr einen Brunnen', art: 'gebaut', ziel: ['brunnen', 1], geld: 8000 },
  { text: 'Trag den Haufen zur Hälfte ab', art: 'haelfte', ziel: 0.5, geld: 15000 },
  { text: 'Stell zehn Greifarme auf', art: 'gebaut', ziel: ['arm', 10], geld: 25000 },
  { text: 'Finde alle sechs Nadeln', art: 'nadeln', ziel: 6, geld: 30000 },
  { text: 'Bestell eine neue Ladung', hilfe: 'Am Lieferschalter hinter dem Haufen.', art: 'ladungen', ziel: 2, geld: 30000 },
  { text: 'Mach 50 Bögen Heupapier', art: 'produziert', ziel: ['papier', 50], geld: 60000 },
  { text: 'Presse 100 Öko-Ziegel', art: 'produziert', ziel: ['brikett', 100], geld: 200000 },
  { text: 'Finde zwölf Nadeln', art: 'nadeln', ziel: 12, geld: 250000 },
  { text: 'Erforsche 200 Stufen', art: 'forschung', ziel: 200, geld: 250000 },
  { text: 'Finde alle 24 Nadelarten', art: 'arten', ziel: 24, geld: 2_000_000 },
];
