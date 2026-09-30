// Bauen und Abbauen: prüft, ob ein Bau an eine Stelle passt (Halle, Haufen,
// Stationen, andere Bauten, Geld oder Geschenk), setzt ihn, plant Bänder mit
// Wegfindung und rastet ihre Enden an Anschlüssen ein. Liefert außerdem die
// Kollisionskästen und begehbaren Flächen aller Bauten. Reine Logik.

import { SPIELER } from './daten.js';
import { haufenHoehe } from './haufen.js';
import { werte, bauFrei, bauKosten, bauErstattung, bauAnzahl } from './wirtschaft.js';
import {
  BAU_BY_ID, BAND_Y, STAND_TRICHTER, LADERAMPE, lauf, fussabdruck, ecken, festeHindernisse, hallenGrenzen,
  kastenUeberlapp, imFussabdruck, weltZuLokal, gitterEintragen, gitterBei,
} from './welt.js';
import { bandWeg, bandGeometrie, anschlussListe, bandNaechster, bandPunkt } from './baender.js';
import { bauZustand, maschineLeeren, haeltNadel } from './maschinen.js';

export const bauVersion = (s) => lauf(s).bauVersion || 0;
export function bauGeaendert(s) { lauf(s).bauVersion = bauVersion(s) + 1; }

/** Wie hoch darf der Haufen unter dem Bau sein? Rechen und Arm stehen am Haufen. */
const HAUFEN_ERLAUBT = { rechen: 1.4, arm: 0.35, vorrangarm: 0.2, mast: 0.3 };

