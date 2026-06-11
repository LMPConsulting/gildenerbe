import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import {
  emptyBoard,
  boardFromPieces,
  applyMove,
  pseudoMoves,
  legalMoves,
  allLegalMoves,
  attacks,
  inCheck,
  isCheckmate,
  isStalemate,
  solveMate,
  generatePuzzle,
  applyBlackBestDefense,
  PUZZLE_LIBRARY,
} from '../../src/systems/chessPuzzle.js';

const W = (type) => ({ type, white: true });
const B = (type) => ({ type, white: false });
const put = (board, x, y, piece) => {
  board[y][x] = piece;
  return board;
};
const keys = (moves) => moves.map(({ x, y }) => `${x},${y}`).sort();
const snapshot = (board) => JSON.stringify(board);

describe('chessPuzzle pseudoMoves', () => {
  it('knight jumps from the centre (8) and the corner (2)', () => {
    const b = put(emptyBoard(), 4, 4, W('N'));
    expect(pseudoMoves(b, 4, 4).length).toBe(8);
    const c = put(emptyBoard(), 0, 0, B('N'));
    expect(keys(pseudoMoves(c, 0, 0))).toEqual(['1,2', '2,1']);
  });

  it('rook slides, stops before own piece, captures enemy', () => {
    const b = emptyBoard();
    put(b, 3, 3, W('R'));
    put(b, 3, 1, W('P')); // eigene Figur blockt
    put(b, 6, 3, B('P')); // Gegner schlagbar
    const moves = keys(pseudoMoves(b, 3, 3));
    expect(moves).toContain('3,2'); // bis vor den eigenen Bauern
    expect(moves).not.toContain('3,1'); // eigenes Feld nicht
    expect(moves).not.toContain('3,0'); // nicht hindurch
    expect(moves).toContain('6,3'); // Schlag
    expect(moves).not.toContain('7,3'); // nicht über den Gegner hinweg
  });

  it('bishop and queen ray geometry', () => {
    const b = put(emptyBoard(), 4, 4, W('B'));
    const bm = keys(pseudoMoves(b, 4, 4));
    expect(bm).toContain('7,7');
    expect(bm).toContain('0,0');
    expect(bm).not.toContain('4,0'); // Läufer zieht nie gerade

    const q = put(emptyBoard(), 4, 4, W('Q'));
    expect(pseudoMoves(q, 4, 4).length).toBe(27); // 8 Richtungen, leeres Brett
  });

  it('king moves one step in all directions', () => {
    const b = put(emptyBoard(), 4, 4, W('K'));
    expect(pseudoMoves(b, 4, 4).length).toBe(8);
    const c = put(emptyBoard(), 7, 7, W('K'));
    expect(pseudoMoves(c, 7, 7).length).toBe(3);
  });

  it('white pawn: single + double from start, captures diagonally only', () => {
    const b = put(emptyBoard(), 4, 6, W('P')); // e2
    expect(keys(pseudoMoves(b, 4, 6))).toEqual(['4,4', '4,5']);

    const blocked = put(put(emptyBoard(), 4, 6, W('P')), 4, 5, B('P'));
    expect(pseudoMoves(blocked, 4, 6).length).toBe(0); // geradeaus kein Schlag

    const cap = emptyBoard();
    put(cap, 4, 4, W('P'));
    put(cap, 3, 3, B('N'));
    put(cap, 5, 3, W('N')); // eigene Figur nicht schlagbar
    expect(keys(pseudoMoves(cap, 4, 4))).toEqual(['3,3', '4,3']);
  });

  it('black pawn moves down (+y) with double step from y=1', () => {
    const b = put(emptyBoard(), 2, 1, B('P')); // c7
    expect(keys(pseudoMoves(b, 2, 1))).toEqual(['2,2', '2,3']);
    const mid = put(emptyBoard(), 2, 3, B('P'));
    expect(keys(pseudoMoves(mid, 2, 3))).toEqual(['2,4']);
  });
});

