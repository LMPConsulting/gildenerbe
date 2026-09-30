// Gegenstände: Heubündel und Waren, die fliegen, liegen, auf Bändern fahren
// oder in der Hand getragen werden. Wie im Vorbild sind sie auf dem Band nur
// Einträge (Band, Weg), in der Luft einfache Würfe mit Schwerkraft. Landet
// etwas, fängt es der Trichter am Stand, die Ladefläche des Lasters, ein
// Maschinentrichter oder ein Band; sonst bleibt es liegen. Reine Logik.

import { PRODUKTE } from './daten.js';
import { haufenHoehe } from './haufen.js';
import { hangFuss } from './lose.js';
import { werte, preisRoh, produktPreis, verkaufen } from './wirtschaft.js';
import { nadelFinden, nadelZurueck } from './nadeln.js';
import { platzFrei } from './werkzeuge.js';
import { STAND_TRICHTER, lauf } from './welt.js';

export const SCHWERE = 9.81;
export const GEGENSTAENDE_MAX = 600;

/** Halbe Höhe (Radius) je Ware: so weit ragt ein Stück über seine Auflage. */
export const GROESSE = {
  roh: 0.2, knaeuel: 0.17, ballen: 0.26, pellet: 0.15, brei: 0.18, silage: 0.32, papier: 0.12, brikett: 0.14,
};

/** Halme eines Stücks (bei losem Heu steht es im Stück selbst). */
export const gegenstandHalme = (g) => (g.art === 'roh' ? g.halme : PRODUKTE[g.art].halme);

/** Was das Stück am Stand bringt. */
export function gegenstandWert(s, g) {
  const w = werte(s);
  return g.art === 'roh' ? g.halme * preisRoh(w) : produktPreis(w, g.art);
}

export function gegenstandNeu(s, art, halme, x, y, z, extra = {}) {
  const g = {
    id: s.naechsteId++, art, halme: art === 'roh' ? Math.max(1, Math.round(halme)) : PRODUKTE[art].halme,
    nadel: -1, ort: 'boden', x, y, z, vx: 0, vy: 0, vz: 0, dreh: 0, ...extra,
  };
  s.gegenstaende.push(g);
  return g;
}

export const gegenstandNachId = (s, id) => s.gegenstaende.find((g) => g.id === id) || null;

/** Stück entfernen (verkauft, verarbeitet, verbrannt). */
export function gegenstandWeg(s, g) {
  const i = s.gegenstaende.indexOf(g);
  if (i >= 0) s.gegenstaende.splice(i, 1);
  g.ort = 'weg';
  if (s.spieler.haelt === g.id) s.spieler.haelt = null;
}

/** Eine Nadel wandert mit dem Stück mit. */
export function nadelMitgeben(s, g, n) {
  if (!n) return;
  n.zustand = 'unterwegs';
  n.bei = g.id;
  g.nadel = n.nr;
}

/** Die Nadel im Stück (oder null). */
export const nadelIn = (s, g) => (g.nadel >= 0 ? s.nadeln[g.nadel] || null : null);

/**
 * Das Stück wird verkauft (Stand, Band am Stand, Laster, Drohne). Eine Nadel darin
 * fällt zurück in den Haufen. Liefert den Betrag.
 */
export function gegenstandVerkaufen(s, g, ereignisse, wo = 'stand') {
  const betrag = gegenstandWert(s, g);
  const n = nadelIn(s, g);
  if (n) nadelZurueck(s, s.hf, n, s.zufallFn || Math.random, ereignisse);
  verkaufen(s, betrag, gegenstandHalme(g), null, wo);
  if (ereignisse) ereignisse.push({ typ: 'verkauft', betrag, halme: gegenstandHalme(g), wo, x: g.x, y: g.y, z: g.z, art: g.art });
  gegenstandWeg(s, g);
  return betrag;
}

/* ------------------------------------------------------------ Werfen */

/**
 * Wirft das Stück von (x, y, z) so, dass es nach etwa `dauer` Sekunden bei
 * (zx, zy, zz) landet.
 */
export function werfenNach(g, x, y, z, zx, zy, zz, dauer = 0.8) {
  g.ort = 'flug';
  g.x = x; g.y = y; g.z = z;
  g.vx = (zx - x) / dauer;
  g.vz = (zz - z) / dauer;
  g.vy = (zy - y) / dauer + 0.5 * SCHWERE * dauer;
  g.flug = 0;
}

