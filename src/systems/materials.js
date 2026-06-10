export const MATERIALS = ['kupfererz', 'eisenerz', 'kraeuter', 'fisch', 'kupferbarren', 'eisenbarren'];

export const MAT_NAMES = {
  kupfererz: 'Kupfererz', eisenerz: 'Eisenerz', kraeuter: 'Kräuter', fisch: 'Fisch',
  kupferbarren: 'Kupferbarren', eisenbarren: 'Eisenbarren',
};

export const makeBag = () => Object.fromEntries(MATERIALS.map((m) => [m, 0]));

export const addMat = (bag, key, n = 1) => { bag[key] = (bag[key] || 0) + n; };

export const hasMats = (bag, cost) => Object.entries(cost).every(([k, v]) => (bag[k] || 0) >= v);

export function consumeMats(bag, cost) {
  if (!hasMats(bag, cost)) return false;
  for (const [k, v] of Object.entries(cost)) bag[k] -= v;
  return true;
}
