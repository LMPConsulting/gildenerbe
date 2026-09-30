// Geometrie der Welt ohne three.js: Lage von Bauten (Drehung, Anschlüsse,
// Fußabdruck), feste Hindernisse der Halle, besondere Punkte (Trichter am
// Stand, Laderampe am Tor, Hausanschluss). Reine Logik.

import { WELT, BAUTEN } from './daten.js';

export const BAND_Y = 0.55; // Oberkante eines Bandes
export const BAU_BY_ID = Object.fromEntries(BAUTEN.map((b) => [b.id, b]));

/** Trichter vorn am Verkaufsstand: hier rasten Bänder ein. */
export const STAND_TRICHTER = { x: WELT.standX + WELT.standTiefe / 2 + 0.45, y: 0.9, z: WELT.standZ };
/** Schwelle im Tor: hier steht die Ladefläche des Lasters, wenn er angesetzt hat. */
export const LADERAMPE = { x: WELT.torX, y: 0.9, z: WELT.zMin + 0.5 };
/** Hausanschluss an der linken Wand: 5 kW Grundstrom. */
export const HAUSANSCHLUSS = { x: WELT.anschlussX + 0.25, y: 1.4, z: WELT.anschlussZ };

/** Innenmaße der Halle (die Halle kann um Felder à 4 m verlängert werden). */
export function hallenGrenzen(felder = 0) {
  return { xMin: WELT.xMin, xMax: WELT.xMax + felder * 4, zMin: WELT.zMin, zMax: WELT.zMax };
}

/** Lokaler Punkt (lx, lz) eines Baus in Weltkoordinaten. +x lokal zeigt in Blickrichtung rot. */
export function lokalZuWelt(bau, lx, lz) {
  const c = Math.cos(bau.rot || 0);
  const s = Math.sin(bau.rot || 0);
  return [bau.x + lx * c + lz * s, bau.z - lx * s + lz * c];
}

/** Weltpunkt in lokale Koordinaten eines Baus. */
export function weltZuLokal(bau, x, z) {
  const c = Math.cos(bau.rot || 0);
  const s = Math.sin(bau.rot || 0);
  const dx = x - bau.x;
  const dz = z - bau.z;
  return [dx * c - dz * s, dx * s + dz * c];
}

/** Richtung von lokal +x in Welt. */
export const vorwaerts = (rot) => [Math.cos(rot || 0), -Math.sin(rot || 0)];

/** Anschlüsse eines Baus in Welt: { ein: [[x,z],...], aus: [[x,z],...] }. */
export function anschluesse(bau) {
  const d = BAU_BY_ID[bau.typ];
  if (!d) return { ein: [], aus: [] };
  return {
    ein: d.ein.map(([lx, lz]) => lokalZuWelt(bau, lx, lz)),
    aus: d.aus.map(([lx, lz]) => lokalZuWelt(bau, lx, lz)),
  };
}

/** Achsparalleler Kasten um den gedrehten Fußabdruck (etwas großzügig). */
export function fussabdruck(typ, x, z, rot = 0, rand = 0) {
  const d = BAU_BY_ID[typ];
  const hb = d.b / 2 + rand;
  const ht = d.t / 2 + rand;
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const ex = hb * c + ht * s;
  const ez = hb * s + ht * c;
  return { x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez, h: d.h };
}

/** Die vier Ecken des gedrehten Fußabdrucks. */
export function ecken(typ, x, z, rot = 0) {
  const d = BAU_BY_ID[typ];
  const bau = { x, z, rot };
  return [[-d.b / 2, -d.t / 2], [d.b / 2, -d.t / 2], [d.b / 2, d.t / 2], [-d.b / 2, d.t / 2]].map(([lx, lz]) => lokalZuWelt(bau, lx, lz));
}

/** Liegt (x, z) im gedrehten Fußabdruck (mit Rand)? */
export function imFussabdruck(bau, x, z, rand = 0) {
  const d = BAU_BY_ID[bau.typ];
  const [lx, lz] = weltZuLokal(bau, x, z);
  return Math.abs(lx) <= d.b / 2 + rand && Math.abs(lz) <= d.t / 2 + rand;
}

export const kastenUeberlapp = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

/** Feste Hindernisse der Halle (Stand, Werkzeugstand, Werkbank, Lieferschalter, Aufsteller). */
export function festeHindernisse() {
  const W = WELT;
  return [
    { name: 'stand', x0: W.standX - W.standTiefe / 2 - 0.1, x1: W.standX + W.standTiefe / 2 + 0.1, z0: W.standZ - W.standBreite / 2 - 0.1, z1: W.standZ + W.standBreite / 2 + 0.1, h: 2.4 },
    { name: 'aufsteller', x0: W.standX + 1.95, x1: W.standX + 2.65, z0: W.standZ + 1.35, z1: W.standZ + 2.05, h: 1.1 },
    { name: 'werkzeugstand', x0: W.werkzeugX - 1.6, x1: W.werkzeugX + 1.6, z0: W.werkzeugZ - 0.8, z1: W.werkzeugZ + 0.8, h: 2.4 },
    { name: 'werkbank', x0: W.bankX - 1.0, x1: W.bankX + 1.0, z0: W.bankZ - 0.6, z1: W.bankZ + 0.6, h: 1.0 },
    { name: 'lieferschalter', x0: W.lieferX - 1.4, x1: W.lieferX + 1.4, z0: W.lieferZ - 0.45, z1: W.lieferZ + 0.45, h: 1.1 },
  ];
}

/** Abstand eines Punktes zu einer Strecke, dazu der Anteil t entlang der Strecke. */
export function streckenAbstand(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t;
  const qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t, qx, qz };
}

/** Laufzeitdaten an einem Objekt (Bau, Stand), die nicht mitgespeichert werden. */
export function lauf(obj) {
  if (!obj._l) Object.defineProperty(obj, '_l', { value: {}, writable: true, enumerable: false, configurable: true });
  return obj._l;
}

/** Grobes Gitter (1 m) für schnelle Nachbarschaftssuche. */
export const GITTER = 1;
export const gitterSchluessel = (ix, iz) => ix * 4096 + iz;
export function gitterEintragen(gitter, x0, z0, x1, z1, wert) {
  const i0 = Math.floor(x0 / GITTER); const i1 = Math.floor(x1 / GITTER);
  const k0 = Math.floor(z0 / GITTER); const k1 = Math.floor(z1 / GITTER);
  for (let i = i0; i <= i1; i++) {
    for (let k = k0; k <= k1; k++) {
      const key = gitterSchluessel(i, k);
      let liste = gitter.get(key);
      if (!liste) { liste = []; gitter.set(key, liste); }
      liste.push(wert);
    }
  }
}
export const gitterBei = (gitter, x, z) => gitter.get(gitterSchluessel(Math.floor(x / GITTER), Math.floor(z / GITTER))) || [];
