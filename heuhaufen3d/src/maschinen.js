// Was jede Maschine tut. Kolbenrechen schieben Heu aus dem Haufen und werfen
// es im Bogen nach hinten, Greifarme heben Heu vom Haufen oder einem Band aufs
// nächste Band, Generatoren verbrennen Heu zu Strom, Scanner prüfen, was
// durchläuft, und halten Nadeln fest, Weichen und Vereiniger verteilen,
// Verarbeiter machen aus Heu Waren. Stücke in einer Maschine sind nur noch
// Einträge { art, halme, nadel }. Reine Logik.

import { PRODUKTE } from './daten.js';
import { haufenHoehe, haufenAbtragen } from './haufen.js';
import { werte } from './wirtschaft.js';
import { nadelnFreilegen, nadelZurueck, nadelFinden } from './nadeln.js';
import { loseAblegen } from './lose.js';
import {
  GROESSE, gegenstandNeu, gegenstandWeg, gegenstandVerkaufen, gegenstandHalme, nadelMitgeben, nadelIn,
  werfenNach, werfenMit,
} from './gegenstaende.js';
import { bandEinlegen, platzAuf, freieStelle, bandNaechster, bandPunkt } from './baender.js';
import {
  BAU_BY_ID, BAND_Y, STAND_TRICHTER, lauf, lokalZuWelt, weltZuLokal, imFussabdruck, gitterBei,
} from './welt.js';
import { lasterAnnehmen, lasterBereit, LASTER_BETT } from './laster.js';

const HALM_WAREN = new Set(['roh', 'knaeuel']);
/** Was im Generator brennt und wie gut (Faktor auf die Halme). */
export const BRENNBAR = { roh: 1, knaeuel: 1, ballen: 1, pellet: 1.5 };
export const BRENN_MAX = 240;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Strom-Anteil 0..1 (Maschinen ohne Strombedarf: 1, wenn eingeschaltet). */
export function anteil(bau) {
  if (bau.aus) return 0;
  return BAU_BY_ID[bau.typ].kw > 0 ? (lauf(bau).strom || 0) : 1;
}

const tempo = (s, bau) => werte(s).maschinenTempo * (lauf(bau).dach ? 1.03 : 1);

/** Standardzustand eines neuen Baus je Typ. */
export function bauZustand(typ) {
  switch (typ) {
    case 'rechen': return { takt: 0, weite: 2.5 };
    case 'arm': case 'vorrangarm': return { filter: 'alle' };
    case 'generator': return { brenn: 0 };
    case 'scanner': return { schlange: [], nadeln: [] };
    case 'weiche': return { modus: 'wechsel', seite: 0, puffer: null };
    case 'vereiniger': return { letzte: -1, puffer: null };
    case 'rohrwerfer': return { schlange: [], winkel: 0, weite: 8, takt: 0 };
    case 'heutreppe': case 'heulift': return { innen: [] };
    case 'radar': return { rest: 5 };
    case 'lampe': return { hell: 1 };
    case 'staffelei': return { striche: [], bild: -1 };
    case 'pellet': return { lager: {}, fort: 0, fertig: [], nadeln: [], weite: 3 };
    case 'silo': case 'presse': case 'wickler': case 'pulper': case 'papier': case 'brikett':
      return { lager: {}, fort: 0, fertig: [], nadeln: [] };
    default: return {};
  }
}

/** Ein Stück wird zum Eintrag in der Maschine; eine Nadel darin bleibt bei der Maschine. */
function aufnehmen(s, bau, g) {
  const rec = { art: g.art, halme: gegenstandHalme(g), nadel: g.nadel };
  const n = nadelIn(s, g);
  if (n) { n.zustand = 'maschine'; n.bei = bau.id; }
  g.nadel = -1;
  gegenstandWeg(s, g);
  return rec;
}

/* ------------------------------------------------------------ Ausgänge */

/** Anschlusspunkt eines Ausgangs in Welt, mit Richtung nach außen. */
export function ausgangPunkt(bau, port) {
  const d = BAU_BY_ID[bau.typ];
  const [lx, lz] = d.aus[port] || [d.b / 2, 0];
  const [x, z] = lokalZuWelt(bau, lx, lz);
  const hoch = bau.typ === 'heutreppe' || bau.typ === 'heulift' ? 2.2 : 0;
  const rx = Math.abs(lx) / (d.b / 2); const rz = Math.abs(lz) / (d.t / 2);
  const [nx, nz] = rx >= rz ? [Math.sign(lx) || 1, 0] : [0, Math.sign(lz) || 1];
  const [wx, wz] = lokalZuWelt({ x: 0, z: 0, rot: bau.rot }, nx, nz);
  return { x, y: (bau.y || 0) + hoch + BAND_Y, z, richtung: [wx, wz] };
}

/** Kann der Ausgang jetzt ein Stück der Ware art abgeben? */
export function ausgangFrei(s, netz, bau, port, art) {
  const ziel = (lauf(bau).aus || [])[port];
  if (ziel) {
    if (ziel.art === 'band') return platzAuf(ziel.band, 0, art);
    if (ziel.art === 'bau') return annehmenMoeglich(s, ziel.bau, art, ziel.port);
    if (ziel.art === 'stand') return true;
    if (ziel.art === 'laster') return lasterBereit(s);
  }
  // Nichts angeschlossen: es fällt vor die Maschine, solange dort nicht zu viel liegt.
  const p = ausgangPunkt(bau, port);
  let n = 0;
  for (const g of s.gegenstaende) if (g.ort === 'boden' && Math.abs(g.x - p.x) < 1.3 && Math.abs(g.z - p.z) < 1.3) n++;
  return n < 8;
}

