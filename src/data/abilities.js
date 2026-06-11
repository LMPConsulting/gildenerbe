// All class abilities. `kind` drives combat behaviour:
//   attack   — single target in the facing arc within `range`
//   aoe      — every enemy in the facing arc (or around, for big range)
//   execute  — single target, bonus coef below `threshold` hp fraction
//   defensive— grants block (blockMs / blockReduce) — also rogue Evasion
//   ranged   — fires a projectile toward facing/nearest within `range`
//   nova     — instant AoE ring around the hero (radius `range`) + control
// Martial scaling: weaponDmg*weaponCoef + ap*apCoef. Spell scaling: spellPower*spellCoef.
export const ABILITIES = {
  // --- Krieger (rage) ---
  heroic_strike: { id: 'heroic_strike', name: 'Heldenhafter Stoß', kind: 'attack',
    cost: 15, cooldown: 0, range: 1.7, weaponCoef: 1.2, apCoef: 0.15 },
  whirlwind: { id: 'whirlwind', name: 'Wirbelwind', kind: 'aoe',
    cost: 25, cooldown: 6000, range: 1.9, weaponCoef: 0.8, apCoef: 0.12 },
  shield_block: { id: 'shield_block', name: 'Schildblock', kind: 'defensive',
    cost: 10, cooldown: 12000, blockMs: 4000, blockReduce: 0.6 },
  execute: { id: 'execute', name: 'Hinrichten', kind: 'execute',
    cost: 25, cooldown: 8000, range: 1.7, weaponCoef: 2.5, apCoef: 0.2, threshold: 0.2 },

  // --- Schurke (energie) ---
  sinister_strike: { id: 'sinister_strike', name: 'Hinterhältiger Stoß', kind: 'attack',
    cost: 35, cooldown: 0, range: 1.6, weaponCoef: 1.0, apCoef: 0.3 },
  fan_of_knives: { id: 'fan_of_knives', name: 'Messerfächer', kind: 'aoe',
    cost: 35, cooldown: 5000, range: 2.3, weaponCoef: 0.6, apCoef: 0.22 },
  evasion: { id: 'evasion', name: 'Ausweichen', kind: 'defensive',
    cost: 20, cooldown: 14000, blockMs: 5000, blockReduce: 0.7 },
  eviscerate: { id: 'eviscerate', name: 'Eviszerieren', kind: 'execute',
    cost: 35, cooldown: 7000, range: 1.6, weaponCoef: 2.0, apCoef: 0.35, threshold: 0.25 },

  // --- Magier (mana) ---
  frostbolt: { id: 'frostbolt', name: 'Frostblitz', kind: 'ranged',
    cost: 20, cooldown: 0, range: 7, projectile: true, spellCoef: 1.3, slowMs: 1500 },
  arcane_blast: { id: 'arcane_blast', name: 'Arkanschlag', kind: 'ranged',
    cost: 30, cooldown: 3000, range: 6.5, projectile: true, spellCoef: 1.9 },
  frost_nova: { id: 'frost_nova', name: 'Frostnova', kind: 'nova',
    cost: 25, cooldown: 11000, range: 2.6, spellCoef: 0.6, rootMs: 2200 },
  pyroblast: { id: 'pyroblast', name: 'Pyroschlag', kind: 'ranged',
    cost: 45, cooldown: 9000, range: 7.5, projectile: true, spellCoef: 3.0 },
};

export const getAbility = (id) => ABILITIES[id];
