// Zone 1 — Eichhain. A linear encounter sequence ending at the boss.
// (A branching node-map comes in a later plan; this proves the run flow.)
export const ZONE1 = {
  id: 'eichhain',
  name: 'Eichhain',
  levelRange: [1, 5],
  encounters: [
    ['waldwolf'],
    ['keiler', 'waldwolf'],
    ['raeuber'],
    ['rudelfuehrer'],   // elite
    ['krell'],          // boss
  ],
};

export const ZONES = { eichhain: ZONE1 };
