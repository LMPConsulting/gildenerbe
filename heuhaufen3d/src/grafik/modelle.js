// Modelle aus einfachen Formen: Werkzeuge für die Ich-Ansicht, Gegenstände
// (Heubündel, Nadel), später Maschinen. Werkzeuge zeigen mit dem Stiel nach
// hinten unten und mit dem Kopf nach vorn (-z), wie man sie vor sich hält.

import * as THREE from '../../vendor/three.module.min.js';

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
  for (let i = 0; i < 6; i++) {
    const x = -0.15 + i * 0.06;
    const zinke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.26, 6), mat('stahl'));
    zinke.rotation.x = Math.PI / 2 - 0.18;
    zinke.position.set(x, 0.02, -0.8);
    g.add(zinke);
  }
  return g;
}

export function sandschaufelModell() {
  const g = new THREE.Group();
  const s = zyl(0.016, 0.34, mat('gelb'), 8);
  s.position.z = 0.1;
  g.add(s);
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('gelb'));
  kopf.scale.set(1, 0.55, 1.3);
  kopf.rotation.x = Math.PI;
  kopf.position.z = -0.14;
  g.add(kopf);
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

/** Heu, das auf einem Werkzeug liegt: ein Büschel aus Halmen. */
export function heuBueschel(anzahl = 40, radius = 0.12) {
  const g = new THREE.Group();
  const halmGeo = new THREE.BoxGeometry(0.007, 0.007, 0.2);
  const farben = [0xf6cf6a, 0xeeb94c, 0xe2a338, 0xf9de90, 0xd58f2c];
  const mats = farben.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < anzahl; i++) {
    const h = new THREE.Mesh(halmGeo, mats[i % mats.length]);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    h.position.set(Math.cos(a) * r, Math.random() * radius * 0.6, Math.sin(a) * r);
    h.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9);
    g.add(h);
  }
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

/** Geometrien für Gegenstände auf Bändern und am Boden (als Instanzen gezeichnet). */
export function gegenstandGeometrien() {
  const buendel = new THREE.SphereGeometry(0.13, 14, 10);
  // leicht verbeult wie ein Heuknäuel (stetig, damit die Naht zu bleibt)
  const p = buendel.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 0.9 + 0.1 * Math.sin(p.getX(i) * 61 + p.getZ(i) * 47) * Math.sin(p.getY(i) * 53 + p.getX(i) * 29);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85, p.getZ(i) * f);
  }
  buendel.computeVertexNormals();
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
