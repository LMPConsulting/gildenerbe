// Alle Zahlen des Spiels an einer Stelle: Techtree, Maschinen, Produkte,
// Fundstücke, Nadeln und die kleinen Geschichten dazwischen. Die Engine liest
// nur hieraus; wer umbalanciert, fasst ausschließlich diese Datei an.

/** Grundwerte, bevor irgendein Upgrade greift. */
export const GRUND = {
  griff: 2,            // Halme pro Stich mit der Schaufel
  werkzeug: 1,         // Faktor auf den Griff durch Werkzeuge
  krit: 0,             // Chance auf einen Glücksgriff
  kritFaktor: 5,
  tasche: 25,          // Halme, die man tragen kann
  laufzeit: 4,         // Sekunden bis zum Ankauf und zurück
  autotipp: 0,         // Tipps pro Sekunde, die von allein passieren
  saugerRate: 25,      // Halme pro Sekunde, solange man hält
  saugerHitze: 6,      // Sekunden bis zur Überhitzung
  drohnenMax: 0,
  drohnenRate: 2,
  detektor: 3000,      // Reichweite in Halmen
  fundChance: 0.0005,  // Fundstücke pro Halm
  fundWert: 1,
  preisRoh: 0.1,       // was der Ankauf pro Halm zahlt
  preisAlle: 1,
  preisProdukt: 1,
  armTempo: 1,
  baggerTempo: 1,
  band: 40,            // Förderband: Halme pro Sekunde
  scanDeckung: 1,
  sortDeckung: 1,
  stromMul: 1,
  verbrauch: 1,
  kesselMul: 1,
  verarbeitung: 1,
  ausbeute: 1,         // Anteil der Eingangsmenge, der pro Stück gebraucht wird
  plaetze: 0,
  maschinenKosten: 1,
  maschinenTempo: 1,
  offlineStunden: 2,
  offlineEff: 0.5,
};

export const HAUFEN_GROESSE = 6_000_000;

/** Wo die sechs Nadeln stecken können, als Anteil des Haufens von oben. */
export const NADEL_BEREICHE = [
  [0.003, 0.01], [0.02, 0.06], [0.08, 0.2], [0.25, 0.45], [0.5, 0.75], [0.8, 0.99],
];

export const NADELN = [
  { name: 'Rostige Nähnadel', bonus: 'Griff +1 %', effekt: [['griff', '*', 1.01]] },
  { name: 'Stopfnadel', bonus: 'Tasche +1 Halm', effekt: [['tasche', '+', 1]] },
  { name: 'Stecknadel', bonus: 'Der Ankauf zahlt 1 % mehr', effekt: [['preisRoh', '*', 1.01]] },
  { name: 'Sticknadel', bonus: 'Greifarme 2 % schneller', effekt: [['armTempo', '*', 1.02]] },
  { name: 'Kompassnadel', bonus: 'Detektor reicht 5 % weiter', effekt: [['detektor', '*', 1.05]] },
  { name: 'Goldene Nadel', bonus: 'Alles 5 % mehr wert', effekt: [['preisAlle', '*', 1.05]] },
];

export const GESCHICHTE = {
  anfang: [
    'Du wachst in einer Lagerhalle auf. Die Tore sind zu, das Licht brennt, '
      + 'und du weißt nicht, wie du hergekommen bist.',
    'Vor dir ein Heuhaufen bis unters Dach. Auf einem Zettel am Pfosten steht: '
      + '„Rund sechs Millionen Halme. Sechs Nadeln. Finde sie.“',
    'Neben dir liegen eine Schaufel und ein Metalldetektor. In der Wand ist eine Klappe '
      + 'mit dem Schild „Heu-Ankauf“. Wer auf der anderen Seite bezahlt, sieht man nicht.',
  ],
  nadeln: [
    'Etwas sticht dich in den Daumen. Eine Nähnadel, rostig, völlig wertlos. '
      + 'Auf der Rückseite des Zettels steht plötzlich: „Eine.“',
    'Die zweite Nadel ist dicker, eine Stopfnadel. Irgendwo hinter dem Haufen klackt ein Schloss. '
      + 'Die Tore bleiben trotzdem zu.',
    'Eine Stecknadel mit rotem Kopf. Jemand hat sie mit Absicht hier versteckt, '
      + 'da bist du dir jetzt sicher. Durch die Ankaufklappe kommt ein Zettel: „Weiter.“',
    'Die Sticknadel liegt in einem Bett aus besonders ordentlichem Heu. '
      + 'Hat hier jemand vor dir gesucht? Auf dem Boden: Kratzspuren, die zum Haufen führen.',
    'Eine Kompassnadel. Sie zeigt nicht nach Norden, sondern stur auf die Ankaufklappe. '
      + 'Von drüben hörst du jemanden lachen.',
    'Die sechste Nadel ist aus Gold. Die Tore springen auf, draußen ist heller Tag. '
      + 'Auf dem Zettel steht nur noch: „Danke.“',
  ],
  ende: 'Die Halle ist leer, die Nadeln sind gefunden. Draußen steht eine zweite Halle, '
    + 'die Tore offen, darin ein noch größerer Haufen. Auf dem Pfosten: ein neuer Zettel.',
};

