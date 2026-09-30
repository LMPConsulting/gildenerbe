// Die Halle: Boden, Plankenwände mit Stahlpfosten, Wellblechband, Stahlbögen
// über dem offenen Dach, Rolltor mit Digitaluhr, der Verkaufsstand mit Schild
// und Preisaufsteller. Liefert auch die Kollisionskästen für den Spieler.

import * as THREE from '../../vendor/three.module.min.js';
import { WELT } from '../daten.js';
import {
  bodenTextur, plankenTextur, wellblechTextur, rostTextur, schildTextur, ledAnzeige,
} from './texturen.js';
import { sandschaufelModell, spatenModell, heugabelModell, eimerModell } from './modelle.js';

/** Modell aus modelle.js mit eigenen Materialkopien (die Halle gibt ihre Materialien beim Neubau frei). */
function eigenesModell(m, skala = 1) {
  m.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
  m.scale.setScalar(skala);
  return m;
}

const STAHL = 0x3a3836;

function kasten(b, h, t, mat, x, y, z, { schatten = true, empfangen = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), mat);
  m.position.set(x, y, z);
  m.castShadow = schatten;
  m.receiveShadow = empfangen;
  return m;
}

/** Textur so kacheln, dass eine Kachel `meterB` × `meterH` Meter misst. */
function gekachelt(textur, b, h, meterB, meterH) {
  const t = textur.clone();
  t.needsUpdate = true;
  t.repeat.set(b / meterB, h / meterH);
  return t;
}

