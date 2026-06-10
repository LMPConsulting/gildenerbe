// Public audio API for Gildenerbe — procedural Web Audio chiptune + SFX.
//
// Usage:
//   import { initAudio, playMusic, playSfx } from './audio/index.js';
//   button.addEventListener('click', () => initAudio());  // first user gesture
//   playMusic('explore');            // looping theme (stops the previous one)
//   playSfx('loot', { rarity: 'lila' });
//
// Mobile-safe: the AudioContext is created lazily inside initAudio() — call it
// from the first tap/click. playMusic() requested before init is remembered
// and started automatically once initAudio() succeeds.
// Node-safe: importing this module never creates an AudioContext; every call
// degrades to a no-op (returning false) when Web Audio is unavailable.

import { getAudioContext, playSequence } from './synth.js';
import { TRACKS, TRACK_NAMES } from './tracks.js';
import { SFX, SFX_NAMES } from './sfx.js';

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

let ctx = null;
let musicBus = null;       // GainNode — all music routes through here
let sfxBus = null;         // GainNode — all SFX route through here
let musicVolume = 0.7;
let sfxVolume = 0.9;
let current = null;        // { name, handles: [{ stop, playing }] }
let pendingMusic = null;   // track requested before initAudio() (mobile flow)

function setBusGain(bus, v) {
  if (!bus || !ctx) return;
  if (typeof bus.gain.setTargetAtTime === 'function') {
    bus.gain.setTargetAtTime(v, ctx.currentTime, 0.02); // click-free
  } else {
    bus.gain.value = v;
  }
}

// Create/resume the shared AudioContext and the music/SFX buses. Call from a
// user gesture (tap/click). Returns true once audio is available, false in
// environments without Web Audio (e.g. Node tests).
export function initAudio() {
  const c = getAudioContext();
  if (!c) return false;
  if (c !== ctx) {
    // Fresh or re-created context — old buses (if any) are dead with it.
    ctx = c;
    musicBus = null;
    sfxBus = null;
  }
  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    const p = ctx.resume();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  if (!musicBus) {
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume;
    musicBus.connect(ctx.destination);
  }
  if (!sfxBus) {
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(ctx.destination);
  }
  if (pendingMusic) {
    const name = pendingMusic;
    pendingMusic = null;
    playMusic(name);
  }
  return true;
}

// True once the context exists and is running (after init + autoplay unlock).
export function isReady() {
  return !!ctx && ctx.state === 'running';
}

// Start a looping theme ('explore' | 'boss' | 'town' | 'victory'), stopping
// whatever played before. Re-requesting the currently playing track is a
// no-op. Before initAudio() the request is queued and starts after init.
// Returns true if the track is playing (or already was), false otherwise.
export function playMusic(name) {
  const track = TRACKS[name];
  if (!track) return false;
  if (!ctx || !musicBus) {
    pendingMusic = name;
    return false;
  }
  if (current && current.name === name && current.handles.some((h) => h.playing)) {
    return true;
  }
  stopMusic();
  const handles = track.voices.map((voice) => playSequence(ctx, voice.steps, {
    bpm: track.bpm,
    loop: track.loop !== false,
    type: voice.type,
    gain: voice.gain,
    destination: musicBus,
  }));
  current = { name, handles };
  return true;
}

// Stop the current music (click-free fade) and clear any queued request.
export function stopMusic() {
  pendingMusic = null;
  if (!current) return;
  for (const h of current.handles) {
    try { h.stop(); } catch { /* already stopped */ }
  }
  current = null;
}

// Fire a one-shot effect by name (see SFX_NAMES). `opts` is passed through —
// e.g. playSfx('loot', { rarity: 'orange' }). Returns true if it played.
export function playSfx(name, opts = {}) {
  const fx = SFX[name];
  if (typeof fx !== 'function') return false;
  if (!ctx || !sfxBus) return false;
  fx(ctx, sfxBus, opts);
  return true;
}

// Music volume 0..1 (clamped). Safe to call before initAudio().
export function setMusicVolume(v) {
  musicVolume = clamp01(v);
  setBusGain(musicBus, musicVolume);
}

export function getMusicVolume() {
  return musicVolume;
}

// SFX volume 0..1 (clamped). Safe to call before initAudio().
export function setSfxVolume(v) {
  sfxVolume = clamp01(v);
  setBusGain(sfxBus, sfxVolume);
}

export function getSfxVolume() {
  return sfxVolume;
}

// Re-exported for consumers (settings UI, tests).
export { TRACK_NAMES, SFX_NAMES };