/** Stellen im gedrehten Fußabdruck, an denen geprüft wird. */
function probePunkte(typ, x, z, rot) {
  const e = ecken(typ, x, z, rot);
  const pts = [[x, z], ...e];
  for (let i = 0; i < 4; i++) {
    const a = e[i]; const b = e[(i + 1) % 4];
    pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return pts;
}

/** Berührt ein Band den Fußabdruck (Enden ausgenommen, dort rastet es ja ein)? Nur auf gleicher Höhe. */
function bandImWeg(band, typ, x, z, rot, y = 0) {
  const { segs, laenge } = bandGeometrie(band);
  const bau = { typ, x, z, rot };
  const hoch = BAU_BY_ID[typ].h;
  for (const g of segs) {
    const n = Math.max(1, Math.ceil(g.len / 0.25));
    for (let i = 0; i <= n; i++) {
      const t = g.s0 + (g.len * i) / n;
      if (t < 0.6 || t > laenge - 0.6) continue;
      const by = g.ay + g.dy * (g.len * i) / n;
      if (by < y - 0.3 || by > y + hoch + 0.3) continue;
      if (imFussabdruck(bau, g.ax + g.dx * (g.len * i) / n, g.az + g.dz * (g.len * i) / n, 0.3)) return true;
    }
  }
  return false;
}

/** Oberkante der Plattform unter (x, z) auf Höhe y (±5 cm), oder null. */
export function plattformBei(s, x, z, y) {
  const hp = BAU_BY_ID.plattform.h;
  for (const b of s.bauten) {
    if (b.typ !== 'plattform' || Math.abs((b.y || 0) + hp - y) > 0.05) continue;
    if (imFussabdruck(b, x, z, 0.02)) return b;
  }
  return null;
}

/** Bauten, die nur auf dem Hallenboden stehen dürfen. */
const NUR_BODEN = new Set(['plattform', 'treppe', 'dach', 'rechen', 'brunnen', 'heutreppe', 'klappe']);

/**
 * Passt der Bau typ bei (x, z) mit Drehung rot? Liefert { ok, grund, kosten, geschenk }.
 * Gründe: gesperrt, wand, haufen, belegt, band, geld.
 */
export function bauPruefen(s, typ, x, z, rot = 0, { y = 0 } = {}) {
  const d = BAU_BY_ID[typ];
  if (!d) return { ok: false, grund: 'unbekannt' };
  const geschenk = (s.geschenke[typ] || 0) > 0;
  const kosten = geschenk ? 0 : bauKosten(s, typ);
  const aus = (grund) => ({ ok: false, grund, kosten, geschenk });
  if (!bauFrei(s, typ)) return aus('gesperrt');
  const k = fussabdruck(typ, x, z, rot);
  const gr = hallenGrenzen(werte(s).hallenFelder);
  if (k.x0 < gr.xMin + 0.05 || k.x1 > gr.xMax - 0.05 || k.z0 < gr.zMin + 0.05 || k.z1 > gr.zMax - 0.05) return aus('wand');
  if (y > 0.1) {
    // Auf einer Plattform: ganz darauf, und nicht alles darf hinauf
    if (NUR_BODEN.has(typ)) return aus('boden');
    for (const [px, pz] of probePunkte(typ, x, z, rot)) if (!plattformBei(s, px, pz, y)) return aus('kante');
  }
  if (s.hf && y < 0.1) {
    const erlaubt = HAUFEN_ERLAUBT[typ] ?? 0.15;
    for (const [px, pz] of probePunkte(typ, x, z, rot)) if (haufenHoehe(s.hf, px, pz) > erlaubt) return aus('haufen');
  }
  const eng = { x0: k.x0 + 0.02, x1: k.x1 - 0.02, z0: k.z0 + 0.02, z1: k.z1 - 0.02 };
  for (const h of festeHindernisse()) if (kastenUeberlapp(eng, h)) return aus('belegt');
  // Trichter am Stand und die Schwelle am Tor bleiben frei
  if (imFussabdruck({ typ, x, z, rot }, STAND_TRICHTER.x, STAND_TRICHTER.z, 0.2)) return aus('belegt');
  if (imFussabdruck({ typ, x, z, rot }, LADERAMPE.x, LADERAMPE.z, 0.1)) return aus('belegt');
  for (const b of s.bauten) {
    if (b.typ === 'band') { if (bandImWeg(b, typ, x, z, rot, y)) return aus('band'); continue; }
    const bd = BAU_BY_ID[b.typ];
    if (bd.linie && b.a && b.b) {
      if (b.typ === 'leitung' || Math.abs((b.y || 0) - y) > 1.5) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) / 0.2));
      for (let i = 0; i <= n; i++) {
        const px = b.a[0] + ((b.b[0] - b.a[0]) * i) / n; const pz = b.a[1] + ((b.b[1] - b.a[1]) * i) / n;
        if (imFussabdruck({ typ, x, z, rot }, px, pz, 0.05)) return aus('belegt');
      }
      continue;
    }
    if (b.typ === 'dach' || typ === 'dach') continue;
    // Unter eine Plattform passt, was niedriger ist als ihr Deck; oben steht man auf ihr
    if (b.typ === 'plattform' && (y > 0.1 || d.h < BAU_BY_ID.plattform.h - 0.1)) continue;
    if (Math.abs((b.y || 0) - y) > 1.5) continue;
    if (kastenUeberlapp(eng, fussabdruck(b.typ, b.x, b.z, b.rot || 0))) return aus('belegt');
  }
  if (s.geld < kosten) return aus('geld');
  return { ok: true, kosten, geschenk };
}

/** Setzt den Bau, wenn er passt. Liefert { ok, bau } oder { ok: false, grund }. */
export function bauSetzen(s, typ, x, z, rot = 0, optionen = {}) {
  const p = bauPruefen(s, typ, x, z, rot, optionen);
  if (!p.ok) return p;
  if (p.geschenk) {
    s.geschenke[typ]--;
    if (s.geschenke[typ] <= 0) delete s.geschenke[typ];
  } else {
    s.geld -= p.kosten;
  }
  const bau = { id: s.naechsteId++, typ, x, z, y: optionen.y || 0, rot, bezahlt: p.kosten, ...bauZustand(typ) };
  if (p.geschenk) bau.geschenk = true;
  s.bauten.push(bau);
  bauGeaendert(s);
  return { ok: true, bau };
}

