// Pure derived-stat math. STR drives melee AP, AGI adds some AP + crit/dodge,
// INT drives spell power + a little crit. Class scaling lives in the data
// (data/classes.js primary/growth); these formulas are class-agnostic.
export function computeDerived(primary, level, weapon) {
  const { str = 0, agi = 0, int = 0, sta = 0 } = primary;
  return {
    maxHp: 50 + level * 10 + sta * 10,
    ap: str * 2 + agi * 1.5 + (weapon?.bonusAp ?? 0),
    spellPower: int * 1.5 + (weapon?.bonusSp ?? 0),
    weaponDmg: weapon?.dmg ?? 0,
    critChance: 0.05 + agi * 0.0006 + int * 0.0004,
  };
}

// Armor -> damage reduction, scaled by the attacker's level, capped at 75%.
export function armorDR(armor, attackerLevel) {
  const dr = armor / (armor + 50 * attackerLevel + 400);
  return Math.min(0.75, Math.max(0, dr));
}
