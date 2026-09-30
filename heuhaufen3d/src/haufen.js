// Der Heuhaufen als Höhenfeld: ein Gitter aus Säulen über dem Boden. Wer an
// einer Stelle Heu wegnimmt, senkt dort die Säulen; zu steile Kanten rutschen
// nach (Schüttwinkel), so dass der Haufen von selbst nachsackt, wenn Arme an
// seinem Rand graben. Gezählt wird in Halmen: Volumen mal Dichte.
//
// Reine Logik ohne DOM und ohne three.js, damit Tests und der Auto-Spieler sie nutzen.

export const HAUFEN_ZELLE = 0.25; // Meter je Gitterzelle

/**
 * Neuer Haufen. halme: Gesamtzahl; radius/hoehe in Metern; form 'kuppel'.
 * Die Dichte ergibt sich so, dass Volumen mal Dichte genau die Halmzahl ist.
 */
export function haufenNeu({ halme, radius, hoehe, mitteX = 0, mitteZ = 0, zufall = Math.random, beulen = 0.04 }) {
  const rand = 1.5; // Meter Rand ums Gitter, in den nachgerutschtes Heu fallen kann
  const n = Math.ceil((2 * (radius + rand)) / HAUFEN_ZELLE) + 1;
  const x0 = mitteX - ((n - 1) * HAUFEN_ZELLE) / 2;
  const z0 = mitteZ - ((n - 1) * HAUFEN_ZELLE) / 2;
  const h = new Float32Array(n * n);
  // Ein paar sanfte Beulen, damit die Kuppel nicht wie gedrechselt aussieht.
  const wellen = Array.from({ length: 5 }, () => ({
    // ganzzahlige Frequenz: sonst gäbe es bei ±180° eine Naht im Haufen
    f: 2 + Math.floor(zufall() * 4), p: zufall() * Math.PI * 2, a: beulen * (0.5 + zufall()), w: zufall() * Math.PI * 2,
  }));
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * HAUFEN_ZELLE - mitteX;
      const z = z0 + j * HAUFEN_ZELLE - mitteZ;
      const r = Math.hypot(x, z) / radius;
      if (r >= 1) continue;
      const winkel = Math.atan2(z, x);
      const laib = hoehe <= 5 ? 0.5 : 0; // erste Ladung: breiter Laib mit steilem Rand wie S0
      let f = laib * (1 - r * r * r) + (1 - laib) * Math.cos((r * Math.PI) / 2);
      // Beulen nur zwischen Mitte und Rand: an der Spitze wäre jede Winkelwelle ein Grat.
      for (const w of wellen) f *= 1 + w.a * Math.sin(winkel * w.f + w.p + r * w.w) * 4 * r * (1 - r);
      h[j * n + i] = Math.max(0, hoehe * f);
    }
  }
  const hf = {
    n, zelle: HAUFEN_ZELLE, x0, z0, h, mitteX, mitteZ, radius, hoehe,
    dichte: 1, gesamt: halme, aenderung: 0,
    maxSteigung: 1.25,
    schmutz: null,
  };
  // Steilste erlaubte Neigung (Höhe je Meter): mindestens so steil wie die Kuppel selbst,
  // sonst würde sie gleich nach dem Start zusammensacken.
  let steilste = 0;
  for (let j = 1; j < n; j++) {
    for (let i = 1; i < n; i++) {
      const k = j * n + i;
      steilste = Math.max(steilste, Math.abs(h[k] - h[k - 1]), Math.abs(h[k] - h[k - n]));
    }
  }
  hf.maxSteigung = Math.max(1.25, (steilste / HAUFEN_ZELLE) * 1.02);
  hf.dichte = halme / Math.max(1e-9, haufenVolumen(hf));
  return hf;
}

export function haufenVolumen(hf) {
  let s = 0;
  for (let i = 0; i < hf.h.length; i++) s += hf.h[i];
  return s * hf.zelle * hf.zelle;
}

/** Halme, die noch im Haufen liegen. */
export const haufenRest = (hf) => Math.max(0, haufenVolumen(hf) * hf.dichte);