/** Liegt an der Landestelle schon so viel, dass nichts mehr dazu soll? */
function landestelleVoll(s, x, z) {
  let n = 0;
  for (const g of s.gegenstaende) if (g.ort === 'boden' && Math.abs(g.x - x) < 1.3 && Math.abs(g.z - z) < 1.3 && ++n >= 8) return true;
  return false;
}

/** Gibt einen Eintrag am Ausgang ab (vorher ausgangFrei prüfen). */
export function ausgeben(s, netz, bau, port, rec, ereignisse) {
  const p = ausgangPunkt(bau, port);
  const g = gegenstandNeu(s, rec.art, rec.halme, p.x, p.y, p.z);
  if (rec.nadel >= 0) nadelMitgeben(s, g, s.nadeln[rec.nadel]);
  const ziel = (lauf(bau).aus || [])[port];
  if (ziel && ziel.art === 'band') { bandEinlegen(ziel.band, g, 0); return g; }
  if (ziel && ziel.art === 'bau' && annehmen(s, netz, ziel.bau, g, ziel.port, ereignisse)) return g;
  if (ziel && ziel.art === 'stand') { gegenstandVerkaufen(s, g, ereignisse, 'band'); return g; }
  if (ziel && ziel.art === 'laster' && lasterAnnehmen(s, g, ereignisse)) return g;
  werfenMit(g, p.x + p.richtung[0] * 0.15, p.y, p.z + p.richtung[1] * 0.15, p.richtung[0] * 1.3, 0.9, p.richtung[1] * 1.3);
  return g;
}

/* ------------------------------------------------------------ Annehmen */

function zutatFuer(typ, art) {
  const d = BAU_BY_ID[typ];
  if (!d.rezept) return null;
  if (d.rezept.halme && (art === 'roh' || (art === 'knaeuel' && typ !== 'silo'))) return 'halme';
  return d.rezept[art] ? art : null;
}
const lagerMax = (d, z) => (z === 'halme' ? Math.max(60, d.rezept.halme * 3) : d.rezept[z] * 3);

/** Nähme die Maschine jetzt ein Stück der Ware art (am Eingang port, -1 = Trichter oben)? */
export function annehmenMoeglich(s, bau, art, port = -1) {
  const d = BAU_BY_ID[bau.typ];
  if (!d) return false;
  switch (bau.typ) {
    case 'generator': return !!BRENNBAR[art] && (bau.brenn || 0) < BRENN_MAX;
    case 'scanner': return port !== -1 && (bau.schlange || []).length < 3;
    case 'weiche': return port !== -1 && !bau.puffer && !bau.aus;
    case 'vereiniger': {
      if (port === -1 || bau.puffer || bau.aus) return false;
      // abwechselnd: kommt dieselbe Seite zweimal und wartet die andere, ist die andere dran
      if (port >= 0 && port === bau.letzte) {
        const anderer = (lauf(bau).einBand || [])[1 - port];
        if (anderer && lauf(anderer).voll) return false;
      }
      return true;
    }
    case 'rohrwerfer': return (bau.schlange || []).length < 4;
    case 'heutreppe': case 'heulift': return port === 0 && !(bau.innen || []).some((r) => r.t < 0.55);
    default: {
      const z = zutatFuer(bau.typ, art);
      return !!z && (bau.lager[z] || 0) < lagerMax(d, z);
    }
  }
}

/** Nimmt die Maschine diese Ware grundsätzlich nie (nicht nur gerade nicht)? */
export function nimmtNie(bau, art) {
  const d = BAU_BY_ID[bau.typ];
  if (!d) return true;
  if (bau.typ === 'generator') return !BRENNBAR[art];
  if (d.rezept) return !zutatFuer(bau.typ, art);
  return false;
}

/** Die Maschine nimmt das Stück (vom Band am Eingang port oder von oben). true, wenn angenommen. */
export function annehmen(s, netz, bau, g, port = -1, ereignisse = []) {
  if (!annehmenMoeglich(s, bau, g.art, port)) return false;
  switch (bau.typ) {
    case 'generator': {
      bau.brenn = (bau.brenn || 0) + gegenstandHalme(g) * BRENNBAR[g.art];
      const n = nadelIn(s, g);
      if (n) nadelZurueck(s, s.hf, n, s.zufallFn || Math.random, ereignisse);
      g.nadel = -1;
      gegenstandWeg(s, g);
      ereignisse.push({ typ: 'verbrannt', id: bau.id });
      return true;
    }
    case 'scanner': case 'rohrwerfer':
      bau.schlange.push(aufnehmen(s, bau, g));
      return true;
    case 'weiche': case 'vereiniger':
      bau.puffer = { ...aufnehmen(s, bau, g), zeit: 0 };
      if (bau.typ === 'vereiniger' && port >= 0) bau.letzte = port;
      return true;
    case 'heutreppe': case 'heulift':
      bau.innen.push({ ...aufnehmen(s, bau, g), t: 0 });
      return true;
    default: {
      const z = zutatFuer(bau.typ, g.art);
      bau.lager[z] = (bau.lager[z] || 0) + (z === 'halme' ? gegenstandHalme(g) : 1);
      const rec = aufnehmen(s, bau, g);
      if (rec.nadel >= 0) bau.nadeln.push(rec.nadel);
      return true;
    }
  }
}