/* ------------------------------------------------------------ Techtree */

export const AESTE = [
  { id: 'hand', name: 'Hofarbeit', farbe: '#e2b04a' },
  { id: 'werkzeug', name: 'Werkzeug', farbe: '#e07b39' },
  { id: 'halle', name: 'Hofbau', farbe: '#c4a07a' },
  { id: 'erkennung', name: 'Erkennung', farbe: '#4fb3a9' },
  { id: 'foerderung', name: 'Förderung', farbe: '#5b8fd6' },
  { id: 'strom', name: 'Strom', farbe: '#b5c94a' },
  { id: 'verarbeitung', name: 'Verarbeitung', farbe: '#9b7ad8' },
  { id: 'handel', name: 'Handel', farbe: '#d4607a' },
];

// Kurzschreibweise: id, Ast, Name, Stufen, Grundkosten, Kostenfaktor je Stufe,
// Voraussetzungen, Effekte je Stufe, Beschreibung.
// Effekt: [wert, '+', x] addiert je Stufe, [wert, '*', x] multipliziert je
// Stufe, ['frei', name] schaltet etwas frei.
const k = (id, ast, name, stufen, kosten, faktor, braucht, effekt, text) =>
  ({ id, ast, name, stufen, kosten, faktor, braucht, effekt, text });

