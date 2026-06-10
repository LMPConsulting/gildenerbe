import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { createCast } from '../../src/systems/fishing.js';

describe('fishing cast', () => {
  it('bites after a delay, opens a window, and a tap inside it catches a fish', () => {
    const c = createCast(makeRng(1));
    c.step(c.biteDelayMs);
    expect(c.state).toBe('window');
    const fish = c.tap();
    expect(c.state).toBe('caught');
    expect(fish).toBeTruthy();
    expect(fish.id).toBeTruthy();
  });
  it('a tap before the bite fails the cast', () => {
    const c = createCast(makeRng(1));
    c.step(10);
    expect(c.tap()).toBeNull();
    expect(c.state).toBe('failed');
  });
  it('letting the window expire fails the cast', () => {
    const c = createCast(makeRng(1));
    c.step(c.biteDelayMs + c.windowMs + 1);
    expect(c.state).toBe('failed');
  });
});
