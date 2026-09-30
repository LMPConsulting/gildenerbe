// Geld, Forschung, Missionen, Aufträge und Ladungen. Reine Logik ohne DOM,
// weitgehend aus der 2D-Fassung übernommen und auf die 3D-Welt angepasst.

import {
  GRUND, TECH, AESTE, NADELN, MISSIONEN, AUFTRAEGE, KUNDEN, AUFTRAG_PAUSE, PRODUKTE, PRODUKTE_2D,
  BAUTEN, LADUNGEN_3D, LADUNG_WACHSTUM, LADUNG_PREIS, LADUNG_PREIS_FAKTOR,
  KREDIT_AUFSCHLAG, KREDIT_AUFSCHLAG_GUT, KREDIT_TILGUNG,
} from './daten.js';

export const TECH_NACH_ID = Object.fromEntries(TECH.map((t) => [t.id, t]));
export const BAU_NACH_ID = Object.fromEntries(BAUTEN.map((b) => [b.id, b]));
export const AST_NACH_ID = Object.fromEntries(AESTE.map((a) => [a.id, a]));
export const TECH_STUFEN_GESAMT = TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : t.stufen), 0);
/** Welcher Knoten schaltet was frei: frei-Name → Knoten-ID. */
export const PLAN_FUER = Object.fromEntries(TECH.flatMap((t) => t.effekt.filter((e) => e[0] === 'frei').map((e) => [e[1], t.id])));
export const NADELN_JE_LADUNG = 6;

/* ------------------------------------------------------------ Werte */

const werteCache = new WeakMap();

/** Alle Grundwerte nach Forschung und gefundenen Nadelarten. Zwischengespeichert bis s.rev sich ändert. */
export function werte(s) {
  const alt = werteCache.get(s);
  if (alt && alt.rev === s.rev) return alt.w;
  const plus = {};
  const mal = {};
  const frei = new Set();
  const anwenden = (effekte, n) => {
    for (const e of effekte) {
      if (e[0] === 'frei') { frei.add(e[1]); continue; }
      if (e[1] === '+') plus[e[0]] = (plus[e[0]] || 0) + e[2] * n;
      else mal[e[0]] = (mal[e[0]] || 1) * Math.pow(e[2], n);
    }
  };
  for (const t of TECH) {
    const n = s.tech[t.id] || 0;
    if (n > 0) anwenden(t.effekt, Math.min(n, t.stufen));
  }
  // Jede Nadelart zählt einmal, egal wie oft man sie gefunden hat.
  for (const [art, n] of Object.entries(s.arten)) if (n > 0 && NADELN[art]) anwenden(NADELN[art].effekt, 1);
  const w = { ...GRUND };
  for (const key of new Set([...Object.keys(plus), ...Object.keys(mal)])) {
    const basis = key in GRUND ? GRUND[key] : (key in plus ? 0 : 1);
    w[key] = (basis + (plus[key] || 0)) * (mal[key] || 1);
  }
  w.frei = frei;
  werteCache.set(s, { rev: s.rev, w });
  return w;
}

const faktorVon = (w, k) => (k in w ? w[k] : 1);
export const preisRoh = (w) => w.preisRoh * w.preisAlle;
export const taschePlatz = (w) => Math.floor(w.tasche);
/** Gehtempo-Faktor: laufzeit ist der Kehrwert (kleiner = schneller). */
export const gehFaktor = (w) => 1 / Math.max(0.2, w.laufzeit);

/** Preis eines Stücks der Ware p (bei 'roh': eines Halms). */
export function produktPreis(w, p) {
  if (p === 'roh') return preisRoh(w);
  return PRODUKTE[p].wert * (w.preisRoh / GRUND.preisRoh) * w.preisAlle * w.preisProdukt * faktorVon(w, 'preis_' + p);
}

/** Was ein Gegenstand beim Verkauf bringt: loses Heu nach Halmen, Waren nach Stück. */
export function stueckWert(w, g) {
  if (g.art === 'roh') return g.halme * preisRoh(w);
  return produktPreis(w, g.art);
}

/* ------------------------------------------------------------ Geld */

/** Jede Einnahme läuft hier durch: Schulden werden zuerst anteilig getilgt. Liefert, was in der Kasse landet. */
export function einnahme(s, betrag) {
  if (!(betrag > 0)) return 0;
  s.verdient += betrag;
  if (s.schulden > 0) {
    const tilgung = Math.min(s.schulden, betrag * KREDIT_TILGUNG);
    s.schulden -= tilgung;
    betrag -= tilgung;
    if (s.schulden < 1e-6) s.schulden = 0;
  }
  s.geld += betrag;
  if (s.geld > s.stat.maxGeld) s.stat.maxGeld = s.geld;
  return betrag;
}