/** Wurf mit fester Anfangsgeschwindigkeit. */
export function werfenMit(g, x, y, z, vx, vy, vz) {
  g.ort = 'flug';
  g.x = x; g.y = y; g.z = z;
  g.vx = vx; g.vy = vy; g.vz = vz;
  g.flug = 0;
}

/* ------------------------------------------------------------ Fangen */

/** Trichter am Stand: hier verkauft sich alles, was hineinfällt. */
export function imStandTrichter(x, y, z) {
  const T = STAND_TRICHTER;
  return Math.abs(x - T.x) < 0.62 && Math.abs(z - T.z) < 0.85 && y < T.y + 0.5 && y > T.y - 0.9;
}

/**
 * Der Weltzugang, den gegenstaendeSchritt braucht (von automatik.js gebaut):
 * {
 *   boden(x, z, y): Auflagehöhe (Boden, Haufen, Plattformen, Maschinendächer),
 *   fangen(s, g, ereignisse): true, wenn ein Trichter, Laster oder Band das Stück nahm,
 *   grenzen: { xMin, xMax, zMin, zMax }
 * }
 */
export function gegenstaendeSchritt(s, dt, welt, ereignisse) {
  const hf = s.hf;
  const l = lauf(s);
  l.liegenTakt = (l.liegenTakt || 0) + dt;
  const liegenPruefen = l.liegenTakt > 0.3;
  if (liegenPruefen) l.liegenTakt = 0;
  const z = s.zufallFn || Math.random;
  for (let i = s.gegenstaende.length - 1; i >= 0; i--) {
    const g = s.gegenstaende[i];
    if (!g) continue;
    if (g.ort === 'flug') {
      flugSchritt(s, g, dt, welt, ereignisse, z);
    } else if (g.ort === 'boden' && liegenPruefen) {
      // Wird unter einem liegenden Stück gegraben, sinkt es nach.
      const unten = welt.boden(g.x, g.z, g.y + 0.05);
      if (g.y > unten + 0.05) {
        g.ort = 'flug';
        g.vx = 0; g.vy = 0; g.vz = 0; g.flug = 0;
      } else if (g.y < unten - 0.02) {
        g.y = unten;
      }
    }
  }
  if (s.gegenstaende.length > GEGENSTAENDE_MAX) aufraeumen(s, hf);
}

function flugSchritt(s, g, dt, welt, ereignisse, zufall) {
  const schritte = Math.max(1, Math.ceil(dt / (1 / 90)));
  const h = dt / schritte;
  for (let k = 0; k < schritte; k++) {
    g.vy -= SCHWERE * h;
    const ny = g.y + g.vy * h;
    let nx = g.x + g.vx * h;
    let nz = g.z + g.vz * h;
    const gr = welt.grenzen;
    if (nx < gr.xMin + 0.2 || nx > gr.xMax - 0.2) { g.vx *= -0.3; nx = Math.max(gr.xMin + 0.2, Math.min(gr.xMax - 0.2, nx)); }
    if (nz < gr.zMin - 6 || nz > gr.zMax - 0.2) { g.vz *= -0.3; nz = Math.max(gr.zMin - 6, Math.min(gr.zMax - 0.2, nz)); }
    g.x = nx; g.z = nz;
    g.flug = (g.flug || 0) + h;
    g.dreh = (g.dreh || 0) + h * 5;
    // Beim Sinken durch eine Fangfläche? (Trichter, Ladefläche, Maschinen, Bänder)
    if (g.vy < 0) {
      g.y = ny;
      if (welt.fangen(s, g, ereignisse)) return;
      const unten = welt.boden(g.x, g.z, g.y + 0.3);
      if (g.y <= unten) {
        landen(s, g, unten, welt, zufall);
        return;
      }
    } else {
      g.y = ny;
    }
    if (g.flug > 12) { landen(s, g, welt.boden(g.x, g.z, 99), welt, zufall); return; }
  }
}

function landen(s, g, unten, welt, zufall) {
  g.ort = 'boden';
  delete g.vomBand;
  g.vx = 0; g.vy = 0; g.vz = 0;
  g.y = unten;
  // Auf dem Haufen rollt ein Stück den Hang hinunter bis an den Fuß.
  const hf = s.hf;
  if (hf && unten > 0.25 && Math.abs(unten - haufenHoehe(hf, g.x, g.z)) < 0.05) {
    const [fx, fz] = hangFuss(hf, g.x, g.z, zufall);
    g.x = fx; g.z = fz;
    g.y = welt.boden(fx, fz, 99);
  }
}

