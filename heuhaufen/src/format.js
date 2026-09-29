// Zahlen so, wie man sie auf einem Handy lesen will: deutsch getrennt, große
// Beträge abgekürzt, Geld wie im Vorbild in Dollar.

const EINHEITEN = [
  [1e15, 'Brd.'], [1e12, 'Bio.'], [1e9, 'Mrd.'], [1e6, 'Mio.'],
];

const deutsch = (n, stellen) => n.toLocaleString('de-DE', {
  minimumFractionDigits: stellen, maximumFractionDigits: stellen,
});

export function zahl(n) {
  if (!Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  for (const [grenze, name] of EINHEITEN) {
    if (a >= grenze) return `${deutsch(n / grenze, a / grenze >= 100 ? 0 : a / grenze >= 10 ? 1 : 2)} ${name}`;
  }
  return deutsch(Math.floor(n + 1e-9), 0);
}

/** Wie zahl(), aber ohne Abkürzung bis 10 Millionen — für den Halmzähler. */
export function halme(n) {
  if (Math.abs(n) < 1e7) return deutsch(Math.floor(n + 1e-9), 0);
  return zahl(n);
}

export function geld(n) {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) < 100) return `${deutsch(n, 2)} $`;
  return `${zahl(n)} $`;
}

/** Raten mit einer Nachkommastelle, wenn sie klein sind. */
export function rate(n) {
  if (n > 0 && n < 10) return deutsch(n, 1);
  return zahl(n);
}

export function prozent(x) {
  return `${deutsch(Math.round(x * 100), 0)} %`;
}

export function dauer(sek) {
  sek = Math.max(0, Math.round(sek));
  const h = Math.floor(sek / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}
