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
  { key: 'str',   name: 'der Stärke',      per: 1.0 },
  { key: 'agi',   name: 'der Gewandtheit', per: 1.0 },
  { key: 'sta',   name: 'der Ausdauer',    per: 1.2 },
  { key: 'ap',    name: 'der Wucht',       per: 1.0 },
  { key: 'crit',  name: 'des Schlächters', per: 0.004 },
  { key: 'armor', name: 'des Schutzes',    per: 2.0 },
];

export const SLOT_NAMES = {
  waffe: 'Schwert', kopf: 'Helm', brust: 'Brustplatte', beine: 'Beinschienen',
  haende: 'Handschuhe', fuesse: 'Stiefel', ring1: 'Ring', ring2: 'Ring',
  amulett: 'Amulett', umhang: 'Umhang',
};
export const LOOT_SLOTS = Object.keys(SLOT_NAMES);