/** Zu viele Stücke: die ältesten liegenden Bündel werden zu losen Halmen. */
function aufraeumen(s) {
  const zuViel = s.gegenstaende.length - GEGENSTAENDE_MAX;
  let weg = 0;
  for (let i = 0; i < s.gegenstaende.length && weg < zuViel; i++) {
    const g = s.gegenstaende[i];
    if (g.ort !== 'boden' || g.art !== 'roh' || g.nadel >= 0) continue;
    s.lose.push({ x: g.x, z: g.z, m: g.halme, a: 0 });
    s.gegenstaende.splice(i, 1);
    i--;
    weg++;
  }
}

/* ------------------------------------------------------------ Spieler */

/**
 * Der Spieler hebt ein Stück auf. Loses Heu und Knäuel kommen in den Behälter
 * (so viel Platz ist), Waren nimmt er in die Hand. Eine Nadel im Heu findet er dabei.
 * Liefert { ok, grund, menge, haelt }.
 */
export function gegenstandNehmen(s, g, ereignisse) {
  const sp = s.spieler;
  if (!g || (g.ort !== 'boden' && g.ort !== 'flug')) return { ok: false, grund: 'weg' };
  const n = nadelIn(s, g);
  if (g.art === 'roh' || g.art === 'knaeuel') {
    const frei = platzFrei(s);
    if (frei <= 0) return { ok: false, grund: 'voll' };
    const halme = gegenstandHalme(g);
    const menge = Math.min(frei, halme);
    sp.last += menge;
    s.stat.gefegt += menge;
    if (n) { g.nadel = -1; nadelFinden(s, n, ereignisse); }
    if (menge >= halme) gegenstandWeg(s, g);
    else if (g.art === 'roh') g.halme = halme - menge;
    else { g.art = 'roh'; g.halme = halme - menge; }
    ereignisse.push({ typ: 'gegriffen', menge, x: g.x, z: g.z });
    return { ok: true, menge };
  }
  if (sp.haelt != null) return { ok: false, grund: 'haende' };
  g.ort = 'hand';
  sp.haelt = g.id;
  if (n) { g.nadel = -1; nadelFinden(s, n, ereignisse); }
  ereignisse.push({ typ: 'aufgehoben', art: g.art });
  return { ok: true, haelt: g };
}

/** Das getragene Stück (oder null). */
export const gehaltenesStueck = (s) => (s.spieler.haelt != null ? gegenstandNachId(s, s.spieler.haelt) : null);

/** Wirft das getragene Stück in Blickrichtung. */
export function stueckWerfen(s, von, richtung, kraft = 6.5) {
  const g = gehaltenesStueck(s);
  if (!g) { s.spieler.haelt = null; return null; }
  s.spieler.haelt = null;
  werfenMit(g, von[0], von[1], von[2], richtung[0] * kraft, richtung[1] * kraft + 2.2, richtung[2] * kraft);
  return g;
}

/**
 * Heu aus dem Behälter als Bündel werfen (etwa auf ein Band oder in einen Trichter).
 * Liefert das Bündel oder null.
 */
export function heuWerfen(s, von, richtung, menge = 40, kraft = 5.5) {
  const sp = s.spieler;
  const m = Math.min(sp.last, menge);
  if (m < 1) return null;
  sp.last -= m;
  const g = gegenstandNeu(s, 'roh', m, von[0], von[1], von[2]);
  werfenMit(g, von[0], von[1], von[2], richtung[0] * kraft, richtung[1] * kraft + 2, richtung[2] * kraft);
  return g;
}

/** Nächstes liegendes Stück in Reichweite eines Strahls (für das Zielen). */
export function stueckImBlick(s, ox, oy, oz, dx, dy, dz, maxT = 3.2) {
  let beste = null;
  let bestT = maxT;
  for (const g of s.gegenstaende) {
    if (g.ort !== 'boden') continue;
    const r = GROESSE[g.art] + 0.12;
    const cx = g.x - ox;
    const cy = g.y + r * 0.8 - oy;
    const cz = g.z - oz;
    const t = cx * dx + cy * dy + cz * dz;
    if (t < 0 || t > bestT) continue;
    const px = cx - dx * t;
    const py = cy - dy * t;
    const pz = cz - dz * t;
    if (px * px + py * py + pz * pz <= r * r * 1.6) { beste = g; bestT = t; }
  }
  return beste ? { g: beste, t: bestT } : null;
}
