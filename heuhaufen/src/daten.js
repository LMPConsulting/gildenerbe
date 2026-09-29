// Alle Zahlen des Spiels an einer Stelle: Werkzeuge, Forschung, Maschinen,
// Produkte, Nadeln, Missionen, Aufträge, Ladungen und die kleinen Geschichten
// dazwischen. Die Engine liest nur hieraus; wer umbalanciert, fasst
// ausschließlich diese Datei an.
//
// Vorbild ist Find The Needle: rund sechs Millionen Halme, Verkauf zu
// 0,0222 $ pro Halm, ein Forschungsbaum mit zehn Ästen, sechs Nadeln pro Ladung.

/** Grundwerte, bevor irgendein Upgrade greift. */
export const GRUND = {
  griff: 6,            // Halme pro Stich mit dem Spaten
  heugabel: 2,         // Faktor der Heugabel auf den Griff
  sandschaufel: 0.5,   // Faktor der Sandschaufel (kostet keine Ausdauer)
  krit: 0,             // Chance auf einen Glücksstich
  kritFaktor: 5,
  tasche: 30,          // Halme, die man in den Armen trägt
  laufzeit: 4,         // Sekunden zum Verkaufsstand und zurück
  ausdauer: 25,        // volle Ausdauer
  ausdauerRegen: 3,    // pro Sekunde
  ausdauerKosten: 1,   // pro Stich
  erschoepft: 0.3,     // Anteil des Griffs ohne Ausdauer
  verschuetten: 0.12,  // so viel fällt bei jedem Stich zusätzlich auf den Boden
  besen: 60,           // Halme pro Besenstrich
  autotipp: 0,
  saugerRate: 40,
  saugerHitze: 6,
  drohnenMax: 0,
  drohnenRate: 4,
  detektor: 3000,      // Reichweite in Halmen
  radarCD: 60,         // Sekunden zwischen zwei Radarpings
  preisRoh: 0.0222,    // was der Stand pro Halm zahlt
  preisAlle: 1,
  preisProdukt: 1,
  auftragLohn: 1,
  armTempo: 1,
  rechenTempo: 1,
  werfer: 1,
  band: 40,            // Förderband: Halme pro Sekunde
  scanDeckung: 1,
  stromMul: 1,
  verbrauch: 1,
  generatorMul: 1,
  brennstoff: 1,
  wasserMul: 1,
  verteilung: 0.6,     // ohne Weichen staut es sich vor den Verarbeitern
  verarbeitung: 1,
  ausbeute: 1,
  plaetze: 0,
  maschinenKosten: 1,
  maschinenTempo: 1,
  offlineStunden: 2,
  offlineEff: 0.5,
};

/* ------------------------------------------------------------ Ladungen */

/** Halme je Ladung. Danach wächst jede weitere um 40 %. */
export const LADUNGEN = [6_000_000, 10_000_000, 16_000_000, 26_000_000];
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

/** Wo die sechs Nadeln einer Ladung stecken können, als Anteil des Haufens von oben. */
export const NADEL_BEREICHE = [
  [0.0015, 0.004], [0.02, 0.06], [0.08, 0.2], [0.25, 0.45], [0.5, 0.75], [0.8, 0.99],
];

/** 24 Nadelarten, sechs je Ladung. Die Boni sind absichtlich lächerlich. */
export const NADELN = [
  { name: 'Rostige Nähnadel', bonus: 'Griff +1 %', effekt: [['griff', '*', 1.01]] },
  { name: 'Stopfnadel', bonus: 'Tasche +1 Halm', effekt: [['tasche', '+', 1]] },
  { name: 'Stecknadel', bonus: 'Verkauf +1 %', effekt: [['preisRoh', '*', 1.01]] },
  { name: 'Sticknadel', bonus: 'Greifarme +2 %', effekt: [['armTempo', '*', 1.02]] },
  { name: 'Kompassnadel', bonus: 'Detektor +5 %', effekt: [['detektor', '*', 1.05]] },
  { name: 'Goldene Nadel', bonus: 'Alles 5 % mehr wert', effekt: [['preisAlle', '*', 1.05]] },
  { name: 'Sicherheitsnadel', bonus: 'Ausdauer +2', effekt: [['ausdauer', '+', 2]] },
  { name: 'Hutnadel', bonus: 'Glücksstich +1 %', effekt: [['krit', '+', 0.01]] },
  { name: 'Häkelnadel', bonus: 'Band +1 %', effekt: [['band', '*', 1.01]] },
  { name: 'Stricknadel', bonus: 'Sauger +3 %', effekt: [['saugerRate', '*', 1.03]] },
  { name: 'Tannennadel', bonus: 'Riecht gut. Sonst nichts.', effekt: [] },
  { name: 'Grammofonnadel', bonus: 'Aufträge +2 %', effekt: [['auftragLohn', '*', 1.02]] },
  { name: 'Polsternadel', bonus: 'Drohnen +3 %', effekt: [['drohnenRate', '*', 1.03]] },
  { name: 'Segelmachernadel', bonus: 'Wasser +2 %', effekt: [['wasserMul', '*', 1.02]] },
  { name: 'Ledernadel', bonus: 'Laufweg −2 %', effekt: [['laufzeit', '*', 0.98]] },
  { name: 'Perlnadel', bonus: 'Produkte +2 %', effekt: [['preisProdukt', '*', 1.02]] },
  { name: 'Magnetnadel', bonus: 'Scanner +3 %', effekt: [['scanDeckung', '*', 1.03]] },
  { name: 'Silberne Nadel', bonus: 'Alles 5 % mehr wert', effekt: [['preisAlle', '*', 1.05]] },
  { name: 'Krawattennadel', bonus: 'Strom +2 %', effekt: [['stromMul', '*', 1.02]] },
  { name: 'Haarnadel', bonus: 'Rechen +3 %', effekt: [['rechenTempo', '*', 1.03]] },
  { name: 'Radiernadel', bonus: 'Maschinen 1 % billiger', effekt: [['maschinenKosten', '*', 0.99]] },
  { name: 'Wünschelnadel', bonus: 'Radar 5 % schneller', effekt: [['radarCD', '*', 0.95]] },
  { name: 'Uhrzeigernadel', bonus: 'Nachtschicht +5 %', effekt: [['offlineEff', '+', 0.05]] },
  { name: 'Diamantnadel', bonus: 'Alles 10 % mehr wert', effekt: [['preisAlle', '*', 1.1]] },
];

