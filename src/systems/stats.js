// Pure derived-stat math. Class-specific scaling (Krieger: AP from STR) lives here.
export function computeDerived(primary, level, weapon) {
  const { str = 0, agi = 0, sta = 0 } = primary;
  return {
    maxHp: 50 + level * 10 + sta * 10,
    ap: str * 2 + (weapon?.bonusAp ?? 0),
    weaponDmg: weapon?.dmg ?? 0,
    critChance: 0.05 + agi * 0.0005,
  };
}

// Armor -> damage reduction, scaled by the attacker's level, capped at 75%.
export function armorDR(armor, attackerLevel) {
  const dr = armor / (armor + 50 * attackerLevel + 400);
  return Math.min(0.75, Math.max(0, dr));
}
