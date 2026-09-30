// Maschinenmodelle: jeder Bau aus dem Baukatalog als three.js-Gruppe, dazu der
// Laster am Tor und die Heudrohne. Nur einfache Formen und geteilte Werkstoffe,
// keine Texturen: halbrealistisch, wenige Dreiecke (unter 2500 je Modell).
//
// Koordinaten: Ursprung in der Mitte des Fußabdrucks auf dem Boden (y = 0),
// lokal +x ist vorn (Auslauf). Maße wie in BAUTEN: b entlang x, t entlang z,
// h nach oben. Bänder rasten in 0,55 m Höhe an den Anschlüssen (ein/aus) ein;
// dort sitzt jeweils eine helle Metallkante, damit man sieht, wo es passt.
//
// Bewegliche Teile tragen Namen (obj.name), objekte3d.js sucht sie heraus und
// bewegt sie. Alles Unbenannte ist starr und wird je Werkstoff zu einem Netz
// verschmolzen – wenige Zeichenaufrufe, wichtig fürs Telefon. Jeder Typ wird
// einmal gebaut und danach nur geklont (Geometrie und Werkstoffe geteilt);
// Leuchtteile bekommen je Modell einen eigenen Werkstoff.

import * as THREE from '../../vendor/three.module.min.js';
import { BAUTEN } from '../daten.js';

/** Oberkante eines Bandes; auf dieser Höhe liegen die Anschlusskanten. */
const MM_BAND_Y = 0.55;
/** Auslauf von Heutreppe und Heulift: Plattform (2,2 m) plus Bandhöhe. */
const MM_OBEN_Y = 2.2 + MM_BAND_Y;

/* ------------------------------------------------------------ Werkstoffe */

// Die Szene hat keine Umgebungskarte: stark metallische Werkstoffe würden fast
// schwarz. Darum bleibt metalness niedrig, der Glanz kommt über roughness.
const MM_WERKSTOFFE = {
  orange: { color: 0xe0641e, roughness: 0.42, metalness: 0.15 },
  schwarz: { color: 0x1d1e20, roughness: 0.5, metalness: 0.2 },
  dunkel: { color: 0x34373a, roughness: 0.6, metalness: 0.25 },
  gummi: { color: 0x2a2826, roughness: 0.92, metalness: 0 },
  schiene: { color: 0xb4b9bd, roughness: 0.45, metalness: 0.3 },
  lippe: { color: 0xe6eaed, roughness: 0.3, metalness: 0.35 },
  stahl: { color: 0xb3b9be, roughness: 0.4, metalness: 0.35 },
  chrom: { color: 0xe8ecef, roughness: 0.2, metalness: 0.5 },
  stahlDunkel: { color: 0x555a60, roughness: 0.5, metalness: 0.3 },
  weiss: { color: 0xdfe2df, roughness: 0.55, metalness: 0.08 },
  hellgrau: { color: 0xa9aeb0, roughness: 0.5, metalness: 0.25 },
  gelb: { color: 0xf0bf1a, roughness: 0.45, metalness: 0.1 },
  blau: { color: 0x2552a0, roughness: 0.4, metalness: 0.35 },
  blauHell: { color: 0x3a78c0, roughness: 0.45, metalness: 0.25 },
  rohrBlau: { color: 0x2f6db5, roughness: 0.35, metalness: 0.25 },
  gruen: { color: 0x4e6a3a, roughness: 0.55, metalness: 0.2 },
  gruenHell: { color: 0x7fbf3a, roughness: 0.5, metalness: 0.1 },
  rot: { color: 0xa8342a, roughness: 0.5, metalness: 0.2 },
  senf: { color: 0xd8a11c, roughness: 0.5, metalness: 0.2 },
  rostbraun: { color: 0x7e3a26, roughness: 0.62, metalness: 0.25 },
  petrol: { color: 0x3b6e6a, roughness: 0.5, metalness: 0.25 },
  edelstahl: { color: 0xc9ced2, roughness: 0.3, metalness: 0.4 },
  blech: { color: 0xa9afb1, roughness: 0.45, metalness: 0.3 },
  holz: { color: 0xa47b52, roughness: 0.85 },
  holzHell: { color: 0xb88f62, roughness: 0.85 },
  holzDunkel: { color: 0x6a4a31, roughness: 0.88 },
  holzAlt: { color: 0x5e4a3a, roughness: 0.9 },
  beton: { color: 0x9c9890, roughness: 0.95 },
  glas: { color: 0x2a3a44, roughness: 0.1, metalness: 0.2 },
  heu: { color: 0xd8a24c, roughness: 0.95 },
  brei: { color: 0x9a875a, roughness: 0.55 },
  papier: { color: 0xf4f0e4, roughness: 0.8 },
  folie: { color: 0xe9ede6, roughness: 0.3, metalness: 0.05 },
  mast: { color: 0x2b2724, roughness: 0.7, metalness: 0.2 },
  porzellan: { color: 0xd9dfd2, roughness: 0.25, metalness: 0.05 },
  reifen: { color: 0x19191a, roughness: 0.9 },
  felge: { color: 0xc9ccce, roughness: 0.38, metalness: 0.35 },
  lasterRot: { color: 0xa8302a, roughness: 0.38, metalness: 0.2 },
  kupfer: { color: 0xc27a3e, roughness: 0.35, metalness: 0.4 },
  markierung: { color: 0xf2f2ec, roughness: 0.6 },
  pellets: { color: 0x9c7a3c, roughness: 0.9 },
  ziegel: { color: 0xb5643c, roughness: 0.85 },
  // glimmen immer ein wenig und sind geteilt: Rückleuchten, Scheinwerfer, Landelichter
  ruecklicht: { color: 0x8a1a14, emissive: 0x6a0c08, emissiveIntensity: 0.8, roughness: 0.4 },
  scheinwerfer: { color: 0xf5f1e0, emissive: 0x9c9a88, emissiveIntensity: 0.6, roughness: 0.2 },
  padLicht: { color: 0x9fd8ff, emissive: 0x3a9ae0, emissiveIntensity: 1.2, roughness: 0.4 },
};

/** Leuchtteile: je Modell eine eigene Kopie, die Spiellogik färbt sie einzeln. */
const MM_LEUCHTEN = {
  bake: { color: 0xffa040, emissive: 0xff6a00, emissiveIntensity: 2.2, roughness: 0.4 },
  feuer: { color: 0xffb050, emissive: 0xff5a10, emissiveIntensity: 2.6, roughness: 0.6 },
  gruen: { color: 0x7cf29a, emissive: 0x2ecc5a, emissiveIntensity: 1.6, roughness: 0.4 },
  warm: { color: 0xfff3d6, emissive: 0xffe2a0, emissiveIntensity: 2.4, roughness: 0.3 },
  anzeige: { color: 0x9fe6ff, emissive: 0x2f9fd0, emissiveIntensity: 1.1, roughness: 0.3 },
};

const MM_MAT = {};

/** Geteilter Werkstoff; beidseitig für offene Trichter, Wannen und Blech. */
function mmMat(name, beidseitig = false) {
  const schluessel = beidseitig ? `${name}:2` : name;
  if (!MM_MAT[schluessel]) {
    const d = MM_WERKSTOFFE[name] || { color: 0xff00ff };
    const m = new THREE.MeshStandardMaterial({ ...d, side: beidseitig ? THREE.DoubleSide : THREE.FrontSide });
    m.name = `mm-${schluessel}`;
    MM_MAT[schluessel] = m;
  }
  return MM_MAT[schluessel];
}

/** Eigener Werkstoff (wird beim Klonen jedes Modells kopiert). */
function mmLeucht(name) {
  const m = new THREE.MeshStandardMaterial(MM_LEUCHTEN[name]);
  m.name = `mm-leucht-${name}`;
  m.userData.eigen = true;
  return m;
}

/* ------------------------------------------------------------ Formen */

const MM_OBEN = new THREE.Vector3(0, 1, 0);

function mmNetz(p, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

/** Quader mit Mittelpunkt (x, y, z). */
function mmQ(p, b, h, t, mat, x = 0, y = 0, z = 0) {
  return mmNetz(p, new THREE.BoxGeometry(b, h, t), mat, x, y, z);
}

/**
 * Zylinder entlang einer Achse ('x', 'y' oder 'z') mit Mittelpunkt (x, y, z).
 * r gilt am negativen Ende, r2 am positiven (Kegelstumpf); offen = ohne Deckel.
 */
function mmZ(p, r, l, mat, achse = 'y', x = 0, y = 0, z = 0, seg = 12, r2 = r, offen = false) {
  const g = new THREE.CylinderGeometry(r2, r, l, seg, 1, offen);
  if (achse === 'x') g.rotateZ(-Math.PI / 2);
  else if (achse === 'z') g.rotateX(Math.PI / 2);
  return mmNetz(p, g, mat, x, y, z);
}

/** Runder Stab von a nach b (je [x, y, z]). */
function mmStab(p, a, b, r, mat, seg = 6) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const d = new THREE.Vector3(b[0], b[1], b[2]).sub(va);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(MM_OBEN, d.normalize());
  p.add(m);
  return m;
}

/** Brett von a nach b mit Querschnitt bx × bz (liegt a→b in einer Achsenebene, bleiben die Kanten gerade). */
function mmBrett(p, a, b, bx, bz, mat) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const d = new THREE.Vector3(b[0], b[1], b[2]).sub(va);
  const m = new THREE.Mesh(new THREE.BoxGeometry(bx, d.length(), bz), mat);
  m.position.copy(va).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(MM_OBEN, d.normalize());
  p.add(m);
  return m;
}

function mmKugel(p, r, mat, x, y, z, seg = 8) {
  return mmNetz(p, new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6))), mat, x, y, z);
}

/** Halbkugel, auf die Höhe hoehe gestaucht; (x, y, z) ist die Mitte der Grundfläche. */
function mmKuppel(p, r, hoehe, mat, x, y, z, seg = 12) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(3, Math.round(seg / 3)), 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, hoehe / r, 1);
  return mmNetz(p, g, mat, x, y, z);
}

/** Ring (Torus); achse ist die Richtung, durch die man hindurchschaut. */
function mmTorus(p, r, rohr, mat, achse, x, y, z, seg = 24, rohrSeg = 6) {
  const g = new THREE.TorusGeometry(r, rohr, rohrSeg, seg);
  if (achse === 'x') g.rotateY(Math.PI / 2);
  else if (achse === 'y') g.rotateX(Math.PI / 2);
  return mmNetz(p, g, mat, x, y, z);
}

function mmTeil(p, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  if (name) g.name = name;
  g.position.set(x, y, z);
  p.add(g);
  return g;
}

/** Leeres Objekt als Merkpunkt (Rauch, Ladung). */
function mmPunkt(p, name, x, y, z) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  p.add(o);
  return o;
}

/** Kleine Statuslampe 'anzeige' (eigener Werkstoff); achse zeigt aus der Wand heraus. */
function mmAnzeige(p, x, y, z, achse = 'y', r = 0.025) {
  const m = mmZ(p, r, 0.025, mmLeucht('gruen'), achse, x, y, z, 10);
  m.name = 'anzeige';
  return m;
}

/** Warnstreifen: abwechselnd gelb und schwarz, n Felder auf der Länge l entlang x oder z. */
function mmWarnstreifen(p, l, h, t, x, y, z, achse = 'x', n = 8) {
  const s = l / n;
  for (let i = 0; i < n; i++) {
    const o = -l / 2 + s * (i + 0.5);
    const m = i % 2 ? mmMat('schwarz') : mmMat('gelb');
    if (achse === 'x') mmQ(p, s, h, t, m, x + o, y, z);
    else mmQ(p, t, h, s, m, x, y, z + o);
  }
}

/** Trichter, oben halbe Weite ao, unten au; quadratisch oder rund. Oberkante bei yOben. */
function mmTrichter(p, ao, au, h, mat, x, yOben, z, rund = false) {
  const k = rund ? 1 : Math.SQRT2;
  const g = new THREE.CylinderGeometry(ao * k, au * k, h, rund ? 16 : 4, 1, true);
  if (!rund) g.rotateY(Math.PI / 4);
  const m = mmNetz(p, g, mat, x, yOben - h / 2, z);
  if (rund) mmTorus(p, ao, 0.014, mmMat('stahlDunkel'), 'y', x, yOben, z, 16, 4);
  else {
    for (const s of [-1, 1]) {
      mmQ(p, ao * 2 + 0.03, 0.03, 0.03, mmMat('stahlDunkel'), x, yOben, z + s * ao);
      mmQ(p, 0.03, 0.03, ao * 2 + 0.03, mmMat('stahlDunkel'), x + s * ao, yOben, z);
    }
  }
  return m;
}

/** Rutsche (U-Profil) von a nach b, Breite w, Wandhöhe hw. */
function mmRutsche(p, a, b, w, hw, mat) {
  const g = new THREE.Group();
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz);
  mmQ(g, l, 0.025, w, mat, 0, 0, 0);
  for (const s of [-1, 1]) mmQ(g, l, hw, 0.025, mat, 0, hw / 2, s * w / 2);
  g.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  g.rotation.order = 'YZX';
  g.rotation.y = -Math.atan2(dz, dx);
  g.rotation.z = Math.atan2(dy, Math.hypot(dx, dz));
  p.add(g);
  return g;
}

/** Gerades Bandstück entlang x mit Oberkante y und grauen Seitenschienen. */
function mmBandstueck(p, x0, x1, z = 0, breite = 0.6, y = MM_BAND_Y) {
  const l = x1 - x0;
  const xm = (x0 + x1) / 2;
  mmQ(p, l, 0.06, breite, mmMat('gummi'), xm, y - 0.03, z);
  for (const s of [-1, 1]) mmQ(p, l, 0.09, 0.035, mmMat('schiene'), xm, y + 0.005, z + s * (breite / 2 + 0.0175));
}

/** Kleiner Isolator als Anschlusspunkt für die Stromleitung; liefert die Spitze. */
function mmIsolator(p, x, y, z) {
  mmZ(p, 0.018, 0.07, mmMat('porzellan'), 'y', x, y + 0.035, z, 6);
  mmZ(p, 0.034, 0.016, mmMat('porzellan'), 'y', x, y + 0.03, z, 10);
  mmZ(p, 0.03, 0.016, mmMat('porzellan'), 'y', x, y + 0.06, z, 10);
  return [x, y + 0.08, z];
}

/** Blaues Rohr mit Bögen durch die Punkte (Wasser). */
function mmRohrZug(p, punkte, r = 0.045) {
  const m = mmMat('rohrBlau');
  for (let i = 1; i < punkte.length; i++) mmStab(p, punkte[i - 1], punkte[i], r, m, 10);
  for (let i = 1; i < punkte.length - 1; i++) mmKugel(p, r * 1.12, m, ...punkte[i], 8);
}

/** Rotes Handrad (Ventil) mit Speichenkreuz; achse ist die Spindelrichtung. */
function mmHandrad(p, x, y, z, achse = 'y', r = 0.07) {
  mmTorus(p, r, 0.011, mmMat('rot'), achse, x, y, z, 16, 4);
  const d = 0.012;
  if (achse === 'y') { mmQ(p, r * 2, d, d, mmMat('rot'), x, y, z); mmQ(p, d, d, r * 2, mmMat('rot'), x, y, z); }
  else if (achse === 'x') { mmQ(p, d, r * 2, d, mmMat('rot'), x, y, z); mmQ(p, d, d, r * 2, mmMat('rot'), x, y, z); }
  else { mmQ(p, r * 2, d, d, mmMat('rot'), x, y, z); mmQ(p, d, r * 2, d, mmMat('rot'), x, y, z); }
}

