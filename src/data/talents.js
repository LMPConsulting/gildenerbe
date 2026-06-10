// Talent pool — each grants flat stat mods aggregated into hero.talentMods.
export const TALENTS = {
  kraftvoll:  { id: 'kraftvoll',  name: 'Kraftvoll',  desc: '+4 Stärke',          mods: { str: 4 } },
  flink:      { id: 'flink',      name: 'Flink',      desc: '+3 Beweglichkeit',    mods: { agi: 3 } },
  zaeh:       { id: 'zaeh',       name: 'Zäh',        desc: '+40 max. HP',         mods: { hp: 40 } },
  scharf:     { id: 'scharf',     name: 'Scharf',     desc: '+5% Krit',            mods: { crit: 0.05 } },
  berserker:  { id: 'berserker',  name: 'Berserker',  desc: '+12 Angriffskraft',   mods: { ap: 12 } },
  gepanzert:  { id: 'gepanzert',  name: 'Gepanzert',  desc: '+30 Rüstung',         mods: { armor: 30 } },
};
export const TALENT_IDS = Object.keys(TALENTS);
