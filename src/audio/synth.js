// Procedural Web Audio synth core for Gildenerbe — zero deps, zero audio files.
//
// Node-safe by design: importing this module never touches AudioContext.
// getAudioContext() lazily creates one shared context (call it from a user
// gesture to satisfy mobile autoplay policies) and returns null where Web
// Audio is unavailable (e.g. Vitest with environment:'node'). Every helper
// accepts a null ctx and no-ops, so callers never need to guard.

let sharedCtx = null;

function audioContextCtor() {
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    return window.AudioContext || window.webkitAudioContext;
  }
  return typeof AudioContext !== 'undefined' ? AudioContext : null;
}

// Lazily create (on first call) and return the shared AudioContext.
// Returns null when Web Audio is unsupported (Node, very old browsers).
export function getAudioContext() {
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
}

// ---------------------------------------------------------------------------
// Note names
// ---------------------------------------------------------------------------

const SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, h: 11 };

// 'A4' -> 440, 'F#3' -> 185, 'Bb2' -> ~116.54. Numbers pass through unchanged.
// Returns 0 for rests / invalid input (0 is treated as silence everywhere).
export function noteToFreq(note) {
  if (typeof note === 'number' && Number.isFinite(note)) return note > 0 ? note : 0;
  if (typeof note !== 'string') return 0;
  const m = /^([a-hA-H])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!m) return 0;
  let semi = SEMITONES[m[1].toLowerCase()];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// One oscillator note with a click-free gain envelope
// ---------------------------------------------------------------------------

// Play a single note `when` seconds from now. The short linear attack and
// release ramps avoid the clicks a hard start/stop would produce.
// Optional richness: `slideTo` (Hz) pitch-bend, `detune` (cents — adds a 2nd
// oscillator slightly off for chorus width), `vibrato` {rateHz, cents} (LFO),
// `filterHz` (lowpass to tame saws into horn/pad timbres), `destination`
// routes into a bus. Returns { osc, gainNode, stop }.
export function playNote(ctx, {
  freq,
  durMs = 200,
  type = 'square',
  gain = 0.2,
  when = 0,
  destination = null,
  slideTo = 0,
  attackMs = 4,
  releaseMs = 40,
  detune = 0,
  vibrato = null,
  filterHz = 0,
} = {}) {
  if (!ctx || !(freq > 0) || !(durMs > 0)) return null;
  const t0 = ctx.currentTime + Math.max(0, when);
  const dur = durMs / 1000;
  const atk = Math.min(attackMs / 1000, dur * 0.6);
  const rel = Math.min(releaseMs / 1000, dur * 0.5);

  const oscs = [];
  const mk = (cents) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (cents && o.detune) o.detune.setValueAtTime(cents, t0);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    oscs.push(o);
    return o;
  };
  mk(0);
  if (detune > 0) mk(detune);          // chorus pair

  // vibrato LFO modulating all oscillator frequencies
  let lfo = null, lfoGain = null;
  if (vibrato && vibrato.rateHz > 0 && vibrato.cents > 0 && oscs[0].detune) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato.rateHz;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = vibrato.cents;
    lfo.connect(lfoGain);
    for (const o of oscs) lfoGain.connect(o.detune);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }

  const g = ctx.createGain();
  const peak = detune > 0 ? gain * 0.6 : gain; // two oscs -> keep loudness equal
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + atk);
  g.gain.setValueAtTime(peak, t0 + Math.max(atk, dur - rel));
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);

  let head = g;
  if (filterHz > 0) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, t0);
    for (const o of oscs) o.connect(f);
    f.connect(g);
    head = f;
  } else {
    for (const o of oscs) o.connect(g);
  }
  g.connect(destination || ctx.destination);
  for (const o of oscs) { o.start(t0); o.stop(t0 + dur + 0.02); }
  oscs[0].onended = () => {
    try {
      for (const o of oscs) o.disconnect();
      g.disconnect();
      if (head !== g) head.disconnect();
      if (lfo) { lfo.disconnect(); lfoGain.disconnect(); }
    } catch { /* already gone */ }
  };
  return {
    osc: oscs[0],
    gainNode: g,
    stop(afterSec = 0) {
      try { for (const o of oscs) o.stop(ctx.currentTime + Math.max(0, afterSec)); } catch { /* not started */ }
    },
  };
}

// ---------------------------------------------------------------------------
// Noise burst (percussion, impacts, splashes)
// ---------------------------------------------------------------------------

// White-noise burst with a percussive decay envelope. Optional biquad filter
// ('lowpass' | 'highpass' | 'bandpass'); `filterSlideTo` sweeps the cutoff
// across the burst (great for splashes and whooshes).
export function playNoise(ctx, {
  durMs = 150,
  gain = 0.2,
  when = 0,
  destination = null,
  filter = null,
  filterFreq = 1000,
  filterSlideTo = 0,
  q = 1,
  attackMs = 2,
} = {}) {
  if (!ctx || !(durMs > 0)) return null;
  const t0 = ctx.currentTime + Math.max(0, when);
  const dur = durMs / 1000;
  const atk = Math.min(attackMs / 1000, dur * 0.25);

  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(filterFreq, t0);
    f.Q.value = q;
    if (filterSlideTo > 0) f.frequency.exponentialRampToValueAtTime(filterSlideTo, t0 + dur);
    src.connect(f);
    f.connect(g);
  } else {
    src.connect(g);
  }
  g.connect(destination || ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  src.onended = () => {
    try { src.disconnect(); g.disconnect(); } catch { /* already gone */ }
  };
  return { src, gainNode: g };
}

