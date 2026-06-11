import { ROD_TIERS, makeRod } from '../data/rods.js';
import { hasMats, consumeMats, addMat } from './materials.js';

// Hub-Angeln: jeder Wurf kostet Gold und einen Haltbarkeitspunkt der Rute.
export const CAST_COST = 5;

// Fischarten nach Qualität 1..5. `weight` = Grundchance pro Fang-Wurf;
// das Ruten-Glück würfelt (1 + luck) Mal und behält den besten Fisch.
export const FISH_SPECIES = [
  { id: 'schlammkarpfen', name: 'Schlammkarpfen', quality: 1, value: 2, weight: 50 },
  { id: 'silberfisch', name: 'Silberfisch', quality: 2, value: 5, weight: 28 },
  { id: 'goldforelle', name: 'Goldforelle', quality: 3, value: 12, weight: 14 },
  { id: 'runenaal', name: 'Runenaal', quality: 4, value: 25, weight: 6 },
  { id: 'sturmbarsch', name: 'Sturmbarsch', quality: 5, value: 60, weight: 2 },
];

const ensure = (account) => {
  if (!Array.isArray(account.rods)) account.rods = [];
  if (!Array.isArray(account.fishpond)) account.fishpond = [];
  if (typeof account.gold !== 'number') account.gold = 0;
};

// The rod the next cast will use: the tracked one if alive, else the first
// non-broken rod. Returns null when every rod is gone.
export function equippedRod(account) {
  const rods = Array.isArray(account.rods) ? account.rods : [];
  if (account.equippedRodId) {
    const tracked = rods.find((r) => r.id === account.equippedRodId && r.durability > 0);
    if (tracked) return tracked;
  }
  return rods.find((r) => r.durability > 0) || null;
}

export function equipRod(account, rodId) {
  ensure(account);
  const rod = account.rods.find((r) => r.id === rodId && r.durability > 0);
  if (!rod) return false;
  account.equippedRodId = rod.id;
  return true;
}

export function canFish(account) {
  return !!equippedRod(account) && (account.gold || 0) >= CAST_COST;
}

// Rolls one catch: (1 + luck) weighted draws, best quality wins.
export function rollFish(rng, luck = 0) {
  const rolls = 1 + Math.max(0, Math.floor(luck));
  let best = null;
  for (let i = 0; i < rolls; i++) {
    const s = rng.weighted(FISH_SPECIES.map((f) => ({ item: f, weight: f.weight })));
    if (!best || s.quality > best.quality) best = s;
  }
  return { id: best.id, name: best.name, quality: best.quality, value: best.value };
}

// One fishing cast as a small state machine. The UI calls step(dt) over time
// and tap() on player input. Deterministic given the rng + rod.
export function createCast(rng, rod = null) {
  const biteDelayMs = rng.int(1500, 4500);
  const windowMs = 900;
  const cast = {
    state: 'waiting', // 'waiting' | 'window' | 'caught' | 'failed'
    biteDelayMs,
    windowMs,
    elapsed: 0,
    fish: null,
    resolved: false,
    step(dt) {
      if (cast.state === 'caught' || cast.state === 'failed') return;
      cast.elapsed += dt;
      if (cast.state === 'waiting' && cast.elapsed >= biteDelayMs) cast.state = 'window';
      if (cast.state === 'window' && cast.elapsed >= biteDelayMs + windowMs) cast.state = 'failed';
    },
    tap() {
      if (cast.state === 'waiting') { cast.state = 'failed'; return null; } // zu früh
      if (cast.state === 'window') {
        cast.fish = rollFish(rng, rod ? rod.luck : 0);
        cast.state = 'caught';
        return cast.fish;
      }
      return null;
    },
  };
  return cast;
}

// Settles a finished cast against the account: pays CAST_COST, wears the rod
// by one (removing it at 0), and banks a caught fish into the fishpond.
// Safe to call once per cast; later calls are no-ops.
export function resolveCast(account, cast, rng) {
  ensure(account);
  if (!cast || cast.resolved) return { fish: null, rodBroke: false };
  if (cast.state !== 'caught' && cast.state !== 'failed') return { fish: null, rodBroke: false };
  cast.resolved = true;

  account.gold = Math.max(0, account.gold - CAST_COST);

  let rodBroke = false;
  const rod = equippedRod(account);
  if (rod) {
    rod.durability -= 1;
    if (rod.durability <= 0) {
      account.rods = account.rods.filter((r) => r !== rod);
      if (account.equippedRodId === rod.id) account.equippedRodId = null;
      rodBroke = true;
    }
  }

  let fish = null;
  if (cast.state === 'caught' && cast.fish) {
    fish = cast.fish;
    account.fishpond.push(fish);
    // Seltene Fänge spülen manchmal Kräuter mit an Land.
    if (fish.quality >= 4 && rng && rng.chance(0.5)) addMat(account.materials, 'kraeuter', 1);
  }
  return { fish, rodBroke };
}

// Crafts a rod of the given tier: checks gold + materials first, then spends
// both atomically and pushes the new rod (equipping it if nothing is equipped).
export function craftRod(account, tierId) {
  ensure(account);
  const t = ROD_TIERS[tierId];
  if (!t) return false;
  if ((account.gold || 0) < t.craftCost.gold) return false;
  if (!account.materials || !hasMats(account.materials, t.craftCost.materials)) return false;

  consumeMats(account.materials, t.craftCost.materials);
  account.gold -= t.craftCost.gold;

  const hadRod = !!equippedRod(account);
  const rod = makeRod(tierId);
  while (account.rods.some((r) => r.id === rod.id)) rod.id += 'x';
  account.rods.push(rod);
  if (!hadRod) account.equippedRodId = rod.id;
  return true;
}
