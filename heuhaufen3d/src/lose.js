// Lose Halme am Boden: was beim Stechen danebenfällt, rollt den Haufen
// hinunter und bleibt als Büschel liegen. Nahe Büschel wachsen zusammen, damit
// es nie zu viele werden (im Vorbild: „Heu-Tuffs“). Besen, Sauger, Hand und
// Drohnen sammeln sie wieder ein. Reine Logik.

import { haufenHoehe, haufenNormale } from './haufen.js';

export const LOSE_MAX = 260; // so viele Büschel höchstens
const ZUSAMMEN = 0.45; // näher als das: ein Büschel
const BUESCHEL_MAX = 120; // Halme je Büschel höchstens

/** Rollt vom Punkt (x, z) den Hang hinunter bis zum Fuß des Haufens. */
export function hangFuss(hf, x, z, zufall) {
  let px = x;
  let pz = z;
  for (let i = 0; i < 60; i++) {
    const h = haufenHoehe(hf, px, pz);
    if (h < 0.06) break;
    const [nx, , nz] = haufenNormale(hf, px, pz);
    const l = Math.hypot(nx, nz);
    if (l < 1e-3) { px += (zufall() - 0.5) * 0.3; pz += (zufall() - 0.5) * 0.3; continue; }
    px += (nx / l) * 0.3 + (zufall() - 0.5) * 0.12;
    pz += (nz / l) * 0.3 + (zufall() - 0.5) * 0.12;
  }
  return [px, pz];
}

/** Halme als losen Büschel ablegen (bei x, z, oder den Hang hinunter). */
export function loseAblegen(s, hf, x, z, menge, zufall, { rollen = true, streuen = 0.35 } = {}) {
  if (menge <= 0) return;
  let [px, pz] = rollen && hf ? hangFuss(hf, x, z, zufall) : [x, z];
  px += (zufall() - 0.5) * streuen;
  pz += (zufall() - 0.5) * streuen;
  let rest = menge;
  for (const b of s.lose) {
    if (Math.hypot(b.x - px, b.z - pz) < ZUSAMMEN && b.m < BUESCHEL_MAX) {
      const dazu = Math.min(rest, BUESCHEL_MAX - b.m);
      b.m += dazu;
      rest -= dazu;
      if (rest <= 0) return;
    }
  }
  s.lose.push({ x: px, z: pz, m: rest, a: zufall() * Math.PI * 2 });
  if (s.lose.length > LOSE_MAX) {
    // die kleinsten Büschel zu ihrem nächsten Nachbarn schieben
    s.lose.sort((a, b) => a.m - b.m);
    const klein = s.lose.shift();
    let naechster = null;
    let d = Infinity;
    for (const b of s.lose) {
      const dd = Math.hypot(b.x - klein.x, b.z - klein.z);
      if (dd < d) { d = dd; naechster = b; }
    }
    if (naechster) naechster.m += klein.m;
  }
}

/**
 * Sammelt bis zu `max` Halme aus Büscheln im Kreis um (x, z) ein, die nächsten zuerst.
 * Liefert die Menge.
 */
export function loseEinsammeln(s, x, z, radius, max) {
  if (max <= 0) return 0;
  const nah = s.lose
    .map((b) => ({ b, d: Math.hypot(b.x - x, b.z - z) }))
    .filter((e) => e.d <= radius)
    .sort((a, b) => a.d - b.d);
  let genommen = 0;
  for (const { b } of nah) {
    const n = Math.min(b.m, max - genommen);
    b.m -= n;
    genommen += n;
    if (genommen >= max) break;
  }
  if (genommen > 0) s.lose = s.lose.filter((b) => b.m > 0.5);
  return genommen;
}

/** Halme, die insgesamt lose herumliegen. */
export const loseSumme = (s) => s.lose.reduce((n, b) => n + b.m, 0);

/** Nächster Büschel zu (x, z) innerhalb radius, oder null. */
export function loseNaechster(s, x, z, radius = 1.2) {
  let beste = null;
  let d = radius;
  for (const b of s.lose) {
    const dd = Math.hypot(b.x - x, b.z - z);
    if (dd <= d) { d = dd; beste = b; }
  }
  return beste;
}