export const TECH = [
  k('scheune', null, 'Start', 1, 0, 1, [], [], 'Eine Schaufel, ein Metalldetektor und sehr viel Heu.'),

  // Handel
  k('sauber', 'handel', 'Sauberes Heu', 5, 12, 1.9, ['scheune'], [['preisRoh', '*', 1.15]],
    'Ohne Staub und Steine zahlt der Ankauf 15 % mehr pro Halm.'),
  k('feilschen', 'handel', 'Feilschen', 5, 250, 2.1, ['sauber'], [['preisRoh', '*', 1.1]],
    'Mit der Klappe lässt sich reden. +10 % auf rohes Heu.'),
  k('troedler', 'handel', 'Trödler', 1, 2000, 1, ['feilschen'], [['fundWert', '*', 1.5]],
    'Ein Händler, der Fundstücke 50 % teurer abnimmt.'),
  k('stand', 'handel', 'Heu-Verkaufsstand', 1, 6000, 1, ['feilschen', 'automatisierung'], [['preisAlle', '*', 1.1]],
    'Das Band endet direkt am Stand. Alles 10 % mehr wert.'),
  k('markt', 'handel', 'Wochenmarkt', 5, 25000, 2.2, ['stand'], [['preisAlle', '*', 1.1]],
    'Jeden Samstag. +10 % auf alle Preise.'),
  k('export', 'handel', 'Export', 5, 400000, 2.4, ['markt'], [['preisAlle', '*', 1.15]],
    'Heu aus dieser Halle ist im Ausland gefragt. +15 %.'),
  k('bio', 'handel', 'Bio-Siegel', 3, 1.5e6, 2.8, ['export'], [['preisProdukt', '*', 1.2]],
    'Verarbeitete Waren 20 % teurer.'),
  k('marke', 'handel', 'Eigene Marke', 3, 5e6, 3, ['export'], [['preisAlle', '*', 1.25]],
    '„Aus der Halle“. +25 % auf alles.'),
  k('nachtschicht', 'handel', 'Nachtschicht', 5, 8000, 2.2, ['stand'], [['offlineStunden', '+', 2]],
    'Die Halle läuft 2 Stunden länger weiter, während du weg bist.'),
  k('nachtwaechter', 'handel', 'Nachtwächter', 5, 30000, 2.2, ['nachtschicht'], [['offlineEff', '+', 0.1]],
    'Nachts wird 10 % mehr geschafft.'),

  // Hände
  k('griff1', 'hand', 'Tiefer stechen', 5, 3, 1.6, ['scheune'], [['griff', '+', 1]],
    'Ein Halm mehr pro Schaufelstich.'),
  k('griff2', 'hand', 'Breites Blatt', 5, 150, 2, ['griff1'], [['griff', '+', 1]],
    'Noch ein Halm mehr pro Stich.'),
  k('handschuh', 'hand', 'Arbeitshandschuhe', 3, 400, 2.5, ['griff2'], [['krit', '+', 0.03]],
    '3 % Chance auf einen Glücksstich mit fünffacher Menge.'),
  k('griff3', 'hand', 'Bärenkräfte', 5, 5000, 2.2, ['handschuh'], [['griff', '+', 1]],
    'Ein Halm mehr pro Stich.'),
  k('griff4', 'hand', 'Heuflüsterer', 5, 100000, 2.5, ['griff3'], [['griff', '+', 1]],
    'Das Heu kommt dir entgegen. Noch ein Halm mehr pro Stich.'),
  k('autotipp', 'hand', 'Muskelgedächtnis', 3, 2000, 2.5, ['griff2'], [['autotipp', '+', 1]],
    'Ein Stich pro Sekunde von allein. Ist die Tasche voll, gehst du selbst zum Ankauf.'),
  k('autotipp2', 'hand', 'Rhythmus', 3, 60000, 2.5, ['autotipp'], [['autotipp', '+', 1]],
    'Noch ein Stich pro Sekunde.'),
  k('tasche1', 'hand', 'Größere Tasche', 5, 5, 1.7, ['scheune'], [['tasche', '+', 10]],
    'Zehn Halme mehr pro Gang.'),
  k('tasche2', 'hand', 'Rucksack', 5, 200, 1.9, ['tasche1'], [['tasche', '+', 40]],
    'Vierzig Halme mehr pro Gang.'),
  k('tasche3', 'hand', 'Heusack', 5, 3000, 2, ['tasche2'], [['tasche', '+', 50]],
    'Fünfzig Halme mehr pro Gang.'),
  k('tasche4', 'hand', 'Bodenloser Sack', 5, 150000, 2.5, ['tasche3'], [['tasche', '+', 150]],
    'Hundertfünfzig Halme mehr. Wo das hingeht, will man nicht wissen.'),
  k('tempo1', 'hand', 'Flinke Füße', 5, 10, 1.8, ['tasche1'], [['laufzeit', '*', 0.9]],
    'Der Weg zum Ankauf dauert 10 % kürzer.'),
  k('tempo2', 'hand', 'Abkürzung', 5, 800, 2, ['tempo1'], [['laufzeit', '*', 0.85]],
    'Hinter dem Balken durch. 15 % kürzer.'),
  k('rutsche', 'hand', 'Rutsche zum Ankauf', 1, 25000, 1, ['tempo2'], [['laufzeit', '*', 0.5]],
    'Eine Rutsche vom Haufen zur Klappe. Der Weg dauert halb so lang.'),

  // Werkzeug
  k('eimer', 'werkzeug', 'Eimer', 1, 8, 1, ['scheune'], [['tasche', '+', 25]],
    'Fünfundzwanzig Halme mehr pro Gang.'),
  k('schubkarre', 'werkzeug', 'Schubkarre', 1, 60, 1, ['eimer'], [['tasche', '*', 2], ['laufzeit', '*', 0.9]],
    'Doppelte Tasche, und rollen geht schneller als tragen.'),
  k('stapelpresse', 'werkzeug', 'Handpresse', 1, 2000, 1, ['schubkarre'], [['tasche', '*', 1.5]],
    'Presst das Heu in der Karre zusammen. 50 % mehr Platz.'),
  k('heugabel', 'werkzeug', 'Heugabel', 1, 25, 1, ['scheune'], [['werkzeug', '*', 1.5], ['frei', 'heugabel']],
    '50 % mehr pro Stich als mit der Schaufel.'),
  k('rechen', 'werkzeug', 'Zinken nachschärfen', 3, 40, 2, ['heugabel'], [['griff', '+', 1]],
    'Ein Halm mehr pro Stich.'),
  k('doppelgabel', 'werkzeug', 'Doppelgabel', 1, 400, 1, ['rechen'], [['werkzeug', '*', 1.25], ['frei', 'doppelgabel']],
    'Zwei Gabeln an einem Stiel. 25 % mehr pro Stich.'),
  k('gabelstapler', 'werkzeug', 'Heu-Gabelstapler', 1, 400000, 1, ['doppelgabel', 'stapelpresse'],
    [['werkzeug', '*', 1.2], ['tasche', '*', 1.5], ['frei', 'gabelstapler']],
    '20 % mehr pro Stich, 50 % mehr Tasche.'),
  k('sauger', 'werkzeug', 'Staubsauger', 1, 70, 1, ['heugabel'], [['frei', 'sauger']],
    'Gedrückt halten: saugt 25 Halme pro Sekunde, bis er zu heiß wird.'),
  k('sauger2', 'werkzeug', 'Turbo-Motor', 5, 500, 2.1, ['sauger'], [['saugerRate', '*', 1.25]],
    '25 % mehr Sog.'),
  k('kuehlung', 'werkzeug', 'Kühlrippen', 5, 600, 2, ['sauger'], [['saugerHitze', '*', 1.3]],
    'Hält 30 % länger durch.'),
  k('industriesauger', 'werkzeug', 'Industriesauger', 1, 20000, 1, ['sauger2', 'kuehlung'],
    [['saugerRate', '*', 2], ['saugerHitze', '*', 1.5]],
    'Doppelter Sog, länger kühl.'),
  k('saugrohr', 'werkzeug', 'Langes Saugrohr', 5, 60000, 2.4, ['industriesauger'], [['saugerRate', '*', 1.2]],
    'Erreicht auch die Mitte des Haufens. +20 % Sog.'),

  // Erkennung
  k('spule', 'erkennung', 'Empfindliche Spule', 5, 20, 2.2, ['scheune'], [['detektor', '*', 1.6]],
    'Der Metalldetektor schlägt 60 % früher an.'),
  k('piepser', 'erkennung', 'Lauter Piepser', 1, 100, 1, ['spule'], [['frei', 'piepser']],
    'Der Detektor sagt dir ungefähr, wie weit es noch ist.'),
  k('kompass', 'erkennung', 'Nadelkompass', 1, 500000, 1, ['piepser', 'scanner2'], [['frei', 'kompass']],
    'Zeigt auf den Halm genau, wie weit die nächste Nadel entfernt ist.'),
  k('magnet', 'erkennung', 'Hufeisenmagnet', 3, 50, 2.5, ['scheune'], [['fundChance', '*', 1.3]],
    '30 % mehr Fundstücke.'),
  k('lupe', 'erkennung', 'Lupe', 3, 400, 2.5, ['magnet'], [['fundWert', '*', 1.3]],
    'Du erkennst, was etwas wert ist. +30 % für Fundstücke.'),
  k('sammler', 'erkennung', 'Sammlerauge', 5, 5000, 2.3, ['lupe'], [['fundChance', '*', 1.2]],
    '20 % mehr Fundstücke.'),
  k('antiquar', 'erkennung', 'Antiquar-Kontakte', 5, 40000, 2.4, ['sammler'], [['fundWert', '*', 1.4]],
    '40 % mehr für Fundstücke.'),
  k('scanner', 'erkennung', 'Scanner', 1, 5000, 1, ['piepser', 'automatisierung'], [['frei', 'scanner']],
    'Durchleuchtet das Heu auf dem Band. Ohne Scanner rutschen Nadeln in den Ausschuss.'),
  k('scanner2', 'erkennung', 'Breitbandscanner', 5, 20000, 2.2, ['scanner'], [['scanDeckung', '*', 1.5]],
    'Jeder Scanner schafft 50 % mehr Heu.'),
  k('roentgen', 'erkennung', 'Röntgentunnel', 3, 300000, 3, ['scanner2'], [['scanDeckung', '*', 2]],
    'Doppelte Scanleistung.'),
  k('sortierer', 'erkennung', 'Fundsortierer', 1, 15000, 1, ['scanner', 'lupe'], [['frei', 'sortierer']],
    'Holt Fundstücke vom Band, statt sie mitzuverkaufen.'),
  k('sortierer2', 'erkennung', 'Feinsieb', 5, 60000, 2.3, ['sortierer'], [['sortDeckung', '*', 1.5]],
    'Jeder Sortierer schafft 50 % mehr.'),
  k('sichter', 'erkennung', 'Nadelsichter', 1, 30000, 1, ['scanner'], [['frei', 'sichter']],
    'Durchsucht den Ausschuss von allein.'),

  // Förderung
  k('drohne', 'foerderung', 'Heudrohne', 1, 300, 1, ['scheune'], [['frei', 'drohne'], ['drohnenMax', '+', 3]],
    'Kleine Drohnen fliegen Heu zum Ankauf. Bis zu drei.'),
  k('schwarm', 'foerderung', 'Drohnenschwarm', 5, 1500, 2, ['drohne'], [['drohnenMax', '+', 2]],
    'Zwei Drohnen mehr.'),
  k('rotoren', 'foerderung', 'Leichtbaurotoren', 5, 2000, 2.2, ['drohne'], [['drohnenRate', '*', 1.2]],
    'Drohnen tragen 20 % mehr.'),
  k('drohnenhafen', 'foerderung', 'Drohnenhafen', 1, 20000, 1, ['rotoren', 'automatisierung'], [['drohnenRate', '*', 2]],
    'Ein Landeplatz auf dem Dach. Drohnen tragen doppelt.'),
  k('automatisierung', 'foerderung', 'Automatisierung', 1, 5000, 1, ['drohne'],
    [['frei', 'halle'], ['plaetze', '+', 20]],
    'Förderbänder und Greifarme. Ab jetzt trägt sich der Haufen selbst ab.'),
  k('bandtechnik', 'foerderung', 'Bandtechnik', 9, 4000, 2.9, ['automatisierung'], [['band', '*', 1.6]],
    'Das Förderband transportiert 60 % mehr.'),
  k('hydraulik', 'foerderung', 'Hydraulik', 10, 3000, 1.8, ['automatisierung'], [['armTempo', '*', 1.1]],
    'Greifarme 10 % schneller.'),
  k('serie', 'foerderung', 'Serienfertigung', 5, 20000, 2.3, ['hydraulik'], [['maschinenKosten', '*', 0.9]],
    'Alle Maschinen 10 % billiger.'),
  k('doppelgreifer', 'foerderung', 'Doppelgreifer', 5, 50000, 2.5, ['hydraulik'], [['armTempo', '*', 1.15]],
    'Greifarme 15 % schneller.'),
  k('robotik', 'foerderung', 'Robotik', 5, 500000, 3, ['doppelgreifer'], [['armTempo', '*', 1.2]],
    'Greifarme 20 % schneller.'),
  k('bagger', 'foerderung', 'Heubagger', 1, 250000, 1, ['doppelgreifer'], [['frei', 'bagger']],
    'Ein Bagger, der so viel schafft wie fünfzehn Arme.'),
  k('schaufelrad', 'foerderung', 'Schaufelrad', 5, 1e6, 2.5, ['bagger'], [['baggerTempo', '*', 1.4]],
    'Bagger 40 % schneller.'),

  // Strom
  k('stromnetz', 'strom', 'Strommasten', 1, 3000, 1, ['automatisierung'], [['frei', 'generator']],
    'Heu-Generatoren, die mit Halmen vom Band gefüttert werden.'),
  k('kessel', 'strom', 'Dampfkessel', 1, 8000, 1, ['stromnetz'], [['frei', 'kessel']],
    'Verbrennt mehr Heu und macht daraus viel mehr Strom.'),
  k('turbine', 'strom', 'Dampfturbine', 3, 50000, 2.5, ['kessel'], [['kesselMul', '*', 1.5]],
    'Kessel liefern 50 % mehr.'),
  k('biogas', 'strom', 'Biogasreaktor', 1, 400000, 1, ['turbine'], [['frei', 'biogas']],
    'Vergärt Heu zu sehr viel Strom.'),
  k('fusion', 'strom', 'Heu-Fusion', 1, 2e7, 1, ['biogas', 'speicher'], [['frei', 'fusion']],
    'Niemand weiß, wie das funktioniert. Es funktioniert.'),
  k('wind', 'strom', 'Windrad', 1, 30000, 1, ['stromnetz'], [['frei', 'wind']],
    'Strom ohne Brennstoff.'),
  k('solar', 'strom', 'Solardach', 1, 150000, 1, ['wind'], [['frei', 'solar']],
    'Mehr Strom ohne Brennstoff.'),
  k('leitungen', 'strom', 'Kupferleitungen', 5, 10000, 2.2, ['stromnetz'], [['stromMul', '*', 1.15]],
    'Alle Stromquellen liefern 15 % mehr.'),
  k('speicher', 'strom', 'Batteriespeicher', 3, 80000, 2.5, ['leitungen'], [['stromMul', '*', 1.1]],
    'Weniger Verlust, 10 % mehr Strom.'),
  k('sparmotor', 'strom', 'Sparmotoren', 5, 15000, 2.2, ['stromnetz'], [['verbrauch', '*', 0.9]],
    'Maschinen brauchen 10 % weniger Strom.'),

  // Verarbeitung
  k('presse', 'verarbeitung', 'Ballenpresse', 1, 4000, 1, ['automatisierung'], [['frei', 'presse']],
    'Presst lose Halme zu Ballen. Ballen bringen 50 % mehr pro Halm.'),
  k('pressdruck', 'verarbeitung', 'Pressdruck', 5, 10000, 2.2, ['presse'], [['presse', '*', 1.3]],
    'Pressen 30 % schneller.'),
  k('ballenwert', 'verarbeitung', 'Straffe Ballen', 5, 12000, 2.2, ['presse'], [['preis_ballen', '*', 1.15]],
    'Ballen 15 % mehr wert.'),
  k('wickler', 'verarbeitung', 'Heuwickler', 1, 100000, 1, ['pressdruck'], [['frei', 'wickler']],
    'Wickelt Ballen in Folie. Wickelballen sind fast doppelt so viel wert.'),
  k('silagewert', 'verarbeitung', 'Gute Folie', 5, 150000, 2.3, ['wickler'], [['preis_silage', '*', 1.2]],
    'Wickelballen 20 % mehr wert.'),
  k('verteiler', 'verarbeitung', 'Weichen & Verteiler', 3, 30000, 2.5, ['presse'], [['verarbeitung', '*', 1.15]],
    'Alle Verarbeiter 15 % schneller.'),
  k('muehle', 'verarbeitung', 'Pelletmühle', 1, 25000, 1, ['presse'], [['frei', 'muehle']],
    'Mahlt Halme zu Pellets.'),
  k('matrize', 'verarbeitung', 'Feinere Matrize', 5, 40000, 2.2, ['muehle'], [['muehle', '*', 1.3]],
    'Mühlen 30 % schneller.'),
  k('verschnitt', 'verarbeitung', 'Sauberer Schnitt', 5, 250000, 2.4, ['muehle'], [['ausbeute', '*', 0.93]],
    'Jedes Produkt braucht 7 % weniger Heu.'),
  k('pulper', 'verarbeitung', 'Heubrei-Pulper', 1, 60000, 1, ['muehle'], [['frei', 'pulper']],
    'Weicht Heu zu Brei auf.'),
  k('pulper2', 'verarbeitung', 'Rührwerk', 5, 100000, 2.3, ['pulper'], [['pulper', '*', 1.3]],
    'Pulper 30 % schneller.'),
  k('papier', 'verarbeitung', 'Papiermaschine', 1, 200000, 1, ['pulper'], [['frei', 'papier']],
    'Macht aus Heubrei Heupapier.'),
  k('buettenrand', 'verarbeitung', 'Büttenrand', 5, 300000, 2.3, ['papier'], [['preis_papier', '*', 1.2]],
    'Heupapier 20 % mehr wert.'),
  k('ziegel', 'verarbeitung', 'Öko-Ziegelpresse', 1, 600000, 1, ['pulper', 'wickler'], [['frei', 'ziegel']],
    'Ballen und Brei werden zu Öko-Ziegeln. Das Beste, was aus Heu werden kann.'),
  k('ziegel2', 'verarbeitung', 'Brennofen', 5, 1e6, 2.4, ['ziegel'], [['ziegel', '*', 1.3]],
    'Ziegelpressen 30 % schneller.'),
  k('qualitaet', 'verarbeitung', 'Qualitätskontrolle', 5, 500000, 2.5, ['verteiler', 'matrize'], [['preisProdukt', '*', 1.1]],
    'Verarbeitete Waren 10 % mehr wert.'),

  // Hofbau
  k('schuppen', 'halle', 'Schuppen erweitern', 4, 150, 2.2, ['scheune'], [['tasche', '+', 15], ['plaetze', '+', 5]],
    'Mehr Platz neben dem Haufen: 15 Halme mehr pro Gang, später 5 Stellplätze mehr.'),
  k('material', 'halle', 'Weniger Materialverschnitt', 3, 100, 2.4, ['scheune'], [['maschinenKosten', '*', 0.95]],
    'Alles, was du baust, wird 5 % billiger.'),
  k('anbau', 'halle', 'Anbau', 10, 5000, 1.9, ['schuppen', 'automatisierung'], [['plaetze', '+', 10]],
    'Zehn Stellplätze mehr.'),
  k('dach', 'halle', 'Hohes Dach', 1, 50000, 1, ['anbau'], [['plaetze', '+', 25]],
    'Fünfundzwanzig Stellplätze mehr.'),
  k('zweitehalle', 'halle', 'Zweite Halle', 1, 2e6, 1, ['dach'], [['plaetze', '+', 100]],
    'Hundert Stellplätze mehr.'),
  k('kran', 'halle', 'Hallenkran', 3, 40000, 2.5, ['material', 'automatisierung'], [['maschinenKosten', '*', 0.9]],
    'Aufbauen wird 10 % billiger.'),
  k('flutlicht', 'halle', 'Flutlicht', 3, 25000, 2.5, ['anbau'], [['maschinenTempo', '*', 1.05]],
    'Alle Maschinen 5 % schneller.'),
  k('ordnung', 'halle', 'Ordnung muss sein', 3, 200000, 3, ['flutlicht'], [['maschinenTempo', '*', 1.1]],
    'Alle Maschinen 10 % schneller.'),
];