export function hofBauen(szene, qualitaet, felder = 0) {
  // „Schuppen verlängern“: jedes Feld schiebt die rechte Wand 4 m weiter hinaus.
  const W = { ...WELT, xMax: WELT.xMax + felder * 4 };
  const gruppe = new THREE.Group();
  gruppe.name = 'hof';
  const kollider = [];
  const breite = W.xMax - W.xMin;
  const tiefe = W.zMax - W.zMin;
  const mx = (W.xMin + W.xMax) / 2;
  const mz = (W.zMin + W.zMax) / 2;

  // --- Boden
  const bt = bodenTextur(512, 11);
  bt.repeat.set(breite / 8, tiefe / 8);
  bt.anisotropy = qualitaet.aniso;
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(breite + 1, tiefe + 1),
    new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, metalness: 0 }),
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.set(mx, 0, mz);
  boden.receiveShadow = true;
  boden.name = 'boden';
  gruppe.add(boden);

  // --- Wände
  const planken = plankenTextur(512, 20, 23);
  const sockelPlanken = plankenTextur(256, 10, 29, 6); // Sockel: ruhiger, weniger Maserung
  planken.anisotropy = qualitaet.aniso;
  const blech = wellblechTextur(256, 31);
  const blechHell = wellblechTextur(256, 33, { hell: true });
  const rost = rostTextur(128, 41, '#a88a6c');
  const stahlMat = new THREE.MeshStandardMaterial({ color: STAHL, roughness: 0.6, metalness: 0.5 });
  const rostMat = new THREE.MeshStandardMaterial({ map: rost, color: 0xffffff, roughness: 0.62, metalness: 0.1 });
  const dicke = 0.16;
  const H = W.wandHoehe;
  const B = W.bandHoehe;

  function wandStueck(x0, z0, x1, z1) {
    const laenge = Math.hypot(x1 - x0, z1 - z0);
    if (laenge < 0.01) return;
    const winkel = Math.atan2(z1 - z0, x1 - x0);
    const plMat = new THREE.MeshStandardMaterial({ map: gekachelt(planken, laenge, H, 2.2, H), roughness: 0.9 });
    const blMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.7 });
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const unten = kasten(laenge, H, dicke, plMat, cx, H / 2, cz);
    unten.rotation.y = -winkel;
    const oben = kasten(laenge, B, dicke * 0.6, blMat, cx, H + B / 2, cz);
    oben.rotation.y = -winkel;
    gruppe.add(unten, oben);
    // graues Sockelband unten wie im Vorbild
    const sockelMat = new THREE.MeshStandardMaterial({ map: gekachelt(sockelPlanken, laenge, 1.1, 2.2, H), color: 0xd9d4ca, roughness: 0.95 });
    const sockel = kasten(laenge, 1.1, dicke + 0.04, sockelMat, cx, 0.55, cz);
    sockel.rotation.y = -winkel;
    gruppe.add(sockel);
  }
  function wandKollider(x0, z0, x1, z1) {
    kollider.push({ x0: Math.min(x0, x1) - dicke, x1: Math.max(x0, x1) + dicke, z0: Math.min(z0, z1) - dicke, z1: Math.max(z0, z1) + dicke, h: H + B });
  }
  // links, rechts, vorne
  wandStueck(W.xMin, W.zMin, W.xMin, W.zMax); wandKollider(W.xMin, W.zMin, W.xMin, W.zMax);
  wandStueck(W.xMax, W.zMin, W.xMax, W.zMax); wandKollider(W.xMax, W.zMin, W.xMax, W.zMax);
  wandStueck(W.xMin, W.zMax, W.xMax, W.zMax); wandKollider(W.xMin, W.zMax, W.xMax, W.zMax);
  // hinten mit Tor
  const t0 = W.torX - W.torBreite / 2;
  const t1 = W.torX + W.torBreite / 2;
  wandStueck(W.xMin, W.zMin, t0, W.zMin); wandKollider(W.xMin, W.zMin, t0, W.zMin);
  wandStueck(t1, W.zMin, W.xMax, W.zMin); wandKollider(t1, W.zMin, W.xMax, W.zMin);
  kollider.push({ x0: t0, x1: t1, z0: W.zMin - dicke, z1: W.zMin + dicke, h: H + B }); // Tor ist zu
  // Sturz über dem Tor
  const sturzH = H - W.torHoehe;
  const sturzMat = new THREE.MeshStandardMaterial({ map: gekachelt(planken, W.torBreite, sturzH, 2.2, H), roughness: 0.9 });
  gruppe.add(kasten(W.torBreite, sturzH, dicke, sturzMat, W.torX, W.torHoehe + sturzH / 2, W.zMin));
  const sturzBlech = new THREE.MeshStandardMaterial({ map: gekachelt(blech, W.torBreite, B, 1.6, B), roughness: 0.7, metalness: 0.3 });
  gruppe.add(kasten(W.torBreite, B, dicke * 0.6, sturzBlech, W.torX, H + B / 2, W.zMin));

  // Stahlpfosten innen an den Wänden, Rahmen oben
  const pfostenGeo = new THREE.BoxGeometry(0.2, H + B + 0.25, 0.2);
  const pfosten = [];
  for (let x = W.xMin; x <= W.xMax + 0.01; x += W.pfostenAbstand) {
    pfosten.push([x, W.zMin + 0.12], [x, W.zMax - 0.12]);
  }
  for (let z = W.zMin + W.pfostenAbstand; z < W.zMax - 0.01; z += W.pfostenAbstand) {
    pfosten.push([W.xMin + 0.12, z], [W.xMax - 0.12, z]);
  }
  const pfostenInst = new THREE.InstancedMesh(pfostenGeo, stahlMat, pfosten.length);
  pfosten.forEach(([x, z], i) => {
    pfostenInst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, (H + B + 0.25) / 2, z));
  });
  pfostenInst.castShadow = true;
  pfostenInst.receiveShadow = true;
  gruppe.add(pfostenInst);
  const rahmen = [
    [breite + 0.4, mx, W.zMin, 0], [breite + 0.4, mx, W.zMax, 0],
    [tiefe + 0.4, W.xMin, mz, Math.PI / 2], [tiefe + 0.4, W.xMax, mz, Math.PI / 2],
  ];
  for (const [l, x, z, r] of rahmen) {
    const m = kasten(l, 0.22, 0.26, stahlMat, x, H + B + 0.12, z);
    m.rotation.y = r;
    gruppe.add(m);
    const mitte = kasten(l, 0.12, 0.22, stahlMat, x, H + 0.02, z);
    mitte.rotation.y = r;
    gruppe.add(mitte);
  }

  // --- Stahlbögen über dem offenen Dach (weitere alle 7 m, wenn die Halle wächst)
  const oben = H + B + 0.2;
  const boegen = [...W.boegen];
  while (boegen[boegen.length - 1] + 7 <= W.xMax - 3) boegen.push(boegen[boegen.length - 1] + 7);
  for (const x of boegen) {
    const punkte = [];
    for (let i = 0; i <= 40; i++) {
      const t = Math.PI * (i / 40);
      punkte.push(new THREE.Vector3(x, oben + Math.sin(t) * W.bogenHoehe, mz + Math.cos(t) * (tiefe / 2 + 0.05)));
    }
    const kurve = new THREE.CatmullRomCurve3(punkte);
    const bogen = new THREE.Mesh(new THREE.TubeGeometry(kurve, 60, 0.08, 6, false), rostMat);
    bogen.castShadow = true;
    gruppe.add(bogen);
  }
  // Keine Längsstreben: im Vorbild stehen nur die Bögen (S3, S6).

  // --- Rolltor mit Warnstreifen und Digitaluhr
  const torCanvas = document.createElement('canvas');
  torCanvas.width = 256; torCanvas.height = 256;
  const tx = torCanvas.getContext('2d');
  tx.fillStyle = '#66735f'; tx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 12) {
    tx.fillStyle = 'rgba(0,0,0,0.35)'; tx.fillRect(0, y, 256, 2);
    tx.fillStyle = 'rgba(255,255,255,0.06)'; tx.fillRect(0, y + 2, 256, 2);
  }
  for (let x = -40; x < 300; x += 28) {
    tx.fillStyle = '#d9822b';
    tx.beginPath(); tx.moveTo(x, 256); tx.lineTo(x + 14, 256); tx.lineTo(x + 34, 226); tx.lineTo(x + 20, 226); tx.fill();
  }
  tx.fillStyle = '#141414'; tx.fillRect(0, 226, 256, 30);
  for (let x = -40; x < 300; x += 28) {
    tx.fillStyle = '#d9822b';
    tx.beginPath(); tx.moveTo(x, 256); tx.lineTo(x + 14, 256); tx.lineTo(x + 34, 226); tx.lineTo(x + 20, 226); tx.fill();
  }
  tx.fillStyle = '#1b1b1b'; tx.fillRect(0, 220, 256, 6);
  const torTextur = new THREE.CanvasTexture(torCanvas);
  torTextur.colorSpace = THREE.SRGBColorSpace;
  const torMat = new THREE.MeshStandardMaterial({ map: torTextur, roughness: 0.55, metalness: 0.3, emissive: 0x101410 });
  const tor = new THREE.Mesh(new THREE.PlaneGeometry(W.torBreite, W.torHoehe), torMat);
  tor.position.set(W.torX, W.torHoehe / 2, W.zMin + 0.1);
  tor.receiveShadow = true;
  tor.name = 'tor';
  gruppe.add(tor);
  const torRahmenMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, metalness: 0.5 });
  gruppe.add(kasten(0.18, W.torHoehe + 0.2, 0.3, torRahmenMat, t0 - 0.05, (W.torHoehe + 0.2) / 2, W.zMin + 0.1));
  gruppe.add(kasten(0.18, W.torHoehe + 0.2, 0.3, torRahmenMat, t1 + 0.05, (W.torHoehe + 0.2) / 2, W.zMin + 0.1));
  gruppe.add(kasten(W.torBreite + 0.4, 0.2, 0.3, torRahmenMat, W.torX, W.torHoehe + 0.1, W.zMin + 0.1));
  // Uhrkasten oben, darunter das breite dunkle Schild „VERSAND“ mit zwei runden Lampen (s0_clock, s0_door)
  const uhr = ledAnzeige(256, 96);
  uhr.setze('0:00');
  const uhrY = W.torHoehe + 0.95;
  const uhrKasten = kasten(1.1, 0.46, 0.14, new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.5, metalness: 0.4 }), W.torX, uhrY, W.zMin + 0.15);
  gruppe.add(uhrKasten);
  const uhrFeld = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), new THREE.MeshBasicMaterial({ map: uhr.textur, toneMapped: false }));
  uhrFeld.position.set(W.torX, uhrY, W.zMin + 0.23);
  gruppe.add(uhrFeld);
  const versand = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.3),
    new THREE.MeshStandardMaterial({ map: schildTextur('VERSAND', { breite: 512, hoehe: 104, grund: '#4a4744', schrift: '#26231f', rahmen: '#3a3734', groesse: 0.62, font: '800 {g}px "Arial Narrow", Arial, sans-serif' }), roughness: 0.6, metalness: 0.3 }),
  );
  versand.position.set(W.torX, W.torHoehe + 0.45, W.zMin + 0.12);
  gruppe.add(versand);
  const lampeMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false });
  const lampeGeo = new THREE.SphereGeometry(0.08, 12, 8);
  for (const dx of [-0.84, 0.84]) {
    const l = new THREE.Mesh(lampeGeo, lampeMat);
    l.position.set(W.torX + dx, W.torHoehe + 0.45, W.zMin + 0.18);
    gruppe.add(l);
  }
  const pollerMat = new THREE.MeshStandardMaterial({ color: 0xe0a12a, roughness: 0.55, metalness: 0.2 });
  const pollerBand = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  for (const dx of [-2.0, 2.0]) {
    const x = W.torX + dx;
    const z = W.zMin + 0.35;
    const poller = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 12), pollerMat);
    poller.position.set(x, 0.5, z);
    poller.castShadow = true;
    gruppe.add(poller);
    for (const y of [0.55, 0.8]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.08, 12), pollerBand);
      band.position.set(x, y, z);
      gruppe.add(band);
    }
    kollider.push({ x0: x - 0.1, x1: x + 0.1, z0: z - 0.1, z1: z + 0.1, h: 1.0 });
  }
  // Schräges Wellblechvordach an der Torwand, wie im Vorbild an einer Längswand
  {
    const tief = 3;
    const oben = H + B;
    const unten = oben - 0.65;
    const laenge = W.xMax - W.xMin;
    const neigung = Math.atan2(oben - unten, tief);
    const vdMat = new THREE.MeshStandardMaterial({
      map: gekachelt(blechHell, laenge, Math.hypot(tief, oben - unten), 1.6, 1.6), color: 0xc9c0b4, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide,
      emissive: 0x2e2b27, // Unterseite graubraun statt schwarz (S6)
    });
    const vordach = new THREE.Mesh(new THREE.PlaneGeometry(laenge, Math.hypot(tief, oben - unten)), vdMat);
    vordach.rotation.x = -Math.PI / 2 + neigung;
    vordach.position.set((W.xMin + W.xMax) / 2, (oben + unten) / 2, W.zMin + tief / 2);
    vordach.castShadow = true;
    vordach.receiveShadow = false;
    gruppe.add(vordach);
    // Konsolen an den Pfosten
    for (let x = W.xMin + 2; x < W.xMax - 1; x += W.pfostenAbstand) {
      const konsole = kasten(0.08, 0.08, tief, stahlMat, x, unten - 0.05, W.zMin + tief / 2);
      konsole.rotation.x = neigung;
      gruppe.add(konsole);
    }
  }

  // Firmenschild an der Rückwand
  const firma = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.5),
    new THREE.MeshStandardMaterial({
      map: schildTextur('HEU & STROH GMBH', { breite: 512, hoehe: 96, grund: '#e9e2d2', schrift: '#8a2f22', rahmen: '#8a2f22', font: '800 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.62 }),
      roughness: 0.8,
    }),
  );
  firma.position.set(W.haufenX + 1, 2.6, W.zMin + 0.1);
  gruppe.add(firma);

  // --- Verkaufsstand
  const stand = standBauen(qualitaet, planken);
  stand.gruppe.position.set(W.standX, 0, W.standZ);
  gruppe.add(stand.gruppe);
  kollider.push({
    x0: W.standX - W.standTiefe / 2 - 0.1, x1: W.standX + W.standTiefe / 2 + 0.1,
    z0: W.standZ - W.standBreite / 2 - 0.1, z1: W.standZ + W.standBreite / 2 + 0.1, h: 2.4,
  });
  // Aufsteller vor dem Stand
  const preisTafel = preisTafelBauen();
  const aufsteller = aufstellerBauen(preisTafel.textur);
  aufsteller.position.set(W.standX + 2.3, 0, W.standZ + 1.7);
  aufsteller.rotation.y = Math.PI / 2 - 0.35;
  gruppe.add(aufsteller);
  kollider.push({ x0: W.standX + 1.95, x1: W.standX + 2.65, z0: W.standZ + 1.35, z1: W.standZ + 2.05, h: 1.1 });

  const stationen = stationenBauen(gruppe, kollider, planken, stahlMat);

  szene.add(gruppe);
  return {
    gruppe, kollider, uhr, boden, tor, torMat,
    /** Preis auf dem Aufsteller: Zahl ($ je Halm) oder fertiger Text. Malt nur bei Änderung neu. */
    preisSetzen: preisTafel.setze,
    /** Halle abbauen: aus der Szene nehmen, Geometrien, Materialien und Texturen freigeben. */
    entsorgen() { hofEntsorgen(gruppe); },
    stand: stand.gruppe, standTresen: stand.tresen,
    // Trichter vorn am Stand: hier rasten Bänder ein, hier wird verkauft
    standTrichter: { x: W.standX + W.standTiefe / 2 + 0.45, y: 0.9, z: W.standZ },
    ...stationen,
  };
}

