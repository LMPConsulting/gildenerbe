// Das Brett der Wiener Runde: 40 Felder im Ring, eigene Orte, eigene Preise.
//
// Der Ablauf ist der eines klassischen Straßenkaufspiels — der ist frei. Was
// nicht frei ist, sind Name, Brettgestaltung, Straßennamen und Kartentexte
// eines bestimmten Verlags. Also: eigenes Brett mit Wiener Orten, eigene
// Karten, eigene Preise. Für einen Wien-Urlaub ohnehin die schönere Fassung.
//
// Reine Daten, kein DOM.

export const FELDER_GESAMT = 40;
export const LOS_GELD = 200;
export const STARTGELD = 1500;
export const GEFAENGNIS_FELD = 10;
export const KAUTION = 50;

/** Die acht Farbgruppen, von billig nach teuer. */
export const GRUPPEN = {
  vorstadt: { titel: 'Vorstadt', farbe: '#8d6e63' },
  markt: { titel: 'Märkte', farbe: '#7cb1d6' },
  bezirk: { titel: 'Bezirke', farbe: '#c86fa5' },
  gruen: { titel: 'Grüne Lungen', farbe: '#e08a3c' },
  kaffee: { titel: 'Kaffeehäuser', farbe: '#c9483f' },
  buehne: { titel: 'Bühnen', farbe: '#e0b93c' },
  museum: { titel: 'Museen', farbe: '#4f9d69' },
  kaiser: { titel: 'Kaiserlich', farbe: '#3f6fb5' },
};

/**
 * Ein Ort: `miete` sind die sechs Stufen — unbebaut, 1 bis 4 Häuser, Hotel.
 * `haus` ist der Preis je Haus (und je Hotel).
 */
const ort = (feld, name, gruppe, preis, miete, haus) =>
  ({ feld, art: 'ort', name, gruppe, preis, miete, haus });