/** Verkauf am Stand (oder an den Laster): zählt mit, meldet ein Ereignis. */
export function verkaufen(s, betrag, halme, ereignisse, wo = 'stand') {
  const inKasse = einnahme(s, betrag);
  s.stat.verkauft += halme;
  if (betrag > s.stat.besterVerkauf) { s.stat.besterVerkauf = betrag; s.stat.besterVerkaufHalme = halme; }
  s.einnahmenFenster.push([s.zeit, betrag]);
  if (ereignisse) ereignisse.push({ typ: 'verkauft', betrag, halme, wo });
  return inKasse;
}

/** Einnahmen der letzten Minute: für die Anzeige „$/min“. */
export function proMinute(s) {
  const grenze = s.zeit - 60;
  while (s.einnahmenFenster.length && s.einnahmenFenster[0][0] < grenze) s.einnahmenFenster.shift();
  const summe = s.einnahmenFenster.reduce((n, e) => n + e[1], 0);
  const dauer = Math.min(60, Math.max(10, s.zeit));
  return (summe / dauer) * 60;
}

/* ------------------------------------------------------------ Forschung */

export const techStufe = (s, id) => s.tech[id] || 0;

function preisRunden(c) {
  c = Math.round(c * 1e6) / 1e6;
  return c < 100 ? Math.ceil(c * 10) / 10 : Math.ceil(c);
}

export function techKosten(s, id) {
  const t = TECH_NACH_ID[id];
  if (!t) return Infinity;
  return preisRunden(t.kosten * Math.pow(t.faktor, techStufe(s, id)));
}

export const techOffen = (s, id) => !!TECH_NACH_ID[id] && TECH_NACH_ID[id].braucht.every((b) => techStufe(s, b) > 0);

/** 'max' | 'kaufbar' | 'teuer' | 'gesperrt' */
export function techStatus(s, id) {
  const t = TECH_NACH_ID[id];
  if (!t) return 'gesperrt';
  if (techStufe(s, id) >= t.stufen) return 'max';
  if (!techOffen(s, id)) return 'gesperrt';
  return s.geld >= techKosten(s, id) ? 'kaufbar' : 'teuer';
}

export function techKaufen(s, id) {
  const status = techStatus(s, id);
  if (status !== 'kaufbar') return { ok: false, grund: status };
  s.geld -= techKosten(s, id);
  if (s.geld < 0 && s.geld > -1e-9) s.geld = 0;
  s.tech[id] = techStufe(s, id) + 1;
  s.rev++;
  return { ok: true };
}

export const techGekauft = (s) => TECH.reduce((n, t) => n + (t.id === 'scheune' ? 0 : Math.min(techStufe(s, t.id), t.stufen)), 0);

/** Schritte vom Start: der längste Weg über alle Voraussetzungen. */
export const TECH_SCHRITTE = (() => {
  const schritte = {};
  const tiefe = (id) => {
    if (id in schritte) return schritte[id];
    const t = TECH_NACH_ID[id];
    schritte[id] = t.braucht.length ? 1 + Math.max(...t.braucht.map(tiefe)) : 0;
    return schritte[id];
  };
  for (const t of TECH) tiefe(t.id);
  return schritte;
})();

export const BAUM_MASS = { karte: 0.82, zeile: 0.42, kopf: 0.36, luecke: 0.2, astLuecke: 0.6 };

/**
 * Lage im Forschungsbaum wie in der 2D-Fassung: Spalte = Schritte vom Start,
 * Teilbäume je Ast nach ihrem Umriss gestapelt, Gruppen als schmale Zeilen.
 */