/** Fällt ein Stück von oben in einen Maschinentrichter? */
export function maschineFangen(s, netz, g, ereignisse) {
  if (!netz.bauGitter) return false;
  for (const bau of gitterBei(netz.bauGitter, g.x, g.z)) {
    const d = BAU_BY_ID[bau.typ];
    if (!d.ein.length && bau.typ !== 'generator' && bau.typ !== 'rohrwerfer' && !d.rezept) continue;
    const oben = (bau.y || 0) + d.h;
    if (g.y > oben + 0.05 || g.y < oben - 0.7) continue;
    // etwas großzügig: was auf die Dachkante fällt, rutscht hinein
    if (!imFussabdruck(bau, g.x, g.z, 0.12)) continue;
    return annehmen(s, netz, bau, g, -1, ereignisse);
  }
  return false;
}

/* ------------------------------------------------------------ Kolbenrechen */

function rechenSchritt(s, netz, bau, dt, ereignisse) {
  const d = BAU_BY_ID.rechen;
  const l = lauf(bau);
  const w = werte(s);
  // Der Kamm greift so weit nach vorn, bis er Heu findet (0,95 bis 2,2 m): so folgt
  // der Rechen dem Haufen, der vor ihm zurückweicht.
  let fx = 0; let fz = 0; let h = 0;
  for (let vor = d.b / 2 + 0.45; vor <= 2.2 + 1e-6; vor += 0.25) {
    [fx, fz] = lokalZuWelt(bau, vor, 0);
    h = s.hf ? haufenHoehe(s.hf, fx, fz) : 0;
    if (h >= 0.06) break;
  }
  l.kamm = [fx, fz];
  const a = anteil(bau);
  if (a <= 0) { l.status = bau.aus ? 'aus' : 'strom'; return; }
  s.stat.rechenMitStrom = 1;
  if (h < 0.06) { l.status = 'leer'; return; }
  l.status = 'laeuft';
  bau.takt = (bau.takt || 0) + (dt * a * w.rechenTempo * tempo(s, bau)) / d.takt;
  l.phase = bau.takt % 1;
  if (bau.takt < 1) return;
  bau.takt -= 1;
  const weg = haufenAbtragen(s.hf, fx, fz, d.menge, 0.55);
  if (weg < 0.5) return;
  s.stat.abgetragen += weg;
  s.stat.maschine += weg;
  const weite = clamp(bau.weite ?? 2.5, d.wurf[0], d.wurf[1]);
  const [sx, sz] = lokalZuWelt(bau, d.b * 0.2, 0);
  const sy = (bau.y || 0) + d.h + 0.15;
  const [zx, zz] = lokalZuWelt(bau, -d.b / 2 - weite, 0);
  const g = gegenstandNeu(s, 'roh', weg, sx, sy, sz);
  mitnehmen(s, g, fx, fz, 0.7, ereignisse);
  werfenNach(g, sx, sy, sz, zx, (bau.y || 0) + BAND_Y + 0.04, zz, 0.55 + weite * 0.07);
  ereignisse.push({ typ: 'rechen', id: bau.id, x: bau.x, z: bau.z });
}

/** Nadeln, die beim Abtragen frei werden, stecken im weggenommenen Heu. */
function mitnehmen(s, g, x, z, radius, ereignisse) {
  const mit = nadelnFreilegen(s, s.hf, { art: 'maschine', x, z, radius }, ereignisse);
  if (!mit.length) return;
  nadelMitgeben(s, g, mit[0]);
  for (const n of mit.slice(1)) {
    n.zustand = 'lose';
    n.y = Math.max(0.02, haufenHoehe(s.hf, n.x, n.z)) + 0.02;
    n.zeit = s.zeit;
    ereignisse.push({ typ: 'nadelFrei', nadel: n });
  }
}

/* ------------------------------------------------------------ Greifarme */

/** Wohin der Greifer gerade zeigt (für Grafik und das getragene Stück). */
export function greiferPunkt(bau) {
  const d = BAU_BY_ID[bau.typ];
  const l = lauf(bau);
  const y0 = (bau.y || 0);
  const [rx, rz] = lokalZuWelt(bau, 0.55, 0);
  const ruhe = [rx, y0 + d.h + 0.2, rz];
  const job = l.job;
  if (!job) return ruhe;
  const p = l.phase || 0;
  const glatt = (t) => t * t * (3 - 2 * t);
  const misch = (a, b, t, bogen = 0) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * bogen, a[2] + (b[2] - a[2]) * t];
  const von = [job.von[0], job.von[1] + 0.25, job.von[2]];
  const nach = [job.nach[0], job.nach[1] + 0.35, job.nach[2]];
  if (p < 0.4) return misch(ruhe, von, glatt(p / 0.4), 0.3);
  if (p < 0.8) return misch(von, nach, glatt((p - 0.4) / 0.4), 0.7);
  return misch(nach, ruhe, glatt((p - 0.8) / 0.2), 0.2);
}