/* ------------------------------------------------------------ Bänder */

/**
 * Einrastpunkt für Bandanfang oder -ende nahe (x, z). Liefert
 * { x, y, z, richtung, art: 'frei'|'aus'|'ein'|'stand'|'laster'|'band', bau?, band?, t? }.
 * richtung: in diese Richtung läuft das Band dort.
 */
export function bandAnker(s, x, z, ende, { radius = 1.0, y = 0 } = {}) {
  let beste = null;
  let bestD = radius;
  const nimm = (d, a) => { if (d < bestD) { bestD = d; beste = a; } };
  for (const b of s.bauten) {
    if (b.typ === 'band' || !BAU_BY_ID[b.typ].ein.length && !BAU_BY_ID[b.typ].aus.length) continue;
    for (const p of anschlussListe(b)) {
      if ((p.art === 'ein') !== ende) continue;
      const richtung = p.art === 'ein' ? [-p.richtung[0], -p.richtung[1]] : p.richtung;
      nimm(Math.hypot(p.x - x, p.z - z), { x: p.x, y: p.y, z: p.z, richtung, art: p.art, bau: b, port: p.i });
    }
  }
  if (!ende) {
    // Ein neues Band kann dort anfangen, wo ein anderes aufhört: es geht nahtlos weiter
    for (const b of s.bauten) {
      if (b.typ !== 'band') continue;
      const p = b.punkte;
      const e = p[p.length - 1];
      const v = p[p.length - 2];
      const l = Math.hypot(e[0] - v[0], e[2] - v[2]) || 1;
      nimm(Math.hypot(e[0] - x, e[2] - z) + 0.05, { x: e[0], y: e[1], z: e[2], richtung: [(e[0] - v[0]) / l, (e[2] - v[2]) / l], art: 'bandende', band: b });
    }
  }
  if (ende) {
    nimm(Math.hypot(STAND_TRICHTER.x - x, STAND_TRICHTER.z - z) * 0.8,
      { x: STAND_TRICHTER.x + 0.2, y: BAND_Y, z: STAND_TRICHTER.z, richtung: [-1, 0], art: 'stand' });
    nimm(Math.hypot(LADERAMPE.x - x, LADERAMPE.z - z),
      { x: LADERAMPE.x, y: BAND_Y, z: LADERAMPE.z, richtung: [0, -1], art: 'laster' });
    for (const b of s.bauten) {
      if (b.typ !== 'band') continue;
      const nb = bandNaechster(b, x, z);
      if (nb.d > radius * 0.7) continue;
      const p = bandPunkt(b, nb.t);
      nimm(nb.d + 0.15, { x: p.x, y: p.y, z: p.z, richtung: null, art: 'band', band: b, t: nb.t });
    }
  }
  return beste || { x, y: y + BAND_Y, z, richtung: null, art: 'frei' };
}

/**
 * Plant ein Band zwischen zwei Ankern. Liefert { ok, punkte, laenge, kosten, grund }.
 * gerade: ohne Raster (Einrasten aus).
 */
export function bandPlanen(s, von, nach, { gerade = false } = {}) {
  if (!bauFrei(s, 'band')) return { ok: false, grund: 'gesperrt' };
  // Ein Ende mitten im Heu: gar nicht erst suchen (sonst durchsucht A* die ganze Halle)
  for (const a of [von, nach]) if (a.art === 'frei' && a.y < 1 && s.hf && haufenHoehe(s.hf, a.x, a.z) > 0.15) return { ok: false, grund: 'haufen' };
  const ohne = [];
  if (von.bau) ohne.push(von.bau.id);
  if (nach.bau) ohne.push(nach.bau.id);
  const weg = bandWeg(s, von, nach, { ohne, gerade, maxSchritte: 20000 });
  if (weg.fehler) return { ok: false, grund: weg.fehler };
  const kosten = bauKosten(s, 'band', weg.laenge);
  const r = { ok: s.geld >= kosten, punkte: weg.punkte, laenge: weg.laenge, kosten };
  if (!r.ok) r.grund = 'geld';
  return r;
}

