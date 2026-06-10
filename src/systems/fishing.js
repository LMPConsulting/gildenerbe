import { FISH_TABLE } from '../data/recipes.js';

// One fishing cast as a small state machine. The UI calls step(dt) over time
// and tap() on player input. Deterministic given the rng.
export function createCast(rng) {
  const biteDelayMs = rng.int(1500, 4500);
  const windowMs = 900;
  const cast = {
    state: 'waiting', // 'waiting' | 'window' | 'caught' | 'failed'
    biteDelayMs,
    windowMs,
    elapsed: 0,
    step(dt) {
      if (cast.state === 'caught' || cast.state === 'failed') return;
      cast.elapsed += dt;
      if (cast.state === 'waiting' && cast.elapsed >= biteDelayMs) cast.state = 'window';
      if (cast.state === 'window' && cast.elapsed >= biteDelayMs + windowMs) cast.state = 'failed';
    },
    tap() {
      if (cast.state === 'waiting') { cast.state = 'failed'; return null; } // too early
      if (cast.state === 'window') {
        const fish = rng.weighted(FISH_TABLE.map((f) => ({ item: f, weight: f.weight })));
        cast.state = 'caught';
        return fish;
      }
      return null;
    },
  };
  return cast;
}
