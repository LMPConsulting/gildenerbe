// Der Baumodus: wie im Vorbild schwebt ein Abbild des gewählten Baus vor dir,
// dorthin, wo du auf den Boden schaust. Drehen in 45°-Schritten, ein Kolben-
// rechen dreht sich von selbst zum Haufen. Bänder in zwei Schritten (Anfang,
// Ende), der Weg dazwischen wird gesucht und rastet an Anschlüssen ein. Wände,
// Geländer und Leitungen ebenso von Punkt zu Punkt. Abbauen: anschauen und
// bestätigen. Verbindet Logik (bauen.js) mit Grafik (objekte3d.js) und der
// Bauleiste (ui/bauen.js).

import { WELT } from './daten.js';
import { haufenHoehe } from './haufen.js';
import { werte, bauKosten } from './wirtschaft.js';
import { geld } from './format.js';
import { BAU_BY_ID, hallenGrenzen, imFussabdruck, HAUSANSCHLUSS } from './welt.js';
import { leitungsPunkt } from './versorgung.js';
import { anschlussListe } from './baender.js';
import {
  bauPruefen, bauSetzen, bandAnker, bandPlanen, bandSetzen, liniePlanen, linieSetzen, abbauInfo, bauAbbauen, GRUND_TEXT,
} from './bauen.js';

const RASTER_BAU = 0.25;
const HUB_MAX = 3;
const WEITE_MIN = 1.2;
const WEITE_MAX = 12;
const rastern = (v, r = RASTER_BAU) => Math.round(v / r) * r;
const winkel45 = (w) => Math.round(w / (Math.PI / 4)) * (Math.PI / 4);
const meter = (m) => `${m.toFixed(1).replace('.', ',')} m`;

/**
 * ctx: { holeStand(), objekte, hud (aus bauHudBauen), ui, klang, ereignisse(liste), abbauFragen(bau, info, weiter) }.
 * Liefert { aktiv(), art(), starten(typ), abbauStarten(), abbrechen(), setzen(), drehen(), naeher(), weiter(),
 * hoeher(), tiefer(), einrasten(), schritt(kamera, blick) }.
 */