/** Beste Stelle am Haufen in Reichweite (die nächste mit genug Heu). */
function haufenGriff(s, bau, R) {
  if (!s.hf) return null;
  for (let r = 0.7; r <= R; r += 0.3) {
    let beste = null;
    for (let k = 0; k < 24; k++) {
      const w = (k / 24) * Math.PI * 2;
      const x = bau.x + Math.cos(w) * r;
      const z = bau.z + Math.sin(w) * r;
      const h = haufenHoehe(s.hf, x, z);
      if (h > 0.2 && (!beste || h > beste[1])) beste = [[x, z], h];
    }
    if (beste) return { x: beste[0][0], y: beste[1], z: beste[0][1] };
  }
  return null;
}

function armJobSuchen(s, netz, bau, R, mitHaufen) {
  const filter = bau.filter || 'alle';
  const passt = (art) => filter === 'alle' || filter === art;
  const vorn = (x, z) => weltZuLokal(bau, x, z)[0] > -0.15;
  const nah = (x, z) => Math.hypot(x - bau.x, z - bau.z) <= R;
  // Ziele vorn: Bänder mit Platz, Stand, Laster, Maschinentrichter
  const [px, pz] = lokalZuWelt(bau, Math.min(1.2, R * 0.5), 0);
  const ziele = [];
  for (const band of netz.baender) {
    const nb = bandNaechster(band, px, pz);
    const p = bandPunkt(band, nb.t);
    if (!nah(p.x, p.z) || !vorn(p.x, p.z)) continue;
    ziele.push({ art: 'band', band, t: nb.t, punkt: [p.x, p.y, p.z], d: Math.hypot(p.x - bau.x, p.z - bau.z) });
  }
  if (nah(STAND_TRICHTER.x, STAND_TRICHTER.z) && vorn(STAND_TRICHTER.x, STAND_TRICHTER.z)) {
    ziele.push({ art: 'stand', punkt: [STAND_TRICHTER.x, STAND_TRICHTER.y, STAND_TRICHTER.z], d: 9 });
  }
  if (lasterBereit(s) && nah(LASTER_BETT.x, LASTER_BETT.z0 + 0.6) && vorn(LASTER_BETT.x, LASTER_BETT.z0 + 0.6)) {
    ziele.push({ art: 'laster', punkt: [LASTER_BETT.x, LASTER_BETT.y, LASTER_BETT.z0 + 0.6], d: 9 });
  }
  for (const m of netz.maschinen) {
    if (m === bau || !nah(m.x, m.z) || !vorn(m.x, m.z)) continue;
    const d = BAU_BY_ID[m.typ];
    if (m.typ !== 'generator' && !d.rezept) continue;
    ziele.push({ art: 'bau', bau: m, punkt: [m.x, (m.y || 0) + d.h, m.z], d: 10 });
  }
  if (!ziele.length) return null;
  ziele.sort((a, b) => a.d - b.d);
  const zielFuer = (art, ohneBand) => ziele.find((z) => {
    if (z.art === 'band') return z.band !== ohneBand && freieStelle(z.band, z.t, art) != null;
    if (z.art === 'bau') return annehmenMoeglich(s, z.bau, art, -1);
    return true;
  });
  // Quelle hinten: Stücke auf Bändern, sonst der Haufen
  let beste = null;
  for (const g of s.gegenstaende) {
    if (g.ort !== 'band' || !passt(g.art) || !nah(g.x, g.z) || vorn(g.x, g.z)) continue;
    const d = Math.hypot(g.x - bau.x, g.z - bau.z);
    if (!beste || d < beste.d) {
      const band = netz.bauNachId.get(g.band);
      const ziel = zielFuer(g.art, band);
      if (ziel) beste = { d, g, ziel };
    }
  }
  if (beste) {
    return { quelle: 'band', g: null, gid: beste.g.id, von: [beste.g.x, beste.g.y, beste.g.z], ziel: beste.ziel, nach: beste.ziel.punkt };
  }
  if (mitHaufen && passt('roh')) {
    const griff = haufenGriff(s, bau, R);
    if (!griff) return null;
    const ziel = zielFuer('roh', null);
    if (!ziel) return null;
    return { quelle: 'haufen', von: [griff.x, griff.y, griff.z], ziel, nach: ziel.punkt };
  }
  return null;
}

function armGreifen(s, netz, bau, job, ereignisse) {
  if (job.quelle === 'band') {
    const g = s.gegenstaende.find((x) => x.id === job.gid);
    if (!g || g.ort !== 'band') return null;
    // Schon aus der Reichweite gefahren? Dann greift der Arm ins Leere.
    if (Math.hypot(g.x - bau.x, g.z - bau.z) > BAU_BY_ID[bau.typ].reichweite + 0.3) return null;
    g.ort = 'arm';
    g.band = null;
    return g;
  }
  const d = BAU_BY_ID[bau.typ];
  const [x, , z] = job.von;
  const weg = haufenAbtragen(s.hf, x, z, d.menge, 0.5);
  if (weg < 1) return null;
  s.stat.abgetragen += weg;
  s.stat.maschine += weg;
  const g = gegenstandNeu(s, 'roh', weg, x, job.von[1], z, { ort: 'arm' });
  mitnehmen(s, g, x, z, 0.6, ereignisse);
  return g;
}

