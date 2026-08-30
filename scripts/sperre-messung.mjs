// Misst, wie sich Sperrsteine tatsächlich spielt. Aufruf:
//
//   node scripts/sperre-messung.mjs [partien]
//
// Der Selbstspieler ist absichtlich schlicht, aber zielgerichtet: er schlägt,
// wenn er kann, bricht Mauern auf und schiebt sonst die Figur voran, die am
// weitesten ist. Zum Vergleich läuft dieselbe Messung mit reinem Zufall — der
// Unterschied zeigt, wie viel von der Partiedauer nur Herumirren ist.

import {
  neuerStand, wuerfeln, zuege, ziehen, setztGerade, setzbar, sperreSetzen,
  zugBeenden, vorbei,
} from '../sperre/src/engine.js';
import { zumZiel, FELDER, NACHBARN } from '../sperre/src/brett.js';

const saatFolge = (saat) => {
  let x = saat;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
};

/* --------------------------------------------------------- Der Selbstspieler */

function bewerten(stand, z) {
  if (z.gewinnt) return 1e9;
  const von = stand.figuren[stand.dran][z.figur].feld;
  let punkte = (zumZiel(von) - zumZiel(z.ziel)) * 3;
  if (z.schlaegt) {
    const opfer = stand.figuren[z.schlaegt.spieler][z.schlaegt.figur].feld;
    punkte += 40 - zumZiel(opfer);        // je weiter vorn das Opfer, desto besser
  }
  if (z.sperre) punkte += 12;             // Mauer aufbrechen lohnt fast immer
  return punkte;
}

/**
 * Wohin mit dem aufgenommenen Stein? Der Gegenseite direkt vor die Nase.
 *
 * Gibt **alle** gleich guten Felder zurück. Wer hier nach Feldnummer
 * entscheidet, misst am Ende seine eigene Reihenfolge: mit fester Auswahl kam
 * eine Siegquote von 34 zu 66 heraus, mit ausgewürfelten Gleichständen 50 zu 50.
 */
function platzWaehlen(stand, gegner) {
  const frei = setzbar(stand);
  if (!frei.length) return [];
  const vorn = Math.min(...stand.figuren[gegner].map((x) => zumZiel(x.feld)));
  // Ein Feld knapp vor der führenden gegnerischen Figur, möglichst auf einer
  // Leiter (wenige Nachbarn = echtes Nadelöhr).
  let gleich = [];
  let bestWert = -Infinity;
  for (const id of frei) {
    const wert = -Math.abs(zumZiel(id) - (vorn - 1)) * 2 + (4 - NACHBARN[id].length);
    if (wert > bestWert) { bestWert = wert; gleich = [id]; } else if (wert === bestWert) gleich.push(id);
  }
  return gleich;
}

function partie(saat, klug, beginnt = 0) {
  const rnd = saatFolge(saat);
  const s = neuerStand(['A', 'B']);
  s.dran = beginnt;
  let halbzuege = 0;
  let runden = 0;
  let treffer = 0;
  let schlaege = 0;
  while (!vorbei(s) && runden < 5000) {
    runden += 1;
    if (setztGerade(s)) {
      const frei = klug ? platzWaehlen(s, s.setzen.spieler === 0 ? 1 : 0) : setzbar(s);
      sperreSetzen(s, frei[Math.floor(rnd() * frei.length)]);
      continue;
    }
    if (s.wurf === null) wuerfeln(s, rnd);
    const moeglich = zuege(s);
    if (!moeglich.length) { zugBeenden(s); halbzuege += 1; continue; }
    let z = moeglich[Math.floor(rnd() * moeglich.length)];
    if (klug) {
      let best = -Infinity;
      let gleich = [];
      for (const k of moeglich) {
        const w = bewerten(s, k);
        if (w > best) { best = w; gleich = [k]; } else if (w === best) gleich.push(k);
      }
      z = gleich[Math.floor(rnd() * gleich.length)];
    }
    if (z.sperre) treffer += 1;
    if (z.schlaegt) schlaege += 1;
    ziehen(s, z.figur, z.ziel);
    halbzuege += 1;
  }
  return { s, halbzuege, treffer, schlaege, fertig: vorbei(s) };
}

/* ------------------------------------------------------------------ Bericht */

const N = Number(process.argv[2] || 500);

for (const klug of [true, false]) {
  let halbzuege = 0;
  let treffer = 0;
  let schlaege = 0;
  let sieg0 = 0;
  let offen = 0;
  let ohneTreffer = 0;
  let ohneSchlag = 0;
  const laengen = [];
  for (let saat = 1; saat <= N; saat++) {
    const p = partie(saat, klug, saat % 2);   // abwechselnd beginnen, wie im Spiel
    halbzuege += p.halbzuege;
    treffer += p.treffer;
    schlaege += p.schlaege;
    if (!p.fertig) offen += 1;
    if (p.s.fertig === 0) sieg0 += 1;
    if (!p.treffer) ohneTreffer += 1;
    if (!p.schlaege) ohneSchlag += 1;
    laengen.push(p.halbzuege);
  }
  laengen.sort((a, b) => a - b);
  const mittel = (x) => (x / N).toFixed(1);
  console.log(`\n== ${klug ? 'zielgerichtet' : 'rein zufällig'} · ${N} Partien ==`);
  console.log(`Halbzüge je Partie   ${mittel(halbzuege)}  (Median ${laengen[Math.floor(N / 2)]}, `
    + `längste ${laengen[N - 1]})`);
  console.log(`Züge je Seite        ${(halbzuege / N / 2).toFixed(1)}`);
  console.log(`Sperren getroffen    ${mittel(treffer)}   (Partien ohne Treffer: ${ohneTreffer})`);
  console.log(`Geschlagen           ${mittel(schlaege)}   (Partien ohne Schlag: ${ohneSchlag})`);
  console.log(`Siege Spieler A      ${(sieg0 / N * 100).toFixed(1)} %`);
  console.log(`nicht beendet        ${offen}`);
}
