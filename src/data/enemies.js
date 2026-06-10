// Zone-1 enemy definitions (stats illustrative per spec §7; tuned later).
// dmg = damage per auto-attack hit.
export const ENEMIES = {
  waldwolf: { id: 'waldwolf', name: 'Waldwolf', level: 2, hp: 45, dmg: 8, armor: 20,
    xp: 12, copper: [2, 5], sprite: 'wolf' },
  raeuber:  { id: 'raeuber',  name: 'Räuber',   level: 3, hp: 70, dmg: 12, armor: 40,
    xp: 20, copper: [5, 12], sprite: 'bandit' },
  keiler:   { id: 'keiler',   name: 'Keiler',   level: 2, hp: 60, dmg: 9, armor: 25,
    xp: 15, copper: [3, 7], sprite: 'boar' },
  rudelfuehrer: { id: 'rudelfuehrer', name: 'Rudelführer', level: 4, hp: 200, dmg: 18,
    armor: 60, xp: 60, copper: [15, 30], sprite: 'wolf_elite', elite: true },
  krell: { id: 'krell', name: 'Banditenhauptmann Krell', level: 5, hp: 800, dmg: 25,
    armor: 200, xp: 200, copper: [80, 140], sprite: 'krell', boss: true,
    phase2At: 0.5, // enrage at 50% hp
    special: { name: 'Wuchtiger Hieb', castMs: 2000, mult: 2.4, everyMs: 9000 } },
};

export function makeEnemy(id) {
  const e = ENEMIES[id];
  return {
    id: e.id, name: e.name, side: 'enemy', level: e.level,
    maxHp: e.hp, hp: e.hp, armor: e.armor, ap: 0, weaponDmg: e.dmg,
    critChance: 0.05, resource: null, abilities: [], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: e.special ? { everyMs: e.special.everyMs, timer: e.special.everyMs, special: e.special } : null,
    telegraph: null, blocking: 0, alive: true,
    enraged: false, phase2At: e.phase2At ?? null,
    xp: e.xp, copper: e.copper, sprite: e.sprite, boss: !!e.boss, elite: !!e.elite,
  };
}