function armAblegen(s, netz, bau, job, ereignisse) {
  const g = job.g;
  const z = job.ziel;
  g.ort = 'boden';
  if (z.art === 'band' && netz.bauNachId.get(z.band.id)) {
    const t = freieStelle(z.band, z.t, g.art);
    if (t != null) { bandEinlegen(z.band, g, t); return; }
  } else if (z.art === 'stand') {
    gegenstandVerkaufen(s, g, ereignisse, 'arm');
    return;
  } else if (z.art === 'laster') {
    if (lasterAnnehmen(s, g, ereignisse)) return;
  } else if (z.art === 'bau' && netz.bauNachId.get(z.bau.id)) {
    if (annehmen(s, netz, z.bau, g, -1, ereignisse)) return;
  }
  // Ziel weg oder voll: loslassen, es fällt
  werfenMit(g, g.x, g.y, g.z, 0, 0, 0);
}

function armSchritt(s, netz, bau, dt, ereignisse, mitHaufen) {
  const d = BAU_BY_ID[bau.typ];
  const l = lauf(bau);
  const w = werte(s);
  const a = anteil(bau);
  if (a <= 0) {
    l.status = bau.aus ? 'aus' : 'strom';
    if (l.job && l.job.g) { werfenMit(l.job.g, l.job.g.x, l.job.g.y, l.job.g.z, 0, 0, 0); }
    l.job = null;
    return;
  }
  if (!l.job) {
    l.warte = (l.warte || 0) - dt;
    if (l.warte > 0) return;
    const job = armJobSuchen(s, netz, bau, d.reichweite, mitHaufen);
    if (!job) { l.status = 'wartet'; l.warte = 0.5; return; }
    l.job = job;
    l.phase = 0;
  }
  l.status = 'laeuft';
  const job = l.job;
  const takt = d.takt / (w.armTempo * tempo(s, bau) * a);
  const vorher = l.phase;
  l.phase += dt / takt;
  if (job.quelle === 'band' && !job.g && l.phase < 0.4) {
    // Der Greifer fährt dem Stück auf dem Band nach, statt es an sich zu reißen
    const ziel = s.gegenstaende.find((x) => x.id === job.gid);
    if (ziel && ziel.ort === 'band') job.von = [ziel.x, ziel.y, ziel.z];
  }
  if (vorher < 0.4 && l.phase >= 0.4) {
    job.g = armGreifen(s, netz, bau, job, ereignisse);
    if (!job.g) { l.job = null; l.phase = 0; return; }
    ereignisse.push({ typ: 'greifen', id: bau.id });
  }
  if (job.g) {
    const p = greiferPunkt(bau);
    job.g.x = p[0]; job.g.y = p[1] - GROESSE[job.g.art] - 0.1; job.g.z = p[2];
    if (vorher < 0.8 && l.phase >= 0.8) { armAblegen(s, netz, bau, job, ereignisse); job.g = null; }
  }
  if (l.phase >= 1) { l.job = null; l.phase -= 1; }
}

/* ------------------------------------------------------------ Generator, Brunnen, Radar */

function generatorSchritt(s, netz, bau, dt) {
  const d = BAU_BY_ID.generator;
  const l = lauf(bau);
  const w = werte(s);
  if (bau.aus || !(bau.brenn > 0)) {
    l.leistung = 0; l.brennt = false; l.status = bau.aus ? 'aus' : 'brennstoff';
    return;
  }
  l.leistung = -d.kw * w.generatorMul * w.stromMul;
  l.brennt = true;
  l.status = 'laeuft';
  bau.brenn = Math.max(0, bau.brenn - d.brennstoff * w.brennstoff * dt);
}

function brunnenSchritt(s, netz, bau) {
  const d = BAU_BY_ID.brunnen;
  const l = lauf(bau);
  const a = anteil(bau);
  l.wasserLeistung = -d.wasser * werte(s).wasserMul * tempo(s, bau) * a;
  l.status = a > 0 ? 'laeuft' : bau.aus ? 'aus' : 'strom';
}

function radarSchritt(s, netz, bau, dt, ereignisse) {
  const a = anteil(bau);
  const l = lauf(bau);
  if (a <= 0) { l.status = bau.aus ? 'aus' : 'strom'; return; }
  l.status = 'laeuft';
  const w = werte(s);
  bau.rest = (bau.rest ?? w.radarCD) - dt * a;
  if (bau.rest > 0) return;
  bau.rest = w.radarCD;
  let beste = null;
  let bestD = Infinity;
  for (const n of s.nadeln) {
    if (n.zustand !== 'versteckt') continue;
    const dd = Math.hypot(n.x - bau.x, n.z - bau.z);
    if (dd < bestD) { bestD = dd; beste = n; }
  }
  if (!beste) return;
  netz.radar = { nadel: beste.nr, bis: s.zeit + 12, von: bau.id };
  ereignisse.push({ typ: 'radar', nadel: beste, id: bau.id });
}

/* ------------------------------------------------------------ Scanner, Weiche, Vereiniger */

