// Die Halle: Boden, Plankenwände mit Stahlpfosten, Wellblechband, Stahlbögen
// über dem offenen Dach, Rolltor mit Digitaluhr, der Verkaufsstand mit Schild
// und Preisaufsteller. Liefert auch die Kollisionskästen für den Spieler.

import * as THREE from '../../vendor/three.module.min.js';
import { WELT } from '../daten.js';
import {
  bodenTextur, plankenTextur, wellblechTextur, rostTextur, schildTextur, ledAnzeige,
} from './texturen.js';

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

export function hofBauen(szene, qualitaet) {
  const W = WELT;
  const gruppe = new THREE.Group();
  gruppe.name = 'hof';
  const kollider = [];
  const breite = W.xMax - W.xMin;
  const tiefe = W.zMax - W.zMin;
  const mx = (W.xMin + W.xMax) / 2;
  const mz = (W.zMin + W.zMax) / 2;

  // --- Boden
  const bt = bodenTextur(512, 11);
  bt.repeat.set(breite / 5, tiefe / 5);
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
  const planken = plankenTextur(512, 8, 23);
  planken.anisotropy = qualitaet.aniso;
  const blech = wellblechTextur(256, 31);
  const rost = rostTextur(128, 41);
  const stahlMat = new THREE.MeshStandardMaterial({ color: STAHL, roughness: 0.6, metalness: 0.5 });
  const rostMat = new THREE.MeshStandardMaterial({ map: rost, color: 0xd9a27c, roughness: 0.62, metalness: 0.15 });
  const dicke = 0.16;
  const H = W.wandHoehe;
  const B = W.bandHoehe;

  function wandStueck(x0, z0, x1, z1) {
    const laenge = Math.hypot(x1 - x0, z1 - z0);
    if (laenge < 0.01) return;
    const winkel = Math.atan2(z1 - z0, x1 - x0);
    const plMat = new THREE.MeshStandardMaterial({ map: gekachelt(planken, laenge, H, 2.2, H), roughness: 0.9 });
    const blMat = new THREE.MeshStandardMaterial({ map: gekachelt(blech, laenge, B, 1.6, B), roughness: 0.7, metalness: 0.3 });
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const unten = kasten(laenge, H, dicke, plMat, cx, H / 2, cz);
    unten.rotation.y = -winkel;
    const oben = kasten(laenge, B, dicke * 0.6, blMat, cx, H + B / 2, cz);
    oben.rotation.y = -winkel;
    gruppe.add(unten, oben);
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

  // --- Stahlbögen über dem offenen Dach
  const oben = H + B + 0.2;
  for (const x of W.boegen) {
    const punkte = [];
    for (let i = 0; i <= 40; i++) {
      const t = Math.PI * (i / 40);
      punkte.push(new THREE.Vector3(x, oben + Math.sin(t) * W.bogenHoehe, mz + Math.cos(t) * (tiefe / 2 + 0.05)));
    }
    const kurve = new THREE.CatmullRomCurve3(punkte);
    const bogen = new THREE.Mesh(new THREE.TubeGeometry(kurve, 60, 0.14, 8, false), rostMat);
    bogen.castShadow = true;
    gruppe.add(bogen);
  }
  // Längsstreben zwischen den Bögen
  for (const t of [0.25, 0.5, 0.75]) {
    const winkel = Math.PI * t;
    const y = oben + Math.sin(winkel) * W.bogenHoehe;
    const z = mz + Math.cos(winkel) * (tiefe / 2);
    const strebe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W.boegen[W.boegen.length - 1] - W.boegen[0], 6), rostMat);
    strebe.rotation.z = Math.PI / 2;
    strebe.position.set((W.boegen[0] + W.boegen[W.boegen.length - 1]) / 2, y, z);
    strebe.castShadow = true;
    gruppe.add(strebe);
  }

  // --- Rolltor mit Warnstreifen und Digitaluhr
  const torCanvas = document.createElement('canvas');
  torCanvas.width = 256; torCanvas.height = 256;
  const tx = torCanvas.getContext('2d');
  tx.fillStyle = '#4d5650'; tx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 12) {
    tx.fillStyle = 'rgba(0,0,0,0.35)'; tx.fillRect(0, y, 256, 2);
    tx.fillStyle = 'rgba(255,255,255,0.06)'; tx.fillRect(0, y + 2, 256, 2);
  }
  for (let x = -40; x < 300; x += 28) {
    tx.fillStyle = '#e0b43a';
    tx.beginPath(); tx.moveTo(x, 256); tx.lineTo(x + 14, 256); tx.lineTo(x + 34, 226); tx.lineTo(x + 20, 226); tx.fill();
  }
  tx.fillStyle = '#1b1b1b'; tx.fillRect(0, 220, 256, 6);
  const torTextur = new THREE.CanvasTexture(torCanvas);
  torTextur.colorSpace = THREE.SRGBColorSpace;
  const torMat = new THREE.MeshStandardMaterial({ map: torTextur, roughness: 0.55, metalness: 0.4 });
  const tor = new THREE.Mesh(new THREE.PlaneGeometry(W.torBreite, W.torHoehe), torMat);
  tor.position.set(W.torX, W.torHoehe / 2, W.zMin + 0.1);
  tor.receiveShadow = true;
  tor.name = 'tor';
  gruppe.add(tor);
  const torRahmenMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, metalness: 0.5 });
  gruppe.add(kasten(0.18, W.torHoehe + 0.2, 0.3, torRahmenMat, t0 - 0.05, (W.torHoehe + 0.2) / 2, W.zMin + 0.1));
  gruppe.add(kasten(0.18, W.torHoehe + 0.2, 0.3, torRahmenMat, t1 + 0.05, (W.torHoehe + 0.2) / 2, W.zMin + 0.1));
  gruppe.add(kasten(W.torBreite + 0.4, 0.2, 0.3, torRahmenMat, W.torX, W.torHoehe + 0.1, W.zMin + 0.1));
  // Uhrkasten
  const uhr = ledAnzeige(256, 96);
  uhr.setze('0:00');
  const uhrKasten = kasten(1.1, 0.46, 0.14, new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.5, metalness: 0.4 }), W.torX, W.torHoehe + 0.5, W.zMin + 0.15);
  gruppe.add(uhrKasten);
  const uhrFeld = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), new THREE.MeshBasicMaterial({ map: uhr.textur, toneMapped: false }));
  uhrFeld.position.set(W.torX, W.torHoehe + 0.5, W.zMin + 0.23);
  gruppe.add(uhrFeld);
  // zwei kleine Lampen neben der Uhr
  const lampeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false });
  for (const dx of [-0.42, 0.42]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lampeMat);
    l.position.set(W.torX + dx, W.torHoehe + 0.3, W.zMin + 0.24);
    gruppe.add(l);
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
  const aufsteller = aufstellerBauen();
  aufsteller.position.set(W.standX + 2.3, 0, W.standZ + 1.7);
  aufsteller.rotation.y = -Math.PI / 2 - 0.35;
  gruppe.add(aufsteller);
  kollider.push({ x0: W.standX + 1.95, x1: W.standX + 2.65, z0: W.standZ + 1.35, z1: W.standZ + 2.05, h: 1.1 });

  szene.add(gruppe);
  return {
    gruppe, kollider, uhr, boden, tor, torMat,
    stand: stand.gruppe, standTresen: stand.tresen,
  };
}

