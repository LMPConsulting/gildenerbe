import { describe, it, expect } from 'vitest';
import { makeBag, addMat, hasMats, consumeMats } from '../../src/systems/materials.js';

describe('materials bag', () => {
  it('adds and reports materials', () => {
    const b = makeBag();
    addMat(b, 'kupfererz', 3);
    addMat(b, 'kupfererz', 2);
    expect(b.kupfererz).toBe(5);
  });
  it('hasMats / consumeMats respect a cost', () => {
    const b = makeBag();
    addMat(b, 'kupfererz', 4);
    expect(hasMats(b, { kupfererz: 5 })).toBe(false);
    expect(hasMats(b, { kupfererz: 3 })).toBe(true);
    expect(consumeMats(b, { kupfererz: 3 })).toBe(true);
    expect(b.kupfererz).toBe(1);
    expect(consumeMats(b, { kupfererz: 5 })).toBe(false); // unchanged on failure
    expect(b.kupfererz).toBe(1);
  });
});
