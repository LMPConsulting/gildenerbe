import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import {
  generatePuzzle, validate, isComplete, canExtend, cellAt, isConnected,
  solutionPathCount, DIFFICULTY,
} from '../../src/systems/runePuzzle.js';

// Hand-built 3×3 fixture: three vertical pairs (left/middle/right column).
const handPuzzle = () => ({
  size: 3,
  pairs: 3,
  endpoints: [
    { idx: 0, a: { x: 0, y: 0 }, b: { x: 0, y: 2 } },
    { idx: 1, a: { x: 1, y: 0 }, b: { x: 1, y: 2 } },
    { idx: 2, a: { x: 2, y: 0 }, b: { x: 2, y: 2 } },
  ],
});
const columns = () => [
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
  [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
];

describe('runePuzzle generation', () => {
  it('produces fully-tiled, non-crossing, solvable boards across seeds and difficulties', () => {
    for (const d of [1, 2, 3]) {
      const { size, pairs } = DIFFICULTY[d];
      for (let seed = 1; seed <= 10; seed++) {
        const p = generatePuzzle(makeRng(seed * 13 + d), { difficulty: d });
        expect(p.size).toBe(size);
        expect(p.endpoints.length).toBe(pairs);
        expect(solutionPathCount(p)).toBe(pairs);
        const used = new Set();
        for (const path of p.solution) {
          expect(path.length).toBeGreaterThanOrEqual(3);
          for (const c of path) {
            const k = `${c.x},${c.y}`;
            expect(used.has(k)).toBe(false); // no overlap between carved paths
            used.add(k);
          }
        }
        expect(used.size).toBe(size * size); // perfect tiling
        expect(validate(p, p.solution)).toBe(true);
        expect(isComplete(p, p.solution)).toBe(true);
      }
    }
  });

  it('supports legacy { size, pairs } opts (main.js challenge calls)', () => {
    const p5 = generatePuzzle(makeRng(2), { size: 5, pairs: 3 });
    expect(p5.size).toBe(5);
    expect(p5.endpoints.length).toBe(3);
    expect(validate(p5, p5.solution)).toBe(true);
    const p6 = generatePuzzle(makeRng(2), { size: 6, pairs: 4 });
    expect(p6.size).toBe(6);
    expect(p6.endpoints.length).toBe(4);
    expect(validate(p6, p6.solution)).toBe(true);
  });

  it('clamps an absurd pair count to what fits the board', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 99 });
    expect(p.endpoints.length).toBeLessThanOrEqual(Math.floor(25 / 3));
    expect(validate(p, p.solution)).toBe(true);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const a1 = generatePuzzle(makeRng(42), { difficulty: 2 });
    const a2 = generatePuzzle(makeRng(42), { difficulty: 2 });
    const b = generatePuzzle(makeRng(43), { difficulty: 2 });
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
    expect(JSON.stringify(a1)).not.toBe(JSON.stringify(b));
  });
});

describe('validate / isComplete', () => {
  it('accepts a correct full-coverage solution', () => {
    expect(validate(handPuzzle(), columns())).toBe(true);
  });

  it('rejects a crossing state (cell used by two paths)', () => {
    const paths = columns();
    // path0 detours through (0,1)→(1,1) territory of path1
    paths[0] = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }];
    expect(validate(handPuzzle(), paths)).toBe(false);
  });

  it('rejects an incomplete state (a pair not connected)', () => {
    const paths = columns();
    paths[1] = [{ x: 1, y: 0 }, { x: 1, y: 1 }]; // stops short of (1,2)
    expect(validate(handPuzzle(), paths)).toBe(false);
  });

  it('rejects connected-but-uncovered boards (coverage rule)', () => {
    const p = {
      size: 3,
      pairs: 2,
      endpoints: [
        { idx: 0, a: { x: 0, y: 0 }, b: { x: 0, y: 2 } },
        { idx: 1, a: { x: 2, y: 0 }, b: { x: 2, y: 2 } },
      ],
    };
    const paths = [
      [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
      [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
    ]; // middle column untouched
    expect(validate(p, paths)).toBe(false);
  });

  it('rejects non-adjacent steps and wrong path counts', () => {
    const paths = columns();
    paths[2] = [{ x: 2, y: 0 }, { x: 2, y: 2 }]; // jumps 2 cells
    expect(validate(handPuzzle(), paths)).toBe(false);
    expect(validate(handPuzzle(), columns().slice(0, 2))).toBe(false);
  });

  it('accepts a path drawn in reverse (b → a)', () => {
    const paths = columns();
    paths[0] = [...paths[0]].reverse();
    expect(validate(handPuzzle(), paths)).toBe(true);
  });
});

describe('drag helpers', () => {
  it('cellAt reports runes, plain cells and out-of-bounds', () => {
    const p = handPuzzle();
    expect(cellAt(p, 0, 0).endpoint).toBe(0);
    expect(cellAt(p, 1, 2).endpoint).toBe(1);
    expect(cellAt(p, 1, 1).endpoint).toBe(-1);
    expect(cellAt(p, 3, 0)).toBe(null);
    expect(cellAt(p, -1, 0)).toBe(null);
  });

  it('canExtend allows adjacent free cells only', () => {
    const p = handPuzzle();
    const paths = [[{ x: 0, y: 0 }], [], []];
    expect(canExtend(p, paths, 0, { x: 0, y: 1 })).toBe(true);   // free, adjacent
    expect(canExtend(p, paths, 0, { x: 1, y: 1 })).toBe(false);  // not adjacent (diagonal)
    expect(canExtend(p, paths, 0, { x: 1, y: 0 })).toBe(false);  // foreign rune is a wall
    expect(canExtend(p, paths, 0, { x: -1, y: 0 })).toBe(false); // out of bounds
    expect(canExtend(p, paths, 0, { x: 0, y: 0 })).toBe(false);  // already used (own)
    const longer = [[{ x: 0, y: 0 }, { x: 0, y: 1 }], [], []];
    expect(canExtend(p, longer, 0, { x: 0, y: 2 })).toBe(true);  // own matching rune, adjacent to head
  });

  it('canExtend blocks cells used by another path and finished paths', () => {
    const p = handPuzzle();
    const paths = [[{ x: 0, y: 0 }, { x: 0, y: 1 }], [{ x: 1, y: 0 }, { x: 1, y: 1 }], []];
    expect(canExtend(p, paths, 1, { x: 0, y: 1 })).toBe(false); // taken by path0
    const done = [columns()[0], [{ x: 1, y: 0 }], []];
    expect(isConnected(p, done, 0)).toBe(true);
    expect(canExtend(p, done, 0, { x: 1, y: 2 })).toBe(false);  // finished paths are frozen
  });

  it('canExtend handles empty/missing paths gracefully', () => {
    const p = handPuzzle();
    expect(canExtend(p, [[], [], []], 0, { x: 0, y: 1 })).toBe(false);
    expect(canExtend(p, [[{ x: 0, y: 0 }], [], []], 0, null)).toBe(false);
  });
});
