// Was die Hände tun: stechen, zupfen, fegen, saugen, aufheben, verkaufen.
// Gegrabenes Heu landet im Behälter (Arme, Eimer, Schubkarre), ein Teil fällt
// daneben und rollt den Hang hinunter. Reine Logik; die Grafik liest nur mit.

import { WERKZEUGE } from './daten.js';
import { haufenAbtragen } from './haufen.js';
import { werte, taschePlatz, preisRoh, verkaufen } from './wirtschaft.js';
import { nadelnFreilegen, nadelFinden } from './nadeln.js';
import { loseAblegen, loseEinsammeln } from './lose.js';

export const WERKZEUG_NACH_ID = Object.fromEntries(WERKZEUGE.map((w) => [w.id, w]));

/** Radius der Mulde, die ein Stich hinterlässt. */
const MULDE = { hand: 0.25, sandschaufel: 0.32, spaten: 0.42, heugabel: 0.52, sauger: 0.3 };

export function werkzeugBesitz(s, id) {
  const wz = WERKZEUG_NACH_ID[id];
  return !!wz && (wz.frei === null || werte(s).frei.has(wz.frei));
}

export function werkzeugeInLeiste(s) {
  return WERKZEUGE.filter((wz) => werkzeugBesitz(s, wz.id));
}

export function werkzeugWaehlen(s, id) {
  if (!werkzeugBesitz(s, id)) return false;
  if (s.spieler.werkzeug === id) return true;
  s.spieler.werkzeug = id;
  s.spieler.sauger.an = false;
  return true;
}

/** Welcher Behälter wird gerade getragen? Der beste freigeschaltete. */
export function behaelter(s) {
  const w = werte(s);
  if (w.frei.has('schubkarre')) return 'schubkarre';
  if (w.frei.has('eimer')) return 'eimer';
  return 'arme';
}

export const platzFrei = (s) => Math.max(0, taschePlatz(werte(s)) - s.spieler.last);

/** Halme pro Stich mit dem Werkzeug, ohne Puste und Glück. */
export function stichMenge(w, werkzeug) {
  const wz = WERKZEUG_NACH_ID[werkzeug];
  if (!wz || !wz.faktor) return 0;
  const f = typeof wz.faktor === 'string' ? w[wz.faktor] : wz.faktor;
  return w.griff * f;
}

export const kannStechen = (werkzeug) => ['hand', 'sandschaufel', 'spaten', 'heugabel'].includes(werkzeug);

/**
 * Ein Stich in den Haufen an der Trefferstelle t = {x, y, z}.
 * Liefert { menge, verschuettet, voll, erschoepft, krit }.
 */
export function stechen(s, hf, t, zufall, ereignisse) {
  const sp = s.spieler;
  const w = werte(s);
  const wz = WERKZEUG_NACH_ID[sp.werkzeug];
  if (!wz || !kannStechen(wz.id)) return { menge: 0 };
  const frei = platzFrei(s);
  if (frei <= 0) return { menge: 0, voll: true };
  let menge = stichMenge(w, wz.id);
  let erschoepft = false;
  if (wz.puste) {
    if (sp.puste >= w.ausdauerKosten) sp.puste -= w.ausdauerKosten;
    else { menge *= w.erschoepft; erschoepft = true; }
    sp.ruhe = 0;
  }
  const krit = w.krit > 0 && zufall() < w.krit;
  if (krit) menge *= w.kritFaktor;
  menge = Math.max(1, Math.round(menge));
  // Was daneben fällt, nimmt man trotzdem aus dem Haufen.
  const verschuettet = Math.round(menge * w.verschuetten);
  const aus = haufenAbtragen(hf, t.x, t.z, menge + verschuettet, MULDE[wz.id] || 0.4);
  if (aus <= 0) return { menge: 0 };
  const inBehaelter = Math.min(frei, Math.round(aus * menge / (menge + verschuettet)));
  const daneben = aus - inBehaelter;
  sp.last += inBehaelter;
  loseAblegen(s, hf, t.x, t.z, daneben, zufall);
  s.stat.tipps++;
  s.stat.abgetragen += aus;
  s.stat.hand += aus;
  s.stat.werkzeug[wz.id] = (s.stat.werkzeug[wz.id] || 0) + 1;
  const mit = nadelnFreilegen(s, hf, { art: 'spieler', x: t.x, z: t.z, radius: MULDE[wz.id] || 0.4, werkzeug: wz.id }, ereignisse);
  for (const n of mit) nadelFinden(s, n, ereignisse);
  ereignisse.push({ typ: 'stich', menge: inBehaelter, verschuettet: daneben, krit, x: t.x, y: t.y, z: t.z, werkzeug: wz.id });
  return { menge: inBehaelter, verschuettet: daneben, voll: platzFrei(s) <= 0, erschoepft, krit };
}

