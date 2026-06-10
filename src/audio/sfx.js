// Procedural one-shot sound effects — all synthesized, no samples.
//
// Every effect has the signature (ctx, destination, opts) and is safe to call
// with a null ctx (the synth helpers no-op), so importing and calling these in
// Node tests never throws. Routing goes through `destination` (the SFX bus).

import { playNote, playNoise, noteToFreq } from './synth.js';

// Semitone offset above A4 per item rarity (matches RARITY_ORDER in
// src/data/affixes.js). Higher rarity -> higher, brighter chime.
const RARITY_SEMITONES = { grau: 0, weiss: 2, gruen: 4, blau: 7, lila: 10, orange: 14 };

// Base chime frequency for a rarity key ('grau'..'orange'). Pure + testable.
export function lootBaseFreq(rarity) {
  const semis = RARITY_SEMITONES[rarity] != null ? RARITY_SEMITONES[rarity] : RARITY_SEMITONES.gruen;
  return 440 * 2 ** (semis / 12);
}

// Dull weapon impact: low-pass thud plus a fast pitch-drop punch.
function hit(ctx, dest) {
  playNoise(ctx, { durMs: 90, gain: 0.22, filter: 'lowpass', filterFreq: 950, destination: dest });
  playNote(ctx, { freq: 170, slideTo: 55, durMs: 110, type: 'square', gain: 0.2, destination: dest });
}

// Critical hit: bigger crunch, deeper drop, and a bright ping on top.
function crit(ctx, dest) {
  playNoise(ctx, { durMs: 150, gain: 0.28, filter: 'bandpass', filterFreq: 1800, q: 0.8, destination: dest });
  playNote(ctx, { freq: 320, slideTo: 60, durMs: 150, type: 'square', gain: 0.26, destination: dest });
  playNote(ctx, { freq: noteToFreq('E6'), durMs: 80, type: 'triangle', gain: 0.12, when: 0.02, destination: dest });
}

// Shield block: two clashing high blips + metallic hiss. Short and snappy.
function block(ctx, dest) {
  playNote(ctx, { freq: noteToFreq('F#5'), durMs: 50, type: 'square', gain: 0.11, destination: dest });
  playNote(ctx, { freq: noteToFreq('B5'), durMs: 45, type: 'square', gain: 0.09, when: 0.012, destination: dest });
  playNoise(ctx, { durMs: 70, gain: 0.16, filter: 'highpass', filterFreq: 2500, destination: dest });
}

// Level up: rising C-major arpeggio with a square shine and noise shimmer.
function levelUp(ctx, dest) {
  ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
    playNote(ctx, { freq: noteToFreq(n), durMs: 230, type: 'triangle', gain: 0.16, when: i * 0.1, destination: dest });
  });
  playNote(ctx, { freq: noteToFreq('C6'), durMs: 380, type: 'square', gain: 0.07, when: 0.3, destination: dest });
  playNoise(ctx, { durMs: 300, gain: 0.05, when: 0.3, filter: 'highpass', filterFreq: 6000, destination: dest });
}

// Item drop chime, pitched up by rarity ('grau'..'orange'). Accepts either
// loot(ctx, dest, 'lila') or loot(ctx, dest, { rarity: 'lila' }).
// Rare finds (blau and up) get an extra octave sparkle.
function loot(ctx, dest, opts = {}) {
  const rarity = typeof opts === 'string' ? opts : (opts && opts.rarity) || 'gruen';
  const base = lootBaseFreq(rarity);
  playNote(ctx, { freq: base, durMs: 110, type: 'triangle', gain: 0.16, destination: dest });
  playNote(ctx, { freq: base * 1.5, durMs: 160, type: 'triangle', gain: 0.16, when: 0.09, destination: dest });
  if ((RARITY_SEMITONES[rarity] || 0) >= RARITY_SEMITONES.blau) {
    playNote(ctx, { freq: base * 2, durMs: 220, type: 'square', gain: 0.06, when: 0.18, destination: dest });
  }
}

// Classic two-blip coin pickup.
function coin(ctx, dest) {
  playNote(ctx, { freq: noteToFreq('B5'), durMs: 40, type: 'square', gain: 0.15, destination: dest });
  playNote(ctx, { freq: noteToFreq('E6'), durMs: 200, type: 'square', gain: 0.15, when: 0.045, destination: dest });
}

// Tiny UI click — barely-there falling blip.
function click(ctx, dest) {
  playNote(ctx, { freq: 1800, slideTo: 1350, durMs: 30, type: 'square', gain: 0.07, destination: dest });
}

// Fishing splash: dark noise sweep + sine "bloop" + a late droplet.
function fishSplash(ctx, dest) {
  playNoise(ctx, { durMs: 320, gain: 0.2, filter: 'lowpass', filterFreq: 1300, filterSlideTo: 280, destination: dest });
  playNote(ctx, { freq: 360, slideTo: 85, durMs: 190, type: 'sine', gain: 0.18, when: 0.02, destination: dest });
  playNote(ctx, { freq: 900, slideTo: 1500, durMs: 90, type: 'sine', gain: 0.07, when: 0.26, destination: dest });
}

// Rune puzzle solved: resolving G-major arpeggio with a soft echo.
function puzzleSolve(ctx, dest) {
  ['G4', 'B4', 'D5', 'G5'].forEach((n, i) => {
    playNote(ctx, { freq: noteToFreq(n), durMs: 160, type: 'triangle', gain: 0.16, when: i * 0.09, destination: dest });
  });
  playNote(ctx, { freq: noteToFreq('G5'), durMs: 240, type: 'square', gain: 0.05, when: 0.5, destination: dest });
}

export const SFX = {
  hit,
  crit,
  block,
  levelUp,
  loot,
  coin,
  click,
  fishSplash,
  puzzleSolve,
};

export const SFX_NAMES = Object.keys(SFX);