/** Baut ein geplantes Band. */
export function bandSetzen(s, plan) {
  if (!plan || !plan.punkte) return { ok: false, grund: 'kein Weg' };
  const kosten = bauKosten(s, 'band', plan.laenge);
  if (s.geld < kosten) return { ok: false, grund: 'geld' };
  s.geld -= kosten;
  const p0 = plan.punkte[0];
  const bau = { id: s.naechsteId++, typ: 'band', x: p0[0], z: p0[2], y: p0[1] - BAND_Y, rot: 0, punkte: plan.punkte, bezahlt: kosten };
  s.bauten.push(bau);
  bauGeaendert(s);
  return { ok: true, bau };
}

/* ------------------------------------------------------------ Linien (Wand, Geländer, Leitung) */

export function liniePlanen(s, typ, a, b, y = 0) {
  const d = BAU_BY_ID[typ];
  if (!d || !d.linie || typ === 'band') return { ok: false, grund: 'unbekannt' };
  if (!bauFrei(s, typ)) return { ok: false, grund: 'gesperrt' };
  const laenge = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (laenge < 0.4) return { ok: false, grund: 'kurz' };
  const gr = hallenGrenzen(werte(s).hallenFelder);
  for (const p of [a, b]) if (p[0] < gr.xMin || p[0] > gr.xMax || p[1] < gr.zMin || p[1] > gr.zMax) return { ok: false, grund: 'wand' };
  if (y > 0.1 && (!plattformBei(s, a[0], a[1], y) || !plattformBei(s, b[0], b[1], y))) return { ok: false, grund: 'kante' };
  if (typ !== 'leitung') {
    // Wände und Geländer gehen nicht durch Maschinen, Bänder, Stationen oder den Haufen
    const hinder = festeHindernisse();
    const n = Math.max(1, Math.ceil(laenge / 0.25));
    for (let i = 0; i <= n; i++) {
      const px = a[0] + ((b[0] - a[0]) * i) / n; const pz = a[1] + ((b[1] - a[1]) * i) / n;
      if (y < 0.1 && s.hf && haufenHoehe(s.hf, px, pz) > 0.15) return { ok: false, grund: 'haufen' };
      if (hinder.some((k) => px > k.x0 - 0.1 && px < k.x1 + 0.1 && pz > k.z0 - 0.1 && pz < k.z1 + 0.1)) return { ok: false, grund: 'belegt' };
      if (Math.hypot(px - STAND_TRICHTER.x, pz - STAND_TRICHTER.z) < 0.8 || Math.hypot(px - LADERAMPE.x, pz - LADERAMPE.z) < 1) return { ok: false, grund: 'belegt' };
      for (const bb of s.bauten) {
        if (Math.abs((bb.y || 0) - y) > 1.5 && bb.typ !== 'band') continue;
        if (bb.typ === 'band') {
          const nb = bandNaechster(bb, px, pz);
          if (nb.d < 0.45 && Math.abs(nb.y - (y + BAND_Y)) < 1.2) return { ok: false, grund: 'band' };
          continue;
        }
        if (bb.a || bb.typ === 'plattform' || bb.typ === 'dach' || bb.typ === 'klappe') continue;
        if (imFussabdruck(bb, px, pz, BAU_BY_ID[typ].b / 2)) return { ok: false, grund: 'belegt' };
      }
    }
  }
  const kosten = bauKosten(s, typ, laenge);
  return { ok: s.geld >= kosten, grund: s.geld >= kosten ? undefined : 'geld', laenge, kosten };
}

export function linieSetzen(s, typ, a, b, y = 0) {
  const p = liniePlanen(s, typ, a, b, y);
  if (!p.ok) return p;
  s.geld -= p.kosten;
  const bau = {
    id: s.naechsteId++, typ, a: [...a], b: [...b], x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, y,
    rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), bezahlt: p.kosten,
  };
  s.bauten.push(bau);
  bauGeaendert(s);
  return { ok: true, bau };
}

