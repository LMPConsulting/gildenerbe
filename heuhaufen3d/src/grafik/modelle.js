// Modelle aus einfachen Formen: Werkzeuge für die Ich-Ansicht, Gegenstände
// (Heubündel, Nadel), später Maschinen. Werkzeuge zeigen mit dem Stiel nach
// hinten unten und mit dem Kopf nach vorn (-z), wie man sie vor sich hält.

import * as THREE from '../../vendor/three.module.min.js';
import { strohTexturen } from './texturen.js';

const MAT = {};
function mat(name) {
  if (MAT[name]) return MAT[name];
  const defs = {
    holz: { color: 0xd2bb9a, roughness: 0.75 },
    holzDunkel: { color: 0x7a5433, roughness: 0.8 },
    stahl: { color: 0xd4d2cc, roughness: 0.5, metalness: 0.15 },
    stahlDunkel: { color: 0x5a5f64, roughness: 0.5, metalness: 0.3 },
    gummi: { color: 0x1d1d1f, roughness: 0.9 },
    gelb: { color: 0xf2c417, roughness: 0.45 },
    rot: { color: 0xb8352a, roughness: 0.6 },
    orange: { color: 0xe8702a, roughness: 0.5, metalness: 0.1 },
    grau: { color: 0x8d949a, roughness: 0.5, metalness: 0.4 },
    plastik: { color: 0xe9e4da, roughness: 0.55 },
    borsten: { color: 0x2a2320, roughness: 1 },
    heu: { color: 0xe9b44c, roughness: 0.95 },
    nadel: { color: 0xe8eef2, roughness: 0.2, metalness: 1 },
    leuchte: { color: 0x7cf29a, emissive: 0x3cc26a, emissiveIntensity: 1.2 },
  };
  MAT[name] = new THREE.MeshStandardMaterial(defs[name] || { color: 0xff00ff });
  return MAT[name];
}

function zyl(r, l, m, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, l, seg);
  g.rotateX(Math.PI / 2); // entlang z
  return new THREE.Mesh(g, m);
}
function box(b, h, t, m) { return new THREE.Mesh(new THREE.BoxGeometry(b, h, t), m); }

/** Stiel von hinten (z = +l/2) nach vorn (z = -l/2). */
function stiel(l = 1.25, r = 0.018) {
  const s = zyl(r, l, mat('holz'), 8);
  return s;
}

export function spatenModell() {
  const g = new THREE.Group();
  const s = stiel(1.2);
  g.add(s);
  const griff = box(0.14, 0.03, 0.03, mat('holzDunkel'));
  griff.position.z = 0.6;
  g.add(griff);
  const blatt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.26), mat('stahl'));
  blatt.position.z = -0.72;
  blatt.rotation.x = 0.45;
  blatt.material = new THREE.MeshStandardMaterial({ color: 0x7a5a44, roughness: 0.7, metalness: 0.2 }); // Rostspaten
  g.add(blatt);
  const hals = zyl(0.024, 0.1, mat('stahlDunkel'), 8);
  hals.position.z = -0.6;
  g.add(hals);
  return g;
}

export function heugabelModell() {
  const g = new THREE.Group();
  g.add(stiel(1.3));
  const quer = zyl(0.012, 0.32, mat('stahl'), 6);
  quer.rotation.y = Math.PI / 2;
  quer.position.z = -0.66;
  g.add(quer);
  // Sechs Zinken, nach vorn und deutlich nach oben gebogen (S3: sechs Striche über dem Querbalken)
  const zinkeGeo = new THREE.CylinderGeometry(0.0085, 0.005, 0.3, 6);
  for (let i = 0; i < 6; i++) {
    const x = -0.15 + i * 0.06;
    const zinke = new THREE.Mesh(zinkeGeo, mat('stahl'));
    // das vordere Ende (-y der Zylinderachse) zeigt nach vorn oben
    zinke.rotation.x = Math.PI / 2 + 0.5;
    zinke.position.set(x, 0.07, -0.79);
    g.add(zinke);
  }
  return g;
}

/** Gelbe Kinderschaufel: Kehrblech mit Seitenwänden, kurzer Stiel, D-Griff. Blatt vorn (-z). */
export function sandschaufelModell() {
  const g = new THREE.Group();
  const gelb = mat('gelb');
  const boden = box(0.24, 0.01, 0.26, gelb);
  boden.position.set(0, 0, -0.3);
  boden.rotation.x = -0.08; // Vorderkante etwas tiefer
  g.add(boden);
  for (const x of [-0.12, 0.12]) {
    const wand = box(0.01, 0.05, 0.26, gelb);
    wand.position.set(x, 0.022, -0.3);
    wand.rotation.x = -0.08;
    g.add(wand);
  }
  const rueck = box(0.25, 0.06, 0.012, gelb);
  rueck.position.set(0, 0.026, -0.17);
  g.add(rueck);
  const s = zyl(0.018, 0.35, gelb, 8);
  s.position.set(0, 0.035, 0.005);
  g.add(s);
  // D-Griff: Querholm und Bogen
  const quer = zyl(0.012, 0.1, gelb, 6);
  quer.rotation.y = Math.PI / 2;
  quer.position.set(0, 0.035, 0.18);
  g.add(quer);
  const bogen = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), gelb);
  bogen.rotation.x = Math.PI / 2;
  bogen.scale.set(1, 1.3, 1);
  bogen.position.set(0, 0.035, 0.18);
  g.add(bogen);
  return g;
}

