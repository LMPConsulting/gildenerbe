// Zone 1 — Eichhain. v2: walkable dungeon floors (the hero moves through
// rooms, fights, loots chests, finds challenge events) ending at the boss.
export const ZONE1 = {
  id: 'eichhain',
  name: 'Eichhain',
  levelRange: [1, 5],
  floors: [
    { kind: 'normal', enemies: ['waldwolf', 'waldwolf', 'keiler'], chests: 1, events: 0 },
    { kind: 'normal', enemies: ['keiler', 'waldwolf', 'waldwolf', 'raeuber'], chests: 1, events: 1 },
    { kind: 'normal', enemies: ['raeuber', 'raeuber', 'waldwolf', 'keiler'], chests: 2, events: 1 },
    { kind: 'normal', enemies: ['rudelfuehrer', 'waldwolf', 'waldwolf'], chests: 1, events: 1 },
    { kind: 'boss', enemies: ['krell', 'raeuber', 'raeuber'], chests: 1, events: 0 },
  ],
};

export const ZONES = { eichhain: ZONE1 };