/* ------------------------------------------------------------ Maschinen */

// gruppe: foerderung | erkennung | strom | verarbeitung
// strom: >0 Verbrauch, <0 Erzeugung. rate: Grundleistung pro Sekunde — bei
// Förderung und Erkennung in Halmen, bei Verarbeitern in fertigen Stücken.
export const MASCHINEN = [
  { id: 'arm', name: 'Greifarm', gruppe: 'foerderung', frei: 'halle', kosten: 600, faktor: 1.15,
    strom: 2, plaetze: 1, rate: 8, text: 'Holt 8 Halme pro Sekunde vom Haufen aufs Band.' },
  { id: 'bagger', name: 'Heubagger', gruppe: 'foerderung', frei: 'bagger', kosten: 200000, faktor: 1.2,
    strom: 15, plaetze: 3, rate: 120, text: '120 Halme pro Sekunde. Braucht drei Stellplätze.' },
  { id: 'scanner', name: 'Scanner', gruppe: 'erkennung', frei: 'scanner', kosten: 2000, faktor: 1.15,
    strom: 3, plaetze: 1, rate: 16, text: 'Prüft 16 Halme pro Sekunde auf Nadeln. Faustregel: einer für zwei Arme.' },
  { id: 'sortierer', name: 'Fundsortierer', gruppe: 'erkennung', frei: 'sortierer', kosten: 12000, faktor: 1.2,
    strom: 3, plaetze: 1, rate: 50, text: 'Sucht in 50 Halmen pro Sekunde nach Fundstücken.' },
  { id: 'sichter', name: 'Nadelsichter', gruppe: 'erkennung', frei: 'sichter', kosten: 25000, faktor: 1.5,
    strom: 2, plaetze: 1, rate: 1 / 90, text: 'Findet eine Nadel im Ausschuss in 90 Sekunden.' },
  { id: 'generator', name: 'Heu-Generator', gruppe: 'strom', frei: 'generator', kosten: 1500, faktor: 1.15,
    strom: -15, plaetze: 1, brennstoff: 2, text: 'Verbrennt 2 Halme pro Sekunde vom Band für 15 Strom.' },
  { id: 'kessel', name: 'Dampfkessel', gruppe: 'strom', frei: 'kessel', kosten: 6000, faktor: 1.15,
    strom: -50, plaetze: 1, brennstoff: 5, text: 'Verbrennt 5 Halme pro Sekunde für 50 Strom.' },
  { id: 'wind', name: 'Windrad', gruppe: 'strom', frei: 'wind', kosten: 20000, faktor: 1.15,
    strom: -25, plaetze: 1, text: 'Liefert 25 Strom, ohne etwas zu verbrauchen.' },
  { id: 'solar', name: 'Solardach', gruppe: 'strom', frei: 'solar', kosten: 100000, faktor: 1.15,
    strom: -80, plaetze: 1, text: 'Liefert 80 Strom.' },
  { id: 'biogas', name: 'Biogasreaktor', gruppe: 'strom', frei: 'biogas', kosten: 300000, faktor: 1.18,
    strom: -400, plaetze: 2, brennstoff: 40, text: 'Vergärt 40 Halme pro Sekunde zu 400 Strom.' },
  { id: 'fusion', name: 'Heu-Fusion', gruppe: 'strom', frei: 'fusion', kosten: 1.5e7, faktor: 1.3,
    strom: -5000, plaetze: 4, text: 'Liefert 5000 Strom. Aus einem einzigen Halm, angeblich.' },
  { id: 'presse', name: 'Ballenpresse', gruppe: 'verarbeitung', frei: 'presse', kosten: 3000, faktor: 1.14,
    strom: 4, plaetze: 1, rate: 2, rezept: { halme: 20 }, produkt: 'ballen', text: 'Presst 40 Halme pro Sekunde zu Ballen.' },
  { id: 'muehle', name: 'Pelletmühle', gruppe: 'verarbeitung', frei: 'muehle', kosten: 20000, faktor: 1.15,
    strom: 6, plaetze: 1, rate: 6, rezept: { halme: 5 }, produkt: 'pellet', text: 'Mahlt 30 Halme pro Sekunde zu Pellets.' },
  { id: 'pulper', name: 'Heubrei-Pulper', gruppe: 'verarbeitung', frei: 'pulper', kosten: 50000, faktor: 1.15,
    strom: 8, plaetze: 1, rate: 3, rezept: { halme: 10 }, produkt: 'brei', text: 'Weicht 30 Halme pro Sekunde zu Brei auf.' },
  { id: 'wickler', name: 'Heuwickler', gruppe: 'verarbeitung', frei: 'wickler', kosten: 80000, faktor: 1.15,
    strom: 5, plaetze: 1, rate: 2, rezept: { ballen: 1 }, produkt: 'silage', text: 'Wickelt 2 Ballen pro Sekunde in Folie.' },
  { id: 'papier', name: 'Papiermaschine', gruppe: 'verarbeitung', frei: 'papier', kosten: 150000, faktor: 1.16,
    strom: 10, plaetze: 2, rate: 1.5, rezept: { brei: 2 }, produkt: 'papier', text: 'Macht aus 3 Brei pro Sekunde Heupapier.' },
  { id: 'ziegel', name: 'Öko-Ziegelpresse', gruppe: 'verarbeitung', frei: 'ziegel', kosten: 500000, faktor: 1.17,
    strom: 14, plaetze: 2, rate: 1, rezept: { ballen: 1, brei: 2 }, produkt: 'ziegel', text: 'Ein Ballen und zwei Brei werden zu einem Ziegel.' },
];

