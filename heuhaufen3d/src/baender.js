// Förderbänder wie im Vorbild: Anfang und Ende setzen, der Weg dazwischen
// findet sich selbst (Raster 0,5 m, wenige Kurven, um Maschinen und den
// Haufen herum). Ein Band trägt Einträge (Stück, Weg); am Ende gibt es sie an
// Stand, Laster, Maschine oder das nächste Band weiter. Nimmt niemand an,
// fallen sie herunter. Landet etwas auf einem Band, fährt es mit. Reine Logik.

import { haufenHoehe } from './haufen.js';
import { werte } from './wirtschaft.js';
import { GROESSE, werfenMit } from './gegenstaende.js';
import {
  BAND_Y, BAU_BY_ID, lauf, fussabdruck, festeHindernisse, hallenGrenzen, streckenAbstand,
  gitterEintragen, gitterBei, lokalZuWelt,
} from './welt.js';

export const BAND_BREITE = 0.62;
export const RASTER = 0.5;
const KURVE = 0.55; // so weit vor der Ecke beginnt die Rundung
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------ Geometrie */

/** Die Bahn eines Bandes: Eckpunkte mit gerundeten Kurven als dichte Linie. */
export function bandBahn(punkte, radius = KURVE) {
  if (punkte.length < 3) return punkte.map((p) => [...p]);
  const aus = [[...punkte[0]]];
  for (let i = 1; i < punkte.length - 1; i++) {
    const p0 = punkte[i - 1]; const p1 = punkte[i]; const p2 = punkte[i + 1];
    const l1 = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const l2 = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const u1x = (p1[0] - p0[0]) / l1; const u1z = (p1[2] - p0[2]) / l1;
    const u2x = (p2[0] - p1[0]) / l2; const u2z = (p2[2] - p1[2]) / l2;
    if (u1x * u2x + u1z * u2z > 0.999) { aus.push([...p1]); continue; }
    const r = Math.min(radius, l1 * 0.5, l2 * 0.5);
    const a = [p1[0] - u1x * r, lerp(p0[1], p1[1], 1 - r / l1), p1[2] - u1z * r];
    const b = [p1[0] + u2x * r, lerp(p1[1], p2[1], r / l2), p1[2] + u2z * r];
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const ka = (1 - t) * (1 - t); const kb = 2 * (1 - t) * t; const kc = t * t;
      aus.push([ka * a[0] + kb * p1[0] + kc * b[0], ka * a[1] + kb * p1[1] + kc * b[1], ka * a[2] + kb * p1[2] + kc * b[2]]);
    }
  }
  aus.push([...punkte[punkte.length - 1]]);
  return aus;
}

function bahnSegmente(bahn) {
  const segs = [];
  let s0 = 0;
  for (let i = 0; i < bahn.length - 1; i++) {
    const a = bahn[i]; const b = bahn[i + 1];
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) continue;
    segs.push({ ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], dx: dx / len, dy: dy / len, dz: dz / len, len, s0 });
    s0 += len;
  }
  return { segs, laenge: s0 };
}

/** Geometrie eines Bandes (zwischengespeichert, bis sich die Punkte ändern). */
export function bandGeometrie(band) {
  const l = lauf(band);
  if (!l.geo || l.geo.punkte !== band.punkte) {
    const bahn = bandBahn(band.punkte);
    l.geo = { punkte: band.punkte, bahn, ...bahnSegmente(bahn) };
  }
  return l.geo;
}

export const bandLaenge = (band) => bandGeometrie(band).laenge;

/** Punkt und Richtung auf dem Band nach t Metern. */
export function bandPunkt(band, t) {
  const { segs, laenge } = bandGeometrie(band);
  if (!segs.length) return { x: band.punkte[0][0], y: band.punkte[0][1], z: band.punkte[0][2], dx: 1, dy: 0, dz: 0 };
  t = Math.max(0, Math.min(laenge, t));
  let lo = 0; let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].s0 <= t) lo = mid; else hi = mid - 1;
  }
  const g = segs[lo];
  const u = Math.min(g.len, t - g.s0);
  return { x: g.ax + g.dx * u, y: g.ay + g.dy * u, z: g.az + g.dz * u, dx: g.dx, dy: g.dy, dz: g.dz };
}

