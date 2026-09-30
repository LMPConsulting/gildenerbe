// Der Spielstand und sein Takt: legt Haufen und Nadeln an, treibt alle
// Systeme an, bestellt neue Ladungen, speichert und lädt. Reine Logik; die
// Oberfläche ruft spielTakt() jedes Bild auf und liest die Ereignisse.

import { WELT, GRUND, MISSIONEN, NADELN, PRODUKTE } from './daten.js';
import { zufallNeu } from './zufall.js';
import {
  haufenNeu, haufenSetzen, haufenRest, haufenPacken, haufenEntpacken,
} from './haufen.js';
import {
  werte, missionenPruefen, ladungMasse, ladungBezahlen, einnahme, TECH_NACH_ID, BAU_NACH_ID,
} from './wirtschaft.js';
import { nadelnVerteilen, nadelnFreilegen, loseNadelnSetzen } from './nadeln.js';
import { spielerNeu } from './spieler.js';
import { WERKZEUG_NACH_ID } from './werkzeuge.js';
import { lasterNeu } from './laster.js';
import { bauZustand } from './maschinen.js';

export const STAND3D_VERSION = 1;
export const SPEICHER3D_KEY = 'heuhaufen3d-stand-v1';

function statNeu() {
  return {
    tipps: 0, verkauft: 0, gefegt: 0, abgetragen: 0, hand: 0, maschine: 0, drohne: 0, gaenge: 0,
    auftraege: 0, besterVerkauf: 0, besterVerkaufHalme: 0, maxGeld: 0, werkzeug: {}, produziert: {},
    umgesehen: 0, gelaufen: 0, ersteNadel: null, ersteLadung: null, rechenMitStrom: 0, nadelnZurueck: 0,
  };
}

/** Laufzeit-Zufall: aus s.rng fortgesetzt, beim Speichern zurückgeschrieben. */
export function spielZufall(s) {
  if (!s.zufallFn) Object.defineProperty(s, 'zufallFn', { value: zufallNeu(s.rng), writable: true, enumerable: false });
  return s.zufallFn;
}

export function standNeu(seed = (Date.now() % 2147483647) || 7) {
  const s = {
    version: STAND3D_VERSION,
    rng: seed >>> 0 || 7,
    rev: 0,
    zeit: 0, // gespielte Sekunden
    geld: 0, verdient: 0, schulden: 0,
    ladung: 1,
    tech: { scheune: 1 },
    arten: {},
    nadelnGesamt: 0,
    nadeln: [],
    lose: [],
    spieler: {
      ...spielerNeu(), werkzeug: 'hand', last: 0, puste: GRUND.ausdauer, ruhe: 0,
      sauger: { an: false, hitze: 0, heiss: false, rest: 0 }, haelt: null,
    },
    bauten: [],
    gegenstaende: [],
    geschenke: {},
    skizzen: [],
    naechsteId: 1,
    mission: 0,
    missionErledigt: [],
    auftrag: { nr: 0, skip: 0, geliefert: 0, pause: 0 },
    laster: lasterNeu(),
    stat: statNeu(),
    einnahmenFenster: [],
    haufenStart: 0,
    haufenRest: 0,
    zuletzt: Date.now(),
  };
  haufenAnlegen(s);
  return s;
}

/** Neuen Haufen für die aktuelle Ladung hinlegen, Nadeln verstecken. */
export function haufenAnlegen(s) {
  const z = spielZufall(s);
  const m = ladungMasse(s.ladung);
  const hf = haufenNeu({ ...m, mitteX: WELT.haufenX, mitteZ: WELT.haufenZ, zufall: z });
  Object.defineProperty(s, 'hf', { value: hf, writable: true, enumerable: false, configurable: true });
  s.nadeln = nadelnVerteilen(s, hf, z);
  s.haufenStart = m.halme;
  s.haufenRest = haufenRest(hf);
  s.rev++;
}

/** Neue Ladung bezahlen und hinlegen. */
export function ladungBestellen(s, optionen = {}) {
  const r = ladungBezahlen(s, optionen);
  if (!r.ok) return r;
  haufenAnlegen(s);
  return { ok: true };
}

let nadelPruefZeit = 0;

/**
 * Ein Zeitschritt der Welt ohne die Eingabe des Spielers (die verarbeitet main.js
 * über werkzeuge.js). Liefert die Ereignisse dieses Schritts.
 */
export function spielTakt(s, dt, systeme = []) {
  const ereignisse = [];
  if (!(dt > 0)) return ereignisse;
  s.zeit += dt;
  const hf = s.hf;
  // Heu rutscht nach, Nadeln können dabei frei werden
  haufenSetzen(hf, 2);
  nadelPruefZeit += dt;
  if (nadelPruefZeit > 0.25) {
    nadelPruefZeit = 0;
    nadelnFreilegen(s, hf, null, ereignisse);
    loseNadelnSetzen(s, hf);
    s.haufenRest = haufenRest(hf);
  }
  // Automatisierung (Bänder, Maschinen, Strom …) hängt sich hier ein
  for (const sys of systeme) sys(s, dt, ereignisse);
  if (s.auftrag.pause > 0) s.auftrag.pause = Math.max(0, s.auftrag.pause - dt);
  missionenPruefen(s, ereignisse);
  return ereignisse;
}

