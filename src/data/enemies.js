// Zone-1 enemies. v3 adds movement behaviour for the free-movement dungeon:
//   chaser  — closes in and bites
//   charger — winds up and lunges across the gap
//   ranged  — kites and shoots (you must close on it or dodge)
//   (boss)  — chaser + a ground-slam AoE you walk out of
// dmg = damage per hit; speed in tiles/sec; aggro = wake distance.
export const ENEMIES = {
  waldwolf: { id: 'waldwolf', name: 'Waldwolf', level: 2, hp: 45, dmg: 8, armor: 20,
    xp: 90, copper: [2, 5], sprite: 'wolf', behavior: 'chaser', speed: 3.0, aggro: 6.5, attackEvery: 1400 },
  raeuber: { id: 'raeuber', name: 'Räuber', level: 3, hp: 70, dmg: 12, armor: 40,
    xp: 200, copper: [5, 12], sprite: 'bandit', behavior: 'chaser', speed: 2.3, aggro: 6, attackEvery: 1800 },
  keiler: { id: 'keiler', name: 'Keiler', level: 2, hp: 60, dmg: 9, armor: 25,
    xp: 110, copper: [3, 7], sprite: 'boar', behavior: 'charger', speed: 2.2, aggro: 6, attackEvery: 1800 },
  bogenschuetze: { id: 'bogenschuetze', name: 'Bogenschütze', level: 3, hp: 50, dmg: 11, armor: 25,
    xp: 240, copper: [6, 14], sprite: 'bandit', behavior: 'ranged', speed: 2.1, aggro: 7.5, attackEvery: 2600 },
  rudelfuehrer: { id: 'rudelfuehrer', name: 'Rudelführer', level: 4, hp: 150, dmg: 16, armor: 50,
    xp: 550, copper: [15, 30], sprite: 'wolf_elite', elite: true, behavior: 'chaser', speed: 2.7, aggro: 7, attackEvery: 1600 },
  krell: { id: 'krell', name: 'Banditenhauptmann Krell', level: 5, hp: 380, dmg: 20, armor: 80,
    xp: 1200, copper: [80, 140], sprite: 'krell', boss: true, behavior: 'chaser', speed: 2.2, aggro: 9, attackEvery: 1800,
    phase2At: 0.5,
    special: { name: 'Wuchtiger Hieb', castMs: 1800, mult: 2.2, everyMs: 8000 } },
};

export function makeEnemy(id) {
  const e = ENEMIES[id];
  return {
    id: e.id, name: e.name, side: 'enemy', level: e.level,
    maxHp: e.hp, hp: e.hp, armor: e.armor, ap: 0, weaponDmg: e.dmg,
    critChance: 0.05, resource: null, abilities: [], cooldowns: {},
    autoAttackEvery: e.attackEvery || 2000, autoAttackTimer: e.attackEvery || 2000,
    behavior: e.behavior || 'chaser', speed: e.speed || 2.4, aggro: e.aggro || 6, attackEvery: e.attackEvery || 2000,
    ai: e.special ? { everyMs: e.special.everyMs, timer: e.special.everyMs, special: e.special } : null,
    telegraph: null, blocking: 0, alive: true,
    enraged: false, phase2At: e.phase2At ?? null,
    xp: e.xp, copper: e.copper, sprite: e.sprite, boss: !!e.boss, elite: !!e.elite,
  };
}