/** Mehrere Geometrien (position, normal, uv) zu einer mit Index zusammenfügen. */
function mmGeoZusammen(geos) {
  let nv = 0;
  let ni = 0;
  const mitUv = geos.every((g) => g.attributes.uv);
  for (const g of geos) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const uv = mitUv ? new Float32Array(nv * 2) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0;
  let i = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    for (let k = 0; k < p.count; k++) {
      const o = (v + k) * 3;
      pos[o] = p.getX(k); pos[o + 1] = p.getY(k); pos[o + 2] = p.getZ(k);
      nor[o] = n.getX(k); nor[o + 1] = n.getY(k); nor[o + 2] = n.getZ(k);
      if (uv) { uv[(v + k) * 2] = u.getX(k); uv[(v + k) * 2 + 1] = u.getY(k); }
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[i++] = g.index.getX(k) + v;
    else for (let k = 0; k < p.count; k++) idx[i++] = k + v;
    v += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Drei flache Flammenzungen, Drehpunkt unten in der Mitte (flackert beim Skalieren nach oben). */
function mmFlammenGeo() {
  const teile = [[0.05, 0.16, 0], [0.036, 0.115, -0.075], [0.036, 0.12, 0.075]].map(([r, h, z]) => {
    const g = new THREE.ConeGeometry(r, h, 6);
    g.translate(0, h / 2, z);
    return g;
  });
  const geo = mmGeoZusammen(teile);
  geo.scale(0.35, 1, 1);
  return geo;
}

/* ------------------------------------------------------------ Anschlüsse */

/** Helle U-Kante an einem Anschluss; normale: Richtung nach außen ('x+', 'x-', 'z+', 'z-'). */
function mmLippe(p, px, py, pz, normale, halb) {
  const g = mmTeil(p, null, px, py, pz);
  g.rotation.y = { 'x+': 0, 'x-': Math.PI, 'z+': -Math.PI / 2, 'z-': Math.PI / 2 }[normale];
  const m = mmMat('lippe');
  mmQ(g, 0.1, 0.03, halb * 2, m, -0.05, -0.015, 0); // Boden, Oberkante auf Bandhöhe
  mmQ(g, 0.02, 0.06, halb * 2, m, -0.01, -0.06, 0); // Stirnkante nach unten
  for (const s of [-1, 1]) mmQ(g, 0.1, 0.11, 0.03, m, -0.05, 0.04, s * (halb - 0.015)); // Wangen
}

/** Höhe der Ausgänge, die nicht auf Bandhöhe liegen (wie ausgangPunkt in maschinen.js). */
const MM_PORT_HOEHE = { heutreppe: { aus: MM_OBEN_Y }, heulift: { aus: MM_OBEN_Y } };

/** Kanten an allen Anschlüssen aus BAUTEN setzen und die Lage in userData.ports ablegen. */
function mmAnschluesse(g, typ) {
  const d = BAUTEN.find((x) => x.id === typ);
  const ports = { ein: [], aus: [] };
  g.userData.ports = ports;
  if (!d) return;
  const alle = [...d.ein.map((p) => ['ein', p]), ...d.aus.map((p) => ['aus', p])];
  for (const [art, [px, pz]] of alle) {
    const y = (MM_PORT_HOEHE[typ] && MM_PORT_HOEHE[typ][art]) || MM_BAND_Y;
    const anX = Math.abs(Math.abs(px) - d.b / 2) < 0.02;
    const normale = anX ? (px > 0 ? 'x+' : 'x-') : (pz > 0 ? 'z+' : 'z-');
    // so breit wie ein Band, aber nicht über den Rand oder in den Nachbaranschluss
    let halb = Math.min(0.32, (anX ? d.t : d.b) / 2 - Math.abs(anX ? pz : px));
    for (const [, [qx, qz]] of alle) {
      const gleicheSeite = anX ? Math.abs(qx - px) < 0.02 : Math.abs(qz - pz) < 0.02;
      const abstand = anX ? Math.abs(qz - pz) : Math.abs(qx - px);
      if (gleicheSeite && abstand > 0.01) halb = Math.min(halb, abstand / 2 - 0.01);
    }
    mmLippe(g, px, y, pz, normale, halb);
    ports[art].push([px, y, pz]);
  }
}

/* ------------------------------------------------------------ Greifarm */

/**
 * Ruhelage wie in objekte3d.js (armStellen): das Handgelenk zielt 0,55 m vor den
 * Sockel auf h + 0,2 m. Liefert die Gelenkwinkel für den Bau des Modells.
 */
function mmArmRuhe(l1, l2, schulterY, h) {
  const r = 0.55;
  const hh = h + 0.2 - schulterY;
  const dist = Math.min(l1 + l2 - 0.01, Math.max(0.2, Math.hypot(r, hh)));
  const klemm = (v) => Math.max(-1, Math.min(1, v));
  const e = Math.PI - Math.acos(klemm((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2)));
  const s = Math.atan2(hh, r) + Math.acos(klemm((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  return { schulter: s - Math.PI / 2, ellbogen: -e, handgelenk: -(s - Math.PI / 2) + e - Math.PI / 2 };
}

/**
 * Sechsachsiger Greifarm auf rundem Sockel, daneben ein dünner Mast mit Bake.
 * s: Maßstab (1 = Greifarm, 2,6 m Reichweite; 0,69 = Vorrangarm, 1,8 m).
 * drehteller dreht um y; schulter und ellbogen zeigen bei Drehung 0 nach oben
 * (+y), negative rotation.z kippt nach vorn (+x). Die Hand zeigt entlang +x des
 * Handgelenks (armStellen hält dieses so, dass +x nach unten weist); der
 * Greifer hat genau zwei Finger, die über rotation.x auf- und zugehen.
 */
function mmGreifarm(s, dunkel, h) {
  const g = new THREE.Group();
  const glied = dunkel ? mmMat('schwarz') : mmMat('orange');
  const gelenk = dunkel ? mmMat('dunkel') : mmMat('schwarz');
  const kappe = mmMat('orange');
  const L1 = 1.2 * s;
  const L2 = 1.45 * s;
  const SY = 0.5 * s;
  const ruhe = mmArmRuhe(L1, L2, SY, h);

  // Sockel: Fußplatte mit Schrauben, dunkle Trommel mit orangem Ring
  mmZ(g, 0.44 * s, 0.05 * s, mmMat('dunkel'), 'y', 0, 0.025 * s, 0, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    mmZ(g, 0.02 * s, 0.03 * s, mmMat('stahl'), 'y', Math.cos(a) * 0.39 * s, 0.065 * s, Math.sin(a) * 0.39 * s, 6);
  }
  mmZ(g, 0.36 * s, 0.2 * s, mmMat('schwarz'), 'y', 0, 0.15 * s, 0, 24, 0.31 * s);
  mmZ(g, 0.325 * s, 0.05 * s, kappe, 'y', 0, 0.235 * s, 0, 24);
  mmQ(g, 0.08 * s, 0.12 * s, 0.16 * s, mmMat('dunkel'), -0.36 * s, 0.12 * s, 0); // Kabelkasten
  mmAnzeige(g, -0.405 * s, 0.14 * s, 0.04 * s, 'x', 0.022 * s);
  mmQ(g, 0.12 * s, 0.05 * s, 0.12 * s, mmMat('dunkel'), -0.31 * s, 0.025 * s, -0.31 * s); // Lasche für den Mast

  // Drehteller (Ursprung am Boden, damit schulter.position.y die Schulterhöhe ist)
  const dt = mmTeil(g, 'drehteller');
  mmZ(dt, 0.3 * s, 0.07 * s, glied, 'y', 0, 0.285 * s, 0, 24);
  mmQ(dt, 0.36 * s, 0.2 * s, 0.3 * s, glied, -0.1 * s, 0.42 * s, 0);
  mmZ(dt, 0.08 * s, 0.2 * s, gelenk, 'x', -0.3 * s, 0.42 * s, 0, 12); // Motor hinten
  mmZ(dt, 0.15 * s, 0.44 * s, gelenk, 'z', 0, SY, 0.03 * s, 16);
  for (const z of [-0.2, 0.26]) mmZ(dt, 0.12 * s, 0.02 * s, kappe, 'z', 0, SY, z * s, 16);

  // Oberarm: seitlich versetzt, damit der Unterarm daneben einklappen kann
  const sch = mmTeil(dt, 'schulter', 0, SY, 0);
  sch.userData.laenge = L1;
  sch.rotation.z = ruhe.schulter;
  mmQ(sch, 0.17 * s, L1 - 0.1 * s, 0.11 * s, glied, 0, L1 / 2, 0.14 * s);
  mmQ(sch, 0.12 * s, L1 * 0.5, 0.012 * s, dunkel ? kappe : mmMat('schwarz'), 0, L1 / 2, 0.2 * s); // Zierleiste

  // Unterarm
  const ell = mmTeil(sch, 'ellbogen', 0, L1, 0);
  ell.userData.laenge = L2;
  ell.rotation.z = ruhe.ellbogen;
  mmZ(ell, 0.11 * s, 0.42 * s, gelenk, 'z', 0, 0, 0.03 * s, 16);
  for (const z of [-0.19, 0.25]) mmZ(ell, 0.09 * s, 0.02 * s, kappe, 'z', 0, 0, z * s, 16);
  mmQ(ell, 0.12 * s, 0.12 * s, 0.12 * s, gelenk, 0, -0.09 * s, 0); // Gegengewicht
  mmQ(ell, 0.16 * s, 0.3 * s, 0.15 * s, glied, 0, 0.2 * s, 0);
  mmZ(ell, 0.075 * s, L2 - 0.3 * s, glied, 'y', 0, 0.15 * s + (L2 - 0.3 * s) / 2, 0, 12, 0.06 * s);
  if (dunkel) mmQ(ell, 0.1 * s, L2 * 0.45, 0.01 * s, kappe, 0, L2 * 0.5, 0.075 * s);

  // Handgelenk; die Hand zeigt entlang +x
  const hg = mmTeil(ell, 'handgelenk', 0, L2, 0);
  hg.rotation.z = ruhe.handgelenk;
  mmZ(hg, 0.07 * s, 0.2 * s, gelenk, 'z', 0, 0, 0, 12);
  for (const z of [-0.105, 0.105]) mmZ(hg, 0.055 * s, 0.015 * s, kappe, 'z', 0, 0, z * s, 12);
  mmZ(hg, 0.05 * s, 0.08 * s, glied, 'x', 0.07 * s, 0, 0, 10);
  mmZ(hg, 0.055 * s, 0.03 * s, gelenk, 'x', 0.125 * s, 0, 0, 12);
  mmQ(hg, 0.04 * s, 0.1 * s, 0.28 * s, mmMat('dunkel'), 0.16 * s, 0, 0);
  mmPunkt(hg, 'ladepunkt', 0.3 * s, 0, 0);
  // Greifer: +y des Greifers = +x der Hand; Kinder sind nur die beiden Finger
  const gr = mmTeil(hg, 'greifer', 0.18 * s, 0, 0);
  gr.rotation.z = -Math.PI / 2;
  const fingerGeo = new THREE.BoxGeometry(0.08 * s, 0.15 * s, 0.03 * s);
  fingerGeo.translate(0, 0.075 * s, 0);
  for (const [name, z] of [['finger1', -0.11], ['finger2', 0.11]]) {
    const f = mmNetz(gr, fingerGeo, mmMat('stahl'), 0, 0, z * s);
    f.name = name;
  }

  // Mast mit Bake, fest auf dem Sockel
  const bm = mmTeil(g, 'bakeMast', -0.31 * s, 0, -0.31 * s);
  mmZ(bm, 0.022 * s, 1.95 * s, mmMat('schwarz'), 'y', 0, 1.025 * s, 0, 8);
  mmQ(bm, 0.07 * s, 0.1 * s, 0.07 * s, mmMat('dunkel'), 0, 0.1 * s, 0);
  mmQ(bm, 0.1 * s, 0.07 * s, 0.07 * s, kappe, 0.03 * s, 1.92 * s, 0);
  mmZ(bm, 0.034 * s, 0.03 * s, mmMat('dunkel'), 'y', 0, 2.0 * s, 0, 10);
  const bake = mmZ(bm, 0.03 * s, 0.06 * s, mmLeucht('bake'), 'y', 0, 2.045 * s, 0, 10, 0.02 * s);
  bake.name = 'bake';

  g.userData.leitung = [-0.31 * s, 1.84 * s, -0.31 * s];
  g.userData.arm = { reichweite: 2.6 * s, schulterY: SY, oberarm: L1, unterarm: L2, hand: 0.3 * s, ruhe };
  return g;
}

/* ------------------------------------------------------------ Bandstücke */

/** Bandfläche aus einem Umriss [[x, z], …] mit Schienen entlang der Züge. */
function mmBandflaeche(g, umriss, schienenZuege) {
  const form = new THREE.Shape(umriss.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(form, { depth: 0.06, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  mmNetz(g, geo, mmMat('gummi'), 0, MM_BAND_Y - 0.06, 0);
  const m = mmMat('schiene');
  for (const zug of schienenZuege) {
    for (let i = 1; i < zug.length; i++) {
      const [x0, z0] = zug[i - 1];
      const [x1, z1] = zug[i];
      const r = mmQ(g, Math.hypot(x1 - x0, z1 - z0) + 0.035, 0.09, 0.035, m, (x0 + x1) / 2, MM_BAND_Y + 0.005, (z0 + z1) / 2);
      r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
  }
}

function mmBandGestell(g) {
  mmQ(g, 1.0, 0.08, 1.0, mmMat('dunkel'), 0, 0.43, 0);
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    mmQ(g, 0.06, 0.43, 0.06, mmMat('stahlDunkel'), x, 0.215, z);
    mmQ(g, 0.14, 0.02, 0.14, mmMat('dunkel'), x, 0.01, z);
  }
  for (const z of [-0.45, 0.45]) mmStab(g, [-0.42, 0.06, z], [0.42, 0.38, z], 0.014, mmMat('stahlDunkel'));
}

function mmWeiche() {
  const g = new THREE.Group();
  mmBandGestell(g);
  const aussen = [[-0.6, -0.3], [-0.2, -0.3], [0.15, -0.6], [0.6, -0.6]];
  const innen = [[0.6, -0.1], [0.3, -0.1], [0.2, 0], [0.3, 0.1], [0.6, 0.1]];
  const umriss = [...aussen, ...innen, ...aussen.map(([x, z]) => [x, -z]).reverse()];
  mmBandflaeche(g, umriss, [aussen, aussen.map(([x, z]) => [x, -z]), innen]);
  mmZ(g, 0.035, 0.1, mmMat('schiene'), 'y', 0.2, MM_BAND_Y + 0.01, 0, 10);
  // Lenkklappe (dreht um y) mit Stellantrieb darunter
  const k = mmTeil(g, 'klappe', -0.12, MM_BAND_Y, 0);
  mmQ(k, 0.42, 0.07, 0.02, mmMat('gelb'), 0.21, 0.035, 0);
  mmZ(k, 0.022, 0.1, mmMat('stahlDunkel'), 'y', 0, 0.04, 0, 8);
  mmQ(g, 0.12, 0.1, 0.1, mmMat('dunkel'), -0.12, 0.4, 0);
  return g;
}

function mmVereiniger() {
  const g = new THREE.Group();
  mmBandGestell(g);
  const aussen = [[0.6, -0.3], [0.2, -0.3], [-0.15, -0.6], [-0.6, -0.6]];
  const innen = [[-0.6, -0.1], [-0.3, -0.1], [-0.2, 0], [-0.3, 0.1], [-0.6, 0.1]];
  const umriss = [...aussen, ...innen, ...aussen.map(([x, z]) => [x, -z]).reverse()].reverse();
  mmBandflaeche(g, umriss, [aussen, aussen.map(([x, z]) => [x, -z]), innen]);
  mmZ(g, 0.035, 0.1, mmMat('schiene'), 'y', -0.2, MM_BAND_Y + 0.01, 0, 10);
  for (const s of [-1, 1]) mmBrett(g, [-0.2, MM_BAND_Y + 0.03, 0], [0.05, MM_BAND_Y + 0.03, s * 0.12], 0.06, 0.02, mmMat('gelb'));
  return g;
}

/* ------------------------------------------------------------ Automatisierung */

/** Kolbenrechen: kolben (Stangen) und kamm fahren je bis 0,55 m nach +x, der Kamm kippt um z. */
function mmRechen() {
  const g = new THREE.Group();
  for (const z of [-0.62, 0.62]) mmQ(g, 1.0, 0.08, 0.08, mmMat('dunkel'), 0, 0.04, z);
  for (const x of [-0.42, 0.05]) mmQ(g, 0.08, 0.06, 1.16, mmMat('dunkel'), x, 0.04, 0);
  // Zylinderbock hinten mit Warnstreifen, Hydraulikaggregat obendrauf
  mmQ(g, 0.2, 0.4, 1.3, mmMat('stahlDunkel'), -0.38, 0.28, 0);
  mmWarnstreifen(g, 1.3, 0.06, 0.01, -0.276, 0.43, 0, 'z', 10);
  mmQ(g, 0.26, 0.26, 0.4, mmMat('weiss'), -0.38, 0.61, -0.35);
  mmZ(g, 0.08, 0.26, mmMat('blau'), 'z', -0.38, 0.82, -0.35, 12);
  mmAnzeige(g, -0.245, 0.66, -0.25, 'x');
  mmZ(g, 0.07, 0.3, mmMat('schwarz'), 'x', -0.38, 0.55, 0.3, 10); // Öltank
  const leitung = mmIsolator(g, -0.44, 0.74, -0.2);
  const zs = [-0.45, 0, 0.45];
  for (const z of zs) {
    // graue Zylinder (lang genug für 0,55 m Hub) mit dunklen Kappen
    mmZ(g, 0.065, 0.65, mmMat('stahl'), 'x', -0.125, 0.32, z, 14);
    mmZ(g, 0.075, 0.05, mmMat('stahlDunkel'), 'x', 0.175, 0.32, z, 14);
    mmQ(g, 0.06, 0.24, 0.1, mmMat('dunkel'), 0.12, 0.2, z);
    mmStab(g, [-0.32, 0.62, -0.25], [-0.26, 0.38, z], 0.012, mmMat('gummi'));
  }
  const kol = mmTeil(g, 'kolben');
  for (const z of zs) {
    mmZ(kol, 0.03, 0.74, mmMat('chrom'), 'x', -0.03, 0.32, z, 10);
    mmQ(kol, 0.06, 0.08, 0.08, mmMat('stahlDunkel'), 0.34, 0.32, z);
  }
  // Kamm (Geschwister des Kolbens, Drehpunkt im gelben Balken)
  const kamm = mmTeil(g, 'kamm', 0.38, 0.32, 0);
  mmQ(kamm, 0.08, 0.08, 1.36, mmMat('gelb'), 0, 0, 0);
  mmQ(kamm, 0.02, 0.22, 1.3, mmMat('stahlDunkel'), 0.05, -0.1, 0);
  for (let i = 0; i < 12; i++) {
    const z = -0.6 + i * (1.2 / 11);
    mmStab(kamm, [0.05, -0.02, z], [0.12, -0.3, z], 0.013, mmMat('stahl'), 5);
  }
  g.userData.leitung = leitung;
  return g;
}

function mmDrohnenstation() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) mmQ(g, 0.1, 0.05, 0.1, mmMat('dunkel'), x, 0.025, z);
  mmQ(g, 1.16, 0.12, 1.16, mmMat('dunkel'), 0, 0.11, 0);
  mmQ(g, 1.06, 0.02, 1.06, mmMat('hellgrau'), 0, 0.18, 0);
  for (const s of [-1, 1]) {
    mmWarnstreifen(g, 1.16, 0.03, 0.05, 0, 0.175, s * 0.555, 'x', 12);
    mmWarnstreifen(g, 1.06, 0.03, 0.05, s * 0.555, 0.175, 0, 'z', 11);
  }
  const ring = new THREE.RingGeometry(0.36, 0.41, 32);
  ring.rotateX(-Math.PI / 2);
  mmNetz(g, ring, mmMat('markierung'), 0, 0.192, 0);
  for (const s of [-1, 1]) mmQ(g, 0.08, 0.006, 0.44, mmMat('gelb'), s * 0.13, 0.193, 0);
  mmQ(g, 0.18, 0.006, 0.08, mmMat('gelb'), 0, 0.193, 0);
  for (const [x, z] of [[-0.49, -0.49], [-0.49, 0.49], [0.49, 0.49]]) mmZ(g, 0.025, 0.03, mmMat('padLicht'), 'y', x, 0.205, z, 8);
  // Ladesäule mit Lampe
  mmQ(g, 0.1, 0.26, 0.1, mmMat('hellgrau'), 0.45, 0.32, -0.45);
  mmQ(g, 0.02, 0.08, 0.05, mmMat('kupfer'), 0.39, 0.34, -0.45);
  const lampe = mmZ(g, 0.03, 0.05, mmLeucht('gruen'), 'y', 0.45, 0.475, -0.45, 10);
  lampe.name = 'lampe';
  return g;
}

/* ------------------------------------------------------------ Strom */

function mmGenerator() {
  const g = new THREE.Group();
  mmQ(g, 1.5, 0.1, 1.1, mmMat('dunkel'), 0.03, 0.05, 0);
  for (const s of [-1, 1]) mmWarnstreifen(g, 1.5, 0.06, 0.012, 0.03, 0.05, s * 0.556, 'x', 10);
  // Kessel und Brennkammer: weiß-grauer Kasten
  mmQ(g, 1.1, 1.05, 1.0, mmMat('weiss'), 0.2, 0.625, 0);
  for (const x of [-0.35, 0.75]) for (const z of [-0.5, 0.5]) mmQ(g, 0.05, 1.05, 0.05, mmMat('hellgrau'), x, 0.625, z);
  mmQ(g, 1.14, 0.05, 1.04, mmMat('hellgrau'), 0.2, 1.175, 0);
  for (const z of [-0.505, 0.505]) for (let i = 0; i < 5; i++) mmQ(g, 0.42, 0.025, 0.02, mmMat('dunkel'), 0.05, 0.3 + i * 0.07, z);
  // Feuertür vorn (+x): Rahmen um ein Sichtfenster, dahinter die Flammen
  const tuer = mmMat('hellgrau');
  mmQ(g, 0.03, 0.215, 0.6, tuer, 0.765, 0.3525, 0);
  mmQ(g, 0.03, 0.095, 0.6, tuer, 0.765, 0.7475, 0);
  for (const s of [-1, 1]) mmQ(g, 0.03, 0.24, 0.12, tuer, 0.765, 0.58, s * 0.24);
  mmQ(g, 0.01, 0.24, 0.36, mmMat('schwarz'), 0.752, 0.58, 0);
  const feuer = mmNetz(g, mmFlammenGeo(), mmLeucht('feuer'), 0.766, 0.465, 0);
  feuer.name = 'feuer';
  for (const z of [-0.09, 0, 0.09]) mmQ(g, 0.015, 0.24, 0.018, mmMat('dunkel'), 0.786, 0.58, z);
  mmQ(g, 0.04, 0.03, 0.14, mmMat('stahl'), 0.8, 0.38, 0.17);
  for (const y of [0.35, 0.69]) mmZ(g, 0.02, 0.08, mmMat('dunkel'), 'y', 0.785, y, -0.31, 6);
  // Kesseltrommel oben mit Manometer
  mmZ(g, 0.17, 0.72, mmMat('hellgrau'), 'x', 0.18, 1.39, 0.16, 16);
  for (const x of [-0.18, 0.54]) mmZ(g, 0.175, 0.03, mmMat('dunkel'), 'x', x, 1.39, 0.16, 16);
  for (const x of [0.0, 0.36]) mmQ(g, 0.08, 0.1, 0.26, mmMat('dunkel'), x, 1.25, 0.16);
  mmZ(g, 0.055, 0.015, mmMat('schwarz'), 'z', 0.3, 1.39, 0.335, 14);
  mmZ(g, 0.046, 0.01, mmMat('weiss'), 'z', 0.3, 1.39, 0.345, 14);
  // Schornstein
  mmZ(g, 0.12, 0.03, mmMat('dunkel'), 'y', 0.55, 1.215, -0.28, 12);
  mmZ(g, 0.085, 0.46, mmMat('stahlDunkel'), 'y', 0.55, 1.43, -0.28, 12);
  mmZ(g, 0.11, 0.04, mmMat('schwarz'), 'y', 0.55, 1.68, -0.28, 12);
  mmPunkt(g, 'rauchPunkt', 0.55, 1.72, -0.28);
  // Anzeige, Knöpfe und Blitzschild an der Seite (+z)
  mmQ(g, 0.3, 0.22, 0.04, mmMat('dunkel'), 0.42, 0.86, 0.52);
  const anzeige = mmQ(g, 0.24, 0.13, 0.01, mmLeucht('anzeige'), 0.42, 0.88, 0.545);
  anzeige.name = 'anzeige';
  mmZ(g, 0.018, 0.015, mmMat('rot'), 'z', 0.36, 0.785, 0.545, 8);
  mmZ(g, 0.018, 0.015, mmMat('gruenHell'), 'z', 0.42, 0.785, 0.545, 8);
  mmQ(g, 0.2, 0.26, 0.01, mmMat('schwarz'), 0.02, 0.62, 0.505);
  const blitz = new THREE.Shape([[0.02, 0.11], [-0.05, -0.01], [-0.005, -0.01], [-0.03, -0.11], [0.05, 0.02], [0.005, 0.02], [0.03, 0.11]].map(([x, y]) => new THREE.Vector2(x, y)));
  mmNetz(g, new THREE.ExtrudeGeometry(blitz, { depth: 0.008, bevelEnabled: false }), mmMat('gelb'), 0.02, 0.62, 0.51);
  // Einfülltrichter hinten (−x) auf Bandhöhe, darin der Heuvorrat
  mmTrichter(g, 0.22, 0.1, 0.3, mmMat('hellgrau', true), -0.57, 0.53, 0);
  mmQ(g, 0.25, 0.14, 0.2, mmMat('dunkel'), -0.45, 0.2, 0);
  for (const z of [-0.15, 0.15]) mmStab(g, [-0.72, 0.1, z], [-0.7, 0.42, z * 1.3], 0.015, mmMat('dunkel'));
  const vorratGeo = new THREE.CylinderGeometry(0.02, 0.17, 0.2, 8);
  vorratGeo.translate(0, 0.1, 0); // Drehpunkt unten: wächst beim Skalieren nach oben
  const fuellung = mmNetz(g, vorratGeo, mmMat('heu'), -0.57, 0.28, 0);
  fuellung.name = 'heufuellung';
  g.userData.leitung = mmIsolator(g, 0.65, 1.2, 0.38);
  return g;
}

function mmMast() {
  const g = new THREE.Group();
  mmZ(g, 0.14, 0.12, mmMat('beton'), 'y', 0, 0.06, 0, 10);
  mmZ(g, 0.065, 4.38, mmMat('mast'), 'y', 0, 2.31, 0, 10, 0.05);
  mmQ(g, 0.07, 0.07, 0.62, mmMat('mast'), 0, 4.3, 0);
  for (const s of [-1, 1]) mmStab(g, [0, 4.0, 0], [0, 4.27, s * 0.25], 0.012, mmMat('mast'));
  for (const s of [-1, 1]) mmIsolator(g, 0, 4.335, s * 0.27);
  mmIsolator(g, 0, 4.5, 0);
  // Schaltkasten: hier schaltet man das ganze Netz
  mmQ(g, 0.1, 0.18, 0.12, mmMat('hellgrau'), 0.1, 1.25, 0);
  mmStab(g, [0.07, 1.34, 0], [0.05, 4.2, 0], 0.008, mmMat('schwarz'));
  const hebel = mmTeil(g, 'hebel', 0.152, 1.22, -0.02);
  mmQ(hebel, 0.06, 0.018, 0.018, mmMat('stahlDunkel'), 0.03, 0, 0);
  mmKugel(hebel, 0.016, mmMat('rot'), 0.065, 0, 0, 8);
  const lampe = mmZ(g, 0.018, 0.02, mmLeucht('gruen'), 'x', 0.155, 1.3, 0.035, 10);
  lampe.name = 'lampe';
  g.userData.leitung = [0, 4.3, 0]; // wie MAST_OBEN in versorgung.js
  return g;
}

/* ------------------------------------------------------------ Suche */

function mmScanner() {
  const g = new THREE.Group();
  mmQ(g, 1.3, 0.08, 1.1, mmMat('dunkel'), 0, 0.04, 0);
  for (const s of [-1, 1]) mmWarnstreifen(g, 1.3, 0.05, 0.012, 0, 0.05, s * 0.556, 'x', 10);
  mmQ(g, 1.4, 0.41, 0.5, mmMat('dunkel'), 0, 0.285, 0);
  mmBandstueck(g, -0.7, 0.7);
  // Gehäuse als Tor über dem Band
  for (const s of [-1, 1]) {
    mmQ(g, 0.9, 1.0, 0.2, mmMat('weiss'), 0, 0.58, s * 0.45);
    mmQ(g, 0.6, 0.55, 0.01, mmMat('hellgrau'), 0, 0.6, s * 0.556);
    for (const x of [-0.45, 0.45]) mmQ(g, 0.05, 1.04, 0.05, mmMat('dunkel'), x, 0.6, s * 0.55);
    mmQ(g, 0.94, 0.05, 0.05, mmMat('dunkel'), 0, 1.1, s * 0.55);
    mmQ(g, 0.05, 0.05, 1.14, mmMat('dunkel'), s * 0.45, 1.1, 0);
    for (let i = 0; i < 6; i++) mmQ(g, 0.01, 0.27, 0.1, mmMat('gummi'), s * 0.455, 0.765, -0.28 + i * 0.112); // Gummivorhang
  }
  mmQ(g, 0.9, 0.2, 1.1, mmMat('weiss'), 0, 1.0, 0);
  mmQ(g, 0.22, 0.16, 0.02, mmMat('dunkel'), 0.22, 0.75, 0.562);
  mmQ(g, 0.12, 0.07, 0.01, mmMat('glas'), 0.2, 0.77, 0.575);
  mmAnzeige(g, 0.3, 0.77, 0.575, 'z', 0.018);
  // schräge schwarze Trommel mit gelbem Ring, dreht um ihre x-Achse
  mmQ(g, 0.3, 0.06, 0.4, mmMat('dunkel'), -0.12, 1.13, 0);
  const halter = mmTeil(g, null, -0.12, 1.16, 0);
  halter.rotation.z = 0.95;
  const tr = mmTeil(halter, 'trommel');
  mmZ(tr, 0.16, 0.3, mmMat('schwarz'), 'x', 0.15, 0, 0, 16);
  mmZ(tr, 0.172, 0.05, mmMat('gelb'), 'x', 0.19, 0, 0, 16);
  mmZ(tr, 0.12, 0.02, mmMat('glas'), 'x', 0.305, 0, 0, 16);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mmQ(tr, 0.12, 0.03, 0.03, mmMat('stahlDunkel'), 0.08, Math.cos(a) * 0.162, Math.sin(a) * 0.162);
  }
  // Lampe auf dem Dach: gelb, wenn eine Nadel wartet
  mmZ(g, 0.012, 0.08, mmMat('dunkel'), 'y', 0.33, 1.14, 0.42, 6);
  const lampe = mmZ(g, 0.03, 0.05, mmLeucht('gruen'), 'y', 0.33, 1.205, 0.42, 10);
  lampe.name = 'lampe';
  g.userData.leitung = mmIsolator(g, 0.3, 1.1, -0.42);
  return g;
}

function mmRadar() {
  const g = new THREE.Group();
  mmQ(g, 0.84, 0.06, 0.84, mmMat('dunkel'), 0, 0.03, 0);
  mmQ(g, 0.6, 0.7, 0.55, mmMat('hellgrau'), -0.05, 0.41, 0);
  mmQ(g, 0.012, 0.6, 0.012, mmMat('dunkel'), 0.251, 0.41, 0);
  mmQ(g, 0.02, 0.1, 0.03, mmMat('stahl'), 0.26, 0.45, 0.06);
  for (let i = 0; i < 4; i++) mmQ(g, 0.3, 0.02, 0.01, mmMat('dunkel'), -0.1, 0.2 + i * 0.05, 0.276);
  mmZ(g, 0.05, 0.74, mmMat('stahl'), 'y', 0, 1.13, 0, 10);
  mmZ(g, 0.1, 0.03, mmMat('dunkel'), 'y', 0, 0.775, 0, 12);
  mmZ(g, 0.085, 0.1, mmMat('dunkel'), 'y', 0, 1.55, 0, 12);
  const sc = mmTeil(g, 'schuessel', 0, 1.6, 0);
  mmZ(sc, 0.09, 0.03, mmMat('schwarz'), 'y', 0, 0.015, 0, 12);
  mmZ(sc, 0.025, 0.1, mmMat('dunkel'), 'y', 0, 0.06, 0, 8);
  mmQ(sc, 0.08, 0.08, 0.1, mmMat('dunkel'), 0, 0.12, 0);
  const halter = mmTeil(sc, null, 0.04, 0.18, 0);
  halter.rotation.z = -1.134; // Schüssel blickt nach vorn und 25° nach oben
  const profil = [];
  for (let i = 0; i <= 6; i++) {
    const r = (i / 6) * 0.36;
    profil.push(new THREE.Vector2(Math.max(r, 0.001), 0.12 * (r / 0.36) ** 2));
  }
  mmNetz(halter, new THREE.LatheGeometry(profil, 20), mmMat('weiss', true), 0, 0, 0);
  mmTorus(halter, 0.36, 0.012, mmMat('hellgrau'), 'y', 0, 0.12, 0, 24, 4);
  mmZ(halter, 0.05, 0.06, mmMat('dunkel'), 'y', 0, -0.03, 0, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mmStab(halter, [Math.cos(a) * 0.3, 0.085, Math.sin(a) * 0.3], [0, 0.3, 0], 0.006, mmMat('dunkel'), 4);
  }
  mmQ(halter, 0.05, 0.05, 0.05, mmMat('dunkel'), 0, 0.3, 0);
  mmAnzeige(g, -0.25, 0.78, 0.18);
  g.userData.leitung = mmIsolator(g, -0.25, 0.76, -0.18);
  return g;
}

/* ------------------------------------------------------------ Verarbeitung */

function mmSilo() {
  const g = new THREE.Group();
  // Beine mit Kreuzverband an den Seiten
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      mmQ(g, 0.08, 1.35, 0.08, mmMat('stahlDunkel'), sx * 0.44, 0.675, sz * 0.44);
      mmQ(g, 0.16, 0.02, 0.16, mmMat('dunkel'), sx * 0.44, 0.01, sz * 0.44);
    }
    mmStab(g, [-0.44, 0.15, sx * 0.44], [0.44, 1.2, sx * 0.44], 0.018, mmMat('stahlDunkel'));
    mmStab(g, [0.44, 0.15, sx * 0.44], [-0.44, 1.2, sx * 0.44], 0.018, mmMat('stahlDunkel'));
  }
  // Auslaufkegel, Zylinder mit Ringen, Kegeldach
  mmZ(g, 0.12, 0.5, mmMat('blech'), 'y', 0, 1.1, 0, 20, 0.66);
  mmZ(g, 0.12, 0.12, mmMat('stahlDunkel'), 'y', 0, 0.79, 0, 12);
  mmQ(g, 0.3, 0.03, 0.08, mmMat('dunkel'), 0.05, 0.75, 0);
  mmZ(g, 0.66, 2.45, mmMat('blech'), 'y', 0, 2.575, 0, 24);
  for (const y of [1.6, 2.1, 2.6, 3.1, 3.6]) mmZ(g, 0.675, 0.04, mmMat('stahl'), 'y', 0, y, 0, 24);
  mmZ(g, 0.7, 0.32, mmMat('blech'), 'y', 0, 3.96, 0, 24, 0.1);
  mmZ(g, 0.1, 0.05, mmMat('stahlDunkel'), 'y', 0, 4.145, 0, 12);
  mmZ(g, 0.13, 0.03, mmMat('stahlDunkel'), 'y', 0, 4.185, 0, 12);
  // Leiter auf der Seite (+z)
  for (const x of [-0.15, 0.15]) {
    mmQ(g, 0.03, 2.75, 0.03, mmMat('stahlDunkel'), x, 2.575, 0.72);
    for (const y of [1.5, 2.6, 3.7]) mmQ(g, 0.02, 0.02, 0.07, mmMat('dunkel'), x, y, 0.685);
  }
  for (let y = 1.35; y < 3.95; y += 0.3) mmZ(g, 0.012, 0.3, mmMat('stahl'), 'x', 0, y, 0.72, 6);
  // Einlauf: Trichter auf Bandhöhe, Becherwerk hoch aufs Dach
  mmTrichter(g, 0.2, 0.09, 0.26, mmMat('hellgrau', true), -0.63, 0.53, 0);
  mmStab(g, [-0.63, 0.28, 0], [-0.74, 0.24, -0.3], 0.06, mmMat('hellgrau'));
  mmQ(g, 0.2, 0.3, 0.2, mmMat('hellgrau'), -0.76, 0.2, -0.36);
  mmQ(g, 0.14, 3.6, 0.14, mmMat('hellgrau'), -0.76, 2.15, -0.36);
  mmQ(g, 0.24, 0.22, 0.2, mmMat('hellgrau'), -0.72, 4.04, -0.36);
  mmZ(g, 0.06, 0.18, mmMat('blau'), 'z', -0.72, 4.04, -0.52, 12);
  mmStab(g, [-0.62, 4.0, -0.3], [-0.3, 3.9, -0.15], 0.05, mmMat('hellgrau'));
  for (const y of [2.0, 3.2]) mmQ(g, 0.16, 0.03, 0.04, mmMat('dunkel'), -0.62, y, -0.36);
  // Auslaufrutsche nach vorn (+x)
  mmRutsche(g, [0.08, 0.72, 0], [0.84, 0.58, 0], 0.34, 0.08, mmMat('stahl'));
  // Schaltkasten an einem Bein
  mmQ(g, 0.2, 0.26, 0.1, mmMat('dunkel'), 0.44, 1.0, -0.52);
  mmAnzeige(g, 0.5, 1.05, -0.575, 'z', 0.02);
  g.userData.leitung = mmIsolator(g, 0.44, 1.13, -0.52);
  return g;
}

/** Kompressor: senkrechte Ballenpresse über dem durchlaufenden Tisch; stempel fährt bis 0,3 m nach unten. */
function mmPresse() {
  const g = new THREE.Group();
  mmQ(g, 1.9, 0.1, 1.2, mmMat('dunkel'), 0, 0.05, 0);
  // Tisch auf Bandhöhe, von −x nach +x durch die Presse
  mmQ(g, 2.0, 0.04, 0.62, mmMat('stahl'), 0, 0.53, 0);
  mmQ(g, 0.9, 0.41, 1.1, mmMat('gruen'), 0, 0.305, 0);
  for (const x of [-0.72, 0.72]) mmQ(g, 0.5, 0.41, 0.5, mmMat('dunkel'), x, 0.305, 0);
  for (const s of [-1, 1]) mmQ(g, 0.55, 0.14, 0.03, mmMat('gruen'), -0.72, 0.62, s * 0.31);
  // Pressrahmen: vier Säulen, Gitterstäbe an den Seiten, Kopfstück mit Zylinder
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mmQ(g, 0.1, 0.72, 0.1, mmMat('gruen'), sx * 0.4, 0.89, sz * 0.45);
  for (const sz of [-1, 1]) {
    for (const x of [-0.2, 0, 0.2]) mmQ(g, 0.025, 0.66, 0.025, mmMat('stahlDunkel'), x, 0.88, sz * 0.45);
    mmQ(g, 0.9, 0.06, 0.06, mmMat('gruen'), 0, 0.58, sz * 0.45);
  }
  mmQ(g, 1.0, 0.17, 1.1, mmMat('gruen'), 0, 1.335, 0);
  mmQ(g, 1.02, 0.03, 1.12, mmMat('schwarz'), 0, 1.25, 0);
  for (const [x, z] of [[-0.44, -0.5], [0.44, -0.5], [-0.44, 0.5], [0.44, 0.5]]) mmQ(g, 0.1, 0.06, 0.1, mmMat('gruenHell'), x, 1.44, z);
  mmZ(g, 0.13, 0.18, mmMat('stahlDunkel'), 'y', 0, 1.51, 0, 16);
  mmZ(g, 0.07, 0.03, mmMat('schwarz'), 'z', 0.3, 1.335, 0.555, 14);
  mmZ(g, 0.058, 0.01, mmMat('weiss'), 'z', 0.3, 1.335, 0.572, 14);
  mmQ(g, 0.006, 0.045, 0.006, mmMat('rot'), 0.312, 1.35, 0.58).rotation.z = -0.6;
  // Heu in der Kammer
  mmQ(g, 0.66, 0.2, 0.56, mmMat('heu'), 0, 0.65, 0);
  const st = mmTeil(g, 'stempel', 0, 1.12, 0);
  mmQ(st, 0.7, 0.08, 0.62, mmMat('gelb'), 0, -0.04, 0);
  for (const s of [-1, 1]) mmWarnstreifen(st, 0.7, 0.05, 0.01, 0, -0.04, s * 0.315, 'x', 8);
  mmZ(st, 0.05, 0.45, mmMat('chrom'), 'y', 0, 0.225, 0, 10);
  // Schaltkasten und Hydraulikpumpe
  mmQ(g, 0.05, 0.75, 0.05, mmMat('stahlDunkel'), -0.62, 0.475, -0.52);
  mmQ(g, 0.22, 0.26, 0.1, mmMat('dunkel'), -0.62, 0.95, -0.52);
  mmAnzeige(g, -0.62, 1.02, -0.465, 'z');
  mmZ(g, 0.1, 0.3, mmMat('blau'), 'x', 0.62, 0.2, -0.47, 12);
  g.userData.leitung = mmIsolator(g, 0.35, 1.42, -0.4);
  return g;
}

function mmPellet() {
  const g = new THREE.Group();
  mmQ(g, 1.4, 0.08, 1.3, mmMat('dunkel'), 0.05, 0.04, 0);
  // Getriebe, Säule zum Teller, Motor
  mmQ(g, 0.5, 0.42, 0.5, mmMat('rot'), 0.08, 0.29, 0);
  mmQ(g, 0.52, 0.04, 0.52, mmMat('stahlDunkel'), 0.08, 0.5, 0);
  mmStab(g, [0.08, 0.5, 0], [0.05, 0.86, 0], 0.07, mmMat('stahlDunkel'), 10);
  mmZ(g, 0.1, 0.26, mmMat('blau'), 'z', 0.08, 0.3, -0.38, 12);
  mmAnzeige(g, 0.335, 0.4, 0.15, 'x', 0.022);
  // Pelletierteller, schräg nach vorn geneigt; dreht sich um seine y-Achse
  const halter = mmTeil(g, null, 0.12, 0.92, 0);
  halter.rotation.z = -0.8;
  const sch = mmTeil(halter, 'scheibe');
  mmZ(sch, 0.6, 0.04, mmMat('stahlDunkel'), 'y', 0, 0, 0, 24);
  mmZ(sch, 0.6, 0.16, mmMat('rot', true), 'y', 0, 0.1, 0, 24, 0.6, true);
  mmZ(sch, 0.615, 0.025, mmMat('stahl', true), 'y', 0, 0.18, 0, 24, 0.615, true);
  mmZ(sch, 0.5, 0.012, mmMat('pellets'), 'y', 0, 0.026, 0, 20);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = mmQ(sch, 0.44, 0.03, 0.035, mmMat('stahl'), Math.cos(a) * 0.33, 0.035, Math.sin(a) * 0.33);
    r.rotation.y = -a;
  }
  mmZ(sch, 0.09, 0.07, mmMat('dunkel'), 'y', 0, 0.035, 0, 12);
  // Wurfschurre vorn (+x)
  mmRutsche(g, [0.56, 0.6, 0], [0.79, 0.74, 0], 0.3, 0.08, mmMat('stahl'));
  // Einlauf hinten (−x) mit Förderrohr über den Tellerrand
  mmTrichter(g, 0.19, 0.08, 0.24, mmMat('hellgrau', true), -0.61, 0.53, 0);
  mmStab(g, [-0.61, 0.3, 0], [-0.58, 1.54, 0], 0.05, mmMat('stahlDunkel'), 10);
  mmKugel(g, 0.055, mmMat('stahlDunkel'), -0.58, 1.54, 0, 8);
  mmStab(g, [-0.58, 1.54, 0], [0.0, 1.54, 0], 0.045, mmMat('stahlDunkel'), 10);
  mmStab(g, [0.0, 1.54, 0], [0.05, 1.34, 0], 0.04, mmMat('stahlDunkel'), 10);
  mmQ(g, 0.12, 0.12, 0.14, mmMat('blau'), -0.61, 1.5, 0.12);
  g.userData.leitung = mmIsolator(g, 0.25, 0.52, 0.18);
  return g;
}

function mmWickler() {
  const g = new THREE.Group();
  // Rollenbahn auf Bandhöhe
  for (const s of [-1, 1]) mmQ(g, 2.0, 0.07, 0.05, mmMat('stahlDunkel'), 0, 0.5, s * 0.33);
  for (let i = 0; i < 10; i++) mmZ(g, 0.04, 0.62, mmMat('stahl'), 'z', -0.9 + i * 0.2, 0.51, 0, 10);
  for (const x of [-0.92, 0.92]) for (const s of [-1, 1]) mmQ(g, 0.05, 0.465, 0.05, mmMat('stahlDunkel'), x, 0.2325, s * 0.33);
  // gelbes Portal
  for (const s of [-1, 1]) {
    mmQ(g, 0.12, 1.68, 0.12, mmMat('senf'), 0, 0.84, s * 0.72);
    mmQ(g, 0.5, 0.05, 0.16, mmMat('senf'), 0, 0.025, s * 0.72);
    for (const sx of [-1, 1]) mmStab(g, [sx * 0.22, 0.05, s * 0.72], [0, 0.5, s * 0.72], 0.025, mmMat('senf'));
  }
  mmQ(g, 0.16, 0.12, 1.6, mmMat('senf'), 0, 1.74, 0);
  mmQ(g, 0.08, 0.14, 0.1, mmMat('dunkel'), 0, 1.61, 0);
  mmZ(g, 0.04, 0.06, mmMat('schwarz'), 'x', 0, 1.53, 0, 10);
  mmQ(g, 0.16, 0.24, 0.1, mmMat('dunkel'), 0.14, 1.1, -0.72);
  mmQ(g, 0.1, 0.07, 0.01, mmMat('glas'), 0.12, 1.15, -0.667);
  mmAnzeige(g, 0.19, 1.04, -0.667, 'z', 0.018);
  // Wickelring mit Folienrolle und Gegengewicht; dreht um x
  const ring = mmTeil(g, 'ring', 0, 0.85, 0);
  mmTorus(ring, 0.6, 0.04, mmMat('schwarz'), 'x', 0, 0, 0, 36, 6);
  mmQ(ring, 0.05, 0.14, 0.05, mmMat('dunkel'), 0, 0.66, 0);
  mmQ(ring, 0.3, 0.05, 0.05, mmMat('dunkel'), 0.15, 0.72, 0);
  mmZ(ring, 0.07, 0.36, mmMat('folie'), 'x', 0.3, 0.8, 0, 14);
  mmZ(ring, 0.03, 0.4, mmMat('dunkel'), 'x', 0.3, 0.8, 0, 8);
  mmQ(ring, 0.2, 0.08, 0.14, mmMat('dunkel'), 0.1, -0.66, 0);
  g.userData.leitung = mmIsolator(g, 0, 1.8, -0.6);
  return g;
}

function mmPulper() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.39, -0.39], [0.39, -0.39], [-0.39, 0.39], [0.39, 0.39]]) mmQ(g, 0.07, 0.4, 0.07, mmMat('stahl'), x, 0.2, z);
  // Edelstahlbottich, offen, darin der Heubrei
  mmZ(g, 0.6, 0.05, mmMat('edelstahl'), 'y', 0, 0.375, 0, 24);
  mmZ(g, 0.6, 0.9, mmMat('edelstahl', true), 'y', 0, 0.85, 0, 24, 0.6, true);
  for (const y of [0.62, 1.0]) mmZ(g, 0.61, 0.03, mmMat('stahl'), 'y', 0, y, 0, 24);
  mmTorus(g, 0.6, 0.022, mmMat('stahl'), 'y', 0, 1.3, 0, 32, 5);
  const brei = mmZ(g, 0.59, 0.02, mmMat('brei'), 'y', 0, 1.17, 0, 24);
  brei.name = 'fuellung';
  // Brücke mit Rührwerksmotor
  mmQ(g, 0.14, 0.1, 1.3, mmMat('stahlDunkel'), 0, 1.35, 0);
  mmQ(g, 0.22, 0.08, 0.22, mmMat('dunkel'), 0, 1.44, 0);
  mmZ(g, 0.1, 0.12, mmMat('rot'), 'y', 0, 1.54, 0, 14);
  mmAnzeige(g, 0.115, 1.44, 0, 'x', 0.02);
  const ruehrer = mmTeil(g, 'ruehrer', 0, 1.4, 0);
  mmZ(ruehrer, 0.03, 0.9, mmMat('stahl'), 'y', 0, -0.45, 0, 8);
  mmQ(ruehrer, 0.8, 0.03, 0.07, mmMat('stahl'), 0, -0.2, 0);
  mmQ(ruehrer, 0.07, 0.03, 0.5, mmMat('stahl'), 0, -0.2, 0);
  mmZ(ruehrer, 0.06, 0.06, mmMat('dunkel'), 'y', 0, -0.2, 0, 10);
  // Einlauf hinten (−x): Trichter und Schnecke über den Rand
  mmTrichter(g, 0.14, 0.07, 0.22, mmMat('hellgrau', true), -0.75, 0.53, 0);
  mmStab(g, [-0.75, 0.32, 0], [-0.72, 1.42, 0], 0.05, mmMat('stahlDunkel'), 10);
  mmKugel(g, 0.055, mmMat('stahlDunkel'), -0.72, 1.42, 0, 8);
  mmStab(g, [-0.72, 1.42, 0], [-0.45, 1.35, 0], 0.045, mmMat('stahlDunkel'), 10);
  mmZ(g, 0.07, 0.16, mmMat('blau'), 'y', -0.75, 1.52, 0, 12);
  // Auslauf vorn (+x): Pumpe und Rohr mit Tülle über dem Band
  mmQ(g, 0.22, 0.2, 0.2, mmMat('dunkel'), 0.62, 0.22, 0);
  mmStab(g, [0.4, 0.36, 0], [0.55, 0.26, 0], 0.04, mmMat('stahl'), 10);
  for (const [a, b] of [[[0.66, 0.3, 0], [0.66, 0.8, 0]], [[0.66, 0.8, 0], [0.84, 0.8, 0]], [[0.84, 0.8, 0], [0.84, 0.66, 0]]]) mmStab(g, a, b, 0.045, mmMat('stahl'), 10);
  for (const p of [[0.66, 0.8, 0], [0.84, 0.8, 0]]) mmKugel(g, 0.05, mmMat('stahl'), ...p, 8);
  // Wasserzulauf (blau) von −z mit Handrad
  mmRohrZug(g, [[-0.25, 0.15, -0.9], [-0.25, 0.15, -0.68], [-0.25, 1.42, -0.68], [-0.25, 1.42, -0.4], [-0.25, 1.3, -0.4]]);
  mmZ(g, 0.02, 0.12, mmMat('stahlDunkel'), 'z', -0.25, 0.8, -0.74, 6);
  mmHandrad(g, -0.25, 0.8, -0.8, 'z', 0.06);
  g.userData.wasser = [[-0.25, 0.15, -0.9]];
  g.userData.leitung = mmIsolator(g, 0, 1.4, 0.58);
  return g;
}