/* ------------------------------------------------------------ Speichern */

export function speichern(s, jetzt = Date.now()) {
  s.zuletzt = jetzt;
  if (s.zufallFn) s.rng = s.zufallFn.zustand();
  const aus = { ...s, haufen: haufenPacken(s.hf) };
  delete aus.einnahmenFenster;
  return JSON.stringify(aus);
}

const istObjekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const zahlOder = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Liest einen Stand; bei allem, was nicht passt, null. Repariert Kleinigkeiten. */
export function laden(text) {
  let roh;
  try { roh = JSON.parse(text); } catch { return null; }
  if (!istObjekt(roh) || roh.version !== STAND3D_VERSION) return null;
  const hf = haufenEntpacken(roh.haufen);
  if (!hf) return null;
  const s = standNeu(zahlOder(roh.rng, 7));
  for (const [key, wert] of Object.entries(roh)) {
    if (key === 'haufen' || !(key in s)) continue;
    if (istObjekt(s[key])) {
      if (istObjekt(wert)) s[key] = { ...s[key], ...wert };
    } else if (Array.isArray(s[key])) {
      if (Array.isArray(wert)) s[key] = wert;
    } else if (typeof s[key] === 'number') {
      s[key] = zahlOder(wert, s[key]);
    } else if (typeof wert === typeof s[key]) {
      s[key] = wert;
    }
  }
  Object.defineProperty(s, 'hf', { value: hf, writable: true, enumerable: false, configurable: true });
  s.einnahmenFenster = [];
  s.tech = Object.fromEntries(Object.entries(s.tech)
    .filter(([id, n]) => TECH_NACH_ID[id] && Number.isFinite(n) && n > 0)
    .map(([id, n]) => [id, Math.min(Math.floor(n), TECH_NACH_ID[id].stufen)]));
  s.tech.scheune = 1;
  s.arten = Object.fromEntries(Object.entries(s.arten).filter(([a, n]) => NADELN[a] && Number.isFinite(n)));
  s.nadeln = s.nadeln.filter((n) => istObjekt(n) && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)
    && NADELN[n.art] && ['versteckt', 'lose', 'gefunden', 'unterwegs', 'scanner', 'maschine'].includes(n.zustand));
  s.nadeln.forEach((n, i) => { n.nr = i; });
  s.lose = s.lose.filter((b) => istObjekt(b) && Number.isFinite(b.x) && Number.isFinite(b.z) && b.m > 0).slice(0, 400);
  s.bauten = s.bauten.filter((b) => istObjekt(b) && BAU_NACH_ID[b.typ] && Number.isFinite(b.x) && Number.isFinite(b.z)
    && (b.typ !== 'band' || (Array.isArray(b.punkte) && b.punkte.length >= 2 && b.punkte.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))))
    && (!BAU_NACH_ID[b.typ].linie || b.typ === 'band' || (Array.isArray(b.a) && Array.isArray(b.b))));
  for (const b of s.bauten) {
    // fehlende Felder (ältere Stände) mit dem Grundzustand auffüllen
    const grund = bauZustand(b.typ);
    for (const [k, v] of Object.entries(grund)) if (!(k in b) || typeof b[k] !== typeof v || Array.isArray(v) !== Array.isArray(b[k])) b[k] = v;
    b.rot = zahlOder(b.rot, 0);
    b.y = zahlOder(b.y, 0);
  }
  const ORTE = ['boden', 'flug', 'band', 'hand'];
  s.gegenstaende = s.gegenstaende.filter((g) => istObjekt(g) && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.z)
    && PRODUKTE[g.art] && (g.art !== 'roh' || g.halme > 0)).slice(0, 600);
  for (const g of s.gegenstaende) {
    if (!ORTE.includes(g.ort)) g.ort = 'flug';
    if (g.ort === 'band' && !s.bauten.some((b) => b.id === g.band && b.typ === 'band')) g.ort = 'flug';
    if (g.ort === 'hand' && s.spieler.haelt !== g.id) g.ort = 'flug';
    for (const k of ['vx', 'vy', 'vz']) g[k] = zahlOder(g[k], 0);
    if (!Number.isInteger(g.nadel) || !s.nadeln[g.nadel]) g.nadel = -1;
  }
  if (s.spieler.haelt != null && !s.gegenstaende.some((g) => g.id === s.spieler.haelt && g.ort === 'hand')) s.spieler.haelt = null;
  // Nadeln unterwegs oder in Maschinen brauchen ihren Träger, sonst liegen sie lose am Haufen
  for (const n of s.nadeln) {
    if (n.zustand === 'unterwegs' && !s.gegenstaende.some((g) => g.nadel === n.nr)) n.zustand = 'lose';
    if (n.zustand === 'scanner' || n.zustand === 'maschine') {
      const bau = s.bauten.find((b) => b.id === n.bei);
      const drin = bau && ((bau.nadeln || []).includes(n.nr)
        || [bau.puffer, ...(bau.schlange || []), ...(bau.fertig || []), ...(bau.innen || [])].some((r) => r && r.nadel === n.nr));
      if (!drin) n.zustand = 'lose';
    }
    if (n.zustand === 'lose' && !Number.isFinite(n.zeit)) n.zeit = 0;
  }
  if (!['weg', 'kommt', 'steht', 'faehrt'].includes(s.laster.zustand)) s.laster = lasterNeu();
  const strichOk = (st) => Array.isArray(st) && st.length >= 4 && st.every(Number.isFinite);
  s.skizzen = s.skizzen.filter((k) => istObjekt(k) && Array.isArray(k.striche) && k.striche.every(strichOk)).slice(-12);
  for (const b of s.bauten) {
    if (b.typ !== 'staffelei') continue;
    if (!Array.isArray(b.striche) || !b.striche.every(strichOk)) b.striche = [];
    if (!Number.isInteger(b.bild) || b.bild >= s.skizzen.length) b.bild = -1;
  }
  s.geschenke = Object.fromEntries(Object.entries(s.geschenke).filter(([id, n]) => BAU_NACH_ID[id] && n > 0));
  const sp = s.spieler;
  if (!WERKZEUG_NACH_ID[sp.werkzeug]) sp.werkzeug = 'hand';
  for (const k of ['x', 'y', 'z', 'gier', 'nick', 'last', 'puste']) sp[k] = zahlOder(sp[k], k === 'puste' ? GRUND.ausdauer : 0);
  sp.vx = 0; sp.vz = 0; sp.vy = 0;
  sp.x = Math.max(WELT.xMin + 0.5, Math.min(WELT.xMax + 30, sp.x));
  sp.z = Math.max(WELT.zMin + 0.5, Math.min(WELT.zMax - 0.5, sp.z));
  sp.sauger = { an: false, hitze: zahlOder(sp.sauger && sp.sauger.hitze, 0), heiss: !!(sp.sauger && sp.sauger.heiss), rest: 0 };
  s.stat = { ...statNeu(), ...(istObjekt(s.stat) ? s.stat : {}) };
  if (!istObjekt(s.stat.werkzeug)) s.stat.werkzeug = {};
  if (!istObjekt(s.stat.produziert)) s.stat.produziert = {};
  s.mission = Math.max(0, Math.min(MISSIONEN.length, Math.floor(s.mission)));
  s.missionErledigt = (s.missionErledigt || []).filter((i) => Number.isInteger(i) && i > s.mission && i < MISSIONEN.length);
  s.ladung = Math.max(1, Math.floor(s.ladung));
  for (const k of ['nr', 'skip', 'geliefert', 'pause']) s.auftrag[k] = Math.max(0, zahlOder(s.auftrag[k], 0));
  s.naechsteId = Math.max(zahlOder(s.naechsteId, 1), ...s.bauten.map((b) => (b.id || 0) + 1), ...s.gegenstaende.map((g) => (g.id || 0) + 1), 1);
  s.haufenRest = haufenRest(hf);
  s.rev = 0;
  werte(s);
  return s;
}

