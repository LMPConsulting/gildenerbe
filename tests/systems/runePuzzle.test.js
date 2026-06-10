import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { generatePuzzle, validate } from '../../src/systems/runePuzzle.js';

describe('rune puzzle', () => {
  it('generates a puzzle whose own carved paths are a valid solution', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    expect(p.endpoints.length).toBe(3);
    expect(validate(p, p.solution)).toBe(true);
  });
  it('rejects disconnected (single-cell) paths', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    const broken = p.solution.map((path) => path.slice(0, 1));
    expect(validate(p, broken)).toBe(false);
  });
  it('rejects the wrong number of paths', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    expect(validate(p, p.solution.slice(0, 1))).toBe(false); // only 1 of 3
  });
  it('rejects a non-adjacent step within a path', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    const bad = p.solution.map((path) => path.map((c) => ({ ...c })));
    const path = bad[0];
    if (path.length >= 2) path[1] = { x: (path[0].x + 2) % p.size, y: path[0].y }; // 2 away -> not adjacent
    expect(validate(p, bad)).toBe(false);
  });
});
