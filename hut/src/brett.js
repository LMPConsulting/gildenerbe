// Wo die Felder liegen. Reine Geometrie, kein DOM.
//
// Das Brett ist ein 6 × 6-Raster. Der Ring läuft außen herum: 6 + 5 + 5 + 4 =
// 20 Felder, im Uhrzeigersinn, beginnend in der linken oberen Ecke. Innen
// bleiben 4 × 4 Felder für die Wartehöfe und die Zielplätze.

const RASTER = 6;

const strecke = (x, y, dx, dy, n) =>
  Array.from({ length: n }, (_, i) => [x + dx * i, y + dy * i]);

export const RINGFELDER = [
  ...strecke(0, 0, 1, 0, 6),     //  0– 5  oben nach rechts, 0 ist der erste Hof
  ...strecke(5, 1, 0, 1, 5),     //  6–10  rechts hinunter, 10 ist der zweite Hof
  ...strecke(4, 5, -1, 0, 5),    // 11–15  unten nach links
  ...strecke(0, 4, 0, -1, 4),    // 16–19  links wieder hinauf
];

/** Die vier Warteplätze je Seite — im Viertel neben dem eigenen Hof. */
export const HOFFELDER = [
  [[1, 1], [2, 1], [1, 2], [2, 2]],
  [[3, 3], [4, 3], [3, 4], [4, 4]],
];

/** Die vier Plätze für heimgekehrte Hüte. */
export const ZIELFELDER = [
  [[3, 1], [4, 1], [3, 2], [4, 2]],
  [[1, 3], [2, 3], [1, 4], [2, 4]],
];

export const mitte = ([x, y], zelle = 10) => [x * zelle + zelle / 2, y * zelle + zelle / 2];

export const BRETTGROESSE = RASTER;