function mmPapier() {
  const g = new THREE.Group();
  mmQ(g, 2.9, 0.08, 1.3, mmMat('dunkel'), 0.05, 0.04, 0);
  // Einlaufmaul und Stoffauflauf hinten (−x)
  mmQ(g, 0.22, 0.03, 0.56, mmMat('stahl'), -1.39, 0.5, 0);
  for (const s of [-1, 1]) mmQ(g, 0.22, 0.25, 0.03, mmMat('petrol'), -1.39, 0.64, s * 0.28);
  mmQ(g, 0.24, 0.03, 0.6, mmMat('petrol'), -1.39, 0.78, 0);
  mmQ(g, 0.5, 0.95, 1.1, mmMat('petrol'), -1.03, 0.555, 0);
  mmQ(g, 0.01, 0.24, 0.5, mmMat('schwarz'), -1.285, 0.64, 0);
  mmZ(g, 0.16, 0.9, mmMat('hellgrau'), 'z', -1.03, 1.19, 0, 14);
  for (const z of [-0.3, 0.3]) mmQ(g, 0.26, 0.06, 0.08, mmMat('dunkel'), -1.03, 1.05, z);
  mmZ(g, 0.055, 0.3, mmMat('stahlDunkel'), 'y', -0.9, 1.4, -0.35, 10);
  mmPunkt(g, 'dampfPunkt', -0.9, 1.57, -0.35);
  // Rahmen
  for (const s of [-1, 1]) {
    for (const x of [-0.7, -0.15, 0.4, 0.95]) mmQ(g, 0.08, 1.12, 0.07, mmMat('petrol'), x, 0.64, s * 0.6);
    mmQ(g, 1.75, 0.08, 0.07, mmMat('petrol'), 0.125, 1.2, s * 0.6);
    mmQ(g, 1.75, 0.1, 0.07, mmMat('petrol'), 0.125, 0.18, s * 0.6);
  }
  // Walzen: Kinder von 'walzen', jede dreht sich um ihre eigene z-Achse
  const walzen = mmTeil(g, 'walzen');
  const liste = [[-0.45, 0.72, 0.2, 'stahl'], [0.12, 0.72, 0.2, 'stahl'], [0.68, 0.72, 0.2, 'stahl'],
    [-0.16, 0.42, 0.07, 'gummi'], [0.4, 0.42, 0.07, 'gummi'], [1.02, 0.62, 0.06, 'gummi']];
  for (const [x, y, r, m] of liste) {
    const w = mmZ(walzen, r, 1.1, mmMat(m), 'z', x, y, 0, r > 0.1 ? 18 : 10);
    w.name = 'walze';
    mmZ(w, r * 0.45, 0.02, mmMat('dunkel'), 'z', 0, 0, 0.56, 8);
    mmQ(w, r * 1.6, 0.02, 0.012, mmMat('dunkel'), 0, 0, 0.566);
  }
  // Papierbahn über die Trockenwalzen, hinunter zum Querschneider
  mmQ(g, 1.66, 0.006, 0.9, mmMat('papier'), 0.05, 0.925, 0);
  mmBrett(g, [0.88, 0.92, 0], [1.12, 0.64, 0], 0.006, 0.9, mmMat('papier'));
  mmBrett(g, [1.12, 0.64, 0], [1.32, 0.565, 0], 0.006, 0.9, mmMat('papier'));
  mmQ(g, 0.16, 0.14, 1.0, mmMat('hellgrau'), 1.22, 0.93, 0);
  for (const s of [-1, 1]) mmQ(g, 0.16, 0.36, 0.08, mmMat('hellgrau'), 1.22, 0.68, s * 0.5);
  mmQ(g, 0.02, 0.06, 0.9, mmMat('chrom'), 1.22, 0.83, 0);
  // Ablagetisch vorn (+x) mit einem Stapel Bögen
  mmQ(g, 0.5, 0.04, 0.7, mmMat('stahl'), 1.25, 0.53, 0);
  mmQ(g, 0.4, 0.43, 0.5, mmMat('dunkel'), 1.25, 0.295, 0);
  for (let i = 0; i < 3; i++) mmQ(g, 0.34, 0.012, 0.26, mmMat('papier'), 1.3 + i * 0.01, 0.557 + i * 0.013, i * 0.01);
  // Antrieb, Pult, Wasserzulauf
  mmZ(g, 0.09, 0.14, mmMat('blau'), 'z', 0.12, 0.35, 0.73, 12);
  mmQ(g, 0.08, 0.9, 0.08, mmMat('stahlDunkel'), 0.8, 0.45, 0.72);
  mmQ(g, 0.3, 0.2, 0.08, mmMat('dunkel'), 0.8, 0.98, 0.72).rotation.x = -0.4;
  mmAnzeige(g, 0.9, 1.02, 0.745, 'y', 0.02);
  mmRohrZug(g, [[-1.1, 0.15, -0.8], [-1.1, 0.15, -0.62], [-1.1, 0.6, -0.62], [-1.1, 0.6, -0.54]], 0.04);
  g.userData.wasser = [[-1.1, 0.15, -0.8]];
  g.userData.leitung = mmIsolator(g, -0.85, 1.03, 0.45);
  return g;
}

