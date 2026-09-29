import { describe, it, expect } from 'vitest';
import { simuliere } from '../../heuhaufen/sim.mjs';

// Der Auto-Spieler aus heuhaufen/sim.mjs spielt drei Haufen durch. Er ist kein
// Profi — schafft er es in diesen Grenzen, bleibt niemand stecken.
describe('Balance', () => {
  for (const seed of [1, 2, 3]) {
    it(`Haufen ${seed}: Halle nach einer halben Stunde, alle Nadeln in wenigen Stunden`, () => {
      const { meilen } = simuliere({ seed, maxStunden: 8 });
      const min = (x) => x / 60;
      expect(min(meilen.heugabel)).toBeLessThan(10);
      expect(min(meilen.halle)).toBeGreaterThan(15);
      expect(min(meilen.halle)).toBeLessThan(60);
      expect(meilen.nadeln.length).toBeGreaterThan(0);
      expect(min(meilen.nadeln[0])).toBeLessThan(120);
      expect(meilen.fertig).not.toBeNull();
      expect(min(meilen.fertig)).toBeGreaterThan(90);
      expect(min(meilen.fertig)).toBeLessThan(6 * 60);
    }, 60000);
  }
});
