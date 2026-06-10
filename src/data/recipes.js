// Smelt: ore -> bar. Craft: bars -> gear. Fish table for the angling minigame.
export const SMELT = {
  kupferbarren: { name: 'Kupferbarren', in: { kupfererz: 2 }, out: 'kupferbarren' },
  eisenbarren: { name: 'Eisenbarren', in: { eisenerz: 2 }, out: 'eisenbarren' },
};

export const CRAFT = {
  kupferruestung: { name: 'Kupfer-Rüstung', in: { kupferbarren: 3 }, slot: 'brust', ilvl: 4 },
  eisenklinge: { name: 'Eisenklinge', in: { eisenbarren: 3 }, slot: 'waffe', ilvl: 6 },
  kupferhelm: { name: 'Kupferhelm', in: { kupferbarren: 2 }, slot: 'kopf', ilvl: 3 },
};

export const FISH_TABLE = [
  { id: 'schlammkarpfen', name: 'Schlammkarpfen', weight: 50 },
  { id: 'silberfisch', name: 'Silberfisch', weight: 30 },
  { id: 'goldforelle', name: 'Goldforelle', weight: 15 },
  { id: 'runenaal', name: 'Runenaal', weight: 5 },
];
