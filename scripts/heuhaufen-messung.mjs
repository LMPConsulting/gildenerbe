// Misst, wie lange ein Heuhaufen dauert. Aufruf:
//
//   node scripts/heuhaufen-messung.mjs [haufen] [tipps-pro-sekunde]
//
// Der Auto-Spieler aus heuhaufen/sim.mjs spielt die gewünschte Zahl Haufen mit
// verschiedenen Seeds durch und meldet, wann die Meilensteine fallen und wo
// das Heu am Ende herkam.

import { simuliere } from '../heuhaufen/sim.mjs';
import { techGekauft, TECH_STUFEN_GESAMT } from '../heuhaufen/src/engine.js';

const zahl = Number(process.argv[2]) || 5;
const tipps = Number(process.argv[3]) || 3;
const min = (x) => (x == null ? '   –  ' : `${(x / 60).toFixed(0).padStart(4)} min`);

console.log(`${zahl} Haufen, ${tipps} Stiche pro Sekunde\n`);
console.log('Seed  Heugabel  Band      1. Nadel  Hälfte    Ladung 1  Stufen    Hand/Drohne/Maschine');
const fertig = [];
for (let seed = 1; seed <= zahl; seed++) {
  const { s, meilen } = simuliere({ seed, maxStunden: 12, tippsProSekunde: tipps });
  const ges = s.stat.abgetragen || 1;
  const anteil = (x) => `${Math.round(((x || 0) / ges) * 100)}`.padStart(3);
  console.log([
    String(seed).padStart(4), min(meilen.heugabel), min(meilen.band), min(meilen.nadeln[0]),
    min(meilen.halbzeit), min(meilen.fertig),
    `${techGekauft(s)}/${TECH_STUFEN_GESAMT}`.padStart(9),
    `  ${anteil(s.stat.hand)} % /${anteil(s.stat.drohne)} % /${anteil(s.stat.maschine)} %`,
  ].join('  '));
  if (meilen.fertig) fertig.push(meilen.fertig);
}
if (fertig.length) {
  fertig.sort((a, b) => a - b);
  console.log(`\nMedian bis Ladung 1 geschafft: ${min(fertig[Math.floor(fertig.length / 2)]).trim()}`);
}
