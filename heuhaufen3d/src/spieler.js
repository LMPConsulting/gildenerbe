// Die Spielfigur in der Ich-Perspektive: Gehen, Rennen, Springen, Stoßen an
// Wände und Maschinen, Laufen auf dem Haufen, solange er nicht zu steil ist.

import { SPIELER, WELT } from './daten.js';
import { haufenHoehe } from './haufen.js';

export function spielerNeu() {
  return {
    x: WELT.startX, y: 0, z: WELT.startZ,
    gier: WELT.startBlick, nick: -0.12,
    vx: 0, vz: 0, vy: 0, amBoden: true,
    schritt: 0, // für das Wippen der Kamera
  };
}

/** Bodenhöhe an (x, z): Hallenboden, Haufen, begehbare Flächen (Plattformen). */
export function bodenHoehe(umgebung, x, z, fuss = Infinity) {
  let h = 0;
  if (umgebung.haufen) h = Math.max(h, haufenHoehe(umgebung.haufen, x, z));
  for (const f of umgebung.flaechen || []) {
    if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
    const top = f.hoeheBei ? f.hoeheBei(x, z) : f.h;
    if (top <= fuss + SPIELER.stufe && top > h) h = top;
  }
  return h;
}

function kreisGegenKasten(x, z, r, k) {
  const nx = Math.max(k.x0, Math.min(x, k.x1));
  const nz = Math.max(k.z0, Math.min(z, k.z1));
  const dx = x - nx;
  const dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    return [(dx / d) * (r - d), (dz / d) * (r - d)];
  }
  // Mittelpunkt im Kasten: auf dem kürzesten Weg hinaus
  const links = x - k.x0; const rechts = k.x1 - x; const vorn = z - k.z0; const hinten = k.z1 - z;
  const m = Math.min(links, rechts, vorn, hinten);
  if (m === links) return [-(links + r), 0];
  if (m === rechts) return [rechts + r, 0];
  if (m === vorn) return [0, -(vorn + r)];
  return [0, hinten + r];
}

/**
 * Ein Zeitschritt. e: Eingabe (vor, seit, blickX, blickY, springen, rennen).
 * umgebung: { kollider: [{x0,x1,z0,z1,h}], flaechen: [...], haufen }.
 */
export function spielerBewegen(sp, e, dt, umgebung, tempoFaktor = 1) {
  sp.gier += e.blickX;
  sp.nick = Math.max(-1.48, Math.min(1.48, sp.nick + e.blickY));

  const tempo = (e.rennen ? SPIELER.rennen : SPIELER.gehen) * tempoFaktor;
  const vorX = -Math.sin(sp.gier);
  const vorZ = -Math.cos(sp.gier);
  const rechtsX = Math.cos(sp.gier);
  const rechtsZ = -Math.sin(sp.gier);
  const zielVx = (vorX * e.vor + rechtsX * e.seit) * tempo;
  const zielVz = (vorZ * e.vor + rechtsZ * e.seit) * tempo;
  // Anfahren und Bremsen weich, in der Luft träger
  const griff = sp.amBoden ? 14 : 3;
  const k = 1 - Math.exp(-griff * dt);
  sp.vx += (zielVx - sp.vx) * k;
  sp.vz += (zielVz - sp.vz) * k;

  const r = SPIELER.radius;
  const vorherX = sp.x;
  const vorherZ = sp.z;
  const bodenVorher = bodenHoehe(umgebung, sp.x, sp.z, sp.y);
  let nx = sp.x + sp.vx * dt;
  let nz = sp.z + sp.vz * dt;

  // Haufen und hohe Flächen: zu steil oder zu hoch ist wie eine Wand
  const bodenNeu = bodenHoehe(umgebung, nx, nz, sp.y);
  const weg = Math.hypot(nx - sp.x, nz - sp.z);
  if (weg > 1e-6 && bodenNeu > sp.y + 0.02) {
    const steigung = (bodenNeu - Math.max(bodenVorher, sp.y)) / weg;
    if (bodenNeu > sp.y + SPIELER.stufe || (steigung > 1.15 && sp.amBoden)) {
      // einzeln in x und z probieren, damit man am Hang entlanggleitet
      const nurX = bodenHoehe(umgebung, nx, sp.z, sp.y);
      const nurZ = bodenHoehe(umgebung, sp.x, nz, sp.y);
      const okX = nurX <= sp.y + 0.05 || (nurX - sp.y) / Math.max(1e-6, Math.abs(nx - sp.x)) <= 1.15;
      const okZ = nurZ <= sp.y + 0.05 || (nurZ - sp.y) / Math.max(1e-6, Math.abs(nz - sp.z)) <= 1.15;
      if (!okX) { nx = sp.x; sp.vx = 0; }
      if (!okZ) { nz = sp.z; sp.vz = 0; }
    }
  }

  // Kästen (Wände, Stand, Maschinen): hinausschieben
  for (let runde = 0; runde < 3; runde++) {
    let geschoben = false;
    for (const kasten of umgebung.kollider) {
      if (kasten.h !== undefined && kasten.h <= sp.y + SPIELER.stufe) continue; // darüber steigen
      if (kasten.unten !== undefined && kasten.unten > sp.y + SPIELER.augenHoehe) continue; // darunter durch
      const s = kreisGegenKasten(nx, nz, r, kasten);
      if (s) { nx += s[0]; nz += s[1]; geschoben = true; }
    }
    if (!geschoben) break;
  }
  // Halle nicht verlassen
  nx = Math.max(WELT.xMin + r, Math.min(WELT.xMax - r, nx));
  nz = Math.max(WELT.zMin + r, Math.min(WELT.zMax - r, nz));
  sp.x = nx;
  sp.z = nz;

  // Senkrecht: Springen, Schwerkraft, Boden
  const boden = bodenHoehe(umgebung, sp.x, sp.z, sp.y);
  if (e.springen && sp.amBoden) { sp.vy = SPIELER.sprung; sp.amBoden = false; }
  sp.vy -= SPIELER.schwerkraft * dt;
  sp.y += sp.vy * dt;
  if (sp.y <= boden) {
    sp.y = boden;
    sp.vy = 0;
    sp.amBoden = true;
  } else if (sp.amBoden && sp.vy <= 0 && sp.y - boden < 0.35) {
    // bergab am Boden kleben statt zu hüpfen
    sp.y = boden;
    sp.vy = 0;
  } else {
    sp.amBoden = false;
  }
  const bewegt = Math.hypot(sp.x - vorherX, sp.z - vorherZ);
  if (sp.amBoden) sp.schritt += bewegt;
  return bewegt / Math.max(dt, 1e-6);
}

/** Kamera auf Augenhöhe setzen, mit leichtem Wippen beim Gehen. */
export function spielerKamera(sp, kamera, tempo) {
  const wippen = Math.sin(sp.schritt * 2.2) * 0.035 * Math.min(1, tempo / 4);
  kamera.position.set(sp.x, sp.y + SPIELER.augenHoehe + wippen, sp.z);
  kamera.rotation.set(sp.nick, sp.gier, 0, 'YXZ');
}

/** Blickrichtung als Einheitsvektor [x, y, z]. */
export function blickRichtung(sp) {
  const c = Math.cos(sp.nick);
  return [-Math.sin(sp.gier) * c, Math.sin(sp.nick), -Math.cos(sp.gier) * c];
}
