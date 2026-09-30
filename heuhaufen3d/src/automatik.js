// Die Automatisierung als ein System für spielTakt: baut aus den Bauten das
// Netz (Bänder und ihre Ziele, Anschlüsse der Maschinen, Strom, Wasser,
// Dächer) neu, sobald sich etwas ändert, und treibt dann in fester
// Reihenfolge Strom, Maschinen, Bänder, fliegende Stücke, Drohnen und den
// Laster an. Reine Logik.

import { werte } from './wirtschaft.js';
import { BAU_BY_ID, STAND_TRICHTER, LADERAMPE, lauf, fussabdruck, imFussabdruck, gitterEintragen, hallenGrenzen } from './welt.js';
import { bandGeometrie, bandNaechster, anschlussListe, baenderSchritt, bandFangen, bandEinlegen, platzAuf } from './baender.js';
import { MASCHINE, annehmen, maschineFangen } from './maschinen.js';
import { stromNetzBauen, stromSchritt, wasserNetzBauen, wasserSchritt } from './versorgung.js';
import { gegenstaendeSchritt, gegenstandVerkaufen, imStandTrichter } from './gegenstaende.js';
import { lasterSchritt, lasterAnnehmen, lasterFangen } from './laster.js';
import { drohnenSchritt } from './drohnen.js';
import { bauVersion, auflageBei } from './bauen.js';

/** Wohin das Ende eines Bandes führt. */
function bandZiel(netz, band, ports) {
  const E = band.punkte[band.punkte.length - 1];
  const [x, y, z] = E;
  if (Math.hypot(x - STAND_TRICHTER.x, z - STAND_TRICHTER.z) < 0.95) return { art: 'stand' };
  if (Math.hypot(x - LADERAMPE.x, z - LADERAMPE.z) < 1.1) return { art: 'laster' };
  const ein = ports.find((p) => p.art === 'ein' && Math.hypot(p.x - x, p.z - z) < 0.55 && Math.abs(p.y - y) < 0.45);
  if (ein) {
    lauf(ein.bau).einBand[ein.i] = band;
    return { art: 'bau', bau: ein.bau, port: ein.i };
  }
  let beste = null;
  for (const b of netz.baender) {
    if (b === band) continue;
    const A = b.punkte[0];
    if (Math.hypot(A[0] - x, A[2] - z) < 0.35 && Math.abs(A[1] - y) < 0.45) return { art: 'band', band: b, t: 0 };
    const nb = bandNaechster(b, x, z);
    if (nb.d < 0.45 && Math.abs(nb.y - y) < 0.45 && (!beste || nb.d < beste.d)) beste = { art: 'band', band: b, t: nb.t, d: nb.d };
  }
  return beste;
}

/** Ein Band gibt sein vorderstes Stück ab. */
function abgeben(s, band, ziel, g, ereignisse) {
  const netz = lauf(s).netz;
  switch (ziel.art) {
    case 'stand': gegenstandVerkaufen(s, g, ereignisse, 'band'); return true;
    case 'laster': return lasterAnnehmen(s, g, ereignisse);
    case 'bau': return annehmen(s, netz, ziel.bau, g, ziel.port, ereignisse);
    case 'band':
      if (!platzAuf(ziel.band, ziel.t, g.art)) return false;
      bandEinlegen(ziel.band, g, ziel.t);
      return true;
    default: return false;
  }
}

