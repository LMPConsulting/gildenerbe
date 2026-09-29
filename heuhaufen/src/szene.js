// Die beiden gezeichneten Ansichten: die Lagerhalle mit dem Haufen und der
// Blick aufs Förderband. Reines Canvas 2D, keine Bilder. Wie im Vorbild ist
// es Tag: offenes Bogendach, Himmel, Holzwände, Sandboden, orange Arme.
// Der Haufen wird als Volumen gedacht: bei halbem Rest ist er noch 79 % hoch.

const HEU = '#e3a948';
const HEU_HELL = '#f7d98a';
const HEU_DUNKEL = '#9a6a24';
const ORANGE = '#e8702a';
const KNAEUEL = '#e98a2c';

/** Kleiner fester Zufall für Muster, damit nichts flackert. */
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
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
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

function puffer(g) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, g.w * g.dpr);
  c.height = Math.max(1, g.h * g.dpr);
  const x = c.getContext('2d');
  x.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  return { c, x };
}

function wolke(c, x, y, s) {
  c.beginPath();
  c.ellipse(x, y, 34 * s, 12 * s, 0, 0, Math.PI * 2);
  c.ellipse(x - 22 * s, y + 3 * s, 20 * s, 9 * s, 0, 0, Math.PI * 2);
  c.ellipse(x + 20 * s, y - 5 * s, 22 * s, 13 * s, 0, 0, Math.PI * 2);
  c.ellipse(x + 4 * s, y - 10 * s, 18 * s, 12 * s, 0, 0, Math.PI * 2);
  c.fill();
}