/** Nächster Punkt des Bandes zu (x, z): { d, t, y }. */
export function bandNaechster(band, x, z) {
  const { segs } = bandGeometrie(band);
  let beste = { d: Infinity, t: 0, y: 0 };
  for (const g of segs) {
    const r = streckenAbstand(x, z, g.ax, g.az, g.bx, g.bz);
    if (r.d < beste.d) beste = { d: r.d, t: g.s0 + r.t * g.len, y: lerp(g.ay, g.by, r.t) };
  }
  return beste;
}

/* ------------------------------------------------------------ Stücke auf dem Band */

const abstand = (a, b) => GROESSE[a] + GROESSE[b] + 0.08;

/** Ist auf dem Band bei t Platz für ein Stück der Ware art? */
export function platzAuf(band, t, art) {
  const l = lauf(band);
  if (t < 0 || t > bandLaenge(band) + 1e-6) return false;
  for (const g of l.items || []) if (Math.abs(g.t - t) < abstand(g.art, art)) return false;
  return true;
}

/** Legt ein Stück aufs Band bei t (ohne Platzprüfung). */
export function bandEinlegen(band, g, t) {
  g.ort = 'band';
  delete g.vomBand;
  g.band = band.id;
  g.t = t;
  g.vx = 0; g.vy = 0; g.vz = 0;
  const p = bandPunkt(band, t);
  g.x = p.x; g.y = p.y; g.z = p.z;
  const l = lauf(band);
  (l.items || (l.items = [])).push(g);
}

/** Freie Stelle nahe t suchen (bis ±0,6 m). */
export function freieStelle(band, t, art) {
  const L = bandLaenge(band);
  for (const d of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6]) {
    const tt = Math.max(0, Math.min(L, t + d));
    if (platzAuf(band, tt, art)) return tt;
  }
  return null;
}

/**
 * Ein fallendes Stück über einem Band? Dann fängt das Band es. netz.bandGitter
 * ordnet 1-m-Zellen den Bandsegmenten zu.
 */
export function bandFangen(netz, g) {
  if (!netz.bandGitter || g.y > netz.bandHoechst + 0.4) return false;
  for (const [band, seg] of gitterBei(netz.bandGitter, g.x, g.z)) {
    if (g.vomBand === band.id) continue; // gerade erst vorn heruntergefallen
    const r = streckenAbstand(g.x, g.z, seg.ax, seg.az, seg.bx, seg.bz);
    if (r.d > BAND_BREITE * 0.62) continue;
    const y = lerp(seg.ay, seg.by, r.t);
    if (g.y > y + 0.12 || g.y < y - 0.4) continue;
    const t = freieStelle(band, seg.s0 + r.t * seg.len, g.art);
    if (t == null) continue;
    bandEinlegen(band, g, t);
    return true;
  }
  return false;
}

/**
 * Bänder bewegen. netz.baender: alle Bänder; netz.abgeben(s, band, ziel, g, ereignisse)
 * gibt am Ende weiter und liefert true, wenn jemand angenommen hat.
 */
