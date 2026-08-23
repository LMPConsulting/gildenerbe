// Wo die 40 Felder liegen. Reine Geometrie, kein DOM.
//
// Das Brett ist der Rand eines 11 × 11-Rasters: 4 × 11 − 4 = 40 Zellen. Los
// sitzt unten rechts, gezogen wird gegen den Uhrzeigersinn — erst nach links
// über die untere Kante, dann hoch, nach rechts, wieder herunter.

export const RASTER = 11;

const strecke = (x, y, dx, dy, n) =>
  Array.from({ length: n }, (_, i) => [x + dx * i, y + dy * i]);

export const FELDPUNKTE = [
  ...strecke(10, 10, -1, 0, 10),   //  0– 9  unten nach links, 0 ist Los
  ...strecke(0, 10, 0, -1, 10),    // 10–19  links hinauf, 10 ist das Kommissariat
  ...strecke(0, 0, 1, 0, 10),      // 20–29  oben nach rechts
  ...strecke(10, 0, 0, 1, 10),     // 30–39  rechts hinunter
];

/** An welcher Kante liegt ein Feld? Bestimmt, wohin das Farbband zeigt. */
export const KANTE = FELDPUNKTE.map(([x, y]) => {
  if (y === RASTER - 1) return 'unten';
  if (x === 0) return 'links';
  if (y === 0) return 'oben';
  return 'rechts';
});

export const mitte = ([x, y], zelle = 10) => [x * zelle + zelle / 2, y * zelle + zelle / 2];
