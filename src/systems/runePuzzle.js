const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => `${x},${y}`;

// Generate a solvable "connect the rune pairs without crossing" puzzle by
// carving non-overlapping paths first; their endpoints become the pair markers,
// and the carved paths ARE a valid solution.
export function generatePuzzle(rng, { size = 5, pairs = 3 } = {}) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const used = new Set();
    const endpoints = [];
    const solution = [];
    let ok = true;
    for (let p = 0; p < pairs; p++) {
      const free = [];
      for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if (!used.has(key(x, y))) free.push({ x, y });
      if (!free.length) { ok = false; break; }
      let cur = free[rng.int(0, free.length - 1)];
      const path = [cur];
      used.add(key(cur.x, cur.y));
      const targetLen = rng.int(2, Math.min(5, size));
      while (path.length < targetLen) {
        const opts = DIRS
          .map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy }))
          .filter((n) => n.x >= 0 && n.x < size && n.y >= 0 && n.y < size && !used.has(key(n.x, n.y)));
        if (!opts.length) break;
        cur = opts[rng.int(0, opts.length - 1)];
        used.add(key(cur.x, cur.y));
        path.push(cur);
      }
      if (path.length < 2) { ok = false; break; }
      endpoints.push({ idx: p, a: path[0], b: path[path.length - 1] });
      solution.push(path);
    }
    if (ok) return { size, pairs, endpoints, solution };
  }
  // Fallback: trivial guaranteed-solvable layout.
  return {
    size: 5, pairs: 2,
    endpoints: [{ idx: 0, a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }, { idx: 1, a: { x: 0, y: 1 }, b: { x: 1, y: 1 } }],
    solution: [[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 1 }, { x: 1, y: 1 }]],
  };
}

// paths[i] must connect endpoints[i].a..b via 4-adjacent steps, in bounds, with
// no cell shared across different paths.
export function validate(puzzle, paths) {
  if (!Array.isArray(paths) || paths.length !== puzzle.endpoints.length) return false;
  const used = new Set();
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const ep = puzzle.endpoints[i];
    if (!Array.isArray(path) || path.length < 2) return false;
    const first = path[0], last = path[path.length - 1];
    const sameAB = first.x === ep.a.x && first.y === ep.a.y && last.x === ep.b.x && last.y === ep.b.y;
    const sameBA = first.x === ep.b.x && first.y === ep.b.y && last.x === ep.a.x && last.y === ep.a.y;
    if (!sameAB && !sameBA) return false;
    for (let j = 0; j < path.length; j++) {
      const c = path[j];
      if (c.x < 0 || c.x >= puzzle.size || c.y < 0 || c.y >= puzzle.size) return false;
      const k = key(c.x, c.y);
      if (used.has(k)) return false; // crossing
      used.add(k);
      if (j > 0) {
        const prev = path[j - 1];
        if (Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y) !== 1) return false; // not adjacent
      }
    }
  }
  return true;
}