export function besenModell() {
  const g = new THREE.Group();
  g.add(stiel(1.3));
  const kopf = box(0.42, 0.06, 0.07, mat('holzDunkel'));
  kopf.position.set(0, -0.02, -0.68);
  g.add(kopf);
  const borsten = box(0.4, 0.09, 0.05, mat('borsten'));
  borsten.position.set(0, -0.09, -0.68);
  g.add(borsten);
  return g;
}

export function detektorModell() {
  const g = new THREE.Group();
  const griff = zyl(0.02, 0.14, mat('gummi'), 8);
  griff.position.z = 0.05;
  g.add(griff);
  const koerper = box(0.08, 0.06, 0.2, mat('grau'));
  koerper.position.set(0, 0.02, -0.1);
  g.add(koerper);
  const anzeige = box(0.05, 0.005, 0.07, mat('leuchte'));
  anzeige.position.set(0, 0.053, -0.12);
  anzeige.name = 'anzeige';
  g.add(anzeige);
  const stab = zyl(0.01, 0.4, mat('stahlDunkel'), 6);
  stab.position.set(0, -0.02, -0.38);
  g.add(stab);
  const spule = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), mat('gummi'));
  spule.rotation.x = Math.PI / 2 - 0.4;
  spule.position.set(0, -0.06, -0.62);
  g.add(spule);
  return g;
}

export function saugerModell() {
  const g = new THREE.Group();
  const koerper = zyl(0.07, 0.3, mat('plastik'), 12);
  koerper.position.z = 0.02;
  g.add(koerper);
  const band = zyl(0.072, 0.05, mat('orange'), 12);
  band.position.z = 0.02;
  g.add(band);
  const rohr = zyl(0.035, 0.42, mat('stahl'), 10);
  rohr.position.z = -0.34;
  g.add(rohr);
  const duese = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.1, 10), mat('stahlDunkel'));
  duese.rotation.x = -Math.PI / 2;
  duese.position.z = -0.6;
  g.add(duese);
  const griff = box(0.03, 0.12, 0.06, mat('gummi'));
  griff.position.set(0, 0.1, 0.08);
  g.add(griff);
  return g;
}

export function handModell() {
  const g = new THREE.Group();
  const haut = new THREE.MeshStandardMaterial({ color: 0xd9a57e, roughness: 0.75 });
  const handschuh = new THREE.MeshStandardMaterial({ color: 0x7fcfa4, roughness: 0.9 });
  const flaeche = box(0.09, 0.03, 0.1, handschuh);
  g.add(flaeche);
  for (let i = 0; i < 4; i++) {
    const f = box(0.018, 0.02, 0.07, handschuh);
    f.position.set(-0.033 + i * 0.022, 0.0, -0.08);
    f.rotation.x = 0.35;
    g.add(f);
  }
  const daumen = box(0.02, 0.02, 0.06, handschuh);
  daumen.position.set(0.055, 0.0, -0.02);
  daumen.rotation.y = -0.6;
  g.add(daumen);
  const arm = zyl(0.04, 0.2, haut, 8);
  arm.position.z = 0.14;
  g.add(arm);
  return g;
}

export function eimerModell() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.16, 0.12, 0.3, 16, 1, true);
  const wand = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc2a680, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
  g.add(wand);
  const boden = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), wand.material);
  boden.rotation.x = -Math.PI / 2;
  boden.position.y = -0.15;
  g.add(boden);
  const henkel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.006, 4, 16, Math.PI), mat('stahlDunkel'));
  henkel.position.y = 0.15;
  g.add(henkel);
  const fuellung = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.02, 14), mat('heu'));
  fuellung.name = 'fuellung';
  fuellung.position.y = -0.14;
  g.add(fuellung);
  return g;
}

/**
 * Heu, das auf einem Werkzeug liegt: ein Büschel aus flachen Halmen, zu einer
 * Geometrie mit Vertexfarben vereint (ein Zeichenaufruf statt einer je Halm).
 * breite: Halmbreite in m (flach, 4 mm dick), laenge: Halmlänge.
 */
