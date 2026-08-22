// Die Zeichnung. Elf Teile, in fester Reihenfolge — jeder Fehlgriff einen mehr.
//
// Reines SVG als Zeichenkette, kein DOM: so lässt es sich testen und
// notfalls auch woanders einsetzen. Gezeichnet wird mit Kreide auf Tafel.

const RAHMEN = { breite: 200, hoehe: 220 };

/** Die Striche in genau der Reihenfolge, in der sie erscheinen. */
export const TEIL_PFADE = [
  { id: 'boden', d: 'M 22 202 L 132 202' },
  { id: 'pfosten', d: 'M 46 202 L 46 24' },
  { id: 'querbalken', d: 'M 44 24 L 128 24' },
  { id: 'strebe', d: 'M 46 56 L 78 24' },
  { id: 'seil', d: 'M 126 24 L 126 48' },
  { id: 'kopf', d: 'M 126 63 m -15 0 a 15 15 0 1 0 30 0 a 15 15 0 1 0 -30 0' },
  { id: 'rumpf', d: 'M 126 78 L 126 134' },
  { id: 'armLinks', d: 'M 126 94 L 100 118' },
  { id: 'armRechts', d: 'M 126 94 L 152 118' },
  { id: 'beinLinks', d: 'M 126 134 L 103 174' },
  { id: 'beinRechts', d: 'M 126 134 L 149 174' },
];

const KOPF_INDEX = TEIL_PFADE.findIndex((t) => t.id === 'kopf');

// Gesichter: erst wenn der Kopf steht. Vorher gibt es nichts zu zeigen.
const GESICHTER = {
  offen: 'M 120 60 l 0 0 M 132 60 l 0 0',
  froh: 'M 119 59 l 0.1 0 M 133 59 l 0.1 0 M 118 69 q 8 6 16 0',
  weg: 'M 116 56 l 6 6 M 122 56 l -6 6 M 130 56 l 6 6 M 136 56 l -6 6 M 118 71 q 8 -5 16 0',
};

/**
 * Baut die Zeichnung.
 *
 * @param {number} teile     wie viele Striche zu sehen sind (0 … 11)
 * @param {object} optionen  `vorab` = Striche, die zur Stufe gehören und
 *                           blasser stehen; `zustand` = 'laeuft'|'froh'|'weg'
 */
export function galgenSvg(teile, { vorab = 0, zustand = 'laeuft' } = {}) {
  const sichtbar = Math.max(0, Math.min(TEIL_PFADE.length, Math.round(teile)));
  const striche = TEIL_PFADE.slice(0, sichtbar).map((t, i) => {
    const blass = i < vorab;
    // pathLength normiert die Länge auf 1 — dann zeichnen sich alle Striche gleich schnell.
    return `<path d="${t.d}" pathLength="1" class="strich${blass ? ' strich--vorab' : ''}"`
      + ` style="animation-delay:${Math.max(0, i - vorab) * 60}ms"/>`;
  });

  if (sichtbar > KOPF_INDEX) {
    const gesicht = zustand === 'froh' ? GESICHTER.froh
      : zustand === 'weg' ? GESICHTER.weg : GESICHTER.offen;
    striche.push(`<path d="${gesicht}" pathLength="1" class="strich strich--gesicht"/>`);
  }

  return `<svg viewBox="0 0 ${RAHMEN.breite} ${RAHMEN.hoehe}" class="galgen galgen--${zustand}"`
    + ` role="img" aria-label="${beschriftung(sichtbar, zustand)}">${striche.join('')}</svg>`;
}

/** Was ein Screenreader vorlesen soll. */
export function beschriftung(sichtbar, zustand) {
  if (zustand === 'froh') return 'Gerettet — das Wort ist erraten.';
  if (zustand === 'weg') return 'Das Männchen hängt — die Fehlversuche sind aufgebraucht.';
  if (sichtbar === 0) return 'Noch kein Strich gezeichnet.';
  return `${sichtbar} von ${TEIL_PFADE.length} Strichen gezeichnet.`;
}