/* ------------------------------------------------------------ Abbauen */

/** Was der Abbau bringt und ob etwas verloren geht. */
export function abbauInfo(s, bau) {
  return { erstattung: bauErstattung(s, bau), geschenk: !!bau.geschenk, warnung: haeltNadel(s, bau) ? 'nadel' : null };
}

export function bauAbbauen(s, bau, ereignisse = []) {
  const i = s.bauten.indexOf(bau);
  if (i < 0) return { ok: false };
  const erstattung = bauErstattung(s, bau);
  if (bau.geschenk) s.geschenke[bau.typ] = (s.geschenke[bau.typ] || 0) + 1;
  else s.geld += erstattung;
  if (bau.typ === 'band') {
    for (const g of s.gegenstaende) {
      if (g.ort === 'band' && g.band === bau.id) { g.ort = 'flug'; g.band = null; g.vx = 0; g.vy = 0; g.vz = 0; g.flug = 0; }
    }
  } else {
    maschineLeeren(s, bau, ereignisse);
    const job = lauf(bau).job;
    if (job && job.g) { job.g.ort = 'flug'; job.g.vx = 0; job.g.vy = 0; job.g.vz = 0; job.g.flug = 0; }
  }
  s.bauten.splice(i, 1);
  bauGeaendert(s);
  return { ok: true, erstattung, geschenk: !!bau.geschenk };
}

/** Anzahl, für die Anzeige im Katalog. */
export const gebaut = (s, typ) => bauAnzahl(s, typ);

/* ------------------------------------------------------------ Kollision und Flächen */

/**
 * Kästen (Spieler stößt an) und Flächen (man steht darauf) aller Bauten,
 * dazu ein Gitter für schnelle Abfragen. Zwischengespeichert bis zur nächsten Änderung.
 */
