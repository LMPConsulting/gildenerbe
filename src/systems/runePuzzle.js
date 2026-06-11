// Runen-Verbindung — a Flow/Numberlink-style puzzle: connect every rune to its
// matching partner with non-crossing paths so that the WHOLE board is covered.
//
// Generation guarantees solvability: we build a random Hamiltonian path over the
// grid (serpentine start + "backbite" shuffle moves), then cut it into `pairs`
// contiguous segments. The segments tile the board perfectly and ARE a valid
// solution; only their endpoints are shown to the player.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => `${x},${y}`;

// difficulty 1..3 → board size + number of rune pairs.
export const DIFFICULTY = {
  1: { size: 5, pairs: 4 },
  2: { size: 6, pairs: 5 },
  3: { size: 7, pairs: 6 },
};

const MIN_SEG = 3; // every path has at least one cell between its runes

// Serpentine (boustrophedon) Hamiltonian path over a size×size grid.
function serpentine(size) {
  const path = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) for (let x = 0; x < size; x++) path.push({ x, y });
    else for (let x = size - 1; x >= 0; x--) path.push({ x, y });
  }
  return path;
}

// One backbite move: pick an end, connect it to a non-adjacent grid neighbour
// inside the path, and reverse the loose segment. Keeps the path Hamiltonian.
function backbite(path, size, rng) {
  const L = path.length - 1;
  const fromStart = rng.chance(0.5);
  const end = fromStart ? path[0] : path[L];
  const exclude = fromStart ? path[1] : path[L - 1];
  const neighbours = DIRS
    .map(([dx, dy]) => ({ x: end.x + dx, y: end.y + dy }))
    .filter((n) => n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && !(n.x === exclude.x && n.y === exclude.y));
  if (!neighbours.length) return path;
  const pick = neighbours[rng.int(0, neighbours.length - 1)];
  const i = path.findIndex((c) => c.x === pick.x && c.y === pick.y);
  if (i < 0) return path;
  if (fromStart) {
    // reverse path[0..i-1] → new end is old path[i-1]
    return path.slice(0, i).reverse().concat(path.slice(i));
  }
  // reverse path[i+1..L] → new end is old path[i+1]
  return path.slice(0, i + 1).concat(path.slice(i + 1).reverse());
}

// Cut total length N into `pairs` parts, each ≥ MIN_SEG (random composition).
function cutLengths(n, pairs, rng) {
  const lens = new Array(pairs).fill(MIN_SEG);
  let extra = n - pairs * MIN_SEG;
  while (extra-- > 0) lens[rng.int(0, pairs - 1)]++;
  return lens;
}

// Generate a guaranteed-solvable, fully-tileable puzzle.
// opts: { difficulty = 2 } or legacy { size, pairs } (explicit values win).
export function generatePuzzle(rng, opts = {}) {
  const d = DIFFICULTY[Math.max(1, Math.min(3, Math.round(opts.difficulty || 2)))];
  const size = opts.size || d.size;
  const cells = size * size;
  let pairs = opts.pairs || d.pairs;
  pairs = Math.max(1, Math.min(pairs, Math.floor(cells / MIN_SEG)));

  let ham = serpentine(size);
  const shuffles = cells * 10;
  for (let i = 0; i < shuffles; i++) ham = backbite(ham, size, rng);

  const lens = cutLengths(cells, pairs, rng);
  const solution = [];
  let at = 0;
  for (const len of lens) {
    solution.push(ham.slice(at, at + len));
    at += len;
  }

  const endpoints = solution.map((path, idx) => ({
    idx,
    a: { x: path[0].x, y: path[0].y },
    b: { x: path[path.length - 1].x, y: path[path.length - 1].y },
  }));

  return { size, pairs, difficulty: opts.difficulty || null, endpoints, solution };
}

// Number of paths in the carved (guaranteed) solution.
export const solutionPathCount = (puzzle) => puzzle.solution.length;

// Info about a board cell: null when out of bounds, otherwise the pair index
// of the rune sitting there (or -1 for a plain cell).
export function cellAt(puzzle, x, y) {
  if (x < 0 || x >= puzzle.size || y < 0 || y >= puzzle.size) return null;
  for (const ep of puzzle.endpoints) {
    if ((ep.a.x === x && ep.a.y === y) || (ep.b.x === x && ep.b.y === y)) return { x, y, endpoint: ep.idx };
  }
  return { x, y, endpoint: -1 };
}

// Does paths[pairIdx] start at one rune of its pair and end at the other?
export function isConnected(puzzle, paths, pairIdx) {
  const p = paths[pairIdx];
  const ep = puzzle.endpoints[pairIdx];
  if (!Array.isArray(p) || p.length < 2) return false;
  const f = p[0], l = p[p.length - 1];
  return (f.x === ep.a.x && f.y === ep.a.y && l.x === ep.b.x && l.y === ep.b.y)
    || (f.x === ep.b.x && f.y === ep.b.y && l.x === ep.a.x && l.y === ep.a.y);
}

// May the active path of `pairIdx` grow into `cell`?
// Rules: in bounds, path has a head, cell is 4-adjacent to the head, cell is
// not used by any path, foreign runes are walls, finished paths cannot grow.
export function canExtend(puzzle, paths, pairIdx, cell) {
  const info = cell ? cellAt(puzzle, cell.x, cell.y) : null;
  if (!info) return false;
  const path = paths[pairIdx];
  if (!Array.isArray(path) || !path.length) return false;
  if (isConnected(puzzle, paths, pairIdx)) return false;
  const head = path[path.length - 1];
  if (Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) !== 1) return false;
  if (info.endpoint >= 0 && info.endpoint !== pairIdx) return false;
  for (const p of paths) {
    if (Array.isArray(p) && p.some((c) => c.x === cell.x && c.y === cell.y)) return false;
  }
  return true;
}

// Strict validation: every pair connected by an in-bounds, 4-adjacent path,
// no cell used twice (no crossings), and the ENTIRE board covered.
export function validate(puzzle, paths) {
  if (!Array.isArray(paths) || paths.length !== puzzle.endpoints.length) return false;
  const used = new Set();
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (!isConnected(puzzle, paths, i)) return false;
    for (let j = 0; j < path.length; j++) {
      const c = path[j];
      if (c.x < 0 || c.x >= puzzle.size || c.y < 0 || c.y >= puzzle.size) return false;
      const k = key(c.x, c.y);
      if (used.has(k)) return false; // crossing / overlap
      used.add(k);
      if (j > 0) {
        const prev = path[j - 1];
        if (Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y) !== 1) return false;
      }
    }
  }
  return used.size === puzzle.size * puzzle.size; // full coverage
}

// UI-facing alias: a live state (array of paths) solves the puzzle.
export const isComplete = (puzzle, paths) => validate(puzzle, paths);
