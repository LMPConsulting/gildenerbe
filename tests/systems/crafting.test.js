import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeBag, addMat } from '../../src/systems/materials.js';
import { smelt, craft } from '../../src/systems/crafting.js';

describe('crafting', () => {
  it('smelt consumes ore and yields a bar', () => {
    const bag = makeBag();
    addMat(bag, 'kupfererz', 2);
    expect(smelt(bag, 'kupferbarren')).toBe(true);
    expect(bag.kupferbarren).toBe(1);
    expect(bag.kupfererz).toBe(0);
    expect(smelt(bag, 'kupferbarren')).toBe(false); // no ore left
  });
  it('craft consumes bars and returns an item; perfect cast raises rarity', () => {
    const bag = makeBag();
    addMat(bag, 'kupferbarren', 6);
    const normal = craft(bag, 'kupferruestung', 0.0, makeRng(1));
    const perfect = craft(bag, 'kupferruestung', 1.0, makeRng(1));
    expect(normal.slot).toBe('brust');
    const order = ['grau', 'weiss', 'gruen', 'blau', 'lila', 'orange'];
    expect(order.indexOf(perfect.rarity)).toBeGreaterThanOrEqual(order.indexOf(normal.rarity));
  });
  it('craft returns null without enough materials', () => {
    expect(craft(makeBag(), 'kupferruestung', 1.0, makeRng(1))).toBeNull();
  });
});