/** Werkzeugstand, Werkbank, Lieferschalter, Hausanschluss und Auftragstafel. */
function stationenBauen(gruppe, kollider, planken, stahlMat) {
  const W = WELT;
  const holz = new THREE.MeshStandardMaterial({ map: gekachelt(planken, 2.4, 2.2, 1.4, 2.2), color: 0xa08a74, roughness: 0.85 });
  const holzHell = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8 });
  const schatten = (g) => g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // Werkzeugstand: Bude mit rot-weißer Dachkante, Werkzeuge an der Rückwand, Preisschilder
  const ws = new THREE.Group();
  ws.name = 'werkzeugstand';
  ws.add(kasten(3.0, 2.4, 0.1, holz, 0, 1.2, 0.7));
  ws.add(kasten(0.1, 2.4, 1.5, holz, -1.5, 1.2, 0));
  ws.add(kasten(0.1, 2.4, 1.5, holz, 1.5, 1.2, 0));
  const tresen = kasten(2.9, 1.0, 0.45, holz, 0, 0.5, -0.5);
  ws.add(tresen, kasten(3.05, 0.06, 0.6, holzHell, 0, 1.03, -0.5));
  const dach = kasten(3.4, 0.08, 1.9, new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.8 }), 0, 2.45, -0.1);
  dach.rotation.x = 0.1;
  ws.add(dach);
  // Durchgehende rote Blende mit weißer Oberkante (farmer-eye-level.jpg, shop.png)
  const rotMat = new THREE.MeshStandardMaterial({ color: 0xa8342a, roughness: 0.7 });
  const weissMat = new THREE.MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.7 });
  ws.add(kasten(3.4, 0.24, 0.03, rotMat, 0, 2.26, -1.05));
  ws.add(kasten(3.4, 0.06, 0.035, weissMat, 0, 2.41, -1.05));
  // Werkzeuge an der Wand: dieselben Modelle wie in der Hand, senkrecht aufgehängt (Kopf unten)
  const haken = [[-0.9, 'spaten'], [-0.3, 'heugabel'], [0.35, 'besen'], [0.95, 'sauger']];
  for (const [x, art] of haken) {
    let m;
    if (art === 'spaten') { m = eigenesModell(spatenModell()); m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(x, 1.45, 0.58); }
    else if (art === 'heugabel') { m = eigenesModell(heugabelModell()); m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(x, 1.4, 0.56); }
    else { m = art === 'besen' ? besenWand() : saugerWand(); m.position.set(x, 1.55, 0.6); }
    ws.add(m);
  }
  // Preisschilder auf dem Tresen
  const schilder = [['SPATEN', '12 $', -0.95], ['HEUGABEL', '45 $', -0.2], ['BESEN', '8 $', 0.5], ['EIMER', '3 $', 1.15]];
  for (const [name, preis, x] of schilder) {
    const karte = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshStandardMaterial({
      map: schildTextur([name, preis], { breite: 256, hoehe: 160, grund: '#f1e8d2', schrift: '#2a1c10', rahmen: '#8a2f22', font: '800 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.72 }),
      roughness: 0.9,
    }));
    karte.position.set(x, 1.2, -0.72);
    karte.rotation.x = -0.35;
    karte.rotation.y = Math.PI;
    ws.add(karte);
  }
  // Schild oben und Tafel für Bestwerte an der Seite
  const kopf = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4), new THREE.MeshStandardMaterial({
    map: schildTextur('WERKZEUG', { breite: 512, hoehe: 110, groesse: 0.66 }), roughness: 0.85,
  }));
  kopf.position.set(0, 2.72, -1.0);
  kopf.rotation.y = Math.PI;
  ws.add(kopf);
  const tafel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshStandardMaterial({
    map: schildTextur(['BESTENLISTE', '—'], { breite: 320, hoehe: 250, grund: '#1e2320', schrift: '#f4f4ee', rahmen: '#6b4a2d', font: '700 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.44, kreide: true }),
    roughness: 0.95,
  }));
  tafel.name = 'bestenliste';
  // innen an der rechten Seitenwand, von vorn zu sehen
  tafel.position.set(1.44, 1.55, 0.05);
  tafel.rotation.y = -Math.PI / 2;
  ws.add(tafel);
  ws.position.set(W.werkzeugX, 0, W.werkzeugZ);
  ws.rotation.y = 0; // Tresen zeigt nach −z (in die Halle)
  schatten(ws);
  gruppe.add(ws);
  kollider.push({ x0: W.werkzeugX - 1.6, x1: W.werkzeugX + 1.6, z0: W.werkzeugZ - 0.8, z1: W.werkzeugZ + 0.8, h: 2.4 });

  // Werkbank: verwitterte Holzbank mit gelber Kinderschaufel, Eimer und Detektor (avatar.png)
  const bank = new THREE.Group();
  bank.name = 'werkbank';
  const bankHolz = new THREE.MeshStandardMaterial({ map: gekachelt(planken, 1.8, 0.8, 0.9, 2.2), color: 0x9a8a7a, roughness: 0.9 });
  const platte = kasten(1.8, 0.08, 0.8, bankHolz, 0, 0.9, 0);
  bank.add(platte);
  for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) bank.add(kasten(0.08, 0.9, 0.08, bankHolz, x, 0.45, z));
  bank.add(kasten(1.7, 0.05, 0.7, bankHolz, 0, 0.25, 0));
  const schaufel = eigenesModell(sandschaufelModell());
  schaufel.position.set(-0.45, 0.955, 0.05);
  schaufel.rotation.set(0, 1.2, 0);
  bank.add(schaufel);
  const eimer = eigenesModell(eimerModell());
  eimer.position.set(0.15, 1.09, -0.12);
  eimer.getObjectByName('fuellung').visible = false;
  bank.add(eimer);
  const det = kasten(0.3, 0.06, 0.1, new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.5, metalness: 0.4 }), 0.55, 0.97, 0.15);
  bank.add(det);
  bank.position.set(W.bankX, 0, W.bankZ);
  bank.rotation.y = 0.3;
  schatten(bank);
  gruppe.add(bank);
  kollider.push({ x0: W.bankX - 1.0, x1: W.bankX + 1.0, z0: W.bankZ - 0.6, z1: W.bankZ + 0.6, h: 1.0 });

  // Lieferschalter (im Vorbild „SUPPLY CO.“): hier bestellt man neue Ladungen
  const liefer = new THREE.Group();
  liefer.name = 'lieferschalter';
  liefer.add(kasten(2.6, 1.05, 0.7, holz, 0, 0.525, 0));
  liefer.add(kasten(2.75, 0.06, 0.85, holzHell, 0, 1.08, 0));
  const lschild = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.52), new THREE.MeshStandardMaterial({
    map: schildTextur('LIEFERUNGEN', { breite: 512, hoehe: 116, grund: '#efe8da', schrift: '#8a2f22', rahmen: '#a8342a', font: '800 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.66 }),
    roughness: 0.85,
  }));
  lschild.position.set(0, 1.9, -0.3);
  liefer.add(lschild);
  for (const x of [-1.05, 1.05]) liefer.add(kasten(0.06, 1.0, 0.06, stahlMat, x, 1.55, -0.3));
  const ltafel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({
    map: schildTextur(['NEUE', 'LADUNG'], { breite: 256, hoehe: 180, grund: '#1e2320', schrift: '#f4f4ee', rahmen: '#6b4a2d', font: '700 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.5, kreide: true }),
    roughness: 0.95,
  }));
  ltafel.position.set(0.8, 1.35, 0.36);
  ltafel.rotation.x = -0.4;
  liefer.add(ltafel);
  liefer.position.set(W.lieferX, 0, W.lieferZ);
  schatten(liefer);
  gruppe.add(liefer);
  kollider.push({ x0: W.lieferX - 1.4, x1: W.lieferX + 1.4, z0: W.lieferZ - 0.45, z1: W.lieferZ + 0.45, h: 1.1 });

  // Hausanschluss: grauer Kasten mit Blitz, Leitung nach oben
  const an = new THREE.Group();
  an.name = 'hausanschluss';
  const kastenMat = new THREE.MeshStandardMaterial({ color: 0x8e979b, roughness: 0.45, metalness: 0.5 });
  an.add(kasten(0.2, 0.8, 0.6, kastenMat, 0, 1.4, 0));
  const blitz = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({
    map: schildTextur('⚡', { breite: 128, hoehe: 128, grund: '#f2c417', schrift: '#1b1b1b', rahmen: '#1b1b1b', font: '900 {g}px system-ui, sans-serif', groesse: 0.8 }),
    toneMapped: false,
  }));
  blitz.rotation.y = Math.PI / 2;
  blitz.position.set(0.105, 1.45, 0);
  an.add(blitz);
  an.add(kasten(0.06, 2.4, 0.06, stahlMat, 0, 3.0, 0.2));
  const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7cf29a, toneMapped: false }));
  lampe.position.set(0.11, 1.72, -0.2);
  lampe.name = 'lampe';
  an.add(lampe);
  an.position.set(W.anschlussX, 0, W.anschlussZ);
  schatten(an);
  gruppe.add(an);

  // Auftragstafel auf einer Staffelei neben dem Tor
  const tafelG = new THREE.Group();
  tafelG.name = 'auftragstafel';
  for (const [x, r] of [[-0.3, 0.12], [0.3, -0.12]]) {
    const bein = kasten(0.05, 1.8, 0.05, holzHell, x, 0.9, 0.1);
    bein.rotation.z = r;
    tafelG.add(bein);
  }
  const hinten = kasten(0.05, 1.7, 0.05, holzHell, 0, 0.85, -0.35);
  hinten.rotation.x = -0.25;
  tafelG.add(hinten);
  const kork = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.04), new THREE.MeshStandardMaterial({ color: 0xb0703a, roughness: 1 }));
  kork.position.set(0, 1.25, 0.14);
  tafelG.add(kork);
  tafelG.add(kasten(0.95, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.8 }), 0, 1.63, 0.15));
  // mehrere angepinnte Zettel (s0_door.png): Hauptzettel und drei kleine, leicht gedreht
  const zettelTextur = schildTextur(['AUFTRÄGE', '—'], { breite: 256, hoehe: 200, grund: '#f3eee2', schrift: '#2a1c10', rahmen: null, font: '700 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.42 });
  const zettel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshStandardMaterial({ map: zettelTextur, roughness: 0.95 }));
  zettel.name = 'auftragszettel';
  zettel.position.set(-0.14, 1.3, 0.165);
  zettel.rotation.z = 0.04;
  tafelG.add(zettel);
  const nadelMat = new THREE.MeshStandardMaterial({ color: 0xc8342a, roughness: 0.5 });
  const nadelGeo = new THREE.SphereGeometry(0.012, 6, 4);
  for (const [x, y, b, h2, farbe, dreh] of [[0.24, 1.42, 0.2, 0.16, 0xf2d98a, -0.12], [0.26, 1.1, 0.22, 0.2, 0xffffff, 0.09], [-0.2, 1.02, 0.18, 0.13, 0xe9b7a0, -0.06]]) {
    const z2 = new THREE.Mesh(new THREE.PlaneGeometry(b, h2), new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.95 }));
    z2.position.set(x, y, 0.163);
    z2.rotation.z = dreh;
    tafelG.add(z2);
    const pin = new THREE.Mesh(nadelGeo, nadelMat);
    pin.position.set(x, y + h2 / 2 - 0.02, 0.17);
    tafelG.add(pin);
  }
  tafelG.position.set(W.tafelX, 0, W.tafelZ);
  schatten(tafelG);
  gruppe.add(tafelG);

  return {
    werkzeugstand: ws, werkbank: bank, lieferschalter: liefer, hausanschluss: an, auftragstafel: tafelG,
    anschlussPunkt: { x: W.anschlussX + 0.15, y: 1.4, z: W.anschlussZ },
  };
}

