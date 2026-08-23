// Wo die Felder liegen. Reine Geometrie, kein DOM — damit sich das Brett
// prüfen lässt, bevor irgendetwas gezeichnet wird.
//
// Das Kreuz sitzt in einem Raster aus 11 × 11 Zellen. Die 40 Ringfelder laufen
// als geschlossener Weg herum: jedes Feld grenzt an das nächste, ohne Lücke
// und ohne Diagonale. Feld 0 ist das Startfeld der ersten Seite.

const RASTER = 11;

/** Baut einen geraden Abschnitt von (x,y) aus, `n` Felder in eine Richtung. */
const strecke = (x, y, dx, dy, n) =>
  Array.from({ length: n }, (_, i) => [x + dx * i, y + dy * i]);

export const RINGFELDER = [
  ...strecke(0, 4, 1, 0, 5),     //  0– 4  linker Arm nach rechts
  ...strecke(4, 3, 0, -1, 4),    //  5– 8  hoch zum oberen Rand
  [5, 0],                        //  9     über die Spitze
  ...strecke(6, 0, 0, 1, 5),     // 10–14  wieder herunter
  ...strecke(7, 4, 1, 0, 4),     // 15–18  rechter Arm nach rechts
  [10, 5],                       // 19     um die rechte Spitze
  ...strecke(10, 6, -1, 0, 5),   // 20–24  zurück nach innen
  ...strecke(6, 7, 0, 1, 4),     // 25–28  hinunter
  [5, 10],                       // 29     über die untere Spitze
  ...strecke(4, 10, 0, -1, 5),   // 30–34  wieder herauf
  ...strecke(3, 6, -1, 0, 4),    // 35–38  linker Arm nach links
  [0, 5],                        // 39     um die linke Spitze
];

/** Die vier Hausfelder je Seite — von außen nach innen. */
export const HAUSFELDER = [
  strecke(1, 5, 1, 0, 4),        // Seite 0 zieht von links zur Mitte
  strecke(9, 5, -1, 0, 4),       // Seite 1 von rechts
];

/** Die vier Warteplätze je Seite, in der Ecke neben dem eigenen Startfeld. */
export const BASISFELDER = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[9, 9], [10, 9], [9, 10], [10, 10]],
];

/** Mittelpunkt einer Rasterzelle in Zeichenkoordinaten. */
export const mitte = ([x, y], zelle = 10) => [x * zelle + zelle / 2, y * zelle + zelle / 2];

export const BRETTGROESSE = RASTER;
