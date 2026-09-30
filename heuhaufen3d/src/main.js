// Start und Spielschleife: baut Szene, Halle, Haufen und Oberfläche, liest die
// Eingabe, bewegt den Spieler, findet heraus, worauf er zielt, führt die
// Werkzeugaktion aus, treibt die Welt an und zeigt alles an.

import * as THREE from '../vendor/three.module.min.js';
import { WELT, SPIELER, PRODUKTE } from './daten.js';
import { haufenStrahl, haufenHoehe } from './haufen.js';
import {
  werte, techStatus, proMinute, gehFaktor, taschePlatz, TECH_NACH_ID, techStufe, missionStand,
} from './wirtschaft.js';
import { TECH } from './daten.js';
import {
  standNeu, spielTakt, speichern, laden, ladungBestellen, SPEICHER3D_KEY, spielZufall, abwesenheitBeginnen, abwesenheitWeiter,
} from './spiel.js';
import {
  stechen, kannStechen, fegen, saugerSchritt, bueschelGreifen, standKippen, pusteSchritt, werkzeugWaehlen,
  werkzeugeInLeiste, behaelter,
} from './werkzeuge.js';
import { detektorMessen, nadelFinden } from './nadeln.js';
import { loseNaechster } from './lose.js';
import { klang, klangWecken, klangStumm, saugerAn, saugerAus, saugerHitze, brummen, wind } from './klang.js';
import { szeneBauen } from './grafik/szene3d.js';
import { hofBauen } from './grafik/hof3d.js';
import { haufenAnsichtBauen } from './grafik/haufen3d.js';
import { ansichtBauen } from './grafik/ansicht.js';
import { steuerungBauen } from './steuerung.js';
import { spielerBewegen, spielerKamera, blickRichtung } from './spieler.js';
import { oberflaecheBauen, h } from './ui/oberflaeche.js';
import { forschungOeffnen } from './ui/forschung.js';
import {
  werkzeugstandZeigen, lieferschalterZeigen, nadelbuchZeigen, menueZeigen, nadelModal, anleitungZeigen,
} from './ui/panele.js';
import { geld, halme, dauer } from './format.js';
import { automatikSchritt, netzHolen } from './automatik.js';
import { bautenUmgebung, bauVersion, bauSetzen, bandAnker, bandPlanen, bandSetzen } from './bauen.js';
import {
  gegenstandNehmen, gehaltenesStueck, stueckWerfen, heuWerfen, stueckImBlick, gegenstandVerkaufen, gegenstandWert,
} from './gegenstaende.js';
import { scannerLeeren, annehmenMoeglich } from './maschinen.js';
import { netzSchalten } from './versorgung.js';
import { lasterAblehnen, lasterBereit, LASTER_BETT } from './laster.js';
import { BAU_BY_ID, hallenGrenzen, lauf, gitterEintragen } from './welt.js';
import { objekteBauen } from './grafik/objekte3d.js';
import { baumodusBauen } from './baumodus.js';
import { baukatalogZeigen, bauHudBauen } from './ui/bauen.js';
import { maschinePanelZeigen } from './ui/maschine.js';
import { auftragstafelZeigen } from './ui/auftrag.js';
import { skizzeZeigen } from './ui/skizze.js';

const EINSTELLUNGEN_KEY = 'heuhaufen3d-einstellungen';

function einstellungenLaden() {
  const grund = { ton: true, empfindlichkeit: 1, grafik: (window.devicePixelRatio || 1) > 2.5 ? 'mittel' : 'mittel' };
  try { return { ...grund, ...JSON.parse(localStorage.getItem(EINSTELLUNGEN_KEY) || '{}') }; } catch { return grund; }
}

