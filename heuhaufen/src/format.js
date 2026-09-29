// Zahlen so, wie man sie auf einem Handy lesen will: deutsch getrennt, große
// Beträge abgekürzt, Geld wie im Vorbild in Dollar. Zwischen Zahl und Einheit
// steht ein geschütztes Leerzeichen, damit "$" und "%" nie allein umbrechen.

const NB = ' ';
const EINHEITEN = [
  [1e15, 'Brd.'], [1e12, 'Bio.'], [1e9, 'Mrd.'], [1e6, 'Mio.'],
];

const deutsch = (n, stellen) => n.toLocaleString('de-DE', {
  minimumFractionDigits: stellen, maximumFractionDigits: stellen,
});

const stellenFuer = (x) => (x >= 100 ? 0 : x >= 10 ? 1 : 2);

export function zahl(n) {
  if (!Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e18) return n.toExponential(2).replace('.', ',').replace('e+', '·10^');
  for (let i = 0; i < EINHEITEN.length; i++) {
    const [grenze, name] = EINHEITEN[i];
    if (a >= grenze * 0.9995) {
      let x = n / grenze;
      let st = stellenFuer(Math.abs(x));
      st = stellenFuer(Number(Math.abs(x).toFixed(st)));
      // Rundet es auf 1000, gehört es zur nächsten Einheit.
      if (Math.abs(Number(x.toFixed(st))) >= 1000 && i > 0) {
        const [g2, n2] = EINHEITEN[i - 1];
        x = n / g2;
        st = stellenFuer(Math.abs(x));
        return `${deutsch(x, st)}${NB}${n2}`;
      }
      return `${deutsch(x, st)}${NB}${name}`;
    }
  }
  const t = Math.trunc(n + (n >= 0 ? 1e-9 : -1e-9));
  return deutsch(t === 0 ? 0 : t, 0);
}

/** Wie zahl(), aber ohne Abkürzung bis 10 Millionen — für den Halmzähler. */
export function halme(n) {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) < 1e7) return deutsch(Math.max(0, Math.floor(n + 1e-9)), 0);
  return zahl(n);
}

export function geld(n) {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) < 0.005) n = 0;
  if (Math.abs(n) < 100) return `${deutsch(n, 2)}${NB}$`;
  return `${zahl(n)}${NB}$`;
}

/** Raten mit einer Nachkommastelle, wenn sie klein sind. */
export function rate(n) {
  if (!Number.isFinite(n)) return '–';
  if (n > 0 && n < 10) return deutsch(n, 1);
  return zahl(n);
}

export function prozent(x) {
  if (!Number.isFinite(x)) return `0${NB}%`;
  return `${deutsch(Math.round(x * 100), 0)}${NB}%`;
}

/** Wie prozent(), aber abgerundet — für Mängel, die man nicht schönrechnen soll. */
export function prozentAb(x) {
  if (!Number.isFinite(x)) return `0${NB}%`;
  return `${deutsch(Math.floor(x * 100), 0)}${NB}%`;
}

export function dauer(sek) {
  if (!Number.isFinite(sek)) sek = 0;
  sek = Math.max(0, Math.round(sek));
  const h = Math.floor(sek / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  if (h > 0) return `${h}${NB}h ${m}${NB}min`;
  if (m > 0) return `${m}${NB}min ${s}${NB}s`;
  return `${s}${NB}s`;
}