/** Ziegelpresse: schwerer Rahmen mit vier Säulen; stempel fährt bis 0,3 m nach unten. */
function mmBrikett() {
  const g = new THREE.Group();
  mmQ(g, 1.8, 0.3, 1.6, mmMat('rostbraun'), 0.1, 0.15, 0);
  mmQ(g, 1.82, 0.04, 1.62, mmMat('stahlDunkel'), 0.1, 0.31, 0);
  // zwei Einläufe hinten (−x) in einen Mischtrichter
  mmTrichter(g, 0.32, 0.16, 0.2, mmMat('stahl', true), -0.55, 0.53, 0);
  for (const s of [-1, 1]) mmRutsche(g, [-1.18, 0.53, s * 0.45], [-0.84, 0.5, s * 0.24], 0.3, 0.07, mmMat('stahl'));
  // Pressenrahmen: vier Säulen und Kopfstück
  for (const x of [-0.12, 0.52]) {
    for (const z of [-0.45, 0.45]) {
      mmZ(g, 0.07, 1.25, mmMat('stahl'), 'y', x, 0.955, z, 12);
      for (const y of [0.36, 1.53]) mmZ(g, 0.1, 0.06, mmMat('stahlDunkel'), 'y', x, y, z, 8);
    }
  }
  mmQ(g, 0.9, 0.24, 1.2, mmMat('rostbraun'), 0.2, 1.68, 0);
  mmQ(g, 0.92, 0.04, 1.22, mmMat('stahlDunkel'), 0.2, 1.56, 0);
  mmZ(g, 0.15, 0.36, mmMat('stahlDunkel'), 'y', 0.2, 1.38, 0, 16);
  mmZ(g, 0.07, 0.03, mmMat('schwarz'), 'x', 0.665, 1.68, 0.3, 14);
  mmZ(g, 0.058, 0.01, mmMat('weiss'), 'x', 0.682, 1.68, 0.3, 14);
  mmAnzeige(g, 0.662, 1.68, -0.3, 'x');
  // Formtisch
  mmQ(g, 0.74, 0.14, 0.9, mmMat('stahl'), 0.2, 0.4, 0);
  mmQ(g, 0.34, 0.01, 0.2, mmMat('schwarz'), 0.2, 0.475, 0);
  const st = mmTeil(g, 'stempel', 0.2, 1.0, 0);
  mmQ(st, 0.62, 0.12, 0.8, mmMat('stahlDunkel'), 0, -0.06, 0);
  for (const s of [-1, 1]) mmWarnstreifen(st, 0.62, 0.05, 0.01, 0, -0.06, s * 0.405, 'x', 8);
  mmZ(st, 0.07, 0.62, mmMat('chrom'), 'y', 0, 0.31, 0, 12);
  // Ausgabetisch vorn (+x) mit fertigem Öko-Ziegel
  mmQ(g, 0.6, 0.2, 0.6, mmMat('rostbraun'), 0.9, 0.43, 0);
  mmQ(g, 0.6, 0.04, 0.6, mmMat('stahl'), 0.9, 0.53, 0);
  mmQ(g, 0.3, 0.12, 0.16, mmMat('ziegel'), 0.95, 0.61, 0);
  // Hydraulikaggregat
  mmQ(g, 0.36, 0.3, 0.3, mmMat('blau'), 0.8, 0.48, -0.55);
  mmZ(g, 0.08, 0.22, mmMat('blau'), 'x', 0.8, 0.7, -0.55, 12);
  mmStab(g, [0.7, 0.62, -0.48], [0.3, 1.45, -0.3], 0.018, mmMat('gummi'));
  g.userData.leitung = mmIsolator(g, 0.5, 1.8, -0.45);
  return g;
}