export const GESCHICHTE = {
  anfang: [
    'Du wachst in einer Lagerhalle auf. Das Dach ist offen, darüber blauer Himmel. '
      + 'Die Tore sind zu, und du weißt nicht, wie du hergekommen bist.',
    'Vor dir ein Heuhaufen bis über die Dachbögen. Auf einem Zettel am Pfosten steht: '
      + '„Rund sechs Millionen Halme. Sechs Nadeln. Finde sie.“',
    'Neben dir liegen ein Spaten und ein Metalldetektor. Hinten steht ein Stand mit dem Schild '
      + '„Heu verkaufen“. Wer dort bezahlt, sieht man nicht.',
  ],
  nadeln: [
    'Etwas sticht dich in den Daumen. Eine Nähnadel, rostig, völlig wertlos. '
      + 'Auf der Rückseite des Zettels steht plötzlich: „Eine.“',
    'Die zweite Nadel ist dicker, eine Stopfnadel. Irgendwo hinter dem Haufen klackt ein Schloss. '
      + 'Die Tore bleiben trotzdem zu.',
    'Eine Stecknadel mit rotem Kopf. Jemand hat sie mit Absicht hier versteckt, '
      + 'da bist du dir jetzt sicher. Am Stand liegt ein neuer Zettel: „Weiter.“',
    'Die Sticknadel liegt in einem Bett aus besonders ordentlichem Heu. '
      + 'Hat hier jemand vor dir gesucht? Auf dem Boden: Kratzspuren, die zum Haufen führen.',
    'Eine Kompassnadel. Sie zeigt nicht nach Norden, sondern stur auf den Verkaufsstand. '
      + 'Von drüben hörst du jemanden lachen.',
    'Die sechste Nadel ist aus Gold. Die Tore springen auf, draußen ist heller Tag. '
      + 'Auf dem Zettel steht nur noch: „Danke. Die nächste Ladung kommt, wenn du sie bestellst.“',
  ],
  ladung: 'Ein Laster setzt rückwärts an, kippt, fährt wieder. Neue Ladung, neue Nadeln.',
};

/* ------------------------------------------------------------ Werkzeuge */