/** In dieser Reihenfolge greifen die Verarbeiter aufs Band zu: erst die Halm-
 *  Verbraucher, dann die, die Zwischenprodukte weiterverarbeiten. */
export const VERARBEITUNG_REIHE = ['pulper', 'presse', 'muehle', 'ziegel', 'papier', 'wickler'];

/** wert: Preis pro Stück bei 0,10 pro rohem Halm. Zahlt der Ankauf mehr, ziehen alle mit. */
export const PRODUKTE = {
  roh: { name: 'Loses Heu', wert: 0.1 },
  ballen: { name: 'Pressballen', wert: 3 },
  pellet: { name: 'Heupellets', wert: 1.1 },
  brei: { name: 'Heubrei', wert: 3.2 },
  silage: { name: 'Wickelballen', wert: 5.5 },
  papier: { name: 'Heupapier', wert: 9 },
  ziegel: { name: 'Öko-Ziegel', wert: 24 },
};

/* ------------------------------------------------------------ Fundstücke */

export const SELTENHEIT = [
  { id: 'gewoehnlich', name: 'gewöhnlich', gewicht: 60, farbe: '#b9ad94' },
  { id: 'selten', name: 'selten', gewicht: 25, farbe: '#6fb3e0' },
  { id: 'episch', name: 'episch', gewicht: 10, farbe: '#b58be8' },
  { id: 'legendaer', name: 'legendär', gewicht: 4, farbe: '#f0b43c' },
  { id: 'mythisch', name: 'mythisch', gewicht: 1, farbe: '#ff7a59' },
];