/* ------------------------------------------------------------ Wasser */

/** Brunnen mit Pumpenschwengel: pumpe (Schwengel mit Pferdekopf) wippt um z. */
function mmBrunnen() {
  const g = new THREE.Group();
  mmQ(g, 1.3, 0.12, 1.3, mmMat('beton'), 0, 0.06, 0);
  mmQ(g, 1.2, 0.08, 0.4, mmMat('dunkel'), -0.05, 0.16, 0);
  // Bock (A-Rahmen) mit Lager und Antrieb oben
  const px = -0.05;
  const py = 1.45;
  for (const s of [-1, 1]) mmStab(g, [px - 0.05, 0.2, s * 0.3], [px, py - 0.06, s * 0.06], 0.03, mmMat('senf'), 8);
  mmStab(g, [px - 0.45, 0.2, 0], [px, py - 0.14, 0], 0.025, mmMat('senf'), 8);
  mmQ(g, 0.16, 0.1, 0.2, mmMat('dunkel'), px, py - 0.06, 0);
  mmQ(g, 0.2, 0.2, 0.16, mmMat('blau'), px, py - 0.02, -0.2);
  mmZ(g, 0.07, 0.18, mmMat('blau'), 'x', px - 0.18, py - 0.02, -0.2, 12);
  // Schwengel
  const pu = mmTeil(g, 'pumpe', px, py, 0);
  mmQ(pu, 1.05, 0.12, 0.1, mmMat('senf'), -0.075, 0.03, 0);
  const kopf = new THREE.Shape();
  const r1 = 0.44;
  const r2 = 0.56;
  const a0 = -0.45;
  const a1 = 0.3;
  kopf.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
  kopf.absarc(0, 0, r2, a0, a1, false);
  kopf.lineTo(r1 * Math.cos(a1), r1 * Math.sin(a1));
  kopf.absarc(0, 0, r1, a1, a0, true);
  const kopfGeo = new THREE.ExtrudeGeometry(kopf, { depth: 0.14, bevelEnabled: false, curveSegments: 6 });
  kopfGeo.translate(0, 0, -0.07);
  mmNetz(pu, kopfGeo, mmMat('senf'), 0, 0, 0);
  mmQ(pu, 0.2, 0.2, 0.16, mmMat('schwarz'), -0.52, 0.0, 0); // Gegengewicht
  for (const s of [-1, 1]) mmStab(pu, [0.555, -0.06, s * 0.035], [0.555, -0.36, s * 0.035], 0.006, mmMat('schwarz'), 4);
  mmQ(pu, 0.04, 0.03, 0.14, mmMat('stahlDunkel'), 0.555, -0.36, 0);
  // Brunnenkopf mit Pumpenstange
  const bx = px + 0.555;
  mmZ(g, 0.1, 0.25, mmMat('stahlDunkel'), 'y', bx, 0.245, 0, 12);
  mmZ(g, 0.14, 0.03, mmMat('stahlDunkel'), 'y', bx, 0.37, 0, 12);
  mmZ(g, 0.045, 0.08, mmMat('stahl'), 'y', bx, 0.425, 0, 10);
  mmZ(g, 0.02, 0.62, mmMat('chrom'), 'y', bx, 0.72, 0, 6);
  // blaues Rohr zur Seite (+z) mit Schieber
  mmRohrZug(g, [[bx, 0.25, 0.08], [bx, 0.25, 0.45], [bx, 0.15, 0.45], [bx, 0.15, 0.65]]);
  mmZ(g, 0.07, 0.03, mmMat('rohrBlau'), 'z', bx, 0.15, 0.635, 12);
  mmZ(g, 0.065, 0.1, mmMat('rohrBlau'), 'z', bx, 0.25, 0.27, 12);
  mmZ(g, 0.015, 0.12, mmMat('stahlDunkel'), 'y', bx, 0.35, 0.27, 6);
  mmHandrad(g, bx, 0.41, 0.27, 'y', 0.06);
  // Schaltkasten mit Anzeige
  mmQ(g, 0.06, 0.8, 0.06, mmMat('stahlDunkel'), -0.52, 0.52, 0.45);
  mmQ(g, 0.12, 0.26, 0.22, mmMat('hellgrau'), -0.52, 0.85, 0.45);
  mmAnzeige(g, -0.455, 0.9, 0.45, 'x');
  g.userData.leitung = mmIsolator(g, -0.52, 0.98, 0.4);
  g.userData.wasser = [[bx, 0.15, 0.65]];
  return g;
}

