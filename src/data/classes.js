// The three playable classes. Each wants a different armor type and primary
// stat (WoW-flavoured), giving loot real meaning — plate is wasted on a mage.
export const ARMOR_TYPES = { platte: 'Platte', leder: 'Leder', stoff: 'Stoff' };

export const CLASSES = {
  krieger: {
    name: 'Krieger', armorType: 'platte', primaryStat: 'str', resourceType: 'rage',
    primary: { str: 12, agi: 6, int: 3, sta: 11 },
    growth: { str: 2, agi: 1, int: 0, sta: 2 },
    weapon: { name: 'Abgenutztes Schwert', dmg: 10, kind: 'melee' },
    abilities: ['heroic_strike', 'whirlwind', 'shield_block', 'execute'],
    baseArmor: 40,
    blurb: 'Plattenträger. Hält viel aus, kämpft im Nahkampf, baut Wut auf.',
  },
  schurke: {
    name: 'Schurke', armorType: 'leder', primaryStat: 'agi', resourceType: 'energie',
    primary: { str: 6, agi: 13, int: 4, sta: 8 },
    growth: { str: 1, agi: 2, int: 0, sta: 1 },
    weapon: { name: 'Rostiger Dolch', dmg: 8, kind: 'melee' },
    abilities: ['sinister_strike', 'fan_of_knives', 'evasion', 'eviscerate'],
    baseArmor: 25,
    blurb: 'Lederträger. Flink und tödlich, Energie regeneriert ständig.',
  },
  magier: {
    name: 'Magier', armorType: 'stoff', primaryStat: 'int', resourceType: 'mana',
    primary: { str: 4, agi: 6, int: 13, sta: 7 },
    growth: { str: 0, agi: 1, int: 2, sta: 1 },
    weapon: { name: 'Knorriger Stab', dmg: 6, kind: 'ranged' },
    abilities: ['frostbolt', 'arcane_blast', 'frost_nova', 'pyroblast'],
    baseArmor: 12,
    blurb: 'Stoffträger. Zerbrechlich, aber wirkt mächtige Zauber aus der Distanz.',
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

// Resource behaviour: rage builds from attacks; energy/mana regenerate over time.
export const RESOURCES = {
  rage: { max: 100, regenPerSec: 0, fromHit: 10 },
  energie: { max: 100, regenPerSec: 20, fromHit: 0 },
  mana: { max: 100, regenPerSec: 8, fromHit: 0 },
};
