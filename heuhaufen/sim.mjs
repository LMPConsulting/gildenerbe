// Ein Auto-Spieler, der den Haufen von vorn bis hinten abträgt. Er tippt
// dreimal pro Sekunde, geht bei voller Tasche zum Ankauf und kauft immer das
// Billigste, was ihm gerade etwas bringt. Kein guter Spieler, aber ein
// ehrlicher: schafft er es in vernünftiger Zeit, schafft es jeder.
//
// Benutzt von tests/heuhaufen/balance.test.js und scripts/heuhaufen-messung.mjs.

import { TECH, MASCHINEN } from './src/daten.js';
import {
  neuerStand, werte, tick, tippen, verkaufen, saugen, techStatus, techKosten, techKaufen,
  maschineFrei, maschinenKosten, maschineKaufen, plaetzeBelegt, fabrik, drohneKaufen,
  drohnenKosten, ausschussTippen, imAusschuss, nadelnGefunden, alleNadeln, anzahl, fundeVerkaufen,
  fundWert, MASCHINE_NACH_ID, rest,
} from './src/engine.js';

/** Was lohnt sich an Maschinen gerade? Liefert die ids, die der Spieler kaufen würde. */
function sinnvolleMaschinen(s) {
  const w = werte(s);
  const f = fabrik(s);
  const ids = [];
  const frei = (id) => maschineFrei(s, id);
  const stromKnapp = f.strom < 1 || (f.bedarf > 0 && f.erzeugt - f.bedarf < 4);
  if (stromKnapp) {
    for (const id of ['generator', 'kessel', 'wind', 'solar', 'biogas', 'fusion']) if (frei(id)) ids.push(id);
    return ids;
  }
  if (frei('scanner') && f.deckung < 1) ids.push('scanner');
  if (frei('sortierer') && f.sortiert < 0.8) ids.push('sortierer');
  if (frei('sichter') && anzahl(s, 'sichter') < 1 && imAusschuss(s)) ids.push('sichter');
  if (f.foerderung < w.band * 0.95) {
    ids.push('arm');
    if (frei('bagger')) ids.push('bagger');
  }
  const roh = f.roh;
  const pro = (id) => MASCHINE_NACH_ID[id].rate * w.verarbeitung * w.maschinenTempo * (w[id] || 1);
  if (frei('pulper') && roh > 10 * pro('pulper')) ids.push('pulper');
  if (frei('presse') && roh > 20 * pro('presse')) ids.push('presse');
  if (frei('muehle') && roh > 5 * pro('muehle')) ids.push('muehle');
  if (frei('ziegel') && (f.produkte.ballen || 0) > pro('ziegel') && (f.produkte.brei || 0) > 2 * pro('ziegel')) ids.push('ziegel');
  if (frei('papier') && (f.produkte.brei || 0) > 2 * pro('papier')) ids.push('papier');
  if (frei('wickler') && (f.produkte.ballen || 0) > pro('wickler')) ids.push('wickler');
  return ids.filter(frei);
}

function einkaufen(s) {
  for (let runde = 0; runde < 20; runde++) {
    const angebote = [];
    const w = werte(s);
    const f = fabrik(s);
    const bandVoll = f.aktiv && f.foerderung >= w.band * 0.9;
    for (const t of TECH) {
      const st = techStatus(s, t.id);
      if (st !== 'kaufbar' && st !== 'teuer') continue;
      // Ein halbwegs vernünftiger Spieler: das Band zuerst, wenn es klemmt;
      // Nachtschichten erst, wenn sonst nichts mehr zu tun ist.
      let gewicht = 1;
      if (t.id === 'bandtechnik' && bandVoll) gewicht = 0.25;
      if (t.ast === 'verarbeitung' || t.id === 'automatisierung') gewicht = 0.6;
      if (t.id === 'nachtschicht' || t.id === 'nachtwaechter') gewicht = 4;
      angebote.push({ art: 'tech', id: t.id, preis: techKosten(s, t.id) * gewicht });
    }
    const platz = w.plaetze - plaetzeBelegt(s);
    for (const id of sinnvolleMaschinen(s)) {
      if (MASCHINE_NACH_ID[id].plaetze > platz) continue;
      // Maschinen zählen doppelt so dringend wie Forschung.
      angebote.push({ art: 'maschine', id, preis: maschinenKosten(s, id) * 0.5, echt: maschinenKosten(s, id) });
    }
    if (w.frei.has('drohne') && s.drohnen < w.drohnenMax) {
      angebote.push({ art: 'drohne', preis: drohnenKosten(s) });
    }
    if (!angebote.length) return;
    angebote.sort((a, b) => a.preis - b.preis);
    const bestes = angebote[0];
    const r = bestes.art === 'tech' ? techKaufen(s, bestes.id)
      : bestes.art === 'maschine' ? maschineKaufen(s, bestes.id)
        : drohneKaufen(s);
    if (!r.ok) return; // aufs Billigste sparen
  }
}

/**
 * Spielt bis alle Nadeln gefunden sind oder maxStunden vergangen sind.
 * Liefert Meilensteine in Sekunden Spielzeit.
 */
export function simuliere({ seed = 1, maxStunden = 30, tippsProSekunde = 3, dt = 0.25 } = {}) {
  const s = neuerStand(seed);
  const meilen = { nadeln: [] };
  let tippRest = 0;
  let naechsterEinkauf = 0;
  const ende = maxStunden * 3600;
  while (s.zeit < ende && !alleNadeln(s)) {
    const w = werte(s);
    tippRest += tippsProSekunde * dt;
    while (tippRest >= 1) {
      tippRest--;
      if (imAusschuss(s)) { ausschussTippen(s); continue; }
      const r = tippen(s);
      if (r && r.voll) verkaufen(s);
    }
    if (w.frei.has('sauger') && !s.sauger.heiss && s.laufen <= 0) saugen(s, true);
    if (s.tasche >= w.tasche - 0.5) verkaufen(s);
    const vorher = nadelnGefunden(s);
    tick(s, dt);
    if (nadelnGefunden(s) > vorher) meilen.nadeln.push(s.zeit);
    if (s.zeit >= naechsterEinkauf) {
      naechsterEinkauf = s.zeit + 1;
      if (fundWert(s) > 0) fundeVerkaufen(s);
      einkaufen(s);
      if (!meilen.heugabel && s.tech.heugabel) meilen.heugabel = s.zeit;
      if (!meilen.halle && s.tech.automatisierung) meilen.halle = s.zeit;
      if (!meilen.ersterArm && anzahl(s, 'arm') > 0) meilen.ersterArm = s.zeit;
      if (!meilen.halbzeit && rest(s) <= s.haufen.gesamt / 2) meilen.halbzeit = s.zeit;
    }
  }
  meilen.fertig = alleNadeln(s) ? s.zeit : null;
  return { s, meilen, fabrik: fabrik(s), werte: werte(s) };
}

export const MASCHINEN_IDS = MASCHINEN.map((m) => m.id);
