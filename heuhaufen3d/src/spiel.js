// Der Spielstand und sein Takt: legt Haufen und Nadeln an, treibt alle
// Systeme an, bestellt neue Ladungen, speichert und lädt. Reine Logik; die
// Oberfläche ruft spielTakt() jedes Bild auf und liest die Ereignisse.

import { WELT, GRUND, MISSIONEN, NADELN, PRODUKTE } from './daten.js';
import { zufallNeu } from './zufall.js';
import {
  haufenNeu, haufenSetzen, haufenRest, haufenPacken, haufenEntpacken, haufenAbtragen, haufenHoehe,
} from './haufen.js';
import {
  werte, missionenPruefen, ladungMasse, ladungBezahlen, ladungMoeglich, ladungPreis, einnahme, TECH_NACH_ID, BAU_NACH_ID,
} from './wirtschaft.js';
import { nadelnVerteilen, nadelnFreilegen, loseNadelnSetzen } from './nadeln.js';
import { spielerNeu } from './spieler.js';
import { WERKZEUG_NACH_ID } from './werkzeuge.js';
import { lasterNeu } from './laster.js';
import { lauf, STAND_TRICHTER, fussabdruck } from './welt.js';
import { bandBau } from './baender.js';
import { bauAbbauen } from './bauen.js';
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

/**
 * Die kurze Schrägrampe am Stand, die im Vorbild schon in der frischen Halle
 * steht: unten fast am Boden, oben über dem Trichter. Was darauf fällt, wird
 * verkauft. Gratis, zählt nirgends mit, lässt sich abbauen.
 */