/** Höhe der Oberfläche an (x, z), bilinear zwischen den Säulen; außerhalb 0. */
export function haufenHoehe(hf, x, z) {
  const fi = (x - hf.x0) / hf.zelle;
  const fj = (z - hf.z0) / hf.zelle;
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  if (i < 0 || j < 0 || i >= hf.n - 1 || j >= hf.n - 1) return 0;
  const tx = fi - i;
  const tz = fj - j;
  const n = hf.n;
  const a = hf.h[j * n + i];
  const b = hf.h[j * n + i + 1];
  const c = hf.h[(j + 1) * n + i];
  const d = hf.h[(j + 1) * n + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** Normale der Oberfläche an (x, z) als [nx, ny, nz]. */
export function haufenNormale(hf, x, z) {
  const e = hf.zelle;
  const dx = (haufenHoehe(hf, x + e, z) - haufenHoehe(hf, x - e, z)) / (2 * e);
  const dz = (haufenHoehe(hf, x, z + e) - haufenHoehe(hf, x, z - e)) / (2 * e);
  const l = Math.hypot(dx, 1, dz);
  return [-dx / l, 1 / l, -dz / l];
}

function schmutzMelden(hf, i0, j0, i1, j1) {
  const s = hf.schmutz;
  if (!s) hf.schmutz = [i0, j0, i1, j1];
  else {
    s[0] = Math.min(s[0], i0); s[1] = Math.min(s[1], j0);
    s[2] = Math.max(s[2], i1); s[3] = Math.max(s[3], j1);
  }
}

/**
 * Nimmt bis zu `halme` an (x, z) weg, verteilt über einen Kreis mit `radius`
 * Metern (weich zum Rand hin). Liefert die tatsächlich entnommene Menge.
 */
export function haufenAbtragen(hf, x, z, halme, radius = 0.6) {
  if (halme <= 0) return 0;
  const volumen = halme / hf.dichte;
  const n = hf.n;
  const rz = Math.max(1, Math.ceil(radius / hf.zelle));
  const ci = Math.round((x - hf.x0) / hf.zelle);
  const cj = Math.round((z - hf.z0) / hf.zelle);
  // Gewichte sammeln, begrenzt durch das, was an jeder Stelle liegt.
  let gewichtSumme = 0;
  const zellen = [];
  for (let j = cj - rz; j <= cj + rz; j++) {
    for (let i = ci - rz; i <= ci + rz; i++) {
      if (i < 1 || j < 1 || i >= n - 1 || j >= n - 1) continue;
      const d = Math.hypot(i - ci, j - cj) * hf.zelle;
      if (d > radius) continue;
      const k = j * n + i;
      if (hf.h[k] <= 0) continue;
      const g = 1 - (d / radius) * 0.7;
      zellen.push(k, g);
      gewichtSumme += g;
    }
  }
  if (!zellen.length) return 0;
  const flaeche = hf.zelle * hf.zelle;
  let genommen = 0;
  let rest = volumen;
  // Zwei Durchgänge: was eine flache Stelle nicht hergibt, holen die anderen.
  for (let durchgang = 0; durchgang < 3 && rest > 1e-9; durchgang++) {
    let summe = 0;
    for (let q = 0; q < zellen.length; q += 2) if (hf.h[zellen[q]] > 0) summe += zellen[q + 1];
    if (summe <= 0) break;
    const vorher = rest;
    for (let q = 0; q < zellen.length; q += 2) {
      const k = zellen[q];
      if (hf.h[k] <= 0) continue;
      const soll = (vorher * zellen[q + 1]) / summe / flaeche;
      const dh = Math.min(hf.h[k], soll);
      hf.h[k] -= dh;
      rest -= dh * flaeche;
      genommen += dh * flaeche;
    }
  }
  schmutzMelden(hf, ci - rz - 1, cj - rz - 1, ci + rz + 1, cj + rz + 1);
  hf.aenderung++;
  return genommen * hf.dichte;
}

/**
 * Gleichmäßig abtragen: alle Säulen im selben Verhältnis niedriger, bis `halme` weg
 * sind (für geschätzte Abwesenheit, wenn die Greifstellen nicht genug hergeben).
 * Liefert, was genommen wurde.
 */
export function haufenSchrumpfen(hf, halme) {
  const vorher = haufenRest(hf);
  if (halme <= 0 || vorher <= 0) return 0;
  const f = Math.max(0, 1 - halme / vorher);
  for (let k = 0; k < hf.h.length; k++) if (hf.h[k] > 0) hf.h[k] *= f;
  schmutzMelden(hf, 0, 0, hf.n - 1, hf.n - 1);
  hf.aenderung++;
  return vorher - haufenRest(hf);
}

/**
 * Rutschen lassen: wo zwei Nachbarsäulen steiler als der Schüttwinkel
 * zueinander stehen, wandert Heu nach unten. Arbeitet nur im geänderten
 * Bereich und wächst mit ihm. Liefert true, solange noch etwas rutscht.
 */
export function haufenSetzen(hf, durchgaenge = 4) {
  if (!hf.schmutz) return false;
  const n = hf.n;
  const h = hf.h;
  const maxD = hf.maxSteigung * hf.zelle;
  let [i0, j0, i1, j1] = hf.schmutz;
  let bewegt = false;
  for (let d = 0; d < durchgaenge; d++) {
    i0 = Math.max(1, i0 - 1); j0 = Math.max(1, j0 - 1);
    i1 = Math.min(n - 2, i1 + 1); j1 = Math.min(n - 2, j1 + 1);
    let nI0 = n; let nJ0 = n; let nI1 = -1; let nJ1 = -1;
    let diesmal = false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        const hk = h[k];
        if (hk <= 0) continue;
        // vier Nachbarn; Randzellen bleiben leer (Boden)
        for (let q = 0; q < 4; q++) {
          const nk = q === 0 ? k - 1 : q === 1 ? k + 1 : q === 2 ? k - n : k + n;
          const ni = q === 0 ? i - 1 : q === 1 ? i + 1 : i;
          const nj = q === 2 ? j - 1 : q === 3 ? j + 1 : j;
          const diff = h[k] - h[nk];
          if (diff <= maxD) continue;
          if (ni <= 0 || nj <= 0 || ni >= n - 1 || nj >= n - 1) continue;
          const m = (diff - maxD) * 0.25;
          h[k] -= m;
          h[nk] += m;
          diesmal = true;
          if (i < nI0) nI0 = i; if (j < nJ0) nJ0 = j;
          if (i > nI1) nI1 = i; if (j > nJ1) nJ1 = j;
        }
      }
    }
    if (!diesmal) { hf.schmutz = null; break; }
    bewegt = true;
    i0 = nI0; j0 = nJ0; i1 = nI1; j1 = nJ1;
    hf.schmutz = [i0, j0, i1, j1];
  }
  if (bewegt) hf.aenderung++;
  return !!hf.schmutz;
}

