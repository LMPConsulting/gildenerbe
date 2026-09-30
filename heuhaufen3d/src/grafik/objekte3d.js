// Alles Gebaute in 3D: Bänder als Profil entlang ihrer Bahn mit laufendem
// Gummi, Maschinen (Modelle aus maschinenmodelle.js, bewegt nach ihrem
// Zustand), Stücke als Instanzen, Stromleitungen mit Durchhang, der Laster
// am Tor, Heudrohnen, der Radarstrahl. Dazu der grüne Baugeist, die
// Bandvorschau, Einrastpunkte und die Markierung beim Abbauen.

import * as THREE from '../../vendor/three.module.min.js';
import { BAU_BY_ID, BAND_Y, lauf, lokalZuWelt } from '../welt.js';
import { bandGeometrie, bandBahn } from '../baender.js';
import { GROESSE } from '../gegenstaende.js';
import { greiferPunkt, innenPunkt, BRENN_MAX } from '../maschinen.js';
import { lasterLage, LASTER_BETT } from '../laster.js';
import { drohnenListe } from '../drohnen.js';
import { bauVersion, auflageBei } from '../bauen.js';
import { werte } from '../wirtschaft.js';
import { gegenstandGeometrien, GEGENSTAND_FARBEN } from './modelle.js';
import { maschinenModell, lasterModell, drohnenModell } from './maschinenmodelle.js';
import { skizzeMalen } from '../ui/skizze.js';

/* ------------------------------------------------------------ Hilfen */

/** Gummiband mit Querrippen; läuft über den Versatz der Textur. */
function objBandTextur() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2a2c';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#3b3b3e';
    g.fillRect(4, i * 32 + 4, 56, 7);
    g.fillStyle = '#1d1d1f';
    g.fillRect(4, i * 32 + 11, 56, 2);
  }
  g.fillStyle = '#19191a';
  g.fillRect(0, 0, 4, 128);
  g.fillRect(60, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Warnzeichen über Maschinen ohne Strom (wie die Alarmmarken im Vorbild). */
function objWarnTextur() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8412c';
  g.beginPath(); g.moveTo(32, 4); g.lineTo(61, 58); g.lineTo(3, 58); g.closePath(); g.fill();
  g.fillStyle = '#fff';
  g.fillRect(29, 20, 6, 22);
  g.fillRect(29, 46, 6, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function objRauchTextur() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(120,118,112,0.55)');
  r.addColorStop(1, 'rgba(120,118,112,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Ein Profil (Liste von [seitlich, hoch]) entlang einer Bahn ([x, y, z]) ziehen.
 * uvLaenge: Meter je Texturwiederholung entlang der Bahn.
 */
function objExtrudieren(bahn, profil, uvLaenge = 1) {
  const n = bahn.length;
  const m = profil.length;
  const pos = new Float32Array(n * m * 3);
  const uv = new Float32Array(n * m * 2);
  let laenge = 0;
  for (let i = 0; i < n; i++) {
    const p = bahn[i];
    const a = bahn[Math.max(0, i - 1)];
    const b = bahn[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let tz = b[2] - a[2];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    // links von der Laufrichtung
    const nx = tz;
    const nz = -tx;
    if (i > 0) laenge += Math.hypot(p[0] - bahn[i - 1][0], p[1] - bahn[i - 1][1], p[2] - bahn[i - 1][2]);
    for (let j = 0; j < m; j++) {
      const [l, h] = profil[j];
      const k = (i * m + j) * 3;
      pos[k] = p[0] + nx * l;
      pos[k + 1] = p[1] + h;
      pos[k + 2] = p[2] + nz * l;
      uv[(i * m + j) * 2] = j / (m - 1);
      uv[(i * m + j) * 2 + 1] = laenge / uvLaenge;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j; const b = a + 1; const c = a + m; const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Mehrere Geometrien zu einer (Position, Normale, UV wenn alle eine haben). */
function objVereinen(liste) {
  let anzahl = 0;
  for (const g of liste) anzahl += g.attributes.position.count;
  const mitUv = liste.every((g) => g.attributes.uv);
  const pos = new Float32Array(anzahl * 3);
  const nor = new Float32Array(anzahl * 3);
  const uv = mitUv ? new Float32Array(anzahl * 2) : null;
  const idx = [];
  let o = 0;
  for (const g of liste) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) for (const i of g.index.array) idx.push(i + o);
    else for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + o);
    o += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/**
 * Alles Unbewegliche eines Modells (Teile ohne Namen) je Material zu einem Netz
 * verschmelzen: aus zwanzig Zeichenaufrufen werden drei oder vier.
 */
function objVereinfachen(wurzel) {
  wurzel.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(wurzel.matrixWorld).invert();
  const gruppen = new Map();
  const weg = [];
  wurzel.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    for (let p = o; p && p !== wurzel; p = p.parent) if (p.name) return;
    if (Array.isArray(o.material) || o.material.transparent) return;
    const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!gruppen.has(o.material)) gruppen.set(o.material, []);
    gruppen.get(o.material).push(g);
    weg.push(o);
  });
  for (const o of weg) o.parent.remove(o);
  for (const [mat, geos] of gruppen) {
    // UV nur behalten, wenn das Material eine Textur zeigt
    if (!mat.map) for (const g of geos) if (g.attributes.uv) g.deleteAttribute('uv');
    const m = new THREE.Mesh(objVereinen(geos), mat);
    m.userData.verschmolzen = true;
    wurzel.add(m);
  }
  return wurzel;
}

/** Vorlagen je Bauart: einmal gebaut und vereinfacht, danach nur noch geklont. */
const OBJ_VORLAGEN = new Map();
function objModell(typ, qualitaet) {
  if (!OBJ_VORLAGEN.has(typ)) OBJ_VORLAGEN.set(typ, objVereinfachen(maschinenModell(typ, { qualitaet })));
  const obj = OBJ_VORLAGEN.get(typ).clone(true);
  // Bewegliche Teile mit leuchtendem Material brauchen je Maschine ein eigenes
  obj.traverse((o) => {
    if (!o.isMesh || o.userData.verschmolzen) return;
    if (o.material && o.material.emissive) o.material = o.material.clone();
  });
  return obj;
}

function objHologramm(ok) {
  return new THREE.MeshBasicMaterial({
    color: ok ? 0x4dff88 : 0xff4d3a, transparent: true, opacity: 0.38, depthWrite: false,
  });
}

/** Alle Materialien einer Gruppe durch eines ersetzen (für den Baugeist). */
function objEinfaerben(obj, material) {
  obj.traverse((o) => {
    if (o.isMesh) { o.material = material; o.castShadow = false; o.receiveShadow = false; }
    if (o.isLight) o.visible = false;
  });
}

/** Kettenlinie zwischen zwei Aufhängepunkten. */
function objDurchhang(a, b, tiefe, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * tiefe, a[2] + (b[2] - a[2]) * t));
  }
  return pts;
}

