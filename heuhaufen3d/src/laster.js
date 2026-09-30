// Aufträge mit dem Laster, wie im Vorbild: Er fährt vor, setzt rückwärts ans
// Tor und lädt, was auf seiner Ladefläche landet. Die bestellte Ware zählt
// für den Auftrag, alles andere wird normal bezahlt. Ist der Auftrag voll,
// gibt es den Lohn und der Laster fährt ab. Reine Logik.

import { WELT, AUFTRAG_PAUSE } from './daten.js';
import { werte, auftrag, auftragLohn, auftragAblehnen, einnahme } from './wirtschaft.js';
import { nadelZurueck } from './nadeln.js';
import { gegenstandWeg, gegenstandVerkaufen, gegenstandHalme, nadelIn } from './gegenstaende.js';

/** Sekunden für An- und Abfahrt. */
export const LASTER_FAHRT = 7;

/** Ladefläche, wenn der Laster am Tor steht (außen vor der Vorderwand). */
export const LASTER_BETT = {
  x: WELT.torX, x0: WELT.torX - 1.05, x1: WELT.torX + 1.05, z0: WELT.zMin - 3.6, z1: WELT.zMin - 0.3, y: 1.05,
};

export const lasterNeu = () => ({ zustand: 'weg', t: 0, stapel: 0 });
export const lasterBereit = (s) => !!s.laster && s.laster.zustand === 'steht';

/** Wo der Laster gerade ist: Mitte, Blickrichtung (Fahrerhaus vorn), sichtbar? */
export function lasterLage(s) {
  const L = s.laster;
  const parkX = WELT.torX;
  const parkZ = WELT.zMin - 3.7;
  const strasseZ = WELT.zMin - 8.5;
  const glatt = (t) => t * t * (3 - 2 * t);
  if (!L || L.zustand === 'weg') return { sichtbar: false, x: parkX + 40, z: strasseZ, rot: Math.PI, fahrt: 0 };
  // Fahrerhaus zeigt vom Tor weg, die Ladefläche (lokal -x) zum Tor
  if (L.zustand === 'steht') return { sichtbar: true, x: parkX, z: parkZ, rot: Math.PI / 2, fahrt: 0 };
  const u = Math.min(1, L.t / LASTER_FAHRT);
  if (L.zustand === 'kommt') {
    // die Straße entlang, dann rückwärts ans Tor
    if (u < 0.65) {
      const k = glatt(u / 0.65);
      return { sichtbar: true, x: parkX + 40 * (1 - k), z: strasseZ, rot: Math.PI, fahrt: 1 };
    }
    const k = glatt((u - 0.65) / 0.35);
    return { sichtbar: true, x: parkX, z: strasseZ + (parkZ - strasseZ) * k, rot: Math.PI - (Math.PI / 2) * k, fahrt: -1 };
  }
  // fährt ab: vorwärts vom Tor weg, dann die Straße hinunter
  if (u < 0.35) {
    const k = glatt(u / 0.35);
    return { sichtbar: true, x: parkX, z: parkZ + (strasseZ - parkZ) * k, rot: Math.PI / 2 + (Math.PI / 2) * k, fahrt: 1 };
  }
  const k = glatt((u - 0.35) / 0.65);
  return { sichtbar: true, x: parkX - 40 * k, z: strasseZ, rot: Math.PI, fahrt: 1 };
}

export function lasterSchritt(s, dt, ereignisse) {
  const L = s.laster;
  if (!werte(s).frei.has('auftraege')) { L.zustand = 'weg'; return; }
  switch (L.zustand) {
    case 'weg':
      if (s.auftrag.pause <= 0) { L.zustand = 'kommt'; L.t = 0; L.stapel = 0; ereignisse.push({ typ: 'lasterKommt' }); }
      break;
    case 'kommt':
      L.t += dt;
      if (L.t >= LASTER_FAHRT) {
        L.zustand = 'steht'; L.t = 0;
        ereignisse.push({ typ: 'lasterDa', auftrag: auftrag(s.auftrag.nr, s.auftrag.skip) });
      }
      break;
    case 'faehrt':
      L.t += dt;
      if (L.t >= LASTER_FAHRT) { L.zustand = 'weg'; L.t = 0; }
      break;
    default:
      break;
  }
}

/** Ein Stück landet auf der Ladefläche. true, wenn der Laster da ist und es nimmt. */
export function lasterAnnehmen(s, g, ereignisse) {
  if (!lasterBereit(s)) return false;
  const a = s.auftrag;
  const au = auftrag(a.nr, a.skip);
  if (g.art !== au.will) {
    gegenstandVerkaufen(s, g, ereignisse, 'laster');
    s.laster.stapel++;
    return true;
  }
  const n = nadelIn(s, g);
  if (n) nadelZurueck(s, s.hf, n, s.zufallFn || Math.random, ereignisse);
  a.geliefert += g.art === 'roh' ? g.halme : 1;
  s.stat.verkauft += gegenstandHalme(g);
  s.laster.stapel++;
  gegenstandWeg(s, g);
  ereignisse.push({ typ: 'geladen', art: g.art, geliefert: a.geliefert, menge: au.menge });
  if (a.geliefert >= au.menge) {
    const lohn = auftragLohn(s, au);
    einnahme(s, lohn);
    s.stat.auftraege++;
    ereignisse.push({ typ: 'auftrag', auftrag: au, lohn });
    a.nr++;
    a.geliefert = 0;
    a.pause = AUFTRAG_PAUSE;
    s.laster.zustand = 'faehrt';
    s.laster.t = 0;
  }
  return true;
}

/** Fällt ein Stück auf die Ladefläche? */
export function lasterFangen(s, g, ereignisse) {
  if (!lasterBereit(s)) return false;
  const B = LASTER_BETT;
  if (g.x < B.x0 || g.x > B.x1 || g.z < B.z0 || g.z > B.z1) return false;
  if (g.y > B.y + 0.3 || g.y < B.y - 0.5) return false;
  return lasterAnnehmen(s, g, ereignisse);
}

/** Auftrag ablehnen: der Laster fährt leer ab, nach der Pause kommt der nächste. */
export function lasterAblehnen(s) {
  if (!auftragAblehnen(s)) return false;
  if (s.laster.zustand === 'steht' || s.laster.zustand === 'kommt') { s.laster.zustand = 'faehrt'; s.laster.t = 0; }
  return true;
}
