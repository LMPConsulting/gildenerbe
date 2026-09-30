// Alle Geräusche werden erzeugt, nicht abgespielt: Rauschen für Heu, Sinus
// für Münzen, ein Rechteck für den Detektor. Keine Audiodateien.

let ctx = null;
let master = null;
let rauschPuffer = null;
let stumm = false;
let saugerTon = null;

export function klangStumm(wert) {
  if (wert !== undefined) {
    stumm = !!wert;
    if (stumm) saugerAus();
  }
  return stumm;
}

/** Muss aus einer Nutzergeste heraus einmal aufgerufen werden (Autoplay-Regeln). */
export function klangWecken() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  rauschPuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = rauschPuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

const bereit = () => ctx && !stumm && ctx.state === 'running';

function ton(frequenz, dauer, { typ = 'sine', laut = 0.2, start = 0, gleiten = null } = {}) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = typ;
  o.frequency.setValueAtTime(frequenz, t);
  if (gleiten) o.frequency.exponentialRampToValueAtTime(gleiten, t + dauer);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(laut, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dauer + 0.02);
}

function rauschen(dauer, { frequenz = 3000, q = 1, laut = 0.25, start = 0, typ = 'bandpass' } = {}) {
  const t = ctx.currentTime + start;
  const quelle = ctx.createBufferSource();
  quelle.buffer = rauschPuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = typ;
  filter.frequency.value = frequenz;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(laut, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  quelle.connect(filter).connect(g).connect(master);
  quelle.start(t, Math.random() * 0.5);
  quelle.stop(t + dauer + 0.02);
}

export const klang = {
  stich(krit = false) {
    if (!bereit()) return;
    rauschen(0.09, { frequenz: 2200 + Math.random() * 1800, q: 0.8, laut: 0.22 });
    rauschen(0.05, { frequenz: 600, q: 1.5, laut: 0.12, typ: 'lowpass' });
    if (krit) ton(1320, 0.18, { typ: 'triangle', laut: 0.12, start: 0.02 });
  },
  kasse() {
    if (!bereit()) return;
    rauschen(0.03, { frequenz: 5000, q: 2, laut: 0.15 });
    ton(1046, 0.12, { laut: 0.16, start: 0.02 });
    ton(1568, 0.25, { laut: 0.14, start: 0.09 });
  },
  piep(staerke) {
    if (!bereit()) return;
    ton(1400 + staerke * 900, 0.045, { typ: 'square', laut: 0.05 + staerke * 0.05 });
  },
  klick() {
    if (!bereit()) return;
    ton(520, 0.04, { typ: 'triangle', laut: 0.1 });
  },
  kauf() {
    if (!bereit()) return;
    ton(660, 0.06, { typ: 'triangle', laut: 0.14 });
    ton(990, 0.1, { typ: 'triangle', laut: 0.12, start: 0.05 });
  },
  fehler() {
    if (!bereit()) return;
    ton(160, 0.14, { typ: 'sawtooth', laut: 0.08, gleiten: 120 });
  },
  fund(rang = 0) {
    if (!bereit()) return;
    const noten = [784, 988, 1175, 1568, 1976];
    for (let i = 0; i <= rang; i++) ton(noten[i], 0.4, { laut: 0.1, start: i * 0.07 });
  },
  nadel() {
    if (!bereit()) return;
    [523, 659, 784, 1046, 1318].forEach((f, i) => ton(f, 0.6, { typ: 'triangle', laut: 0.16, start: i * 0.1 }));
    rauschen(1.2, { frequenz: 8000, q: 0.5, laut: 0.05, start: 0.4, typ: 'highpass' });
  },
  heiss() {
    if (!bereit()) return;
    rauschen(0.5, { frequenz: 1200, q: 3, laut: 0.15 });
    ton(300, 0.4, { typ: 'sawtooth', laut: 0.06, gleiten: 90 });
  },
  /** Ein Bau steht: dumpfer Schlag und ein heller Ton wie beim Aufbau-Hologramm. */
  bauen() {
    if (!bereit()) return;
    rauschen(0.12, { frequenz: 220, q: 0.7, laut: 0.3, typ: 'lowpass' });
    ton(440, 0.12, { typ: 'triangle', laut: 0.1, start: 0.04 });
    ton(880, 0.22, { typ: 'sine', laut: 0.08, start: 0.1, gleiten: 1320 });
  },
  abbauen() {
    if (!bereit()) return;
    ton(700, 0.2, { typ: 'triangle', laut: 0.09, gleiten: 260 });
    rauschen(0.18, { frequenz: 900, q: 0.6, laut: 0.12 });
  },
  /** Maschinengeräusche; laut 0..1 nach Entfernung. */
  rechen(laut = 1) {
    if (!bereit() || laut < 0.03) return;
    rauschen(0.07, { frequenz: 300, q: 0.9, laut: 0.22 * laut, typ: 'lowpass' });
    rauschen(0.12, { frequenz: 2600, q: 0.7, laut: 0.1 * laut, start: 0.03 });
  },
  greifen(laut = 1) {
    if (!bereit() || laut < 0.03) return;
    ton(420, 0.18, { typ: 'sawtooth', laut: 0.025 * laut, gleiten: 560 });
  },
  plopp(laut = 1) {
    if (!bereit() || laut < 0.03) return;
    ton(260, 0.09, { typ: 'sine', laut: 0.14 * laut, gleiten: 140 });
  },
  werfen() {
    if (!bereit()) return;
    rauschen(0.22, { frequenz: 1500, q: 0.6, laut: 0.12 });
  },
  scanner() {
    if (!bereit()) return;
    [988, 1319, 988, 1319].forEach((f, i) => ton(f, 0.16, { typ: 'square', laut: 0.05, start: i * 0.15 }));
  },
  hupe() {
    if (!bereit()) return;
    ton(311, 0.35, { typ: 'sawtooth', laut: 0.07 });
    ton(392, 0.35, { typ: 'sawtooth', laut: 0.06 });
    ton(311, 0.5, { typ: 'sawtooth', laut: 0.07, start: 0.45 });
    ton(392, 0.5, { typ: 'sawtooth', laut: 0.06, start: 0.45 });
  },
  auftrag() {
    if (!bereit()) return;
    rauschen(0.04, { frequenz: 5000, q: 2, laut: 0.2 });
    ton(1046, 0.15, { laut: 0.18, start: 0.02 });
    ton(1568, 0.3, { laut: 0.16, start: 0.1 });
    [2093, 2637, 2349, 2794].forEach((f, i) => ton(f, 0.12, { typ: 'triangle', laut: 0.07, start: 0.18 + i * 0.06 }));
  },
  /** Ein Schritt: auf dem Boden dumpf, im Heu raschelnd. */
  schritt(aufHeu = false) {
    if (!bereit()) return;
    if (aufHeu) rauschen(0.12, { frequenz: 2500, q: 0.7, laut: 0.07 });
    else rauschen(0.07, { frequenz: 900, q: 0.8, laut: 0.06, typ: 'lowpass' });
  },
  /** Knistern eines brennenden Generators in der Nähe; laut 0..1. */
  knistern(laut = 1) {
    if (!bereit() || laut < 0.05) return;
    rauschen(0.03 + Math.random() * 0.04, { frequenz: 1800 + Math.random() * 2500, q: 2, laut: 0.08 * laut });
  },
  summen() {
    if (!bereit()) return;
    ton(110, 0.5, { typ: 'sawtooth', laut: 0.05 });
    ton(116, 0.5, { typ: 'sawtooth', laut: 0.04 });
  },
};

/** Wind über der offenen Halle, ganz leise, solange gespielt wird. */
let windTon = null;
export function wind(an) {
  if (!ctx) return;
  if (!windTon) {
    const q = ctx.createBufferSource();
    q.buffer = rauschPuffer;
    q.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0;
    q.connect(f).connect(g).connect(master);
    q.start();
    windTon = { g, f };
  }
  const ziel = an && !stumm && ctx.state === 'running' ? 0.015 : 0;
  windTon.g.gain.setTargetAtTime(ziel, ctx.currentTime, 1.2);
  // der Wind schwillt langsam an und ab
  windTon.f.frequency.setTargetAtTime(320 + Math.sin(ctx.currentTime * 0.15) * 120, ctx.currentTime, 2);
}

/** Leises Brummen laufender Maschinen in der Nähe; laut 0..1. */
let brummTon = null;
export function brummen(laut) {
  if (!ctx) return;
  if (!brummTon) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 58;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    const q = ctx.createBufferSource();
    q.buffer = rauschPuffer;
    q.loop = true;
    const qf = ctx.createBiquadFilter();
    qf.type = 'bandpass';
    qf.frequency.value = 850;
    qf.Q.value = 0.6;
    const gq = ctx.createGain();
    gq.gain.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g);
    q.connect(qf).connect(gq).connect(g);
    g.connect(master);
    o.start();
    q.start();
    brummTon = { g };
  }
  const ziel = stumm || ctx.state !== 'running' ? 0 : Math.max(0, Math.min(1, laut)) * 0.05;
  brummTon.g.gain.setTargetAtTime(ziel, ctx.currentTime, 0.35);
}

export function saugerAn() {
  if (!bereit() || saugerTon) return;
  const quelle = ctx.createBufferSource();
  quelle.buffer = rauschPuffer;
  quelle.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const brumm = ctx.createOscillator();
  brumm.type = 'sawtooth';
  brumm.frequency.value = 95;
  const brummG = ctx.createGain();
  brummG.gain.value = 0.04;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.15);
  quelle.connect(filter).connect(g);
  brumm.connect(brummG).connect(g);
  g.connect(master);
  quelle.start();
  brumm.start();
  saugerTon = { quelle, brumm, g, filter };
}

export function saugerHitze(h) {
  if (saugerTon) saugerTon.filter.frequency.value = 900 + h * 1400;
}

export function saugerAus() {
  if (!saugerTon || !ctx) return;
  const { quelle, brumm, g } = saugerTon;
  saugerTon = null;
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  quelle.stop(ctx.currentTime + 0.25);
  brumm.stop(ctx.currentTime + 0.25);
}
