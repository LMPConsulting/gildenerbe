// Heudrohnen: starten an der Drohnenstation, suchen lose Halme und liegen
// gebliebene Stücke, fliegen sie zum Stand und werfen sie in den Trichter.
// Die Drohnen selbst werden nicht gespeichert; nach dem Laden starten sie neu.
// Reine Logik.

import { werte, preisRoh, verkaufen } from './wirtschaft.js';
import { gegenstandVerkaufen, gegenstandHalme } from './gegenstaende.js';
import { STAND_TRICHTER, lauf } from './welt.js';

const FLUG = 3.2; // Reisehöhe
const TEMPO = 5; // m/s waagrecht
const STEIGEN = 2.6;
const JE_STATION = 3;

function naechstesZiel(s, d, basis, vergeben) {
  let beste = null;
  let bestD = 40;
  for (const b of s.lose) {
    if (b.m < 3 || vergeben.has(b)) continue;
    const dd = Math.hypot(b.x - d.x, b.z - d.z);
    if (dd < bestD && Math.hypot(b.x - basis.x, b.z - basis.z) < 40) { bestD = dd; beste = { art: 'lose', ref: b }; }
  }
  for (const g of s.gegenstaende) {
    if (g.ort !== 'boden' || vergeben.has(g)) continue;
    const dd = Math.hypot(g.x - d.x, g.z - d.z);
    if (dd < bestD && Math.hypot(g.x - basis.x, g.z - basis.z) < 40) { bestD = dd; beste = { art: 'stueck', ref: g }; }
  }
  return beste;
}

const zielPunkt = (z) => (z.art === 'lose' ? [z.ref.x, 0, z.ref.z] : [z.ref.x, z.ref.y, z.ref.z]);
const zielDa = (s, z) => (z.art === 'lose' ? z.ref.m > 0.5 && s.lose.includes(z.ref) : z.ref.ort === 'boden');

/** Fliegt auf (x, y, z) zu: erst auf Reisehöhe, dann hinüber, dann hinab. Liefert true, wenn angekommen. */
function fliegen(d, x, y, z, dt) {
  const dx = x - d.x;
  const dz = z - d.z;
  const weit = Math.hypot(dx, dz);
  const reise = Math.max(FLUG, y + 1.2);
  if (weit > 0.25) {
    if (d.y < reise - 0.3 && weit > 1.5) { d.y = Math.min(reise, d.y + STEIGEN * dt); }
    const schritt = Math.min(weit, TEMPO * dt);
    d.x += (dx / weit) * schritt;
    d.z += (dz / weit) * schritt;
    d.rot = Math.atan2(-dz, dx);
    if (weit < 1.5) d.y += (y - d.y) * Math.min(1, dt * 3);
    else d.y += (reise - d.y) * Math.min(1, dt * 2);
    return false;
  }
  d.y += (y - d.y) * Math.min(1, dt * 4);
  return Math.abs(d.y - y) < 0.12;
}

export function drohnenSchritt(s, dt, netz, ereignisse) {
  const w = werte(s);
  const L = lauf(s);
  const stationen = netz.maschinenAlle.filter((b) => b.typ === 'drohnenstation' && !b.aus);
  const soll = stationen.length ? Math.min(Math.floor(w.drohnenMax), stationen.length * JE_STATION) : 0;
  const liste = L.drohnen || (L.drohnen = []);
  while (liste.length < soll) {
    const st = stationen[liste.length % stationen.length];
    liste.push({ nr: liste.length, station: st.id, x: st.x, y: (st.y || 0) + 0.55, z: st.z, rot: 0, zustand: 'ruht', warte: 0.4 + liste.length * 0.5, last: 0, stueck: null, ziel: null });
  }
  while (liste.length > soll) {
    const d = liste.pop();
    if (d.stueck) { d.stueck.ort = 'flug'; d.stueck.vx = 0; d.stueck.vy = 0; d.stueck.vz = 0; d.stueck.flug = 0; }
  }
  const vergeben = new Set(liste.filter((d) => d.ziel).map((d) => d.ziel.ref));
  const kapazitaet = Math.max(10, 10 * w.drohnenRate);
  for (const d of liste) {
    const st = netz.bauNachId.get(d.station) || stationen[0];
    d.station = st.id;
    const heim = [st.x, (st.y || 0) + 0.55, st.z];
    switch (d.zustand) {
      case 'ruht':
        d.warte -= dt;
        if (d.warte > 0) break;
        d.ziel = naechstesZiel(s, d, st, vergeben);
        if (d.ziel) { vergeben.add(d.ziel.ref); d.zustand = 'hin'; } else d.warte = 1.5;
        break;
      case 'hin': {
        if (!zielDa(s, d.ziel)) { d.ziel = null; d.zustand = 'heim'; break; }
        const [x, y, z] = zielPunkt(d.ziel);
        if (fliegen(d, x, y + 0.45, z, dt)) { d.zustand = 'nimmt'; d.warte = 0.5; }
        break;
      }
      case 'nimmt':
        d.warte -= dt;
        if (d.warte > 0) break;
        if (d.ziel && zielDa(s, d.ziel)) {
          if (d.ziel.art === 'lose') {
            const b = d.ziel.ref;
            const n = Math.min(b.m, kapazitaet);
            b.m -= n;
            d.last = n;
            if (b.m <= 0.5) s.lose = s.lose.filter((x) => x !== b);
          } else {
            d.stueck = d.ziel.ref;
            d.stueck.ort = 'drohne';
          }
        }
        d.ziel = null;
        d.zustand = d.last > 0 || d.stueck ? 'bringt' : 'heim';
        break;
      case 'bringt': {
        if (d.stueck) { d.stueck.x = d.x; d.stueck.y = d.y - 0.45; d.stueck.z = d.z; }
        if (!fliegen(d, STAND_TRICHTER.x, STAND_TRICHTER.y + 1.1, STAND_TRICHTER.z, dt)) break;
        if (d.stueck) {
          s.stat.drohne += gegenstandHalme(d.stueck);
          d.stueck.x = STAND_TRICHTER.x; d.stueck.y = STAND_TRICHTER.y; d.stueck.z = STAND_TRICHTER.z;
          gegenstandVerkaufen(s, d.stueck, ereignisse, 'drohne');
          d.stueck = null;
        }
        if (d.last > 0) {
          const betrag = d.last * preisRoh(w);
          verkaufen(s, betrag, d.last, null, 'drohne');
          ereignisse.push({ typ: 'verkauft', betrag, halme: d.last, wo: 'drohne', x: STAND_TRICHTER.x, y: STAND_TRICHTER.y, z: STAND_TRICHTER.z, art: 'roh' });
          s.stat.drohne += d.last;
          d.last = 0;
        }
        d.ziel = naechstesZiel(s, d, st, vergeben);
        if (d.ziel) { vergeben.add(d.ziel.ref); d.zustand = 'hin'; } else d.zustand = 'heim';
        break;
      }
      case 'heim':
        if (fliegen(d, heim[0], heim[1], heim[2], dt)) { d.zustand = 'ruht'; d.warte = 1; }
        break;
      default:
        d.zustand = 'heim';
    }
  }
}

/** Die Drohnen für die Grafik. */
export const drohnenListe = (s) => lauf(s).drohnen || [];