function besenWand() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 })));
  const k = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.07), new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 1 }));
  k.position.y = -0.6;
  g.add(k);
  return g;
}
function saugerWand() {
  const g = new THREE.Group();
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.55 }));
  g.add(k);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xb9c0c6, roughness: 0.35, metalness: 0.85 }));
  r.position.y = -0.4;
  g.add(r);
  return g;
}

/** Holzbude mit Tresen, Kasse, Waage, Schild „HEU VERKAUFEN“ und Trichter davor. Blick nach +x. */
function standBauen(qualitaet, planken) {
  const W = WELT;
  const g = new THREE.Group();
  g.name = 'stand';
  const bt = W.standBreite;
  const tt = W.standTiefe;
  const holzDunkel = new THREE.MeshStandardMaterial({ map: gekachelt(planken, bt, 2.2, 1.4, 2.2), color: 0x9b8570, roughness: 0.85 });
  const holzHell = new THREE.MeshStandardMaterial({ color: 0x7a5433, roughness: 0.8 });
  // Rückwand und Seiten
  const rueck = kasten(0.1, 2.3, bt, holzDunkel, -tt / 2, 1.15, 0);
  const links = kasten(tt, 2.3, 0.1, holzDunkel, 0, 1.15, -bt / 2);
  const rechts = kasten(tt, 2.3, 0.1, holzDunkel, 0, 1.15, bt / 2);
  g.add(rueck, links, rechts);
  // Tresen vorne
  const tresen = kasten(0.5, 1.0, bt - 0.1, holzDunkel, tt / 2 - 0.25, 0.5, 0);
  tresen.name = 'standTresen';
  const platte = kasten(0.62, 0.06, bt + 0.05, holzHell, tt / 2 - 0.22, 1.03, 0);
  g.add(tresen, platte);
  // Dach
  // Blechdach wie im Vorbild (grau, leicht glänzend)
  const dach = kasten(tt + 0.5, 0.08, bt + 0.4, new THREE.MeshStandardMaterial({ color: 0x8c8f90, roughness: 0.55, metalness: 0.3 }), 0.1, 2.34, 0);
  dach.rotation.z = -0.08;
  g.add(dach);
  // Schild über dem Tresen
  const schild = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 2.2));
  // BoxGeometry-Seiten: +x, -x, +y, -y, +z, -z. Das Schild soll nach +x zeigen.
  schild.material = [
    new THREE.MeshStandardMaterial({
      map: schildTextur('HEU VERKAUFEN', {
        breite: 1024, hoehe: 240, groesse: 0.6, grund: '#d8d0c0', schrift: '#1a1a1a', rahmen: '#3a2a1c',
        font: '700 {g}px Georgia, "Times New Roman", serif',
      }),
      roughness: 0.8,
    }),
    new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
    new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
    new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
    new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
    new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
  ];
  // Die Textur liegt auf der +x-Seite gespiegelt; UV so drehen, dass die Schrift lesbar ist.
  schild.material[0].map.center.set(0.5, 0.5);
  schild.position.set(tt / 2 + 0.05, 2.62, 0);
  schild.castShadow = true;
  g.add(schild);
  for (const dz of [-0.9, 0.9]) {
    g.add(kasten(0.05, 0.3, 0.05, new THREE.MeshStandardMaterial({ color: STAHL, metalness: 0.5, roughness: 0.5 }), tt / 2 + 0.05, 2.3, dz));
  }
  // Alte Registrierkasse (schwarz mit Messingtasten, ohne Leuchtfeld) und davor eine Waage (S1, s0_stand)
  const kasse = new THREE.Group();
  const kasseMat = new THREE.MeshStandardMaterial({ color: 0x3d3a36, metalness: 0.6, roughness: 0.35 });
  const messing = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.7, roughness: 0.35 });
  kasse.add(kasten(0.34, 0.16, 0.4, kasseMat, 0, 0.08, 0));
  const kopf = kasten(0.2, 0.18, 0.34, kasseMat, -0.06, 0.25, 0);
  kopf.rotation.z = 0.25;
  kasse.add(kopf);
  const tasten = kasten(0.14, 0.03, 0.3, messing, 0.1, 0.175, 0);
  tasten.rotation.z = 0.35;
  kasse.add(tasten);
  kasse.add(kasten(0.05, 0.06, 0.26, messing, 0.03, 0.37, 0)); // Preisfenster oben
  kasse.position.set(tt / 2 - 0.25, 1.06, 0.7);
  g.add(kasse);
  const waage = new THREE.Group();
  waage.add(kasten(0.3, 0.05, 0.3, kasseMat, 0, 0.025, 0));
  waage.add(kasten(0.34, 0.012, 0.34, new THREE.MeshStandardMaterial({ color: 0x9ea3a6, metalness: 0.6, roughness: 0.4 }), 0, 0.056, 0));
  waage.add(kasten(0.05, 0.22, 0.05, kasseMat, -0.1, 0.16, 0));
  const skala = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0xedebe4, roughness: 0.5 }));
  skala.rotation.z = Math.PI / 2;
  skala.position.set(-0.08, 0.3, 0);
  waage.add(skala);
  const zeiger = kasten(0.005, 0.1, 0.012, kasseMat, -0.06, 0.33, 0.01);
  zeiger.rotation.x = 0.4;
  waage.add(zeiger);
  waage.position.set(tt / 2 - 0.25, 1.06, -0.55);
  g.add(waage);
  // Blechtrichter auf vier Beinen vorn am Stand: hier rasten Bänder ein (standTrichter)
  const trichterMat = new THREE.MeshStandardMaterial({ color: 0x9ea3a6, metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide });
  const trichter = new THREE.Group();
  const tg = new THREE.CylinderGeometry(0.35 * Math.SQRT2, 0.15 * Math.SQRT2, 0.4, 4, 1, true);
  tg.rotateY(Math.PI / 4);
  const tr = new THREE.Mesh(tg, trichterMat);
  tr.position.y = 0.8;
  trichter.add(tr);
  const randMat = new THREE.MeshStandardMaterial({ color: 0x5a5f64, metalness: 0.5, roughness: 0.5 });
  for (const sgn of [-1, 1]) {
    trichter.add(kasten(0.73, 0.03, 0.03, randMat, 0, 1.0, sgn * 0.35));
    trichter.add(kasten(0.03, 0.03, 0.73, randMat, sgn * 0.35, 1.0, 0));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const bein = kasten(0.04, 1.0, 0.04, randMat, x * 0.33, 0.5, z * 0.33);
    trichter.add(bein);
  }
  trichter.position.set(tt / 2 + 0.45, 0, 0);
  trichter.name = 'trichter';
  g.add(trichter);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { gruppe: g, tresen };
}

