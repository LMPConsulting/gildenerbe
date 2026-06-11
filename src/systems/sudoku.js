// Klassisches 9x9-Sudoku mit 3x3-Boxen. Gitter sind 2D-Arrays grid[row][col]
// mit Werten 1..9 oder null. Deterministisch über das übergebene rng
// (seeded Backtracking), DOM-frei. Erzeugte Rätsel haben garantiert genau
// eine Lösung (per Lösungszählung verifiziert).

export const SIZE = 9;

// Index der 3x3-Box (0..8) für eine Zelle.
export function boxOf(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function copyGrid(grid) {
  return grid.map((row) => row.slice());
}

// Erlaubte Werte für eine leere Zelle (Zeile/Spalte/Box geprüft).
function candidates(grid, r, c) {
  const used = new Set();
  for (let i = 0; i < SIZE; i++) {
    if (grid[r][i] !== null) used.add(grid[r][i]);
    if (grid[i][c] !== null) used.add(grid[i][c]);
  }
  const r0 = Math.floor(r / 3) * 3;
  const c0 = Math.floor(c / 3) * 3;
  for (let rr = r0; rr < r0 + 3; rr++) {
    for (let cc = c0; cc < c0 + 3; cc++) {
      if (grid[rr][cc] !== null) used.add(grid[rr][cc]);
    }
  }
  const out = [];
  for (let v = 1; v <= SIZE; v++) if (!used.has(v)) out.push(v);
  return out;
}

// Leere Zelle mit den wenigsten Kandidaten (MRV) — beschleunigt das Zählen.
function bestEmptyCell(grid) {
  let best = null;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null) continue;
      const cands = candidates(grid, r, c);
      if (!best || cands.length < best.cands.length) best = { r, c, cands };
      if (best.cands.length <= 1) return best;
    }
  }
  return best; // null = Gitter voll
}

// Füllt ein leeres Gitter per Backtracking mit seeded Kandidaten-Shuffle.
function fillFull(rng) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const solve = () => {
    const cell = bestEmptyCell(grid);
    if (!cell) return true;
    for (const v of shuffled(rng, cell.cands)) {
      grid[cell.r][cell.c] = v;
      if (solve()) return true;
      grid[cell.r][cell.c] = null;
    }
    return false;
  };
  solve();
  return grid;
}

// Stehen die Vorgaben selbst im Widerspruch (Duplikat in Zeile/Spalte/Box)?
function givensConsistent(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v === null) continue;
      for (let i = 0; i < SIZE; i++) {
        if (i !== c && grid[r][i] === v) return false;
        if (i !== r && grid[i][c] === v) return false;
      }
      const r0 = Math.floor(r / 3) * 3;
      const c0 = Math.floor(c / 3) * 3;
      for (let rr = r0; rr < r0 + 3; rr++) {
        for (let cc = c0; cc < c0 + 3; cc++) {
          if ((rr !== r || cc !== c) && grid[rr][cc] === v) return false;
        }
      }
    }
  }
  return true;
}

// Zählt Lösungen bis zur Kappe (Standard 2 — reicht für Eindeutigkeitstest).
export function countSolutions(puzzle, cap = 2) {
  const grid = copyGrid(puzzle);
  if (!givensConsistent(grid)) return 0;
  let count = 0;
  const walk = () => {
    if (count >= cap) return;
    const cell = bestEmptyCell(grid);
    if (!cell) {
      count++;
      return;
    }
    for (const v of cell.cands) {
      grid[cell.r][cell.c] = v;
      walk();
      grid[cell.r][cell.c] = null;
      if (count >= cap) return;
    }
  };
  walk();
  return count;
}

// Vollständig + jede Zeile/Spalte/3x3-Box ist eine Permutation von 1..9.
export function validate(grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== SIZE) return false;
    for (const v of row) {
      if (!Number.isInteger(v) || v < 1 || v > SIZE) return false;
    }
  }
  const groupOk = (cells) => {
    const seen = new Set();
    for (const [r, c] of cells) seen.add(grid[r][c]);
    return seen.size === SIZE;
  };
  for (let i = 0; i < SIZE; i++) {
    const row = [];
    const col = [];
    const box = [];
    const r0 = Math.floor(i / 3) * 3;
    const c0 = (i % 3) * 3;
    for (let j = 0; j < SIZE; j++) {
      row.push([i, j]);
      col.push([j, i]);
      box.push([r0 + Math.floor(j / 3), c0 + (j % 3)]);
    }
    if (!groupOk(row) || !groupOk(col) || !groupOk(box)) return false;
  }
  return true;
}

// Erzeugt ein 9x9-Rätsel mit eindeutiger Lösung. Zellen werden in
// punktsymmetrischen Paaren entfernt, solange die Eindeutigkeit hält;
// bei ungerader Lochzahl fällt zuerst die Mittelzelle (immer eindeutig).
// Bis zu 40 Neuversuche mit frischem Vollgitter, falls die Zielzahl
// nicht erreichbar ist.
export function generateSudoku(rng, { holes = 45 } = {}) {
  const target = Math.max(0, Math.min(60, Math.floor(holes)));
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = fillFull(rng);
    const puzzle = copyGrid(solution);
    let removed = 0;

    if (target % 2 === 1) {
      // Eine einzelne fehlende Zelle ist immer erzwungen -> eindeutig.
      puzzle[4][4] = null;
      removed = 1;
    }

    // Alle 40 Paare (Zelle, punktgespiegelte Zelle) ohne die Mittelzelle.
    const pairs = [];
    for (let i = 0; i < 40; i++) {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      pairs.push([
        [r, c],
        [SIZE - 1 - r, SIZE - 1 - c],
      ]);
    }

    for (const [[r1, c1], [r2, c2]] of shuffled(rng, pairs)) {
      if (removed >= target) break;
      if (removed + 2 > target) break;
      if (puzzle[r1][c1] === null || puzzle[r2][c2] === null) continue;
      const keep1 = puzzle[r1][c1];
      const keep2 = puzzle[r2][c2];
      puzzle[r1][c1] = null;
      puzzle[r2][c2] = null;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[r1][c1] = keep1;
        puzzle[r2][c2] = keep2;
      } else {
        removed += 2;
      }
    }

    if (removed === target) {
      return { size: SIZE, puzzle, solution };
    }
  }
  throw new Error('Sudoku-Erzeugung fehlgeschlagen (zu viele Löcher?)');
}