function scannerSchritt(s, netz, bau, dt, ereignisse) {
  const d = BAU_BY_ID.scanner;
  const l = lauf(bau);
  const a = anteil(bau);
  // Übrige Zeit eines Takts geht ans nächste Stück (große Schritte beim Aufholen)
  let zeit = dt;
  for (let runde = 0; runde < 8; runde++) {
    const f = bau.schlange[0];
    if (!f) { l.status = a > 0 ? 'bereit' : bau.aus ? 'aus' : 'strom'; return; }
    if (!f.geprueft) {
      if (a <= 0) { l.status = bau.aus ? 'aus' : 'strom'; return; }
      const rate = d.rate * werte(s).scanDeckung * tempo(s, bau) * a;
      const noetig = (f.halme - (f.fort || 0)) / rate;
      l.status = 'prueft';
      if (noetig > zeit) {
        f.fort = (f.fort || 0) + rate * zeit;
        l.scan = Math.min(1, f.fort / Math.max(1, f.halme));
        return;
      }
      zeit -= Math.max(0, noetig);
      f.fort = f.halme;
      l.scan = 1;
      f.geprueft = true;
      if (f.nadel >= 0) {
        const n = s.nadeln[f.nadel];
        if (n) { n.zustand = 'scanner'; n.bei = bau.id; bau.nadeln.push(f.nadel); }
        f.nadel = -1;
        ereignisse.push({ typ: 'scannerNadel', id: bau.id, x: bau.x, z: bau.z });
      }
    }
    if (!ausgangFrei(s, netz, bau, 0, f.art)) { l.status = 'stau'; return; }
    bau.schlange.shift();
    ausgeben(s, netz, bau, 0, f, ereignisse);
  }
}

/** Nadeln aus dem Scanner nehmen (Spieler tippt ihn an). Liefert die Zahl. */
export function scannerLeeren(s, bau, ereignisse) {
  const nadeln = bau.nadeln || [];
  bau.nadeln = [];
  for (const nr of nadeln) nadelFinden(s, s.nadeln[nr], ereignisse);
  return nadeln.length;
}

function weicheSchritt(s, netz, bau, dt, ereignisse) {
  const l = lauf(bau);
  const p = bau.puffer;
  if (bau.aus) { l.status = 'aus'; return; }
  if (!p) { l.status = 'bereit'; return; }
  l.status = 'laeuft';
  p.zeit += dt;
  if (p.zeit < 0.3 / werte(s).band) return;
  const modus = bau.modus || 'wechsel';
  const seite = bau.seite || 0;
  const reihe = modus === 'links' ? [0] : modus === 'rechts' ? [1]
    : modus === 'vorrangLinks' ? [0, 1] : modus === 'vorrangRechts' ? [1, 0] : [seite, 1 - seite];
  const angeschlossen = (port) => !!(l.aus || [])[port];
  for (const port of reihe) {
    // Ein Ausgang ohne Band wirft nur ab, wenn gar keiner angeschlossen ist
    if (!angeschlossen(port) && angeschlossen(1 - port) && modus === 'wechsel') continue;
    if (!ausgangFrei(s, netz, bau, port, p.art)) continue;
    bau.puffer = null;
    ausgeben(s, netz, bau, port, p, ereignisse);
    if (modus === 'wechsel') bau.seite = 1 - port;
    return;
  }
  l.status = 'stau';
}

function vereinigerSchritt(s, netz, bau, dt, ereignisse) {
  const l = lauf(bau);
  const p = bau.puffer;
  if (bau.aus) { l.status = 'aus'; return; }
  if (!p) { l.status = 'bereit'; return; }
  p.zeit += dt;
  if (p.zeit < 0.3 / werte(s).band) { l.status = 'laeuft'; return; }
  if (!ausgangFrei(s, netz, bau, 0, p.art)) { l.status = 'stau'; return; }
  l.status = 'laeuft';
  bau.puffer = null;
  ausgeben(s, netz, bau, 0, p, ereignisse);
}

/* ------------------------------------------------------------ Verarbeiter */

function verarbeiterSchritt(s, netz, bau, dt, ereignisse) {
  const d = BAU_BY_ID[bau.typ];
  const l = lauf(bau);
  const w = werte(s);
  // Fertiges hinaus: aufs Band oder (Pellets) im Bogen nach vorn
  while (bau.fertig.length) {
    const f = bau.fertig[0];
    if (d.wurf) {
      const weite = clamp(bau.weite ?? 3, d.wurf[0], d.wurf[1]);
      const [zx, zz] = lokalZuWelt(bau, d.b / 2 + weite, 0);
      if (landestelleVoll(s, zx, zz)) break;
      bau.fertig.shift();
      const [sx, sz] = lokalZuWelt(bau, d.b * 0.35, 0);
      const sy = (bau.y || 0) + d.h * 0.8;
      const g = gegenstandNeu(s, f.art, f.halme, sx, sy, sz);
      if (f.nadel >= 0) nadelMitgeben(s, g, s.nadeln[f.nadel]);
      werfenNach(g, sx, sy, sz, zx, (bau.y || 0) + BAND_Y + 0.04, zz, 0.5 + weite * 0.07);
      continue;
    }
    if (!ausgangFrei(s, netz, bau, 0, f.art)) break;
    bau.fertig.shift();
    ausgeben(s, netz, bau, 0, f, ereignisse);
  }
  l.wasserBedarf = 0;
  if (bau.aus) { l.status = 'aus'; return; }
  if (bau.fertig.length >= 2) { l.status = 'voll'; return; }
  const bedarf = Object.entries(d.rezept).map(([z, m]) => [z, z === 'halme' ? m * w.ausbeute : m]);
  if (!bedarf.every(([z, m]) => (bau.lager[z] || 0) >= m - 1e-9)) { l.status = 'wartet'; return; }
  if (d.wasser) l.wasserBedarf = d.wasser;
  const strom = d.kw > 0 ? (lauf(bau).strom || 0) : 1;
  if (strom <= 0) { l.status = 'strom'; return; }
  const wasser = d.wasser ? (lauf(bau).wasser || 0) : 1;
  if (wasser <= 0) { l.status = 'wasser'; return; }
  l.status = 'laeuft';
  bau.fort = Math.min(1.5, (bau.fort || 0) + d.rate * w.verarbeitung * tempo(s, bau) * (w[bau.typ] || 1) * strom * wasser * dt);
  if (bau.fort < 1) return;
  bau.fort -= 1;
  for (const [z, m] of bedarf) bau.lager[z] = Math.max(0, (bau.lager[z] || 0) - m);
  const nadel = bau.nadeln.length ? bau.nadeln.shift() : -1;
  bau.fertig.push({ art: d.produkt, halme: PRODUKTE[d.produkt].halme, nadel });
  s.stat.produziert[d.produkt] = (s.stat.produziert[d.produkt] || 0) + 1;
  ereignisse.push({ typ: 'produziert', art: d.produkt, id: bau.id, x: bau.x, z: bau.z });
}