/* ------------------------------------------------------------ Bänder */

const BAND_PROFIL_GURT = [[0.3, 0], [-0.3, 0]];
const BAND_PROFIL_RAHMEN = [[0.36, 0.06], [0.36, -0.14], [0.3, -0.16], [-0.3, -0.16], [-0.36, -0.14], [-0.36, 0.06]];

/* ------------------------------------------------------------ Aufbau */

export function objekteBauen(szene, qualitaet = 'mittel') {
  const wurzel = new THREE.Group();
  wurzel.name = 'objekte';
  szene.add(wurzel);
  const bautenGruppe = new THREE.Group();
  const vorschauGruppe = new THREE.Group();
  wurzel.add(bautenGruppe, vorschauGruppe);
  const schatten = qualitaet !== 'niedrig';

  const bandTex = objBandTextur();
  const MAT = {
    gurt: new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.92, metalness: 0 }),
    rahmen: new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.5, metalness: 0.55 }),
    bein: new THREE.MeshStandardMaterial({ color: 0x5b6066, roughness: 0.6, metalness: 0.4 }),
    rolle: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.6 }),
    leitung: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }),
    rohr: new THREE.MeshStandardMaterial({ color: 0x3d6fa8, roughness: 0.45, metalness: 0.3 }),
    wand: new THREE.MeshStandardMaterial({ color: 0x9c7349, roughness: 0.85 }),
    gelaender: new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.5, metalness: 0.3 }),
  };

  /* -------------------------------- Stücke (Instanzen) */
  const geos = gegenstandGeometrien();
  const GEO_FUER = {
    roh: geos.buendel, knaeuel: geos.knaeuel, ballen: geos.ballen, pellet: geos.pellet, brei: geos.brei,
    silage: geos.silage, papier: geos.papier, brikett: geos.ziegel,
  };
  const MAX_STUECKE = 700;
  const stueckMeshes = {};
  for (const [art, geo] of Object.entries(GEO_FUER)) {
    const m = new THREE.MeshStandardMaterial({ color: GEGENSTAND_FARBEN[art], roughness: art === 'silage' ? 0.35 : 0.95 });
    // Die Heubündel leuchten im Vorbild leicht orange-golden
    if (art === 'roh' || art === 'knaeuel') { m.emissive.setHex(0x6a3000); m.emissiveIntensity = 0.35; }
    const im = new THREE.InstancedMesh(geo, m, MAX_STUECKE);
    im.count = 0;
    im.castShadow = schatten;
    im.receiveShadow = false;
    im.frustumCulled = false;
    im.name = `stuecke-${art}`;
    wurzel.add(im);
    stueckMeshes[art] = im;
  }
  const glanzTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,240,180,0.8)');
    r.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(31, 2, 2, 60);
    g.fillRect(2, 31, 60, 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glanzMat = new THREE.SpriteMaterial({ map: glanzTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glanzPool = Array.from({ length: 8 }, () => {
    const sp = new THREE.Sprite(glanzMat);
    sp.scale.setScalar(0.35);
    sp.visible = false;
    wurzel.add(sp);
    return sp;
  });

  /* -------------------------------- Warnmarken, Rauch */
  const warnMat = new THREE.SpriteMaterial({ map: objWarnTextur(), transparent: true, depthWrite: false });
  const rauchMat = new THREE.SpriteMaterial({ map: objRauchTextur(), transparent: true, depthWrite: false });
  const rauch = Array.from({ length: 36 }, () => {
    const sp = new THREE.Sprite(rauchMat.clone());
    sp.visible = false;
    wurzel.add(sp);
    return { sp, t: 0, leben: 0, vx: 0, vz: 0 };
  });
  let rauchNaechster = 0;

  /* -------------------------------- Radarstrahl */
  const radarMat = new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const radarStrahl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 16, 1, true), radarMat);
  radarStrahl.visible = false;
  wurzel.add(radarStrahl);

  /* -------------------------------- Laster */
  const laster = lasterModell();
  laster.visible = false;
  wurzel.add(laster);
  laster.traverse((o) => { if (o.isMesh) { o.castShadow = schatten; o.receiveShadow = schatten; } });
  const lasterRaeder = [];
  laster.traverse((o) => { if (o.name && o.name.startsWith('rad')) lasterRaeder.push(o); });
  const ladung = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), new THREE.MeshStandardMaterial({ color: 0xe0a846, roughness: 0.95 }), 48);
  ladung.count = 0;
  ladung.frustumCulled = false;
  wurzel.add(ladung);

  /* -------------------------------- Lampenlicht */
  // Feste Zahl an Lichtern, die den nächsten Lampen folgen: sonst übersetzt three.js
  // bei jeder neuen Lampe alle Shader neu.
  const lichtPool = Array.from({ length: qualitaet === 'niedrig' ? 0 : 3 }, () => {
    const l = new THREE.PointLight(0xffe2b0, 0, 10, 1.6);
    wurzel.add(l);
    return l;
  });
  const lichtVec = new THREE.Vector3();
  function lichterVerteilen(kamera) {
    if (!lichtPool.length) return;
    const sortiert = lampenLichter
      .filter((e) => (e.hell || 0) > 0.01)
      .map((e) => ({ e, d: kamera ? kamera.position.distanceToSquared(lichtVec.set(e.bau.x, 1.5, e.bau.z)) : 0 }))
      .sort((a, b) => a.d - b.d);
    lichtPool.forEach((licht, i) => {
      const x = sortiert[i];
      if (!x) { licht.intensity = 0; return; }
      licht.position.set(x.e.bau.x, (x.e.bau.y || 0) + BAU_BY_ID.lampe.h - 0.25, x.e.bau.z);
      licht.intensity = x.e.hell * 7;
    });
  }

  /* -------------------------------- Drohnen */
  const drohnenVorlage = drohnenModell();
  const drohnen = [];

  /* -------------------------------- Leitungen */
  let leitungen = null;
  let leitungsQuelle = null;

  /* -------------------------------- Bauten */
  const eintraege = new Map();
  let version = -1;
  let ersterAbgleich = true;
  const aufbauEffekte = [];
  const lampenLichter = [];
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const vec = new THREE.Vector3();
  const skal = new THREE.Vector3();
  const euler = new THREE.Euler();
  const achseY = new THREE.Vector3(0, 1, 0);

  function bandObjekt(bau, s) {
    const g = new THREE.Group();
    const { bahn, laenge } = bandGeometrie(bau);
    const gurt = new THREE.Mesh(objExtrudieren(bahn, BAND_PROFIL_GURT, 0.5), MAT.gurt);
    gurt.receiveShadow = schatten;
    g.add(gurt);
    // Rahmen, Beine und Rollen teilen sich ein Material: ein Zeichenaufruf statt drei
    const stahlTeile = [objExtrudieren(bahn, BAND_PROFIL_RAHMEN, 1)];
    // Beine alle 1,6 m, Rollen an beiden Enden
    const beine = [];
    const rollen = [];
    const probe = (t) => {
      let s0 = 0;
      for (let i = 1; i < bahn.length; i++) {
        const a = bahn[i - 1]; const b = bahn[i];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        if (s0 + l >= t) {
          const u = l > 0 ? (t - s0) / l : 0;
          return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], d: [(b[0] - a[0]) / (l || 1), (b[2] - a[2]) / (l || 1)] };
        }
        s0 += l;
      }
      const a = bahn[bahn.length - 2] || bahn[0]; const b = bahn[bahn.length - 1];
      const l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      return { p: b, d: [(b[0] - a[0]) / l, (b[2] - a[2]) / l] };
    };
    const schritte = Math.max(1, Math.round(laenge / 1.6));
    for (let i = 0; i <= schritte; i++) {
      const { p, d } = probe((laenge * i) / schritte);
      // Beine bis zum Boden darunter: Hallenboden oder Plattform
      const unten = s ? auflageBei(s, p[0], p[2], p[1] - 0.3) : 0;
      const hoehe = p[1] - 0.16 - unten;
      if (hoehe < 0.05) continue;
      for (const seite of [-0.31, 0.31]) {
        const bg = new THREE.BoxGeometry(0.05, hoehe, 0.05);
        bg.translate(p[0] + d[1] * seite, unten + hoehe / 2, p[2] - d[0] * seite);
        beine.push(bg);
      }
    }
    for (const t of [0.06, laenge - 0.06]) {
      const { p, d } = probe(Math.max(0, t));
      const rg = new THREE.CylinderGeometry(0.07, 0.07, 0.64, 10);
      rg.rotateZ(Math.PI / 2);
      rg.rotateY(Math.atan2(-d[1], d[0]) + Math.PI / 2);
      rg.translate(p[0], p[1] - 0.06, p[2]);
      rollen.push(rg);
    }
    const rahmen = new THREE.Mesh(objVereinen([...stahlTeile, ...beine, ...rollen]), MAT.rahmen);
    rahmen.castShadow = schatten;
    rahmen.receiveShadow = schatten;
    g.add(rahmen);
    return g;
  }

  function linienObjekt(bau) {
    const d = BAU_BY_ID[bau.typ];
    const g = new THREE.Group();
    const l = Math.hypot(bau.b[0] - bau.a[0], bau.b[1] - bau.a[1]);
    const w = Math.atan2(-(bau.b[1] - bau.a[1]), bau.b[0] - bau.a[0]);
    const mx = (bau.a[0] + bau.b[0]) / 2;
    const mz = (bau.a[1] + bau.b[1]) / 2;
    const y0 = bau.y || 0;
    if (bau.typ === 'leitung') {
      const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, l, 10), MAT.rohr);
      rohr.rotation.z = Math.PI / 2;
      const halter = new THREE.Group();
      halter.add(rohr);
      halter.position.set(mx, y0 + 0.2, mz);
      halter.rotation.y = w;
      g.add(halter);
      return g;
    }
    const halter = new THREE.Group();
    halter.position.set(mx, y0, mz);
    halter.rotation.y = w;
    g.add(halter);
    if (bau.typ === 'wand') {
      const platte = new THREE.Mesh(new THREE.BoxGeometry(l, d.h, d.b), MAT.wand);
      platte.position.y = d.h / 2;
      platte.castShadow = schatten; platte.receiveShadow = schatten;
      halter.add(platte);
    } else {
      for (const y of [0.5, 1.0]) {
        const holm = new THREE.Mesh(new THREE.BoxGeometry(l, 0.05, 0.05), MAT.gelaender);
        holm.position.y = y;
        halter.add(holm);
      }
      const n = Math.max(1, Math.round(l / 1.2));
      for (let i = 0; i <= n; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), MAT.gelaender);
        p.position.set(-l / 2 + (l * i) / n, 0.5, 0);
        halter.add(p);
      }
    }
    return g;
  }

  function bauObjekt(bau, s) {
    let obj;
    if (bau.typ === 'band') obj = bandObjekt(bau, s);
    else if (BAU_BY_ID[bau.typ].linie && bau.a) obj = linienObjekt(bau);
    else {
      obj = objModell(bau.typ, qualitaet);
      obj.position.set(bau.x, bau.y || 0, bau.z);
      obj.rotation.y = bau.rot || 0;
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = schatten; o.receiveShadow = schatten; } });
      const warn = new THREE.Sprite(warnMat);
      warn.name = 'warnmarke';
      warn.raycast = () => {}; // nicht anklickbar
      warn.scale.setScalar(0.42);
      warn.position.set(0, BAU_BY_ID[bau.typ].h + 0.45, 0);
      warn.visible = false;
      obj.add(warn);
    }
    if (bau.typ === 'band' || (BAU_BY_ID[bau.typ].linie && bau.a)) obj.traverse((o) => { if (o.isMesh) o.userData.eigen = true; });
    obj.userData.bauId = bau.id;
    obj.traverse((o) => { o.userData.bauId = bau.id; });
    return obj;
  }

  const schluesselVon = (bau) => (bau.typ === 'band'
    ? `b|${bau.punkte.length}|${bau.punkte[0].join(',')}|${bau.punkte[bau.punkte.length - 1].join(',')}`
    : `m|${bau.typ}|${bau.x}|${bau.z}|${bau.y || 0}|${bau.rot || 0}|${bau.a ? bau.a.join(',') + bau.b.join(',') : ''}`);


  function abgleichen(s) {
    const v = bauVersion(s);
    if (v === version && eintraege.size === s.bauten.length) return;
    version = v;
    const da = new Set();
    for (const bau of s.bauten) {
      da.add(bau.id);
      const e = eintraege.get(bau.id);
      const k = schluesselVon(bau);
      if (e && e.schluessel === k && e.bau === bau) continue;
      if (e) { bautenGruppe.remove(e.obj); entsorgen(e.obj); }
      const obj = bauObjekt(bau, s);
      bautenGruppe.add(obj);
      eintraege.set(bau.id, { bau, obj, schluessel: k, teile: teileSuchen(obj) });
      if (!ersterAbgleich) aufbauEffekt(obj);
    }
    for (const [id, e] of eintraege) {
      if (!da.has(id)) { bautenGruppe.remove(e.obj); entsorgen(e.obj); eintraege.delete(id); }
    }
    lampenLichter.length = 0;
    for (const e of eintraege.values()) if (e.bau.typ === 'lampe') lampenLichter.push(e);
    ersterAbgleich = false;
  }

  /** Eigene Geometrien (Bänder, Linien) freigeben; Maschinen teilen ihre mit der Vorlage. */
  function entsorgen(obj) {
    obj.traverse((o) => { if (o.isMesh && o.userData.eigen) o.geometry.dispose(); });
  }

  function teileSuchen(obj) {
    const t = {};
    obj.traverse((o) => { if (o.name && !(o.name in t)) t[o.name] = o; });
    return t;
  }

  /** Der Aufbau-Effekt: kurz ein grünes Hologramm, das sich in die Maschine auflöst. */
  function aufbauEffekt(obj) {
    const geist = obj.clone(true);
    const mat = objHologramm(true);
    objEinfaerben(geist, mat);
    geist.scale.multiplyScalar(1.02);
    vorschauGruppe.add(geist);
    aufbauEffekte.push({ geist, mat, t: 0, obj });
    obj.scale.setScalar(0.94);
  }

  /* -------------------------------- Bewegung der Maschinen */
  function maschineBewegen(e, s, dt, zeit) {
    const { bau, obj, teile } = e;
    const l = lauf(bau);
    const d = BAU_BY_ID[bau.typ];
    const laeuft = l.status === 'laeuft' || l.status === 'prueft';
    if (teile.warnmarke) {
      const zeigen = l.status === 'strom' && !bau.aus;
      teile.warnmarke.visible = zeigen && Math.floor(zeit * 2.5) % 2 === 0;
    }
    switch (bau.typ) {
      case 'rechen': {
        const p = l.phase || 0;
        // Kolben fährt aus (0..0.5) und zieht zurück (0.5..1)
        const hub = laeuft ? (p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5) : 0;
        if (teile.kolben) teile.kolben.position.x = (teile.kolben.userData.x0 ?? (teile.kolben.userData.x0 = teile.kolben.position.x)) + hub * 0.55;
        if (teile.kamm) {
          teile.kamm.position.x = (teile.kamm.userData.x0 ?? (teile.kamm.userData.x0 = teile.kamm.position.x)) + hub * 0.55;
          teile.kamm.rotation.z = laeuft && p > 0.5 ? -0.35 * Math.sin(((p - 0.5) / 0.5) * Math.PI) : 0;
        }
        break;
      }
      case 'arm': case 'vorrangarm': {
        armStellen(bau, obj, teile, dt);
        if (teile.bake) {
          const m = teile.bake.material;
          if (m && m.emissive) m.emissiveIntensity = laeuft ? 0.6 + 0.6 * Math.max(0, Math.sin(zeit * 8)) : 0.1;
        }
        break;
      }
      case 'generator': {
        const brennt = !!l.brennt;
        if (teile.feuer) {
          teile.feuer.visible = brennt;
          const f = 0.8 + 0.2 * Math.sin(zeit * 17) + 0.15 * Math.sin(zeit * 29);
          teile.feuer.scale.setScalar(brennt ? f : 0.01);
          if (teile.feuer.material && teile.feuer.material.emissive) teile.feuer.material.emissiveIntensity = brennt ? 1.2 * f : 0;
        }
        if (teile.heufuellung) teile.heufuellung.scale.y = 0.1 + 0.9 * Math.min(1, (bau.brenn || 0) / BRENN_MAX);
        if (brennt && teile.rauchPunkt && Math.random() < dt * 5) {
          teile.rauchPunkt.getWorldPosition(vec);
          rauchAusstossen(vec.x, vec.y, vec.z);
        }
        break;
      }
      case 'scanner': {
        if (teile.trommel && laeuft) teile.trommel.rotation.x += dt * 5;
        if (teile.lampe && teile.lampe.material && teile.lampe.material.emissive) {
          const wartet = (bau.nadeln || []).length > 0;
          teile.lampe.material.emissive.setHex(wartet ? 0xffc400 : laeuft ? 0x3cff6a : 0x333333);
          teile.lampe.material.emissiveIntensity = wartet ? 1 + Math.sin(zeit * 6) * 0.6 : laeuft ? 1 : 0.2;
        }
        break;
      }
      case 'radar':
        if (teile.schuessel && laeuft) teile.schuessel.rotation.y += dt * 1.6;
        break;
      case 'presse': case 'brikett':
        if (teile.stempel) teile.stempel.position.y = (teile.stempel.userData.y0 ?? (teile.stempel.userData.y0 = teile.stempel.position.y)) - (laeuft ? (0.5 - 0.5 * Math.cos((bau.fort || 0) * Math.PI * 2)) * 0.3 : 0);
        break;
      case 'pellet':
        if (teile.scheibe && laeuft) teile.scheibe.rotation.y += dt * 9;
        break;
      case 'wickler':
        if (teile.ring && laeuft) teile.ring.rotation.x += dt * 4;
        break;
      case 'pulper':
        if (teile.ruehrer && laeuft) teile.ruehrer.rotation.y += dt * 3;
        break;
      case 'papier':
        if (teile.walzen && laeuft) teile.walzen.children.forEach((w) => { w.rotation.z += dt * 4; });
        break;
      case 'brunnen':
        if (teile.pumpe && laeuft) teile.pumpe.rotation.z = Math.sin(zeit * 3) * 0.35;
        break;
      case 'weiche':
        if (teile.klappe) {
          const ziel = (bau.modus === 'links' || bau.modus === 'vorrangLinks') ? 0.35 : (bau.modus === 'rechts' || bau.modus === 'vorrangRechts') ? -0.35 : (bau.seite ? -0.35 : 0.35);
          teile.klappe.rotation.y += (ziel - teile.klappe.rotation.y) * Math.min(1, dt * 8);
        }
        break;
      case 'rohrwerfer':
        if (teile.rohr) teile.rohr.rotation.y = bau.winkel || 0;
        break;
      case 'heulift':
        if (teile.korb && laeuft) teile.korb.position.y = 0.3 + ((zeit * 0.6) % 1) * 2.2;
        break;
      case 'staffelei': {
        // Das Bild an der Staffelei: neu malen, wenn sich etwas geändert hat
        const striche = bau.bild >= 0 && s.skizzen[bau.bild] ? s.skizzen[bau.bild].striche : (bau.striche || []);
        const letzter = striche[striche.length - 1];
        const schluessel = `${bau.bild}|${striche.length}|${letzter ? letzter.length : 0}`;
        if (teile.bild && e.bildSchluessel !== schluessel) {
          e.bildSchluessel = schluessel;
          if (!e.bildLeinwand) {
            e.bildLeinwand = document.createElement('canvas');
            e.bildLeinwand.width = 256; e.bildLeinwand.height = 192;
            e.bildTextur = new THREE.CanvasTexture(e.bildLeinwand);
            e.bildTextur.colorSpace = THREE.SRGBColorSpace;
            teile.bild.material = teile.bild.material.clone();
            teile.bild.material.map = e.bildTextur;
            teile.bild.material.color.setHex(0xffffff);
          }
          skizzeMalen(e.bildLeinwand.getContext('2d'), striche, 256, 192);
          e.bildTextur.needsUpdate = true;
        }
        break;
      }
      case 'lampe': {
        e.hell = (bau.aus ? 0 : (l.strom || 0)) * (bau.hell ?? 1);
        if (teile.schirm && teile.schirm.material && teile.schirm.material.emissive) teile.schirm.material.emissiveIntensity = e.hell * 1.5;
        break;
      }
      default:
        break;
    }
    if (d.kw > 0 && teile.anzeige && teile.anzeige.material && teile.anzeige.material.emissive) {
      teile.anzeige.material.emissive.setHex(l.status === 'strom' ? 0xff3322 : laeuft ? 0x33ff66 : 0xffaa22);
    }
  }

  /** Den Greifarm so stellen, dass der Greifer auf greiferPunkt zeigt (einfache Zwei-Glieder-Kinematik). */
  function armStellen(bau, obj, teile, dt) {
    const ziel = greiferPunkt(bau);
    const d = BAU_BY_ID[bau.typ];
    const basisY = (bau.y || 0) + (teile.schulter ? teile.schulter.position.y : d.h * 0.45);
    const dx = ziel[0] - bau.x;
    const dz = ziel[2] - bau.z;
    const weltWinkel = Math.atan2(-dz, dx);
    const drehung = weltWinkel - (bau.rot || 0);
    const r = Math.hypot(dx, dz);
    const h = ziel[1] - basisY;
    const l1 = teile.schulter && teile.schulter.userData.laenge ? teile.schulter.userData.laenge : 1.1;
    const l2 = teile.ellbogen && teile.ellbogen.userData.laenge ? teile.ellbogen.userData.laenge : 1.1;
    const dist = Math.min(l1 + l2 - 0.01, Math.max(0.2, Math.hypot(r, h)));
    const cosE = (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2);
    const ellbogen = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosE)));
    const cosS = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const schulter = Math.atan2(h, r) + Math.acos(Math.max(-1, Math.min(1, cosS)));
    const k = Math.min(1, dt * 14);
    const glatt = (alt, neu) => alt + (neu - alt) * k;
    if (teile.drehteller) {
      let w = drehung - teile.drehteller.rotation.y;
      w = Math.atan2(Math.sin(w), Math.cos(w));
      teile.drehteller.rotation.y += w * k;
    }
    // Glieder zeigen in Ruhe nach oben (+y); Drehung um z kippt sie nach vorn (+x)
    if (teile.schulter) teile.schulter.rotation.z = glatt(teile.schulter.rotation.z, schulter - Math.PI / 2);
    if (teile.ellbogen) teile.ellbogen.rotation.z = glatt(teile.ellbogen.rotation.z, -ellbogen);
    if (teile.handgelenk) teile.handgelenk.rotation.z = glatt(teile.handgelenk.rotation.z, -(schulter - Math.PI / 2) + ellbogen - Math.PI / 2);
    if (teile.greifer) {
      const zu = lauf(bau).job && lauf(bau).job.g ? 1 : 0;
      teile.greifer.children.forEach((f, i) => { f.rotation.x = (i % 2 ? 1 : -1) * (0.35 - zu * 0.3); });
    }
  }

  function rauchAusstossen(x, y, z) {
    const r = rauch[rauchNaechster++ % rauch.length];
    r.sp.visible = true;
    r.sp.position.set(x, y, z);
    r.t = 0;
    r.leben = 2.4 + Math.random();
    r.vx = (Math.random() - 0.5) * 0.3;
    r.vz = (Math.random() - 0.5) * 0.3;
  }

  /* -------------------------------- Stücke zeichnen */
  const zaehler = {};
  function stueckSetzen(art, x, y, z, drehY, kippen, skalierung) {
    const im = stueckMeshes[art];
    const i = zaehler[art] || 0;
    if (!im || i >= MAX_STUECKE) return;
    euler.set(kippen, drehY, kippen * 0.6);
    quat.setFromEuler(euler);
    skal.setScalar(skalierung);
    vec.set(x, y, z);
    matrix.compose(vec, quat, skal);
    im.setMatrixAt(i, matrix);
    zaehler[art] = i + 1;
  }

  function stueckeZeichnen(s, netz, zeit) {
    for (const art of Object.keys(stueckMeshes)) zaehler[art] = 0;
    let glanz = 0;
    for (const g of s.gegenstaende) {
      if (g.ort === 'hand' || g.ort === 'weg') continue;
      const sk = g.art === 'roh' ? Math.max(0.75, Math.min(1.8, Math.cbrt(g.halme / 20))) : 1;
      const hoehe = g.art === 'roh' ? 0.11 * sk : GROESSE[g.art] * 0.75;
      const kippen = g.ort === 'flug' ? (g.dreh || 0) : 0;
      stueckSetzen(g.art, g.x, g.y + hoehe, g.z, (g.dreh || 0) + (g.id % 7) * 0.9, kippen, sk);
      if (g.nadel >= 0 && g.ort === 'boden' && glanz < glanzPool.length) {
        const sp = glanzPool[glanz++];
        sp.visible = true;
        sp.position.set(g.x, g.y + hoehe * 2 + 0.05, g.z);
        sp.scale.setScalar(0.25 + 0.15 * Math.abs(Math.sin(zeit * 3 + g.id)));
      }
    }
    for (let i = glanz; i < glanzPool.length; i++) glanzPool[i].visible = false;
    // Einträge in Heutreppe und Heulift
    for (const bau of netz.maschinenAlle) {
      if (!bau.innen || !bau.innen.length) continue;
      for (const r of bau.innen) {
        const p = innenPunkt(bau, r.t);
        const sk = r.art === 'roh' ? Math.max(0.75, Math.min(1.8, Math.cbrt(r.halme / 20))) : 1;
        stueckSetzen(r.art, p[0], p[1] + (r.art === 'roh' ? 0.11 * sk : GROESSE[r.art] * 0.75), p[2], bau.rot || 0, 0, sk);
      }
    }
    for (const [art, im] of Object.entries(stueckMeshes)) {
      im.count = zaehler[art];
      im.instanceMatrix.needsUpdate = true;
    }
  }

  /* -------------------------------- Leitungen */
  /** Anschlusspunkt einer Leitung am Modell (userData.leitung), sonst der aus der Logik. */
  const ankerVec = new THREE.Vector3();
  function leitungsAnker(bauId, punkt) {
    const e = bauId != null ? eintraege.get(bauId) : null;
    const lp = e && e.obj.userData.leitung;
    if (!lp) return punkt;
    e.obj.updateMatrixWorld(true);
    ankerVec.set(lp[0], lp[1], lp[2]);
    e.obj.localToWorld(ankerVec);
    return [ankerVec.x, ankerVec.y, ankerVec.z];
  }

  function leitungenZeichnen(netz) {
    if (netz.leitungen === leitungsQuelle) return;
    leitungsQuelle = netz.leitungen;
    if (leitungen) { wurzel.remove(leitungen); leitungen.geometry.dispose(); }
    const geos = [];
    for (const roh of netz.leitungen) {
      const l = { ...roh, a: leitungsAnker(roh.aBau, roh.a), b: leitungsAnker(roh.bBau, roh.b) };
      const lang = Math.hypot(l.b[0] - l.a[0], l.b[2] - l.a[2]);
      const pts = objDurchhang(l.a, l.b, Math.min(0.9, 0.04 * lang + (l.fall ? 0.05 : 0.15)));
      const kurve = new THREE.CatmullRomCurve3(pts);
      geos.push(new THREE.TubeGeometry(kurve, 14, 0.014, 4, false));
    }
    if (!geos.length) { leitungen = null; return; }
    leitungen = new THREE.Mesh(objVereinen(geos), MAT.leitung);
    wurzel.add(leitungen);
  }

  /* -------------------------------- Vorschau beim Bauen */
  const geisterCache = new Map();
  let geistAktiv = null;
  const matOk = objHologramm(true);
  const matNein = objHologramm(false);
  let bandGeist = null;
  let linienGeist = null;
  const ankerMat = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.8, depthWrite: false });
  const ankerZiel = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95, depthWrite: false });
  const anker = Array.from({ length: 24 }, () => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 20), ankerMat);
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    vorschauGruppe.add(m);
    return m;
  });
  const markierung = new THREE.Box3Helper(new THREE.Box3(), 0xff5533);
  markierung.visible = false;
  vorschauGruppe.add(markierung);

  function geistHolen(typ) {
    if (!geisterCache.has(typ)) {
      const g = maschinenModell(typ, { qualitaet });
      objEinfaerben(g, matOk);
      // Pfeil nach vorn (+x), damit man sieht, wohin die Maschine schaut
      const pfeil = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 3), matOk);
      pfeil.rotation.z = -Math.PI / 2;
      pfeil.position.set(BAU_BY_ID[typ].b / 2 + 0.35, 0.08, 0);
      pfeil.name = 'pfeil';
      g.add(pfeil);
      vorschauGruppe.add(g);
      geisterCache.set(typ, g);
    }
    return geisterCache.get(typ);
  }

  return {
    wurzel,
    /** Jedes Bild: Bauten abgleichen, bewegen, Stücke, Leitungen, Laster, Drohnen. */
    schritt(s, netz, dt, zeit, kamera = null) {
      abgleichen(s);
      // laufendes Gummi
      bandTex.offset.y -= (werte(s).band * dt) / 0.5;
      for (const e of eintraege.values()) if (e.bau.typ !== 'band' && !BAU_BY_ID[e.bau.typ].linie) maschineBewegen(e, s, dt, zeit);
      // Aufbau-Effekte
      for (let i = aufbauEffekte.length - 1; i >= 0; i--) {
        const a = aufbauEffekte[i];
        a.t += dt;
        const u = Math.min(1, a.t / 0.7);
        a.mat.opacity = 0.5 * (1 - u);
        a.obj.scale.setScalar(0.94 + 0.06 * u);
        if (u >= 1) { vorschauGruppe.remove(a.geist); a.mat.dispose(); aufbauEffekte.splice(i, 1); }
      }
      stueckeZeichnen(s, netz, zeit);
      leitungenZeichnen(netz);
      lichterVerteilen(kamera);
      // Rauch
      for (const r of rauch) {
        if (!r.sp.visible) continue;
        r.t += dt;
        const u = r.t / r.leben;
        if (u >= 1) { r.sp.visible = false; continue; }
        r.sp.position.x += r.vx * dt;
        r.sp.position.z += r.vz * dt;
        r.sp.position.y += dt * (0.9 - u * 0.3);
        r.sp.scale.setScalar(0.4 + u * 1.6);
        r.sp.material.opacity = 0.7 * (1 - u);
      }
      // Radar
      if (netz.radar) {
        const n = s.nadeln[netz.radar.nadel];
        if (n && n.zustand === 'versteckt') {
          radarStrahl.visible = true;
          radarStrahl.position.set(n.x, 7, n.z);
          radarMat.opacity = 0.18 + 0.2 * Math.abs(Math.sin(zeit * 4));
        } else radarStrahl.visible = false;
      } else radarStrahl.visible = false;
      // Laster
      const lage = lasterLage(s);
      laster.visible = lage.sichtbar;
      if (lage.sichtbar) {
        laster.position.set(lage.x, 0, lage.z);
        laster.rotation.y = lage.rot;
        for (const r of lasterRaeder) r.rotation.z -= dt * lage.fahrt * 6;
        const n = s.laster.zustand === 'steht' || s.laster.zustand === 'faehrt' ? Math.min(ladung.count = Math.min(48, s.laster.stapel), 48) : 0;
        ladung.count = n;
        for (let i = 0; i < n; i++) {
          const reihe = Math.floor(i / 12);
          const k = i % 12;
          const lx = -1.2 + (k % 4) * 0.5 - (LASTER_BETT.z1 - LASTER_BETT.z0) / 2 + 1.0;
          const lz = -0.6 + Math.floor(k / 4) * 0.55;
          const [wx, wz] = lokalZuWelt({ x: lage.x, z: lage.z, rot: lage.rot }, lx - 0.9, lz);
          vec.set(wx, LASTER_BETT.y + 0.15 + reihe * 0.31, wz);
          quat.setFromAxisAngle(achseY, lage.rot);
          skal.setScalar(1);
          matrix.compose(vec, quat, skal);
          ladung.setMatrixAt(i, matrix);
        }
        ladung.instanceMatrix.needsUpdate = true;
      } else ladung.count = 0;
      // Drohnen
      const liste = drohnenListe(s);
      while (drohnen.length < liste.length) {
        const m = drohnenVorlage.clone(true);
        const rotoren = [];
        m.traverse((o) => { if (o.name && o.name.startsWith('rotor')) rotoren.push(o); });
        wurzel.add(m);
        drohnen.push({ m, rotoren });
      }
      while (drohnen.length > liste.length) wurzel.remove(drohnen.pop().m);
      liste.forEach((d, i) => {
        const e = drohnen[i];
        e.m.position.set(d.x, d.y, d.z);
        e.m.rotation.y = d.rot || 0;
        for (const r of e.rotoren) r.rotation.y += dt * (d.zustand === 'ruht' ? 2 : 40);
      });
    },

    /** Welcher Bau liegt unter dem Strahl? */
    trefferBau(raycaster, maxT = 6) {
      raycaster.far = maxT;
      const treffer = raycaster.intersectObjects(bautenGruppe.children, true);
      for (const t of treffer) {
        const id = t.object.userData.bauId;
        if (id == null) continue;
        const e = eintraege.get(id);
        if (e) return { bau: e.bau, punkt: t.point, abstand: t.distance };
      }
      return null;
    },

    /** Grünes (oder rotes) Modell an der Stelle, an der gebaut würde. typ null: weg. */
    geist(typ, lage, ok) {
      if (geistAktiv && (!typ || geistAktiv.typ !== typ)) { geistAktiv.obj.visible = false; geistAktiv = null; }
      if (!typ) return;
      const g = geistHolen(typ);
      g.visible = true;
      g.position.set(lage.x, lage.y || 0, lage.z);
      g.rotation.y = lage.rot || 0;
      const mat = ok ? matOk : matNein;
      if (g.userData.mat !== mat) { objEinfaerben(g, mat); g.userData.mat = mat; }
      geistAktiv = { typ, obj: g };
    },

    /** Vorschau eines Bandes entlang der Eckpunkte. punkte null: weg. */
    bandVorschau(punkte, ok) {
      if (bandGeist) { vorschauGruppe.remove(bandGeist); bandGeist.geometry.dispose(); bandGeist = null; }
      if (!punkte || punkte.length < 2) return;
      const bahn = bandBahn(punkte);
      bandGeist = new THREE.Mesh(objExtrudieren(bahn.map((p) => [p[0], p[1] + 0.02, p[2]]), BAND_PROFIL_RAHMEN, 1), ok ? matOk : matNein);
      vorschauGruppe.add(bandGeist);
    },

    /** Vorschau eines Linienbaus (Wand, Geländer, Leitung) von a nach b. */
    linienVorschau(typ, a, b, ok, y = 0) {
      if (linienGeist) { vorschauGruppe.remove(linienGeist); linienGeist = null; }
      if (!typ || !a || !b) return;
      linienGeist = linienObjekt({ typ, a, b, y });
      objEinfaerben(linienGeist, ok ? matOk : matNein);
      vorschauGruppe.add(linienGeist);
    },

    /** Einrastpunkte zeigen: [{ x, y, z, ziel }] (ziel = der gerade gewählte). */
    ankerZeigen(liste = []) {
      anker.forEach((m, i) => {
        const a = liste[i];
        m.visible = !!a;
        if (!a) return;
        m.position.set(a.x, a.y + 0.03, a.z);
        m.material = a.ziel ? ankerZiel : ankerMat;
        m.scale.setScalar(a.ziel ? 1.3 : 1);
      });
    },

    /** Einen Bau markieren (Abbauen, Antippen). bau null: weg. */
    markieren(bau, farbe = 0xff5533) {
      if (!bau) { markierung.visible = false; return; }
      const e = eintraege.get(bau.id);
      if (!e) { markierung.visible = false; return; }
      markierung.box.setFromObject(e.obj);
      markierung.material.color.setHex(farbe);
      markierung.visible = true;
    },

    /** Das Bild einer Staffelei beim nächsten Bild neu malen. */
    bildNeu(bau) {
      const e = eintraege.get(bau.id);
      if (e) e.bildSchluessel = null;
    },

    vorschauWeg() {
      this.geist(null);
      this.bandVorschau(null);
      this.linienVorschau(null);
      this.ankerZeigen([]);
      this.markieren(null);
    },
  };
}
