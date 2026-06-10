// Mini-Sudoku: 4x4 (2x2-Boxen) und 6x6 (2x3-Boxen: 2 Zeilen hoch, 3 Spalten
// breit). Gitter sind 2D-Arrays grid[row][col] mit Werten 1..size oder null.
// Deterministisch über das übergebene rng (seeded Shuffles), DOM-frei.

const BOX = { 4: { w: 2, h: 2 }, 6: { w: 3, h: 2 } };

export function boxDims(size) {
  const dims = BOX[size];
  if (!dims) throw new Error(`Sudoku-Größe nicht unterstützt: ${size}`);
  return dims;
}

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(grid, size, row, col, val) {
  const { w, h } = boxDims(size);
  for (let i = 0; i < size; i++) {
    if (grid[row][i] === val || grid[i][col] === val) return false;
  }
  const r0 = Math.floor(row / h) * h;
  const c0 = Math.floor(col / w) * w;
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) if (grid[r][c] === val) return false;
  }
  return true;
}

// Backtracking-Füller mit seeded Kandidaten-Shuffle pro Zelle.
function fill(grid, size, rng) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== null) continue;
      for (const v of shuffled(rng, Array.from({ length: size }, (_, i) => i + 1))) {
        if (!canPlace(grid, size, r, c, v)) continue;
        grid[r][c] = v;
        if (fill(grid, size, rng)) return true;
        grid[r][c] = null;
      }
      return false; // leere Zelle ohne Kandidaten -> Sackgasse
    }
  }
  return true; // keine leere Zelle mehr
}

// Zählt Lösungen per Backtracking, bricht bei `cap` ab (deterministisch).
// Widersprüchliche oder ungültige Vorgaben ergeben 0 Lösungen.
export function countSolutions(puzzle, size, cap = 2) {
  const grid = puzzle.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (!v) continue;
      if (!Number.isInteger(v) || v < 1 || v > size) return 0;
      grid[r][c] = null;
      const ok = canPlace(grid, size, r, c, v);
      grid[r][c] = v;
      if (!ok) return 0;
    }
  }
  let count = 0;
  const step = () => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) continue;
        for (let v = 1; v <= size; v++) {
          if (!canPlace(grid, size, r, c, v)) continue;
          grid[r][c] = v;
          step();
          grid[r][c] = null;
          if (count >= cap) return;
        }
        return; // erste leere Zelle abgearbeitet
      }
    }
    count++;
  };
  step();
  return Math.min(count, cap);
}

// true nur für ein VOLLSTÄNDIG gefülltes, regelkonformes Gitter.
export function validate(grid, size) {
  if (!BOX[size] || !Array.isArray(grid) || grid.length !== size) return false;
  for (let r = 0; r < size; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== size) return false;
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (!Number.isInteger(v) || v < 1 || v > size) return false;
    }
  }
  for (let i = 0; i < size; i++) {
    const row = new Set(), col = new Set();
    for (let j = 0; j < size; j++) {
      row.add(grid[i][j]);
      col.add(grid[j][i]);
    }
    if (row.size !== size || col.size !== size) return false;
  }
  const { w, h } = boxDims(size);
  for (let r0 = 0; r0 < size; r0 += h) {
    for (let c0 = 0; c0 < size; c0 += w) {
      const box = new Set();
      for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) box.add(grid[r][c]);
      if (box.size !== size) return false;
    }
  }
  return true;
}

// Volle Lösung generieren, dann Zellen in zufälliger Reihenfolge leeren —
// eine Entnahme bleibt nur bestehen, wenn die Lösung EINDEUTIG bleibt
// (countSolutions <= 2 prüfen). Erreicht ein Versuch nicht `holes` Löcher,
// wird mit frischer Lösung neu versucht; der beste Versuch ist der Fallback.
export function generateSudoku(rng, { size = 4, holes } = {}) {
  boxDims(size); // validiert die Größe
  const want = holes ?? (size === 4 ? 8 : 14);
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = Array.from({ length: size }, () => Array(size).fill(null));
    if (!fill(solution, size, rng)) continue; // praktisch unmöglich
    const puzzle = solution.map((row) => row.slice());
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push([r, c]);
    let removed = 0;
    for (const [r, c] of shuffled(rng, cells)) {
      if (removed >= want) break;
      const keep = puzzle[r][c];
      puzzle[r][c] = null;
      if (countSolutions(puzzle, size, 2) === 1) removed++;
      else puzzle[r][c] = keep; // Mehrdeutig -> Zelle bleibt vorgegeben
    }
    if (removed === want) return { size, puzzle, solution };
    if (!best || removed > best.removed) best = { removed, puzzle, solution };
  }
  return { size, puzzle: best.puzzle, solution: best.solution };
}