export function netzBauen(s, alt = null) {
  const netz = {
    baender: [], maschinen: [], maschinenAlle: [], bauNachId: new Map(), bandGitter: new Map(), bandHoechst: 0,
    bauGitter: new Map(), verbraucherAlle: [], wasserVerbraucherAlle: [], strom: [], wasser: [], leitungen: [],
    radar: alt ? alt.radar : null, stromKnapp: false,
  };
  for (const b of s.bauten) netz.bauNachId.set(b.id, b);
  for (const b of s.bauten) {
    const d = BAU_BY_ID[b.typ];
    if (!d) continue;
    const l = lauf(b);
    if (b.typ === 'band') { netz.baender.push(b); l.ziel = null; continue; }
    netz.maschinenAlle.push(b);
    if (MASCHINE[b.typ]) netz.maschinen.push(b);
    if (d.kw > 0) netz.verbraucherAlle.push(b);
    if (d.wasser > 0) netz.wasserVerbraucherAlle.push(b);
    l.aus = [];
    l.einBand = [];
    if (!d.linie) {
      const k = fussabdruck(b.typ, b.x, b.z, b.rot || 0);
      gitterEintragen(netz.bauGitter, k.x0, k.z0, k.x1, k.z1, b);
    }
  }
  for (const band of netz.baender) {
    for (const seg of bandGeometrie(band).segs) {
      gitterEintragen(netz.bandGitter, Math.min(seg.ax, seg.bx) - 0.45, Math.min(seg.az, seg.bz) - 0.45,
        Math.max(seg.ax, seg.bx) + 0.45, Math.max(seg.az, seg.bz) + 0.45, [band, seg]);
      netz.bandHoechst = Math.max(netz.bandHoechst, seg.ay, seg.by);
    }
  }
  const ports = [];
  for (const m of netz.maschinen) for (const p of anschlussListe(m)) ports.push({ ...p, bau: m });
  for (const band of netz.baender) {
    lauf(band).ziel = bandZiel(netz, band, ports);
    const A = band.punkte[0];
    const aus = ports.find((p) => p.art === 'aus' && Math.hypot(p.x - A[0], p.z - A[2]) < 0.55 && Math.abs(p.y - A[1]) < 0.45);
    if (aus && !lauf(aus.bau).aus[aus.i]) lauf(aus.bau).aus[aus.i] = { art: 'band', band };
  }
  // Ausgänge, die direkt an einem Eingang oder am Stand liegen
  for (const p of ports) {
    if (p.art !== 'aus' || lauf(p.bau).aus[p.i]) continue;
    const ein = ports.find((q) => q.art === 'ein' && q.bau !== p.bau && Math.hypot(q.x - p.x, q.z - p.z) < 0.45);
    if (ein) { lauf(p.bau).aus[p.i] = { art: 'bau', bau: ein.bau, port: ein.i }; continue; }
    if (Math.hypot(p.x - STAND_TRICHTER.x, p.z - STAND_TRICHTER.z) < 0.9) lauf(p.bau).aus[p.i] = { art: 'stand' };
  }
  const daecher = s.bauten.filter((b) => b.typ === 'dach');
  for (const m of netz.maschinen) lauf(m).dach = daecher.some((d) => imFussabdruck(d, m.x, m.z));
  stromNetzBauen(s, netz);
  wasserNetzBauen(s, netz);
  netz.abgeben = abgeben;
  const gr = hallenGrenzen(werte(s).hallenFelder);
  netz.welt = {
    grenzen: gr,
    boden: (x, z, y) => auflageBei(s, x, z, y),
    fangen: (st, g, ev) => {
      if (imStandTrichter(g.x, g.y, g.z)) { gegenstandVerkaufen(st, g, ev, 'stand'); return true; }
      if (lasterFangen(st, g, ev)) return true;
      if (maschineFangen(st, netz, g, ev)) return true;
      return bandFangen(netz, g);
    },
  };
  return netz;
}

/** Das aktuelle Netz; neu gebaut, wenn sich Bauten oder Reichweiten geändert haben. */
export function netzHolen(s) {
  const L = lauf(s);
  const w = werte(s);
  const schluessel = `${bauVersion(s)}|${w.spannweite}|${w.abspannung}|${w.frei.has('erdkabel') ? 1 : 0}|${w.hallenFelder}`;
  if (!L.netz || L.netzSchluessel !== schluessel) {
    L.netz = netzBauen(s, L.netz);
    L.netzSchluessel = schluessel;
  }
  return L.netz;
}

/** Das System für spielTakt(s, dt, [automatikSchritt]). */
export function automatikSchritt(s, dt, ereignisse) {
  const netz = netzHolen(s);
  stromSchritt(s, netz);
  wasserSchritt(s, netz);
  for (const bau of netz.maschinen) MASCHINE[bau.typ].schritt(s, netz, bau, dt, ereignisse);
  baenderSchritt(s, dt, netz, ereignisse);
  gegenstaendeSchritt(s, dt, netz.welt, ereignisse);
  drohnenSchritt(s, dt, netz, ereignisse);
  lasterSchritt(s, dt, ereignisse);
  const L = lauf(s);
  L.knappZeit = Math.max(0, (L.knappZeit || 0) - dt);
  if (netz.stromKnapp && L.knappZeit <= 0) {
    L.knappZeit = 30;
    ereignisse.push({ typ: 'stromKnapp' });
  }
  if (netz.radar && s.zeit > netz.radar.bis) netz.radar = null;
}
