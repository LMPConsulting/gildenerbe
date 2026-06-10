// Krieger ability definitions. Pure data — combatSim reads coefs/costs/cooldowns.
export const ABILITIES = {
  heroic_strike: { id: 'heroic_strike', name: 'Heldenhafter Stoß', kind: 'attack',
    cost: 15, cooldown: 0,    weaponCoef: 1.2, apCoef: 0.1, note: '120% Waffenschaden' },
  whirlwind:     { id: 'whirlwind',     name: 'Wirbelwind',       kind: 'aoe',
    cost: 25, cooldown: 6000, weaponCoef: 0.8, apCoef: 0.1, note: '80% an alle' },
  shield_block:  { id: 'shield_block',  name: 'Schildblock',      kind: 'defensive',
    cost: 10, cooldown: 12000, blockMs: 4000, blockReduce: 0.6, note: 'mildert nächsten Treffer' },
  execute:       { id: 'execute',       name: 'Hinrichten',       kind: 'execute',
    cost: 25, cooldown: 8000, weaponCoef: 2.5, apCoef: 0.2, threshold: 0.2, note: 'Finisher <20%' },
};

export const getAbility = (id) => ABILITIES[id];
