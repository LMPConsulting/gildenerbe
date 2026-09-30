// Alle Texturen werden im Browser gemalt: kein Bild liegt in der Datei.
// Jede Funktion liefert eine THREE.CanvasTexture, gekachelt wo sinnvoll.

import * as THREE from '../../vendor/three.module.min.js';

/** Kleiner, reproduzierbarer Zufall nur für Texturen (unabhängig vom Spielstand). */
function texturZufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leinwandNeu(b, h = b) {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  return c;
}

function alsTextur(c, { kachel = true, farbe = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (kachel) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  if (farbe) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Linie, die über den Rand hinweg auf der anderen Seite weitergeht: kachelbar. */
function kachelLinie(x, s, b, zeichne) {
  for (const dx of [-b, 0, b]) {
    for (const dy of [-b, 0, b]) {
      x.save();
      x.translate(dx, dy);
      zeichne(x);
      x.restore();
    }
  }
}

const STROH_FARBEN = ['#d0a14d', '#d9a263', '#e8c98a', '#c8923f', '#dcaa5c', '#e3b46a', '#b87a38', '#8d521b', '#d9a263'];

/**
 * Stroh: dicht gekreuzte Halme in Heutönen. Liefert Farb- und Relieftextur,
 * beide kachelbar. dichte ~ Halme pro Kachel.
 */
export function strohTexturen(groesse = 512, dichte = 2600, seed = 7) {
  const z = texturZufall(seed);
  const farbe = leinwandNeu(groesse);
  const relief = leinwandNeu(groesse);
  const f = farbe.getContext('2d');
  const r = relief.getContext('2d');
  f.fillStyle = '#b07c3c';
  f.fillRect(0, 0, groesse, groesse);
  r.fillStyle = '#000';
  r.fillRect(0, 0, groesse, groesse);
  f.lineCap = 'round';
  r.lineCap = 'round';
  for (let i = 0; i < dichte; i++) {
    const x = z() * groesse;
    const y = z() * groesse;
    const a = z() * Math.PI;
    const l = groesse * (0.03 + z() * 0.07);
    const breite = groesse * (0.005 + z() * 0.006);
    const dx = Math.cos(a) * l / 2;
    const dy = Math.sin(a) * l / 2;
    const tiefe = i / dichte; // später gemalte Halme liegen oben
    const farbwahl = STROH_FARBEN[Math.floor(z() * STROH_FARBEN.length)];
    kachelLinie(f, 0, groesse, (x2) => {
      // Schatten unter dem Halm
      x2.strokeStyle = 'rgba(60,35,10,0.35)';
      x2.lineWidth = breite * 1.9;
      x2.beginPath(); x2.moveTo(x - dx + 1, y - dy + 1.5); x2.lineTo(x + dx + 1, y + dy + 1.5); x2.stroke();
      x2.strokeStyle = farbwahl;
      x2.lineWidth = breite;
      x2.beginPath(); x2.moveTo(x - dx, y - dy); x2.lineTo(x + dx, y + dy); x2.stroke();
      // Glanzkante
      x2.strokeStyle = 'rgba(255,248,215,0.35)';
      x2.lineWidth = breite * 0.35;
      x2.beginPath(); x2.moveTo(x - dx - 0.5, y - dy - 0.6); x2.lineTo(x + dx - 0.5, y + dy - 0.6); x2.stroke();
    });
    const g = Math.round(90 + tiefe * 165);
    kachelLinie(r, 0, groesse, (x2) => {
      x2.strokeStyle = `rgb(${g},${g},${g})`;
      x2.lineWidth = breite * 1.3;
      x2.beginPath(); x2.moveTo(x - dx, y - dy); x2.lineTo(x + dx, y + dy); x2.stroke();
    });
  }
  return { farbe: alsTextur(farbe), relief: alsTextur(relief, { farbe: false }) };
}

/** Sandiger Betonboden mit Flecken, Kies und feinen Rissen. */
export function bodenTextur(groesse = 512, seed = 11) {
  const z = texturZufall(seed);
  const c = leinwandNeu(groesse);
  const x = c.getContext('2d');
  x.fillStyle = '#d2b392';
  x.fillRect(0, 0, groesse, groesse);
  // große, weiche Flecken
  for (let i = 0; i < 70; i++) {
    const px = z() * groesse;
    const py = z() * groesse;
    const rad = groesse * (0.05 + z() * 0.18);
    const hell = z() < 0.5;
    kachelLinie(x, 0, groesse, (x2) => {
      const g = x2.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, hell ? 'rgba(214,196,164,0.28)' : 'rgba(120,98,70,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x2.fillStyle = g;
      x2.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  // Körnung
  const bild = x.getImageData(0, 0, groesse, groesse);
  const d = bild.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (z() - 0.5) * 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  x.putImageData(bild, 0, 0);
  // Kiesel
  for (let i = 0; i < 900; i++) {
    const px = z() * groesse;
    const py = z() * groesse;
    const rr = 0.6 + z() * 1.8;
    x.fillStyle = z() < 0.5 ? 'rgba(90,72,52,0.45)' : 'rgba(235,222,196,0.4)';
    x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
  }
  // feine Risse
  x.strokeStyle = 'rgba(80,62,44,0.28)';
  x.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let px = z() * groesse;
    let py = z() * groesse;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 8; k++) {
      px += (z() - 0.5) * 40;
      py += (z() - 0.5) * 40;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return alsTextur(c);
}

/** Senkrechte, dunkle Holzplanken mit Maserung und Fugen. */
export function plankenTextur(groesse = 512, planken = 8, seed = 23) {
  const z = texturZufall(seed);
  const c = leinwandNeu(groesse);
  const x = c.getContext('2d');
  const b = groesse / planken;
  for (let i = 0; i < planken; i++) {
    const ton = 96 + z() * 24;
    x.fillStyle = `rgb(${ton + 26},${ton + 2},${ton - 18})`;
    x.fillRect(i * b, 0, b, groesse);
    // Maserung
    for (let k = 0; k < 26; k++) {
      const px = i * b + z() * b;
      x.strokeStyle = `rgba(${z() < 0.5 ? '30,18,8' : '140,100,65'},${0.12 + z() * 0.18})`;
      x.lineWidth = 0.6 + z() * 1.4;
      x.beginPath();
      x.moveTo(px, 0);
      let yy = 0;
      let xx = px;
      while (yy < groesse) {
        yy += 20 + z() * 40;
        xx += (z() - 0.5) * 3;
        x.lineTo(Math.min(i * b + b - 1, Math.max(i * b + 1, xx)), yy);
      }
      x.stroke();
    }
    // Astlöcher
    if (z() < 0.5) {
      const py = z() * groesse;
      const px = i * b + b * (0.3 + z() * 0.4);
      x.fillStyle = 'rgba(35,20,10,0.55)';
      x.beginPath(); x.ellipse(px, py, 3 + z() * 3, 5 + z() * 4, 0, 0, Math.PI * 2); x.fill();
    }
    // Fuge
    x.fillStyle = 'rgba(15,9,4,0.85)';
    x.fillRect(i * b, 0, 2, groesse);
    x.fillStyle = 'rgba(255,220,180,0.06)';
    x.fillRect(i * b + 2, 0, 1, groesse);
  }
  // Nägel in zwei Reihen
  for (const fy of [0.12, 0.88]) {
    for (let i = 0; i < planken; i++) {
      x.fillStyle = 'rgba(20,20,22,0.8)';
      x.beginPath(); x.arc(i * b + b * 0.5, groesse * fy, 1.6, 0, Math.PI * 2); x.fill();
    }
  }
  return alsTextur(c);
}

/** Wellblech in Rostbraun für das obere Wandband und Dächer. */
export function wellblechTextur(groesse = 256, seed = 31) {
  const z = texturZufall(seed);
  const c = leinwandNeu(groesse);
  const x = c.getContext('2d');
  const wellen = 16;
  for (let i = 0; i < groesse; i++) {
    const p = (i / groesse) * wellen * Math.PI * 2;
    const l = 0.5 + 0.5 * Math.sin(p);
    const ton = 70 + l * 60;
    x.fillStyle = `rgb(${ton + 25},${ton * 0.72 + 10},${ton * 0.55})`;
    x.fillRect(i, 0, 1, groesse);
  }
  // Rostschlieren
  for (let i = 0; i < 60; i++) {
    const px = z() * groesse;
    const py = z() * groesse;
    x.fillStyle = `rgba(${120 + z() * 60},${50 + z() * 30},20,${0.08 + z() * 0.12})`;
    x.fillRect(px, py, 1 + z() * 4, 10 + z() * 60);
  }
  return alsTextur(c);
}

/** Rostiger Stahl für Bögen und Pfosten. */
export function rostTextur(groesse = 128, seed = 41) {
  const z = texturZufall(seed);
  const c = leinwandNeu(groesse);
  const x = c.getContext('2d');
  x.fillStyle = '#8a6a50';
  x.fillRect(0, 0, groesse, groesse);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(${90 + z() * 80},${40 + z() * 40},${20 + z() * 20},${0.2 + z() * 0.3})`;
    x.fillRect(z() * groesse, z() * groesse, 1 + z() * 6, 1 + z() * 3);
  }
  return alsTextur(c);
}

/** Schild mit Text, z. B. über dem Stand. */
export function schildTextur(zeilen, {
  breite = 512, hoehe = 128, grund = '#2b1d12', schrift = '#f3e7cc', rahmen = '#6b4a2d',
  font = '700 {g}px Georgia, "Times New Roman", serif', groesse = 0.5, kreide = false,
} = {}) {
  const c = leinwandNeu(breite, hoehe);
  const x = c.getContext('2d');
  x.fillStyle = grund;
  x.fillRect(0, 0, breite, hoehe);
  if (kreide) {
    // Kreidestaub auf der Tafel
    const z = texturZufall(5);
    for (let i = 0; i < 300; i++) {
      x.fillStyle = `rgba(255,255,255,${z() * 0.05})`;
      x.fillRect(z() * breite, z() * hoehe, 2 + z() * 20, 1 + z() * 3);
    }
  }
  if (rahmen) {
    x.strokeStyle = rahmen;
    x.lineWidth = Math.max(4, hoehe * 0.06);
    x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, breite - x.lineWidth, hoehe - x.lineWidth);
  }
  const liste = Array.isArray(zeilen) ? zeilen : [zeilen];
  const g = Math.round((hoehe * groesse) / Math.max(1, liste.length * 0.85));
  x.font = font.replace('{g}', String(g));
  x.fillStyle = schrift;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  liste.forEach((z2, i) => {
    const y = hoehe / 2 + (i - (liste.length - 1) / 2) * g * 1.1;
    x.fillText(z2, breite / 2, y, breite * 0.9);
  });
  return alsTextur(c, { kachel: false });
}

/** Weiche Wolke als Sprite-Textur. */
export function wolkenTextur(seed = 3) {
  const z = texturZufall(seed);
  const c = leinwandNeu(256, 128);
  const x = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const px = 40 + z() * 176;
    const py = 50 + z() * 40 - Math.abs(px - 128) * 0.15;
    const rad = 18 + z() * 34;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(250,250,252,0.6)');
    g.addColorStop(1, 'rgba(245,247,250,0)');
    x.fillStyle = g;
    x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  return alsTextur(c, { kachel: false });
}

/** Feld aus Heu draußen: Streifen und Bündel, aus der Ferne gesehen. */
export function feldTextur(groesse = 256, seed = 51) {
  const z = texturZufall(seed);
  const c = leinwandNeu(groesse);
  const x = c.getContext('2d');
  x.fillStyle = '#c9a55a';
  x.fillRect(0, 0, groesse, groesse);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = STROH_FARBEN[Math.floor(z() * STROH_FARBEN.length)];
    x.globalAlpha = 0.5;
    x.fillRect(z() * groesse, z() * groesse, 1 + z() * 3, 1);
  }
  x.globalAlpha = 1;
  return alsTextur(c);
}

/** LED-Anzeige wie die Digitaluhr über dem Tor; wird jede Sekunde neu gemalt. */
export function ledAnzeige(breite = 256, hoehe = 96) {
  const c = leinwandNeu(breite, hoehe);
  const x = c.getContext('2d');
  const t = alsTextur(c, { kachel: false });
  let zuletzt = '';
  return {
    textur: t,
    setze(text, farbe = '#ff3b24') {
      if (text === zuletzt) return;
      zuletzt = text;
      x.fillStyle = '#1a1512';
      x.fillRect(0, 0, breite, hoehe);
      x.font = `700 ${Math.round(hoehe * 0.62)}px ui-monospace, Menlo, Consolas, monospace`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.shadowColor = farbe;
      x.shadowBlur = 12;
      x.fillStyle = farbe;
      x.fillText(text, breite / 2, hoehe / 2 + 2, breite * 0.9);
      x.shadowBlur = 0;
      t.needsUpdate = true;
    },
  };
}