export function bautenUmgebung(s) {
  const L = lauf(s);
  if (L.umgebung && L.umgebungVersion === bauVersion(s)) return L.umgebung;
  const kollider = [];
  const flaechen = [];
  const klappen = s.bauten.filter((b) => b.typ === 'klappe');
  const pfosten = (k, oben, dicke = 0.14) => {
    for (const [px, pz] of [[k.x0, k.z0], [k.x1, k.z0], [k.x0, k.z1], [k.x1, k.z1]]) {
      const x = Math.max(k.x0 + dicke / 2, Math.min(k.x1 - dicke / 2, px));
      const z = Math.max(k.z0 + dicke / 2, Math.min(k.z1 - dicke / 2, pz));
      kollider.push({ x0: x - dicke / 2, x1: x + dicke / 2, z0: z - dicke / 2, z1: z + dicke / 2, h: oben });
    }
  };
  for (const b of s.bauten) {
    const d = BAU_BY_ID[b.typ];
    const y0 = b.y || 0;
    if (b.typ === 'band') {
      const { segs } = bandGeometrie(b);
      for (const g of segs) {
        const n = Math.max(1, Math.ceil(g.len / 0.5));
        for (let i = 0; i < n; i++) {
          const t0 = (g.len * i) / n; const t1 = (g.len * (i + 1)) / n;
          const ax = g.ax + g.dx * t0; const az = g.az + g.dz * t0;
          const bx = g.ax + g.dx * t1; const bz = g.az + g.dz * t1;
          const top = Math.max(g.ay + g.dy * t0, g.ay + g.dy * t1) + 0.06;
          // Rechteck um das Stück Band (ohne Überstand an den Enden), als Kasten
          const px = -g.dz * 0.33; const pz = g.dx * 0.33;
          const xs = [ax + px, ax - px, bx + px, bx - px];
          const zs = [az + pz, az - pz, bz + pz, bz - pz];
          const k = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), h: top, band: b.id };
          if (top > 1.2) k.unten = top - 0.35;
          kollider.push(k);
          flaechen.push({ ...k });
        }
      }
      continue;
    }
    if (d.linie && b.a && b.b) {
      if (b.typ === 'leitung') continue;
      const l = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
      const n = Math.max(1, Math.ceil(l / 0.4));
      for (let i = 0; i < n; i++) {
        const t0 = i / n; const t1 = (i + 1) / n;
        const ax = b.a[0] + (b.b[0] - b.a[0]) * t0; const az = b.a[1] + (b.b[1] - b.a[1]) * t0;
        const bx = b.a[0] + (b.b[0] - b.a[0]) * t1; const bz = b.a[1] + (b.b[1] - b.a[1]) * t1;
        const r = d.b / 2 + 0.02;
        kollider.push({ x0: Math.min(ax, bx) - r, x1: Math.max(ax, bx) + r, z0: Math.min(az, bz) - r, z1: Math.max(az, bz) + r, h: y0 + d.h });
      }
      continue;
    }
    const k = fussabdruck(b.typ, b.x, b.z, b.rot || 0);
    if (b.typ === 'plattform') {
      const locher = klappen.filter((q) => imFussabdruck(b, q.x, q.z));
      const f = { x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, h: y0 + d.h, plattform: b.id };
      if (locher.length) f.hoeheBei = (x, z) => (locher.some((q) => imFussabdruck(q, x, z, -0.05)) ? -Infinity : y0 + d.h);
      flaechen.push(f);
      pfosten(k, y0 + d.h - 0.02);
      continue;
    }
    if (b.typ === 'treppe') {
      const bau = b;
      flaechen.push({
        x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, h: y0 + d.h,
        hoeheBei: (x, z) => {
          const [lx, lz] = weltZuLokal(bau, x, z);
          if (Math.abs(lx) > d.b / 2 || Math.abs(lz) > d.t / 2) return -Infinity;
          return y0 + d.h * Math.max(0, Math.min(1, (lz + d.t / 2) / d.t));
        },
      });
      continue;
    }
    if (b.typ === 'dach') { pfosten(k, y0 + d.h - 0.1, 0.12); continue; }
    if (b.typ === 'klappe') continue;
    const box = { x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, h: y0 + d.h, bau: b.id };
    if (y0 > 0.1) box.unten = y0;
    kollider.push(box);
    flaechen.push({ ...box });
  }
  const gitter = new Map();
  for (const f of flaechen) gitterEintragen(gitter, f.x0, f.z0, f.x1, f.z1, f);
  L.umgebung = { kollider, flaechen, gitter };
  L.umgebungVersion = bauVersion(s);
  return L.umgebung;
}

/** Auflagehöhe für Stücke bei (x, z) unterhalb von y (Boden, Haufen, Flächen). */
export function auflageBei(s, x, z, y = Infinity) {
  let h = s.hf ? Math.max(0, haufenHoehe(s.hf, x, z)) : 0;
  const u = bautenUmgebung(s);
  for (const f of gitterBei(u.gitter, x, z)) {
    if (f.band || x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
    const top = f.hoeheBei ? f.hoeheBei(x, z) : f.h;
    if (top <= y + SPIELER.stufe * 0.5 && top > h) h = top;
  }
  return h;
}

/** Kurzer Text zu einem Prüfgrund, für Hinweise. */
export const GRUND_TEXT = {
  gesperrt: 'Noch nicht erforscht', wand: 'Zu nah an der Wand', haufen: 'Da liegt Heu', belegt: 'Da steht schon etwas',
  band: 'Ein Band ist im Weg', geld: 'Nicht genug Geld', 'kein Weg': 'Kein Weg frei', kurz: 'Zu kurz', steil: 'Zu steil',
  lang: 'Zu lang', blockiert: 'Weg versperrt', draussen: 'Außerhalb der Halle', unbekannt: 'Geht nicht',
  kante: 'Steht nicht ganz auf der Plattform', boden: 'Nur auf dem Hallenboden',
};