/**
 * Wo trifft ein Strahl (Ursprung o, Richtung d, normiert) die Oberfläche?
 * Einfaches Abtasten mit Verfeinerung; liefert {x, y, z, t} oder null.
 */
export function haufenStrahl(hf, ox, oy, oz, dx, dy, dz, maxT = 8) {
  const schritt = hf.zelle * 0.5;
  let vorherT = 0;
  let vorherUeber = oy - haufenHoehe(hf, ox, oz);
  if (vorherUeber < 0) return null; // wir stecken im Heu
  for (let t = schritt; t <= maxT; t += schritt) {
    const x = ox + dx * t;
    const y = oy + dy * t;
    const z = oz + dz * t;
    const ueber = y - haufenHoehe(hf, x, z);
    if (ueber <= 0) {
      // zwischen vorherT und t verfeinern
      let a = vorherT;
      let b = t;
      for (let k = 0; k < 8; k++) {
        const m = (a + b) / 2;
        const um = oy + dy * m - haufenHoehe(hf, ox + dx * m, oz + dz * m);
        if (um > 0) a = m; else b = m;
      }
      const tt = (a + b) / 2;
      const hx = ox + dx * tt;
      const hz = oz + dz * tt;
      const hy = haufenHoehe(hf, hx, hz);
      if (hy <= 0.02) return null; // das ist Boden, kein Heu
      return { x: hx, y: hy, z: hz, t: tt };
    }
    vorherT = t;
    vorherUeber = ueber;
  }
  return null;
}

/** Höhe des Haufens an seiner höchsten Stelle. */
export function haufenGipfel(hf) {
  let m = 0;
  for (let i = 0; i < hf.h.length; i++) if (hf.h[i] > m) m = hf.h[i];
  return m;
}

/** Äußerster Radius (von der Mitte), an dem noch nennenswert Heu liegt. */
export function haufenAusdehnung(hf, schwelle = 0.05) {
  let r = 0;
  const n = hf.n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (hf.h[j * n + i] > schwelle) {
        const d = Math.hypot(hf.x0 + i * hf.zelle - hf.mitteX, hf.z0 + j * hf.zelle - hf.mitteZ);
        if (d > r) r = d;
      }
    }
  }
  return r;
}

/** Für den Spielstand: Höhen als kompakte Zeichenkette (Millimeter, 16 Bit, base64). */
export function haufenPacken(hf) {
  const q = new Uint16Array(hf.h.length);
  for (let i = 0; i < q.length; i++) q[i] = Math.max(0, Math.min(65535, Math.round(hf.h[i] * 1000)));
  const bytes = new Uint8Array(q.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    n: hf.n, zelle: hf.zelle, x0: hf.x0, z0: hf.z0, mitteX: hf.mitteX, mitteZ: hf.mitteZ,
    radius: hf.radius, hoehe: hf.hoehe, dichte: hf.dichte, gesamt: hf.gesamt, maxSteigung: hf.maxSteigung,
    h: typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64'),
  };
}

export function haufenEntpacken(p) {
  if (!p || typeof p.h !== 'string' || !Number.isInteger(p.n) || p.n < 3 || p.n > 400) return null;
  let bytes;
  try {
    if (typeof atob === 'function') {
      const s = atob(p.h);
      bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    } else bytes = new Uint8Array(Buffer.from(p.h, 'base64'));
  } catch { return null; }
  if (bytes.length !== p.n * p.n * 2) return null;
  const q = new Uint16Array(bytes.buffer, bytes.byteOffset, p.n * p.n);
  const h = new Float32Array(p.n * p.n);
  for (let i = 0; i < h.length; i++) h[i] = q[i] / 1000;
  const zahl = (v, d) => (Number.isFinite(v) ? v : d);
  return {
    n: p.n, zelle: zahl(p.zelle, HAUFEN_ZELLE), x0: zahl(p.x0, 0), z0: zahl(p.z0, 0),
    mitteX: zahl(p.mitteX, 0), mitteZ: zahl(p.mitteZ, 0), radius: zahl(p.radius, 7), hoehe: zahl(p.hoehe, 5),
    dichte: zahl(p.dichte, 1), gesamt: zahl(p.gesamt, 1), maxSteigung: zahl(p.maxSteigung, 1.25),
    h, aenderung: 1, schmutz: null,
  };
}
