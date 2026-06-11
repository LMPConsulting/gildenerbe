import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { generateSudoku, validate, countSolutions, boxOf, SIZE } from '../../src/systems/sudoku.js';

const seeds = [1, 2, 3, 4, 5];
const countHoles = (puzzle) => puzzle.flat().filter((v) => v === null).length;

describe('sudoku boxOf', () => {
  it('maps cells to their 3x3 box index', () => {
    expect(boxOf(0, 0)).toBe(0);
    expect(boxOf(0, 8)).toBe(2);
    expect(boxOf(4, 4)).toBe(4);
    expect(boxOf(5, 3)).toBe(4);
    expect(boxOf(8, 0)).toBe(6);
    expect(boxOf(8, 8)).toBe(8);
  });
});

describe('sudoku generateSudoku', () => {
  it('produces 9x9 puzzles with a unique solution across seeds', () => {
    for (const seed of seeds) {
      const g = generateSudoku(makeRng(seed));
      expect(g.size).toBe(9);
      expect(g.puzzle.length).toBe(9);
      expect(g.puzzle.every((row) => row.length === 9)).toBe(true);
      expect(validate(g.solution)).toBe(true);
      expect(countSolutions(g.puzzle, 2)).toBe(1);
    }
  });

  it('puzzle is a subset of the solution with exactly `holes` empty cells', () => {
    for (const seed of seeds) {
      const g = generateSudoku(makeRng(seed), { holes: 45 });
      expect(countHoles(g.puzzle)).toBe(45);
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (g.puzzle[r][c] !== null) expect(g.puzzle[r][c]).toBe(g.solution[r][c]);
        }
      }
    }
  });

  it('honours a custom (even) hole count', () => {
    const g = generateSudoku(makeRng(7), { holes: 40 });
    expect(countHoles(g.puzzle)).toBe(40);
    expect(countSolutions(g.puzzle, 2)).toBe(1);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const a = generateSudoku(makeRng(42));
    const b = generateSudoku(makeRng(42));
    const c = generateSudoku(makeRng(43));
    expect(JSON.stringify(a.puzzle)).toBe(JSON.stringify(b.puzzle));
    expect(JSON.stringify(a.solution)).toBe(JSON.stringify(b.solution));
    expect(JSON.stringify(a.puzzle)).not.toBe(JSON.stringify(c.puzzle));
  });
});

describe('sudoku validate', () => {
  it('accepts a generated solution', () => {
    const g = generateSudoku(makeRng(11));
    expect(validate(g.solution)).toBe(true);
  });

  it('rejects a tampered solution (duplicate in row/col/box)', () => {
    const g = generateSudoku(makeRng(12));
    const bad = g.solution.map((row) => row.slice());
    // Erzeuge garantiert ein Duplikat in Zeile 0.
    bad[0][0] = bad[0][1];
    expect(validate(bad)).toBe(false);
  });

  it('rejects incomplete grids and out-of-range values', () => {
    const g = generateSudoku(makeRng(13));
    const withHole = g.solution.map((row) => row.slice());
    withHole[3][5] = null;
    expect(validate(withHole)).toBe(false);

    const outOfRange = g.solution.map((row) => row.slice());
    outOfRange[2][2] = 0;
    expect(validate(outOfRange)).toBe(false);
    outOfRange[2][2] = 10;
    expect(validate(outOfRange)).toBe(false);

    expect(validate(null)).toBe(false);
    expect(validate([])).toBe(false);
  });
});

describe('sudoku countSolutions', () => {
  it('counts a fully solved grid as exactly one solution', () => {
    const g = generateSudoku(makeRng(21));
    expect(countSolutions(g.solution, 2)).toBe(1);
  });

  it('reports multiple solutions for an empty grid (capped)', () => {
    const empty = Array.from({ length: 9 }, () => Array(9).fill(null));
    expect(countSolutions(empty, 2)).toBe(2);
  });

  it('reports zero solutions for a contradictory grid', () => {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(null));
    grid[0][0] = 5;
    grid[0][1] = 5; // gleiche Zeile -> unlösbar
    expect(countSolutions(grid, 2)).toBe(0);
  });
});