function mmLeitung() {
  const g = new THREE.Group();
  mmZ(g, 0.05, 1.0, mmMat('rohrBlau'), 'x', 0, 0.15, 0, 10);
  for (const x of [-0.47, 0.47]) mmZ(g, 0.07, 0.04, mmMat('rohrBlau'), 'x', x, 0.15, 0, 12);
  mmQ(g, 0.08, 0.1, 0.16, mmMat('dunkel'), 0, 0.05, 0);
  g.userData.wasser = [[-0.5, 0.15, 0], [0.5, 0.15, 0]];
  return g;
}

function mmWasserweiche() {
  const g = new THREE.Group();
  mmQ(g, 0.3, 0.06, 0.3, mmMat('beton'), 0, 0.03, 0);
  mmZ(g, 0.05, 0.6, mmMat('rohrBlau'), 'x', 0, 0.15, 0, 10);
  mmZ(g, 0.05, 0.3, mmMat('rohrBlau'), 'z', 0, 0.15, 0.15, 10);
  mmZ(g, 0.09, 0.16, mmMat('rohrBlau'), 'y', 0, 0.2, 0, 12);
  for (const [x, z, a] of [[-0.28, 0, 'x'], [0.28, 0, 'x'], [0, 0.28, 'z']]) mmZ(g, 0.07, 0.04, mmMat('rohrBlau'), a, x, 0.15, z, 12);
  mmZ(g, 0.018, 0.16, mmMat('stahlDunkel'), 'y', 0, 0.35, 0, 6);
  mmHandrad(g, 0, 0.43, 0, 'y', 0.08);
  g.userData.wasser = [[-0.3, 0.15, 0], [0.3, 0.15, 0], [0, 0.15, 0.3]];
  return g;
}

/* ------------------------------------------------------------ Linien */

/** Rohrwerfer: rohr (Turm samt schräg gestelltem Rohr) dreht um y; Einlauftrichter fest. */
function mmRohrwerfer() {
  const g = new THREE.Group();
  mmZ(g, 0.46, 0.06, mmMat('dunkel'), 'y', 0, 0.03, 0, 20);
  mmZ(g, 0.24, 0.28, mmMat('hellgrau'), 'y', 0.05, 0.2, 0, 16);
  mmAnzeige(g, 0.29, 0.22, 0.05, 'x', 0.02);
  const turm = mmTeil(g, 'rohr', 0.05, 0.34, 0);
  mmZ(turm, 0.26, 0.06, mmMat('dunkel'), 'y', 0, 0.03, 0, 18);
  mmQ(turm, 0.36, 0.22, 0.34, mmMat('blauHell'), 0, 0.17, 0);
  for (const s of [-1, 1]) mmQ(turm, 0.16, 0.22, 0.04, mmMat('blauHell'), 0, 0.36, s * 0.15);
  const lauf = mmTeil(turm, null, 0, 0.4, 0);
  lauf.rotation.z = 0.6;
  mmZ(lauf, 0.09, 0.75, mmMat('stahl'), 'x', 0.125, 0, 0, 16);
  mmZ(lauf, 0.065, 0.01, mmMat('schwarz'), 'x', 0.505, 0, 0, 12);
  mmZ(lauf, 0.1, 0.06, mmMat('orange'), 'x', 0.47, 0, 0, 16);
  mmZ(lauf, 0.095, 0.03, mmMat('orange'), 'x', 0.1, 0, 0, 16);
  mmZ(lauf, 0.11, 0.14, mmMat('dunkel'), 'x', -0.22, 0, 0, 14);
  mmZ(lauf, 0.035, 0.34, mmMat('dunkel'), 'z', 0, 0, 0, 8);
  // fester Einlauftrichter hinten (−x) mit Schlauch in den Sockel
  mmTrichter(g, 0.19, 0.07, 0.26, mmMat('hellgrau', true), -0.3, 0.55, 0, true);
  mmStab(g, [-0.3, 0.3, 0], [-0.12, 0.22, 0], 0.06, mmMat('gummi'), 10);
  for (const s of [-1, 1]) mmStab(g, [-0.3, 0.06, s * 0.14], [-0.3, 0.45, s * 0.15], 0.012, mmMat('dunkel'));
  mmZ(g, 0.09, 0.42, mmMat('weiss'), 'z', 0.28, 0.15, -0.22, 14);
  g.userData.leitung = mmIsolator(g, 0.28, 0.24, -0.1);
  return g;
}

/* ------------------------------------------------------------ Hofbau */

function mmPlattform() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      mmQ(g, 0.12, 2.01, 0.12, mmMat('holzDunkel'), sx * 0.92, 1.005, sz * 0.92);
      mmQ(g, 0.2, 0.02, 0.2, mmMat('stahlDunkel'), sx * 0.92, 0.01, sz * 0.92);
      mmBrett(g, [sx * 0.92, 1.55, sz * 0.96], [sx * 0.47, 2.02, sz * 0.96], 0.06, 0.05, mmMat('holzDunkel'));
      mmBrett(g, [sx * 0.96, 1.55, sz * 0.92], [sx * 0.96, 2.02, sz * 0.47], 0.05, 0.06, mmMat('holzDunkel'));
    }
    mmQ(g, 2.0, 0.14, 0.08, mmMat('holzDunkel'), 0, 2.08, sx * 0.96);
    mmQ(g, 0.08, 0.14, 2.0, mmMat('holzDunkel'), sx * 0.96, 2.08, 0);
  }
  for (const z of [-0.5, 0, 0.5]) mmQ(g, 1.84, 0.12, 0.07, mmMat('holzDunkel'), 0, 2.09, z);
  for (let i = 0; i < 10; i++) mmQ(g, 0.195, 0.05, 2.0, mmMat(i % 2 ? 'holz' : 'holzHell'), -0.9 + i * 0.2, 2.175, 0);
  return g;
}

function mmTreppe() {
  const g = new THREE.Group();
  const tritt = 3.0 / 11;
  for (let k = 1; k <= 11; k++) mmQ(g, 0.9, 0.04, 0.3, mmMat(k % 2 ? 'holz' : 'holzHell'), 0, 0.2 * k - 0.02, -1.5 + (k - 0.5) * tritt);
  for (const s of [-1, 1]) {
    mmBrett(g, [s * 0.475, 0.11, -1.35], [s * 0.475, 2.053, 1.3], 0.05, 0.26, mmMat('holzDunkel'));
    mmQ(g, 0.05, 0.95, 0.05, mmMat('holzDunkel'), s * 0.48, 0.745, -1.35);
    mmQ(g, 0.05, 0.95, 0.05, mmMat('holzDunkel'), s * 0.48, 2.675, 1.3);
    mmQ(g, 0.045, 0.92, 0.045, mmMat('holzDunkel'), s * 0.48, 1.72, 0);
    mmBrett(g, [s * 0.48, 1.2, -1.35], [s * 0.48, 3.12, 1.3], 0.05, 0.07, mmMat('holz'));
  }
  return g;
}

function mmGelaender() {
  const g = new THREE.Group();
  for (const x of [-0.47, 0.47]) mmQ(g, 0.06, 1.0, 0.06, mmMat('holzDunkel'), x, 0.5, 0);
  mmQ(g, 1.0, 0.05, 0.08, mmMat('holz'), 0, 0.975, 0);
  mmQ(g, 0.94, 0.04, 0.03, mmMat('holz'), 0, 0.55, 0);
  mmQ(g, 0.94, 0.1, 0.02, mmMat('holz'), 0, 0.06, 0);
  return g;
}

function mmWand() {
  const g = new THREE.Group();
  const breiten = [0.19, 0.21, 0.2, 0.19, 0.21];
  let x = -0.5;
  breiten.forEach((b, i) => {
    mmQ(g, b - 0.006, 3.0, 0.04, mmMat(i % 2 ? 'holzAlt' : 'holzDunkel'), x + b / 2, 1.5, 0.035);
    x += b;
  });
  for (const y of [0.4, 1.5, 2.6]) mmQ(g, 1.0, 0.12, 0.05, mmMat('holzDunkel'), 0, y, -0.01);
  return g;
}

function mmDach() {
  const g = new THREE.Group();
  const neigung = Math.atan2(0.16, 3.1);
  const hoehe = (x) => 2.92 - (x + 1.5) * (0.14 / 3.0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const h = hoehe(sx * 1.42) - 0.04;
      mmQ(g, 0.09, h, 0.09, mmMat('stahlDunkel'), sx * 1.42, h / 2, sz * 1.42);
      mmQ(g, 0.2, 0.02, 0.2, mmMat('dunkel'), sx * 1.42, 0.01, sz * 1.42);
    }
    mmBrett(g, [-1.5, hoehe(-1.5), sx * 1.42], [1.5, hoehe(1.5), sx * 1.42], 0.1, 0.08, mmMat('stahlDunkel'));
  }
  for (const x of [-1.0, 0, 1.0]) mmQ(g, 0.06, 0.06, 3.0, mmMat('stahlDunkel'), x, hoehe(x) + 0.08, 0);
  // Wellblech: Sinuswellen quer zur Neigung
  const blech = new THREE.PlaneGeometry(3.1, 3.1, 1, 96);
  blech.rotateX(-Math.PI / 2);
  const pos = blech.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, 0.02 * Math.sin((pos.getZ(i) / 0.13) * Math.PI * 2));
  blech.computeVertexNormals();
  const b = mmNetz(g, blech, mmMat('blech', true), 0, hoehe(0) + 0.13, 0);
  b.rotation.z = -neigung;
  mmZ(g, 0.05, 3.1, mmMat('blech', true), 'z', 1.58, hoehe(1.55) + 0.06, 0, 8, 0.05, true);
  return g;
}

/** Arbeitslampe auf Stativ; schirm leuchtet (Lichtquelle setzt objekte3d.js auf 2,2 m). */
function mmLampe() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const fx = Math.cos(a) * 0.19;
    const fz = Math.sin(a) * 0.19;
    mmStab(g, [0, 0.72, 0], [fx, 0.012, fz], 0.014, mmMat('stahlDunkel'));
    mmZ(g, 0.025, 0.02, mmMat('gummi'), 'y', fx, 0.01, fz, 8);
  }
  mmZ(g, 0.035, 0.08, mmMat('stahlDunkel'), 'y', 0, 0.72, 0, 8);
  mmZ(g, 0.02, 1.5, mmMat('stahl'), 'y', 0, 1.47, 0, 8);
  mmQ(g, 0.06, 0.05, 0.06, mmMat('schwarz'), 0, 1.4, 0);
  const kopf = mmTeil(g, null, 0, 2.22, 0);
  kopf.rotation.z = -0.5; // blickt nach vorn (+x) und nach unten
  mmQ(kopf, 0.05, 0.08, 0.3, mmMat('schwarz'), -0.02, 0.0, 0);
  mmQ(kopf, 0.12, 0.2, 0.26, mmMat('gelb'), 0.02, 0.1, 0);
  mmQ(kopf, 0.03, 0.18, 0.24, mmMat('schwarz'), -0.05, 0.1, 0);
  for (const y of [0.05, 0.1, 0.15]) mmQ(kopf, 0.04, 0.012, 0.22, mmMat('schwarz'), -0.08, y, 0);
  const schirm = mmQ(kopf, 0.01, 0.16, 0.22, mmLeucht('warm'), 0.085, 0.1, 0);
  schirm.name = 'schirm';
  for (const z of [-0.05, 0.05]) mmQ(kopf, 0.01, 0.18, 0.012, mmMat('schwarz'), 0.092, 0.1, z);
  const kurve = new THREE.CatmullRomCurve3([[-0.03, 2.2, 0.02], [-0.03, 1.5, 0.03], [-0.04, 0.8, 0.03], [0.06, 0.3, 0.12], [0.15, 0.015, 0.15]].map((p) => new THREE.Vector3(...p)));
  mmNetz(g, new THREE.TubeGeometry(kurve, 20, 0.008, 4, false), mmMat('schwarz'), 0, 0, 0);
  g.userData.leitung = [-0.02, 2.0, 0];
  g.userData.lichtRichtung = [Math.cos(-0.5), Math.sin(-0.5), 0];
  return g;
}