/* ------------------------------------------------------------ Rohrwerfer, Heutreppe, Heulift */

function rohrwerferSchritt(s, netz, bau, dt, ereignisse) {
  const d = BAU_BY_ID.rohrwerfer;
  const a = anteil(bau);
  const l = lauf(bau);
  if (a <= 0) { l.status = bau.aus ? 'aus' : 'strom'; return; }
  l.status = bau.schlange.length ? 'laeuft' : 'bereit';
  if (!bau.schlange.length) return;
  bau.takt = Math.min(1, (bau.takt || 0) + dt * a * 2.5 * tempo(s, bau));
  if (bau.takt < 1) return;
  const winkel = (bau.rot || 0) + (bau.winkel || 0);
  const weite = clamp(bau.weite ?? 8, 2, 20);
  const sy = (bau.y || 0) + d.h + 0.1;
  const zx = bau.x + Math.cos(winkel) * weite;
  const zz = bau.z - Math.sin(winkel) * weite;
  if (landestelleVoll(s, zx, zz)) { l.status = 'stau'; return; }
  bau.takt = 0;
  const f = bau.schlange.shift();
  const g = gegenstandNeu(s, f.art, f.halme, bau.x, sy, bau.z);
  if (f.nadel >= 0) nadelMitgeben(s, g, s.nadeln[f.nadel]);
  werfenNach(g, bau.x, sy, bau.z, zx, BAND_Y + 0.04, zz, 0.7 + weite * 0.05);
  ereignisse.push({ typ: 'schuss', id: bau.id });
}

/** Länge des Weges in Heutreppe und Heulift. */
export const innenLaenge = (typ) => (typ === 'heutreppe' ? Math.hypot(4, 2.2) : 3.4);

/** Punkt im Inneren von Heutreppe und Heulift nach t Metern (für die Grafik). */
export function innenPunkt(bau, t) {
  const L = innenLaenge(bau.typ);
  const u = clamp(t / L, 0, 1);
  const y0 = (bau.y || 0) + BAND_Y;
  if (bau.typ === 'heutreppe') {
    const [x, z] = lokalZuWelt(bau, 0, -2 + 4 * u);
    return [x, y0 + 2.2 * u, z];
  }
  // Heulift: senkrecht hoch, oben hinüber
  const hoch = 2.2 / 3.4;
  if (u < hoch) { const [x, z] = lokalZuWelt(bau, -0.33, 0); return [x, y0 + 2.2 * (u / hoch), z]; }
  const [x, z] = lokalZuWelt(bau, -0.33 + 0.93 * ((u - hoch) / (1 - hoch)), 0);
  return [x, y0 + 2.2, z];
}

function innenSchritt(s, netz, bau, dt, ereignisse) {
  const a = anteil(bau);
  const l = lauf(bau);
  if (a <= 0) { l.status = bau.aus ? 'aus' : 'strom'; return; }
  l.status = 'laeuft';
  const L = innenLaenge(bau.typ);
  const v = werte(s).band * a;
  bau.innen.sort((p, q) => q.t - p.t);
  let vorne = null;
  for (let i = 0; i < bau.innen.length; i++) {
    const r = bau.innen[i];
    let nt = r.t + v * dt;
    if (vorne) nt = Math.min(nt, vorne.t - 0.5);
    if (!vorne && nt >= L) {
      if (ausgangFrei(s, netz, bau, 0, r.art)) {
        bau.innen.splice(i, 1);
        i--;
        ausgeben(s, netz, bau, 0, r, ereignisse);
        continue;
      }
      nt = L;
    }
    r.t = Math.max(r.t, nt);
    vorne = r;
  }
}

/* ------------------------------------------------------------ Verzeichnis */