/** Schwarze Preistafel für den Aufsteller, neu malbar (aktueller Preis je Halm, S1: „$0.0222 PER STRAND“). */
function preisTafelBauen() {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 640;
  const x = c.getContext('2d');
  const textur = new THREE.CanvasTexture(c);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.anisotropy = 4;
  let zuletzt = null;
  function setze(wert) {
    let text = wert;
    if (typeof wert === 'number' && Number.isFinite(wert)) text = `${wert.toFixed(4).replace('.', ',')} $`;
    text = String(text == null ? '' : text);
    if (text === zuletzt) return;
    zuletzt = text;
    x.fillStyle = '#151515';
    x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#2a2a28';
    x.lineWidth = 10;
    x.strokeRect(5, 5, c.width - 10, c.height - 10);
    x.fillStyle = '#f4f4ee';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '900 46px "Arial Narrow", Arial, sans-serif';
    x.fillText('HEU', c.width / 2, 110, c.width * 0.86);
    x.font = '900 86px "Arial Narrow", Arial, sans-serif';
    x.fillText(text, c.width / 2, 300, c.width * 0.9);
    x.font = '800 54px "Arial Narrow", Arial, sans-serif';
    x.fillText('PRO HALM', c.width / 2, 420, c.width * 0.86);
    textur.needsUpdate = true;
  }
  setze(0.0222);
  return { textur, setze };
}