/** Ein oranger Industriearm: Sockel, Ober- und Unterarm, Greifer. */
function roboterarm(c, x, y, s, winkel, greift) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#3a3a3c';
  c.beginPath(); c.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2b2b2d';
  c.fillRect(-6, -8, 12, 8);
  c.lineCap = 'round';
  const a1 = -Math.PI / 2 + 0.5 + winkel * 0.5;
  const ex = Math.cos(a1) * 20;
  const ey = -8 + Math.sin(a1) * 20;
  const a2 = a1 - 1.6 - winkel * 0.6;
  const hx = ex + Math.cos(a2) * 18;
  const hy = ey + Math.sin(a2) * 18;
  c.strokeStyle = '#1d1d1f';
  c.lineWidth = 8.5;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = ORANGE;
  c.lineWidth = 6.5;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
  c.fillStyle = '#1d1d1f';
  c.beginPath(); c.arc(ex, ey, 3.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#2b2b2d';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(hx, hy); c.lineTo(hx - 4, hy + 6);
  c.moveTo(hx, hy); c.lineTo(hx + 4, hy + 6);
  c.stroke();
  if (greift) {
    c.fillStyle = KNAEUEL;
    c.beginPath(); c.arc(hx, hy + 6, 4, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/* ================================================================ Haufen */

export function haufenSzene(canvas) {
  const g = leinwand(canvas);
  const { ctx } = g;
  const z = musterZufall(20260929);
  const halme = Array.from({ length: 3000 }, () => ({
    u: z() * 2 - 1, v: Math.pow(z(), 0.75), a: (z() - 0.5) * 2.2, l: 5 + z() * 9,
    farbe: ['#e3a948', '#f7d98a', '#b98232', '#d6983a', '#f0c461', '#8f6120'][Math.floor(z() * 6)],
  }));
  const beulen = Array.from({ length: 5 }, () => ({ f: 3 + z() * 8, p: z() * 6.28, a: 0.012 + z() * 0.018 }));
  const wolken = Array.from({ length: 5 }, () => ({ x: z(), y: 0.03 + z() * 0.12, s: 0.6 + z() * 0.7, v: 3 + z() * 5 }));
  const tuffs = Array.from({ length: 40 }, () => ({ u: z() * 2 - 1, v: z(), s: 0.6 + z() * 0.8 }));
  const teilchen = [];
  const texte = [];
  const wuerfe = [];
  let zeit = 0;
  let dtLetzt = 0;
  let hinten = null;
  let hintenKey = '';
  let haufenBild = null;
  let haufenKey = '';
  let glanz = 0;
  let quetsch = 0;
  let ping = 0;

  const lage = () => {
    const boden = g.h * 0.8;
    const r0 = Math.min(g.w * 0.56, g.h * 0.85);
    // Maßstab für alles, was keine Kulisse ist: auf dem Tablet wächst es mit.
    const S = Math.max(1, Math.min(1.8, Math.min(g.w / 390, g.h / 600)));
    return {
      boden,
      wand: g.h * 0.36,
      cx: g.w * 0.42,
      r0,
      h0: Math.min(boden - g.h * 0.14, r0 * 1.15),
      standX: g.w - 64 * S,
      S,
    };
  };

  const huelle = (t, k) => {
    const exp = 0.62 + (1 - k) * 0.45;
    let y = Math.pow(Math.max(0, 1 - t * t), exp);
    for (const b of beulen) y *= 1 + b.a * Math.sin(t * b.f + b.p) * (1 - t * t);
    return y;
  };

  function haufenForm(k) {
    const L = lage();
    return { ...L, k, r: L.r0 * Math.max(k, 0.03), h: L.h0 * k };
  }

  function haufenPfad(c, H) {
    c.beginPath();
    c.moveTo(H.cx - H.r, H.boden);
    for (let i = 0; i <= 64; i++) {
      const t = -1 + (2 * i) / 64;
      c.lineTo(H.cx + t * H.r, H.boden - H.h * huelle(t, H.k));
    }
    c.lineTo(H.cx + H.r, H.boden);
    c.closePath();
  }

  /* -------------------------------------------------- Hintergrund */

  function torMasse() {
    const L = lage();
    const wandOben = L.wand - 4;
    const tw = Math.min(70, g.w * 0.17);
    const tx = g.w * 0.6;
    const th = (L.boden - wandOben) * 0.72;
    return { tw, tx, th, ty: L.boden - th };
  }

  function hintergrundBauen(torOffen) {
    const key = `${g.w}x${g.h}@${g.dpr}:${torOffen}`;
    if (key === hintenKey && hinten) return hinten.c;
    hintenKey = key;
    hinten = puffer(g);
    const c = hinten.x;
    const L = lage();
    const himmel = c.createLinearGradient(0, 0, 0, L.wand);
    himmel.addColorStop(0, '#4f93d6');
    himmel.addColorStop(1, '#bfe0f5');
    c.fillStyle = himmel;
    c.fillRect(0, 0, g.w, L.wand + 2);
    c.fillStyle = '#9db4c4';
    c.beginPath();
    c.moveTo(0, L.wand);
    const zz = musterZufall(7);
    for (let x = 0; x <= g.w + 40; x += 40) c.lineTo(x, L.wand - 18 - zz() * 30);
    c.lineTo(g.w, L.wand); c.closePath(); c.fill();
    c.fillStyle = '#b9ab7a';
    c.fillRect(0, L.wand - 8, g.w, 8);
    // Rückwand aus Holz mit Stahlpfosten
    const wandOben = L.wand - 4;
    const holz = c.createLinearGradient(0, wandOben, 0, L.boden);
    holz.addColorStop(0, '#6e4a2c');
    holz.addColorStop(1, '#4e331e');
    c.fillStyle = holz;
    c.fillRect(0, wandOben, g.w, L.boden - wandOben);
    for (let x = 0; x < g.w; x += 7) {
      c.fillStyle = (Math.floor(x / 7) % 3 === 0) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.03)';
      c.fillRect(x, wandOben, 1.2, L.boden - wandOben);
    }
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, wandOben + (L.boden - wandOben) * 0.45, g.w, 3);
    for (let x = 30; x < g.w; x += 78) {
      c.fillStyle = '#3b3733';
      c.fillRect(x, wandOben - 6, 6, L.boden - wandOben + 6);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x, wandOben - 6, 1.5, L.boden - wandOben + 6);
    }
    c.fillStyle = '#2f2b27';
    c.fillRect(0, wandOben - 6, g.w, 6);
    // Tor mit Digitaluhr darüber
    const { tw, tx, th, ty } = torMasse();
    if (torOffen) {
      const draussen = c.createLinearGradient(0, ty, 0, L.boden);
      draussen.addColorStop(0, '#9fd0f2');
      draussen.addColorStop(0.55, '#e6f4fb');
      draussen.addColorStop(0.56, '#8fbf55');
      draussen.addColorStop(1, '#6f9f3c');
      c.fillStyle = draussen;
      c.fillRect(tx, ty, tw, th);
    } else {
      c.fillStyle = '#3d4640';
      c.fillRect(tx, ty, tw, th);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1;
      for (let y = ty + 5; y < L.boden; y += 5) { c.beginPath(); c.moveTo(tx, y + 0.5); c.lineTo(tx + tw, y + 0.5); c.stroke(); }
      c.fillStyle = '#d9b43a';
      for (let x = tx; x < tx + tw; x += 8) {
        c.beginPath(); c.moveTo(x, L.boden); c.lineTo(x + 4, L.boden); c.lineTo(x + 8, L.boden - 5); c.lineTo(x + 4, L.boden - 5); c.fill();
      }
    }
    c.strokeStyle = '#26221e';
    c.lineWidth = 3;
    c.strokeRect(tx - 1.5, ty - 1.5, tw + 3, th + 1.5);
    c.fillStyle = '#231f1c';
    c.fillRect(tx + tw / 2 - 17, ty - 16, 34, 12);
    // Boden
    const sand = c.createLinearGradient(0, L.boden, 0, g.h);
    sand.addColorStop(0, '#c9b089');
    sand.addColorStop(1, '#a08664');
    c.fillStyle = sand;
    c.fillRect(0, L.boden, g.w, g.h - L.boden);
    const zb = musterZufall(11);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = zb() < 0.5 ? 'rgba(80,60,40,0.12)' : 'rgba(255,245,220,0.12)';
      c.fillRect(zb() * g.w, L.boden + zb() * (g.h - L.boden), 1.5, 1.5);
    }
    c.strokeStyle = 'rgba(90,70,45,0.18)';
    c.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      c.beginPath();
      c.moveTo(g.w / 2 + i * g.w * 0.08, L.boden);
      c.lineTo(g.w / 2 + i * g.w * 0.3, g.h);
      c.stroke();
    }
    const sch = c.createLinearGradient(0, L.boden, 0, L.boden + 16);
    sch.addColorStop(0, 'rgba(40,25,10,0.35)');
    sch.addColorStop(1, 'rgba(40,25,10,0)');
    c.fillStyle = sch;
    c.fillRect(0, L.boden, g.w, 16);
    return hinten.c;
  }

  function dachboegen() {
    const L = lage();
    ctx.lineCap = 'butt';
    for (let i = 0; i < 3; i++) {
      const y0 = L.wand - 6 - i * 10;
      const hoch = -g.h * (0.3 - i * 0.05);
      ctx.strokeStyle = i === 0 ? '#5a3a22' : '#6b4629';
      ctx.lineWidth = 7 - i * 1.5;
      ctx.beginPath();
      ctx.moveTo(-20, y0);
      ctx.quadraticCurveTo(g.w / 2, hoch, g.w + 20, y0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,180,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-20, y0 - 2);
      ctx.quadraticCurveTo(g.w / 2, hoch - 2, g.w + 20, y0 - 2);
      ctx.stroke();
    }
  }

  /** Die Bögen werfen breite, schräge Schatten über Boden und Haufen, wie im Vorbild bei Tag. */
  function bogenSchatten() {
    const L = lage();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.wand, g.w, g.h - L.wand);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,10,0,0.14)';
    for (let i = 0; i < 3; i++) {
      const x0 = g.w * (0.05 + i * 0.36);
      const breite = g.w * 0.11;
      ctx.beginPath();
      ctx.moveTo(x0, L.wand);
      ctx.lineTo(x0 + breite, L.wand);
      ctx.lineTo(x0 + breite - g.w * 0.3, g.h);
      ctx.lineTo(x0 - g.w * 0.3, g.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function uhr(sekunden, torOffen) {
    const { tw, tx, ty } = torMasse();
    const m = Math.floor(sekunden / 60);
    const s = Math.floor(sekunden % 60);
    const text = m >= 100 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
    ctx.fillStyle = torOffen ? '#7cf29a' : '#ff5a3c';
    ctx.font = '700 9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx + tw / 2, ty - 10);
  }

  /* -------------------------------------------------- Der Haufen */

  function haufenZeichnen(k) {
    const key = `${g.w}x${g.h}@${g.dpr}:${Math.round(lage().h0 * k * g.dpr)}`;
    if (key === haufenKey && haufenBild) return haufenBild.c;
    haufenKey = key;
    if (!haufenBild || haufenBild.c.width !== Math.max(1, g.w * g.dpr) || haufenBild.c.height !== Math.max(1, g.h * g.dpr)) {
      haufenBild = puffer(g);
    }
    const c = haufenBild.x;
    c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    c.clearRect(0, 0, g.w, g.h);
    if (k <= 0.0005) return haufenBild.c;
    const H = haufenForm(k);
    c.fillStyle = 'rgba(60,40,15,0.35)';
    c.beginPath();
    c.ellipse(H.cx + H.r * 0.18, H.boden + 3, H.r * 1.12, 7 + H.r * 0.07, 0, 0, Math.PI * 2);
    c.fill();
    haufenPfad(c, H);
    const verlauf = c.createLinearGradient(H.cx - H.r, H.boden - H.h, H.cx + H.r, H.boden);
    verlauf.addColorStop(0, '#f6cf6f');
    verlauf.addColorStop(0.45, '#dea148');
    verlauf.addColorStop(1, '#9b6a26');
    c.fillStyle = verlauf;
    c.fill();
    c.save();
    haufenPfad(c, H);
    c.clip();
    const licht = c.createRadialGradient(H.cx - H.r * 0.35, H.boden - H.h * 0.85, 4, H.cx - H.r * 0.2, H.boden - H.h * 0.6, H.r * 1.1);
    licht.addColorStop(0, 'rgba(255,248,210,0.45)');
    licht.addColorStop(1, 'rgba(255,248,210,0)');
    c.fillStyle = licht;
    c.fillRect(H.cx - H.r, H.boden - H.h, H.r * 2, H.h);
    const fuss = c.createLinearGradient(0, H.boden - 18, 0, H.boden);
    fuss.addColorStop(0, 'rgba(70,40,10,0)');
    fuss.addColorStop(1, 'rgba(70,40,10,0.35)');
    c.fillStyle = fuss;
    c.fillRect(H.cx - H.r, H.boden - 18, H.r * 2, 18);
    const massstab = Math.max(0.5, Math.min(1, k * 1.25 + 0.2)) * H.S;
    // Gleiche Dichte auf jeder Fläche: ein Tablet-Haufen braucht mehr Halme als ein Handy-Haufen.
    const dichte = Math.max(1, Math.min(2.7, (H.r0 * H.h0) / (218 * 250)));
    const anzahl = Math.min(halme.length, Math.round((120 + 980 * Math.pow(k, 0.6)) * dichte));
    c.lineCap = 'round';
    for (let i = 0; i < anzahl; i++) {
      const hm = halme[i];
      const y0 = H.boden - hm.v * H.h * huelle(hm.u, k);
      const x0 = H.cx + hm.u * H.r * (0.25 + 0.75 * (1 - hm.v * 0.45));
      const l = hm.l * massstab;
      c.strokeStyle = hm.farbe;
      c.lineWidth = 1.1 * massstab + 0.35;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + Math.cos(hm.a) * l, y0 + Math.sin(hm.a) * l);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = HEU_HELL;
    c.lineWidth = 1.1;
    for (let i = 0; i < 46; i++) {
      const t = -0.96 + (1.92 * i) / 45;
      const x = H.cx + t * H.r;
      const y = H.boden - H.h * huelle(t, k);
      const a = -Math.PI / 2 + t * 1.25 + Math.sin(i * 7.3) * 0.5;
      const l = (4 + ((i * 37) % 7)) * massstab;
      c.beginPath();
      c.moveTo(x, y + 2);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    return haufenBild.c;
  }

  function leererBoden(H) {
    ctx.strokeStyle = HEU;
    ctx.lineWidth = 1.2;
    const zz = musterZufall(3);
    for (let i = 0; i < 60; i++) {
      const x = H.cx + (zz() * 2 - 1) * H.r0 * 0.8;
      const y = H.boden + zz() * 12 - 4;
      const a = zz() * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 2); ctx.stroke();
    }
  }

  function bodenheu(menge, H) {
    const n = Math.min(tuffs.length, Math.ceil(menge / 15));
    for (let i = 0; i < n; i++) {
      const t = tuffs[i];
      const x = H.cx + t.u * (H.r + 30);
      const y = Math.min(H.boden + 4 + t.v * (g.h - H.boden - 34), g.h - 80);
      ctx.fillStyle = 'rgba(154,106,36,0.55)';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 7 * t.s * H.S, 2 * t.s * H.S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.2;
      for (let j = 0; j < 7; j++) {
        const a = ((j * 97 + i * 31) % 180) / 180 * Math.PI;
        const l = (5 + ((j * 13 + i * 7) % 5)) * t.s * H.S;
        const ox = (((j * 53 + i * 17) % 11) - 5) * t.s * H.S;
        ctx.strokeStyle = j % 3 === 0 ? HEU_HELL : j % 3 === 1 ? HEU : HEU_DUNKEL;
        ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.lineTo(x + ox + Math.cos(a) * l, y - Math.sin(a) * l * 0.35); ctx.stroke();
      }
    }
  }

  /* -------------------------------------------------- Stand, Band, Maschinen */

  function stand(preisText) {
    const L = lage();
    ctx.save();
    ctx.translate(L.standX, L.boden);
    ctx.scale(L.S, L.S);
    // Bude aus Brettern mit Vordach
    ctx.fillStyle = 'rgba(40,25,10,0.3)';
    ctx.fillRect(-24, -2, 78, 6);
    ctx.fillStyle = '#5a3c22';
    ctx.fillRect(-20, -44, 70, 44);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = -20; x < 50; x += 7) ctx.fillRect(x, -44, 1, 44);
    ctx.fillStyle = '#2a1c10';
    ctx.fillRect(-14, -36, 34, 16);
    ctx.fillStyle = '#7a5433';
    ctx.fillRect(-24, -20, 78, 6);
    ctx.fillStyle = '#4a321d';
    ctx.fillRect(-18, -14, 4, 14); ctx.fillRect(44, -14, 4, 14);
    // Kasse auf dem Tresen
    ctx.fillStyle = '#3d4447';
    ctx.fillRect(26, -30, 16, 10);
    ctx.fillStyle = '#7cf29a';
    ctx.fillRect(29, -28, 10, 3);
    // Vordach
    ctx.fillStyle = '#8a2f22';
    ctx.beginPath(); ctx.moveTo(-28, -44); ctx.lineTo(58, -44); ctx.lineTo(52, -54); ctx.lineTo(-22, -54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0e6d2';
    for (let x = -22; x < 52; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, -54); ctx.lineTo(x + 6, -54); ctx.lineTo(x + 5, -44); ctx.lineTo(x - 1, -44); ctx.closePath(); ctx.fill();
    }
    // Schild: dunkle Planke, helle Schrift
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-12, -62, 2, 8); ctx.fillRect(40, -62, 2, 8);
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(-22, -78, 74, 18);
    ctx.strokeStyle = '#6b4a2d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-22, -78, 74, 18);
    ctx.fillStyle = '#f3e7cc';
    ctx.font = '700 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEU VERKAUFEN', 15, -68.5, 68);
    // Aufsteller mit dem Preis, wie im Vorbild, groß genug zum Lesen
    const ax = -42;
    ctx.fillStyle = '#6b4a2d';
    ctx.beginPath(); ctx.moveTo(ax - 17, 4); ctx.lineTo(ax - 12, -40); ctx.lineTo(ax + 12, -40); ctx.lineTo(ax + 17, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1e2320';
    ctx.beginPath(); ctx.moveTo(ax - 14, 0); ctx.lineTo(ax - 10, -37); ctx.lineTo(ax + 10, -37); ctx.lineTo(ax + 14, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f4ee';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(preisText.replace(' $', ''), ax, -27, 24);
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.fillText('$ PRO', ax, -16, 24);
    ctx.fillText('HALM', ax, -7, 24);
    ctx.restore();
  }

  /** Wo das Band liegt: vom linken Rand bis vor den Stand. */
  function bandLage() {
    const L = lage();
    return { y: L.boden + 22 * L.S, von: Math.max(g.w * 0.08, 12), bis: L.standX - 64 * L.S, S: L.S };
  }

  function foerderband(s, f, H) {
    if (!f || !f.aktiv) return;
    const { y, von, bis, S } = bandLage();
    if (bis - von < 20) return;
    const bh = 9 * S;
    ctx.fillStyle = '#2a2927';
    ctx.beginPath(); ctx.roundRect(von, y, bis - von, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#8b8883';
    ctx.fillRect(von + bh / 2, y, bis - von - bh, 1.8 * S);
    ctx.fillRect(von + bh / 2, y + bh - 1.8 * S, bis - von - bh, 1.8 * S);
    ctx.fillStyle = '#6d6a66';
    for (let x = von + 10; x < bis - 6; x += 30 * S) ctx.fillRect(x, y + bh, 3 * S, 7 * S);
    const tempo = f.fluss > 0 ? 30 + 90 * Math.min(1, f.fluss / Math.max(1, f.band)) : 22;
    ctx.strokeStyle = '#3a3835';
    ctx.lineWidth = 1;
    const off = (zeit * tempo) % 10;
    for (let x = von + 6 + off; x < bis - 6; x += 10) { ctx.beginPath(); ctx.moveTo(x, y + 3 * S); ctx.lineTo(x, y + bh - 2 * S); ctx.stroke(); }
    const len = bis - von;
    const kr = 4 * S;
    if (f.fluss > 0) {
      // Abstand zwischen den Knäueln, auch wenn das Band voll ist: keine Raupe.
      const n = Math.min(Math.floor(len / (16 * S)), 3 + Math.round(Math.log2(1 + f.fluss / 10) * 1.6));
      for (let i = 0; i < n; i++) {
        const x = von + ((zeit * tempo + (i * len) / n) % len);
        ctx.fillStyle = KNAEUEL;
        ctx.beginPath(); ctx.arc(x, y - kr + 1, kr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,170,0.6)';
        ctx.beginPath(); ctx.arc(x - kr * 0.33, y - kr * 1.3 + 1, kr * 0.35, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = wuerfe.length - 1; i >= 0; i--) {
      const wf = wuerfe[i];
      wf.p += (dtLetzt * tempo) / len;
      if (wf.p >= 1) { wuerfe.splice(i, 1); continue; }
      const x = von + wf.p * len;
      ctx.fillStyle = KNAEUEL;
      ctx.beginPath(); ctx.arc(x, y - kr + 1, kr * 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Generatoren stehen hinten an der Wand links vom Tor; der Haufen verdeckt sie, bis er schrumpft. */
  function generatoren(s, f) {
    const L = lage();
    const gens = Math.min(5, s.maschinen.generator || 0);
    const { tx } = torMasse();
    for (let i = 0; i < gens; i++) {
      const gw = 24 * L.S;
      const x = tx - 10 - gw - i * (gw + 6);
      if (x < 4) break;
      const y = L.boden - 2;
      ctx.fillStyle = '#4b5a3b';
      ctx.fillRect(x, y - 18 * L.S, gw, 18 * L.S);
      ctx.fillStyle = '#2d3524';
      ctx.fillRect(x + gw * 0.66, y - 26 * L.S, 5 * L.S, 8 * L.S);
      if (f && f.strom > 0 && f.brennstoff > 0) {
        const p = (zeit * 0.7 + i * 0.37) % 1;
        ctx.fillStyle = `rgba(220,220,215,${0.5 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(x + gw * 0.75 + p * 6, y - 28 * L.S - p * 22, (3 + p * 6) * L.S, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = f && f.strom < 1 ? '#ff6b4a' : '#7cf29a';
      ctx.fillRect(x + 3, y - 14 * L.S, 3, 3);
    }
  }

  function maschinen(s, f, H) {
    const L = lage();
    const B = bandLage();
    const leer = s.haufen.entfernt >= s.haufen.gesamt;
    const arme = s.aus.arm ? 0 : (s.maschinen.arm || 0);
    const rechen = s.aus.rechen ? 0 : (s.maschinen.rechen || 0);
    const laeuft = !!f && f.fluss > 0 && !leer;
    const zr = Math.min(4, rechen);
    // Arme stehen hinter dem Band, gleichmäßig verteilt, alle zum Stand gewandt; links davon die Rechen.
    const links = Math.max(20, B.von + 14 * L.S + zr * 30 * L.S);
    const rechts = Math.max(links, L.standX - 70 * L.S);
    const platz = Math.max(1, Math.floor((rechts - links) / (30 * L.S)) + 1);
    const za = Math.min(8, arme, platz);
    for (let i = 0; i < za; i++) {
      const x = za === 1 ? (links + rechts) / 2 : links + ((rechts - links) * i) / (za - 1);
      const y = B.y - 2 * L.S;
      const ph = laeuft ? Math.sin(zeit * 2.6 + i * 1.3) : 0.3;
      roboterarm(ctx, x, y, 0.95 * L.S, ph, laeuft && ph > 0.2);
    }
    // Rechen schieben am Anfang des Bands Heu drauf.
    for (let i = 0; i < zr; i++) {
      const x = B.von + 12 * L.S + i * 30 * L.S;
      const y = B.y + 2 * L.S;
      const hub = laeuft ? (Math.sin(zeit * 3 + i) + 1) * 4 * L.S : 0;
      ctx.fillStyle = '#5b5f63';
      ctx.fillRect(x - 10 * L.S, y - 8 * L.S, 20 * L.S, 10 * L.S);
      ctx.fillStyle = '#9aa0a5';
      ctx.fillRect(x - 4 * L.S, y - 8 * L.S - hub - 6 * L.S, 3 * L.S, 6 * L.S + hub);
      ctx.fillStyle = '#6b4a2d';
      ctx.fillRect(x - 10 * L.S, y - 8 * L.S - hub - 9 * L.S, 20 * L.S, 3 * L.S);
    }
    if (s.maschinen.radar) {
      const x = L.standX - 6;
      const y = L.wand + 8;
      ctx.strokeStyle = '#8c9296';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y + 6); ctx.stroke();
      ctx.fillStyle = '#c9cfd3';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 9, 4, Math.sin(zeit) * 0.4, 0, Math.PI * 2); ctx.fill();
      if (ping > 0) {
        ctx.strokeStyle = `rgba(124,242,154,${ping})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y + 4, (1 - ping) * 40 + 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drohnen(s, H) {
    const n = Math.min(s.drohnen, 13);
    if (!n) return;
    const L = lage();
    const leer = s.haufen.entfernt >= s.haufen.gesamt;
    const ax = H.cx;
    const ay = H.boden - H.h - 16;
    const bx = L.standX + 14 * L.S;
    const by = L.boden - 96 * L.S;
    for (let i = 0; i < n; i++) {
      let x;
      let y;
      let traegt = false;
      if (leer) {
        x = bx - 20 + (i % 5) * 9;
        y = by - 2 - Math.floor(i / 5) * 5;
      } else {
        const p = (zeit * 0.16 + i / n) % 1;
        const hin = p < 0.5;
        const q = hin ? p * 2 : 2 - p * 2;
        const e = (1 - Math.cos(q * Math.PI)) / 2;
        x = ax + (bx - ax) * e + Math.sin(zeit * 2 + i) * 4;
        y = Math.min(ay, by) - 24 - Math.sin(q * Math.PI) * 24 + (i % 3) * 7;
        traegt = hin;
      }
      ctx.fillStyle = '#1e2328';
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.strokeStyle = 'rgba(40,45,50,0.65)';
      ctx.lineWidth = 1.5;
      const w = leer ? 5 : 5 + Math.abs(Math.sin(zeit * 40 + i)) * 2;
      ctx.beginPath();
      ctx.moveTo(x - 8 - w / 2, y - 4); ctx.lineTo(x - 8 + w / 2, y - 4);
      ctx.moveTo(x + 8 - w / 2, y - 4); ctx.lineTo(x + 8 + w / 2, y - 4);
      ctx.stroke();
      ctx.fillStyle = '#5ce07a';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (traegt) {
        ctx.fillStyle = KNAEUEL;
        ctx.beginPath(); ctx.arc(x, y + 6, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function laeufer(anteil, H) {
    if (anteil == null) return;
    const L = lage();
    const bis = L.standX - 6 * L.S;
    const von = Math.min(H.cx + H.r * 0.3, bis - 90 * L.S);
    const hin = anteil < 0.5;
    const q = Math.max(0, Math.min(1, hin ? anteil * 2 : 2 - anteil * 2));
    const e = (1 - Math.cos(q * Math.PI)) / 2;
    const x = von + (bis - von) * e;
    const y = L.boden + 34 * L.S;
    const schritt = Math.sin(zeit * 14);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.4 * L.S * (hin ? 1 : -1), 1.4 * L.S);
    ctx.fillStyle = 'rgba(40,25,10,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 1, 8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2f3a4a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(-5 * schritt, 0);
    ctx.moveTo(0, -14); ctx.lineTo(5 * schritt, 0);
    ctx.stroke();
    ctx.strokeStyle = '#3f6b9a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -14); ctx.stroke();
    ctx.fillStyle = '#f0c9a0';
    ctx.beginPath(); ctx.arc(0, -35, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-5, -41, 10, 3);
    if (hin) {
      ctx.fillStyle = '#d9d9d9';
      ctx.beginPath(); ctx.moveTo(4, -26); ctx.lineTo(16, -26); ctx.lineTo(14, -16); ctx.lineTo(6, -16); ctx.fill();
      ctx.fillStyle = HEU;
      ctx.beginPath(); ctx.ellipse(10, -27, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function sauger(info, H) {
    if (!info.saugerAktiv) return;
    const L = lage();
    const S = L.S;
    const sx = Math.min(H.cx + H.r + 34 * S, L.standX - 80 * S);
    const sy = L.boden + 30 * S;
    const zx = Math.min(H.cx + H.r * 0.5, sx - 40 * S);
    const zy = H.boden - Math.max(H.h * 0.3, 14);
    ctx.lineCap = 'round';
    for (const [farbe, breite] of [['#1f2327', 9 * S], ['#8a9299', 6 * S]]) {
      ctx.strokeStyle = farbe;
      ctx.lineWidth = breite;
      ctx.beginPath(); ctx.moveTo(sx, sy - 8 * S); ctx.quadraticCurveTo(sx - 10 * S, zy + 30 * S, zx + 10 * S, zy + 3 * S); ctx.stroke();
    }
    // Düse: ein breiter Trichter, der auf den Haufen zeigt
    ctx.save();
    ctx.translate(zx + 10 * S, zy + 3 * S);
    ctx.rotate(Math.PI + 0.35);
    ctx.fillStyle = '#3a4046';
    ctx.beginPath(); ctx.moveTo(0, -3 * S); ctx.lineTo(14 * S, -8 * S); ctx.lineTo(14 * S, 8 * S); ctx.lineTo(0, 3 * S); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Wagen färbt sich mit der Hitze
    const rot = Math.round(200 + info.hitze * 55);
    const gruen = Math.round(60 + (1 - info.hitze) * 120);
    ctx.fillStyle = `rgb(${rot},${gruen},40)`;
    ctx.beginPath(); ctx.roundRect(sx - 14 * S, sy - 14 * S, 30 * S, 20 * S, 4 * S); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(sx - 8 * S, sy + 7 * S, 4.5 * S, 0, Math.PI * 2); ctx.arc(sx + 10 * S, sy + 7 * S, 4.5 * S, 0, Math.PI * 2); ctx.fill();
    if (info.saugt) {
      // Helle Halme fliegen aus einem Kegel in die Düse.
      const dx = zx - 4 * S;
      const dy = zy + 6 * S;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + 0.35 + (Math.random() - 0.5) * 0.9;
        const d = (40 + Math.random() * 30) * S;
        const x = dx + Math.cos(a) * d;
        const y = dy + Math.sin(a) * d;
        const leben = 0.4;
        teilchen.push({
          x, y, vx: (dx - x) / leben, vy: (dy - y) / leben, leben, max: leben,
          a: Math.random() * 3, l: 6 * S, farbe: Math.random() < 0.5 ? HEU_HELL : '#fff0c0', schwer: 0,
        });
      }
    }
  }

  function nadelMoment(H, dt) {
    if (glanz <= 0) return;
    glanz -= dt;
    const t = 1 - Math.max(0, glanz) / 2.4;
    const gx = H.cx;
    const gy = H.boden - Math.max(H.h, 30) * 0.7 - t * 50;
    const r = 30 + t * 70;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, glanz));
    ctx.translate(gx, gy);
    ctx.rotate(zeit * 0.8);
    ctx.fillStyle = 'rgba(255,240,170,0.35)';
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, -7); ctx.lineTo(r, 7); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, glanz));
    const hr = 64 * H.S;
    const hell = ctx.createRadialGradient(gx, gy, 0, gx, gy, hr);
    hell.addColorStop(0, 'rgba(255,255,235,0.95)');
    hell.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = hell;
    ctx.fillRect(gx - hr, gy - hr, hr * 2, hr * 2);
    ctx.translate(gx, gy);
    ctx.rotate(-0.8);
    ctx.scale(2 * H.S, 2 * H.S);
    ctx.strokeStyle = '#6f7a82';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.strokeStyle = '#d9e2e8';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-16, -0.6); ctx.lineTo(10, -0.6); ctx.stroke();
    ctx.strokeStyle = '#6f7a82';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(14, 0, 3, 1.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
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
      ctx.globalAlpha = Math.min(1, (p.leben / p.max) * 1.5);
      ctx.strokeStyle = p.farbe;
      if (p.ring) {
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.leben / p.max) * p.l + 4, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.lineWidth = 1.8;
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
      t.y -= dt * 34;
      ctx.globalAlpha = Math.min(1, t.leben * 2);
      ctx.font = `800 ${t.groesse}px system-ui, sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(35,22,8,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.farbe;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function neuerText(t) {
    // Gleicher Text kurz hintereinander: den alten auffrischen statt zu stapeln.
    const alt = t.einmal && texte.find((x) => x.text === t.text && x.leben > 0.3);
    if (alt) { alt.leben = t.leben; return; }
    texte.push(t);
    if (texte.length > 14) texte.shift();
  }

  return {
    anpassen: () => g.anpassen(),

    stich(x, y, menge, krit, aufsBand) {
      quetsch = 0.12;
      const n = Math.min(24, 5 + Math.round(Math.log2(menge + 1) * 2.5));
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = 80 + Math.random() * 150;
        teilchen.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, leben: 0.7, max: 0.7,
          a: Math.random() * 6, l: 5 + Math.random() * 6, farbe: Math.random() < 0.5 ? '#6f4712' : '#fff0c0', schwer: 420,
        });
      }
      teilchen.push({ x, y, vx: 0, vy: 0, leben: 0.35, max: 0.35, l: 22, farbe: 'rgba(255,245,215,0.8)', schwer: 0, ring: true });
      if (teilchen.length > 400) teilchen.splice(0, teilchen.length - 400);
      neuerText({
        x, y: y - 16, text: krit ? `Glücksstich! +${Math.round(menge)}` : `+${Math.round(menge)}`,
        leben: 0.9, farbe: krit ? '#ffd24a' : '#fffaf0', groesse: krit ? 17 : 14,
      });
      if (aufsBand && wuerfe.length < 12) wuerfe.push({ p: 0 });
    },

    text(x, y, text, farbe = '#a6f0b0', groesse = 15) {
      neuerText({ x, y, text, leben: 1.2, farbe, groesse, einmal: true });
    },

    standText(text) {
      const L = lage();
      neuerText({ x: L.standX + 14 * L.S, y: L.boden - 92 * L.S, text, leben: 1.4, farbe: '#a6f0b0', groesse: 15 });
    },

    nadelGlanz() { glanz = 2.4; },
    radarPing() { ping = 1; },

    zeichnen(s, info, dt) {
      zeit += dt;
      dtLetzt = dt;
      if (g.anpassen()) { hintenKey = ''; haufenKey = ''; }
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      const k = Math.cbrt(Math.max(0, 1 - s.haufen.entfernt / s.haufen.gesamt));
      const H = haufenForm(k);
      ctx.drawImage(hintergrundBauen(info.torOffen), 0, 0, g.w, g.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const L = lage();
      for (const w of wolken) {
        const x = ((w.x * (g.w + 160) + zeit * w.v) % (g.w + 160)) - 80;
        if (w.y * g.h < L.wand - 30) wolke(ctx, x, w.y * g.h + 12, w.s);
      }
      dachboegen();
      uhr(info.uhr || 0, info.torOffen);
      generatoren(s, info.fabrik);
      if (quetsch > 0) quetsch = Math.max(0, quetsch - dt);
      const sy = 1 - quetsch * 0.15;
      if (k > 0.0005) {
        ctx.save();
        ctx.translate(0, H.boden * (1 - sy));
        ctx.scale(1, sy);
        ctx.drawImage(haufenZeichnen(Math.round(k * 2000) / 2000), 0, 0, g.w, g.h);
        ctx.restore();
      } else leererBoden(H);
      bogenSchatten();
      bodenheu(info.boden || 0, H);
      stand(info.preisText || '0,02 $');
      foerderband(s, info.fabrik, H);
      maschinen(s, info.fabrik, H);
      if (ping > 0) ping = Math.max(0, ping - dt * 0.8);
      sauger(info, H);
      drohnen(s, H);
      laeufer(info.laufAnteil, H);
      nadelMoment(H, dt);
      teilchenZeichnen(dt);
    },
  };
}

/* ================================================================ Halle */

const HALLE_MASCHINEN = [
  ['silo', 'SILO', '#5fc4b0'], ['presse', 'PRESSE', '#5fc4b0'], ['pellet', 'PELLET', '#5fc4b0'],
  ['pulper', 'PULPER', '#5aa7e0'], ['wickler', 'WICKLER', '#5fc4b0'], ['papier', 'PAPIER', '#5aa7e0'],
  ['brikett', 'ZIEGEL', '#5fc4b0'],
];
const PRODUKT_FARBE = {
  knaeuel: KNAEUEL, ballen: '#d9a444', pellet: '#9c7a3c', brei: '#b8a47a', silage: '#f2f2ee', papier: '#fbf6e6', brikett: '#b5643c',
};
const PRODUKT_VON = { silo: 'knaeuel', presse: 'ballen', pellet: 'pellet', pulper: 'brei', wickler: 'silage', papier: 'papier', brikett: 'brikett' };

export function halleSzene(canvas) {
  const g = leinwand(canvas);
  const { ctx } = g;
  let zeit = 0;
  let geldTakt = 0;
  let geldText = null;
  let lasterX = null;

  return {
    zeichnen(s, f, dt, geldProSek, lasterDa) {
      zeit += dt;
      g.anpassen();
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      const { w, h } = g;
      const himmel = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      himmel.addColorStop(0, '#5a9ad8');
      himmel.addColorStop(1, '#c4e2f5');
      ctx.fillStyle = himmel;
      ctx.fillRect(0, 0, w, h * 0.45);
      ctx.fillStyle = '#5d3f25';
      ctx.fillRect(0, h * 0.3, w, h * 0.4);
      for (let x = 0; x < w; x += 7) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, h * 0.3, 1, h * 0.4); }
      for (let x = 20; x < w; x += 70) { ctx.fillStyle = '#39342f'; ctx.fillRect(x, h * 0.28, 5, h * 0.42); }
      const sand = ctx.createLinearGradient(0, h * 0.7, 0, h);
      sand.addColorStop(0, '#c7ad86');
      sand.addColorStop(1, '#a28866');
      ctx.fillStyle = sand;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-10, h * 0.3); ctx.quadraticCurveTo(w / 2, -h * 0.25, w + 10, h * 0.3); ctx.stroke();

      const bandY = h * 0.78;
      const links = 56;
      const rechts = w - 70;
      ctx.fillStyle = HEU;
      ctx.beginPath(); ctx.moveTo(0, bandY + 10); ctx.quadraticCurveTo(8, h * 0.22, 66, bandY + 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.35)';
      ctx.beginPath(); ctx.moveTo(0, bandY + 10); ctx.quadraticCurveTo(4, h * 0.3, 30, bandY + 10); ctx.fill();
      ctx.fillStyle = '#2a2927';
      ctx.fillRect(links, bandY, rechts - links, 9);
      ctx.fillStyle = '#4a4744';
      ctx.fillRect(links, bandY, rechts - links, 2.5);
      const auslast = f.band ? Math.min(1, f.fluss / f.band) : 0;
      const tempo = f.fluss > 0 ? 28 + 90 * auslast : 0;
      if (f.fluss > 0) {
        const n = 5 + Math.round(auslast * 18);
        for (let i = 0; i < n; i++) {
          const x = links + ((zeit * tempo + (i * (rechts - links)) / n) % (rechts - links));
          ctx.fillStyle = KNAEUEL;
          ctx.beginPath(); ctx.arc(x, bandY - 3, 3.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      const gens = Math.min(5, (s.maschinen.generator || 0));
      for (let i = 0; i < gens; i++) {
        const x = 70 + i * 22;
        const y = h * 0.72;
        ctx.fillStyle = '#4b5a3b';
        ctx.fillRect(x, y - 14, 18, 14);
        if (f.brennstoff > 0) {
          const p = (zeit * 0.8 + i * 0.3) % 1;
          ctx.fillStyle = `rgba(230,230,225,${0.5 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(x + 13, y - 18 - p * 16, 2 + p * 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (s.maschinen.brunnen) {
        const x = 70 + gens * 22 + 10;
        const y = h * 0.72;
        ctx.fillStyle = '#3f6f9a';
        ctx.fillRect(x, y - 16, 12, 16);
        ctx.strokeStyle = '#5aa7e0';
        ctx.lineWidth = 2;
        const hub = Math.sin(zeit * 3) * 3;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 18 + hub); ctx.lineTo(x + 16, y - 18 - hub); ctx.stroke();
      }
      const arme = s.aus.arm ? 0 : (s.maschinen.arm || 0);
      const zahl = Math.min(4, arme);
      for (let i = 0; i < zahl; i++) {
        roboterarm(ctx, links + 14 + i * 24, bandY + 2, 0.75, f.fluss > 0 ? Math.sin(zeit * 3 * (f.strom || 0) + i) : 0.3, false);
      }
      if (s.maschinen.scanner) {
        const sx = Math.max(links + (rechts - links) * 0.4, links + 14 + zahl * 24 + 10);
        ctx.strokeStyle = '#b58be8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx - 11, bandY + 9); ctx.lineTo(sx - 11, bandY - 22); ctx.lineTo(sx + 11, bandY - 22); ctx.lineTo(sx + 11, bandY + 9);
        ctx.stroke();
        const flacker = 0.3 + 0.3 * Math.sin(zeit * 18);
        ctx.fillStyle = f.deckung < 1 ? `rgba(230,90,70,${flacker})` : `rgba(181,139,232,${flacker})`;
        ctx.fillRect(sx - 9, bandY - 20, 18, 20);
      }
      const da = HALLE_MASCHINEN.filter(([id]) => s.maschinen[id]);
      const start = links + (rechts - links) * 0.5;
      const breite = (rechts - start) / Math.max(1, da.length);
      da.forEach(([id, name, farbe], i) => {
        const x = start + i * breite + breite / 2;
        const bw = Math.min(44, breite - 4);
        const aus = s.aus[id];
        const an = !aus && (f.auslastung[id] || 0) > 0.01;
        const hub = an ? Math.abs(Math.sin(zeit * 4 + i)) * 3 : 0;
        ctx.fillStyle = aus ? '#4a4540' : '#dfe3e4';
        ctx.fillRect(x - bw / 2, bandY - 34 + hub, bw, 26 - hub);
        ctx.fillStyle = aus ? '#5a554f' : farbe;
        ctx.fillRect(x - bw / 2, bandY - 34 + hub, bw, 5);
        ctx.fillStyle = '#2b2b2d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (bw >= 40) {
          ctx.font = '800 7.5px system-ui, sans-serif';
          ctx.fillText(name, x, bandY - 21 + hub / 2, bw - 4);
        }
        ctx.font = `800 ${bw < 40 ? 7 : 8}px system-ui, sans-serif`;
        ctx.fillText(`×${s.maschinen[id]}`, x, bandY - 13, bw - 2);
        if (an) {
          const p = (zeit * 1.4 + i * 0.3) % 1;
          ctx.fillStyle = PRODUKT_FARBE[PRODUKT_VON[id]];
          ctx.fillRect(x - 3 + p * (rechts - x), bandY - 8 - Math.sin(p * Math.PI) * 14, 7, 6);
        }
      });
      ctx.fillStyle = '#4a321d';
      ctx.fillRect(rechts, bandY - 36, 60, 46);
      ctx.fillStyle = '#e9dcc0';
      ctx.fillRect(rechts + 3, bandY - 50, 54, 13);
      ctx.fillStyle = '#3b2a17';
      ctx.font = '800 7.5px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VERKAUF', rechts + 30, bandY - 43);
      const ziel = lasterDa ? rechts + 16 : w + 90;
      if (lasterX == null) lasterX = ziel;
      lasterX += (ziel - lasterX) * Math.min(1, dt * 1.5);
      if (lasterX < w + 60) {
        const lx = lasterX;
        const ly = Math.min(h - 8, bandY + 34);
        ctx.fillStyle = '#c9412e';
        ctx.fillRect(lx - 40, ly - 22, 30, 22);
        ctx.fillStyle = '#e9e4da';
        ctx.fillRect(lx - 10, ly - 16, 16, 16);
        ctx.fillStyle = '#9ec3dc';
        ctx.fillRect(lx - 7, ly - 13, 9, 6);
        ctx.fillStyle = '#1d1d1f';
        ctx.beginPath(); ctx.arc(lx - 30, ly + 2, 4, 0, Math.PI * 2); ctx.arc(lx, ly + 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(20,16,12,0.7)';
      ctx.fillRect(8, 8, 104, 16);
      ctx.fillStyle = f.strom < 1 ? '#ff6b4a' : '#e8c547';
      ctx.fillRect(10, 10, 58 * Math.min(1, f.bedarf ? f.erzeugt / Math.max(f.bedarf, f.erzeugt) : 1), 12);
      ctx.fillStyle = '#fff4dc';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('STROM', 70, 17);
      geldTakt += dt;
      if (geldProSek > 0 && geldTakt > 1) {
        geldTakt = 0;
        const t = geldProSek >= 100 ? Math.round(geldProSek).toLocaleString('de-DE') : geldProSek.toFixed(2).replace('.', ',');
        geldText = { y: bandY - 60, leben: 1.2, text: `+${t} $` };
      }
      if (geldText) {
        geldText.leben -= dt;
        geldText.y -= dt * 20;
        if (geldText.leben <= 0) geldText = null;
        else {
          ctx.globalAlpha = Math.min(1, geldText.leben * 1.5);
          ctx.textAlign = 'center';
          ctx.font = '800 11px system-ui, sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(30,20,10,0.8)';
          ctx.strokeText(geldText.text, rechts + 30, geldText.y);
          ctx.fillStyle = '#a6f0b0';
          ctx.fillText(geldText.text, rechts + 30, geldText.y);
          ctx.globalAlpha = 1;
        }
      }
    },
  };
}