export function baumodusBauen(ctx) {
  let modus = null;
  let planZeit = 0;
  let zuletztOk = true;

  const stand = () => ctx.holeStand();
  const beenden = () => {
    modus = null;
    ctx.objekte.vorschauWeg();
    ctx.hud.verstecken();
  };

  /** Wohin der Blick trifft: Oberkante einer Plattform, sonst der Boden (oder ein Punkt vor dir). [x, z, y] */
  function blickPunkt(k, blick, weite) {
    const [dx, dy, dz] = blick;
    const flach = Math.hypot(dx, dz) || 1;
    if (dy < -0.02) {
      let beste = null;
      const hp = BAU_BY_ID.plattform.h;
      for (const b of stand().bauten) {
        if (b.typ !== 'plattform') continue;
        const oben = (b.y || 0) + hp;
        if (k.y <= oben + 0.05) continue; // von unten sieht man die Oberseite nicht
        const tp = (oben - k.y) / dy;
        if (tp <= 0 || tp * flach > WEITE_MAX) continue;
        const hx = k.x + dx * tp;
        const hz = k.z + dz * tp;
        if (!imFussabdruck(b, hx, hz, 0)) continue;
        if (!beste || tp < beste.t) beste = { t: tp, x: hx, z: hz, y: oben };
      }
      if (beste) return [beste.x, beste.z, beste.y];
    }
    let t = dy < -0.02 ? (0 - k.y) / dy : Infinity;
    let hx; let hz;
    if (Number.isFinite(t) && t * flach <= WEITE_MAX) {
      hx = k.x + dx * t; hz = k.z + dz * t;
      const d = Math.hypot(hx - k.x, hz - k.z);
      if (d < WEITE_MIN) { hx = k.x + (dx / flach) * WEITE_MIN; hz = k.z + (dz / flach) * WEITE_MIN; }
    } else {
      t = weite;
      hx = k.x + (dx / flach) * t; hz = k.z + (dz / flach) * t;
    }
    const gr = hallenGrenzen(werte(stand()).hallenFelder);
    return [Math.max(gr.xMin + 0.2, Math.min(gr.xMax - 0.2, hx)), Math.max(gr.zMin + 0.2, Math.min(gr.zMax - 0.2, hz)), 0];
  }

  function kostenText(s, typ) {
    if ((s.geschenke[typ] || 0) > 0) return 'Geschenk';
    return geld(bauKosten(s, typ));
  }

  /** Anschlüsse in der Nähe zeigen (beim Bandbau). */
  function ankerListe(s, x, z, ende, gewaehlt) {
    const liste = [];
    for (const b of s.bauten) {
      if (b.typ === 'band' || Math.hypot(b.x - x, b.z - z) > 7) continue;
      for (const p of anschlussListe(b)) {
        if ((p.art === 'ein') !== ende) continue;
        liste.push({ x: p.x, y: p.y, z: p.z, ziel: !!gewaehlt && gewaehlt.bau === b && gewaehlt.port === p.i && gewaehlt.art === p.art });
      }
    }
    if (gewaehlt && (gewaehlt.art === 'stand' || gewaehlt.art === 'laster' || gewaehlt.art === 'band')) {
      liste.push({ x: gewaehlt.x, y: gewaehlt.y, z: gewaehlt.z, ziel: true });
    }
    return liste.slice(0, 24);
  }

  function abbauAusfuehren(bau) {
    const s = stand();
    const ev = [];
    const r = bauAbbauen(s, bau, ev);
    if (r.ok) {
      ctx.klang.abbauen();
      ctx.ui.toast(r.geschenk ? `${BAU_BY_ID[bau.typ].name} liegt wieder im Katalog.` : `${BAU_BY_ID[bau.typ].name} abgebaut · +${geld(r.erstattung)}`, '');
    } else if (r.grund) {
      ctx.klang.fehler();
      ctx.ui.toast(GRUND_TEXT[r.grund] || 'Geht nicht.', 'warn');
    }
    ctx.ereignisse(ev);
  }

  /** Was ein Mast an dieser Stelle erreichen würde: Leitungen in der Vorschau und eine Zeile. */
  function mastVorschau(s, x, z) {
    const w = werte(s);
    const oben = [x, 4.3, z];
    const leitungen = [];
    let masten = 0;
    let haus = false;
    let maschinen = 0;
    if (Math.hypot(HAUSANSCHLUSS.x - x, HAUSANSCHLUSS.z - z) <= w.spannweite) {
      haus = true;
      leitungen.push([oben, [HAUSANSCHLUSS.x, HAUSANSCHLUSS.y, HAUSANSCHLUSS.z]]);
    }
    for (const b of s.bauten) {
      const d = BAU_BY_ID[b.typ];
      if (b.typ === 'mast') {
        if (Math.hypot(b.x - x, b.z - z) <= w.spannweite) { masten++; leitungen.push([oben, leitungsPunkt(b)]); }
      } else if (d.kw !== 0 && !d.linie && Math.hypot(b.x - x, b.z - z) - Math.max(d.b, d.t) / 2 <= w.abspannung) {
        maschinen++;
        leitungen.push([oben, leitungsPunkt(b)]);
      }
    }
    const teile = [];
    if (haus) teile.push('Hausanschluss');
    if (masten) teile.push(masten === 1 ? '1 Mast' : `${masten} Masten`);
    if (maschinen) teile.push(maschinen === 1 ? '1 Maschine' : `${maschinen} Maschinen`);
    return {
      leitungen, ringe: [w.spannweite, w.abspannung],
      text: teile.length ? `verbindet sich mit ${teile.join(', ')}` : null,
      grund: haus || masten ? null : `Kein Mast und kein Hausanschluss in ${kommaMeter(w.spannweite)}`,
    };
  }
  const kommaMeter = (m) => `${String(Math.round(m * 10) / 10).replace('.', ',')} m`;

  const api = {
    aktiv: () => !!modus,
    /** Ist die gerade gezeigte Stelle gültig? (Der große Knopf wird sonst matt.) */
    ok: () => zuletztOk,

    /** Abbauen ohne Zielen (aus der Maschinentafel, die schon nachgefragt hat). */
    abbauDirekt(bau) {
      abbauAusfuehren(bau);
      if (modus && modus.art === 'abbau') beenden();
    },
    art: () => (modus ? modus.art : null),

    /** Einen Bau aus dem Katalog in die Hand nehmen. */
    starten(typ) {
      const d = BAU_BY_ID[typ];
      if (!d) return;
      ctx.objekte.vorschauWeg();
      if (typ === 'band') modus = { art: 'band', typ, schritt: 'anfang', einrasten: true, weite: 5, hub: 0 };
      else if (d.linie) modus = { art: 'linie', typ, schritt: 'anfang', weite: 5 };
      else modus = { art: 'bau', typ, dreh: 0, weite: 5 };
    },

    abbauStarten() {
      ctx.objekte.vorschauWeg();
      modus = { art: 'abbau' };
    },

    abbrechen() {
      if (!modus) return;
      if ((modus.art === 'band' || modus.art === 'linie') && modus.schritt === 'ende') {
        modus.schritt = 'anfang';
        modus.von = null;
        modus.plan = null;
        ctx.objekte.bandVorschau(null);
        ctx.objekte.linienVorschau(null);
        return;
      }
      beenden();
    },

    drehen() { if (modus && modus.art === 'bau') { modus.dreh += Math.PI / 4; ctx.klang.klick(); } },
    naeher() { if (modus) modus.weite = Math.max(WEITE_MIN, modus.weite - 1); },
    weiter() { if (modus) modus.weite = Math.min(WEITE_MAX, modus.weite + 1); },
    /** Freie Bandenden anheben oder absenken (0 bis 3 m in halben Metern), für Rampen und Kreuzungen. */
    hoeher() { if (modus && modus.art === 'band' && modus.hub < HUB_MAX) { modus.hub = Math.min(HUB_MAX, modus.hub + 0.5); modus.plan = null; ctx.klang.klick(); } },
    tiefer() { if (modus && modus.art === 'band' && modus.hub > 0) { modus.hub = Math.max(0, modus.hub - 0.5); modus.plan = null; ctx.klang.klick(); } },
    einrasten() { if (modus && modus.art === 'band') { modus.einrasten = !modus.einrasten; modus.plan = null; ctx.klang.klick(); } },

    /** Bestätigen: bauen, Anfang oder Ende setzen, abbauen. */
    setzen() {
      if (!modus) return;
      const s = stand();
      const ev = [];
      if (modus.art === 'bau') {
        const l = modus.lage;
        if (!l) return;
        const r = bauSetzen(s, modus.typ, l.x, l.z, l.rot, { y: l.y || 0 });
        if (!r.ok) { ctx.klang.fehler(); ctx.ui.toast(GRUND_TEXT[r.grund] || 'Geht hier nicht.', 'warn'); return; }
        ctx.klang.bauen();
        ev.push({ typ: 'gebaut', bau: r.bau });
        // Nach einem Geschenk ist der Modus vorbei, damit kein zweiter Tipp aus Versehen kauft
        if (r.bau.geschenk) beenden();
      } else if (modus.art === 'band' || modus.art === 'linie') {
        if (modus.schritt === 'anfang') {
          if (!modus.anker || modus.ankerOk === false) { ctx.klang.fehler(); return; }
          modus.von = modus.anker;
          modus.schritt = 'ende';
          modus.plan = null;
          ctx.klang.klick();
          return;
        }
        const plan = modus.plan;
        if (!plan || !plan.ok) {
          ctx.klang.fehler();
          ctx.ui.toast(GRUND_TEXT[plan ? plan.grund : 'kein Weg'] || 'Geht so nicht.', 'warn');
          return;
        }
        const r = modus.art === 'band' ? bandSetzen(s, plan) : linieSetzen(s, modus.typ, plan.a, plan.b, plan.y || 0);
        if (!r.ok) { ctx.klang.fehler(); ctx.ui.toast(GRUND_TEXT[r.grund] || 'Geht so nicht.', 'warn'); return; }
        ctx.klang.bauen();
        ev.push({ typ: 'gebaut', bau: r.bau });
        modus.schritt = 'anfang';
        modus.von = null;
        modus.plan = null;
        ctx.objekte.bandVorschau(null);
        ctx.objekte.linienVorschau(null);
      } else if (modus.art === 'abbau') {
        const bau = modus.ziel;
        if (!bau) { ctx.klang.fehler(); return; }
        if (abbauInfo(s, bau).warnung) ctx.abbauFragen(bau, abbauInfo(s, bau), () => abbauAusfuehren(bau));
        else abbauAusfuehren(bau);
        modus.ziel = null;
        return;
      }
      ctx.ereignisse(ev);
    },

    /** Jedes Bild im Baumodus: Vorschau und Leiste nachführen. */
    schritt(k, blick, dt) {
      if (!modus) return false;
      const s = stand();
      planZeit -= dt;
      if (modus.art === 'abbau') {
        const t = ctx.objekte.trefferBau(ctx.strahl(k, blick), 9);
        modus.ziel = t ? t.bau : null;
        ctx.objekte.markieren(modus.ziel);
        const info = modus.ziel ? abbauInfo(s, modus.ziel) : null;
        zuletztOk = !!modus.ziel;
        ctx.hud.zeigen({
          titel: modus.ziel ? `${BAU_BY_ID[modus.ziel.typ].name} abbauen` : 'Abbauen',
          zeile: info ? (info.geschenk ? 'Geschenk zurück in den Katalog' : `+${geld(info.erstattung)} zurück`) : 'Auf einen Bau schauen',
          grund: info && info.warnung ? 'Darin steckt eine Nadel' : null,
          ok: !!modus.ziel, schritt: 'abbau', einrasten: null, drehen: false, abstand: false,
        });
        return true;
      }
      const [px, pz, py] = blickPunkt(k, blick, modus.weite);
      if (modus.art === 'bau') {
        const d = BAU_BY_ID[modus.typ];
        const x = rastern(px);
        const z = rastern(pz);
        let rot;
        if (modus.typ === 'rechen' && Math.hypot(x - WELT.haufenX, z - WELT.haufenZ) < 14) {
          // Der Rechen schaut von selbst zum Haufen (in 15°-Schritten), Drehen dreht weiter
          const w = Math.atan2(-(WELT.haufenZ - z), WELT.haufenX - x);
          rot = Math.round(w / (Math.PI / 12)) * (Math.PI / 12) + modus.dreh;
        } else {
          // Blickrichtung (x, z) als Drehung: lokal +x zeigt nach (cos rot, -sin rot)
          rot = winkel45(Math.atan2(-blick[2], blick[0])) + modus.dreh;
        }
        const p = bauPruefen(s, modus.typ, x, z, rot, { y: py });
        modus.lage = { x, z, rot, y: py };
        const mast = modus.typ === 'mast' ? mastVorschau(s, x, z) : null;
        ctx.objekte.geist(modus.typ, { x, y: py, z, rot }, p.ok, mast ? { ringe: mast.ringe, leitungen: mast.leitungen } : null);
        zuletztOk = p.ok;
        let grund = p.ok ? (mast ? mast.grund : null) : GRUND_TEXT[p.grund] || 'Geht hier nicht';
        if (p.ok && modus.typ === 'rechen') {
          const [kx, kz] = [x + Math.cos(rot) * (d.b / 2 + 0.45), z - Math.sin(rot) * (d.b / 2 + 0.45)];
          if (haufenHoehe(s.hf, kx, kz) < 0.06) grund = 'Der Kamm muss ins Heu zeigen';
        }
        const kw = d.kw > 0 ? ` · braucht ${d.kw} kW` : d.kw < 0 ? ` · liefert ${-d.kw} kW` : '';
        const extra = mast && mast.text ? ` · ${mast.text}` : '';
        ctx.hud.zeigen({
          titel: d.name, zeile: `${kostenText(s, modus.typ)}${kw}${extra}`, grund, ok: p.ok,
          schritt: 'setzen', einrasten: null, drehen: true, abstand: false,
        });
        return true;
      }
      if (modus.art === 'band') {
        const ende = modus.schritt === 'ende';
        const a = bandAnker(s, px, pz, ende, { radius: 1.2, y: py + modus.hub });
        const d = BAU_BY_ID.band;
        const hubText = modus.hub > 0 && a.art === 'frei' ? ` · ${meter(modus.hub)} hoch` : '';
        if (!ende) {
          const ok = py > 0.1 || haufenHoehe(s.hf, a.x, a.z) < 0.15;
          modus.anker = a;
          modus.ankerOk = ok;
          zuletztOk = ok;
          ctx.objekte.ankerZeigen([...ankerListe(s, px, pz, false, a), { x: a.x, y: a.y, z: a.z, ziel: true }]);
          ctx.hud.zeigen({
            titel: 'Förderband', zeile: `Anfang wählen${hubText} · ${geld(d.prometer * werte(s).maschinenKosten)} je Meter`,
            grund: ok ? null : GRUND_TEXT.haufen, ok, schritt: 'anfang', einrasten: modus.einrasten, drehen: false, abstand: false, hoehe: modus.hub,
          });
          return true;
        }
        const alt = modus.plan;
        const verschoben = !modus.anker || Math.hypot(a.x - modus.anker.x, a.z - modus.anker.z) > 0.12 || a.art !== modus.anker.art
          || Math.abs(a.y - modus.anker.y) > 0.01;
        if ((verschoben || !alt) && planZeit <= 0) {
          modus.anker = a;
          modus.plan = bandPlanen(s, modus.von, a, { gerade: !modus.einrasten });
          planZeit = 0.12;
          ctx.objekte.bandVorschau(modus.plan.punkte || [[modus.von.x, modus.von.y, modus.von.z], [a.x, a.y, a.z]], !!modus.plan.ok);
        }
        const plan = modus.plan;
        zuletztOk = !!(plan && plan.ok);
        ctx.objekte.ankerZeigen([{ x: modus.von.x, y: modus.von.y, z: modus.von.z, ziel: true }, ...ankerListe(s, px, pz, true, a)]);
        const ziel = a.art === 'stand' ? ' · zum Stand' : a.art === 'laster' ? ' · zum Laster' : a.art === 'ein' ? ` · in ${BAU_BY_ID[a.bau.typ].name}` : a.art === 'band' ? ' · aufs Band' : '';
        ctx.hud.zeigen({
          titel: 'Förderband',
          zeile: plan && plan.punkte ? `${meter(plan.laenge)} · ${geld(plan.kosten)}${ziel}${hubText}` : `Ende wählen${ziel}${hubText}`,
          grund: plan && !plan.ok ? GRUND_TEXT[plan.grund] || 'Geht so nicht' : null,
          ok: !!(plan && plan.ok), schritt: 'ende', einrasten: modus.einrasten, drehen: false, abstand: false, hoehe: modus.hub,
        });
        return true;
      }
      if (modus.art === 'linie') {
        const d = BAU_BY_ID[modus.typ];
        const x = rastern(px);
        const z = rastern(pz);
        if (modus.schritt === 'anfang') {
          modus.anker = { x, z, y: py };
          modus.ankerOk = true;
          zuletztOk = true;
          ctx.objekte.ankerZeigen([{ x, y: py, z, ziel: true }]);
          ctx.hud.zeigen({
            titel: d.name, zeile: `Anfang wählen · ${geld(d.prometer * werte(s).maschinenKosten)} je Meter`,
            grund: null, ok: true, schritt: 'anfang', einrasten: null, drehen: false, abstand: false,
          });
          return true;
        }
        const a = [modus.von.x, modus.von.z];
        const b = [x, z];
        const hoehe = modus.von.y || 0;
        const plan = liniePlanen(s, modus.typ, a, b, hoehe);
        modus.plan = { ...plan, a, b, y: hoehe };
        zuletztOk = plan.ok;
        ctx.objekte.linienVorschau(modus.typ, a, b, plan.ok, hoehe);
        ctx.objekte.ankerZeigen([{ x: a[0], y: hoehe, z: a[1], ziel: true }, { x, y: hoehe, z, ziel: false }]);
        ctx.hud.zeigen({
          titel: d.name, zeile: plan.laenge ? `${meter(plan.laenge)} · ${geld(plan.kosten)}` : 'Ende wählen',
          grund: plan.ok ? null : GRUND_TEXT[plan.grund] || 'Geht so nicht', ok: plan.ok, schritt: 'ende', einrasten: null, drehen: false, abstand: false,
        });
        return true;
      }
      return false;
    },
  };
  return api;
}