export function techLage(aeste) {
  const M = BAUM_MASS;
  const lage = {};
  const gruppen = [];
  const baender = [];
  const block = () => ({ karten: [], koepfe: [], oben: new Map(), unten: new Map(), anker: 0 });
  const belege = (bl, x, y, h) => {
    bl.oben.set(x, Math.min(bl.oben.has(x) ? bl.oben.get(x) : Infinity, y));
    bl.unten.set(x, Math.max(bl.unten.has(x) ? bl.unten.get(x) : -Infinity, y + h));
  };
  const schiebe = (bl, d) => {
    for (const k of bl.karten) k.y += d;
    for (const k of bl.koepfe) k.y += d;
    for (const [x, v] of bl.oben) bl.oben.set(x, v + d);
    for (const [x, v] of bl.unten) bl.unten.set(x, v + d);
    bl.anker += d;
  };
  const stapeln = (bloecke) => {
    const ges = block();
    const anker = [];
    let zuletzt = 0;
    for (const bl of bloecke) {
      let d = zuletzt;
      for (const [x, v] of bl.oben) if (ges.unten.has(x)) d = Math.max(d, ges.unten.get(x) + M.luecke - v);
      schiebe(bl, d);
      zuletzt = d;
      ges.karten.push(...bl.karten);
      ges.koepfe.push(...bl.koepfe);
      for (const [x, v] of bl.oben) belege(ges, x, v, bl.unten.get(x) - v);
      anker.push(bl.anker);
    }
    ges.anker = anker.length ? (anker[0] + anker[anker.length - 1]) / 2 : 0;
    return ges;
  };
  for (const ast of aeste) {
    const knoten = TECH.filter((t) => t.ast === ast.id);
    if (!knoten.length) continue;
    const imAst = new Set(knoten.map((t) => t.id));
    const vater = (t) => t.braucht.find((b) => imAst.has(b)) || null;
    const ordnen = (ks) => ks.sort((a, b) => (a.gruppe ? 1 : 0) - (b.gruppe ? 1 : 0));
    const einheiten = (ks) => {
      const liste = [];
      for (let i = 0; i < ks.length;) {
        const kk = ks[i];
        if (kk.gruppe) {
          let j = i;
          const ids = [];
          while (j < ks.length && ks[j].gruppe === kk.gruppe) ids.push(ks[j++].id);
          const x = Math.max(...ids.map((id) => TECH_SCHRITTE[id]));
          const bl = block();
          bl.koepfe.push({ name: kk.gruppe, ast: ast.id, x, y: 0, ids });
          ids.forEach((id, n) => bl.karten.push({ id, x, y: M.kopf + n * M.zeile, h: M.zeile }));
          const hoch = M.kopf + ids.length * M.zeile;
          belege(bl, x, 0, hoch);
          bl.anker = hoch / 2;
          liste.push(bl);
          i = j;
        } else {
          liste.push(teilbaum(kk));
          i++;
        }
      }
      return liste;
    };
    const teilbaum = (t) => {
      const x = TECH_SCHRITTE[t.id];
      const ks = ordnen(knoten.filter((kk) => vater(kk) === t.id));
      if (!ks.length) {
        const bl = block();
        bl.karten.push({ id: t.id, x, y: 0, h: M.karte });
        belege(bl, x, 0, M.karte);
        bl.anker = M.karte / 2;
        return bl;
      }
      const bl = stapeln(einheiten(ks));
      const y = bl.anker - M.karte / 2;
      bl.karten.push({ id: t.id, x, y, h: M.karte });
      belege(bl, x, y, M.karte);
      const oberkante = Math.min(...bl.oben.values());
      if (oberkante < 0) schiebe(bl, -oberkante);
      return bl;
    };
    const von = baender.length ? baender[baender.length - 1].bis + M.astLuecke : 0;
    const bl = stapeln(einheiten(ordnen(knoten.filter((kk) => !vater(kk)))));
    schiebe(bl, von - Math.min(...bl.oben.values()));
    for (const k of bl.karten) lage[k.id] = { x: k.x, y: k.y, h: k.h };
    gruppen.push(...bl.koepfe);
    baender.push({ ast: ast.id, von, bis: Math.max(...bl.unten.values()) });
  }
  const hoehe = baender[baender.length - 1].bis;
  const erster = baender[0];
  lage.scheune = { x: 0, y: (erster.von + erster.bis) / 2 - M.karte / 2, h: M.karte };
  const breite = Math.max(...Object.values(lage).map((l) => l.x)) + 1;
  return { lage, gruppen, aeste: baender, hoehe, breite };
}

/* ------------------------------------------------------------ Bauten kaufen */

export const bauAnzahl = (s, typ) => s.bauten.reduce((n, b) => n + (b.typ === typ ? 1 : 0), 0);
export const bauFrei = (s, typ) => {
  const b = BAU_NACH_ID[typ];
  return !!b && (b.frei === null || werte(s).frei.has(b.frei) || (s.geschenke[typ] || 0) > 0);
};