export function startRampe(id) {
  const T = STAND_TRICHTER;
  const punkte = [[T.x, 0.32, T.z + 3.7], [T.x, 1.0, T.z + 0.78]];
  return { ...bandBau(id, punkte), start: true, bezahlt: 0 };
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
    bauten: [startRampe(1)],
    gegenstaende: [],
    geschenke: {},
    skizzen: [],
    naechsteId: 2,
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

/**
 * Was dort steht, wo die nächste Ladung hinkommt (ihr Radius plus ein halber Meter):
 * Bauten, deren Fußabdruck, und Bänder oder Linien, deren Verlauf in den Kreis ragt.
 * Wie im Vorbild wird nicht über Maschinen geschüttet.
 */
export function landeplatzImWeg(s) {
  const r = ladungMasse(s.ladung + 1).radius + 0.5;
  const cx = WELT.haufenX; const cz = WELT.haufenZ;
  const drin = (x, z) => Math.hypot(x - cx, z - cz) < r;
  const strecke = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
    for (let i = 0; i <= n; i++) if (drin(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return true;
    return false;
  };
  return s.bauten.filter((b) => {
    if (b.start) return false;
    if (b.typ === 'band') {
      for (let i = 1; i < b.punkte.length; i++) if (strecke(b.punkte[i - 1][0], b.punkte[i - 1][2], b.punkte[i][0], b.punkte[i][2])) return true;
      return false;
    }
    if (b.a && b.b) return strecke(b.a[0], b.a[1], b.b[0], b.b[1]);
    const k = fussabdruck(b.typ, b.x, b.z, b.rot || 0);
    return drin(Math.max(k.x0, Math.min(cx, k.x1)), Math.max(k.z0, Math.min(cz, k.z1)));
  });
}

/**
 * Neue Ladung bezahlen und hinlegen. Steht etwas auf dem Landeplatz, kommt sie nicht
 * ({ ok: false, grund: 'platz', imWeg }); mit raeumen: true wird es vorher abgebaut
 * (mit Erstattung, Geschenke zurück in den Katalog).
 */
export function ladungBestellen(s, optionen = {}) {
  const imWeg = landeplatzImWeg(s);
  if (imWeg.length) {
    if (!optionen.raeumen) return { ok: false, grund: 'platz', imWeg };
    // erst prüfen, ob die Ladung überhaupt ginge, dann räumen
    if (!ladungMoeglich(s)) return { ok: false, grund: 'nadeln' };
    if (s.geld < ladungPreis(s) && !optionen.aufRechnung) return { ok: false, grund: 'geld' };
    const ev = [];
    // Plattformen zuletzt, erst muss runter, was darauf steht
    for (const b of [...imWeg].sort((a, c) => (a.typ === 'plattform') - (c.typ === 'plattform'))) bauAbbauen(s, b, ev);
  }
  const r = ladungBezahlen(s, optionen);
  if (!r.ok) return r;
  haufenAnlegen(s);
  return { ok: true, geraeumt: imWeg.length };
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
  // Heu rutscht nach, Nadeln können dabei frei werden (größere Schritte, mehr Durchgänge)
  haufenSetzen(hf, Math.max(2, Math.min(12, Math.round(dt * 120))));
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
  const eintragOk = (r) => istObjekt(r) && PRODUKTE[r.art] && Number.isFinite(r.halme) && r.halme > 0 && Number.isInteger(r.nadel);
  for (const b of s.bauten) {
    // fehlende Felder (ältere Stände) mit dem Grundzustand auffüllen
    const grund = bauZustand(b.typ);
    for (const [k, v] of Object.entries(grund)) if (!(k in b) || typeof b[k] !== typeof v || Array.isArray(v) !== Array.isArray(b[k])) b[k] = v;
    b.rot = zahlOder(b.rot, 0);
    b.y = zahlOder(b.y, 0);
    // Einträge in Maschinen: kaputte fallen weg, ungültige Nadelverweise werden gelöst
    for (const k of ['schlange', 'fertig', 'innen']) {
      if (Array.isArray(b[k])) b[k] = b[k].filter(eintragOk).map((r) => ({ ...r, nadel: s.nadeln[r.nadel] ? r.nadel : -1, t: zahlOder(r.t, 0), fort: zahlOder(r.fort, 0) }));
    }
    if (b.puffer != null) b.puffer = eintragOk(b.puffer) ? { ...b.puffer, zeit: zahlOder(b.puffer.zeit, 0) } : null;
    if (Array.isArray(b.nadeln)) b.nadeln = b.nadeln.filter((nr) => Number.isInteger(nr) && s.nadeln[nr]);
    if (istObjekt(b.lager)) for (const [z, m] of Object.entries(b.lager)) if (!Number.isFinite(m) || m < 0) delete b.lager[z];
    for (const k of ['brenn', 'takt', 'fort', 'rest', 'weite', 'winkel', 'hell']) if (k in b) b[k] = zahlOder(b[k], grund[k] ?? 0);
  }
  const ORTE = ['boden', 'flug', 'band', 'hand'];
  s.gegenstaende = s.gegenstaende.filter((g) => istObjekt(g) && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.z)
    && PRODUKTE[g.art] && (g.art !== 'roh' || g.halme > 0));
  if (s.gegenstaende.length > 2000) {
    // Zu viele: liegendes loses Heu ohne Nadel wird zu Büscheln, alles andere bleibt
    const wichtig = (g) => g.ort === 'band' || g.ort === 'hand' || g.nadel >= 0 || g.art !== 'roh';
    const behalten = s.gegenstaende.filter(wichtig).slice(0, 2000);
    for (const g of s.gegenstaende) if (!wichtig(g)) s.lose.push({ x: g.x, z: g.z, m: g.halme, a: 0 });
    s.gegenstaende = behalten;
  }
  for (const g of s.gegenstaende) {
    if (!ORTE.includes(g.ort)) g.ort = 'flug';
    if (g.ort === 'band' && (!s.bauten.some((b) => b.id === g.band && b.typ === 'band') || !Number.isFinite(g.t))) g.ort = 'flug';
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
  sp.vx = 0; sp.vz = 0; sp.vy = 0; sp.duck = 0;
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
 * Offline nachholen: die ersten zwei Minuten rechnet die Automatik genau nach
 * (Bänder, Maschinen, Laster), den Rest bis zur erforschten Grenze schätzt sie
 * aus den Verkäufen dieser Minuten, mal dem Offline-Anteil. In Häppchen, damit
 * das Handy beim Start nicht einfriert: beginnen, dann jedes Bild weiter.
 */
export function abwesenheitBeginnen(s, jetzt = Date.now(), systeme = []) {
  const weg = Math.max(0, (jetzt - (Number.isFinite(s.zuletzt) ? s.zuletzt : jetzt)) / 1000);
  s.zuletzt = jetzt;
  const w = werte(s);
  const sek = Math.min(weg, w.offlineStunden * 3600);
  if (!systeme.length || sek < 10 || !s.bauten.length) return null;
  return {
    sek, weg, genau: Math.min(sek, 120), dt: 0.25, t: 0, verkaeufe: 0, ereignisse: [], systeme, fertig: false, ergebnis: null,
    geldVor: s.geld, verdientVor: s.verdient, halmeVor: s.stat.abgetragen,
  };
}

/** Rechnet höchstens `schritte` Schritte (oder bis `bisMs` performance.now() erreicht) weiter. */
export function abwesenheitWeiter(s, job, schritte = 1000, bisMs = Infinity) {
  const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (let i = 0; i < schritte && job.t < job.genau; i++) {
    for (const e of spielTakt(s, job.dt, job.systeme)) {
      if (e.typ === 'verkauft') job.verkaeufe += e.betrag || 0;
      else if (e.typ === 'mission' || e.typ === 'nadel' || e.typ === 'auftrag' || e.typ === 'scannerNadel') job.ereignisse.push(e);
    }
    job.t += job.dt;
    if (jetzt() > bisMs) break;
  }
  if (job.t >= job.genau && !job.fertig) {
    job.fertig = true;
    // Hochgerechnet werden nur laufende Verkäufe, keine einmaligen Belohnungen, und nur so
    // lange, wie der Haufen reicht. Das Heu dafür verschwindet an den Greifstellen.
    const rate = job.verkaeufe / job.genau;
    const halmeRate = (s.stat.abgetragen - job.halmeVor) / job.genau;
    let rest = Math.max(0, job.sek - job.genau) * werte(s).offlineEff;
    if (halmeRate > 0) rest = Math.min(rest, s.haufenRest / halmeRate);
    else rest = 0;
    if (rate > 0 && rest > 0) {
      einnahme(s, rate * rest);
      offlineAbtragen(s, halmeRate * rest, job.ereignisse);
    }
    job.ergebnis = {
      kurz: job.sek < 30, sekunden: job.sek, abwesend: job.weg, ereignisse: job.ereignisse,
      geld: s.geld - job.geldVor, verdient: s.verdient - job.verdientVor, halme: s.stat.abgetragen - job.halmeVor,
    };
  }
  return job;
}

/** Heu, das die Maschinen in der geschätzten Zeit weggenommen hätten, an ihren Greifstellen abtragen. */
function offlineAbtragen(s, menge, ereignisse) {
  const hf = s.hf;
  if (!hf || menge < 1) return;
  const stellen = [];
  for (const b of s.bauten) {
    if (b.typ === 'rechen' && lauf(b).kamm) stellen.push(lauf(b).kamm);
    else if (b.typ === 'arm') {
      const dx = hf.mitteX - b.x; const dz = hf.mitteZ - b.z; const d = Math.hypot(dx, dz) || 1;
      const r = Math.min(2.2, d);
      stellen.push([b.x + (dx / d) * r, b.z + (dz / d) * r]);
    }
  }
  if (!stellen.length) for (let i = 0; i < 12; i++) {
    const w = (i / 12) * Math.PI * 2;
    stellen.push([hf.mitteX + Math.cos(w) * hf.radius * 0.8, hf.mitteZ + Math.sin(w) * hf.radius * 0.8]);
  }
  let genommen = 0;
  let leer = 0;
  for (let i = 0; genommen < menge && i < 4000 && leer < stellen.length * 3; i++) {
    const [x, z] = stellen[i % stellen.length];
    // Hat die Stelle kein Heu mehr, rückt sie ein Stück zur Mitte (wie der Kamm nachfasst)
    if (haufenHoehe(hf, x, z) < 0.05) {
      const st = stellen[i % stellen.length];
      st[0] += (hf.mitteX - st[0]) * 0.1; st[1] += (hf.mitteZ - st[1]) * 0.1;
      leer++;
      continue;
    }
    genommen += haufenAbtragen(hf, x, z, Math.min(menge - genommen, 4000), 1.0);
    if (i % 8 === 7) haufenSetzen(hf, 6);
  }
  haufenSetzen(hf, 12);
  s.stat.abgetragen += genommen;
  s.stat.maschine += genommen;
  nadelnFreilegen(s, hf, null, ereignisse);
  s.haufenRest = haufenRest(hf);
}

/** Alles auf einmal (für Tests und Werkzeuge). */
export function abwesenheit(s, jetzt = Date.now(), systeme = []) {
  const job = abwesenheitBeginnen(s, jetzt, systeme);
  if (!job) return null;
  while (!job.fertig) abwesenheitWeiter(s, job);
  return job.ergebnis;
}
