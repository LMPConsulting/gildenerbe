import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { PIECES, SIZE, legalMoves, applyMove, isWon, solve, generatePuzzle } from '../../src/systems/chessPuzzle.js';

const empty = () => Array.from({ length: 5 }, () => Array(5).fill(null));
const W = (type) => ({ type, white: true });
const B = (type) => ({ type, white: false });
// Brett ist board[y][x] — Helfer nimmt (x, y) wie legalMoves.
const put = (board, x, y, piece) => { board[y][x] = piece; return board; };
const keys = (moves) => moves.map(({ x, y }) => `${x},${y}`).sort();

describe('chessPuzzle legalMoves', () => {
  it('exposes move logic for all six piece types', () => {
    for (const t of ['K', 'Q', 'R', 'B', 'N', 'P']) expect(typeof PIECES[t].moves).toBe('function');
    expect(SIZE).toBe(5);
  });

  it('king steps to all 8 neighbours but never onto own pieces', () => {
    const b = put(empty(), 2, 2, W('K'));
    expect(legalMoves(b, 2, 2)).toHaveLength(8);
    put(b, 2, 1, W('P'));
    put(b, 3, 3, B('N'));
    const m = keys(legalMoves(b, 2, 2));
    expect(m).toHaveLength(7);
    expect(m).not.toContain('2,1'); // eigenes Feld blockiert
    expect(m).toContain('3,3'); // Gegner schlagbar
  });

  it('queen slides 16 squares from the centre of an empty 5x5 board', () => {
    const b = put(empty(), 2, 2, W('Q'));
    expect(legalMoves(b, 2, 2)).toHaveLength(16);
  });

  it('rook is blocked by own pieces and stops on captured enemies', () => {
    const b = put(empty(), 0, 0, W('R'));
    put(b, 0, 2, W('P')); // eigener Bauer auf der Linie
    put(b, 2, 0, B('N')); // Gegner auf der Reihe
    expect(keys(legalMoves(b, 0, 0))).toEqual(['0,1', '1,0', '2,0']);
  });

  it('bishop captures the first enemy on a diagonal and cannot pass it', () => {
    const b = put(empty(), 2, 2, W('B'));
    put(b, 1, 1, B('N')); // schlagbar, dahinter (0,0) gesperrt
    put(b, 3, 3, W('P')); // eigene Figur sperrt (3,3) und (4,4)
    expect(keys(legalMoves(b, 2, 2))).toEqual(['0,4', '1,1', '1,3', '3,1', '4,0']);
  });

  it('knight jumps over blockers', () => {
    const b = put(empty(), 0, 0, W('N'));
    put(b, 0, 1, W('P'));
    put(b, 1, 0, W('P'));
    put(b, 1, 1, B('B'));
    expect(keys(legalMoves(b, 0, 0))).toEqual(['1,2', '2,1']);
    put(b, 1, 2, W('P')); // Landefeld durch eigene Figur belegt
    expect(keys(legalMoves(b, 0, 0))).toEqual(['2,1']);
  });

  it('white pawn moves up (-y) and captures only diagonally up', () => {
    const b = put(empty(), 2, 3, W('P'));
    expect(keys(legalMoves(b, 2, 3))).toEqual(['2,2']);
    put(b, 1, 2, B('N'));
    put(b, 3, 2, B('B'));
    expect(keys(legalMoves(b, 2, 3))).toEqual(['1,2', '2,2', '3,2']);
  });

  it('pawn cannot capture straight ahead and is blocked by any piece in front', () => {
    const b = put(empty(), 2, 3, W('P'));
    put(b, 2, 2, B('N')); // Gegner direkt davor: weder ziehen noch schlagen
    expect(legalMoves(b, 2, 3)).toEqual([]);
    const b2 = put(empty(), 2, 3, W('P'));
    put(b2, 2, 2, W('N')); // eigene Figur blockiert ebenfalls
    expect(legalMoves(b2, 2, 3)).toEqual([]);
    const top = put(empty(), 2, 0, W('P')); // oberste Reihe: kein Zug (keine Umwandlung)
    expect(legalMoves(top, 2, 0)).toEqual([]);
  });

  it('black pawn mirrors the direction (+y)', () => {
    const b = put(empty(), 2, 1, B('P'));
    put(b, 1, 2, W('N'));
    expect(keys(legalMoves(b, 2, 1))).toEqual(['1,2', '2,2']);
  });

  it('returns [] for empty or out-of-bounds squares', () => {
    expect(legalMoves(empty(), 2, 2)).toEqual([]);
    expect(legalMoves(empty(), -1, 7)).toEqual([]);
  });
});