/** Die Werkzeugleiste. frei: null = von Anfang an da. */
export const WERKZEUGE = [
  { id: 'spaten', name: 'Spaten', kurz: 'Spaten', frei: null, text: 'Sticht Heu aus dem Haufen.' },
  { id: 'heugabel', name: 'Heugabel', kurz: 'Gabel', frei: 'heugabel', text: 'Mehr pro Stich als der Spaten.' },
  { id: 'sandschaufel', name: 'Sandschaufel', kurz: 'Sand', frei: 'sandschaufel', text: 'Winzig, aber sie kostet keine Ausdauer.' },
  { id: 'besen', name: 'Besen', kurz: 'Besen', frei: 'besen', text: 'Fegt verschüttetes Heu vom Boden in die Tasche.' },
  { id: 'sauger', name: 'Hofsauger', kurz: 'Sauger', frei: 'sauger', text: 'Gedrückt halten, bis er zu heiß wird.' },
  { id: 'detektor', name: 'Detektor', kurz: 'Detektor', frei: null, text: 'Piept, wenn eine Nadel nah ist.' },
];

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
  k('scheune', null, 'Bloße Hände', 1, 0, 1, [], [], 'Ein Spaten, ein Metalldetektor und sehr viel Heu.'),

  // Handarbeit
  k('eimer', 'hand', 'Eimer', 1, 3, 1, ['scheune'], [['tasche', '+', 70], ['frei', 'eimer']],
    'Trägt 100 statt 30 Halme.'),
  k('eimer2', 'hand', 'Größerer Eimer', 6, 2, 1.7, ['eimer'], [['tasche', '+', 83]],
    'Dreiundachtzig Halme mehr pro Gang. Voll ausgebaut fasst der Eimer 600.', 'Eimer-Upgrades'),
  k('schubkarre', 'hand', 'Schubkarre', 1, 15, 1, ['eimer'], [['tasche', '*', 2], ['laufzeit', '*', 0.9], ['frei', 'schubkarre']],
    'Doppelt so viel pro Gang, und rollen geht schneller als tragen.'),
  k('mulde', 'hand', 'Tiefere Mulde', 6, 45, 1.9, ['schubkarre'], [['tasche', '+', 60]],
    'Sechzig Halme mehr pro Gang.', 'Schubkarren-Upgrades'),
  k('sack', 'hand', 'Heusack', 1, 150, 1, ['schubkarre'], [['tasche', '+', 150]],
    'Ein Sack obendrauf. Hundertfünfzig Halme mehr.'),
  k('heugabel', 'hand', 'Heugabel', 1, 5, 1, ['scheune'], [['frei', 'heugabel']],
    'Holt doppelt so viel pro Stich wie der Spaten.'),
  k('zinken', 'hand', 'Mehr Zinken', 4, 12, 2, ['heugabel'], [['heugabel', '+', 0.25]],
    'Die Heugabel greift ein Viertel mehr.', 'Heugabel-Upgrades'),
  k('sauger', 'hand', 'Hofsauger', 1, 15, 1, ['heugabel'], [['frei', 'sauger']],
    'Gedrückt halten: saugt 40 Halme pro Sekunde, bis er zu heiß wird.'),
  k('sauger2', 'hand', 'Stärkerer Motor', 6, 110, 2, ['sauger'], [['saugerRate', '*', 1.2]],
    '20 % mehr Sog.', 'Sauger-Upgrades'),
  k('kuehlung', 'hand', 'Kühlrippen', 5, 130, 2, ['sauger'], [['saugerHitze', '*', 1.3]],
    'Hält 30 % länger durch.', 'Sauger-Upgrades'),
  k('industriesauger', 'hand', 'Industriesauger', 1, 8100, 1, ['sauger'], [['saugerRate', '*', 1.5], ['saugerHitze', '*', 1.5]],
    '50 % mehr Sog, länger kühl.'),
  k('besen', 'hand', 'Besen', 1, 8, 1, ['scheune'], [['frei', 'besen']],
    'Bei jedem Stich fällt etwas daneben. Der Besen holt es zurück.'),
  k('besen2', 'hand', 'Breiterer Besen', 4, 30, 2, ['besen'], [['besen', '*', 1.6]],
    'Fegt 60 % mehr pro Strich.', 'Besen-Upgrades'),
  k('sandschaufel', 'hand', 'Sandschaufel', 1, 2, 1, ['scheune'], [['frei', 'sandschaufel']],
    'Eine gelbe Kinderschaufel. Halb so viel pro Stich, aber sie kostet keine Ausdauer.'),

  // Hofbau
  k('plattform', 'hofbau', 'Plattform-Pläne', 1, 40, 1, ['scheune'], [['plaetze', '+', 2], ['frei', 'plattform']],
    'Eine Holzplattform neben dem Haufen. Zwei Stellplätze mehr.'),
  k('waende', 'hofbau', 'Wand-Pläne', 1, 80, 1, ['plattform'], [['offlineEff', '+', 0.05], ['frei', 'waende']],
    'Wände halten den Wind ab. Nachts wird 5 % mehr geschafft.'),
  k('schuppen', 'hofbau', 'Schuppen erweitern', 6, 150, 2.4, ['waende'], [['plaetze', '+', 20]],
    'Die Halle wird ein Feld länger. Zwanzig Stellplätze mehr.'),
  k('material', 'hofbau', 'Weniger Materialverschnitt', 3, 100, 2.4, ['waende'], [['maschinenKosten', '*', 0.95]],
    'Alles, was du baust, wird 5 % billiger.'),
  k('daecher', 'hofbau', 'Dach-Pläne', 1, 1100, 1, ['waende'], [['maschinenTempo', '*', 1.03], ['frei', 'daecher']],
    'Ein Dach über den Maschinen. Sie laufen 3 % schneller.'),
  k('arbeitslampen', 'hofbau', 'Arbeitslampen', 1, 2400, 1, ['daecher'], [['maschinenTempo', '*', 1.03]],
    'Lampen über den Maschinen. Alles läuft 3 % schneller, weil man sieht, was man tut.'),
  k('heutreppe', 'hofbau', 'Heutreppe', 1, 900, 1, ['plattform'], [['plaetze', '+', 6]],
    'Eine Treppe auf die Plattform. Oben ist Platz für sechs Maschinen mehr.'),
  k('heulift', 'hofbau', 'Heulift', 1, 2700, 1, ['heutreppe'], [['plaetze', '+', 6], ['verteilung', '+', 0.05]],
    'Hebt Heu auf die obere Ebene. Sechs Stellplätze mehr, und die Bänder kreuzen sich nicht.'),
  k('klappe', 'hofbau', 'Abwurfklappe', 1, 1800, 1, ['waende'], [['plaetze', '+', 6], ['verteilung', '+', 0.05]],
    'Eine Klappe im Boden, durch die Heu nach unten fällt. Sechs Stellplätze mehr.'),
  k('schrank', 'hofbau', 'Werkzeugschrank', 1, 720, 1, ['plattform'], [['tasche', '+', 50]],
    'Alles an seinem Platz. Fünfzig Halme mehr pro Gang.'),
  // Heulinien
  k('foerderband', 'linien', 'Förderband-Pläne', 1, 250, 1, ['scheune'], [['frei', 'band'], ['plaetze', '+', 12]],
    'Ein Band vom Haufen zum Stand. Was du darauf wirfst, wird verkauft, ohne dass du laufen musst.'),
  k('bandmotor', 'linien', 'Schnellerer Bandmotor', 12, 15, 2.2, ['foerderband'], [['band', '*', 1.5]],
    'Das Band läuft 50 % schneller.', 'Band-Upgrades'),
  k('weiche', 'linien', 'Wechselweiche', 1, 120, 1, ['foerderband'], [['verteilung', '+', 0.15]],
    'Verteilt das Heu abwechselnd auf zwei Bänder. Weniger Stau vor den Maschinen.'),
  k('vereiniger', 'linien', 'Bandvereiniger', 1, 200, 1, ['weiche'], [['verteilung', '+', 0.1]],
    'Führt zwei Bänder wieder zusammen.'),
  k('vorrangarm', 'linien', 'Vorrangarm', 1, 300, 1, ['weiche'], [['verteilung', '+', 0.1]],
    'Ein Arm, der eine Seite bevorzugt. Die wichtigste Maschine bekommt zuerst.'),
  k('rohrwerfer', 'linien', 'Rohrwerfer-Pläne', 1, 260, 1, ['weiche'], [['frei', 'rohrwerfer']],
    'Schießt Heu durch ein Rohr zu einer zweiten Linie. Jeder Werfer macht das Band breiter.'),
  // Strom
  k('elektrizitaet', 'strom', 'Elektrizität', 1, 500, 1, ['foerderband'], [['frei', 'generator']],
    'Ein Heu-Generator. Er frisst Halme vom Band und macht daraus Strom.'),
  k('kessel', 'strom', 'Größerer Kessel', 6, 80, 1.8, ['elektrizitaet'], [['generatorMul', '*', 1.2]],
    'Generatoren liefern 20 % mehr.', 'Generator-Upgrades'),
  k('feuerbox', 'strom', 'Größere Feuerbox', 5, 60, 1.8, ['elektrizitaet'], [['brennstoff', '*', 0.88]],
    'Generatoren brauchen 12 % weniger Heu.', 'Generator-Upgrades'),
  k('strommast', 'strom', 'Strommast', 1, 300, 1, ['elektrizitaet'], [['stromMul', '*', 1.1]],
    'Masten statt Kabel am Boden. 10 % weniger Verlust.'),
  k('spannweite', 'strom', 'Längere Spannweiten', 5, 100, 1.9, ['strommast'], [['stromMul', '*', 1.04]],
    'Weniger Masten, weniger Verlust.', 'Mast-Upgrades'),
  k('abspannung', 'strom', 'Längere Abspannungen', 4, 90, 1.9, ['strommast'], [['stromMul', '*', 1.03]],
    'Die Leitungen hängen straffer.', 'Mast-Upgrades'),
  k('erdkabel', 'strom', 'Erdkabel', 1, 3000, 1, ['strommast'], [['stromMul', '*', 1.15]],
    'Kabel unter dem Boden. Nichts, worüber man stolpert.'),
  // Verarbeitung
  k('silo', 'verarbeitung', 'Silo-Pläne', 1, 720, 1, ['foerderband'], [['frei', 'silo']],
    'Presst loses Heu zu Heuknäueln. Knäuel bringen 25 % mehr pro Halm.'),
  k('silo2', 'verarbeitung', 'Größeres Silo', 5, 60, 1.8, ['silo'], [['silo', '*', 1.3]],
    'Silos 30 % schneller.', 'Silo-Upgrades'),
  k('knaeuel', 'verarbeitung', 'Festere Knäuel', 5, 80, 1.8, ['silo'], [['preis_knaeuel', '*', 1.1]],
    'Knäuel 10 % mehr wert.', 'Silo-Upgrades'),
  k('presse', 'verarbeitung', 'Kompressor-Pläne', 1, 1600, 1, ['silo'], [['frei', 'presse']],
    'Presst lose Halme zu Pressballen. Ballen bringen 50 % mehr pro Halm.'),
  k('ballenkammer', 'verarbeitung', 'Größere Ballenkammer', 6, 50, 1.9, ['presse'], [['presse', '*', 1.15]],
    'Mehr Heu pro Pressgang.', 'Kompressor-Upgrades'),
  k('ballenpresse', 'verarbeitung', 'Schnellere Ballenpresse', 6, 50, 1.9, ['presse'], [['presse', '*', 1.2]],
    'Pressen 20 % schneller.', 'Kompressor-Upgrades'),
  k('ballenqualitaet', 'verarbeitung', 'Bessere Ballenqualität', 5, 50, 1.9, ['presse'], [['preis_ballen', '*', 1.12]],
    'Ballen 12 % mehr wert.', 'Kompressor-Upgrades'),
  k('pellet', 'verarbeitung', 'Pelletpresse-Pläne', 1, 9900, 1, ['presse'], [['frei', 'pellet']],
    'Die Pellet-Scheibenmaschine mahlt Halme zu Pellets.'),
  k('pellet2', 'verarbeitung', 'Schnellere Scheibe', 6, 1300, 1.9, ['pellet'], [['pellet', '*', 1.2]],
    'Pelletpressen 20 % schneller.', 'Pellet-Upgrades'),
  k('pelletwert', 'verarbeitung', 'Härtere Pellets', 5, 1400, 1.9, ['pellet'], [['preis_pellet', '*', 1.12]],
    'Pellets 12 % mehr wert.', 'Pellet-Upgrades'),
  k('wickler', 'verarbeitung', 'Wickler-Pläne', 1, 39600, 1, ['presse'], [['frei', 'wickler']],
    'Wickelt Ballen in Folie. Ein Wickelballen ist dreimal so viel wert wie ein Pressballen.'),
  k('wickler2', 'verarbeitung', 'Schnellerer Wickler', 6, 4500, 1.9, ['wickler'], [['wickler', '*', 1.2]],
    'Wickler 20 % schneller.', 'Wickler-Upgrades'),
  k('folie', 'verarbeitung', 'Bessere Folie', 5, 5400, 1.9, ['wickler'], [['preis_silage', '*', 1.12]],
    'Wickelballen 12 % mehr wert.', 'Wickler-Upgrades'),
  k('pulper', 'verarbeitung', 'Pulper-Pläne', 1, 23400, 1, ['presse', 'brunnen'], [['frei', 'pulper']],
    'Weicht Heu in Wasser zu Brei auf.'),
  k('bottich', 'verarbeitung', 'Größerer Bottich', 6, 3600, 1.9, ['pulper'], [['pulper', '*', 1.2]],
    'Pulper 20 % schneller.', 'Pulper-Upgrades'),
  k('feinbrei', 'verarbeitung', 'Feinerer Brei', 5, 4000, 1.9, ['pulper'], [['preis_brei', '*', 1.12]],
    'Heubrei 12 % mehr wert.', 'Pulper-Upgrades'),
  k('papier', 'verarbeitung', 'Papiermaschinen-Pläne', 1, 81000, 1, ['pulper'], [['frei', 'papier']],
    'Macht aus Heubrei Heupapier.'),
  k('papier2', 'verarbeitung', 'Schnellere Walzen', 6, 10800, 1.9, ['papier'], [['papier', '*', 1.2]],
    'Papiermaschinen 20 % schneller.', 'Papier-Upgrades'),
  k('buette', 'verarbeitung', 'Büttenrand', 5, 12600, 1.9, ['papier'], [['preis_papier', '*', 1.12]],
    'Heupapier 12 % mehr wert.', 'Papier-Upgrades'),
  k('brikett', 'verarbeitung', 'Ziegelpresse-Pläne', 1, 234000, 1, ['pulper', 'wickler'], [['frei', 'brikett']],
    'Ballen und Brei werden zu Öko-Ziegeln. Das Beste, was aus Heu werden kann.'),
  k('brikett2', 'verarbeitung', 'Stärkerer Stempel', 6, 32400, 1.9, ['brikett'], [['brikett', '*', 1.2]],
    'Ziegelpressen 20 % schneller.', 'Ziegel-Upgrades'),
  k('brennofen', 'verarbeitung', 'Brennofen', 5, 36000, 1.9, ['brikett'], [['preis_brikett', '*', 1.12]],
    'Öko-Ziegel 12 % mehr wert.', 'Ziegel-Upgrades'),
  k('schnitt', 'verarbeitung', 'Sauberer Schnitt', 5, 99000, 2.4, ['pellet'], [['ausbeute', '*', 0.93]],
    'Jedes Produkt braucht 7 % weniger Heu.'),
  k('qualitaet', 'verarbeitung', 'Qualitätskontrolle', 5, 198000, 2.5, ['wickler'], [['preisProdukt', '*', 1.1]],
    'Alle verarbeiteten Waren 10 % mehr wert.'),

  // Automatisierung
  k('kolbenrechen', 'auto', 'Kolbenrechen', 1, 60, 1, ['foerderband'], [['frei', 'rechen']],
    'Ein Kolben schiebt Heu vom Haufen aufs Band. Langsam, aber er macht es von allein.'),
  k('hub', 'auto', 'Längerer Hub', 5, 40, 2, ['kolbenrechen'], [['rechenTempo', '*', 1.3]],
    'Rechen schieben 30 % mehr.', 'Rechen-Upgrades'),
  k('greifarm', 'auto', 'Greifarm-Pläne', 1, 1600, 1, ['kolbenrechen', 'elektrizitaet'], [['frei', 'arm']],
    'Orange Roboterarme greifen Heu vom Haufen und legen es aufs Band.'),
  k('servos', 'auto', 'Stärkere Servos', 8, 2700, 2.1, ['greifarm'], [['armTempo', '*', 1.15]],
    'Greifarme 15 % schneller.', 'Arm-Upgrades'),
  k('doppelgreifer', 'auto', 'Doppelgreifer', 5, 19800, 2.5, ['greifarm'], [['armTempo', '*', 1.15]],
    'Zwei Greifer an jedem Arm.'),
  k('robotik', 'auto', 'Robotik', 5, 198000, 3, ['doppelgreifer'], [['armTempo', '*', 1.2]],
    'Greifarme 20 % schneller.'),
  k('serie', 'auto', 'Serienfertigung', 5, 8100, 2.3, ['greifarm'], [['maschinenKosten', '*', 0.9]],
    'Alle Maschinen 10 % billiger.'),
  k('sparmotor', 'auto', 'Sparmotoren', 5, 5900, 2.2, ['greifarm'], [['verbrauch', '*', 0.9]],
    'Maschinen brauchen 10 % weniger Strom.'),
  k('kran', 'auto', 'Hallenkran', 3, 16200, 2.5, ['greifarm'], [['maschinenKosten', '*', 0.9]],
    'Aufbauen wird 10 % billiger.'),
  k('ordnung', 'auto', 'Ordnung muss sein', 3, 81000, 3, ['greifarm'], [['maschinenTempo', '*', 1.1]],
    'Alle Maschinen 10 % schneller.'),
  k('drohne', 'auto', 'Heudrohne', 1, 25, 1, ['scheune'], [['frei', 'drohne'], ['drohnenMax', '+', 3]],
    'Kleine Drohnen fliegen Heu zum Stand. Bis zu drei.'),
  k('schwarm', 'auto', 'Drohnenschwarm', 5, 330, 2, ['drohne'], [['drohnenMax', '+', 2]],
    'Zwei Drohnen mehr.', 'Drohnen-Upgrades'),
  k('rotoren', 'auto', 'Leichtbaurotoren', 5, 810, 2.2, ['drohne'], [['drohnenRate', '*', 1.2]],
    'Drohnen tragen 20 % mehr.', 'Drohnen-Upgrades'),
  k('drohnenhafen', 'auto', 'Drohnenhafen', 1, 8100, 1, ['drohne', 'foerderband'], [['drohnenRate', '*', 2]],
    'Ein Landeplatz auf der Plattform. Drohnen tragen doppelt.'),

  // Wasser
  k('brunnen', 'wasser', 'Brunnenbohrung', 1, 7200, 1, ['elektrizitaet'], [['frei', 'brunnen']],
    'Ein Bohrloch im Hallenboden. Pulper und Papiermaschinen brauchen Wasser.'),
  k('wasserleitung', 'wasser', 'Wasserleitung', 1, 2700, 1, ['brunnen'], [['wasserMul', '*', 1.2]],
    'Rohre statt Eimer. 20 % mehr Wasser.'),
  k('pumpe', 'wasser', 'Stärkere Pumpe', 6, 3600, 2, ['brunnen'], [['wasserMul', '*', 1.2]],
    'Brunnen fördern 20 % mehr.', 'Brunnen-Upgrades'),
  k('tiefer', 'wasser', 'Tiefer bohren', 4, 6300, 2.2, ['brunnen'], [['wasserMul', '*', 1.15]],
    'Mehr Grundwasser.', 'Brunnen-Upgrades'),
  k('wasserweiche', 'wasser', 'Wasserweiche', 1, 5400, 1, ['wasserleitung'], [['wasserMul', '*', 1.1], ['verteilung', '+', 0.05]],
    'Teilt eine Leitung auf zwei Maschinen auf.'),
  k('filter', 'wasser', 'Wasserfilter', 3, 36000, 2.5, ['wasserweiche'], [['preis_brei', '*', 1.1], ['preis_papier', '*', 1.05]],
    'Sauberes Wasser, feinerer Brei.'),

  // Suche
  k('spule', 'suche', 'Empfindliche Spule', 5, 5, 2.2, ['scheune'], [['detektor', '*', 1.6]],
    'Der Metalldetektor schlägt 60 % früher an.', 'Detektor-Upgrades'),
  k('piepser', 'suche', 'Lauter Piepser', 1, 25, 1, ['scheune'], [['frei', 'piepser']],
    'Der Detektor sagt dir ungefähr, wie weit es noch ist.'),
  k('scanner', 'suche', 'Scanner-Pläne', 1, 900, 1, ['piepser', 'foerderband'], [['frei', 'scanner']],
    'Durchleuchtet das Heu auf dem Band. Ohne Scanner fallen Nadeln zurück in den Haufen.'),
  k('scanner2', 'suche', 'Breitbandscanner', 5, 8100, 2.2, ['scanner'], [['scanDeckung', '*', 1.5]],
    'Jeder Scanner schafft 50 % mehr Heu.', 'Scanner-Upgrades'),
  k('roentgen', 'suche', 'Röntgentunnel', 3, 117000, 3, ['scanner'], [['scanDeckung', '*', 2]],
    'Doppelte Scanleistung.'),
  k('radar', 'suche', 'Nadelradar-Pläne', 1, 16200, 1, ['scanner'], [['frei', 'radar']],
    'Ein Radar, das in Abständen die genaue Entfernung zur nächsten Nadel meldet.'),
  k('radar2', 'suche', 'Schnellerer Radar', 5, 21600, 2.2, ['radar'], [['radarCD', '*', 0.8]],
    'Der Radar pingt 20 % öfter.', 'Radar-Upgrades'),

  // Verkauf
  k('sauber', 'verkauf', 'Sauberes Heu', 5, 3, 1.9, ['scheune'], [['preisRoh', '*', 1.1]],
    'Ohne Staub und Steine zahlt der Stand 10 % mehr pro Halm.'),
  k('feilschen', 'verkauf', 'Feilschen', 5, 55, 2.1, ['sauber'], [['preisRoh', '*', 1.08]],
    'Mit dem Stand lässt sich reden. +8 % auf loses Heu.'),
  k('auftraege', 'verkauf', 'Auftragsbuch', 1, 1300, 1, ['feilschen', 'foerderband'], [['frei', 'auftraege']],
    'Ein Laster holt Waren ab und zahlt mehr als der Stand.'),
  k('laster', 'verkauf', 'Größerer Laster', 5, 5400, 2.2, ['auftraege'], [['auftragLohn', '*', 1.1]],
    'Aufträge bringen 10 % mehr.', 'Auftrags-Upgrades'),
  k('stand', 'verkauf', 'Verkaufsstand ausbauen', 1, 2300, 1, ['feilschen'], [['preisAlle', '*', 1.1]],
    'Ein richtiger Tresen mit Registrierkasse. Alles 10 % mehr wert.'),
  k('markt', 'verkauf', 'Wochenmarkt', 5, 9900, 2.2, ['stand'], [['preisAlle', '*', 1.1]],
    'Jeden Samstag. +10 % auf alle Preise.'),
  k('kredit', 'verkauf', 'Heu auf Rechnung', 1, 3600, 1, ['stand'], [['frei', 'kredit']],
    'Wer auf Rechnung bestellt, zahlt nur noch 10 % Aufschlag statt 50 %.'),
  k('nachtschicht', 'verkauf', 'Nachtschicht', 5, 3200, 2.2, ['stand'], [['offlineStunden', '+', 2]],
    'Die Halle läuft 2 Stunden länger weiter, während du weg bist.', 'Nacht-Upgrades'),
  k('nachtwaechter', 'verkauf', 'Nachtwächter', 5, 11900, 2.2, ['stand'], [['offlineEff', '+', 0.09]],
    'Nachts wird 9 % mehr geschafft.', 'Nacht-Upgrades'),

  // Fitness
  k('kraft', 'fitness', 'Mehr aufnehmen', 6, 1, 1.7, ['scheune'], [['griff', '+', 1]],
    'Ein Halm mehr pro Stich.', 'Kraft'),
  k('kondition', 'fitness', 'Kondition', 6, 4, 1.8, ['scheune'], [['ausdauer', '+', 15]],
    'Fünfzehn Ausdauer mehr.', 'Ausdauer'),
  k('atmung', 'fitness', 'Gleichmäßig atmen', 6, 6, 1.8, ['scheune'], [['ausdauerKosten', '*', 0.88]],
    'Jeder Stich kostet 12 % weniger Ausdauer.', 'Ausdauer'),
  k('erholung', 'fitness', 'Erholung', 5, 30, 2, ['scheune'], [['ausdauerRegen', '*', 1.3]],
    'Die Ausdauer kommt 30 % schneller zurück.', 'Ausdauer'),
  k('zweiter_atem', 'fitness', 'Zweiter Atem', 4, 60, 2, ['scheune'], [['erschoepft', '+', 0.1]],
    'Auch erschöpft schaffst du 10 % mehr.', 'Ausdauer'),
  k('blatt', 'fitness', 'Breiteres Blatt', 5, 35, 2, ['scheune'], [['griff', '+', 2]],
    'Zwei Halme mehr pro Stich.'),
  k('handschuh', 'fitness', 'Arbeitshandschuhe', 3, 90, 2.5, ['blatt'], [['krit', '+', 0.03]],
    '3 % Chance auf einen Glücksstich mit fünffacher Menge.'),
  k('staerke', 'fitness', 'Kräftiger Stich', 5, 2000, 2.2, ['handschuh'], [['griff', '+', 2]],
    'Zwei Halme mehr pro Stich.'),
  k('fluesterer', 'fitness', 'Heuflüsterer', 5, 39600, 2.5, ['staerke'], [['griff', '+', 2]],
    'Das Heu kommt dir entgegen. Zwei Halme mehr pro Stich.'),
  k('tempo1', 'fitness', 'Flinke Füße', 5, 2, 1.8, ['scheune'], [['laufzeit', '*', 0.9]],
    'Der Weg zum Stand dauert 10 % kürzer.', 'Tempo'),
  k('tempo2', 'fitness', 'Abkürzung', 5, 180, 2, ['scheune'], [['laufzeit', '*', 0.85]],
    'Hinter dem Balken durch. 15 % kürzer.', 'Tempo'),
  k('autotipp', 'fitness', 'Muskelgedächtnis', 3, 810, 2.5, ['blatt'], [['autotipp', '+', 0.5]],
    'Ein halber Stich pro Sekunde von allein. Kostet keine Ausdauer.'),
  k('autotipp2', 'fitness', 'Rhythmus', 3, 23400, 2.5, ['autotipp'], [['autotipp', '+', 0.5]],
    'Noch ein halber Stich pro Sekunde.'),
];

