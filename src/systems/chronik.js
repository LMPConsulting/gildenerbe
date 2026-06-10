// Chronik — the meta-meta layer ABOVE the base. Chronik points survive base
// destruction and buy permanent account upgrades that make every future base
// stronger. (Player ask: "Meta-Progression für die Base, aber nochmal eine
// Meta-Ebene drüber.")

export const CHRONIK_UPGRADES = {
  baumeister: {
    name: 'Baumeister', desc: '−8% Gebäudekosten je Stufe',
    baseCost: 25, costMult: 1.8, maxLevel: 5,
  },
  gruendung: {
    name: 'Gründung', desc: 'Neue Basis startet mit +60 Erbe je Stufe',
    baseCost: 20, costMult: 1.7, maxLevel: 5,
  },
  schutz: {
    name: 'Schutz', desc: '+40 Basis-HP je Stufe',
    baseCost: 30, costMult: 1.8, maxLevel: 5,
  },
};
export const CHRONIK_IDS = Object.keys(CHRONIK_UPGRADES);

export const chronikLevel = (chronik, id) => (chronik.upgrades && chronik.upgrades[id]) || 0;

export const chronikCost = (id, level) =>
  Math.round(CHRONIK_UPGRADES[id].baseCost * Math.pow(CHRONIK_UPGRADES[id].costMult, level));

export function buyChronik(chronik, id) {
  const lvl = chronikLevel(chronik, id);
  if (lvl >= CHRONIK_UPGRADES[id].maxLevel) return false;
  const cost = chronikCost(id, lvl);
  if (chronik.punkte < cost) return false;
  chronik.punkte -= cost;
  chronik.upgrades[id] = lvl + 1;
  return true;
}

// Build-cost multiplier from Baumeister (applies to Gildenhalle building costs).
export const buildCostMult = (chronik) => Math.max(0.5, 1 - chronikLevel(chronik, 'baumeister') * 0.08);

// Base max HP including Schutz.
export const baseMaxHp = (chronik) => 100 + chronikLevel(chronik, 'schutz') * 40;

// Chronik points earned when a base falls: scales with what was built.
export function chronikOnBaseLost(meta) {
  const totalLevels = Object.values(meta.buildings || {}).reduce((s, l) => s + l, 0);
  return Math.max(5, Math.round(8 + totalLevels * 4));
}

// Small trickle for big victories (zone cleared).
export const chronikOnZoneClear = () => 3;

// Reset the base after destruction: buildings & base wiped, Chronik pays back.
// Returns the points earned.
export function destroyBase(account) {
  const earned = chronikOnBaseLost(account.meta);
  account.chronik.punkte += earned;
  account.meta.buildings = {};
  account.meta.erbe = chronikLevel(account.chronik, 'gruendung') * 60;
  account.base.wallLevel = 0;
  account.base.maxHp = baseMaxHp(account.chronik);
  account.base.hp = account.base.maxHp;
  account.base.runsSinceAttack = 0;
  account.base.underAttack = false;
  account.base.generation += 1;
  account.stats.basesLost = (account.stats.basesLost || 0) + 1;
  return earned;
}