export const FUNDE = [
  { id: 'knopf', name: 'Hosenknopf', stufe: 'gewoehnlich', wert: 0.5 },
  { id: 'kronkorken', name: 'Kronkorken', stufe: 'gewoehnlich', wert: 0.3 },
  { id: 'murmel', name: 'Murmel', stufe: 'gewoehnlich', wert: 0.8 },
  { id: 'nagel', name: 'Krummer Nagel', stufe: 'gewoehnlich', wert: 0.2 },
  { id: 'feder', name: 'Hühnerfeder', stufe: 'gewoehnlich', wert: 0.4 },
  { id: 'muenze', name: 'Kupfermünze', stufe: 'gewoehnlich', wert: 1 },
  { id: 'hufeisen', name: 'Hufeisen', stufe: 'selten', wert: 4 },
  { id: 'schluessel', name: 'Alter Schlüssel', stufe: 'selten', wert: 6 },
  { id: 'fingerhut', name: 'Fingerhut', stufe: 'selten', wert: 5 },
  { id: 'loeffel', name: 'Blechlöffel', stufe: 'selten', wert: 3 },
  { id: 'brille', name: 'Nickelbrille', stufe: 'selten', wert: 8 },
  { id: 'taschenuhr', name: 'Taschenuhr', stufe: 'episch', wert: 40 },
  { id: 'ring', name: 'Silberring', stufe: 'episch', wert: 60 },
  { id: 'messer', name: 'Taschenmesser', stufe: 'episch', wert: 30 },
  { id: 'medaille', name: 'Medaille', stufe: 'episch', wert: 50 },
  { id: 'goldzahn', name: 'Goldzahn', stufe: 'legendaer', wert: 250 },
  { id: 'goldmuenze', name: 'Goldmünze', stufe: 'legendaer', wert: 300 },
  { id: 'amulett', name: 'Amulett', stufe: 'legendaer', wert: 400 },
  { id: 'ehering', name: 'Verlorener Ehering', stufe: 'mythisch', wert: 1500 },
  { id: 'ei', name: 'Goldenes Ei', stufe: 'mythisch', wert: 5000 },
];

/** Je entdecktem Fundstück werden alle Preise um so viel besser. */
export const SAMMELBONUS = 0.01;

/** Klicks, bis man eine Nadel im Ausschuss von Hand gefunden hat. */
export const AUSSCHUSS_TIPPS = 30;

/** Ein neuer Haufen ist so viel größer als der letzte. */
export const NEUER_HAUFEN_FAKTOR = 1.5;