describe('chessPuzzle attacks/inCheck', () => {
  it('pawn attack squares differ from its move squares', () => {
    const b = put(emptyBoard(), 4, 4, W('P'));
    expect(attacks(b, 3, 3, true)).toBe(true);
    expect(attacks(b, 5, 3, true)).toBe(true);
    expect(attacks(b, 4, 3, true)).toBe(false); // Zugfeld, kein Angriffsfeld
  });

  it('sliding attacks are blocked by any piece', () => {
    const b = emptyBoard();
    put(b, 0, 0, B('R'));
    put(b, 0, 4, W('P'));
    expect(attacks(b, 0, 2, false)).toBe(true);
    expect(attacks(b, 0, 4, false)).toBe(true); // Blocker selbst angegriffen
    expect(attacks(b, 0, 6, false)).toBe(false); // dahinter nicht
  });

  it('inCheck detects a rook check and its absence', () => {
    const b = emptyBoard();
    put(b, 4, 7, W('K'));
    put(b, 4, 0, B('R'));
    expect(inCheck(b, true)).toBe(true);
    put(b, 4, 4, B('N')); // eigener (schwarzer) Springer blockt die Linie
    expect(inCheck(b, true)).toBe(false);
  });
});

describe('chessPuzzle legalMoves (Selbstschach verboten)', () => {
  it('a pinned rook may only move along the pin line', () => {
    const b = emptyBoard();
    put(b, 4, 7, W('K')); // Ke1
    put(b, 4, 4, W('R')); // Re4 gefesselt von
    put(b, 4, 0, B('R')); // Te8
    put(b, 0, 0, B('K'));
    const moves = legalMoves(b, 4, 4);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.x === 4)).toBe(true); // nur auf der e-Linie
    expect(keys(moves)).toContain('4,0'); // Fesselnden schlagen ist erlaubt
  });

  it('a pinned bishop has zero legal moves', () => {
    const b = emptyBoard();
    put(b, 4, 7, W('K'));
    put(b, 4, 4, W('B'));
    put(b, 4, 0, B('R'));
    put(b, 0, 0, B('K'));
    expect(legalMoves(b, 4, 4).length).toBe(0);
  });

  it('the king may not step onto an attacked square', () => {
    const b = emptyBoard();
    put(b, 4, 7, W('K'));
    put(b, 3, 0, B('R')); // d-Linie gesperrt
    put(b, 7, 0, B('K'));
    const moves = keys(legalMoves(b, 4, 7));
    expect(moves).not.toContain('3,7');
    expect(moves).not.toContain('3,6');
    expect(moves).toContain('5,7');
  });
});

describe('chessPuzzle isCheckmate/isStalemate', () => {
  it('recognises the back-rank mate as checkmate for black', () => {
    const base = boardFromPieces(PUZZLE_LIBRARY[1][0].pieces); // Grundreihenmatt
    const mated = applyMove(base, { x: 4, y: 7 }, { x: 4, y: 0 }); // Te1-e8#
    expect(isCheckmate(mated, false)).toBe(true);
    expect(isCheckmate(mated, true)).toBe(false);
  });

  it('is false before the mating move', () => {
    const base = boardFromPieces(PUZZLE_LIBRARY[1][0].pieces);
    expect(isCheckmate(base, false)).toBe(false);
    expect(isCheckmate(base, true)).toBe(false);
  });

  it('detects stalemate (no moves, no check)', () => {
    const b = emptyBoard();
    put(b, 0, 0, B('K')); // Ka8
    put(b, 2, 1, W('K')); // Kc7 deckt b8/b7
    put(b, 1, 2, W('Q')); // Db6 deckt a7/b7/b8 — a8 selbst nicht
    expect(inCheck(b, false)).toBe(false);
    expect(isStalemate(b, false)).toBe(true);
    expect(isCheckmate(b, false)).toBe(false);
  });
});