/* ------------------------------------------------------------ Maschinen */

// gruppe: foerderung | suche | strom | wasser | verarbeitung
// strom: >0 Verbrauch, <0 Erzeugung. wasser: >0 Verbrauch je Stück, <0 Förderung.
// rate: Grundleistung pro Sekunde — bei Förderung und Scannern in Halmen, bei
// Verarbeitern in fertigen Stücken. brennstoff: Halme pro Sekunde vom Band.
export const MASCHINEN = [
  { id: 'rechen', name: 'Kolbenrechen', gruppe: 'foerderung', frei: 'rechen', kosten: 60, faktor: 1.15,
    strom: 1, plaetze: 1, rate: 6, text: 'Schiebt 6 Halme pro Sekunde vom Haufen aufs Band.' },
  { id: 'arm', name: 'Greifarm', gruppe: 'foerderung', frei: 'arm', kosten: 800, faktor: 1.18,
    strom: 2, plaetze: 1, rate: 25, text: 'Holt 25 Halme pro Sekunde vom Haufen aufs Band.' },
  { id: 'rohrwerfer', name: 'Rohrwerfer', gruppe: 'foerderung', frei: 'rohrwerfer', kosten: 2500, faktor: 1.3,
    strom: 2, plaetze: 1, rate: 0.25, text: 'Eine zweite Strecke durch die Luft: das Band schafft 25 % mehr.' },
  { id: 'scanner', name: 'Scanner', gruppe: 'suche', frei: 'scanner', kosten: 700, faktor: 1.15,
    strom: 3, plaetze: 1, rate: 50, text: 'Prüft 50 Halme pro Sekunde auf Nadeln. Faustregel: einer für zwei Arme.' },
  { id: 'radar', name: 'Nadelradar', gruppe: 'suche', frei: 'radar', kosten: 4000, faktor: 1.5,
    strom: 2, plaetze: 1, text: 'Meldet regelmäßig, wie viele Halme es noch bis zur nächsten Nadel sind. Jeder weitere pingt öfter.' },
  { id: 'generator', name: 'Heu-Generator', gruppe: 'strom', frei: 'generator', kosten: 330, faktor: 1.15,
    strom: -15, plaetze: 1, brennstoff: 2, text: 'Verbrennt 2 Halme pro Sekunde vom Band für 15 Strom.' },
  { id: 'brunnen', name: 'Brunnen', gruppe: 'wasser', frei: 'brunnen', kosten: 1400, faktor: 1.15,
    strom: 3, wasser: -10, plaetze: 1, text: 'Pumpt 10 Wasser pro Sekunde.' },
  { id: 'silo', name: 'Silo', gruppe: 'verarbeitung', frei: 'silo', kosten: 90, faktor: 1.14,
    strom: 2, plaetze: 1, rate: 4, rezept: { halme: 5 }, produkt: 'knaeuel', text: 'Presst 20 Halme pro Sekunde zu Heuknäueln.' },
  { id: 'presse', name: 'Kompressor', gruppe: 'verarbeitung', frei: 'presse', kosten: 700, faktor: 1.14,
    strom: 4, plaetze: 1, rate: 2, rezept: { halme: 20 }, produkt: 'ballen', text: 'Presst 40 Halme pro Sekunde zu Pressballen.' },
  { id: 'pellet', name: 'Pelletpresse', gruppe: 'verarbeitung', frei: 'pellet', kosten: 7000, faktor: 1.15,
    strom: 6, plaetze: 1, rate: 6, rezept: { halme: 5 }, produkt: 'pellet', text: 'Mahlt 30 Halme pro Sekunde zu Pellets.' },
  { id: 'wickler', name: 'Wickler', gruppe: 'verarbeitung', frei: 'wickler', kosten: 28000, faktor: 1.15,
    strom: 5, plaetze: 1, rate: 2, rezept: { ballen: 1 }, produkt: 'silage', text: 'Wickelt 2 Ballen pro Sekunde in Folie.' },
  { id: 'pulper', name: 'Pulper', gruppe: 'verarbeitung', frei: 'pulper', kosten: 17000, faktor: 1.15,
    strom: 8, wasser: 4, plaetze: 1, rate: 3, rezept: { halme: 10 }, produkt: 'brei', text: 'Weicht 30 Halme pro Sekunde in Wasser zu Brei auf.' },
  { id: 'papier', name: 'Papiermaschine', gruppe: 'verarbeitung', frei: 'papier', kosten: 50000, faktor: 1.16,
    strom: 10, wasser: 3, plaetze: 2, rate: 1.5, rezept: { brei: 2 }, produkt: 'papier', text: 'Macht aus 3 Brei pro Sekunde Heupapier.' },
  { id: 'brikett', name: 'Ziegelpresse', gruppe: 'verarbeitung', frei: 'brikett', kosten: 170000, faktor: 1.17,
    strom: 14, plaetze: 2, rate: 2, rezept: { ballen: 1, brei: 2 }, produkt: 'brikett', text: 'Ein Ballen und zwei Brei werden zu einem Öko-Ziegel.' },
];

