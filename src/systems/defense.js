import { makeEnemy } from '../data/enemies.js';

// Base raids: every few runs the base is attacked. The player defends with
// their hero; walls soak damage. Losing hurts the base; at 0 HP the base
// falls (handled by chronik.destroyBase). Gives base-building a PURPOSE.

export const RAID_EVERY_RUNS = 4;

// Call after every finished run. Returns true if a raid is now pending.
export function tickRaidCounter(account) {
  account.base.runsSinceAttack = (account.base.runsSinceAttack || 0) + 1;
  if (account.base.runsSinceAttack >= RAID_EVERY_RUNS) {
    account.base.underAttack = true;
  }
  return account.base.underAttack;
}

// Raid strength scales with how developed the base is (richer base = juicier target).
export function raidStrength(account) {
  const totalLevels = Object.values(account.meta.buildings || {}).reduce((s, l) => s + l, 0);
  return 1 + Math.floor(totalLevels / 3);
}

// Build the attacking wave (enemy units for the combat sim).
export function createRaidWave(account, rng) {
  const strength = raidStrength(account);
  const pool = ['waldwolf', 'raeuber', 'keiler'];
  const wave = [];
  const count = Math.min(4, 1 + strength);
  for (let i = 0; i < count; i++) wave.push(makeEnemy(rng.pick(pool)));
  if (strength >= 3) wave.push(makeEnemy('rudelfuehrer'));
  // raiders scale up with strength
  for (const u of wave) {
    u.maxHp = Math.round(u.maxHp * (1 + strength * 0.25));
    u.hp = u.maxHp;
    u.weaponDmg = Math.round(u.weaponDmg * (1 + strength * 0.15));
  }
  return wave;
}

// Hero gets a defensive bonus from the wall while fighting at home.
export function applyWallBonus(hero, account) {
  const wall = account.base.wallLevel || 0;
  if (wall > 0) {
    hero.armor += wall * 25;
    hero.hp = Math.min(hero.maxHp, hero.hp + wall * 15);
  }
  return hero;
}

// Resolve the raid outcome. Won: reward Erbe; lost: base takes damage.
// Returns { won, erbe, baseDamage, baseDestroyed }.
export function resolveRaid(account, won) {
  account.base.underAttack = false;
  account.base.runsSinceAttack = 0;
  if (won) {
    const erbe = 15 + raidStrength(account) * 10;
    account.meta.erbe += erbe;
    account.stats.raidsWon = (account.stats.raidsWon || 0) + 1;
    return { won, erbe, baseDamage: 0, baseDestroyed: false };
  }
  const dmg = 35 + raidStrength(account) * 10;
  account.base.hp = Math.max(0, account.base.hp - dmg);
  return { won, erbe: 0, baseDamage: dmg, baseDestroyed: account.base.hp === 0 };
}

// Wall building: bought with Erbe like other buildings, but lives on base.
export const WALL_MAX = 5;
export const wallCost = (level) => Math.round(50 * Math.pow(1.7, level));

export function buyWall(account) {
  const lvl = account.base.wallLevel || 0;
  if (lvl >= WALL_MAX) return false;
  const cost = wallCost(lvl);
  if (account.meta.erbe < cost) return false;
  account.meta.erbe -= cost;
  account.base.wallLevel = lvl + 1;
  return true;
}

// Repairs: spend Erbe to restore base HP (1 Erbe = 2 HP).
export function repairBase(account, erbeSpent) {
  const spend = Math.min(erbeSpent, account.meta.erbe);
  if (spend <= 0) return 0;
  account.meta.erbe -= spend;
  const before = account.base.hp;
  account.base.hp = Math.min(account.base.maxHp, account.base.hp + spend * 2);
  return account.base.hp - before;
}