export const FELDER = [
  { feld: 0, art: 'los', name: 'Los' },
  ort(1, 'Brunnenmarkt', 'vorstadt', 60, [2, 10, 30, 90, 160, 250], 50),
  { feld: 2, art: 'ereignis', name: 'Zufall' },
  ort(3, 'Ottakringer Straße', 'vorstadt', 60, [4, 20, 60, 180, 320, 450], 50),
  { feld: 4, art: 'steuer', name: 'Kurtaxe', betrag: 200 },
  { feld: 5, art: 'linie', name: 'U1 Reumannplatz', preis: 200 },
  ort(6, 'Naschmarkt', 'markt', 100, [6, 30, 90, 270, 400, 550], 50),
  { feld: 7, art: 'kaffeehaus', name: 'Kaffeehaus' },
  ort(8, 'Karmelitermarkt', 'markt', 100, [6, 30, 90, 270, 400, 550], 50),
  ort(9, 'Rochusmarkt', 'markt', 120, [8, 40, 100, 300, 450, 600], 50),

  { feld: 10, art: 'besuch', name: 'Nur zu Besuch' },
  ort(11, 'Leopoldstadt', 'bezirk', 140, [10, 50, 150, 450, 625, 750], 100),
  { feld: 12, art: 'werk', name: 'Wasserwerk', preis: 150 },
  ort(13, 'Neubau', 'bezirk', 140, [10, 50, 150, 450, 625, 750], 100),
  ort(14, 'Josefstadt', 'bezirk', 160, [12, 60, 180, 500, 700, 900], 100),
  { feld: 15, art: 'linie', name: 'U2 Seestadt', preis: 200 },
  ort(16, 'Augarten', 'gruen', 180, [14, 70, 200, 550, 750, 950], 100),
  { feld: 17, art: 'ereignis', name: 'Zufall' },
  ort(18, 'Stadtpark', 'gruen', 180, [14, 70, 200, 550, 750, 950], 100),
  ort(19, 'Prater', 'gruen', 200, [16, 80, 220, 600, 800, 1000], 100),

  { feld: 20, art: 'parken', name: 'Freier Platz' },
  ort(21, 'Café Central', 'kaffee', 220, [18, 90, 250, 700, 875, 1050], 150),
  { feld: 22, art: 'kaffeehaus', name: 'Kaffeehaus' },
  ort(23, 'Café Sperl', 'kaffee', 220, [18, 90, 250, 700, 875, 1050], 150),
  ort(24, 'Café Landtmann', 'kaffee', 240, [20, 100, 300, 750, 925, 1100], 150),
  { feld: 25, art: 'linie', name: 'U3 Simmering', preis: 200 },
  ort(26, 'Burgtheater', 'buehne', 260, [22, 110, 330, 800, 975, 1150], 150),
  ort(27, 'Volksoper', 'buehne', 260, [22, 110, 330, 800, 975, 1150], 150),
  { feld: 28, art: 'werk', name: 'Kraftwerk', preis: 150 },
  ort(29, 'Staatsoper', 'buehne', 280, [24, 120, 360, 850, 1025, 1200], 150),

  { feld: 30, art: 'inHaft', name: 'Ab ins Kommissariat' },
  ort(31, 'Albertina', 'museum', 300, [26, 130, 390, 900, 1100, 1275], 200),
  ort(32, 'Belvedere', 'museum', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { feld: 33, art: 'kaffeehaus', name: 'Kaffeehaus' },
  ort(34, 'Kunsthistorisches', 'museum', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { feld: 35, art: 'linie', name: 'U4 Heiligenstadt', preis: 200 },
  { feld: 36, art: 'ereignis', name: 'Zufall' },
  ort(37, 'Hofburg', 'kaiser', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { feld: 38, art: 'steuer', name: 'Sondersteuer', betrag: 100 },
  ort(39, 'Schönbrunn', 'kaiser', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

/** Alle Feldnummern einer Farbgruppe. */
export const GRUPPENFELDER = Object.fromEntries(
  Object.keys(GRUPPEN).map((g) => [g, FELDER.filter((f) => f.gruppe === g).map((f) => f.feld)]),
);

export const KAUFBAR = FELDER.filter((f) => ['ort', 'linie', 'werk'].includes(f.art)).map((f) => f.feld);

/** Miete für U-Bahn-Linien nach Anzahl der Linien in einer Hand. */
export const LINIENMIETE = [0, 25, 50, 100, 200];

/** Werke: Faktor auf den Würfelwurf, je nachdem wie viele man hat. */
export const WERKFAKTOR = [0, 4, 10];

/* ------------------------------------------------------------------ Karten */

// `art` sagt der Engine, was zu tun ist. Die Texte sind eigene.
export const EREIGNIS = [
  { id: 'e1', text: 'Der Nachtbus fährt bis zum Ring. Rücke vor bis Los.', art: 'gehe', feld: 0 },
  { id: 'e2', text: 'Ein Fiaker bringt dich zum Schloss. Rücke vor nach Schönbrunn.', art: 'gehe', feld: 39 },
  { id: 'e3', text: 'Du wolltest nur schnell aufs Riesenrad. Rücke vor zum Prater.', art: 'gehe', feld: 19 },
  { id: 'e4', text: 'Falsch gestempelt. Ab ins Kommissariat, ohne über Los zu gehen.', art: 'haft' },
  { id: 'e5', text: 'Rückvergütung der Kurtaxe. Ziehe 100 € ein.', art: 'geld', betrag: 100 },
  { id: 'e6', text: 'Deine Melange war kalt, das Haus zahlt. 50 €.', art: 'geld', betrag: 50 },
  { id: 'e7', text: 'Strafmandat fürs Radeln am Gehsteig. Zahle 60 €.', art: 'geld', betrag: -60 },
  { id: 'e8', text: 'Die Jahreskarte war teurer als gedacht. Zahle 150 €.', art: 'geld', betrag: -150 },
  { id: 'e9', text: 'Drei Felder zurück — du hast die U-Bahn verpasst.', art: 'zurueck', schritte: 3 },
  { id: 'e10', text: 'Freifahrschein aus dem Kommissariat. Heb ihn auf.', art: 'freikarte' },
  { id: 'e11', text: 'Rücke vor zur nächsten U-Bahn-Linie.', art: 'naechsteLinie' },
  { id: 'e12', text: 'Sanierung: zahle 40 € je Haus und 115 € je Hotel.', art: 'bauabgabe', proHaus: 40, proHotel: 115 },
];

export const KAFFEEHAUS = [
  { id: 'k1', text: 'Die Kellnerin rundet großzügig. Ziehe 200 € ein.', art: 'geld', betrag: 200 },
  { id: 'k2', text: 'Zwei Sachertorten und ein Verlängerter. Zahle 90 €.', art: 'geld', betrag: -90 },
  { id: 'k3', text: 'Du hast im Heurigen die Runde geschmissen. Zahle 100 €.', art: 'geld', betrag: -100 },
  { id: 'k4', text: 'Trinkgeld zurückbekommen, weil du so nett warst. 25 €.', art: 'geld', betrag: 25 },
  { id: 'k5', text: 'Rücke vor bis Los und kassiere.', art: 'gehe', feld: 0 },
  { id: 'k6', text: 'Ein Kellner hat dich falsch angesprochen. Ab ins Kommissariat.', art: 'haft' },
  { id: 'k7', text: 'Freifahrschein aus dem Kommissariat. Heb ihn auf.', art: 'freikarte' },
  { id: 'k8', text: 'Die Gegenseite lädt dich ein. Sie zahlt dir 50 €.', art: 'vomAnderen', betrag: 50 },
  { id: 'k9', text: 'Runde für alle: gib der Gegenseite 50 €.', art: 'vomAnderen', betrag: -50 },
  { id: 'k10', text: 'Erbschaft von der Tante aus Grinzing. 100 €.', art: 'geld', betrag: 100 },
  { id: 'k11', text: 'Reparatur: zahle 25 € je Haus und 100 € je Hotel.', art: 'bauabgabe', proHaus: 25, proHotel: 100 },
  { id: 'k12', text: 'Zahnarzt in der Josefstadt. Zahle 50 €.', art: 'geld', betrag: -50 },
];
