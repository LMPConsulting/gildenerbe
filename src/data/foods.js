// Kochrezepte: Fische (nach Mindest-Qualität) + Kräuter -> Gericht mit Stat-Buff.
// Bessere Fische -> stärkerer Buff: value = base + perQuality * (Ø-Qualität - minQuality).
// stat ∈ str | agi | int | sta | crit | ap (Vertrag mit dem Orchestrator).
export const STAT_LABELS = {
  str: 'Stärke', agi: 'Gewandtheit', int: 'Intelligenz',
  sta: 'Ausdauer', crit: 'Krit. Chance', ap: 'Angriffskraft',
};

export const RECIPES = {
  fischsuppe: {
    id: 'fischsuppe', name: 'Fischsuppe',
    minQuality: 1, fishCount: 2, herbs: 0,
    stat: 'sta', base: 4, perQuality: 2, servings: 2, runs: 1,
    desc: 'Wärmt den Bauch vor dem Abstieg.',
  },
  roestfisch: {
    id: 'roestfisch', name: 'Röstfisch',
    minQuality: 1, fishCount: 1, herbs: 1,
    stat: 'str', base: 3, perQuality: 2, servings: 1, runs: 1,
    desc: 'Knusprig über offener Flamme.',
  },
  kraeuterfilet: {
    id: 'kraeuterfilet', name: 'Kräuterfilet',
    minQuality: 2, fishCount: 1, herbs: 2,
    stat: 'agi', base: 4, perQuality: 2, servings: 1, runs: 1,
    desc: 'Leicht und flink auf der Zunge.',
  },
  goldbraten: {
    id: 'goldbraten', name: 'Goldbraten',
    minQuality: 3, fishCount: 2, herbs: 1,
    stat: 'ap', base: 6, perQuality: 3, servings: 1, runs: 1,
    desc: 'Ein Festessen für Schwertarme.',
  },
  weisensud: {
    id: 'weisensud', name: 'Sud der Weisen',
    minQuality: 3, fishCount: 1, herbs: 3,
    stat: 'int', base: 5, perQuality: 2, servings: 1, runs: 1,
    desc: 'Klärt den Geist, schärft die Sinne.',
  },
  runenmahl: {
    id: 'runenmahl', name: 'Runenmahl',
    minQuality: 4, fishCount: 1, herbs: 3,
    stat: 'crit', base: 0.02, perQuality: 0.01, servings: 1, runs: 1,
    desc: 'Der Aal glüht noch leicht. Gutes Zeichen.',
  },
  sturmfestmahl: {
    id: 'sturmfestmahl', name: 'Sturmfestmahl',
    minQuality: 4, fishCount: 2, herbs: 5,
    stat: 'sta', base: 12, perQuality: 4, servings: 2, runs: 2,
    desc: 'Ein Bankett — stärkt gleich zwei Helden.',
  },
};

export const RECIPE_ORDER = [
  'fischsuppe', 'roestfisch', 'kraeuterfilet', 'goldbraten',
  'weisensud', 'runenmahl', 'sturmfestmahl',
];

// Buff value for a recipe cooked with fish of the given average quality.
// crit stays a (rounded) float, every other stat is an integer.
export function buffValue(recipe, avgQuality) {
  const raw = recipe.base + recipe.perQuality * Math.max(0, avgQuality - recipe.minQuality);
  return recipe.stat === 'crit' ? Math.round(raw * 1000) / 1000 : Math.round(raw);
}

// Short German description of a buff, e.g. "+6 Stärke" / "+3% Krit. Chance".
export function buffLabel(stat, value) {
  const label = STAT_LABELS[stat] || stat;
  return stat === 'crit' ? `+${Math.round(value * 100)}% ${label}` : `+${value} ${label}`;
}
