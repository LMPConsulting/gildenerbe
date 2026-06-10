// Seeded PRNG (mulberry32). Returns a generator with helpers.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (entries) => {
      const total = entries.reduce((s, e) => s + e.weight, 0);
      let r = next() * total;
      for (const e of entries) {
        r -= e.weight;
        if (r < 0) return e.item;
      }
      return entries[entries.length - 1].item;
    },
  };
}