/** Besenstrich über dem Boden vor den Füßen. */
export function fegen(s, x, z, ereignisse) {
  const w = werte(s);
  const frei = platzFrei(s);
  if (frei <= 0) return { menge: 0, voll: true };
  const menge = loseEinsammeln(s, x, z, 1.5, Math.min(frei, Math.round(w.besen)));
  if (menge > 0) {
    s.spieler.last += menge;
    s.stat.gefegt += menge;
    s.stat.werkzeug.besen = (s.stat.werkzeug.besen || 0) + 1;
    ereignisse.push({ typ: 'gefegt', menge, x, z });
  }
  return { menge };
}

/**
 * Sauger, einen Zeitschritt lang. an: Knopf gehalten. ziel: Treffer auf dem Haufen
 * (oder null), boden: Punkt vor den Füßen für lose Halme.
 */
export function saugerSchritt(s, hf, dt, an, ziel, boden, zufall, ereignisse) {
  const sg = s.spieler.sauger;
  const w = werte(s);
  const aktiv = an && !sg.heiss && s.spieler.werkzeug === 'sauger' && platzFrei(s) > 0;
  sg.an = aktiv;
  if (aktiv) {
    sg.rest = (sg.rest || 0) + w.saugerRate * dt;
    let menge = Math.floor(sg.rest);
    if (menge > 0) {
      sg.rest -= menge;
      menge = Math.min(menge, platzFrei(s));
      let genommen = boden ? loseEinsammeln(s, boden.x, boden.z, 2.2, menge) : 0;
      if (genommen < menge && ziel) {
        const aus = haufenAbtragen(hf, ziel.x, ziel.z, menge - genommen, MULDE.sauger);
        s.stat.abgetragen += aus;
        s.stat.hand += aus;
        genommen += aus;
        const mit = nadelnFreilegen(s, hf, { art: 'spieler', x: ziel.x, z: ziel.z, radius: MULDE.sauger, werkzeug: 'sauger' }, ereignisse);
        for (const n of mit) nadelFinden(s, n, ereignisse);
      }
      s.spieler.last += genommen;
      if (genommen > 0) s.stat.werkzeug.sauger = (s.stat.werkzeug.sauger || 0) + 1;
    }
    sg.hitze += dt / w.saugerHitze;
    if (sg.hitze >= 1) {
      sg.hitze = 1; sg.heiss = true; sg.an = false;
      ereignisse.push({ typ: 'ueberhitzt' });
    }
  } else {
    sg.hitze = Math.max(0, sg.hitze - dt / (w.saugerHitze * 0.6));
    if (sg.heiss && sg.hitze <= 0) sg.heiss = false;
  }
}

/** Mit der Hand einen losen Büschel greifen (bis zu 20 Halme). */
export function bueschelGreifen(s, x, z, ereignisse) {
  const frei = platzFrei(s);
  if (frei <= 0) return { menge: 0, voll: true };
  const menge = loseEinsammeln(s, x, z, 0.8, Math.min(frei, 20));
  if (menge > 0) {
    s.spieler.last += menge;
    s.stat.gefegt += menge;
    ereignisse.push({ typ: 'gegriffen', menge, x, z });
  }
  return { menge };
}

/** Am Stand: den Behälter in den Trichter kippen. */
export function standKippen(s, ereignisse) {
  const sp = s.spieler;
  if (sp.last <= 0) return 0;
  const w = werte(s);
  const betrag = sp.last * preisRoh(w);
  verkaufen(s, betrag, sp.last, ereignisse, 'stand');
  s.stat.gaenge++;
  sp.last = 0;
  return betrag;
}

/** Puste zurück, wenn man nicht sticht und nicht rennt. */
export function pusteSchritt(s, dt, rennt) {
  const sp = s.spieler;
  const w = werte(s);
  sp.ruhe = (sp.ruhe || 0) + dt;
  if (rennt) {
    const kosten = w.rennKosten * (w.laufzeit < 1 ? w.laufzeit : 1);
    sp.puste = Math.max(0, sp.puste - kosten * dt);
    sp.ruhe = 0;
  } else if (sp.ruhe > 0.35) {
    sp.puste = Math.min(w.ausdauer, sp.puste + w.ausdauerRegen * dt);
  }
}
