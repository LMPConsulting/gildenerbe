// Alle Zahlen des Spiels an einem Ort. Maße in Metern, Zeiten in Sekunden,
// Geld in Dollar wie im Vorbild. Die Wirtschaft (Forschung, Missionen,
// Aufträge, Nadeln) folgt der 2D-Fassung und damit dem Vorbild.

/* ------------------------------------------------------------ Welt */

export const WELT = {
  // Innenmaße der Halle
  xMin: -18, xMax: 18, zMin: -14, zMax: 14,
  wandHoehe: 3.6,
  bandHoehe: 0.8, // Wellblechband über den Planken
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
};

/** Größe jeder Ladung: Halme, Radius, Höhe. Spätere Ladungen werden vor allem höher. */
export const LADUNGEN_3D = [
  { halme: 6_000_000, radius: 7.2, hoehe: 5.2 },
  { halme: 10_000_000, radius: 8.0, hoehe: 6.8 },
  { halme: 16_000_000, radius: 8.6, hoehe: 9.0 },
  { halme: 26_000_000, radius: 9.2, hoehe: 12.5 },
];

/* ------------------------------------------------------------ Spieler */

export const SPIELER = {
  augenHoehe: 1.62,
  radius: 0.32,
  gehen: 4.2, // m/s
  rennen: 6.6,
  sprung: 4.6, // m/s nach oben
  schwerkraft: 14,
  stufe: 0.42, // so hoch kommt man ohne Springen
  reichweite: 3.2, // bis hierhin wirkt ein Werkzeug
  blickEmpfindlichkeit: 0.0042, // rad je Pixel Wischen
};