describe('chessPuzzle applyMove immutability', () => {
  it('returns a new board and leaves the original untouched', () => {
    const b = boardFromPieces(PUZZLE_LIBRARY[1][0].pieces);
    const before = snapshot(b);
    const after = applyMove(b, { x: 4, y: 7 }, { x: 4, y: 0 });
    expect(snapshot(b)).toBe(before);
    expect(after).not.toBe(b);
    expect(after[0][4]).toEqual({ type: 'R', white: true });
    expect(after[7][4]).toBe(null);
  });
});

describe('chessPuzzle library verification', () => {
  it('contains at least 10 mate-in-1 and 8 mate-in-2 positions', () => {
    expect(PUZZLE_LIBRARY[1].length).toBeGreaterThanOrEqual(10);
    expect(PUZZLE_LIBRARY[2].length).toBeGreaterThanOrEqual(8);
  });

  for (const movesToWin of [1, 2]) {
    for (const cand of PUZZLE_LIBRARY[movesToWin]) {
      it(`"${cand.name}" is mate in exactly ${movesToWin}`, () => {
        const board = boardFromPieces(cand.pieces);
        expect(inCheck(board, false)).toBe(false); // Schwarz nicht schon im Schach
        expect(inCheck(board, true)).toBe(false); // Weiß auch nicht
        const sol = solveMate(board, movesToWin);
        expect(sol).not.toBe(null);
        expect(solveMate(board, movesToWin - 1)).toBe(null); // nicht schneller
        if (movesToWin === 1) {
          expect(isCheckmate(applyMove(board, sol.from, sol.to), false)).toBe(true);
        }
      });
    }
  }

  it('mate-in-2 solutions survive the toughest black defense', () => {
    for (const cand of PUZZLE_LIBRARY[2]) {
      const board = boardFromPieces(cand.pieces);
      const first = solveMate(board, 2);
      let b = applyMove(board, first.from, first.to);
      if (isCheckmate(b, false)) continue; // schneller geht es nicht — abgedeckt oben
      const reply = applyBlackBestDefense(b, makeRng(99));
      expect(reply).not.toBe(null);
      b = applyMove(b, reply.from, reply.to);
      const second = solveMate(b, 1);
      expect(second).not.toBe(null);
      expect(isCheckmate(applyMove(b, second.from, second.to), false)).toBe(true);
    }
  });
});

describe('chessPuzzle generatePuzzle', () => {
  it('returns a verified puzzle shape for both difficulties', () => {
    for (const movesToWin of [1, 2]) {
      const p = generatePuzzle(makeRng(5), { movesToWin });
      expect(p.white).toBe(true);
      expect(p.movesToWin).toBe(movesToWin);
      expect(p.board.length).toBe(8);
      expect(solveMate(p.board, movesToWin)).not.toBe(null);
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = generatePuzzle(makeRng(7), { movesToWin: 1 });
    const b = generatePuzzle(makeRng(7), { movesToWin: 1 });
    expect(snapshot(a.board)).toBe(snapshot(b.board));
    const names = new Set();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      names.add(generatePuzzle(makeRng(seed), { movesToWin: 1 }).name);
    }
    expect(names.size).toBeGreaterThan(1);
  });
});

describe('chessPuzzle applyBlackBestDefense', () => {
  it('returns a legal move and is deterministic per seed', () => {
    const p = generatePuzzle(makeRng(3), { movesToWin: 2 });
    const first = solveMate(p.board, 2);
    const afterWhite = applyMove(p.board, first.from, first.to);
    const r1 = applyBlackBestDefense(afterWhite, makeRng(8));
    const r2 = applyBlackBestDefense(afterWhite, makeRng(8));
    expect(r1).toEqual(r2);
    const legal = allLegalMoves(afterWhite, false).map((m) => JSON.stringify(m));
    expect(legal).toContain(JSON.stringify(r1));
  });

  it('returns null when black has no legal reply', () => {
    const base = boardFromPieces(PUZZLE_LIBRARY[1][0].pieces);
    const mated = applyMove(base, { x: 4, y: 7 }, { x: 4, y: 0 });
    expect(applyBlackBestDefense(mated, makeRng(1))).toBe(null);
  });
});