export function heuBueschel(anzahl = 40, radius = 0.12, { breite = 0.007, laenge = 0.2, hoch = 0.6 } = {}) {
  const farben = [0xf6cf6a, 0xeeb94c, 0xe2a338, 0xf9de90, 0xd58f2c, 0xe8b85a];
  const teile = [];
  const farbe = new THREE.Color();
  const cols = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const eins = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < anzahl; i++) {
    const halm = new THREE.BoxGeometry(breite, Math.min(breite, 0.004), laenge * (0.8 + Math.random() * 0.4));
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    v.set(Math.cos(a) * r, Math.random() * radius * hoch, Math.sin(a) * r);
    e.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9);
    q.setFromEuler(e);
    m4.compose(v, q, eins);
    halm.applyMatrix4(m4);
    farbe.setHex(farben[i % farben.length]);
    for (let k = 0; k < halm.attributes.position.count; k++) cols.push(farbe.r, farbe.g, farbe.b);
    teile.push(halm);
  }
  const geo = geoVereinen(teile);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  if (!MAT.heuBueschel) MAT.heuBueschel = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a2610 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, MAT.heuBueschel));
  return g;
}

/** Die Nadel: schlanker Stahlstift mit Öhr. Liegt entlang x. */
export function nadelModell(gold = false) {
  const g = new THREE.Group();
  const m = gold
    ? new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.2, metalness: 1 })
    : mat('nadel');
  const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0015, 0.16, 6), m);
  schaft.rotation.z = Math.PI / 2;
  g.add(schaft);
  const oehr = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 4, 10), m);
  oehr.position.x = 0.085;
  oehr.rotation.y = Math.PI / 2;
  g.add(oehr);
  return g;
}

/** Mehrere Geometrien zu einer (Position, Normale, UV; alle mit Index). */
export function geoVereinen(liste) {
  let n = 0;
  for (const g of liste) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const idx = [];
  let v = 0;
  for (const g of liste) {
    const gi = g;
    pos.set(gi.attributes.position.array, v * 3);
    nor.set(gi.attributes.normal.array, v * 3);
    if (gi.attributes.uv) uv.set(gi.attributes.uv.array, v * 2);
    if (gi.index) for (const i of gi.index.array) idx.push(i + v);
    else for (let i = 0; i < gi.attributes.position.count; i++) idx.push(i + v);
    v += gi.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Heubündel wie im Vorbild: flauschiger, stark verbeulter Knäuel mit abstehenden Halmen. */
function buendelGeometrie() {
  const kern = new THREE.SphereGeometry(0.13, 12, 8);
  // kräftig verbeult (stetig in der Position, damit die Naht zu bleibt)
  const p = kern.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const f = 0.84 + 0.13 * Math.sin(x * 61 + z * 47) * Math.sin(y * 53 + x * 29) + 0.09 * Math.sin(z * 83 - y * 37);
    p.setXYZ(i, x * f, y * f * 0.8, z * f);
  }
  kern.computeVertexNormals();
  const teile = [kern];
  // abstehende Halme ringsum (fest verteilt, damit alle Bündel gleich sind: eine Geometrie, ein Zeichenaufruf)
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 7; i++) {
    const w = (i / 7) * Math.PI * 2 + (i % 2) * 0.4;
    const halm = new THREE.BoxGeometry(0.014, 0.005, 0.15);
    e.set(0.25 * Math.sin(i * 2.3), -w + Math.PI / 2 + 0.5 * Math.cos(i * 1.7), 0.3 * Math.sin(i * 3.1));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(w) * 0.1, 0.02 * Math.sin(i * 1.3) - 0.01, Math.sin(w) * 0.1), q, new THREE.Vector3(1, 1, 1));
    halm.applyMatrix4(m4);
    teile.push(halm);
  }
  return geoVereinen(teile);
}

/** Geometrien für Gegenstände auf Bändern und am Boden (als Instanzen gezeichnet). */
export function gegenstandGeometrien() {
  const buendel = buendelGeometrie();
  const knaeuel = new THREE.SphereGeometry(0.11, 10, 8);
  const ballen = new THREE.BoxGeometry(0.5, 0.32, 0.36);
  const pellet = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10);
  const brei = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12);
  const silage = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14);
  silage.rotateZ(Math.PI / 2);
  const papier = new THREE.BoxGeometry(0.34, 0.08, 0.26);
  const ziegel = new THREE.BoxGeometry(0.3, 0.12, 0.16);
  return { buendel, knaeuel, ballen, pellet, brei, silage, papier, ziegel };
}

/**
 * Material der losen Heubündel (Band, Boden, in den Händen): helle Strohtextur und
 * orange-goldenes Eigenleuchten wie im Vorbild (S2 #D0964E). Einmal für alle.
 */
export function heuStueckMaterial() {
  if (MAT.heuStueck) return MAT.heuStueck;
  const map = strohTexturen(256, 700, 13, '#d9a55a').farbe;
  map.repeat.set(2, 2);
  MAT.heuStueck = new THREE.MeshStandardMaterial({
    map, color: 0xffffff, roughness: 0.95, emissive: 0xc86a1e, emissiveIntensity: 0.6,
  });
  return MAT.heuStueck;
}

export const GEGENSTAND_FARBEN = {
  roh: 0xe98a2c, // loses Heu auf dem Band: orange Bündel wie im Vorbild
  knaeuel: 0xe5a03a,
  ballen: 0xd9b25e,
  pellet: 0x9c7a3c,
  brei: 0xb8a47a,
  silage: 0xf2f2ee,
  papier: 0xfbf6e6,
  brikett: 0xb5643c,
};
