import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { generateSudoku, validate, countSolutions, boxDims } from '../../src/systems/sudoku.js';

const seeds = [1, 2, 3, 4, 5];
const blank = (size) => Array.from({ length: size }, () => Array(size).fill(null));

describe('sudoku generateSudoku', () => {
  for (const { size, holes } of [{ size: 4, holes: 8 }, { size: 6, holes: 14 }]) {
    it(`size ${size}: unique solution across seeds`, () => {
      for (const seed of seeds) {
        const g = generateSudoku(makeRng(seed), { size, holes });
        expect(g.size).toBe(size);
        expect(validate(g.solution, size)).toBe(true);

        // Puzzle = Lösung mit genau `holes` genullten Zellen.
        let nulls = 0;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (g.puzzle[r][c] === null) nulls++;
            else expect(g.puzzle[r][c]).toBe(g.solution[r][c]);
          }
        }
        expect(nulls).toBe(holes);

        // Eindeutigkeit: exakt eine Lösung.
        expect(countSolutions(g.puzzle, size, 2)).toBe(1);
      }
    });
  }

  it('is deterministic for a given seed', () => {
    const a = generateSudoku(makeRng(7), { size: 6, holes: 12 });
    const b = generateSudoku(makeRng(7), { size: 6, holes: 12 });
    expect(a).toEqual(b);
  });

  it('rejects unsupported sizes', () => {
    expect(() => generateSudoku(makeRng(1), { size: 9 })).toThrow();
  });
});

describe('sudoku validate', () => {
  for (const size of [4, 6]) {
    it(`size ${size}: accepts the generated solution and rejects tampering`, () => {
      const g = generateSudoku(makeRng(3), { size, holes: size === 4 ? 6 : 10 });
      expect(validate(g.solution, size)).toBe(true);

      const dup = g.solution.map((r) => r.slice());
      dup[0][0] = dup[0][1]; // Duplikat in Zeile (und ggf. Box)
      expect(validate(dup, size)).toBe(false);

      const incomplete = g.solution.map((r) => r.slice());
      incomplete[0][0] = null;
      expect(validate(incomplete, size)).toBe(false);

      const outOfRange = g.solution.map((r) => r.slice());
      outOfRange[1][1] = size + 1;
      expect(validate(outOfRange, size)).toBe(false);
    });
  }

  it('rejects a column duplicate even when rows stay valid', () => {
    const g = generateSudoku(makeRng(11), { size: 4, holes: 4 });
    const bad = g.solution.map((r) => r.slice());
    [bad[2][0], bad[2][1]] = [bad[2][1], bad[2][0]]; // Zeile 2 bleibt eine Permutation, Spalten brechen
    expect(validate(bad, 4)).toBe(false);
  });
});

describe('sudoku countSolutions', () => {
  it('caps counting (blank grids have many solutions)', () => {
    expect(countSolutions(blank(4), 4, 2)).toBe(2);
    expect(countSolutions(blank(4), 4, 5)).toBe(5);
    expect(countSolutions(blank(6), 6, 2)).toBe(2);
  });

  it('a full valid grid has exactly one solution; a contradictory grid has none', () => {
    const g = generateSudoku(makeRng(2), { size: 4, holes: 0 });
    expect(countSolutions(g.solution, 4)).toBe(1);
    const broken = g.puzzle.map((r) => r.slice());
    broken[0][0] = broken[0][1]; // direkte Regelverletzung unter den Vorgaben
    // Hinweis: countSolutions füllt nur leere Zellen — bei holes:0 gibt es keine.
    expect(countSolutions(broken, 4)).toBe(0);
  });
});

describe('sudoku boxDims', () => {
  it('returns 2x2 boxes for size 4 and 2 rows x 3 cols for size 6', () => {
    expect(boxDims(4)).toEqual({ w: 2, h: 2 });
    expect(boxDims(6)).toEqual({ w: 3, h: 2 });
    expect(() => boxDims(5)).toThrow();
  });
});
