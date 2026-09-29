// Ein Auto-Spieler, der Ladungen von vorn bis hinten abträgt. Er sticht
// dreimal pro Sekunde (mit der Sandschaufel, wenn die Puste ausgeht), saugt,
// wenn der Sauger kühl ist, fegt ab und zu, geht mit voller Tasche zum Stand
// und kauft das Billigste, was ihm gerade etwas bringt. Kein guter Spieler,
// aber ein ehrlicher: schafft er es in vernünftiger Zeit, schafft es jeder.
//
// Benutzt von tests/heuhaufen/balance.test.js und scripts/heuhaufen-messung.mjs.

import { TECH, MASCHINEN } from './src/daten.js';
import {
  neuerStand, werte, tick, stich, verkaufen, saugen, techStatus, techKosten, techKaufen,
  maschineFrei, maschinenKosten, maschineKaufen, plaetzeBelegt, fabrik, drohneKaufen,
  drohnenKosten, nadelnGefunden, alleNadeln, anzahl, MASCHINE_NACH_ID, rest, werkzeugWaehlen,
  werkzeugFrei, hatBand, ladungBestellen, techGekauft, missionStand, auftrag, auftragAblehnen,
} from './src/engine.js';

/** Was lohnt sich an Maschinen gerade? Liefert die ids, die der Spieler kaufen würde. */
function sinnvolleMaschinen(s) {
  const w = werte(s);
  const f = fabrik(s);
  const frei = (id) => maschineFrei(s, id);
  const ids = [];
  if (!f.aktiv) return ids;
  if (f.strom < 1 || (f.bedarf > 0 && f.erzeugt - f.bedarf < 4)) {
    for (const id of ['generator']) if (frei(id)) ids.push(id);
    if (ids.length) return ids;
  }
  if (frei('brunnen') && f.wasserBedarf > f.wasser * 0.95 && (anzahl(s, 'pulper') || anzahl(s, 'papier'))) ids.push('brunnen');
  if (frei('scanner') && f.fluss > 0 && f.deckung < 1) ids.push('scanner');
  if (frei('radar') && anzahl(s, 'radar') < 1) ids.push('radar');
  if (f.foerderung < f.band * 0.95) {
    if (frei('arm')) ids.push('arm'); else if (frei('rechen')) ids.push('rechen');
  } else if (frei('rohrwerfer')) ids.push('rohrwerfer');
  const pro = (id) => MASCHINE_NACH_ID[id].rate * w.verarbeitung * w.maschinenTempo * (w[id] || 1) * Math.min(1, w.verteilung);
  const roh = f.roh;
  if (frei('pulper') && roh > 10 * pro('pulper')) ids.push('pulper');
  if (frei('presse') && roh > 20 * pro('presse')) ids.push('presse');
  if (frei('pellet') && roh > 5 * pro('pellet')) ids.push('pellet');
  if (frei('silo') && roh > 5 * pro('silo')) ids.push('silo');
  if (frei('brikett') && (f.produkte.ballen || 0) > pro('brikett') && (f.produkte.brei || 0) > 2 * pro('brikett')) ids.push('brikett');
  if (frei('papier') && (f.produkte.brei || 0) > 2 * pro('papier')) ids.push('papier');
  if (frei('wickler') && (f.produkte.ballen || 0) > pro('wickler')) ids.push('wickler');
  return ids;
}

function einkaufen(s) {
  for (let runde = 0; runde < 30; runde++) {
    const angebote = [];
    const w = werte(s);
    const f = fabrik(s);
    const ziel = missionsZiel(s);
    const bandVoll = f.aktiv && f.moeglich > 0 && f.foerderung >= f.band * 0.9;
    for (const t of TECH) {
      const st = techStatus(s, t.id);
      if (st !== 'kaufbar' && st !== 'teuer') continue;
      let gewicht = 1;
      if (t.id === 'bandmotor' && bandVoll) gewicht = 0.25;
      if (t.ast === 'verarbeitung' || t.id === 'foerderband' || t.id === 'greifarm') gewicht = 0.6;
      if (t.id === 'nachtschicht' || t.id === 'nachtwaechter' || t.id === 'kredit') gewicht = 4;
      if (ziel.tech === t.id) gewicht = 0.2;
      // Tragen und Laufen lohnen nach dem Förderband nicht mehr.
      if (hatBand(w) && ['eimer2', 'mulde', 'sack', 'schubkarre', 'tempo1', 'tempo2', 'schrank'].includes(t.id)) gewicht = 20;
      angebote.push({ art: 'tech', id: t.id, preis: techKosten(s, t.id) * gewicht });
    }
    const platz = w.plaetze - plaetzeBelegt(s);
    const ids = new Set(sinnvolleMaschinen(s));
    if (ziel.maschine && maschineFrei(s, ziel.maschine)) ids.add(ziel.maschine);
    for (const id of ids) {
      if (MASCHINE_NACH_ID[id].plaetze > platz) continue;
      angebote.push({ art: 'maschine', id, preis: maschinenKosten(s, id) * (ziel.maschine === id ? 0.2 : 0.5) });
    }
    if (w.frei.has('drohne') && s.drohnen < w.drohnenMax) angebote.push({ art: 'drohne', preis: drohnenKosten(s) });
    if (!angebote.length) return;
    angebote.sort((a, b) => a.preis - b.preis);
    const bestes = angebote[0];
    const r = bestes.art === 'tech' ? techKaufen(s, bestes.id)
      : bestes.art === 'maschine' ? maschineKaufen(s, bestes.id)
        : drohneKaufen(s);
    if (!r.ok) return; // aufs Billigste sparen
  }
}

