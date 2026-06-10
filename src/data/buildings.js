// Gildenhalle buildings. Persistent, bought with Erbe. Each level boosts a
// permanent effect that makes the NEXT hero stronger / runs more rewarding.
export const BUILDINGS = {
  trainingshalle: {
    name: 'Trainingshalle', desc: 'Held startet stärker (+Stats je Stufe)',
    baseCost: 40, costMult: 1.6, maxLevel: 10,
  },
  schatzkammer: {
    name: 'Schatzkammer', desc: '+15% Erbe & längerer Offline-Ertrag je Stufe',
    baseCost: 35, costMult: 1.6, maxLevel: 10,
  },
  waffenkammer: {
    name: 'Waffenkammer', desc: 'Held startet mit gehärteter Ausrüstung',
    baseCost: 60, costMult: 1.7, maxLevel: 6,
  },
  heldengruft: {
    name: 'Heldengruft', desc: 'Gefallene Helden stärken alle künftigen (+Stats)',
    baseCost: 70, costMult: 1.7, maxLevel: 6,
  },
};
export const BUILDING_IDS = Object.keys(BUILDINGS);
