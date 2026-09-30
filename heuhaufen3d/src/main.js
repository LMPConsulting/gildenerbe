// Start und Spielschleife: baut Szene, Halle, Haufen und Oberfläche, liest die
// Eingabe, bewegt den Spieler, findet heraus, worauf er zielt, führt die
// Werkzeugaktion aus, treibt die Welt an und zeigt alles an.

import * as THREE from '../vendor/three.module.min.js';
import { WELT, SPIELER } from './daten.js';
import { haufenStrahl, haufenHoehe } from './haufen.js';
import {
  werte, techStatus, proMinute, gehFaktor, taschePlatz, TECH_NACH_ID, techStufe, missionStand,
} from './wirtschaft.js';
import { TECH } from './daten.js';
import {
  standNeu, spielTakt, speichern, laden, ladungBestellen, SPEICHER3D_KEY, spielZufall,
} from './spiel.js';
import {
  stechen, kannStechen, fegen, saugerSchritt, bueschelGreifen, standKippen, pusteSchritt, werkzeugWaehlen,
  werkzeugeInLeiste, behaelter,
} from './werkzeuge.js';
import { detektorMessen, nadelFinden } from './nadeln.js';
import { loseNaechster } from './lose.js';
import { klang, klangWecken, klangStumm, saugerAn, saugerAus, saugerHitze } from './klang.js';
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
import { geld, halme } from './format.js';

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
  const hof = hofBauen(s3.szene, s3.qualitaet);

  let s = null;
  try { s = laden(localStorage.getItem(SPEICHER3D_KEY) || ''); } catch { s = null; }
  const gespeichert = !!s;
  if (!s) s = standNeu();
  const hAnsicht = haufenAnsichtBauen(s3.szene, s.hf, s3.qualitaet);
  const ansicht = ansichtBauen(s3.szene, s3.kamera);

  const zustand = {
    laeuft: false, // nach dem Startbild
    tafel: null, // offene Vollbild-Tafel (Forschung, Bauen)
    stichPause: 0,
    piepNaechster: 0,
    zuletztGespeichert: performance.now(),
    hudZeit: 0,
    zielText: '',
    nadelWarte: [],
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
      else if (k === 'escape') { if (zustand.tafel) zustand.tafel.schliessen(); }
    },
  });
  st.zustand.empfindlichkeit = einst.empfindlichkeit;

  const ui = oberflaecheBauen(app, {
    werkzeug: (id) => werkzeugKlick(id),
    aktion: (an) => { klangWecken(); st.aktionDruecken(an); },
    sprung: () => st.springenDruecken(),
    bauen: () => bauenAuf(),
    forschung: () => forschungAuf(),
    nadeln: () => nadelnAuf(),
    menue: () => menueAuf(),
    modalAuf: () => { st.zeigerFreigeben(); },
    modalZu: () => {},
  });

  function speichernJetzt() {
    try { localStorage.setItem(SPEICHER3D_KEY, speichern(s)); } catch { /* voll oder gesperrt */ }
    zustand.zuletztGespeichert = performance.now();
  }
  function einstellungenSichern() {
    try { localStorage.setItem(EINSTELLUNGEN_KEY, JSON.stringify(einst)); } catch { /* egal */ }
  }

  function werkzeugKlick(id) {
    klangWecken();
    if (werkzeugWaehlen(s, id)) klang.klick();
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
        const t = TECH_NACH_ID[id];
        if (t.effekt.some((e) => e[0] === 'frei') && techStufe(s, id) === 1) ui.toast(`${t.name} freigeschaltet.`, 'gut');
      },
      fehler: () => klang.fehler(),
      zu: () => { zustand.tafel = null; },
    });
    zustand.tafel = f;
  }
  function bauenAuf() {
    ui.toast('Der Baukatalog kommt mit den Förderband-Plänen.', '');
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
      herunterladen: () => ui.toast('Kommt noch: die Datei mit Spielstand.', ''),
      loeschen: () => ui.modal({
        titel: 'Spielstand löschen?', absaetze: ['Alles ist weg: Geld, Forschung, Nadeln, Bauten. Das lässt sich nicht rückgängig machen.'],
        knoepfe: [{ text: 'Abbrechen', klasse: 'primaer' }, {
          text: 'Löschen', klasse: 'gefahr', aktion: () => {
            try { localStorage.removeItem(SPEICHER3D_KEY); } catch { /* egal */ }
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
  const stationen = [
    [hof.stand, 'stand'], [hof.werkzeugstand, 'werkzeugstand'], [hof.lieferschalter, 'lieferschalter'],
    [hof.auftragstafel, 'auftragstafel'], [hof.hausanschluss, 'hausanschluss'], [hof.werkbank, 'werkbank'],
  ];
  const stationenObjekte = stationen.map(([o]) => o);
  const v = new THREE.Vector3();

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
    strahl.set(k, v.set(dx, dy, dz));
    strahl.far = reichweite + 0.6;
    const treffer = strahl.intersectObjects(stationenObjekte, true);
    if (treffer.length && (!haufenTreffer || treffer[0].distance < haufenTreffer.t)) {
      let o = treffer[0].object;
      while (o && !stationen.some(([x]) => x === o)) o = o.parent;
      const eintrag = stationen.find(([x]) => x === o);
      if (eintrag) return { art: eintrag[1], abstand: treffer[0].distance };
    }
    if (haufenTreffer && haufenTreffer.t <= reichweite) return { art: 'haufen', ...haufenTreffer };
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
    // Stationen: nur beim Drücken
    if (ziel && ['stand', 'werkzeugstand', 'lieferschalter', 'auftragstafel', 'hausanschluss', 'werkbank', 'nadel'].includes(ziel.art)) {
      if (!druck) return;
      if (ziel.art === 'stand') {
        if (sp.last <= 0) { ui.toast('Nichts dabei. Erst Heu vom Haufen holen.'); klang.fehler(); return; }
        standKippen(s, ereignisPuffer);
      } else if (ziel.art === 'werkzeugstand') {
        werkzeugstandZeigen(ui, s, {
          gekauft: (id) => { klang.kauf(); if (id === 'spaten' && sp.werkzeug === 'hand') werkzeugWaehlen(s, 'spaten'); if (id === 'heugabel') werkzeugWaehlen(s, 'heugabel'); },
          fehler: () => klang.fehler(),
        });
      } else if (ziel.art === 'lieferschalter') {
        lieferschalterZeigen(ui, s, {
          bestellen: (aufRechnung) => {
            const r = ladungBestellen(s, { aufRechnung });
            if (r.ok) { hAnsicht.neu(s.hf); ui.toast(`Ladung ${s.ladung} ist da: ${halme(s.haufenStart)} Halme.`, 'gut'); klang.kauf(); speichernJetzt(); }
            else { ui.toast('Das reicht nicht.', 'warn'); klang.fehler(); }
          },
        });
      } else if (ziel.art === 'auftragstafel') {
        ui.modal({ titel: 'Aufträge', absaetze: ['Mit dem Auftragsbuch aus der Forschung (Verkauf) hängen hier Aufträge. Ein Laster setzt dann ans Tor.'], knoepfe: [{ text: 'OK', klasse: 'primaer' }] });
      } else if (ziel.art === 'hausanschluss') {
        ui.modal({ titel: 'Hausanschluss', absaetze: ['Hier kommen 5 kW aus dem Netz. Maschinen in der Nähe hängen direkt dran, weiter weg helfen Strommasten.'], knoepfe: [{ text: 'OK', klasse: 'primaer' }] });
      } else if (ziel.art === 'werkbank') {
        ui.toast('Die Werkbank. Kinderschaufel und Detektor sind schon in deiner Leiste.');
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
        else if (r.menge > 0) klang.stich(r.krit);
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
    if (!ziel) return wz === 'detektor' ? ['Messen', ''] : wz === 'sauger' ? ['Saugen', ''] : ['Aktion', ''];
    switch (ziel.art) {
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
        klang.kasse();
        const t = hof.standTrichter;
        const p = bildschirmPunkt(t.x, t.y + 1.2, t.z) || [leinwand.clientWidth / 2, leinwand.clientHeight / 2];
        ui.schwebeText(`+${geld(e.betrag)}`, p[0], p[1]);
      } else if (e.typ === 'gefegt' || e.typ === 'gegriffen') {
        const p = bildschirmPunkt(e.x, 0.3, e.z);
        if (p) ui.schwebeText(`+${e.menge}`, p[0], p[1], 'klein');
      } else if (e.typ === 'nadelFrei') {
        klang.fund(1);
        ui.toast('Da glitzert etwas im Heu!', 'gut');
      } else if (e.typ === 'nadel') {
        klang.nadel();
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

  /* ------------------------------------------------ Schleife */
  const umgebung = { kollider: hof.kollider, flaechen: [], haufen: s.hf };
  const bodenBei = (x, z) => haufenHoehe(s.hf, x, z);
  let letzte = performance.now();
  let startWinkel = 0;
  let saugerLaeuft = false;

  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    try {
      const dt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
      letzte = jetzt;
      const e = st.lesen();
      const w = werte(s);
      umgebung.haufen = s.hf;
      let tempo = 0;
      let ziel = null;
      if (!zustand.laeuft) {
        // Startbild: langsamer Flug um den Haufen, wie das Menü im Vorbild
        startWinkel += dt * 0.08;
        const r = 19;
        s3.kamera.position.set(WELT.haufenX + Math.cos(startWinkel) * r, 7.5, WELT.haufenZ + Math.sin(startWinkel) * r * 0.7);
        s3.kamera.lookAt(WELT.haufenX, 2.5, WELT.haufenZ);
      } else if (!blockiert()) {
        const rennt = e.rennen && s.spieler.puste > 0.5;
        const eingabe = { ...e, rennen: rennt };
        const vorX = s.spieler.x; const vorZ = s.spieler.z;
        tempo = spielerBewegen(s.spieler, eingabe, dt, umgebung, gehFaktor(w));
        s.stat.gelaufen += Math.hypot(s.spieler.x - vorX, s.spieler.z - vorZ);
        s.stat.umgesehen += Math.abs(e.blickX) + Math.abs(e.blickY);
        pusteSchritt(s, dt, rennt && tempo > 0.5);
        spielerKamera(s.spieler, s3.kamera, tempo);
        ziel = zielFinden();
        aktionAusfuehren(ziel, e, dt);
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
      const erg = spielTakt(s, zustand.laeuft ? dt : 0);
      ereignisPuffer.push(...erg);
      if (ereignisPuffer.length) { ereignisseZeigen(ereignisPuffer.splice(0)); }

      hAnsicht.schritt(s.hf);
      ansicht.schritt(s, dt, {
        tempo, detektor: detektorStaerke, behaelter: behaelter(s), platz: taschePlatz(w), boden: bodenBei,
      });
      s3.schritt(dt);
      const m = Math.floor(s.zeit / 60);
      hof.uhr.setze(m >= 100 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m}:${String(Math.floor(s.zeit % 60)).padStart(2, '0')}`);

      // Anzeigen
      zustand.hudZeit += dt;
      if (zustand.hudZeit > 0.1) {
        zustand.hudZeit = 0;
        ui.kasseZeigen({ geldBetrag: s.geld, schulden: s.schulden, rest: s.haufenRest, rate: proMinute(s) });
        ui.missionZeigen(missionStand(s), s.mission);
        ui.leisteSetzen(werkzeugeInLeiste(s), s.spieler.werkzeug, [
          { id: 'bauen', taste: 'B', kurz: 'BAUEN', name: 'Baukatalog', aktion: bauenAuf },
        ]);
        const platz = taschePlatz(w);
        ui.behaelterZeigen(behaelter(s), s.spieler.last, platz);
        ui.pusteZeigen(s.spieler.puste / w.ausdauer, s.spieler.puste < w.ausdauerKosten);
        ui.hitzeZeigen(s.spieler.werkzeug === 'sauger' || s.spieler.sauger.hitze > 0, s.spieler.sauger.hitze, s.spieler.sauger.heiss);
        ui.forschungMarke(TECH.filter((t) => techStatus(s, t.id) === 'kaufbar').length);
        if (zustand.tafel && zustand.tafel.aktualisieren) zustand.tafel.aktualisieren();
      }
      if (zustand.laeuft) {
        const [knopfText, hinweisText] = aktionsText(ziel);
        ui.aktionZeigen(knopfText, !!ziel);
        ui.hinweisZeigen(hinweisText);
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
    s.zuletzt = Date.now();
    spielerKamera(s.spieler, s3.kamera, 0);
    if (neu) anleitungZeigen(ui);
    speichernJetzt();
  }

  window.addEventListener('resize', () => s3.groesseAnpassen());
  document.addEventListener('visibilitychange', () => { if (document.hidden && zustand.laeuft) speichernJetzt(); });
  window.addEventListener('pagehide', () => { if (zustand.laeuft) speichernJetzt(); });
  requestAnimationFrame(schleife);
  window.__heuhaufen3d = {
    get s() { return s; }, set s(x) { s = x; }, s3, ui, zustand, losgehen, speichernJetzt,
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hauptStart);
else hauptStart();