export function baenderSchritt(s, dt, netz, ereignisse) {
  const v = werte(s).band;
  for (const band of netz.baender) lauf(band).items = [];
  for (const g of s.gegenstaende) {
    if (g.ort !== 'band') continue;
    const band = netz.bauNachId.get(g.band);
    if (!band || band.typ !== 'band') { g.ort = 'flug'; g.vx = 0; g.vy = 0; g.vz = 0; g.flug = 0; continue; }
    lauf(band).items.push(g);
  }
  for (const band of netz.baender) {
    const l = lauf(band);
    const items = l.items;
    if (!items.length) { l.voll = false; continue; }
    items.sort((a, b) => b.t - a.t);
    const L = bandLaenge(band);
    let vorne = null;
    const bleiben = [];
    for (const g of items) {
      let nt = g.t + v * dt;
      if (vorne) nt = Math.min(nt, vorne.t - abstand(vorne.art, g.art));
      if (!vorne && nt >= L) {
        const ziel = l.ziel;
        if (ziel && netz.abgeben(s, band, ziel, g, ereignisse)) continue;
        // Will die Maschine am Ende diese Ware nie (Ballen vor dem Silo), fällt sie nach 2 s herunter
        let abwerfen = !ziel;
        if (ziel && ziel.art === 'bau' && netz.nimmtNie && netz.nimmtNie(ziel.bau, g.art)) {
          g.warte = (g.warte || 0) + dt;
          if (g.warte > 2) abwerfen = true;
        }
        if (abwerfen) {
          delete g.warte;
          // Nimmt niemand an: das Stück fällt vorn herunter.
          const p = bandPunkt(band, L);
          werfenMit(g, p.x + p.dx * 0.15, p.y + 0.02, p.z + p.dz * 0.15, p.dx * v, 0.4, p.dz * v);
          g.band = null;
          g.vomBand = band.id;
          continue;
        }
        nt = L;
      }
      if (nt > g.t) g.t = nt;
      const p = bandPunkt(band, g.t);
      g.x = p.x; g.y = p.y; g.z = p.z;
      g.dreh = Math.atan2(-p.dz, p.dx);
      bleiben.push(g);
      vorne = g;
    }
    l.items = bleiben;
    l.voll = bleiben.length > 0 && bleiben[0].t >= L - 1e-6;
  }
}

/* ------------------------------------------------------------ Anschlüsse */

/** Nach außen weisende Richtung eines Anschlusses (lokal an der Kante). */
export function anschlussRichtung(bau, lx, lz) {
  const d = BAU_BY_ID[bau.typ];
  const rx = Math.abs(lx) / Math.max(1e-6, d.b / 2);
  const rz = Math.abs(lz) / Math.max(1e-6, d.t / 2);
  const [nx, nz] = rx >= rz ? [Math.sign(lx) || 1, 0] : [0, Math.sign(lz) || 1];
  const [wx, wz] = lokalZuWelt({ x: 0, z: 0, rot: bau.rot }, nx, nz);
  return [wx, wz];
}

/** Alle Anschlüsse eines Baus in Welt, mit Höhe und Richtung. */
export function anschlussListe(bau) {
  const d = BAU_BY_ID[bau.typ];
  const y = (bau.y || 0) + BAND_Y;
  const liste = [];
  d.ein.forEach(([lx, lz], i) => {
    const [x, z] = lokalZuWelt(bau, lx, lz);
    liste.push({ art: 'ein', i, x, y: bau.typ === 'heutreppe' ? (bau.y || 0) + BAND_Y : y, z, richtung: anschlussRichtung(bau, lx, lz) });
  });
  d.aus.forEach(([lx, lz], i) => {
    const [x, z] = lokalZuWelt(bau, lx, lz);
    const hoch = bau.typ === 'heutreppe' || bau.typ === 'heulift' ? (bau.y || 0) + 2.2 + BAND_Y : y;
    liste.push({ art: 'aus', i, x, y: hoch, z, richtung: anschlussRichtung(bau, lx, lz) });
  });
  return liste;
}

/* ------------------------------------------------------------ Wegfindung */