// ---------------------------------------------------------------------------
// Step sequencer
// ---------------------------------------------------------------------------

// Steps are compact tuples [note, beats] (note: 'C4'-style name, raw Hz, or
// null for a rest) or objects { note|freq, beats, type?, gain? }.
function normalizeStep(step) {
  if (Array.isArray(step)) {
    return { freq: noteToFreq(step[0]), beats: step[1] > 0 ? step[1] : 1 };
  }
  if (step && typeof step === 'object') {
    const freq = step.freq != null ? step.freq : noteToFreq(step.note);
    return {
      freq: freq > 0 ? freq : 0,
      beats: step.beats > 0 ? step.beats : 1,
      type: step.type,
      gain: step.gain,
    };
  }
  return { freq: 0, beats: 1 };
}

const NOOP_HANDLE = Object.freeze({ stop() {}, playing: false });
const LOOKAHEAD_SEC = 0.35; // schedule this far ahead of the clock
const TICK_MS = 90;         // scheduler wake-up interval
const NOTE_FILL = 0.9;      // note length as fraction of its slot (articulation)

// Schedule a melodic line on the Web Audio clock using the classic lookahead
// pattern (a coarse JS timer schedules sample-accurate notes slightly ahead).
// Returns a handle: { stop(), playing }. With loop:true the line repeats until
// stopped; stop() ramps a per-sequence gain to zero, so it never clicks.
// Voice options for rich timbres: attackMs/releaseMs (pads), detune (chorus),
// vibrato {rateHz,cents}, filterHz (lowpass), octave (+/- shift),
// noise:true turns the voice into filtered-noise percussion (freq -> cutoff).
export function playSequence(ctx, steps, {
  bpm = 120,
  loop = false,
  type = 'square',
  gain = 0.15,
  destination = null,
  attackMs = 4,
  releaseMs = 40,
  detune = 0,
  vibrato = null,
  filterHz = 0,
  octave = 0,
  noise = false,
} = {}) {
  if (!ctx || !Array.isArray(steps) || steps.length === 0) return NOOP_HANDLE;

  const secPerBeat = 60 / Math.max(1, bpm);
  const norm = steps.map(normalizeStep);
  const offsets = [];
  let totalBeats = 0;
  for (const st of norm) {
    offsets.push(totalBeats);
    totalBeats += st.beats;
  }
  if (!(totalBeats > 0)) return NOOP_HANDLE;

  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(destination || ctx.destination);

  const startAt = ctx.currentTime + 0.06;
  let index = 0;
  let cycle = 0;
  let done = false;     // all steps scheduled (non-loop)
  let stopped = false;
  let timer = null;

  function tick() {
    if (stopped) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SEC;
    while (!done) {
      const when = startAt + (cycle * totalBeats + offsets[index]) * secPerBeat;
      if (when > horizon) break;
      const st = norm[index];
      if (st.freq > 0) {
        const durMs = Math.max(25, st.beats * secPerBeat * 1000 * NOTE_FILL);
        const at = Math.max(0, when - ctx.currentTime);
        if (noise) {
          playNoise(ctx, {
            durMs: Math.min(durMs, 220),
            gain: st.gain != null ? st.gain : gain,
            when: at,
            destination: out,
            filter: 'lowpass',
            filterFreq: st.freq, // note encodes the cutoff -> tom/timpani pitch
          });
        } else {
          playNote(ctx, {
            freq: st.freq * 2 ** octave,
            durMs,
            type: st.type || type,
            gain: st.gain != null ? st.gain : gain,
            when: at,
            destination: out,
            attackMs,
            releaseMs,
            detune,
            vibrato,
            filterHz,
          });
        }
      }
      index += 1;
      if (index >= norm.length) {
        index = 0;
        cycle += 1;
        if (!loop) done = true;
      }
    }
    if (done) {
      const endAt = startAt + cycle * totalBeats * secPerBeat;
      if (ctx.currentTime > endAt + 0.1) {
        stopped = true;
        if (timer) { clearInterval(timer); timer = null; }
        try { out.disconnect(); } catch { /* already gone */ }
      }
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    const t = ctx.currentTime;
    try {
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0.0001, t + 0.05); // click-free fade
    } catch { /* context closing */ }
    setTimeout(() => {
      try { out.disconnect(); } catch { /* already gone */ }
    }, 120);
  }

  timer = setInterval(tick, TICK_MS);
  tick();

  return {
    stop,
    get playing() { return !stopped; },
  };
}