/** In dieser Reihenfolge greifen die Verarbeiter aufs Band zu: erst die Halm-
 *  Verbraucher, dann die, die Zwischenprodukte weiterverarbeiten. */
export const VERARBEITUNG_REIHE = ['pulper', 'presse', 'pellet', 'silo', 'brikett', 'papier', 'wickler'];

/** Zwischenprodukte, die weiterverarbeitet werden können. */
export const ZWISCHEN = ['ballen', 'brei'];

/** wert: Preis pro Stück bei 0,0222 pro losem Halm. Zahlt der Stand mehr, ziehen alle mit. */
export const PRODUKTE = {
  roh: { name: 'Loses Heu', wert: 0.0222, halme: 1 },
  knaeuel: { name: 'Heuknäuel', wert: 0.139, halme: 5 },
  ballen: { name: 'Pressballen', wert: 0.666, halme: 20 },
  pellet: { name: 'Pellets', wert: 0.244, halme: 5 },
  brei: { name: 'Heubrei', wert: 0.71, halme: 10 },
  silage: { name: 'Wickelballen', wert: 2.0, halme: 20 },
  papier: { name: 'Heupapier', wert: 3.0, halme: 20 },
  brikett: { name: 'Öko-Ziegel', wert: 5.33, halme: 40 },
};