/**
 * Staffelei, Blick nach +x (dorthin schaut der Betrachter): Beine spreizen sich
 * entlang x, das Malbrett (leinwand) steht leicht zurückgelehnt. Davor liegt
 * bild: eine Ebene 0,75 × 0,55 m mit eigenem Werkstoff und UV 0…1 (v nach oben),
 * auf die das Spiel die Zeichnung legt.
 */
function mmStaffelei() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) mmBrett(g, [0.14, 0, s * 0.36], [0.02, 1.66, s * 0.05], 0.03, 0.035, mmMat('holz'));
  mmBrett(g, [-0.3, 0, 0], [0.0, 1.5, 0], 0.03, 0.035, mmMat('holz'));
  mmQ(g, 0.025, 0.03, 0.5, mmMat('holz'), 0.097, 0.6, 0);
  mmQ(g, 0.09, 0.025, 0.82, mmMat('holz'), 0.13, 0.72, 0);
  mmQ(g, 0.012, 0.04, 0.82, mmMat('holz'), 0.172, 0.745, 0);
  const brett = mmTeil(g, null, 0.1, 1.03, 0);
  brett.rotation.z = 0.08; // Oberkante lehnt nach hinten (−x)
  const lw = mmQ(brett, 0.02, 0.57, 0.77, mmMat('markierung'), 0, 0, 0);
  lw.name = 'leinwand';
  const bildGeo = new THREE.PlaneGeometry(0.75, 0.55);
  bildGeo.rotateY(Math.PI / 2); // Vorderseite nach +x, u läuft für den Betrachter nach rechts
  const bildMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  bildMat.userData.eigen = true;
  const bild = mmNetz(brett, bildGeo, bildMat, 0.0115, 0, 0);
  bild.name = 'bild';
  mmQ(g, 0.05, 0.05, 0.08, mmMat('holz'), 0.085, 1.33, 0);
  mmZ(g, 0.008, 0.16, mmMat('rot'), 'z', 0.15, 0.745, -0.2, 6);
  mmZ(g, 0.008, 0.14, mmMat('gelb'), 'z', 0.14, 0.745, 0.18, 6);
  return g;
}

/** Werkzeugschrank aus Brettern: Türen vorn (+z). */
function mmSchrank() {
  const g = new THREE.Group();
  mmQ(g, 0.96, 0.08, 0.44, mmMat('holzDunkel'), 0, 0.04, -0.01);
  mmQ(g, 1.0, 1.72, 0.46, mmMat('holzDunkel'), 0, 0.94, -0.02);
  mmQ(g, 1.08, 0.05, 0.56, mmMat('schwarz'), 0, 1.84, 0).rotation.x = 0.12;
  for (const s of [-1, 1]) {
    const x = s * 0.245;
    mmQ(g, 0.47, 1.6, 0.03, mmMat('holz'), x, 0.95, 0.225);
    for (const y of [0.35, 1.55]) {
      mmQ(g, 0.43, 0.08, 0.02, mmMat('holzHell'), x, y, 0.25);
      mmQ(g, 0.16, 0.035, 0.01, mmMat('schwarz'), s * 0.42, y, 0.262);
    }
    mmBrett(g, [x - s * 0.17, 0.4, 0.25], [x + s * 0.17, 1.5, 0.25], 0.07, 0.02, mmMat('holzHell'));
    mmZ(g, 0.012, 0.12, mmMat('stahl'), 'y', s * 0.045, 0.95, 0.262, 6);
  }
  mmQ(g, 0.05, 0.08, 0.015, mmMat('stahl'), 0, 1.05, 0.25);
  return g;
}

/** Schräges Sprossenband: von −z auf Bandhöhe nach +z auf 2,75 m (wie innenPunkt in maschinen.js). */
function mmHeutreppe() {
  const g = new THREE.Group();
  const hoehe = (z) => MM_BAND_Y + ((z + 2) / 4) * (MM_OBEN_Y - MM_BAND_Y);
  const z0 = -1.95;
  const z1 = 1.95;
  const L = Math.hypot(z1 - z0, hoehe(z1) - hoehe(z0));
  const schraeg = mmTeil(g, null, 0, hoehe(0), 0);
  schraeg.rotation.x = -Math.atan2(hoehe(z1) - hoehe(z0), z1 - z0);
  mmQ(schraeg, 0.62, 0.03, L, mmMat('gummi'), 0, -0.015, 0);
  for (let i = 0; i < 16; i++) mmQ(schraeg, 0.6, 0.03, 0.035, mmMat('stahlDunkel'), 0, 0.015, -L / 2 + 0.14 + i * (L - 0.28) / 15);
  for (const s of [-1, 1]) {
    mmQ(schraeg, 0.05, 0.16, L, mmMat('holz'), s * 0.335, 0.02, 0);
    mmQ(schraeg, 0.05, 0.06, L, mmMat('stahlDunkel'), s * 0.3, -0.08, 0);
    mmZ(schraeg, 0.06, 0.62, mmMat('stahl'), 'x', 0, -0.03, s * (L / 2 - 0.04), 10);
  }
  // Stützen mit Querstreben
  const unter = (z) => hoehe(z) - 0.13;
  for (const z of [-1.2, 0, 1.2]) {
    const h = unter(z);
    for (const s of [-1, 1]) {
      mmQ(g, 0.05, h, 0.05, mmMat('stahlDunkel'), s * 0.3, h / 2, z);
      mmQ(g, 0.12, 0.02, 0.12, mmMat('dunkel'), s * 0.3, 0.01, z);
    }
    mmQ(g, 0.6, 0.04, 0.04, mmMat('stahlDunkel'), 0, h * 0.5, z);
  }
  for (const s of [-1, 1]) {
    mmStab(g, [s * 0.3, 0.1, -1.2], [s * 0.3, unter(0) - 0.05, 0], 0.015, mmMat('stahlDunkel'));
    mmStab(g, [s * 0.3, 0.1, 0], [s * 0.3, unter(1.2) - 0.05, 1.2], 0.015, mmMat('stahlDunkel'));
  }
  // Antrieb oben, Leitbleche unten, Schaltkasten
  mmZ(g, 0.08, 0.22, mmMat('blau'), 'x', 0.12, unter(1.72) - 0.1, 1.72, 12);
  mmQ(g, 0.12, 0.14, 0.14, mmMat('dunkel'), -0.06, unter(1.72) - 0.1, 1.72);
  for (const s of [-1, 1]) mmQ(g, 0.02, 0.14, 0.26, mmMat('stahl'), s * 0.37, 0.64, -1.86).rotation.y = s * 0.25;
  mmQ(g, 0.08, 0.2, 0.14, mmMat('dunkel'), 0.36, 0.55, -1.2);
  mmAnzeige(g, 0.405, 0.6, -1.2, 'x', 0.02);
  g.userData.leitung = mmIsolator(g, 0.3, unter(1.72) - 0.04, 1.72);
  return g;
}

/**
 * Heulift: schwarzer Gitterturm mit blauem Motor. korb fährt an der offenen
 * Rückseite (−x) von 0,3 bis 2,5 m, oben läuft ein Band auf 2,75 m nach +x.
 */
function mmHeulift() {
  const g = new THREE.Group();
  mmQ(g, 1.2, 0.05, 1.2, mmMat('dunkel'), 0, 0.025, 0);
  for (const s of [-1, 1]) mmWarnstreifen(g, 1.2, 0.03, 0.08, 0, 0.05, s * 0.56, 'x', 10);
  const m = mmMat('schwarz');
  const e = 0.46;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mmQ(g, 0.07, 3.6, 0.07, m, sx * e, 1.85, sz * e);
  const ebenen = [0.05, 0.75, 1.45, 2.15, 2.68, 3.3, 3.62];
  for (const y of ebenen) {
    for (const s of [-1, 1]) mmQ(g, 0.92, 0.05, 0.05, m, 0, y, s * e);
    mmQ(g, 0.05, 0.05, 0.92, m, e, y, 0);
    if (y >= 2.68 || y < 0.1) mmQ(g, 0.05, 0.05, 0.92, m, -e, y, 0); // Rückseite offen für den Korb
  }
  for (let i = 0; i < ebenen.length - 1; i++) {
    const a = ebenen[i];
    const b = ebenen[i + 1];
    const w = i % 2 ? 1 : -1;
    for (const s of [-1, 1]) mmStab(g, [-e * w, a, s * e], [e * w, b, s * e], 0.014, m, 5);
    if (a !== 2.68) mmStab(g, [e, a, e * w], [e, b, -e * w], 0.014, m, 5); // vorn, frei für den Auslauf
    if (a >= 3.3) mmStab(g, [-e, a, -e * w], [-e, b, e * w], 0.014, m, 5);
  }
  // Führungsschienen für den Korb
  for (const z of [-0.3, 0.3]) mmQ(g, 0.04, 3.1, 0.03, mmMat('stahl'), -0.44, 1.6, z);
  // Kopf mit blauem Motor und oranger Kupplung
  mmQ(g, 0.1, 0.12, 0.98, m, 0, 3.71, 0);
  mmQ(g, 0.98, 0.08, 0.1, m, 0, 3.69, 0);
  mmZ(g, 0.11, 0.34, mmMat('blau'), 'x', 0.14, 3.88, -0.1, 14);
  mmZ(g, 0.1, 0.03, mmMat('dunkel'), 'x', 0.325, 3.88, -0.1, 14);
  mmQ(g, 0.16, 0.2, 0.2, mmMat('blau'), -0.12, 3.87, -0.1);
  mmZ(g, 0.07, 0.06, mmMat('orange'), 'x', -0.01, 3.88, -0.1, 12);
  for (const z of [-0.2, 0.2]) mmZ(g, 0.012, 3.3, mmMat('stahlDunkel'), 'y', -0.38, 2.0, z, 4);
  // oberes Band auf Plattformhöhe hinüber zum Auslauf (+x)
  mmBandstueck(g, -0.55, 0.6, 0, 0.5, MM_OBEN_Y);
  // Korb
  const korb = mmTeil(g, 'korb', -0.33, 0.3, 0);
  mmQ(korb, 0.56, 0.03, 0.5, mmMat('stahl'), 0, 0, 0);
  for (const s of [-1, 1]) {
    mmQ(korb, 0.56, 0.22, 0.02, mmMat('stahl'), 0, 0.11, s * 0.25);
    mmQ(korb, 0.58, 0.025, 0.025, mmMat('gelb'), 0, 0.22, s * 0.26);
    mmQ(korb, 0.06, 0.12, 0.05, mmMat('dunkel'), -0.11, 0.1, s * 0.3);
  }
  mmQ(korb, 0.02, 0.22, 0.5, mmMat('stahl'), -0.28, 0.11, 0);
  mmQ(korb, 0.02, 0.1, 0.5, mmMat('stahl'), 0.28, 0.05, 0);
  // Schaltkasten
  mmQ(g, 0.24, 0.3, 0.08, mmMat('dunkel'), 0.2, 0.7, 0.53);
  mmAnzeige(g, 0.28, 0.78, 0.575, 'z', 0.02);
  g.userData.leitung = mmIsolator(g, 0.4, 3.73, 0.4);
  return g;
}

/** Abwurfklappe: Rahmen mit Deckel, der nach unten aufklappt (rotation.z negativ). */
function mmKlappe() {
  const g = new THREE.Group();
  const m = mmMat('stahlDunkel');
  for (const s of [-1, 1]) {
    mmQ(g, 1.0, 0.12, 0.1, m, 0, 0.06, s * 0.45);
    mmQ(g, 0.1, 0.12, 0.8, m, s * 0.45, 0.06, 0);
    mmWarnstreifen(g, 1.0, 0.012, 0.1, 0, 0.126, s * 0.45, 'x', 10);
    mmWarnstreifen(g, 0.8, 0.012, 0.1, s * 0.45, 0.126, 0, 'z', 8);
  }
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) mmZ(g, 0.04, 0.08, mmMat('gelb'), 'y', x, 0.16, z, 8);
  mmQ(g, 0.8, 0.004, 0.8, mmMat('schwarz'), 0, 0.006, 0); // Schacht: verdeckt die Bretter darunter
  const d = mmTeil(g, 'deckel', -0.4, 0.1, 0);
  mmQ(d, 0.8, 0.03, 0.78, mmMat('stahl'), 0.4, 0, 0);
  for (let i = 0; i < 5; i++) mmQ(d, 0.6, 0.008, 0.02, mmMat('stahlDunkel'), 0.4, 0.019, -0.28 + i * 0.14).rotation.y = 0.5;
  mmQ(d, 0.04, 0.03, 0.2, mmMat('gelb'), 0.74, 0.03, 0);
  for (const z of [-0.25, 0.25]) mmZ(g, 0.02, 0.12, mmMat('dunkel'), 'z', -0.4, 0.1, z, 8);
  return g;
}

/** Linienbauten zeichnet objekte3d.js selbst; hier nur ein Meter als Platzhalter. */
function mmBand() {
  const g = new THREE.Group();
  mmBandstueck(g, -0.5, 0.5);
  for (const s of [-1, 1]) mmQ(g, 0.05, 0.49, 0.05, mmMat('stahlDunkel'), 0, 0.245, s * 0.28);
  return g;
}

/** Unbekannter Typ: grauer Kasten im Fußabdruck. */
function mmErsatz(typ) {
  const g = new THREE.Group();
  const d = BAUTEN.find((x) => x.id === typ) || { b: 1, t: 1, h: 1 };
  mmQ(g, d.b, d.h, d.t, mmMat('hellgrau'), 0, d.h / 2, 0);
  return g;
}

const MM_BAUER = {
  band: mmBand,
  weiche: mmWeiche,
  vereiniger: mmVereiniger,
  vorrangarm: () => mmGreifarm(0.69, true, 1.1),
  rohrwerfer: mmRohrwerfer,
  rechen: mmRechen,
  arm: () => mmGreifarm(1, false, 1.6),
  drohnenstation: mmDrohnenstation,
  generator: mmGenerator,
  mast: mmMast,
  scanner: mmScanner,
  radar: mmRadar,
  silo: mmSilo,
  presse: mmPresse,
  pellet: mmPellet,
  wickler: mmWickler,
  pulper: mmPulper,
  papier: mmPapier,
  brikett: mmBrikett,
  brunnen: mmBrunnen,
  leitung: mmLeitung,
  wasserweiche: mmWasserweiche,
  plattform: mmPlattform,
  treppe: mmTreppe,
  gelaender: mmGelaender,
  wand: mmWand,
  dach: mmDach,
  lampe: mmLampe,
  staffelei: mmStaffelei,
  schrank: mmSchrank,
  heutreppe: mmHeutreppe,
  heulift: mmHeulift,
  klappe: mmKlappe,
};