/**
 * Offline nachholen: die ersten drei Minuten rechnet die Automatik genau nach
 * (Bänder, Maschinen, Laster), den Rest bis zur erforschten Grenze schätzt sie
 * aus den Einnahmen dieser Minuten, mal dem Offline-Anteil.
 */
export function abwesenheit(s, jetzt = Date.now(), systeme = []) {
  const weg = Math.max(0, (jetzt - (Number.isFinite(s.zuletzt) ? s.zuletzt : jetzt)) / 1000);
  s.zuletzt = jetzt;
  const w = werte(s);
  const sek = Math.min(weg, w.offlineStunden * 3600);
  if (!systeme.length || sek < 10 || !s.bauten.length) return null;
  const geldVor = s.geld;
  const verdientVor = s.verdient;
  const halmeVor = s.stat.abgetragen;
  const genau = Math.min(sek, 180);
  const ereignisse = [];
  const dt = 0.1;
  for (let t = 0; t < genau; t += dt) {
    for (const e of spielTakt(s, dt, systeme)) if (e.typ === 'mission' || e.typ === 'nadel' || e.typ === 'auftrag' || e.typ === 'scannerNadel') ereignisse.push(e);
  }
  const rate = (s.verdient - verdientVor) / genau;
  const rest = Math.max(0, sek - genau) * w.offlineEff;
  if (rate > 0 && rest > 0) einnahme(s, rate * rest);
  return {
    kurz: sek < 30, sekunden: sek, abwesend: weg, ereignisse,
    geld: s.geld - geldVor, verdient: s.verdient - verdientVor, halme: s.stat.abgetragen - halmeVor,
  };
}