describe('chessPuzzle applyMove / isWon', () => {
  it('applyMove captures immutably', () => {
    const b = put(put(empty(), 0, 0, W('R')), 2, 0, B('N'));
    const next = applyMove(b, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(next[0][2]).toEqual(W('R')); // Turm steht auf dem Zielfeld
    expect(next[0][0]).toBeNull();
    expect(b[0][0]).toEqual(W('R')); // Original unverändert
    expect(b[0][2]).toEqual(B('N'));
  });

  it('isWon is true exactly when the black king is gone', () => {
    const b = put(put(empty(), 0, 0, B('K')), 0, 4, W('R'));
    expect(isWon(b)).toBe(false);
    expect(isWon(applyMove(b, { x: 0, y: 4 }, { x: 0, y: 0 }))).toBe(true);
    expect(isWon(empty())).toBe(true);
  });
});

describe('chessPuzzle solve', () => {
  it('finds a mate-in-1 capture', () => {
    const b = put(put(empty(), 0, 0, B('K')), 0, 4, W('R'));
    const seq = solve(b, 1);
    expect(seq).toHaveLength(1);
    expect(seq[0]).toEqual({ from: { x: 0, y: 4 }, to: { x: 0, y: 0 } });
  });

  it('returns null when the king cannot be captured within the limit', () => {
    const b = put(put(empty(), 0, 0, B('K')), 4, 4, W('N'));
    expect(solve(b, 1)).toBeNull();
  });

  it('returns [] for an already-won board', () => {
    expect(solve(put(empty(), 1, 1, W('Q')), 0)).toEqual([]);
  });
});

describe('chessPuzzle generatePuzzle', () => {
  const seeds = [1, 2, 3, 7, 11, 42];

  for (const movesToWin of [1, 2]) {
    it(`seeds produce puzzles solvable in exactly ${movesToWin} move(s)`, () => {
      for (const seed of seeds) {
        const p = generatePuzzle(makeRng(seed), { movesToWin });
        expect(p.white).toBe(true);
        expect(p.movesToWin).toBe(movesToWin);

        const seq = solve(p.board, movesToWin);
        expect(seq).not.toBeNull();
        expect(seq).toHaveLength(movesToWin);
        if (movesToWin > 1) expect(solve(p.board, movesToWin - 1)).toBeNull(); // nicht in weniger lösbar

        // Sequenz nachspielen: jeder Zug legal, am Ende ist der König geschlagen.
        let board = p.board;
        for (const mv of seq) {
          const piece = board[mv.from.y][mv.from.x];
          expect(piece && piece.white).toBe(true);
          expect(keys(legalMoves(board, mv.from.x, mv.from.y))).toContain(`${mv.to.x},${mv.to.y}`);
          board = applyMove(board, mv.from, mv.to);
        }
        expect(isWon(board)).toBe(true);
      }
    });
  }

  it('places exactly one black king, 0-2 black minors and 1-3 white pieces', () => {
    for (const seed of seeds) {
      const p = generatePuzzle(makeRng(seed), { movesToWin: 2 });
      const pieces = p.board.flat().filter(Boolean);
      const blackKings = pieces.filter((c) => c.type === 'K' && !c.white);
      const blackMinors = pieces.filter((c) => !c.white && c.type !== 'K');
      const whites = pieces.filter((c) => c.white);
      expect(blackKings).toHaveLength(1);
      expect(blackMinors.length).toBeGreaterThanOrEqual(0);
      expect(blackMinors.length).toBeLessThanOrEqual(2);
      expect(blackMinors.every((c) => c.type === 'N' || c.type === 'B')).toBe(true);
      expect(whites.length).toBeGreaterThanOrEqual(1);
      expect(whites.length).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generatePuzzle(makeRng(9), { movesToWin: 2 });
    const b = generatePuzzle(makeRng(9), { movesToWin: 2 });
    expect(a).toEqual(b);
  });
});