/** Was die offene Mission verlangt, übersetzt in etwas Kaufbares. */
const ERZEUGER = { ballen: 'presse', papier: 'papier', brikett: 'brikett', knaeuel: 'silo', silage: 'wickler', brei: 'pulper', pellet: 'pellet' };
function missionsZiel(s) {
  const ms = missionStand(s);
  if (!ms) return {};
  const { m } = ms;
  if (m.art === 'tech') return { tech: m.ziel };
  if (m.art === 'maschine') return { maschine: m.ziel[0] };
  if (m.art === 'produziert') return { maschine: ERZEUGER[m.ziel[0]] };
  return {};
}

/** Ein Spielzug der Hand: Werkzeug wählen und stechen oder fegen. */
function hand(s, w) {
  if (!s.stat.werkzeug.detektor) { werkzeugWaehlen(s, 'detektor'); stich(s); }
  if (s.werkzeug === 'sauger' && s.sauger.an) return;
  if (werkzeugFrei(s, 'besen') && s.boden >= w.besen) { werkzeugWaehlen(s, 'besen'); stich(s); return; }
  const grab = werkzeugFrei(s, 'heugabel') ? 'heugabel' : 'spaten';
  const muede = s.ausdauer < w.ausdauerKosten;
  werkzeugWaehlen(s, muede && werkzeugFrei(s, 'sandschaufel') ? 'sandschaufel' : grab);
  const r = stich(s);
  if (r && r.voll) verkaufen(s);
}

/**
 * Spielt, bis alle Nadeln der gewünschten Zahl Ladungen gefunden sind oder
 * maxStunden vergangen sind. Liefert Meilensteine in Sekunden Spielzeit.
 */
export function simuliere({ seed = 1, maxStunden = 30, tippsProSekunde = 3, dt = 0.25, ladungen = 1 } = {}) {
  const s = neuerStand(seed);
  const meilen = { nadeln: [], ladungen: [] };
  let tippRest = 0;
  let naechsterEinkauf = 0;
  const ende = maxStunden * 3600;
  while (s.zeit < ende) {
    const w = werte(s);
    const vorher = s.nadelnGesamt;
    if (alleNadeln(s) && meilen.ladungen.length < s.ladung) {
      meilen.ladungen.push(s.zeit);
      if (meilen.ladungen.length >= ladungen) break;
    }
    // Bestellen, sobald das Geld reicht; ist der Haufen leer, auf Rechnung.
    if (alleNadeln(s)) ladungBestellen(s, { aufRechnung: rest(s) <= 0 });
    // Sauger: halten, solange er kühl ist.
    if (werkzeugFrei(s, 'sauger') && !s.sauger.heiss && s.laufen <= 0 && s.sauger.hitze <= 0.01) {
      werkzeugWaehlen(s, 'sauger');
      saugen(s, true);
    }
    if (s.werkzeug === 'sauger' && s.sauger.heiss) saugen(s, false);
    tippRest += tippsProSekunde * dt;
    while (tippRest >= 1) {
      tippRest--;
      hand(s, w);
    }
    if (!hatBand(w) && s.tasche >= w.tasche - 0.5) verkaufen(s);
    tick(s, dt);
    for (let i = vorher; i < s.nadelnGesamt; i++) meilen.nadeln.push(s.zeit);
    if (s.zeit >= naechsterEinkauf) {
      naechsterEinkauf = s.zeit + 1;
      // Sind alle Nadeln gefunden, spart er auf die nächste Ladung.
      if (!alleNadeln(s)) einkaufen(s);
      // Aufträge über Waren, die man nicht herstellt, lehnt er ab.
      if (w.frei.has('auftraege') && s.auftrag.pause <= 0) {
        const au = auftrag(s.auftrag.nr);
        const f = fabrik(s);
        if ((au.will === 'roh' ? f.roh : (f.produkte[au.will] || 0)) <= 0) auftragAblehnen(s);
      }
      if (!meilen.heugabel && s.tech.heugabel) meilen.heugabel = s.zeit;
      if (!meilen.band && s.tech.foerderband) meilen.band = s.zeit;
      if (!meilen.ersterArm && anzahl(s, 'arm') > 0) meilen.ersterArm = s.zeit;
      if (!meilen.halbzeit && s.ladung === 1 && rest(s) <= s.haufen.gesamt / 2) meilen.halbzeit = s.zeit;
    }
  }
  meilen.fertig = meilen.ladungen[0] ?? null;
  return { s, meilen, fabrik: fabrik(s), werte: werte(s), gekauft: techGekauft(s), nadelnJetzt: nadelnGefunden(s) };
}

export const MASCHINEN_IDS = MASCHINEN.map((m) => m.id);