/** Holzbude mit Tresen, Kasse, Schild „HEU VERKAUFEN“ und hängendem Ballen. Blick nach +x. */
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
  const dach = kasten(tt + 0.5, 0.08, bt + 0.4, new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.8 }), 0.1, 2.34, 0);
  dach.rotation.z = -0.08;
  g.add(dach);
  // Schild über dem Tresen
  const schild = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.52, 2.2),
    [
      new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
      new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
      new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
      new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
      new THREE.MeshStandardMaterial({ map: schildTextur('HEU VERKAUFEN', { breite: 1024, hoehe: 240, groesse: 0.6 }), roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x2b1d12 }),
    ],
  );
  // BoxGeometry-Seiten: +x, -x, +y, -y, +z, -z. Das Schild soll nach +x zeigen.
  schild.material = [
    new THREE.MeshStandardMaterial({ map: schildTextur('HEU VERKAUFEN', { breite: 1024, hoehe: 240, groesse: 0.6 }), roughness: 0.8 }),
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
  // Registrierkasse
  const kasse = new THREE.Group();
  const kasseMat = new THREE.MeshStandardMaterial({ color: 0x3d3a36, metalness: 0.6, roughness: 0.35 });
  kasse.add(kasten(0.34, 0.16, 0.4, kasseMat, 0, 0.08, 0));
  const kopf = kasten(0.2, 0.18, 0.34, kasseMat, -0.06, 0.25, 0);
  kopf.rotation.z = 0.25;
  kasse.add(kopf);
  const anzeige = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), new THREE.MeshBasicMaterial({ color: 0x7cf29a, toneMapped: false }));
  anzeige.rotation.y = Math.PI / 2;
  anzeige.position.set(0.05, 0.3, 0);
  kasse.add(anzeige);
  kasse.position.set(tt / 2 - 0.25, 1.06, 0.7);
  g.add(kasse);
  // Hängender Ballen neben dem Schild
  const ballen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.55, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8b778, roughness: 0.95 }),
  );
  ballen.rotation.z = Math.PI / 2 + 0.3;
  ballen.position.set(tt / 2 + 0.25, 2.0, -1.45);
  ballen.castShadow = true;
  g.add(ballen);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { gruppe: g, tresen };
}

/** A-Aufsteller mit Kreidetafel: „0,0222 $ PRO HALM“. Tafel zeigt nach +z der Gruppe. */
function aufstellerBauen() {
  const g = new THREE.Group();
  const holz = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.85 });
  const tafelMat = new THREE.MeshStandardMaterial({
    map: schildTextur(['0,0222 $', 'PRO HALM'], {
      breite: 512, hoehe: 640, grund: '#1e2320', schrift: '#f4f4ee', rahmen: '#6b4a2d',
      font: '700 {g}px "Arial Narrow", Arial, sans-serif', groesse: 0.36, kreide: true,
    }),
    roughness: 0.95,
  });
  for (const seite of [1, -1]) {
    const bein = new THREE.Group();
    const rahmen = kasten(0.62, 0.9, 0.035, holz, 0, 0.45, 0);
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.78), seite > 0 ? tafelMat : holz);
    tafel.position.set(0, 0.46, 0.02);
    bein.add(rahmen, tafel);
    bein.rotation.x = -seite * 0.24;
    bein.position.z = seite * 0.11;
    if (seite < 0) bein.rotation.y = Math.PI;
    g.add(bein);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