/** A-Aufsteller (schwarzes Brett ~1,25 m) mit der Preistafel. Tafel zeigt nach +z der Gruppe. */
function aufstellerBauen(tafelTextur) {
  const g = new THREE.Group();
  const holz = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8 });
  const tafelMat = new THREE.MeshStandardMaterial({ map: tafelTextur, roughness: 0.9 });
  for (const seite of [1, -1]) {
    const bein = new THREE.Group();
    const rahmen = kasten(0.75, 1.25, 0.035, holz, 0, 0.625, 0);
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.1), seite > 0 ? tafelMat : holz);
    tafel.position.set(0, 0.64, 0.02);
    bein.add(rahmen, tafel);
    bein.rotation.x = -seite * 0.2;
    bein.position.z = seite * 0.2;
    if (seite < 0) bein.rotation.y = Math.PI;
    g.add(bein);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Gibt Geometrien, Materialien und Texturen einer Gruppe frei (jedes nur einmal). */
function hofEntsorgen(gruppe) {
  if (gruppe.parent) gruppe.parent.remove(gruppe);
  const geos = new Set();
  const mats = new Set();
  const texs = new Set();
  gruppe.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const m of mats) for (const v of Object.values(m)) if (v && v.isTexture) texs.add(v);
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) t.dispose();
}
