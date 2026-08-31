// Misst, wie lange die vier Ärger-Fassungen dauern. Aufruf:
//
//   node scripts/aerger-messung.mjs [partien]
//
// Zufälliges Spiel, weil Ärger kaum Entscheidungen kennt: fast jeder Zug ist
// entweder erzwungen oder gleichwertig. Ein „kluger" Spieler misst hier nichts
// anderes als der Zufall.

import {
  MODI, neuerStand, wuerfeln, zuege, ziehen, zugBeenden, vorbei,
  offeneWuerfe, wurfWaehlen,
} from '../aerger/src/engine.js';

const folge = (saat) => {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function partie(saat, regeln, grenze = 20000) {
  const rnd = folge(saat);
  const s = neuerStand(['A', 'B'], regeln);
  let zuegeGesamt = 0;
  let schlaege = 0;
  let schritte = 0;
  let wahlen = 0;        // Würfe, bei denen beide Zahlen etwas ermöglichen
  let wuerfe = 0;
  while (!vorbei(s) && schritte < grenze) {
    schritte += 1;
    if (offeneWuerfe(s).length) {
      // Wie oft ist die Wahl überhaupt eine? Nur wenn beide Zahlen einen Zug
      // hergeben, hat der Modus mehr zu bieten als der klassische.
      wuerfe += 1;
      const offen = offeneWuerfe(s);
      const geht = offen.map((_, i) => {
        const probe = JSON.parse(JSON.stringify(s));
        wurfWaehlen(probe, i);
        return zuege(probe).length > 0;
      });
      if (geht[0] && geht[1] && offen[0] !== offen[1]) wahlen += 1;
      wurfWaehlen(s, Math.floor(rnd() * offen.length));
      continue;
    }
    if (s.wurf === null) {
      if (s.wuerfeUebrig <= 0) { zugBeenden(s); continue; }
      wuerfeln(s, rnd);
      continue;
    }
    const moeglich = zuege(s);
    if (!moeglich.length) { zugBeenden(s); continue; }
    const z = moeglich[Math.floor(rnd() * moeglich.length)];
    if (z.schlaegt) schlaege += 1;
    ziehen(s, z.figur);
    zuegeGesamt += 1;
  }
  return { s, zuegeGesamt, schlaege, wahlen, wuerfe, beendet: vorbei(s) };
}

const N = Number(process.argv[2] || 400);
for (const m of MODI) {
  let zuegeGesamt = 0;
  let schlaege = 0;
  let sieg0 = 0;
  let offen = 0;
  let wahlen = 0;
  let wuerfe = 0;
  const laengen = [];
  for (let saat = 1; saat <= N; saat++) {
    const p = partie(saat, m.regeln);
    zuegeGesamt += p.zuegeGesamt;
    schlaege += p.schlaege;
    if (p.s.fertig === 0) sieg0 += 1;
    if (!p.beendet) offen += 1;
    wahlen += p.wahlen;
    wuerfe += p.wuerfe;
    laengen.push(p.zuegeGesamt);
  }
  laengen.sort((a, b) => a - b);
  console.log(`\n== ${m.titel} · ${N} Partien ==`);
  console.log(`Züge je Partie   ${(zuegeGesamt / N).toFixed(1)}  (Median ${laengen[Math.floor(N / 2)]}, längste ${laengen[N - 1]})`);
  console.log(`Geschlagen       ${(schlaege / N).toFixed(1)}`);
  console.log(`Siege Spieler A  ${(sieg0 / N * 100).toFixed(1)} %`);
  console.log(`nicht beendet    ${offen}`);
  if (wuerfe) {
    console.log(`echte Wahl       ${(wahlen / N).toFixed(1)} mal je Partie `
      + `(${(wahlen / wuerfe * 100).toFixed(0)} % aller Würfe)`);
  }
}
