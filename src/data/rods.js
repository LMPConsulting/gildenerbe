// Angelruten: craftbare Werkzeuge mit Haltbarkeit (Würfe) und Glück.
// Glück = zusätzliche Fang-Würfe pro Biss, der beste Fisch zählt.
export const ROD_TIERS = {
  weide: {
    id: 'weide', name: 'Weidenrute', tier: 1,
    maxDurability: 8, luck: 0,
    craftCost: { gold: 10, materials: { kraeuter: 2 } },
    desc: 'Biegsam, billig, bricht schnell.',
  },
  eiche: {
    id: 'eiche', name: 'Eichenrute', tier: 2,
    maxDurability: 15, luck: 1,
    craftCost: { gold: 40, materials: { kraeuter: 3, kupferbarren: 1 } },
    desc: 'Solides Holz, beschlagen mit Kupfer.',
  },
  mithril: {
    id: 'mithril', name: 'Mithrilrute', tier: 3,
    maxDurability: 30, luck: 2,
    craftCost: { gold: 120, materials: { kraeuter: 5, eisenbarren: 2 } },
    desc: 'Federleicht — die Fische merken nichts.',
  },
  drache: {
    id: 'drache', name: 'Drachenrute', tier: 4,
    maxDurability: 60, luck: 3,
    craftCost: { gold: 300, materials: { kraeuter: 8, kupferbarren: 4, eisenbarren: 4 } },
    desc: 'Aus Drachenbart gesponnen. Legendärer Fang.',
  },
};

export const ROD_ORDER = ['weide', 'eiche', 'mithril', 'drache'];

let uid = 1;

// Creates a fresh rod instance of the given tier (or null for unknown tiers).
// Instance ids are unique per session; craftRod additionally guards against
// collisions with rods restored from a save.
export function makeRod(tierId) {
  const t = ROD_TIERS[tierId];
  if (!t) return null;
  return {
    id: `rod-${tierId}-${uid++}`,
    tierId: t.id,
    name: t.name,
    tier: t.tier,
    durability: t.maxDurability,
    maxDurability: t.maxDurability,
    luck: t.luck,
  };
}
