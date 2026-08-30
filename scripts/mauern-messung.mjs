// Misst, wie sich Mauern tatsächlich spielt. Aufruf:
//
//   node scripts/mauern-messung.mjs [partien] [modus]
//
// Der Selbstspieler ist die übliche Quoridor-Faustregel: läuft den kürzesten
// Weg, und mauert nur, wenn er hinten liegt und eine Mauer die Gegenseite mehr
// kostet als ihn selbst. Gleichstände werden ausgewürfelt — wer sie nach
// Feldnummer auflöst, misst am Ende seine eigene Reihenfolge mit.

import {
  MODI, neuerStand, zuege, ziehen, wegLaenge,
  mauerZuege, mauerSetzen, mauernUebrig, vorbei,
} from '../mauern/src/engine.js';

const folge = (saat) => {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Wählt aus allen gleich guten Kandidaten einen zufällig aus. */
const beste = (liste, wert, rnd) => {
  let hoch = -Infinity;
  let gleich = [];
  for (const k of liste) {
    const v = wert(k);
    if (v > hoch) { hoch = v; gleich = [k]; } else if (v === hoch) gleich.push(k);
  }
  return { wahl: gleich.length ? gleich[Math.floor(rnd() * gleich.length)] : null, wert: hoch };
};

export function partie(saat, regeln = {}, grenze = 600) {
  const rnd = folge(saat);
  const st = neuerStand(['A', 'B'], regeln);
  let zuegeGesamt = 0;
  let gemauert = 0;
  while (!vorbei(st) && zuegeGesamt < grenze) {
    zuegeGesamt += 1;
    const ich = st.dran;
    const du = ich === 0 ? 1 : 0;

    // Eine einzige Bewertung für beide Zugarten: wie steht der Abstand zum Ziel
    // nachher? Laufen bringt immer genau +1, eine Mauer ihren Nutzen. Damit
    // entscheidet sich von selbst, was besser ist — ohne Sonderregel wie
    // „mauere, wenn du hinten liegst". Solche Regeln kippen schon bei einem
    // Schritt Rückstand, und dann misst man nur noch die eigene Faustregel.
    const bewerten = (nachher) => wegLaenge(nachher, du) - wegLaenge(nachher, ich);
    const laufKandidaten = zuege(st).map((z) => ({ art: 'lauf', z }));
    const mauerKandidaten = mauernUebrig(st, ich) > 0
      ? mauerZuege(st).map((m) => ({ art: 'mauer', m })) : [];
    const { wahl } = beste([...laufKandidaten, ...mauerKandidaten], (k) => (k.art === 'lauf'
      ? bewerten({ ...st, figuren: st.figuren.map((f, i) => (i === ich ? k.z : f)) })
      : bewerten({ ...st, mauern: [...st.mauern, k.m] })), rnd);
    if (!wahl) break;
    if (wahl.art === 'mauer') { mauerSetzen(st, wahl.m.r, wahl.m.c, wahl.m.a); gemauert += 1; }
    else ziehen(st, wahl.z.r, wahl.z.c);
  }
  return { st, zuegeGesamt, gemauert, beendet: vorbei(st) };
}

if (process.argv[1] && process.argv[1].endsWith('mauern-messung.mjs')) {
  const N = Number(process.argv[2] || 200);
  const nur = process.argv[3];
  for (const modus of MODI.filter((m) => !nur || m.id === nur)) {
    let zuegeGesamt = 0;
    let gemauert = 0;
    let sieg0 = 0;
    let offen = 0;
    let ohneMauer = 0;
    const laengen = [];
    for (let saat = 1; saat <= N; saat++) {
      const p = partie(saat, modus.regeln);
      zuegeGesamt += p.zuegeGesamt;
      gemauert += p.gemauert;
      if (!p.beendet) offen += 1;
      if (p.st.fertig === 0) sieg0 += 1;
      if (!p.gemauert) ohneMauer += 1;
      laengen.push(p.zuegeGesamt);
    }
    laengen.sort((a, b) => a - b);
    console.log(`\n== ${modus.titel} · ${N} Partien ==`);
    console.log(`Züge je Partie     ${(zuegeGesamt / N).toFixed(1)}  `
      + `(Median ${laengen[Math.floor(N / 2)]}, längste ${laengen[N - 1]})`);
    console.log(`Mauern gesetzt     ${(gemauert / N).toFixed(1)}   (Partien ohne Mauer: ${ohneMauer})`);
    console.log(`Siege Spieler A    ${(sieg0 / N * 100).toFixed(1)} %`);
    console.log(`nicht beendet      ${offen}`);
  }
}