/* ------------------------------------------------------------ Nachbearbeitung */

/** Trägt o oder etwas darunter einen Namen? Dann bleibt der Knoten bestehen. */
function mmBenannt(o) {
  if (o.name) return true;
  for (const k of o.children) if (mmBenannt(k)) return true;
  return false;
}

/**
 * Starre Teile zusammenfassen: unbenannte Untergruppen ohne benannte Kinder
 * lösen sich in ihre Eltern auf, danach werden unbenannte Netze je Werkstoff
 * verschmolzen. Benannte Knoten (und damit alle Drehpunkte) bleiben erhalten.
 */
function mmVerschmelzen(o) {
  for (const k of [...o.children]) mmVerschmelzen(k);
  for (const k of [...o.children]) {
    if (k.isMesh || mmBenannt(k)) continue;
    k.updateMatrix();
    for (const e of [...k.children]) {
      e.updateMatrix();
      e.matrix.premultiply(k.matrix);
      e.matrix.decompose(e.position, e.quaternion, e.scale);
      o.add(e);
    }
    o.remove(k);
  }
  const nachWerkstoff = new Map();
  for (const k of o.children) {
    if (!k.isMesh || k.name || k.children.length || Array.isArray(k.material)) continue;
    if (!nachWerkstoff.has(k.material)) nachWerkstoff.set(k.material, []);
    nachWerkstoff.get(k.material).push(k);
  }
  for (const [mat, netze] of nachWerkstoff) {
    if (netze.length < 2) continue;
    const geos = netze.map((n) => {
      n.updateMatrix();
      const geo = n.geometry.clone();
      geo.applyMatrix4(n.matrix);
      return geo;
    });
    const neu = new THREE.Mesh(mmGeoZusammen(geos), mat);
    for (const n of netze) {
      o.remove(n);
      n.geometry.dispose();
    }
    for (const geo of geos) geo.dispose();
    o.add(neu);
  }
}

/** Vorlage fertigstellen: verschmelzen, Schatten an. */
function mmFertig(g, verschmelzen = true) {
  if (verschmelzen) mmVerschmelzen(g);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** Kopie einer Vorlage: Geometrie und Werkstoffe geteilt, eigene Werkstoffe kopiert. */
function mmKopie(vorlage, schatten = true) {
  const g = vorlage.clone(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.userData.eigen) o.material = o.material.clone();
    o.castShadow = schatten;
    o.receiveShadow = schatten;
  });
  return g;
}

const MM_VORLAGEN = new Map();

/* ------------------------------------------------------------ Schnittstelle */

/**
 * Neue Gruppe für einen Bautyp aus BAUTEN. Ursprung: Mitte des Fußabdrucks auf
 * dem Boden, lokal +x = vorn/Auslauf. optionen: { qualitaet, schatten = true,
 * verschmelzen = true }. Jeder Typ wird einmal gebaut und dann geklont.
 *
 * Benannte Teile (die ersten Treffer beim Durchlaufen zählen):
 *   arm, vorrangarm  drehteller (y; Ursprung am Boden), schulter (Drehpunkt,
 *                    position.y = Schulterhöhe, userData.laenge), ellbogen
 *                    (userData.laenge), handgelenk (Hand zeigt entlang +x),
 *                    greifer (Kinder: finger1, finger2; rotation.x öffnet),
 *                    ladepunkt, bake (leuchtet), bakeMast, anzeige
 *   rechen           kolben, kamm (Geschwister; je bis 0,55 m nach +x, kamm kippt um z)
 *   generator        feuer (Flammen, Drehpunkt unten), rauchPunkt, anzeige, heufuellung (scale.y)
 *   scanner          trommel (dreht um x), lampe, anzeige     radar   schuessel (y), anzeige
 *   presse, brikett  stempel (fährt bis 0,3 m nach unten), anzeige
 *   pellet           scheibe (y)          wickler  ring (x)        pulper  ruehrer (y), fuellung
 *   papier           walzen (Kinder „walze“, je um z), dampfPunkt
 *   brunnen          pumpe (wippt um z), anzeige                weiche  klappe (y)
 *   rohrwerfer       rohr (dreht um y)    heulift  korb (y 0,3…2,5)  heutreppe anzeige
 *   lampe            schirm (leuchtet)    staffelei leinwand, bild (Ebene nach +x, eigener Werkstoff)
 *   klappe           deckel (z, negativ öffnet)
 *   mast             lampe, hebel         drohnenstation lampe
 * Leuchtteile haben je Modell einen eigenen Werkstoff.
 * userData: typ, ports {ein, aus: [[x, y, z]]}, leitung [x, y, z] (Drahtpunkt,
 * bei Stromverbrauchern, Generator und Mast), wasser [[x, y, z]] (Rohranschlüsse).
 */
export function maschinenModell(typ, optionen = {}) {
  const verschmelzen = optionen.verschmelzen !== false;
  const schluessel = verschmelzen ? typ : `${typ}:roh`;
  let vorlage = MM_VORLAGEN.get(schluessel);
  if (!vorlage) {
    const bauer = MM_BAUER[typ];
    vorlage = bauer ? bauer() : mmErsatz(typ);
    vorlage.name = `mm-${typ}`;
    vorlage.userData.typ = typ;
    mmAnschluesse(vorlage, typ);
    mmFertig(vorlage, verschmelzen);
    MM_VORLAGEN.set(schluessel, vorlage);
  }
  return mmKopie(vorlage, optionen.schatten !== false);
}

/**
 * Lieferlaster, knapp 6 m lang, fährt vorwärts entlang lokal +x. Die Pritsche
 * liegt hinten (−x) und ist hinten offen: Oberkante 1,05 m, 2,1 m breit, von
 * x = −3,4 bis −0,1 (wie LASTER_BETT, wenn der Laster rückwärts am Tor steht).
 * Räder rad1…rad4 drehen um z; ladeflaeche ist ein Punkt auf dem Pritschenboden.
 */
export function lasterModell() {
  let vorlage = MM_VORLAGEN.get('laster');
  if (!vorlage) {
    vorlage = mmLaster();
    MM_VORLAGEN.set('laster', vorlage);
  }
  return mmKopie(vorlage);
}

function mmLaster() {
  const g = new THREE.Group();
  g.name = 'mm-laster';
  const R = 0.45;
  let nr = 1;
  for (const x of [-2.35, 1.85]) {
    for (const s of [-1, 1]) {
      const rad = mmTeil(g, `rad${nr++}`, x, R, s * 0.86);
      mmZ(rad, R, 0.3, mmMat('reifen'), 'z', 0, 0, 0, 18);
      mmZ(rad, 0.28, 0.31, mmMat('felge'), 'z', 0, 0, 0, 14);
      mmZ(rad, 0.1, 0.33, mmMat('stahlDunkel'), 'z', 0, 0, 0, 8);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        mmZ(rad, 0.02, 0.34, mmMat('stahlDunkel'), 'z', Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0, 6);
      }
    }
  }
  // Rahmen, Stoßstange hinten mit Leuchten und Kennzeichen
  for (const s of [-1, 1]) mmQ(g, 5.9, 0.2, 0.12, mmMat('dunkel'), -0.5, 0.72, s * 0.42);
  mmQ(g, 0.1, 0.16, 2.0, mmMat('dunkel'), -3.45, 0.62, 0);
  for (const s of [-1, 1]) mmQ(g, 0.04, 0.1, 0.16, mmMat('ruecklicht'), -3.51, 0.62, s * 0.82);
  mmQ(g, 0.01, 0.11, 0.5, mmMat('markierung'), -3.506, 0.62, 0);
  // Pritsche mit Bordwänden, Heckklappe abgeklappt
  mmQ(g, 3.3, 0.08, 2.1, mmMat('holzDunkel'), -1.75, 1.01, 0);
  for (let i = 0; i < 6; i++) mmQ(g, 3.3, 0.004, 0.02, mmMat('dunkel'), -1.75, 1.052, -0.875 + i * 0.35);
  for (const x of [-3.2, -2.5, -1.8, -1.1, -0.4]) mmQ(g, 0.08, 0.14, 2.0, mmMat('dunkel'), x, 0.9, 0);
  for (const s of [-1, 1]) {
    mmQ(g, 3.3, 0.4, 0.05, mmMat('stahl'), -1.75, 1.25, s * 1.03);
    for (const y of [1.15, 1.33]) mmQ(g, 3.3, 0.03, 0.02, mmMat('stahlDunkel'), -1.75, y, s * 1.06);
    for (const x of [-3.37, -1.75, -0.13]) mmQ(g, 0.06, 0.44, 0.07, mmMat('dunkel'), x, 1.27, s * 1.03);
    mmQ(g, 0.02, 0.38, 0.34, mmMat('schwarz'), -2.9, 0.55, s * 0.86);
  }
  mmQ(g, 0.05, 0.36, 2.0, mmMat('stahl'), -3.43, 0.85, 0);
  mmQ(g, 0.06, 0.55, 2.1, mmMat('stahl'), -0.1, 1.325, 0);
  for (let i = 0; i < 6; i++) mmQ(g, 0.04, 0.5, 0.04, mmMat('dunkel'), -0.1, 1.85, -0.9 + i * 0.36);
  mmQ(g, 0.05, 0.05, 2.1, mmMat('dunkel'), -0.1, 2.1, 0);
  mmPunkt(g, 'ladeflaeche', -1.75, 1.05, 0);
  // Führerhaus mit weißem Dach
  mmQ(g, 1.5, 0.85, 2.0, mmMat('lasterRot'), 0.75, 1.225, 0);
  mmQ(g, 1.3, 0.66, 1.9, mmMat('lasterRot'), 0.7, 1.98, 0);
  mmQ(g, 1.36, 0.06, 1.94, mmMat('weiss'), 0.7, 2.34, 0);
  for (const s of [-1, 1]) {
    for (const x of [0.4, 1.02]) mmQ(g, 0.52, 0.45, 0.01, mmMat('glas'), x, 2.0, s * 0.955);
    mmQ(g, 0.012, 0.8, 0.008, mmMat('schwarz'), 0.72, 1.23, s * 1.004);
    mmQ(g, 0.12, 0.03, 0.03, mmMat('stahl'), 0.55, 1.52, s * 1.015);
    mmQ(g, 0.04, 0.22, 0.14, mmMat('schwarz'), 1.4, 1.95, s * 1.12);
    mmStab(g, [1.37, 1.85, s * 0.98], [1.4, 1.9, s * 1.1], 0.012, mmMat('schwarz'));
    mmQ(g, 0.4, 0.04, 0.2, mmMat('stahlDunkel'), 0.75, 0.65, s * 1.02);
  }
  mmQ(g, 0.01, 0.48, 1.7, mmMat('glas'), 1.355, 2.0, 0);
  mmQ(g, 0.01, 0.35, 1.5, mmMat('glas'), 0.045, 2.02, 0);
  // Motorhaube, Kühlergrill, Kotflügel mit Scheinwerfern, Stoßstange
  mmQ(g, 0.85, 0.6, 1.24, mmMat('lasterRot'), 1.925, 1.15, 0);
  mmQ(g, 0.85, 0.04, 1.1, mmMat('lasterRot'), 1.925, 1.47, 0);
  mmQ(g, 0.04, 0.45, 1.0, mmMat('schwarz'), 2.37, 1.14, 0);
  for (const y of [0.9, 1.39]) mmQ(g, 0.05, 0.05, 1.08, mmMat('chrom'), 2.38, y, 0);
  for (let i = 0; i < 5; i++) mmQ(g, 0.03, 0.44, 0.03, mmMat('chrom'), 2.39, 1.14, -0.4 + i * 0.2);
  for (const s of [-1, 1]) {
    mmQ(g, 0.55, 0.05, 0.36, mmMat('lasterRot'), 1.85, 1.02, s * 0.84);
    mmBrett(g, [2.12, 1.02, s * 0.84], [2.36, 0.72, s * 0.84], 0.05, 0.36, mmMat('lasterRot'));
    mmZ(g, 0.1, 0.06, mmMat('chrom'), 'x', 2.18, 1.14, s * 0.84, 12);
    mmZ(g, 0.085, 0.02, mmMat('scheinwerfer'), 'x', 2.22, 1.14, s * 0.84, 12);
  }
  mmQ(g, 0.12, 0.16, 2.0, mmMat('stahlDunkel'), 2.45, 0.62, 0);
  // Auspuff, Tank
  mmZ(g, 0.045, 1.5, mmMat('chrom'), 'y', 0.06, 1.75, 1.04, 10);
  mmZ(g, 0.17, 0.6, mmMat('stahl'), 'x', 0.7, 0.55, 0.7, 12);
  return mmFertig(g);
}

/**
 * Heudrohne, etwa 0,5 m über die Rotoren: rotor1…rotor4 drehen um y,
 * ladung ist der Punkt unter dem Rumpf für das getragene Heu, licht leuchtet.
 */
export function drohnenModell() {
  let vorlage = MM_VORLAGEN.get('drohne');
  if (!vorlage) {
    vorlage = mmDrohne();
    MM_VORLAGEN.set('drohne', vorlage);
  }
  return mmKopie(vorlage);
}

function mmDrohne() {
  const g = new THREE.Group();
  g.name = 'mm-drohne';
  mmQ(g, 0.16, 0.05, 0.12, mmMat('schwarz'), 0, 0, 0);
  mmKuppel(g, 0.085, 0.035, mmMat('orange'), 0, 0.025, 0, 12);
  mmKugel(g, 0.022, mmMat('glas'), 0.07, -0.03, 0, 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.141;
    const z = Math.sin(a) * 0.141;
    mmQ(g, 0.2, 0.018, 0.022, mmMat('dunkel'), x / 2, 0, z / 2).rotation.y = -a;
    mmZ(g, 0.022, 0.035, mmMat('stahlDunkel'), 'y', x, 0.018, z, 10);
    mmTorus(g, 0.1, 0.005, mmMat('orange'), 'y', x, 0.04, z, 16, 3);
    const rotor = mmTeil(g, `rotor${i + 1}`, x, 0.042, z);
    mmQ(rotor, 0.19, 0.004, 0.022, mmMat('schwarz'), 0, 0, 0).rotation.x = 0.12;
    mmZ(rotor, 0.012, 0.012, mmMat('stahl'), 'y', 0, 0.004, 0, 8);
  }
  for (const s of [-1, 1]) {
    mmZ(g, 0.006, 0.2, mmMat('dunkel'), 'x', 0, -0.075, s * 0.06, 5);
    for (const x of [-0.05, 0.05]) mmStab(g, [x, -0.02, s * 0.04], [x, -0.075, s * 0.06], 0.004, mmMat('dunkel'), 4);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mmStab(g, [0, -0.025, 0], [Math.cos(a) * 0.04, -0.1, Math.sin(a) * 0.04], 0.004, mmMat('stahl'), 4);
  }
  mmPunkt(g, 'ladung', 0, -0.12, 0);
  const licht = mmZ(g, 0.01, 0.01, mmLeucht('gruen'), 'x', 0.082, 0.0, 0, 8);
  licht.name = 'licht';
  return mmFertig(g);
}
