import { describe, it, expect } from 'vitest';
// Importing must not throw in Node (no AudioContext) — that IS the first test.
import {
  initAudio, isReady, playMusic, stopMusic, playSfx,
  setMusicVolume, setSfxVolume, TRACK_NAMES, SFX_NAMES,
} from '../../src/audio/index.js';
import { TRACKS } from '../../src/audio/tracks.js';

describe('audio API (node-safe)', () => {
  it('exposes the public functions', () => {
    for (const fn of [initAudio, isReady, playMusic, stopMusic, playSfx, setMusicVolume, setSfxVolume]) {
      expect(typeof fn).toBe('function');
    }
  });
  it('degrades to no-ops without Web Audio', () => {
    expect(initAudio()).toBe(false);
    expect(isReady()).toBe(false);
    expect(playSfx('hit')).toBe(false);
    expect(() => { setMusicVolume(0.5); setSfxVolume(2); stopMusic(); }).not.toThrow();
  });
});

describe('tracks', () => {
  it('includes the four themes', () => {
    for (const name of ['explore', 'boss', 'town', 'victory']) expect(TRACK_NAMES).toContain(name);
  });
  it('every track has voices with non-empty, well-formed [note,beats] steps and a bpm', () => {
    for (const name of TRACK_NAMES) {
      const t = TRACKS[name];
      expect(t.bpm).toBeGreaterThan(0);
      expect(t.voices.length).toBeGreaterThan(0);
      for (const v of t.voices) {
        expect(v.steps.length).toBeGreaterThan(0);
        for (const [note, beats] of v.steps) {
          expect(typeof beats).toBe('number');
          expect(beats).toBeGreaterThan(0);
          if (note !== null) expect(note).toMatch(/^[A-G]#?\d$/); // 'C4'-style or rest
        }
      }
    }
  });
  it("voices of a track stay loop-locked (equal total beats)", () => {
    for (const name of TRACK_NAMES) {
      const totals = TRACKS[name].voices.map((v) => v.steps.reduce((s, [, b]) => s + b, 0));
      for (const total of totals) expect(total).toBeCloseTo(totals[0], 5);
    }
  });
});

describe('sfx', () => {
  it('exposes the expected effect names', () => {
    for (const name of ['hit', 'crit', 'block', 'levelUp', 'loot', 'coin', 'click', 'fishSplash', 'puzzleSolve']) {
      expect(SFX_NAMES).toContain(name);
    }
  });
});
