// Strom und Wasser. Strom: der Hausanschluss an der Wand liefert 5 kW,
// Masten verlängern die Leitung (Spannweite), Maschinen hängen am nächsten
// Mast in Reichweite (Abspannung). Generatoren speisen ein. Reicht der Strom
// nicht, laufen alle Maschinen im Netz anteilig langsamer. Tippen am Mast
// schaltet das ganze Netz. Wasser: Brunnen und Leitungen, geteilt wie Strom.
// Reine Logik.

import { HAUSANSCHLUSS_KW } from './daten.js';
import { werte } from './wirtschaft.js';
import { BAU_BY_ID, HAUSANSCHLUSS, lauf, fussabdruck, streckenAbstand } from './welt.js';

const MAST_OBEN = 4.3;

/** Abstand von (x, z) zum Fußabdruck eines Baus (0, wenn darin). */
function abstandZuBau(bau, x, z) {
  const k = fussabdruck(bau.typ, bau.x, bau.z, bau.rot || 0);
  const dx = Math.max(k.x0 - x, 0, x - k.x1);
  const dz = Math.max(k.z0 - z, 0, z - k.z1);
  return Math.hypot(dx, dz);
}

function unionFind(n) {
  const p = Array.from({ length: n }, (_, i) => i);
  const finde = (i) => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; } return i; };
  return { finde, vereine: (a, b) => { const ra = finde(a); const rb = finde(b); if (ra !== rb) p[ra] = rb; } };
}

/** Punkt, an dem eine Leitung am Bau ansetzt. */
export function leitungsPunkt(bau) {
  if (bau.typ === 'mast') return [bau.x, (bau.y || 0) + MAST_OBEN, bau.z];
  const d = BAU_BY_ID[bau.typ];
  return [bau.x, (bau.y || 0) + d.h * 0.9, bau.z];
}

/**
 * Stromnetze aus den Bauten bilden. Knoten: Hausanschluss, Masten, Generatoren.
 * Verbraucher hängen am nächsten Knoten in Abspannweite.
 */