class Haufenliste {
  constructor() { this.a = []; }
  get leer() { return !this.a.length; }
  rein(f, v) {
    const a = this.a; a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  raus() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; const r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
}

const RICHTUNGEN = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/**
 * Sperrraster für die Wegfindung: 0 frei, 1 belegt (Bauten, Bänder, Haufen,
 * Stationen), 2 Hallenwand. Zwischengespeichert, bis sich Bauten ändern oder
 * zwei Sekunden Spielzeit vergehen (der Haufen schrumpft langsam).
 */
function sperrRasterRoh(s, ohne) {
  const L = lauf(s);
  const felder = werte(s).hallenFelder;
  const schluessel = `${L.bauVersion || 0}|${felder}|${ohne.join(',')}|${Math.floor(s.zeit / 2)}`;
  if (L.sperrRaster && L.sperrRaster.schluessel === schluessel) return L.sperrRaster;
  const gr = hallenGrenzen(felder);
  const x0 = gr.xMin; const z0 = gr.zMin;
  const nx = Math.floor((gr.xMax - gr.xMin) / RASTER);
  const nz = Math.floor((gr.zMax - gr.zMin) / RASTER);
  const sperre = new Uint8Array(nx * nz);
  const H = RASTER / 2;
  for (let i = 0; i < nx; i++) {
    const cx = x0 + i * RASTER + H;
    for (let k = 0; k < nz; k++) {
      const cz = z0 + k * RASTER + H;
      if (cx < gr.xMin + 0.4 || cx > gr.xMax - 0.4 || cz < gr.zMin + 0.4 || cz > gr.zMax - 0.4) sperre[i * nz + k] = 2;
      else if (s.hf && haufenHoehe(s.hf, cx, cz) > 0.1) sperre[i * nz + k] = 1;
    }
  }
  const kasten = (kx0, kx1, kz0, kz1, rand) => {
    const i0 = Math.max(0, Math.floor((kx0 - rand - x0) / RASTER));
    const i1 = Math.min(nx - 1, Math.floor((kx1 + rand - x0) / RASTER));
    const k0 = Math.max(0, Math.floor((kz0 - rand - z0) / RASTER));
    const k1 = Math.min(nz - 1, Math.floor((kz1 + rand - z0) / RASTER));
    for (let i = i0; i <= i1; i++) {
      const cx = x0 + i * RASTER + H;
      if (cx < kx0 - rand || cx > kx1 + rand) continue;
      for (let kk = k0; kk <= k1; kk++) {
        const cz = z0 + kk * RASTER + H;
        if (cz < kz0 - rand || cz > kz1 + rand) continue;
        if (sperre[i * nz + kk] === 0) sperre[i * nz + kk] = 1;
      }
    }
  };
  const strecke = (ax, az, bx, bz, abst) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - abst - x0) / RASTER));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx) + abst - x0) / RASTER));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz) - abst - z0) / RASTER));
    const k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz) + abst - z0) / RASTER));
    const dx = bx - ax; const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    for (let i = i0; i <= i1; i++) {
      const cx = x0 + i * RASTER + H;
      for (let kk = k0; kk <= k1; kk++) {
        const cz = z0 + kk * RASTER + H;
        let u = l2 > 0 ? ((cx - ax) * dx + (cz - az) * dz) / l2 : 0;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const qx = ax + dx * u - cx; const qz = az + dz * u - cz;
        if (qx * qx + qz * qz < abst * abst && sperre[i * nz + kk] === 0) sperre[i * nz + kk] = 1;
      }
    }
  };
  for (const k of festeHindernisse()) kasten(k.x0, k.x1, k.z0, k.z1, 0.3);
  for (const b of s.bauten) {
    if (ohne.includes(b.id)) continue;
    if (b.typ === 'band') {
      for (const g of bandGeometrie(b).segs) strecke(g.ax, g.az, g.bx, g.bz, 0.52);
      continue;
    }
    if (b.typ === 'plattform' || b.typ === 'dach' || b.typ === 'leitung' || b.typ === 'klappe') continue;
    if (b.a && b.b) { strecke(b.a[0], b.a[1], b.b[0], b.b[1], 0.45); continue; }
    const k = fussabdruck(b.typ, b.x, b.z, b.rot || 0);
    kasten(k.x0, k.x1, k.z0, k.z1, 0.28);
  }
  L.sperrRaster = { schluessel, sperre, nx, nz, x0, z0 };
  return L.sperrRaster;
}

/** Sperrraster mit freien Kreisen um Anfang und Ende (Wände bleiben gesperrt). */
export function sperrRaster(s, { frei = [], ohne = [] } = {}) {
  const roh = sperrRasterRoh(s, ohne);
  const { nx, nz, x0, z0 } = roh;
  const sperre = roh.sperre.slice();
  for (const [fx, fz, r] of frei) {
    const i0 = Math.max(0, Math.floor((fx - r - x0) / RASTER));
    const i1 = Math.min(nx - 1, Math.floor((fx + r - x0) / RASTER));
    const k0 = Math.max(0, Math.floor((fz - r - z0) / RASTER));
    const k1 = Math.min(nz - 1, Math.floor((fz + r - z0) / RASTER));
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) {
        const cx = x0 + (i + 0.5) * RASTER - fx; const cz = z0 + (k + 0.5) * RASTER - fz;
        if (cx * cx + cz * cz < r * r && sperre[i * nz + k] === 1) sperre[i * nz + k] = 0;
      }
    }
  }
  const mitte = (i, k) => [x0 + (i + 0.5) * RASTER, z0 + (k + 0.5) * RASTER];
  return { sperre, nx, nz, x0, z0, mitte };
}

