import { describe, it, expect } from 'vitest';
import { simuliere } from '../../heuhaufen/sim.mjs';

// Der Auto-Spieler aus heuhaufen/sim.mjs spielt Ladungen durch. Er ist kein
// Profi — schafft er es in diesen Grenzen, bleibt niemand stecken.
describe('Balance', () => {
  for (const seed of [1, 2, 3]) {
    it(`Seed ${seed}: Band früh, erste Nadel bald, Ladung 1 in zwei Stunden, Maschinen tragen die Last`, () => {
      const { s, meilen } = simuliere({ seed, maxStunden: 8, ladungen: 2 });
      const min = (x) => x / 60;
      expect(min(meilen.heugabel)).toBeLessThan(5);
      expect(min(meilen.band)).toBeGreaterThan(5);
      expect(min(meilen.band)).toBeLessThan(25);
      expect(min(meilen.nadeln[0])).toBeLessThan(40);
      expect(meilen.fertig).not.toBeNull();
      expect(min(meilen.fertig)).toBeGreaterThan(80);
      expect(min(meilen.fertig)).toBeLessThan(200);
      // Ladung 2 wird geschafft, ohne dass der Spieler feststeckt.
      expect(meilen.ladungen.length).toBe(2);
      const ges = s.stat.abgetragen;
      expect(s.stat.maschine / ges).toBeGreaterThan(0.5);
      expect(s.stat.hand / ges).toBeLessThan(0.4);
    }, 60000);
  }

  it('ein langsamer Spieler (ein Stich pro Sekunde) kommt auch durch', () => {
    const { meilen } = simuliere({ seed: 4, maxStunden: 8, tippsProSekunde: 1 });
    expect(meilen.fertig).not.toBeNull();
    expect(meilen.fertig / 3600).toBeLessThan(5);
  }, 60000);
});