export const MASCHINE = {
  rechen: { schritt: rechenSchritt },
  arm: { schritt: (s, netz, bau, dt, ev) => armSchritt(s, netz, bau, dt, ev, true) },
  vorrangarm: { schritt: (s, netz, bau, dt, ev) => armSchritt(s, netz, bau, dt, ev, false) },
  generator: { schritt: generatorSchritt },
  brunnen: { schritt: brunnenSchritt },
  radar: { schritt: radarSchritt },
  scanner: { schritt: scannerSchritt },
  weiche: { schritt: weicheSchritt },
  vereiniger: { schritt: vereinigerSchritt },
  silo: { schritt: verarbeiterSchritt },
  presse: { schritt: verarbeiterSchritt },
  pellet: { schritt: verarbeiterSchritt },
  wickler: { schritt: verarbeiterSchritt },
  pulper: { schritt: verarbeiterSchritt },
  papier: { schritt: verarbeiterSchritt },
  brikett: { schritt: verarbeiterSchritt },
  rohrwerfer: { schritt: rohrwerferSchritt },
  heutreppe: { schritt: innenSchritt },
  heulift: { schritt: innenSchritt },
};

/** Beim Abbau: was in der Maschine steckt, kommt als Stücke heraus; Nadeln darin gehen zurück in den Haufen. */
export function maschineLeeren(s, bau, ereignisse) {
  const recs = [];
  if (bau.puffer) recs.push(bau.puffer);
  for (const k of ['schlange', 'fertig', 'innen']) if (Array.isArray(bau[k])) recs.push(...bau[k]);
  if (bau.lager) {
    for (const [z, m] of Object.entries(bau.lager)) {
      if (z === 'halme') { if (m >= 1) recs.push({ art: 'roh', halme: Math.floor(m), nadel: -1 }); } else {
        for (let i = 0; i < Math.floor(m); i++) recs.push({ art: z, halme: PRODUKTE[z].halme, nadel: -1 });
      }
    }
  }
  const z = s.zufallFn || Math.random;
  recs.forEach((r, i) => {
    if (i >= 60) {
      // Was nicht mehr als Stück herausfällt, landet als loses Heu daneben
      loseAblegen(s, null, bau.x + (z() - 0.5), bau.z + (z() - 0.5), r.halme || 1, z, { rollen: false, streuen: 0.6 });
      if (r.nadel >= 0 && s.nadeln[r.nadel]) nadelZurueck(s, s.hf, s.nadeln[r.nadel], z, ereignisse);
      return;
    }
    const g = gegenstandNeu(s, r.art, r.halme, bau.x + (z() - 0.5) * 0.8, (bau.y || 0) + 0.8, bau.z + (z() - 0.5) * 0.8);
    if (r.nadel >= 0) nadelMitgeben(s, g, s.nadeln[r.nadel]);
    werfenMit(g, g.x, g.y, g.z, (z() - 0.5) * 2, 1.5, (z() - 0.5) * 2);
  });
  for (const nr of [...(bau.nadeln || [])]) {
    const n = s.nadeln[nr];
    if (n && n.zustand !== 'gefunden') nadelZurueck(s, s.hf, n, z, ereignisse);
  }
  bau.nadeln = [];
}

/** Hält die Maschine eine Nadel? (Warnung beim Abbau) */
export function haeltNadel(s, bau) {
  if ((bau.nadeln || []).length) return true;
  const recs = [bau.puffer, ...(bau.schlange || []), ...(bau.fertig || []), ...(bau.innen || [])];
  return recs.some((r) => r && r.nadel >= 0);
}

/* ------------------------------------------------------------ Anzeige */

export const STATUS_TEXT = {
  laeuft: 'Läuft', strom: 'Kein Strom', leer: 'Kein Heu in Reichweite', wartet: 'Wartet auf Heu', voll: 'Ausgang voll',
  stau: 'Stau am Ausgang', aus: 'Ausgeschaltet', wasser: 'Kein Wasser', bereit: 'Bereit', prueft: 'Prüft',
  brennstoff: 'Kein Brennstoff',
};

/** Zeilen für die Maschinentafel. */
export function maschinenZeilen(s, bau) {
  const d = BAU_BY_ID[bau.typ];
  const l = lauf(bau);
  const z = [];
  if (d.kw > 0) z.push(['Strom', l.netz >= 0 ? `${Math.round((l.strom || 0) * 100)} % von ${d.kw} kW` : 'nicht angeschlossen']);
  if (d.kw < 0) z.push(['Leistung', `${Math.round((l.leistung || 0) * 10) / 10} kW`]);
  if (bau.typ === 'generator') z.push(['Brennstoff', `${Math.round(bau.brenn || 0)} Halme`]);
  if (bau.lager) {
    for (const [zutat, m] of Object.entries(d.rezept || {})) {
      z.push([zutat === 'halme' ? 'Loses Heu' : PRODUKTE[zutat].name, `${Math.floor(bau.lager[zutat] || 0)} / ${m} je Stück`]);
    }
    if (bau.fertig.length) z.push(['Fertig', `${bau.fertig.length} ${PRODUKTE[d.produkt].name}`]);
  }
  if (d.wasser > 0) z.push(['Wasser', `${Math.round((l.wasser || 0) * 100)} %`]);
  if (bau.typ === 'scanner') z.push(['In der Schlange', String(bau.schlange.length)]);
  if ((bau.nadeln || []).length) z.push(['Nadeln', `${bau.nadeln.length} wartet`]);
  if (bau.typ === 'radar') z.push(['Nächster Ping', `${Math.ceil(Math.max(0, bau.rest || 0))} s`]);
  return z;
}