function hauptStart() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const leinwand = document.createElement('canvas');
  leinwand.className = 'welt';
  const flaeche = document.createElement('div');
  flaeche.className = 'eingabe';
  app.append(leinwand, flaeche);

  const einst = einstellungenLaden();
  klangStumm(!einst.ton);
  const s3 = szeneBauen(leinwand, einst.grafik);
  let hof = null;

  let s = null;
  try { s = laden(localStorage.getItem(SPEICHER3D_KEY) || ''); } catch { s = null; }
  // Fehlt der Stand (etwa nach einem abgebrochenen Schreiben beim Schließen), hilft die Sicherung
  if (!s) { try { s = laden(localStorage.getItem(SPEICHER3D_KEY + '-sicher') || ''); } catch { s = null; } }
  const gespeichert = !!s;
  if (!s) s = standNeu();
  hof = hofBauen(s3.szene, s3.qualitaet, werte(s).hallenFelder);
  let hofFelder = werte(s).hallenFelder;
  { const gr = hallenGrenzen(hofFelder); s3.schattenAnpassen(gr.xMin, gr.xMax, gr.zMin, gr.zMax); }
  const hAnsicht = haufenAnsichtBauen(s3.szene, s.hf, s3.qualitaet);
  const ansicht = ansichtBauen(s3.szene, s3.kamera);
  const objekte = objekteBauen(s3.szene, s3.qualitaet);

  const zustand = {
    laeuft: false, // nach dem Startbild
    tafel: null, // offene Vollbild-Tafel (Forschung, Bauen)
    stichPause: 0,
    piepNaechster: 0,
    zuletztGespeichert: performance.now(),
    hudZeit: 0,
    zielText: '',
    nadelWarte: [],
    umgebungVersion: -1,
    umgebungStand: null,
    verkaufSumme: 0, // Verkäufe der Maschinen, gesammelt für eine Anzeige
    verkaufZeit: 0,
    kasseZeit: 0,
    rechenZeit: 0,
  };

  const st = steuerungBauen(flaeche, {
    beiTaste: (k) => {
      if (!zustand.laeuft) return;
      if (/^[1-9]$/.test(k)) {
        const liste = werkzeugeInLeiste(s);
        const wz = liste[Number(k) - 1];
        if (wz) werkzeugKlick(wz.id);
      } else if (k === 'e') aktionTippen();
      else if (k === 'tab' || k === 'r') forschungAuf();
      else if (k === 'b') bauenAuf();
      else if (k === 'n') nadelnAuf();
      else if (k === 'escape') { if (zustand.tafel) zustand.tafel.schliessen(); else if (bm.aktiv()) bm.abbrechen(); }
      else if (k === 'q' && bm.aktiv()) bm.drehen();
      else if (k === 'q') ablegen();
      else if (k === 'f' && bm.aktiv()) bm.einrasten();
      // C und V schieben den Geist näher und weiter weg wie im Vorbild; sonst duckt C
      else if (k === 'c' && bm.art() === 'band') bm.tiefer();
      else if (k === 'v' && bm.art() === 'band') bm.hoeher();
      else if (k === 'c' && bm.aktiv()) bm.naeher();
      else if (k === 'v' && bm.aktiv()) bm.weiter();
      else if (k === 'c') ui.duckenZeigen(st.duckenUmschalten());
    },
  });
  st.zustand.empfindlichkeit = einst.empfindlichkeit;
  // Mausrad im Baumodus: Geist weiter weg (hoch) oder näher (runter)
  let radRest = 0;
  flaeche.addEventListener('wheel', (ev) => {
    if (!bm.aktiv()) return;
    ev.preventDefault();
    radRest += ev.deltaY;
    const band = bm.art() === 'band';
    while (Math.abs(radRest) >= 80) {
      if (radRest < 0) { if (band) bm.hoeher(); else bm.weiter(); radRest += 80; } else { if (band) bm.tiefer(); else bm.naeher(); radRest -= 80; }
    }
  }, { passive: false });

  const ui = oberflaecheBauen(app, {
    werkzeug: (id) => werkzeugKlick(id),
    aktion: (an) => { klangWecken(); st.aktionDruecken(an); },
    // Springen steht aus dem Ducken erst auf
    sprung: () => { if (st.zustand.duckenAn) ui.duckenZeigen(st.duckenUmschalten(false)); else st.springenDruecken(); },
    ducken: () => st.duckenUmschalten(),
    bauen: () => bauenAuf(),
    forschung: () => forschungAuf(),
    nadeln: () => nadelnAuf(),
    menue: () => menueAuf(),
    modalAuf: () => { st.zeigerFreigeben(); },
    modalZu: () => {},
    info: () => infoTippen(),
  });

  function speichernJetzt() {
    try {
      const text = speichern(s);
      localStorage.setItem(SPEICHER3D_KEY, text);
      // Alle 30 s zusätzlich eine Sicherung unter eigenem Schlüssel
      if (!zustand.sicherZeit || performance.now() - zustand.sicherZeit > 30000) {
        localStorage.setItem(SPEICHER3D_KEY + '-sicher', text);
        zustand.sicherZeit = performance.now();
      }
    } catch { /* voll oder gesperrt */ }
    zustand.zuletztGespeichert = performance.now();
  }
  function einstellungenSichern() {
    try { localStorage.setItem(EINSTELLUNGEN_KEY, JSON.stringify(einst)); } catch { /* egal */ }
  }

  /** Ein gerade gekauftes Werkzeug kommt gleich in die Hand. */
  function werkzeugNeu(id) {
    if (!['spaten', 'heugabel', 'besen', 'sauger'].includes(id)) return;
    if (werkzeugWaehlen(s, id)) ui.toast(`${({ spaten: 'Spaten', heugabel: 'Heugabel', besen: 'Besen', sauger: 'Hofsauger' })[id]} in der Hand.`, 'gut');
  }

  function werkzeugKlick(id) {
    klangWecken();
    if (werkzeugWaehlen(s, id)) klang.klick();
  }

  /** Q / ABLEGEN wie im Vorbild: was man hält, vor die Füße legen (Heu im Behälter als ein Bündel). */
  function ablegen() {
    if (!zustand.laeuft || blockiert() || bm.aktiv()) return;
    const sp = s.spieler;
    const [dx, , dz] = blickRichtung(sp);
    const l = Math.hypot(dx, dz) || 1;
    const von = [sp.x + (dx / l) * 0.55, sp.y + 1.1, sp.z + (dz / l) * 0.55];
    const richtung = [dx / l, 0, dz / l];
    if (gehaltenesStueck(s)) stueckWerfen(s, von, richtung, 0.8);
    else if (sp.last >= 1) heuWerfen(s, von, richtung, sp.last, 0.8);
    else { ui.toast('Nichts zum Ablegen.'); return; }
    klang.klick();
  }

  /* ------------------------------------------------ Tafeln und Menüs */
  const blockiert = () => ui.modalOffen() || !!zustand.tafel || !zustand.laeuft;

  function forschungAuf() {
    if (zustand.tafel) return;
    st.zeigerFreigeben();
    const f = forschungOeffnen(app, s, {
      klick: () => klang.klick(),
      gekauft: (id) => {
        klang.kauf();
        werkzeugNeu(id);
        const t = TECH_NACH_ID[id];
        if (t.effekt.some((e) => e[0] === 'frei') && techStufe(s, id) === 1) ui.toast(`${t.name} freigeschaltet.`, 'gut');
      },
      fehler: () => klang.fehler(),
      zu: () => { zustand.tafel = null; },
    });
    zustand.tafel = f;
  }
  function bauenAuf() {
    if (zustand.tafel || !zustand.laeuft) return;
    if (bm.aktiv()) { bm.abbrechen(); if (bm.aktiv()) bm.abbrechen(); return; }
    st.zeigerFreigeben();
    s.stat.katalog = (s.stat.katalog || 0) + 1;
    baukatalogZeigen(ui, s, {
      waehlen: (typ) => { klang.klick(); bm.starten(typ); },
      abbauen: () => { klang.klick(); bm.abbauStarten(); },
    });
  }
  function maschineZeigen(bau) {
    st.zeigerFreigeben();
    if (bau.typ === 'staffelei') {
      skizzeZeigen(ui, s, bau, { geaendert: () => objekte.bildNeu(bau) });
      return;
    }
    maschinePanelZeigen(ui, s, bau, {
      netz: () => netzHolen(s),
      schalten: (b) => { b.aus = !b.aus; klang.klick(); },
      einstellen: (b, feld, wert) => { b[feld] = wert; },
      abbauen: (b) => { ui.modalSchliessen(); bm.abbauDirekt(b); },
      nadelnNehmen: (b) => { ui.modalSchliessen(); scannerLeeren(s, b, ereignisPuffer); },
      netzSchalten: (m) => { const an = netzSchalten(s, netzHolen(s), m); klang.klick(); ui.toast(an ? 'Netz eingeschaltet.' : 'Netz ausgeschaltet.'); },
    });
  }
  function nadelnAuf() { nadelbuchZeigen(ui, s); }
  function menueAuf() {
    menueZeigen(ui, einst, {
      aendern: (neu) => {
        Object.assign(einst, neu);
        einstellungenSichern();
        if ('ton' in neu) klangStumm(!einst.ton);
        if ('empfindlichkeit' in neu) st.zustand.empfindlichkeit = einst.empfindlichkeit;
        if ('grafik' in neu) { speichernJetzt(); location.reload(); }
      },
      anleitung: () => anleitungZeigen(ui),
      loeschen: () => ui.modal({
        titel: 'Spielstand löschen?', absaetze: ['Alles ist weg: Geld, Forschung, Nadeln, Bauten. Das lässt sich nicht rückgängig machen.'],
        knoepfe: [{ text: 'Abbrechen', klasse: 'primaer' }, {
          text: 'Löschen', klasse: 'gefahr', aktion: () => {
            try { localStorage.removeItem(SPEICHER3D_KEY); localStorage.removeItem(SPEICHER3D_KEY + '-sicher'); } catch { /* egal */ }
            s = standNeu();
            hAnsicht.neu(s.hf);
            window.__heuhaufen3d.s = s;
            anleitungZeigen(ui);
          },
        }],
      }),
    });
  }

  /* ------------------------------------------------ Ziel bestimmen */
  const strahl = new THREE.Raycaster();
  let stationen = [];
  let stationenObjekte = [];
  function stationenSetzen() {
    stationen = [
      [hof.stand, 'stand'], [hof.werkzeugstand, 'werkzeugstand'], [hof.lieferschalter, 'lieferschalter'],
      [hof.auftragstafel, 'auftragstafel'], [hof.hausanschluss, 'hausanschluss'], [hof.werkbank, 'werkbank'],
    ];
    stationenObjekte = stationen.map(([o]) => o);
  }
  stationenSetzen();
  /** Die Halle neu bauen, wenn sie verlängert wurde (oder ein anderer Stand geladen ist). */
  function hofPruefen() {
    const felder = werte(s).hallenFelder;
    if (felder === hofFelder) return;
    hofFelder = felder;
    s3.szene.remove(hof.gruppe);
    hof.gruppe.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    hof = hofBauen(s3.szene, s3.qualitaet, felder);
    stationenSetzen();
    zustand.umgebungVersion = -1;
    const gr = hallenGrenzen(felder);
    s3.schattenAnpassen(gr.xMin, gr.xMax, gr.zMin, gr.zMax);
  }
  const v = new THREE.Vector3();

  /* ------------------------------------------------ Baumodus */
  const bauHud = bauHudBauen(app, {
    setzen: () => bm.setzen(), drehen: () => bm.drehen(), naeher: () => bm.naeher(), weiter: () => bm.weiter(),
    hoeher: () => bm.hoeher(), tiefer: () => bm.tiefer(),
    einrasten: () => bm.einrasten(), abbrechen: () => bm.abbrechen(),
  });
  const bm = baumodusBauen({
    holeStand: () => s,
    objekte,
    hud: bauHud,
    ui,
    klang,
    strahl: (k, blick) => { strahl.set(k, v.set(blick[0], blick[1], blick[2])); return strahl; },
    ereignisse: (liste) => ereignisPuffer.push(...liste),
    abbauFragen: (bau, info, weiter) => ui.modal({
      titel: `${BAU_BY_ID[bau.typ].name} abbauen?`,
      absaetze: ['In der Maschine steckt eine Nadel. Sie fällt zurück in den Haufen.'],
      knoepfe: [{ text: 'Behalten', klasse: 'primaer' }, { text: 'Trotzdem abbauen', klasse: 'gefahr', aktion: weiter }],
    }),
  });

  function zielFinden() {
    const k = s3.kamera.position;
    const [dx, dy, dz] = blickRichtung(s.spieler);
    const reichweite = SPIELER.reichweite;
    // lose Nadeln zuerst: sie sind klein, also großzügig treffen
    let bestNadel = null;
    let bestD = 0.32;
    for (const n of s.nadeln) {
      if (n.zustand !== 'lose') continue;
      const rx = n.x - k.x; const ry = n.y - k.y; const rz = n.z - k.z;
      const t = rx * dx + ry * dy + rz * dz;
      if (t < 0 || t > reichweite + 0.8) continue;
      const d = Math.hypot(rx - dx * t, ry - dy * t, rz - dz * t);
      if (d < bestD) { bestD = d; bestNadel = n; }
    }
    if (bestNadel) return { art: 'nadel', nadel: bestNadel };
    const haufenTreffer = haufenStrahl(s.hf, k.x, k.y, k.z, dx, dy, dz, reichweite + 0.5);
    const kandidaten = [];
    if (haufenTreffer && haufenTreffer.t <= reichweite) kandidaten.push({ art: 'haufen', ...haufenTreffer, abstand: haufenTreffer.t });
    strahl.set(k, v.set(dx, dy, dz));
    strahl.far = reichweite + 0.6;
    const treffer = strahl.intersectObjects(stationenObjekte, true);
    if (treffer.length) {
      let o = treffer[0].object;
      while (o && !stationen.some(([x]) => x === o)) o = o.parent;
      const eintrag = stationen.find(([x]) => x === o);
      if (eintrag) kandidaten.push({ art: eintrag[1], abstand: treffer[0].distance });
    }
    // Liegende Stücke (Heubündel, Waren): klein, darum etwas bevorzugt
    const stueck = stueckImBlick(s, k.x, k.y, k.z, dx, dy, dz, reichweite + 0.4);
    if (stueck) kandidaten.push({ art: 'stueck', g: stueck.g, abstand: stueck.t - 0.35 });
    // Bauten: Maschinen, Bänder, Masten
    strahl.set(k, v.set(dx, dy, dz));
    const bauTreffer = objekte.trefferBau(strahl, reichweite + 1.4);
    if (bauTreffer) kandidaten.push({ art: 'bau', bau: bauTreffer.bau, punkt: bauTreffer.punkt, abstand: bauTreffer.abstand });
    // Ladefläche des Lasters, wenn er am Tor steht
    if (lasterBereit(s)) {
      const B = LASTER_BETT;
      const tt = strahlKasten(k, dx, dy, dz, B.x0, 0, B.z0, B.x1, B.y + 0.6, B.z1);
      if (tt != null && tt < reichweite + 1.5) kandidaten.push({ art: 'laster', abstand: tt });
    }
    if (kandidaten.length) {
      kandidaten.sort((a, b) => a.abstand - b.abstand);
      return kandidaten[0];
    }
    // Boden vor den Füßen (für Besen und lose Büschel)
    if (dy < -0.05) {
      const t = (0.02 - k.y) / dy;
      if (t > 0 && t < reichweite + 0.4) {
        const fx = k.x + dx * t;
        const fz = k.z + dz * t;
        return { art: 'boden', x: fx, y: 0, z: fz, bueschel: loseNaechster(s, fx, fz, 0.7) };
      }
    }
    return null;
  }

  /** Strahl gegen achsparallelen Kasten: Abstand oder null. */
  function strahlKasten(k, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = 0;
    let tmax = Infinity;
    for (const [o, d, a, b] of [[k.x, dx, x0, x1], [k.y, dy, y0, y1], [k.z, dz, z0, z1]]) {
      if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
      let t1 = (a - o) / d;
      let t2 = (b - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  }

  /** Heu oder ein Stück in Blickrichtung werfen, aus Brusthöhe. */
  function wurfStart() {
    const k = s3.kamera.position;
    const [dx, dy, dz] = blickRichtung(s.spieler);
    return { von: [k.x + dx * 0.45, k.y - 0.3, k.z + dz * 0.45], richtung: [dx, dy, dz] };
  }

  /** Wurfziel auf der Ladefläche des Lasters. */
  const lasterZiel = () => [LASTER_BETT.x, LASTER_BETT.y + 0.15, (LASTER_BETT.z0 + LASTER_BETT.z1) / 2];
  /** Wurfziel an einem Bau: auf dem Band dort, wo man hinschaut, sonst mitten in den Trichter. */
  function bauZiel(ziel) {
    const b = ziel.bau;
    if (b.typ === 'band') return [ziel.punkt.x, ziel.punkt.y + 0.05, ziel.punkt.z];
    return [b.x, (b.y || 0) + BAU_BY_ID[b.typ].h + 0.1, b.z];
  }
  /** Kurzes Vibrieren (wenn das Gerät es kann und es eingeschaltet ist). */
  function beben(ms) {
    if (einst.beben === false) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* egal */ }
  }

  /** Nimmt der Bau geworfenes Heu an (Band, Trichter)? */
  const heuZiel = (bau) => bau.typ === 'band' || annehmenMoeglich(s, bau, 'roh', -1);

  /** Der kleine Knopf „Ansehen“ neben der Aktion: Maschinentafel auch mit Heu im Arm. */
  function infoTippen() {
    const z = zustand.ziel;
    if (z && z.art === 'bau') maschineZeigen(z.bau);
    else if (z && z.art === 'auftragstafel') auftragZeigen();
  }
  function auftragZeigen() {
    st.zeigerFreigeben();
    auftragstafelZeigen(ui, s, { ablehnen: () => { if (lasterAblehnen(s)) { klang.klick(); ui.toast('Auftrag abgelehnt. Der nächste kommt gleich.'); } } });
  }

  /* ------------------------------------------------ Aktion */
  function aktionTippen() {
    klangWecken();
    st.aktionDruecken(true);
    setTimeout(() => st.aktionDruecken(false), 60);
  }

  const ereignisPuffer = [];
  function aktionAusfuehren(ziel, e, dt) {
    const sp = s.spieler;
    const wz = sp.werkzeug;
    const druck = e.aktionNeu;
    const halten = e.aktion;
    zustand.stichPause -= dt;
    const w = werte(s);
    // Ein Stück in der Hand: am Stand verkaufen, sonst werfen
    const gehalten = gehaltenesStueck(s);
    if (gehalten) {
      if (!druck) return;
      if (ziel && ziel.art === 'stand') {
        gegenstandVerkaufen(s, gehalten, ereignisPuffer, 'stand');
        s.spieler.haelt = null;
        return;
      }
      const { von, richtung } = wurfStart();
      // Zielt man auf ein Band, einen Trichter oder den Laster, wirft die Hand genau hinein
      let wurfziel = null;
      if (ziel && ziel.art === 'laster') wurfziel = lasterZiel();
      else if (ziel && ziel.art === 'bau' && (ziel.bau.typ === 'band' || annehmenMoeglich(s, ziel.bau, gehalten.art, -1))) wurfziel = bauZiel(ziel);
      stueckWerfen(s, von, richtung, 6.5, wurfziel);
      klang.werfen();
      beben(12);
      return;
    }
    if (ziel && ziel.art === 'stueck') {
      if (!druck) return;
      const r = gegenstandNehmen(s, ziel.g, ereignisPuffer);
      if (r.ok) klang.plopp();
      else if (r.grund === 'voll') voll();
      return;
    }
    if (ziel && ziel.art === 'laster') {
      if (!druck) return;
      if (sp.last > 0) { const { von, richtung } = wurfStart(); heuWerfen(s, von, richtung, 60, 5.5, lasterZiel()); klang.werfen(); beben(12); }
      else ui.toast('Was auf die Ladefläche fällt, nimmt der Laster mit.');
      return;
    }
    if (ziel && ziel.art === 'bau') {
      if (!druck) return;
      const bau = ziel.bau;
      if (bau.typ === 'mast') {
        const an = netzSchalten(s, netzHolen(s), bau);
        klang.klick();
        ui.toast(an ? 'Netz eingeschaltet.' : 'Netz ausgeschaltet.');
        return;
      }
      if (bau.typ === 'scanner' && (bau.nadeln || []).length) { scannerLeeren(s, bau, ereignisPuffer); return; }
      if (sp.last > 0 && heuZiel(bau)) {
        const { von, richtung } = wurfStart();
        heuWerfen(s, von, richtung, bau.typ === 'band' ? 40 : 60, 5.5, bauZiel(ziel));
        klang.werfen();
        beben(12);
        return;
      }
      maschineZeigen(bau);
      return;
    }
    // Stationen: nur beim Drücken
    if (ziel && ['stand', 'werkzeugstand', 'lieferschalter', 'auftragstafel', 'hausanschluss', 'werkbank', 'nadel'].includes(ziel.art)) {
      if (!druck) return;
      if (ziel.art === 'stand') {
        if (sp.last <= 0) { ui.toast('Nichts dabei. Erst Heu vom Haufen holen.'); klang.fehler(); return; }
        standKippen(s, ereignisPuffer);
      } else if (ziel.art === 'werkzeugstand') {
        werkzeugstandZeigen(ui, s, {
          gekauft: (id) => { klang.kauf(); werkzeugNeu(id); },
          fehler: () => klang.fehler(),
        });
      } else if (ziel.art === 'lieferschalter') {
        lieferschalterZeigen(ui, s, {
          bestellen: function bestellen(aufRechnung, raeumen = false) {
            const r = ladungBestellen(s, { aufRechnung, raeumen });
            if (r.ok) {
              hAnsicht.neu(s.hf);
              ui.toast(`Ladung ${s.ladung} ist da: ${halme(s.haufenStart)} Halme.`, 'gut');
              if (r.geraeumt) ui.toast(`${r.geraeumt} Bauten abgebaut und erstattet.`);
              klang.kauf(); speichernJetzt();
            } else if (r.grund === 'platz') {
              // Wie im Vorbild: auf Maschinen wird nicht geschüttet
              const namen = {};
              for (const b of r.imWeg) namen[BAU_BY_ID[b.typ].name] = (namen[BAU_BY_ID[b.typ].name] || 0) + 1;
              ui.modal({
                ober: 'Lieferungen', titel: 'Der Landeplatz ist nicht frei',
                absaetze: [
                  `Die neue Ladung wird größer als die alte. Im Weg: ${Object.entries(namen).map(([n, k]) => `${k} × ${n}`).join(', ')}.`,
                  'Selbst abbauen und neu aufstellen, oder alles im Weg jetzt abbauen lassen (mit Erstattung, Geschenke kommen zurück in den Katalog).',
                ],
                knoepfe: [{ text: 'Alles abbauen und bestellen', klasse: 'primaer', aktion: () => bestellen(aufRechnung, true) }, { text: 'Selbst räumen' }],
              });
            } else { ui.toast('Das reicht nicht.', 'warn'); klang.fehler(); }
          },
        });
      } else if (ziel.art === 'auftragstafel') {
        auftragZeigen();
      } else if (ziel.art === 'hausanschluss') {
        ui.modal({ titel: 'Hausanschluss', absaetze: ['Hier kommen 5 kW aus dem Netz. Maschinen in der Nähe hängen direkt dran, weiter weg helfen Strommasten.'], knoepfe: [{ text: 'OK', klasse: 'primaer' }] });
      } else if (ziel.art === 'werkbank') {
        ui.toast('Die Werkbank. Kinderschaufel und Detektor von hier liegen in deiner Leiste.');
      } else if (ziel.art === 'nadel') {
        nadelFinden(s, ziel.nadel, ereignisPuffer);
      }
      return;
    }
    if (wz === 'sauger') return; // der Sauger läuft im eigenen Schritt
    if (wz === 'detektor') {
      if (druck) s.stat.werkzeug.detektor = (s.stat.werkzeug.detektor || 0) + (ziel && ziel.art === 'haufen' ? 1 : 0);
      return;
    }
    if (wz === 'besen') {
      if ((druck || halten) && zustand.stichPause <= 0 && ziel && (ziel.art === 'boden' || ziel.art === 'haufen')) {
        const r = fegen(s, ziel.x, ziel.z, ereignisPuffer);
        ansicht.schwung();
        zustand.stichPause = 0.5;
        if (r.voll) voll();
      }
      return;
    }
    if (ziel && ziel.art === 'boden' && ziel.bueschel && wz === 'hand') {
      if (druck) {
        const r = bueschelGreifen(s, ziel.bueschel.x, ziel.bueschel.z, ereignisPuffer);
        if (r.voll) voll();
      }
      return;
    }
    if (kannStechen(wz) && ziel && ziel.art === 'haufen') {
      if ((druck || halten) && zustand.stichPause <= 0) {
        const r = stechen(s, s.hf, ziel, spielZufall(s), ereignisPuffer);
        zustand.stichPause = 1 / (2.8 + (halten ? w.autotipp : 0));
        if (r.voll) voll();
        else if (r.menge > 0) { klang.stich(r.krit); beben(8); }
        if (r.erschoepft && !zustand.pusteGemeldet) { ui.toast('Aus der Puste. Die Kinderschaufel kostet keine.', 'warn'); zustand.pusteGemeldet = true; }
        if (!r.erschoepft) zustand.pusteGemeldet = false;
      }
    }
  }
  function voll() {
    if (zustand.vollGemeldet > performance.now()) return;
    zustand.vollGemeldet = performance.now() + 2500;
    klang.fehler();
    ui.toast(`${behaelter(s) === 'arme' ? 'Die Arme sind' : behaelter(s) === 'eimer' ? 'Der Eimer ist' : 'Die Karre ist'} voll. Ab zum Stand!`, 'warn');
  }

  function aktionsText(ziel) {
    const sp = s.spieler;
    const wz = sp.werkzeug;
    const gehalten = gehaltenesStueck(s);
    if (gehalten) {
      const name = gehalten.art === 'roh' ? 'Heubündel' : ({ knaeuel: 'Heuknäuel', ballen: 'Pressballen', pellet: 'Pellets', brei: 'Heubrei', silage: 'Wickelballen', papier: 'Heupapier', brikett: 'Öko-Ziegel' })[gehalten.art];
      if (ziel && ziel.art === 'stand') return ['Verkaufen', `${name} verkaufen · ${geld(gegenstandWert(s, gehalten))}`];
      return ['Werfen', `${name} in der Hand`];
    }
    if (!ziel) return wz === 'detektor' ? ['Messen', ''] : wz === 'sauger' ? ['Saugen', ''] : ['Aktion', ''];
    switch (ziel.art) {
      case 'stueck': {
        const g = ziel.g;
        if (g.art === 'roh' || g.art === 'knaeuel') return ['Aufheben', `${halme(g.art === 'roh' ? g.halme : 20)} Halme${g.nadel >= 0 ? ' · da glitzert etwas' : ''}`];
        return ['Aufheben', `${({ ballen: 'Pressballen', pellet: 'Pellets', brei: 'Heubrei', silage: 'Wickelballen', papier: 'Heupapier', brikett: 'Öko-Ziegel' })[g.art]} · ${geld(gegenstandWert(s, g))}`];
      }
      case 'laster': return [sp.last > 0 ? 'Werfen' : 'Laster', sp.last > 0 ? 'Heu auf die Ladefläche werfen' : 'Ladefläche des Lasters'];
      case 'bau': {
        const b = ziel.bau;
        const name = BAU_BY_ID[b.typ].name;
        if (b.typ === 'mast') return ['Schalten', `${name} · Netz ${b.aus ? 'aus' : 'an'}`];
        if (b.typ === 'scanner' && (b.nadeln || []).length) return ['Nehmen', 'Der Scanner hält eine Nadel fest!'];
        if (b.typ === 'staffelei') return ['Malen', 'Staffelei mit Skizzenbuch'];
        if (sp.last > 0 && heuZiel(b)) return ['Werfen', `Heu ${b.typ === 'band' ? 'aufs Band' : `in ${name}`} werfen`];
        return ['Ansehen', name];
      }
      case 'nadel': return ['Aufheben', 'Eine Nadel! Aufheben'];
      case 'stand': return ['Verkaufen', sp.last > 0 ? `${halme(sp.last)} Halme verkaufen · ${geld(sp.last * werte(s).preisRoh * werte(s).preisAlle)}` : 'Heu verkaufen'];
      case 'werkzeugstand': return ['Einkaufen', 'Werkzeugstand'];
      case 'lieferschalter': return ['Öffnen', 'Neue Ladung bestellen'];
      case 'auftragstafel': return ['Lesen', 'Auftragstafel'];
      case 'hausanschluss': return ['Ansehen', 'Hausanschluss · 5 kW'];
      case 'werkbank': return ['Ansehen', 'Werkbank'];
      case 'haufen':
        if (wz === 'hand') return ['Zupfen', ''];
        if (kannStechen(wz)) return ['Graben', ''];
        if (wz === 'sauger') return ['Saugen', ''];
        if (wz === 'besen') return ['Fegen', ''];
        return ['Messen', ''];
      case 'boden':
        if (wz === 'besen') return ['Fegen', ziel.bueschel ? 'Lose Halme' : ''];
        if (wz === 'hand' && ziel.bueschel) return ['Aufheben', `${halme(ziel.bueschel.m)} lose Halme`];
        return [wz === 'sauger' ? 'Saugen' : 'Aktion', ''];
      default: return ['Aktion', ''];
    }
  }

  /* ------------------------------------------------ Ereignisse */
  const bildschirmPunkt = (x, y, z) => {
    v.set(x, y, z).project(s3.kamera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * leinwand.clientWidth, (-v.y * 0.5 + 0.5) * leinwand.clientHeight];
  };
  function ereignisseZeigen(liste) {
    const missionen = liste.filter((e) => e.typ === 'mission');
    for (const e of missionen) {
      if (!e.belohnung || !e.belohnung.includes('Baukatalog')) continue;
      // Ein geschenkter Bau soll nicht übersehen werden: eine Tafel, die bleibt, bis man tippt
      ui.modal({
        klasse: 'gold', ober: 'Geschenk', titel: e.belohnung.split(' geschenkt')[0],
        absaetze: [`Für „${e.text}“. Er liegt im Baukatalog bereit und kostet nichts.`],
        knoepfe: [{ text: 'Zum Baukatalog', klasse: 'primaer', aktion: () => bauenAuf() }, { text: 'Später' }],
      });
    }
    if (missionen.length) {
      klang.fund(2);
      const summe = missionen.filter((e) => !e.belohnung).reduce((n, e) => n + (e.geld || 0), 0);
      const letzte = missionen[missionen.length - 1];
      const teile = [summe > 0 ? `+${geld(summe)}` : '', ...missionen.filter((e) => e.belohnung).map((e) => e.belohnung)].filter(Boolean);
      ui.toast(missionen.length === 1 ? `Geschafft: ${letzte.text}${teile.length ? ` · ${teile.join(' · ')}` : ''}`
        : `${missionen.length} Schritte geschafft${teile.length ? ` · ${teile.join(' · ')}` : ''}`, 'gut');
    }
    for (const e of liste) {
      if (e.typ === 'stich') {
        ansicht.stich(e);
        if (e.menge > 0) {
          const p = bildschirmPunkt(e.x, e.y + 0.2, e.z);
          if (p) ui.schwebeText(e.krit ? `Glücksstich! +${e.menge}` : `+${e.menge}`, p[0], p[1], 'klein');
        }
      } else if (e.typ === 'verkauft') {
        if (e.wo === 'stand' && !e.art) {
          klang.kasse();
          const t = hof.standTrichter;
          const p = bildschirmPunkt(t.x, t.y + 1.2, t.z) || [leinwand.clientWidth / 2, leinwand.clientHeight / 2];
          ui.schwebeText(`+${geld(e.betrag)}`, p[0], p[1]);
        } else {
          // Maschinen, Bänder, Drohnen: gesammelt anzeigen, damit es nicht flackert
          zustand.verkaufSumme += e.betrag;
          zustand.verkaufOrt = [e.x ?? hof.standTrichter.x, (e.y ?? hof.standTrichter.y) + 0.9, e.z ?? hof.standTrichter.z];
        }
      } else if (e.typ === 'gebaut') {
        ansicht.schwung();
      } else if (e.typ === 'rechen' || e.typ === 'greifen' || e.typ === 'produziert' || e.typ === 'schuss') {
        const sp = s.spieler;
        const bau = e.id != null ? s.bauten.find((b) => b.id === e.id) : null;
        const d = bau ? Math.hypot(bau.x - sp.x, bau.z - sp.z) : 20;
        const laut = Math.max(0, 1 - d / 18);
        if (e.typ === 'rechen') { if (zustand.rechenZeit <= 0) { klang.rechen(laut); zustand.rechenZeit = 0.2; } }
        else if (e.typ === 'greifen') klang.greifen(laut);
        else if (e.typ === 'schuss') klang.werfen();
        else klang.plopp(laut * 0.8);
      } else if (e.typ === 'scannerNadel') {
        klang.scanner();
        ui.toast('Der Scanner hat eine Nadel gefunden! Sie wartet dort auf dich.', 'gut');
      } else if (e.typ === 'radar') {
        klang.fund(0);
        ui.toast('Das Radar hat eine Nadel markiert: der goldene Lichtstrahl.', 'gut');
      } else if (e.typ === 'lasterKommt') {
        klang.hupe();
        ui.toast('Der Laster kommt ans Tor.', '');
      } else if (e.typ === 'lasterDa') {
        ui.toast(`Auftrag: ${e.auftrag.titel} will ${e.auftrag.will === 'roh' ? `${halme(e.auftrag.menge)} Halme loses Heu` : `${e.auftrag.menge} × ${PRODUKTE[e.auftrag.will].name}`}.`, '');
      } else if (e.typ === 'auftrag') {
        klang.auftrag();
        ui.toast(`Auftrag erfüllt: ${e.auftrag.titel} · +${geld(e.lohn)}`, 'gut');
      } else if (e.typ === 'stromKnapp') {
        klang.summen();
        ui.toast('Zu wenig Strom: die Maschinen laufen langsamer. Ein Generator hilft.', 'warn');
      } else if (e.typ === 'gefegt' || e.typ === 'gegriffen') {
        const p = bildschirmPunkt(e.x, 0.3, e.z);
        if (p) ui.schwebeText(`+${e.menge}`, p[0], p[1], 'klein');
      } else if (e.typ === 'nadelFrei') {
        klang.fund(1);
        ui.toast('Da glitzert etwas im Heu!', 'gut');
      } else if (e.typ === 'nadel') {
        klang.nadel();
        beben([40, 60, 40]);
        // kurz warten, damit man das Glitzern noch sieht
        setTimeout(() => nadelModal(ui, e, s), 650);
      } else if (e.typ === 'nadelZurueck') {
        klang.fehler();
        ui.toast('Eine Nadel wurde mitverkauft und ist zurück in den Haufen gefallen.', 'warn');
      } else if (e.typ === 'ueberhitzt') {
        klang.heiss();
        ui.toast('Der Sauger ist zu heiß und muss abkühlen.', 'warn');
      }
    }
  }

  /* ------------------------------------------------ Missionsziel */
  // Für die ersten Schritte: eine goldene Marke über dem Ziel, am Bildrand ein Pfeil dorthin.
  const zielMarke = h('div', {
    'aria-hidden': 'true',
    style: {
      position: 'absolute', left: '0', top: '0', width: '28px', height: '28px', marginLeft: '-14px', marginTop: '-14px',
      pointerEvents: 'none', zIndex: '6', display: 'none', color: '#ffdb57', filter: 'drop-shadow(0 1px 2px #000)',
      transition: 'opacity 0.2s',
    },
    html: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2 20 12 12 22 4 12Z" opacity=".9"/></svg>',
  });
  app.append(zielMarke);
  function missionsZiel() {
    const ms = missionStand(s);
    if (!ms || s.mission > 16) return null;
    const m = ms.m;
    const sp = s.spieler;
    const amHaufen = () => {
      const dx = sp.x - WELT.haufenX; const dz = sp.z - WELT.haufenZ; const d = Math.hypot(dx, dz) || 1;
      const r = s.hf.radius * 0.8;
      return [WELT.haufenX + (dx / d) * r, 1.2, WELT.haufenZ + (dz / d) * r];
    };
    switch (m.art) {
      case 'gelaufen': case 'tipps': case 'gefegt': case 'nadeln': return amHaufen();
      case 'werkzeug': return m.ziel === 'detektor' ? amHaufen() : null;
      case 'verkauft': return [hof.standTrichter.x, 1.6, hof.standTrichter.z];
      case 'tech': return ['eimer', 'spaten', 'besen'].includes(m.ziel) ? [WELT.werkzeugX, 2.2, WELT.werkzeugZ] : null;
      case 'strom': return [WELT.anschlussX + 0.3, 2.0, WELT.anschlussZ];
      case 'auftraege': return [WELT.torX, 2.4, WELT.zMin + 0.5];
      case 'ladungen': return [WELT.lieferX, 1.8, WELT.lieferZ];
      default: return null;
    }
  }
  function zielMarkeZeigen() {
    const p = zustand.laeuft && !blockiert() && !bm.aktiv() ? missionsZiel() : null;
    const sp = s.spieler;
    if (!p || Math.hypot(p[0] - sp.x, p[2] - sp.z) < 3.5) { zielMarke.style.display = 'none'; return; }
    v.set(p[0], p[1], p[2]).project(s3.kamera);
    const b = leinwand.clientWidth; const hh = leinwand.clientHeight;
    const vorn = v.z < 1;
    let x = (v.x * 0.5 + 0.5) * b;
    let y = (-v.y * 0.5 + 0.5) * hh;
    const rand = 36;
    const drin = vorn && x > rand && x < b - rand && y > rand && y < hh - rand;
    if (!drin) {
      // Richtung zum Ziel vom Bildmittelpunkt aus, hinter der Kamera gespiegelt
      let dx = x - b / 2; let dy = y - hh / 2;
      if (!vorn) { dx = -dx; dy = -dy; }
      const l = Math.hypot(dx, dy) || 1;
      const k = Math.min((b / 2 - rand) / Math.abs(dx / l || 1e-6), (hh / 2 - rand) / Math.abs(dy / l || 1e-6));
      x = b / 2 + (dx / l) * k;
      y = hh / 2 + (dy / l) * k;
      zielMarke.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      if (zielMarke.dataset.form !== 'pfeil') {
        zielMarke.dataset.form = 'pfeil';
        zielMarke.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 3 20 19 12 15 4 19Z"/></svg>';
      }
    } else {
      zielMarke.style.transform = `translateY(${Math.sin(performance.now() / 260) * 4}px)`;
      if (zielMarke.dataset.form !== 'raute') {
        zielMarke.dataset.form = 'raute';
        zielMarke.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2 20 12 12 22 4 12Z" opacity=".9"/></svg>';
      }
    }
    zielMarke.style.display = 'block';
    zielMarke.style.left = `${x}px`;
    zielMarke.style.top = `${y}px`;
  }

  /* ------------------------------------------------ Dynamische Auflösung */
  // Ruckelt es, sinkt die Pixeldichte in Stufen; läuft es flüssig, steigt sie
  // wieder bis zur gewählten Grafikstufe. (Nicht in automatisierten Tests.)
  const aufloesung = { ema: 1 / 60, zeit: 0, pixel: s3.qualitaet.pixel, aus: !!navigator.webdriver };
  function aufloesungAnpassen(echt) {
    if (aufloesung.aus || !zustand.laeuft || echt > 0.5) return;
    aufloesung.ema = aufloesung.ema * 0.95 + echt * 0.05;
    aufloesung.zeit += echt;
    if (aufloesung.zeit < 2.5) return;
    aufloesung.zeit = 0;
    if (aufloesung.ema > 1 / 30 && aufloesung.pixel > 0.6) aufloesung.pixel = Math.max(0.6, aufloesung.pixel - 0.15);
    else if (aufloesung.ema < 1 / 55 && aufloesung.pixel < s3.qualitaet.pixel) aufloesung.pixel = Math.min(s3.qualitaet.pixel, aufloesung.pixel + 0.1);
    else return;
    s3.pixelSetzen(aufloesung.pixel);
  }

  /* ------------------------------------------------ Schleife */
  const umgebung = { kollider: hof.kollider, flaechen: [], haufen: s.hf };
  const bodenBei = (x, z) => haufenHoehe(s.hf, x, z);
  let letzte = performance.now();
  let startWinkel = 0;
  let saugerLaeuft = false;

  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    try {
      const echt = Math.max(0, (jetzt - letzte) / 1000);
      const dt = Math.min(0.05, echt);
      letzte = jetzt;
      aufloesungAnpassen(echt);
      const e = st.lesen();
      const w = werte(s);
      umgebung.haufen = s.hf;
      hofPruefen();
      if (zustand.umgebungStand !== s || zustand.umgebungVersion !== bauVersion(s)) {
        const u = bautenUmgebung(s);
        umgebung.kollider = hof.kollider.concat(u.kollider);
        umgebung.flaechen = u.flaechen;
        umgebung.flaechenGitter = u.gitter;
        umgebung.kolliderGitter = new Map();
        for (const k of umgebung.kollider) gitterEintragen(umgebung.kolliderGitter, k.x0, k.z0, k.x1, k.z1, k);
        umgebung.grenzen = hallenGrenzen(w.hallenFelder);
        zustand.umgebungVersion = bauVersion(s);
        zustand.umgebungStand = s;
      }
      let tempo = 0;
      let ziel = null;
      if (!zustand.laeuft) {
        // Startbild: langsamer Flug um den Haufen, wie das Menü im Vorbild
        startWinkel += dt * 0.08;
        const r = 19;
        s3.kamera.position.set(WELT.haufenX + Math.cos(startWinkel) * r, 7.5, WELT.haufenZ + Math.sin(startWinkel) * r * 0.7);
        s3.kamera.lookAt(WELT.haufenX, 2.5, WELT.haufenZ);
      } else if (!blockiert()) {
        const rennt = e.rennen && s.spieler.puste > 0.5 && !(s.spieler.duck > 0.5);
        const eingabe = { ...e, rennen: rennt };
        const vorX = s.spieler.x; const vorZ = s.spieler.z;
        tempo = spielerBewegen(s.spieler, eingabe, dt, umgebung, gehFaktor(w));
        // Schritte hören: alle 0,55 m (rennend 0,75 m), im Heu raschelnd
        if (s.spieler.amBoden && tempo > 0.5) {
          zustand.schrittWeg = (zustand.schrittWeg || 0) + tempo * dt;
          if (zustand.schrittWeg > (rennt ? 0.75 : 0.55)) {
            zustand.schrittWeg = 0;
            klang.schritt(haufenHoehe(s.hf, s.spieler.x, s.spieler.z) > 0.1);
          }
        }
        s.stat.gelaufen += Math.hypot(s.spieler.x - vorX, s.spieler.z - vorZ);
        s.stat.umgesehen += Math.abs(e.blickX) + Math.abs(e.blickY);
        pusteSchritt(s, dt, rennt && tempo > 0.5);
        spielerKamera(s.spieler, s3.kamera, tempo);
        if (bm.aktiv()) {
          bm.schritt(s3.kamera.position, blickRichtung(s.spieler), dt);
          if (e.aktionNeu) bm.setzen();
        } else {
          ziel = zielFinden();
          aktionAusfuehren(ziel, e, dt);
        }
        zustand.ziel = ziel;
        // Sauger
        const saugZiel = ziel && ziel.art === 'haufen' ? ziel : null;
        const saugBoden = ziel && (ziel.art === 'boden' || ziel.art === 'haufen') ? ziel : null;
        saugerSchritt(s, s.hf, dt, e.aktion && s.spieler.werkzeug === 'sauger', saugZiel, saugBoden, spielZufall(s), ereignisPuffer);
      } else {
        spielerKamera(s.spieler, s3.kamera, 0);
        saugerSchritt(s, s.hf, dt, false, null, null, spielZufall(s), ereignisPuffer);
      }
      const saugt = s.spieler.sauger.an;
      if (saugt && !saugerLaeuft) { saugerAn(); saugerLaeuft = true; }
      if (!saugt && saugerLaeuft) { saugerAus(); saugerLaeuft = false; }
      if (saugt) saugerHitze(s.spieler.sauger.hitze);

      // Detektor
      let detektorStaerke = 0;
      if (zustand.laeuft && s.spieler.werkzeug === 'detektor') {
        const k = s3.kamera.position;
        const [dx, dy, dz] = blickRichtung(s.spieler);
        const p = ziel && ziel.art === 'haufen' ? ziel : { x: k.x + dx * 1.3, y: k.y + dy * 1.3, z: k.z + dz * 1.3 };
        const d = detektorMessen(s, p.x, p.y, p.z);
        detektorStaerke = d.staerke;
        if (d.staerke > 0 && jetzt >= zustand.piepNaechster) {
          klang.piep(d.staerke);
          zustand.piepNaechster = jetzt + (1300 - d.staerke * 1180);
        } else if (d.staerke <= 0) zustand.piepNaechster = jetzt;
        const text = d.abstand == null ? 'nichts' : w.frei.has('piepser')
          ? `${d.abstand.toFixed(1).replace('.', ',')} m` : ({ still: 'still', kalt: 'kalt', warm: 'warm', heiss: 'heiß!' })[d.stufe];
        ui.detektorZeigen(true, d.staerke, text);
        if (ziel && ziel.art === 'haufen') s.stat.werkzeug.detektor = (s.stat.werkzeug.detektor || 0) + 1;
      } else ui.detektorZeigen(false);

      // Welt
      // Abwesenheit nachholen: höchstens 10 ms je Bild, danach der Willkommensgruß
      if (zustand.aufholen && zustand.laeuft) {
        const job = abwesenheitWeiter(s, zustand.aufholen, 400, performance.now() + 10);
        if (job.fertig) {
          zustand.aufholen = null;
          const r = job.ergebnis;
          ereignisPuffer.push(...r.ereignisse);
          if (!r.kurz && r.verdient > 0) {
            ui.modal({
              ober: `${dauer(r.abwesend)} weg`, titel: 'Willkommen zurück',
              absaetze: [`Die Maschinen haben ${halme(r.halme)} Halme abgetragen und ${geld(r.verdient)} eingenommen.`],
              knoepfe: [{ text: 'Weiter', klasse: 'primaer' }],
            });
          }
        }
      }
      // Zeitraffer nur für Tests (window.__heuhaufen3d.zustand.zeitraffer = 10)
      const raffer = zustand.laeuft ? Math.max(1, Math.min(40, Math.floor(zustand.zeitraffer || 1))) : 1;
      for (let i = 0; i < raffer; i++) ereignisPuffer.push(...spielTakt(s, zustand.laeuft ? dt : 0, [automatikSchritt]));
      if (ereignisPuffer.length) { ereignisseZeigen(ereignisPuffer.splice(0)); }
      zustand.rechenZeit -= dt;
      zustand.verkaufZeit -= dt;
      if (zustand.verkaufSumme > 0 && zustand.verkaufZeit <= 0) {
        const o = zustand.verkaufOrt || [hof.standTrichter.x, hof.standTrichter.y + 1.2, hof.standTrichter.z];
        const p = bildschirmPunkt(o[0], o[1], o[2]);
        if (p) ui.schwebeText(`+${geld(zustand.verkaufSumme)}`, p[0], p[1]);
        const sp = s.spieler;
        if (Math.hypot(o[0] - sp.x, o[2] - sp.z) < 14) klang.kasse();
        zustand.verkaufSumme = 0;
        zustand.verkaufZeit = 0.6;
      }
      objekte.schritt(s, netzHolen(s), dt, s.zeit, s3.kamera);

      hAnsicht.schritt(s.hf);
      ansicht.schritt(s, dt, {
        tempo, detektor: detektorStaerke, behaelter: behaelter(s), platz: taschePlatz(w), boden: bodenBei,
        haelt: gehaltenesStueck(s), bauen: bm.aktiv() || !zustand.laeuft,
      });
      s3.schritt(dt);
      const m = Math.floor(s.zeit / 60);
      // Das Rolltor geht hoch, wenn der Laster ans Tor setzt
      const L = s.laster;
      const torZiel = L.zustand === 'steht' || (L.zustand === 'kommt' && L.t > 4) || (L.zustand === 'faehrt' && L.t < 1.2) ? 1 : 0;
      zustand.torOffen = (zustand.torOffen || 0) + (torZiel - (zustand.torOffen || 0)) * Math.min(1, dt * 1.6);
      const torRest = Math.max(0.07, 1 - zustand.torOffen);
      hof.tor.scale.y = torRest;
      hof.tor.position.y = WELT.torHoehe - (WELT.torHoehe * torRest) / 2;
      hof.uhr.setze(m >= 100 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m}:${String(Math.floor(s.zeit % 60)).padStart(2, '0')}`);

      // Anzeigen
      zustand.hudZeit += dt;
      if (zustand.hudZeit > 0.1) {
        zustand.hudZeit = 0;
        ui.kasseZeigen({ geldBetrag: s.geld, schulden: s.schulden, rest: s.haufenRest, rate: proMinute(s) });
        ui.missionZeigen(missionStand(s), s.mission);
        ui.leisteSetzen(werkzeugeInLeiste(s), s.spieler.werkzeug, [
          { id: 'bauen', taste: 'B', kurz: 'BAUEN', name: 'Baukatalog', aktion: bauenAuf },
          { id: 'ablegen', taste: 'Q', kurz: 'ABLEGEN', name: 'Ablegen', aktion: ablegen },
        ]);
        const platz = taschePlatz(w);
        ui.behaelterZeigen(behaelter(s), s.spieler.last, platz);
        ui.pusteZeigen(s.spieler.puste / w.ausdauer, s.spieler.puste < w.ausdauerKosten);
        ui.hitzeZeigen(s.spieler.werkzeug === 'sauger' || s.spieler.sauger.hitze > 0, s.spieler.sauger.hitze, s.spieler.sauger.heiss);
        ui.forschungMarke(TECH.filter((t) => techStatus(s, t.id) === 'kaufbar').length);
        // Brummen: je näher und je mehr Maschinen laufen, desto lauter
        let naechste = Infinity;
        let laufen = 0;
        for (const b of netzHolen(s).maschinenAlle) {
          const st = lauf(b).status;
          if (st !== 'laeuft' && st !== 'prueft') continue;
          const d = Math.hypot(b.x - s.spieler.x, b.z - s.spieler.z);
          if (d < 14) laufen++;
          if (d < naechste) naechste = d;
        }
        brummen(zustand.laeuft ? Math.max(0, 1 - naechste / 14) * Math.min(1, 0.45 + laufen * 0.15) : 0);
        wind(zustand.laeuft && !blockiert());
        // Knistern am brennenden Generator
        let gen = Infinity;
        for (const b of netzHolen(s).maschinenAlle) if (b.typ === 'generator' && lauf(b).brennt) gen = Math.min(gen, Math.hypot(b.x - s.spieler.x, b.z - s.spieler.z));
        if (gen < 10 && Math.random() < 0.6) klang.knistern(1 - gen / 10);
        if (zustand.tafel && zustand.tafel.aktualisieren) zustand.tafel.aktualisieren();
      }
      zielMarkeZeigen();
      if (zustand.laeuft && bm.aktiv()) {
        ui.aktionZeigen(({ bau: 'Bauen', band: 'Setzen', linie: 'Setzen', abbau: 'Abbauen' })[bm.art()] || 'Bauen', bm.ok());
        ui.hinweisZeigen('');
        ui.infoZeigen(false);
      } else if (zustand.laeuft) {
        const [knopfText, hinweisText] = aktionsText(ziel);
        ui.aktionZeigen(knopfText, !!ziel || !!gehaltenesStueck(s));
        ui.hinweisZeigen(hinweisText);
        ui.infoZeigen(!!ziel && (ziel.art === 'bau' && ziel.bau.typ !== 'mast'));
      }
      s3.zeichnen();
      st.verbraucht();
      if (zustand.laeuft && jetzt - zustand.zuletztGespeichert > 5000) speichernJetzt();
    } catch (fehler) {
      if (!zustand.fehlerGemeldet) { zustand.fehlerGemeldet = true; console.error(fehler); }
    }
  }

  /* ------------------------------------------------ Startbild */
  const startbild = h('div', { class: 'startbild' },
    h('h1', {}, 'Heuhaufen', h('span', {}, '3D')),
    h('div', { class: 'knoepfe' },
      gespeichert ? h('button', { class: 'knopf primaer', onclick: () => losgehen(false) }, 'Weiterspielen') : null,
      h('button', { class: `knopf${gespeichert ? '' : ' primaer'}`, onclick: () => (gespeichert ? neuFragen() : losgehen(true)) }, 'Neues Spiel'),
      h('button', { class: 'knopf', onclick: () => anleitungZeigen(ui) }, 'Anleitung')),
    h('small', {}, 'Sechs Millionen Halme, sechs Nadeln. Am besten quer halten.'));
  app.append(startbild);
  app.classList.add('vorstart');
  function neuFragen() {
    ui.modal({
      titel: 'Neues Spiel?', absaetze: ['Der gespeicherte Stand wird überschrieben.'],
      knoepfe: [{ text: 'Abbrechen' }, { text: 'Neu anfangen', klasse: 'gefahr', aktion: () => losgehen(true) }],
    });
  }
  function losgehen(neu) {
    klangWecken();
    if (neu) {
      s = standNeu();
      hAnsicht.neu(s.hf);
      window.__heuhaufen3d.s = s;
    }
    startbild.remove();
    app.classList.remove('vorstart');
    zustand.laeuft = true;
    if (!neu) {
      // Was die Maschinen in der Zwischenzeit geschafft haben: in Häppchen nachrechnen
      zustand.aufholen = abwesenheitBeginnen(s, Date.now(), [automatikSchritt]);
      if (zustand.aufholen && zustand.aufholen.sek >= 30) ui.toast('Die Maschinen holen nach, was in deiner Abwesenheit passiert ist …');
    }
    s.zuletzt = Date.now();
    spielerKamera(s.spieler, s3.kamera, 0);
    if (neu && !ui.modalOffen()) anleitungZeigen(ui);
    speichernJetzt();
  }

  window.addEventListener('resize', () => s3.groesseAnpassen());
  // Beim Wegschalten speichern; beim Zurückkommen (App-Wechsel ohne Neuladen) die Pause nachholen
  function zurueck() {
    if (!zustand.laeuft || zustand.aufholen) return;
    zustand.aufholen = abwesenheitBeginnen(s, Date.now(), [automatikSchritt]);
    if (zustand.aufholen && zustand.aufholen.sek >= 30) ui.toast('Die Maschinen holen nach, was in deiner Abwesenheit passiert ist …');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (zustand.laeuft) speichernJetzt(); } else zurueck();
  });
  window.addEventListener('pageshow', (ev) => { if (ev.persisted) zurueck(); });
  // Beim Schließen nur speichern, wenn der letzte Stand älter als eine Sekunde ist
  window.addEventListener('pagehide', () => { if (zustand.laeuft && performance.now() - zustand.zuletztGespeichert > 1000) speichernJetzt(); });
  requestAnimationFrame(schleife);
  window.__heuhaufen3d = {
    get s() { return s; }, set s(x) { s = x; }, s3, ui, zustand, losgehen, speichernJetzt, objekte, bm, netz: () => netzHolen(s),
    // Für Tests und Prüfer: Bauen ohne Zielen
    logik: {
      bauSetzen: (typ, x, z, rot = 0) => bauSetzen(s, typ, x, z, rot),
      band: (von, nach) => {
        const plan = bandPlanen(s, bandAnker(s, von[0], von[1], false), bandAnker(s, nach[0], nach[1], true));
        return plan.ok ? bandSetzen(s, plan) : plan;
      },
    },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hauptStart);
else hauptStart();
