export const RARITY = {
  grau:   { key: 'grau',   affixes: 0, weight: 18, color: '#9d9d9d', label: 'Schrott' },
  weiss:  { key: 'weiss',  affixes: 0, weight: 30, color: '#ffffff', label: 'Gewöhnlich' },
  gruen:  { key: 'gruen',  affixes: 1, weight: 30, color: '#1eba5a', label: 'Ungewöhnlich' },
  blau:   { key: 'blau',   affixes: 2, weight: 15, color: '#3b82f6', label: 'Selten' },
  lila:   { key: 'lila',   affixes: 3, weight: 6,  color: '#a335ee', label: 'Episch' },
  orange: { key: 'orange', affixes: 4, weight: 1,  color: '#ff8000', label: 'Legendär' },
};
export const RARITY_ORDER = ['grau', 'weiss', 'gruen', 'blau', 'lila', 'orange'];

// `per` = stat value contributed per item level.
export const AFFIX_POOL = [
  { key: 'str',        name: 'der Stärke',      per: 1.0 },
  { key: 'agi',        name: 'der Gewandtheit', per: 1.0 },
  { key: 'int',        name: 'der Weisheit',    per: 1.0 },
  { key: 'sta',        name: 'der Ausdauer',    per: 1.2 },
  { key: 'ap',         name: 'der Wucht',       per: 1.0 },
  { key: 'spellPower', name: 'der Macht',       per: 1.0 },
  { key: 'crit',       name: 'des Schlächters', per: 0.004 },
  { key: 'armor',      name: 'des Schutzes',    per: 2.0 },
];
export const affixByKey = Object.fromEntries(AFFIX_POOL.map((a) => [a.key, a]));

export const SLOT_NAMES = {
  waffe: 'Waffe', kopf: 'Helm', brust: 'Brustteil', beine: 'Beinteil',
  haende: 'Handschuhe', fuesse: 'Stiefel', ring1: 'Ring', ring2: 'Ring',
  amulett: 'Amulett', umhang: 'Umhang',
};
export const LOOT_SLOTS = Object.keys(SLOT_NAMES);

// Armour slots carry an armour type tied to one class; jewellery + weapons are
// flexible (weapons get a class affinity by weapon type in loot.js).
export const ARMOR_SLOTS = ['kopf', 'brust', 'beine', 'haende', 'fuesse'];
export const JEWELRY_SLOTS = ['ring1', 'ring2', 'amulett', 'umhang'];

export const ARMORTYPE_CLASS = { platte: 'krieger', leder: 'schurke', stoff: 'magier' };
export const CLASS_ARMORTYPE = { krieger: 'platte', schurke: 'leder', magier: 'stoff' };
export const ARMORTYPE_NAME = { platte: 'Platte', leder: 'Leder', stoff: 'Stoff' };
// each armour type favours its class's primary stat for affix rolls
export const ARMORTYPE_PRIMARY = { platte: 'str', leder: 'agi', stoff: 'int' };

// Can `hero` use `item`? null classReq = anyone (jewellery / unbound).
export function canUse(hero, item) {
  if (!item || !item.classReq) return true;
  return item.classReq.includes(hero.classId);
}