/** Preis des nächsten Stücks (bei Linien: je Meter). */
export function bauKosten(s, typ, meter = 0) {
  const b = BAU_NACH_ID[typ];
  if (!b) return Infinity;
  const w = werte(s);
  if (b.prometer) return Math.ceil(b.prometer * meter * w.maschinenKosten * 10) / 10;
  const c = b.kosten * Math.pow(b.faktor, bauAnzahl(s, typ)) * w.maschinenKosten;
  return Math.ceil(Math.round(c * 1e6) / 1e6);
}

/** Beim Abbau gibt es die Hälfte zurück (Geschenke kommen als Geschenk zurück). */
export function bauErstattung(s, bau) {
  if (bau.geschenk) return 0;
  return Math.floor((bau.bezahlt || 0) * 0.5);
}

/* ------------------------------------------------------------ Nadeln */

export const nadelnGefunden = (s) => s.nadeln.filter((n) => n.zustand === 'gefunden').length;
export const alleNadeln = (s) => nadelnGefunden(s) >= NADELN_JE_LADUNG;
export const artenGefunden = (s) => Object.values(s.arten).filter((n) => n > 0).length;

/** Welche Nadelarten in Ladung nr stecken: erst die 24 der Reihe nach, danach gemischt. */
export function nadelArten(nr, zufall) {
  const start = (nr - 1) * NADELN_JE_LADUNG;
  if (start + NADELN_JE_LADUNG <= NADELN.length) return Array.from({ length: NADELN_JE_LADUNG }, (_, i) => start + i);
  const arten = NADELN.map((_, i) => i);
  for (let i = arten.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [arten[i], arten[j]] = [arten[j], arten[i]];
  }
  return arten.slice(0, NADELN_JE_LADUNG);
}

/* ------------------------------------------------------------ Ladungen */

/** Maße der Ladung nr: Halme, Radius, Höhe. Nach der Liste wachsen sie weiter, vor allem in die Höhe. */
export function ladungMasse(nr) {
  if (nr <= LADUNGEN_3D.length) return LADUNGEN_3D[nr - 1];
  const letzte = LADUNGEN_3D[LADUNGEN_3D.length - 1];
  const f = Math.pow(LADUNG_WACHSTUM, nr - LADUNGEN_3D.length);
  return { halme: Math.round(letzte.halme * f), radius: letzte.radius * Math.pow(f, 0.12), hoehe: letzte.hoehe * Math.pow(f, 0.76) };
}

export const ladungPreis = (s) => Math.round(LADUNG_PREIS * Math.pow(LADUNG_PREIS_FAKTOR, s.ladung - 1));
export const ladungMoeglich = (s) => alleNadeln(s);
export const kreditAufschlag = (s) => (werte(s).frei.has('kredit') ? KREDIT_AUFSCHLAG_GUT : KREDIT_AUFSCHLAG);

/** Bezahlen (bar oder auf Rechnung). Den neuen Haufen legt spiel.js hin. */
export function ladungBezahlen(s, { aufRechnung = false } = {}) {
  if (!ladungMoeglich(s)) return { ok: false, grund: 'nadeln' };
  const preis = ladungPreis(s);
  if (s.geld >= preis) s.geld -= preis;
  else if (aufRechnung) {
    s.schulden += (preis - s.geld) * kreditAufschlag(s);
    s.geld = 0;
  } else return { ok: false, grund: 'geld' };
  if (s.stat.ersteLadung == null) s.stat.ersteLadung = s.zeit;
  s.ladung++;
  s.rev++;
  return { ok: true };
}

/* ------------------------------------------------------------ Aufträge */

/** Der Auftrag mit Nummer nr; nach der festen Liste wachsen sie weiter. menge in Stück (bei 'roh': Halme). */
export function auftrag(nr, skip = 0) {
  if (nr < AUFTRAEGE.length) {
    const a = AUFTRAEGE[nr];
    // In 3D sind Waren viermal so groß: gleiche Halmzahl heißt ein Viertel der Stücke.
    const menge = a.will === 'roh' ? a.menge : Math.max(1, Math.round(a.menge / 4));
    return { titel: a.titel, will: a.will, menge, lohn: a.lohn };
  }
  const reihe = ['ballen', 'silage', 'papier', 'brikett', 'pellet', 'brei'];
  const will = reihe[(nr + skip - AUFTRAEGE.length) % reihe.length];
  const wachstum = Math.pow(1.35, nr - AUFTRAEGE.length + 1);
  const menge = Math.max(1, Math.round((600 * wachstum * 20) / PRODUKTE_2D[will].halme / 4));
  const titel = KUNDEN[(nr + skip) % KUNDEN.length];
  return { titel, will, menge, lohn: Math.round(menge * PRODUKTE[will].wert * 2.5) };
}

