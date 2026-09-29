// Die beiden gezeichneten Ansichten: die Lagerhalle mit dem Haufen und der
// Blick auf das Förderband. Reines Canvas 2D, keine Bilder. Der Haufen wird
// als Volumen gedacht: bei halbem Rest ist er noch 79 % so hoch.

const HEU = '#e8b64c';
const HEU_HELL = '#f6da86';
const HEU_DUNKEL = '#a8792a';

/** Kleiner fester Zufall für Halmmuster, damit der Haufen nicht flackert. */
function musterZufall(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leinwand(canvas) {
  const ctx = canvas.getContext('2d');
  const g = { ctx, w: 0, h: 0, dpr: 1 };
  g.anpassen = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w !== g.w || h !== g.h || dpr !== g.dpr) {
      g.w = w; g.h = h; g.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      return true;
    }
    return false;
  };
  return g;
}

/* ================================================================ Haufen */

export function haufenSzene(canvas) {
  const g = leinwand(canvas);
  const { ctx } = g;
  const z = musterZufall(20260929);
  const halme = Array.from({ length: 900 }, () => ({
    u: z() * 2 - 1, v: Math.pow(z(), 0.8), a: (z() - 0.5) * 1.6, l: 6 + z() * 10,
    farbe: [HEU, HEU_HELL, HEU_DUNKEL, '#d19c3a', '#f0c860'][Math.floor(z() * 5)],
  }));
  const beulen = Array.from({ length: 5 }, () => ({ f: 3 + z() * 9, p: z() * 6.28, a: 0.012 + z() * 0.02 }));
  const teilchen = [];
  const texte = [];
  let zeit = 0;
  let cache = null;
  let cacheKey = '';
  let glanz = 0;

  const lage = () => {
    const boden = g.h * 0.84;
    const r0 = Math.min(g.w * 0.43, g.h * 0.75);
    return {
      boden,
      cx: g.w * 0.45,
      r0,
      h0: Math.min(boden - g.h * 0.2, r0 * 1.05),
      klappeX: g.w - 54,
    };
  };

  const huelle = (t) => {
    let y = Math.pow(Math.max(0, 1 - t * t), 0.62);
    for (const b of beulen) y *= 1 + b.a * Math.sin(t * b.f + b.p) * (1 - t * t);
    return y;
  };

  function haufenForm(k) {
    const L = lage();
    return { ...L, r: L.r0 * Math.max(k, 0.02), h: L.h0 * k };
  }

  function haufenPfad(c, H) {
    c.beginPath();
    c.moveTo(H.cx - H.r, H.boden);
    for (let i = 0; i <= 60; i++) {
      const t = -1 + (2 * i) / 60;
      c.lineTo(H.cx + t * H.r, H.boden - H.h * huelle(t));
    }
    c.lineTo(H.cx + H.r, H.boden);
    c.closePath();
  }

  function haufenZeichnen(k) {
    const key = `${g.w}x${g.h}@${g.dpr}:${k.toFixed(4)}`;
    if (key === cacheKey && cache) return cache;
    cacheKey = key;
    if (!cache) cache = document.createElement('canvas');
    cache.width = g.w * g.dpr;
    cache.height = g.h * g.dpr;
    const c = cache.getContext('2d');
    c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    c.clearRect(0, 0, g.w, g.h);
    if (k <= 0.0005) return cache;
    const H = haufenForm(k);
    // Schatten am Boden
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(H.cx, H.boden + 3, H.r * 1.05, 8 + H.r * 0.05, 0, 0, Math.PI * 2);
    c.fill();
    haufenPfad(c, H);
    const verlauf = c.createLinearGradient(0, H.boden - H.h, 0, H.boden);
    verlauf.addColorStop(0, '#f2cd6a');
    verlauf.addColorStop(0.55, '#d9a444');
    verlauf.addColorStop(1, '#94672a');
    c.fillStyle = verlauf;
    c.fill();
    c.save();
    haufenPfad(c, H);
    c.clip();
    // Seitliches Licht von der Lampe
    const licht = c.createRadialGradient(H.cx - H.r * 0.3, H.boden - H.h * 0.9, 5, H.cx, H.boden - H.h * 0.5, H.r * 1.2);
    licht.addColorStop(0, 'rgba(255,240,190,0.35)');
    licht.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = licht;
    c.fillRect(H.cx - H.r, H.boden - H.h, H.r * 2, H.h);
    const massstab = Math.max(0.45, Math.min(1, k * 1.3));
    c.lineCap = 'round';
    for (const hm of halme) {
      const y0 = H.boden - hm.v * H.h * huelle(hm.u);
      const x0 = H.cx + hm.u * H.r * (0.3 + 0.7 * (1 - hm.v * 0.4));
      const l = hm.l * massstab;
      c.strokeStyle = hm.farbe;
      c.lineWidth = 1.2 * massstab + 0.3;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + Math.cos(hm.a) * l, y0 + Math.sin(hm.a) * l);
      c.stroke();
    }
    c.restore();
    // Abstehende Halme am Rand
    c.strokeStyle = HEU_HELL;
    c.lineWidth = 1.1;
    for (let i = 0; i < 40; i++) {
      const t = -0.95 + (1.9 * i) / 39;
      const x = H.cx + t * H.r;
      const y = H.boden - H.h * huelle(t);
      const a = -Math.PI / 2 + t * 1.2 + Math.sin(i * 7.3) * 0.5;
      const l = (5 + (i * 37) % 7) * massstab;
      c.beginPath();
      c.moveTo(x, y + 2);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    return cache;
  }

  function hintergrund(tor) {
    const L = lage();
    const wand = ctx.createLinearGradient(0, 0, 0, L.boden);
    wand.addColorStop(0, '#1a140f');
    wand.addColorStop(1, '#30251a');
    ctx.fillStyle = wand;
    ctx.fillRect(0, 0, g.w, L.boden);
    // Wellblech
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < g.w; x += 9) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, L.boden); ctx.stroke();
    }
    // Rolltor hinten
    const tw = Math.min(g.w * 0.34, 170);
    const tx = g.w * 0.62;
    const th = L.boden * 0.52;
    const ty = L.boden - th;
    if (tor) {
      const himmel = ctx.createLinearGradient(0, ty, 0, L.boden);
      himmel.addColorStop(0, '#8fc6ef');
      himmel.addColorStop(0.7, '#d9eefa');
      himmel.addColorStop(0.71, '#7fb04f');
      himmel.addColorStop(1, '#5d8c38');
      ctx.fillStyle = himmel;
      ctx.fillRect(tx, ty, tw, th);
      ctx.fillStyle = 'rgba(255,250,220,0.08)';
      ctx.beginPath();
      ctx.moveTo(tx, L.boden); ctx.lineTo(tx + tw, L.boden);
      ctx.lineTo(tx + tw + 60, g.h); ctx.lineTo(tx - 60, g.h); ctx.fill();
    } else {
      ctx.fillStyle = '#3a3129';
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let y = ty + 6; y < L.boden; y += 7) {
        ctx.beginPath(); ctx.moveTo(tx, y + 0.5); ctx.lineTo(tx + tw, y + 0.5); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#4a3f33';
    ctx.lineWidth = 4;
    ctx.strokeRect(tx - 2, ty - 2, tw + 4, th + 2);
    // Dachbinder
    ctx.strokeStyle = '#120e0a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, g.h * 0.09); ctx.lineTo(g.w, g.h * 0.09);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let x = 0; x < g.w + 40; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, g.h * 0.09); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 60, g.h * 0.09); ctx.stroke();
    }
    // Lampe mit Lichtkegel
    const lx = L.cx;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lx, g.h * 0.09); ctx.lineTo(lx, g.h * 0.14); ctx.stroke();
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath(); ctx.moveTo(lx - 14, g.h * 0.17); ctx.lineTo(lx + 14, g.h * 0.17); ctx.lineTo(lx + 6, g.h * 0.14); ctx.lineTo(lx - 6, g.h * 0.14); ctx.fill();
    const kegel = ctx.createLinearGradient(0, g.h * 0.17, 0, L.boden);
    kegel.addColorStop(0, 'rgba(255,230,160,0.22)');
    kegel.addColorStop(1, 'rgba(255,230,160,0.02)');
    ctx.fillStyle = kegel;
    ctx.beginPath();
    ctx.moveTo(lx - 12, g.h * 0.17); ctx.lineTo(lx + 12, g.h * 0.17);
    ctx.lineTo(lx + L.r0 * 1.1, L.boden); ctx.lineTo(lx - L.r0 * 1.1, L.boden); ctx.fill();
    // Boden
    const boden = ctx.createLinearGradient(0, L.boden, 0, g.h);
    boden.addColorStop(0, '#4a4036');
    boden.addColorStop(1, '#2a241e');
    ctx.fillStyle = boden;
    ctx.fillRect(0, L.boden, g.w, g.h - L.boden);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = L.boden + ((g.h - L.boden) * i) / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.w, y); ctx.stroke();
    }
  }

  function ankauf() {
    const L = lage();
    const x = L.klappeX;
    const y = L.boden - 78;
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(x - 6, y, 52, 78);
    ctx.fillStyle = '#6d4b2b';
    ctx.fillRect(x - 2, y + 26, 44, 30);
    ctx.fillStyle = '#1b130c';
    ctx.fillRect(x + 4, y + 31, 32, 20);
    ctx.fillStyle = '#e9d9b5';
    ctx.fillRect(x - 12, y - 18, 64, 16);
    ctx.fillStyle = '#3b2a17';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEU-ANKAUF', x + 20, y - 10);
  }

  function foerderband(s, f) {
    const arme = (s.maschinen.arm || 0) + (s.maschinen.bagger || 0);
    if (!arme) return;
    const L = lage();
    const y = L.boden + 10;
    const xEnde = L.cx - L.r0 * 0.25;
    ctx.fillStyle = '#26221f';
    ctx.fillRect(0, y, xEnde, 10);
    ctx.fillStyle = '#3a3531';
    ctx.fillRect(0, y, xEnde, 3);
    const tempo = f && f.band ? 40 + 120 * Math.min(1, f.fluss / f.band) : 0;
    ctx.strokeStyle = '#4d4741';
    ctx.lineWidth = 1;
    const off = (zeit * tempo) % 12;
    for (let x = xEnde - off; x > 0; x -= 12) {
      ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10); ctx.stroke();
    }
    if (f && f.fluss > 0) {
      ctx.fillStyle = HEU;
      const dichte = Math.min(1, f.fluss / 400);
      for (let i = 0; i < 20; i++) {
        if ((i * 0.618) % 1 > dichte + 0.1) continue;
        const x = xEnde - ((zeit * tempo + i * 37) % xEnde);
        ctx.fillRect(x, y - 3, 6, 3);
      }
    }
    // Greifarme am Fuß des Haufens
    const zahl = Math.min(4, arme);
    for (let i = 0; i < zahl; i++) {
      const bx = xEnde - 20 - i * 34;
      const phase = Math.sin(zeit * 3 + i * 1.7);
      ctx.strokeStyle = '#d58a2c';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, y);
      const ex = bx + 10 + phase * 8;
      const ey = y - 22 - phase * 4;
      ctx.lineTo(bx + 4, y - 16);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillRect(bx - 5, y - 2, 10, 4);
    }
    if (arme > zahl) {
      ctx.fillStyle = '#e8dcc4';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`×${arme}`, 6, y - 10);
    }
  }

  function drohnen(s) {
    const n = Math.min(s.drohnen, 13);
    if (!n) return;
    const L = lage();
    const k = Math.cbrt(Math.max(0, 1 - s.haufen.entfernt / s.haufen.gesamt));
    const ax = L.cx;
    const ay = L.boden - L.h0 * k - 20;
    const bx = L.klappeX + 20;
    const by = L.boden - 100;
    for (let i = 0; i < n; i++) {
      const p = (zeit * 0.18 + i / n) % 1;
      const hin = p < 0.5;
      const q = hin ? p * 2 : 2 - p * 2;
      const e = (1 - Math.cos(q * Math.PI)) / 2;
      const x = ax + (bx - ax) * e + Math.sin(zeit * 2 + i) * 4;
      const y = Math.min(ay, by) - 30 - Math.sin(q * Math.PI) * 25 + (i % 3) * 8;
      ctx.fillStyle = '#20252b';
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.strokeStyle = 'rgba(200,210,220,0.55)';
      ctx.lineWidth = 1.5;
      const w = 5 + Math.abs(Math.sin(zeit * 40 + i)) * 2;
      ctx.beginPath();
      ctx.moveTo(x - 8 - w / 2, y - 4); ctx.lineTo(x - 8 + w / 2, y - 4);
      ctx.moveTo(x + 8 - w / 2, y - 4); ctx.lineTo(x + 8 + w / 2, y - 4);
      ctx.stroke();
      ctx.fillStyle = '#78e08f';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (hin) {
        ctx.fillStyle = HEU;
        ctx.fillRect(x - 4, y + 3, 8, 5);
      }
    }
  }

  function laeufer(anteil, H) {
    if (anteil == null) return;
    const L = lage();
    const von = Math.min(H.cx + H.r * 0.85, L.klappeX - 40);
    const bis = L.klappeX - 10;
    const hin = anteil < 0.5;
    const q = hin ? anteil * 2 : 2 - anteil * 2;
    const x = von + (bis - von) * q;
    const y = L.boden - 2;
    const schritt = Math.sin(zeit * 14);
    ctx.strokeStyle = '#e8dcc4';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 14);
    ctx.moveTo(x, y - 14); ctx.lineTo(x - 5 * schritt, y);
    ctx.moveTo(x, y - 14); ctx.lineTo(x + 5 * schritt, y);
    ctx.moveTo(x, y - 26); ctx.lineTo(x + (hin ? 7 : -6), y - 20);
    ctx.stroke();
    ctx.fillStyle = '#e8dcc4';
    ctx.beginPath(); ctx.arc(x, y - 35, 4.5, 0, Math.PI * 2); ctx.fill();
    if (hin) {
      ctx.fillStyle = HEU;
      ctx.beginPath(); ctx.ellipse(x + 10, y - 22, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function sauger(info, H) {
    if (!info.saugt && !info.saugerSichtbar) return;
    const sx = g.w * 0.86;
    const sy = H.boden + 22;
    const zx = H.cx + H.r * 0.55;
    const zy = H.boden - H.h * 0.35;
    ctx.strokeStyle = '#555c63';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx - 30, zy + 40, zx + 8, zy);
    ctx.stroke();
    const rot = Math.round(80 + info.hitze * 175);
    ctx.fillStyle = `rgb(${rot},${Math.round(90 - info.hitze * 60)},${Math.round(90 - info.hitze * 60)})`;
    ctx.fillRect(sx - 12, sy - 8, 26, 18);
    if (info.saugt && Math.random() < 0.9) {
      teilchen.push({
        x: zx - 10 - Math.random() * 20, y: zy + (Math.random() - 0.5) * 20,
        vx: 90, vy: -10, leben: 0.25, max: 0.25, a: Math.random() * 3, l: 7, farbe: HEU_HELL, schwer: 0,
      });
    }
  }

  function detektorZeichnen(info, H) {
    const x = 10;
    const y = H.boden - 10;
    ctx.strokeStyle = '#8b8f94';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 26, y - 14); ctx.stroke();
    ctx.fillStyle = '#6a6f75';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 9, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    const an = info.blink > 0 ? info.blink : 0;
    ctx.fillStyle = an ? `rgba(255,${Math.round(200 - an * 160)},60,${0.4 + an * 0.6})` : '#3a2c22';
    ctx.beginPath(); ctx.arc(x + 26, y - 16, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  function teilchenZeichnen(dt) {
    for (let i = teilchen.length - 1; i >= 0; i--) {
      const p = teilchen[i];
      p.leben -= dt;
      if (p.leben <= 0) { teilchen.splice(i, 1); continue; }
      p.vy += p.schwer * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += dt * 6;
      ctx.globalAlpha = Math.min(1, p.leben / p.max * 1.5);
      ctx.strokeStyle = p.farbe;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.a) * p.l, p.y + Math.sin(p.a) * p.l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = texte.length - 1; i >= 0; i--) {
      const t = texte[i];
      t.leben -= dt;
      if (t.leben <= 0) { texte.splice(i, 1); continue; }
      t.y -= dt * 38;
      ctx.globalAlpha = Math.min(1, t.leben * 2);
      ctx.font = `700 ${t.groesse}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,14,8,0.8)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.farbe;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  return {
    anpassen: () => g.anpassen(),

    /** Wo die Spitze des Haufens gerade ist — für Einblendungen. */
    spitze(s) {
      const k = Math.cbrt(Math.max(0, 1 - s.haufen.entfernt / s.haufen.gesamt));
      const H = haufenForm(k);
      return { x: H.cx, y: H.boden - H.h };
    },

    stich(x, y, menge, krit) {
      const n = Math.min(26, 5 + Math.round(Math.log2(menge + 1) * 3));
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = 80 + Math.random() * 160;
        teilchen.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, leben: 0.7, max: 0.7,
          a: Math.random() * 6, l: 5 + Math.random() * 6, farbe: Math.random() < 0.5 ? HEU : HEU_HELL, schwer: 420,
        });
      }
      texte.push({
        x, y: y - 16, text: krit ? `Glücksstich! +${Math.round(menge)}` : `+${Math.round(menge)}`,
        leben: 0.9, farbe: krit ? '#ffd24a' : '#f7ecd2', groesse: krit ? 17 : 14,
      });
    },

    text(x, y, text, farbe = '#9fe0a4', groesse = 15) {
      texte.push({ x, y, text, leben: 1.3, farbe, groesse });
    },

    nadelGlanz() { glanz = 2.5; },

    zeichnen(s, info, dt) {
      zeit += dt;
      const neu = g.anpassen();
      if (neu) cacheKey = '';
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      const k = Math.cbrt(Math.max(0, 1 - s.haufen.entfernt / s.haufen.gesamt));
      const H = haufenForm(k);
      hintergrund(info.torOffen);
      ankauf();
      foerderband(s, info.fabrik);
      ctx.drawImage(haufenZeichnen(Math.round(k * 2000) / 2000), 0, 0, g.w, g.h);
      if (glanz > 0) {
        glanz -= dt;
        const gx = H.cx;
        const gy = H.boden - H.h * 0.6;
        const r = 30 + (2.5 - glanz) * 40;
        const verlauf = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        verlauf.addColorStop(0, `rgba(255,255,230,${Math.min(0.8, glanz / 2)})`);
        verlauf.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = verlauf;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
      sauger(info, H);
      drohnen(s);
      laeufer(info.laufAnteil, H);
      detektorZeichnen(info, H);
      teilchenZeichnen(dt);
    },
  };
}

/* ================================================================ Halle */

const KUERZEL = {
  presse: 'PRESSE', muehle: 'MÜHLE', pulper: 'PULPER', wickler: 'WICKLER', papier: 'PAPIER', ziegel: 'ZIEGEL',
};
const PRODUKT_FARBE = {
  ballen: '#d9a444', pellet: '#9c7a3c', brei: '#b8a47a', silage: '#e9e6df', papier: '#f3ecd8', ziegel: '#b5643c',
};

export function halleSzene(canvas) {
  const g = leinwand(canvas);
  const { ctx } = g;
  let zeit = 0;
  let geldTakt = 0;
  const texte = [];

  return {
    zeichnen(s, f, dt, geldProSek) {
      zeit += dt;
      g.anpassen();
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      const { w, h } = g;
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#221b14');
      bg.addColorStop(1, '#16110c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      for (let x = 0; x < w; x += 18) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }

      const bandY = h * 0.7;
      const links = 52;
      const rechts = w - 62;
      // Haufenrand
      ctx.fillStyle = '#c9923a';
      ctx.beginPath();
      ctx.moveTo(0, bandY + 12);
      ctx.quadraticCurveTo(10, h * 0.1, 64, bandY + 12);
      ctx.fill();
      // Band
      ctx.fillStyle = '#2d2824';
      ctx.fillRect(links, bandY, rechts - links, 10);
      ctx.fillStyle = '#48413a';
      ctx.fillRect(links, bandY, rechts - links, 2);
      const auslast = f.band ? Math.min(1, f.fluss / f.band) : 0;
      const tempo = f.fluss > 0 ? 30 + 110 * auslast : 0;
      ctx.strokeStyle = '#57504a';
      const off = (zeit * tempo) % 14;
      for (let x = links + off; x < rechts; x += 14) {
        ctx.beginPath(); ctx.moveTo(x, bandY + 2); ctx.lineTo(x, bandY + 10); ctx.stroke();
      }
      if (f.fluss > 0) {
        const n = 6 + Math.round(auslast * 26);
        for (let i = 0; i < n; i++) {
          const x = links + ((zeit * tempo + (i * (rechts - links)) / n) % (rechts - links));
          ctx.fillStyle = i % 5 === 0 ? '#f3d27a' : '#dca84a';
          ctx.fillRect(x, bandY - 4, 7, 4);
        }
      }
      // Arme
      const arme = s.maschinen.arm || 0;
      const zahl = Math.min(5, arme);
      for (let i = 0; i < zahl; i++) {
        const bx = links + 16 + i * 22;
        const ph = Math.sin(zeit * 4 * (f.strom || 0) + i);
        ctx.strokeStyle = '#d58a2c';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, bandY);
        ctx.lineTo(bx - 4, bandY - 18);
        ctx.lineTo(bx - 14 - ph * 6, bandY - 26 + ph * 6);
        ctx.stroke();
      }
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#e8dcc4';
      if (arme) ctx.fillText(`${arme} Arme${s.maschinen.bagger ? ` · ${s.maschinen.bagger} Bagger` : ''}`, links, bandY + 26);
      // Scanner-Tor
      if (s.maschinen.scanner) {
        const sx = links + (rechts - links) * 0.38;
        ctx.strokeStyle = '#4fb3a9';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 12, bandY + 10); ctx.lineTo(sx - 12, bandY - 26);
        ctx.lineTo(sx + 12, bandY - 26); ctx.lineTo(sx + 12, bandY + 10);
        ctx.stroke();
        const flacker = 0.35 + 0.35 * Math.sin(zeit * 20);
        ctx.fillStyle = f.deckung < 1 ? `rgba(224,106,79,${flacker})` : `rgba(79,179,169,${flacker})`;
        ctx.fillRect(sx - 10, bandY - 22, 20, 22);
        ctx.fillStyle = '#9fd8d1';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.maschinen.scanner}×`, sx, bandY - 32);
      }
      // Verarbeiter
      const verarbeiter = Object.keys(KUERZEL).filter((id) => s.maschinen[id]);
      const start = links + (rechts - links) * 0.5;
      const breite = (rechts - start) / Math.max(1, verarbeiter.length);
      verarbeiter.forEach((id, i) => {
        const x = start + i * breite + breite / 2;
        const bw = Math.min(46, breite - 6);
        const aus = s.aus[id];
        ctx.fillStyle = aus ? '#2a2622' : '#3b3257';
        ctx.fillRect(x - bw / 2, bandY - 44, bw, 30);
        ctx.strokeStyle = aus ? '#4a4540' : '#9b7ad8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - bw / 2 + 0.5, bandY - 43.5, bw - 1, 29);
        ctx.fillStyle = aus ? '#6f675f' : '#e3d6ff';
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(KUERZEL[id], x, bandY - 26);
        ctx.fillText(`×${s.maschinen[id]}`, x, bandY - 17);
        if (!aus && f.auslastung[id] > 0.01) {
          const p = (zeit * 1.5 + i * 0.3) % 1;
          const produkt = { presse: 'ballen', muehle: 'pellet', pulper: 'brei', wickler: 'silage', papier: 'papier', ziegel: 'ziegel' }[id];
          ctx.fillStyle = PRODUKT_FARBE[produkt];
          ctx.fillRect(x - 4 + p * (rechts - x), bandY - 12 - Math.sin(p * Math.PI) * 18, 8, 6);
        }
      });
      // Verkaufsstand
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(rechts, bandY - 40, 56, 60);
      ctx.fillStyle = '#e9d9b5';
      ctx.fillRect(rechts + 2, bandY - 54, 52, 14);
      ctx.fillStyle = '#3b2a17';
      ctx.font = '800 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VERKAUF', rechts + 28, bandY - 44);
      // Strom
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(10, 10, 64, 12);
      ctx.fillStyle = f.strom < 1 ? '#e06a4f' : '#b5c94a';
      ctx.fillRect(10, 10, 64 * Math.min(1, f.bedarf ? f.erzeugt / Math.max(f.bedarf, f.erzeugt) : 1), 12);
      ctx.fillStyle = '#e8dcc4';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('STROM', 80, 20);
      // Geld steigt auf
      geldTakt += dt;
      if (geldProSek > 0 && geldTakt > 0.8) {
        geldTakt = 0;
        texte.push({ x: rechts + 28, y: bandY - 60, leben: 1.2, text: `+${Math.round(geldProSek * 0.8).toLocaleString('de-DE')} $` });
      }
      ctx.textAlign = 'center';
      for (let i = texte.length - 1; i >= 0; i--) {
        const t = texte[i];
        t.leben -= dt;
        t.y -= dt * 22;
        if (t.leben <= 0) { texte.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, t.leben * 1.5);
        ctx.fillStyle = '#9fe0a4';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(t.text, Math.min(t.x, w - 30), t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