/**
 * Weg für ein Band von `von` nach `nach` ({x, y, z, richtung?}). richtung: bei
 * Anschlüssen die Richtung, in die das Band dort laufen muss. gerade: ohne
 * Raster, direkt (Einrasten aus). Liefert { punkte, laenge } oder { fehler }.
 */
export function bandWeg(s, von, nach, { ohne = [], gerade = false, maxSchritte = 60000 } = {}) {
  const frei = [[von.x, von.z, 0.75], [nach.x, nach.z, 0.75]];
  const raster = sperrRaster(s, { frei, ohne });
  const { sperre, nx, nz, x0, z0, mitte } = raster;
  const zelle = (x, z) => [Math.floor((x - x0) / RASTER), Math.floor((z - z0) / RASTER)];
  const gesperrt = (x, z) => {
    const [i, k] = zelle(x, z);
    return i < 0 || k < 0 || i >= nx || k >= nz || sperre[i * nz + k] !== 0;
  };
  const hoehe = (punkte) => {
    // Höhe gleichmäßig von von.y nach nach.y über die Länge
    let laenge = 0;
    const abschnitte = [0];
    for (let i = 1; i < punkte.length; i++) {
      laenge += Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]);
      abschnitte.push(laenge);
    }
    return {
      laenge,
      punkte: punkte.map((p, i) => [p[0], lerp(von.y, nach.y, laenge > 0 ? abschnitte[i] / laenge : 0), p[1]]),
    };
  };
  const fertig = (flach) => {
    const r = hoehe(flach);
    if (r.laenge < 0.6) return { fehler: 'kurz' };
    if (Math.abs(nach.y - von.y) / r.laenge > 0.6) return { fehler: 'steil' };
    if (r.laenge > 80) return { fehler: 'lang' };
    return r;
  };

  if (gerade) {
    const l = Math.hypot(nach.x - von.x, nach.z - von.z);
    for (let t = 0.2; t < l - 0.2; t += 0.25) {
      const x = lerp(von.x, nach.x, t / l); const z = lerp(von.z, nach.z, t / l);
      if (gesperrt(x, z)) return { fehler: 'blockiert' };
    }
    return fertig([[von.x, von.z], [nach.x, nach.z]]);
  }

  const stubA = von.richtung ? [von.x + von.richtung[0] * 0.5, von.z + von.richtung[1] * 0.5] : [von.x, von.z];
  const stubB = nach.richtung ? [nach.x - nach.richtung[0] * 0.5, nach.z - nach.richtung[1] * 0.5] : [nach.x, nach.z];
  const [ai, ak] = zelle(...stubA);
  const [bi, bk] = zelle(...stubB);
  if (ai < 0 || ak < 0 || ai >= nx || ak >= nz || bi < 0 || bk < 0 || bi >= nx || bk >= nz) return { fehler: 'draussen' };
  sperre[ai * nz + ak] = 0;
  sperre[bi * nz + bk] = 0;

  // A* über (Zelle, Richtung): jede Kurve kostet extra, damit der Weg ruhig bleibt.
  const N = nx * nz * 4;
  const kosten = new Float32Array(N).fill(Infinity);
  const her = new Int32Array(N).fill(-1);
  const offen = new Haufenliste();
  const h = (i, k) => Math.abs(i - bi) + Math.abs(k - bk);
  const startRichtungen = von.richtung
    ? [RICHTUNGEN.findIndex(([dx, dz]) => dx === Math.round(von.richtung[0]) && dz === Math.round(von.richtung[1]))].filter((d) => d >= 0)
    : [0, 1, 2, 3];
  for (const d of (startRichtungen.length ? startRichtungen : [0, 1, 2, 3])) {
    const st = (ai * nz + ak) * 4 + d;
    kosten[st] = 0;
    offen.rein(h(ai, ak), st);
  }
  const zielRichtung = nach.richtung
    ? RICHTUNGEN.findIndex(([dx, dz]) => dx === Math.round(nach.richtung[0]) && dz === Math.round(nach.richtung[1]))
    : -1;
  let ende = -1;
  let schritte = 0;
  while (!offen.leer && schritte++ < maxSchritte) {
    const st = offen.raus();
    const d = st & 3;
    const c = st >> 2;
    const i = Math.floor(c / nz); const k = c % nz;
    if (i === bi && k === bk) { ende = st; break; }
    const g0 = kosten[st];
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue;
      const ni = i + RICHTUNGEN[nd][0]; const nk = k + RICHTUNGEN[nd][1];
      if (ni < 0 || nk < 0 || ni >= nx || nk >= nz || sperre[ni * nz + nk]) continue;
      const ns = (ni * nz + nk) * 4 + nd;
      const amZiel = ni === bi && nk === bk;
      const ng = g0 + 1 + (nd === d ? 0 : 1.6) + (amZiel && zielRichtung >= 0 && nd !== zielRichtung ? 1.6 : 0);
      if (ng < kosten[ns]) {
        kosten[ns] = ng;
        her[ns] = st;
        offen.rein(ng + h(ni, nk), ns);
      }
    }
  }
  if (ende < 0) return { fehler: 'kein Weg' };
  // Zellen zurückverfolgen, nur die Ecken behalten
  const zellen = [];
  for (let st = ende; st >= 0; st = her[st]) zellen.push(st >> 2);
  zellen.reverse();
  const ik = (c) => [Math.floor(c / nz), c % nz];
  const ecken = [];
  for (let n = 0; n < zellen.length; n++) {
    if (n === 0 || n === zellen.length - 1) { ecken.push(zellen[n]); continue; }
    const [ia, ka] = ik(zellen[n - 1]); const [ic, kc] = ik(zellen[n]); const [ib, kb] = ik(zellen[n + 1]);
    if (ic - ia !== ib - ic || kc - ka !== kb - kc) ecken.push(zellen[n]);
  }
  let pts = ecken.map((c) => mitte(...ik(c)));
  if (pts.length < 2) {
    pts = [[...stubA], [...stubB]];
  } else {
    // Erste und letzte Gerade seitlich auf die Anschlüsse ausrichten, damit kein Versatz bleibt.
    const ausrichten = (a, b, stub) => {
      if (Math.abs(a[1] - b[1]) < 1e-6) { a[1] = stub[1]; b[1] = stub[1]; } else { a[0] = stub[0]; b[0] = stub[0]; }
    };
    if (pts.length > 2) {
      ausrichten(pts[0], pts[1], stubA);
      ausrichten(pts[pts.length - 1], pts[pts.length - 2], stubB);
      pts[0] = [...stubA];
      pts[pts.length - 1] = [...stubB];
    } else {
      pts = [[...stubA], [...stubB]];
    }
  }
  const flach = [[von.x, von.z], ...pts, [nach.x, nach.z]];
  // doppelte und gerade Zwischenpunkte weg
  const sauber = [];
  for (const p of flach) {
    const q = sauber[sauber.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05) continue;
    sauber.push(p);
  }
  for (let n = sauber.length - 2; n >= 1; n--) {
    const a = sauber[n - 1]; const b = sauber[n]; const c = sauber[n + 1];
    const kreuz = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const skal = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (Math.abs(kreuz) < 1e-4 && skal > 0) sauber.splice(n, 1);
  }
  return fertig(sauber);
}

/** Das Band als Bau (ohne Kosten; die rechnet bauen.js). */
export function bandBau(id, punkte) {
  const [x, , z] = punkte[0];
  return { id, typ: 'band', x, z, y: punkte[0][1] - BAND_Y, rot: 0, punkte };
}

/** Wo der Hallenboden die Bänder trägt: Oberkante bei Bauhöhe y. */
export const bandHoehe = (y = 0) => y + BAND_Y;