/** Der Lohn zieht mit den Preisen mit, damit ein Auftrag nie weniger bringt als der Stand. */
export const auftragLohn = (s, a) => {
  const w = werte(s);
  const basis = a.will === 'roh' ? GRUND.preisRoh : PRODUKTE[a.will].wert;
  return a.lohn * w.auftragLohn * (produktPreis(w, a.will) / basis);
};

export function auftragAblehnen(s) {
  if (!werte(s).frei.has('auftraege') || s.auftrag.pause > 0) return false;
  if (s.auftrag.nr < AUFTRAEGE.length) s.auftrag.nr++;
  else s.auftrag.skip = (s.auftrag.skip || 0) + 1;
  s.auftrag.geliefert = 0;
  s.auftrag.pause = AUFTRAG_PAUSE;
  return true;
}

/* ------------------------------------------------------------ Missionen */

export function missionStand(s) {
  const m = MISSIONEN[s.mission];
  if (!m) return null;
  const st = s.stat;
  let ist = 0;
  let ziel = typeof m.ziel === 'number' ? m.ziel : 1;
  switch (m.art) {
    case 'umgesehen': ist = st.umgesehen; break;
    case 'gelaufen': ist = st.gelaufen; break;
    case 'tipps': ist = st.tipps; break;
    case 'verkauft': ist = st.verkauft; break;
    case 'tech': ist = techStufe(s, m.ziel) > 0 ? 1 : 0; break;
    case 'werkzeug': ist = st.werkzeug[m.ziel] ? 1 : 0; break;
    case 'verdient': ist = s.verdient; break;
    case 'gefegt': ist = st.gefegt; break;
    case 'gebaut': ist = bauAnzahl(s, m.ziel[0]); ziel = m.ziel[1]; break;
    case 'strom': ist = st.rechenMitStrom ? 1 : 0; break;
    case 'nadeln': ist = s.nadelnGesamt; break;
    case 'auftraege': ist = st.auftraege; break;
    case 'produziert': ist = st.produziert[m.ziel[0]] || 0; ziel = m.ziel[1]; break;
    case 'abgetragen': ist = st.abgetragen; break;
    case 'haelfte': ist = s.ladung > 1 ? 1 : (s.haufenStart > 0 ? 1 - s.haufenRest / s.haufenStart : 0); break;
    case 'ladungen': ist = s.ladung; break;
    case 'forschung': ist = techGekauft(s); break;
    case 'arten': ist = artenGefunden(s); break;
    default: ist = 0;
  }
  return { m, ist: Math.min(ist, ziel), ziel, erfuellt: ist >= ziel };
}

/** Erfüllte Missionen der Reihe nach auszahlen. Geschenkte Bauten liegen dann im Baukatalog. */
export function missionenPruefen(s, ereignisse) {
  for (let schutz = 0; schutz < 8; schutz++) {
    if (s.missionErledigt.includes(s.mission)) { s.mission++; continue; }
    const ms = missionStand(s);
    if (!ms || !ms.erfuellt) return;
    const { m } = ms;
    let text = '';
    let betrag = 0;
    if (m.geschenk) {
      const b = BAU_NACH_ID[m.geschenk];
      s.geschenke[m.geschenk] = (s.geschenke[m.geschenk] || 0) + 1;
      // Wer einen Bau geschenkt bekommt, darf ihn auch nachkaufen.
      const plan = b && b.frei ? PLAN_FUER[b.frei] : null;
      if (plan && !techStufe(s, plan) && techOffen(s, plan)) { s.tech[plan] = 1; }
      s.rev++;
      text = `${b ? b.name : m.geschenk} geschenkt – liegt im Baukatalog`;
    } else if (m.geschenkTech) {
      const t = TECH_NACH_ID[m.geschenkTech];
      if (techStufe(s, t.id) < t.stufen) {
        s.tech[t.id] = techStufe(s, t.id) + 1;
        s.rev++;
        text = `${t.name} geschenkt`;
      } else {
        einnahme(s, t.kosten);
        betrag = t.kosten;
        text = `statt ${t.name}`;
      }
    } else if (m.geld) {
      einnahme(s, m.geld);
      betrag = m.geld;
    }
    s.mission++;
    ereignisse.push({ typ: 'mission', text: m.text, belohnung: text, geld: betrag });
  }
}