export function stromNetzBauen(s, netz) {
  const w = werte(s);
  const erdkabel = w.frei.has('erdkabel');
  const knoten = [{ art: 'haus', x: HAUSANSCHLUSS.x, z: HAUSANSCHLUSS.z, punkt: [HAUSANSCHLUSS.x, HAUSANSCHLUSS.y, HAUSANSCHLUSS.z] }];
  const verbraucher = [];
  for (const b of s.bauten) {
    const d = BAU_BY_ID[b.typ];
    if (!d) continue;
    if (b.typ === 'mast') knoten.push({ art: 'mast', bau: b, x: b.x, z: b.z, punkt: leitungsPunkt(b) });
    else if (d.kw < 0) knoten.push({ art: 'gen', bau: b, x: b.x, z: b.z, punkt: leitungsPunkt(b) });
    else if (d.kw > 0) verbraucher.push(b);
    lauf(b).netz = -1;
  }
  const uf = unionFind(knoten.length);
  const leitungen = [];
  for (let i = 0; i < knoten.length; i++) {
    for (let j = i + 1; j < knoten.length; j++) {
      const a = knoten[i]; const b = knoten[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      const mastMast = a.art !== 'gen' && b.art !== 'gen';
      let reicht = false;
      let erd = false;
      if (mastMast) {
        if (d <= w.spannweite) reicht = true;
        else if (erdkabel && a.art === 'mast' && b.art === 'mast') { reicht = true; erd = true; }
      } else {
        // Generator: hängt wie eine Maschine am nächsten Mast oder direkt am Hausanschluss
        const gen = a.art === 'gen' ? a : b;
        const anderer = gen === a ? b : a;
        if (anderer.art !== 'gen' && abstandZuBau(gen.bau, anderer.x, anderer.z) <= w.abspannung) reicht = true;
      }
      if (!reicht) continue;
      if (uf.finde(i) !== uf.finde(j) || !erd) {
        uf.vereine(i, j);
        if (!erd) leitungen.push({ a: a.punkt, b: b.punkt, aBau: a.bau ? a.bau.id : null, bBau: b.bau ? b.bau.id : null });
      }
    }
  }
  // Verbraucher an den nächsten Knoten (Mast oder Hausanschluss, auch Generator) in Reichweite
  const anschluss = new Map();
  for (const v of verbraucher) {
    let beste = -1;
    let bestD = w.abspannung;
    knoten.forEach((k, i) => {
      const dd = abstandZuBau(v, k.x, k.z);
      if (dd <= bestD) { bestD = dd; beste = i; }
    });
    if (beste >= 0) {
      anschluss.set(v, beste);
      leitungen.push({ a: knoten[beste].punkt, b: leitungsPunkt(v), fall: true, aBau: knoten[beste].bau ? knoten[beste].bau.id : null, bBau: v.id });
    }
  }
  // Netze zusammenstellen
  const netze = new Map();
  const netzVon = (i) => {
    const r = uf.finde(i);
    if (!netze.has(r)) netze.set(r, { id: netze.size, haus: false, masten: [], erzeuger: [], verbraucher: [], angebot: 0, bedarf: 0, anteil: 1, aus: false });
    return netze.get(r);
  };
  knoten.forEach((k, i) => {
    const n = netzVon(i);
    if (k.art === 'haus') n.haus = true;
    else if (k.art === 'mast') { n.masten.push(k.bau); lauf(k.bau).netz = n.id; }
    else { n.erzeuger.push(k.bau); lauf(k.bau).netz = n.id; }
  });
  for (const [v, i] of anschluss) {
    const n = netzVon(i);
    n.verbraucher.push(v);
    lauf(v).netz = n.id;
  }
  netz.strom = [...netze.values()];
  netz.leitungen = leitungen;
}

/** Strombilanz je Netz. Generatoren melden ihre Leistung in lauf(bau).leistung (kW). */
export function stromSchritt(s, netz) {
  const w = werte(s);
  let knapp = false;
  for (const n of netz.strom) {
    n.aus = n.masten.some((m) => m.aus);
    n.angebot = (n.haus ? HAUSANSCHLUSS_KW : 0) + n.erzeuger.reduce((sum, g) => sum + (g.aus ? 0 : lauf(g).leistung || 0), 0);
    n.bedarf = n.verbraucher.reduce((sum, v) => sum + (v.aus ? 0 : BAU_BY_ID[v.typ].kw * w.verbrauch), 0);
    n.anteil = n.aus ? 0 : n.bedarf > 0 ? Math.min(1, n.angebot / n.bedarf) : 1;
    if (!n.aus && n.anteil < 0.999 && n.verbraucher.length) knapp = true;
    for (const v of n.verbraucher) { lauf(v).strom = v.aus ? 0 : n.anteil; lauf(v).netzAus = n.aus; }
  }
  // Verbraucher ohne Netz bekommen nichts
  for (const b of netz.verbraucherAlle) if (lauf(b).netz < 0) { lauf(b).strom = 0; lauf(b).netzAus = false; }
  netz.stromKnapp = knapp;
}

/** Tippen am Mast: das ganze Netz ein- oder ausschalten. Liefert den neuen Zustand (true = an). */
export function netzSchalten(s, netz, mast) {
  if (s.stat) s.stat.netzGeschaltet = (s.stat.netzGeschaltet || 0) + 1;
  const n = netz.strom.find((x) => x.masten.includes(mast));
  if (!n) { mast.aus = !mast.aus; return !mast.aus; }
  const jetztAus = !n.masten.some((m) => m.aus);
  for (const m of n.masten) m.aus = jetztAus;
  return !jetztAus;
}

/** Netzinfo für einen Bau (Mast, Maschine): { angebot, bedarf, anteil, aus } oder null. */
export function netzVon(netz, bau) {
  const id = lauf(bau).netz;
  return id >= 0 ? netz.strom.find((n) => n.id === id) || null : null;
}

/* ------------------------------------------------------------ Wasser */

const WASSER_KNOTEN = new Set(['brunnen', 'pulper', 'papier', 'wasserweiche', 'leitung']);

/** Wassernetze: Brunnen, Leitungen, Weichen und Verbraucher, die sich berühren. */
export function wasserNetzBauen(s, netz) {
  const teile = s.bauten.filter((b) => WASSER_KNOTEN.has(b.typ));
  const uf = unionFind(teile.length);
  const beruehrt = (a, b) => {
    const linie = (x) => x.typ === 'leitung' && x.a && x.b;
    if (linie(a) && linie(b)) {
      for (const p of [a.a, a.b]) if (streckenAbstand(p[0], p[1], b.a[0], b.a[1], b.b[0], b.b[1]).d < 0.45) return true;
      for (const p of [b.a, b.b]) if (streckenAbstand(p[0], p[1], a.a[0], a.a[1], a.b[0], a.b[1]).d < 0.45) return true;
      return false;
    }
    if (linie(a) || linie(b)) {
      const l = linie(a) ? a : b;
      const m = l === a ? b : a;
      return [l.a, l.b].some((p) => abstandZuBau(m, p[0], p[1]) < 0.6);
    }
    // zwei Maschinen direkt nebeneinander
    const ka = fussabdruck(a.typ, a.x, a.z, a.rot || 0);
    return abstandZuBau(b, Math.max(ka.x0, Math.min(b.x, ka.x1)), Math.max(ka.z0, Math.min(b.z, ka.z1))) < 0.25;
  };
  for (let i = 0; i < teile.length; i++) for (let j = i + 1; j < teile.length; j++) if (beruehrt(teile[i], teile[j])) uf.vereine(i, j);
  const netze = new Map();
  teile.forEach((b, i) => {
    const r = uf.finde(i);
    if (!netze.has(r)) netze.set(r, { brunnen: [], verbraucher: [], angebot: 0, bedarf: 0, anteil: 0 });
    const n = netze.get(r);
    if (b.typ === 'brunnen') n.brunnen.push(b);
    else if (BAU_BY_ID[b.typ].wasser > 0) n.verbraucher.push(b);
    lauf(b).wasserNetz = n;
  });
  netz.wasser = [...netze.values()];
}

/** Wasserbilanz: Brunnen melden lauf(b).wasserLeistung, Verbraucher lauf(b).wasserBedarf. */
export function wasserSchritt(s, netz) {
  for (const b of netz.wasserVerbraucherAlle || []) lauf(b).wasser = 0;
  for (const n of netz.wasser) {
    n.angebot = n.brunnen.reduce((sum, b) => sum + (lauf(b).wasserLeistung || 0), 0);
    n.bedarf = n.verbraucher.reduce((sum, b) => sum + (lauf(b).wasserBedarf || 0), 0);
    n.anteil = n.bedarf > 0 ? Math.min(1, n.angebot / n.bedarf) : (n.angebot > 0 ? 1 : 0);
    for (const b of n.verbraucher) lauf(b).wasser = n.anteil;
  }
}