/* ------------------------------------------------------------ Aufträge */

// Der Laster nimmt die ersten Stücke der gewünschten Ware, bis der Auftrag voll
// ist, und zahlt dann den Lohn. Nach der Liste geht es mit wachsenden Aufträgen
// weiter (siehe auftrag() in der Engine).
export const AUFTRAEGE = [
  { titel: 'Pferdehof Lindner', will: 'roh', menge: 2000, lohn: 90 },
  { titel: 'Kleintierzucht Wagner', will: 'knaeuel', menge: 100, lohn: 40 },
  { titel: 'Reitstall Brandt', will: 'ballen', menge: 20, lohn: 150 },
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

// Das Missionsbuch: immer eine offene Aufgabe, der Reihe nach. Die Art sagt
// der Engine, was sie prüft (siehe missionStand). Belohnung: Geld oder eine
// geschenkte Maschine (geschenk, samt ihren Plänen) oder eine geschenkte Forschungsstufe (geschenkTech).
export const MISSIONEN = [
  { text: 'Heb etwas Heu auf', art: 'tipps', ziel: 1, geld: 1 },
  { text: 'Bring 25 Halme zum Stand', art: 'verkauft', ziel: 25, geld: 1 },
  { text: 'Kauf einen Eimer', art: 'tech', ziel: 'eimer', geld: 2 },
  { text: 'Kauf die Heugabel', art: 'tech', ziel: 'heugabel', geld: 3 },
  { text: 'Halte den Detektor an den Haufen', art: 'werkzeug', ziel: 'detektor', geld: 2 },
  { text: 'Verdiene 30 $', art: 'verdient', ziel: 30, geld: 5 },
  { text: 'Feg verschüttetes Heu zusammen', art: 'gefegt', ziel: 50, geld: 10 },
  { text: 'Finde die erste Nadel', art: 'nadeln', ziel: 1, geld: 120 },
  { text: 'Kauf die Förderband-Pläne', art: 'tech', ziel: 'foerderband', geschenk: 'rechen' },
  { text: 'Stell einen zweiten Kolbenrechen auf', art: 'maschine', ziel: ['rechen', 2], geld: 150 },
  { text: 'Kauf Elektrizität', art: 'tech', ziel: 'elektrizitaet', geschenkTech: 'strommast' },
  { text: 'Bau einen Scanner', art: 'maschine', ziel: ['scanner', 1], geld: 600 },
  { text: 'Bau ein Silo', art: 'maschine', ziel: ['silo', 1], geld: 800 },
  { text: 'Kauf die Plattform-Pläne', art: 'tech', ziel: 'plattform', geschenkTech: 'schrank' },
  { text: 'Bau einen Greifarm', art: 'maschine', ziel: ['arm', 1], geld: 3000 },
  { text: 'Erfülle einen Auftrag', art: 'auftraege', ziel: 1, geld: 3000 },
  { text: 'Presse 100 Pressballen', art: 'produziert', ziel: ['ballen', 100], geld: 4000 },
  { text: 'Trag eine Million Halme ab', art: 'abgetragen', ziel: 1_000_000, geld: 5000 },
  { text: 'Finde drei Nadeln', art: 'nadeln', ziel: 3, geld: 6000 },
  { text: 'Bohr einen Brunnen', art: 'maschine', ziel: ['brunnen', 1], geld: 8000 },
  { text: 'Trag den Haufen zur Hälfte ab', art: 'haelfte', ziel: 0.5, geld: 15000 },
  { text: 'Stell 20 Greifarme auf', art: 'maschine', ziel: ['arm', 20], geld: 25000 },
  { text: 'Finde alle sechs Nadeln', art: 'nadeln', ziel: 6, geld: 30000 },
  { text: 'Bestell eine neue Ladung', art: 'ladungen', ziel: 2, geld: 30000 },
  { text: 'Mach 50 Bögen Heupapier', art: 'produziert', ziel: ['papier', 50], geld: 60000 },
  { text: 'Presse 100 Öko-Ziegel', art: 'produziert', ziel: ['brikett', 100], geld: 200000 },
  { text: 'Finde zwölf Nadeln', art: 'nadeln', ziel: 12, geld: 250000 },
  { text: 'Erforsche 200 Stufen', art: 'forschung', ziel: 200, geld: 250000 },
  { text: 'Finde alle 24 Nadelarten', art: 'arten', ziel: 24, geld: 2_000_000 },
];
