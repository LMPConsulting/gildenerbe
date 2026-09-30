// Der Haufen in 3D: ein Gitter-Mesh aus dem Höhenfeld mit gemalter Strohtextur
// (triplanar, damit die steilen Flanken nicht verzerren), dazu einzelne Halme als
// Instanzen, die auf der Oberfläche liegen und über den Rand hinausstehen.

import * as THREE from '../../vendor/three.module.min.js';
import { haufenHoehe, haufenNormale } from '../haufen.js';
import { strohTexturen } from './texturen.js';

const HALM_FARBEN = [0xd9a263, 0xd0a14d, 0xe8c98a, 0xc8923f, 0x8d521b, 0xdcaa5c, 0xe3b46a, 0xb87a38, 0xe8c98a];

function strohMaterial(qualitaet) {
  const { farbe } = strohTexturen(qualitaet.halme > 5000 ? 1024 : 512, qualitaet.halme > 5000 ? 9000 : 3200, 7);
  farbe.anisotropy = qualitaet.aniso;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.strohMap = { value: farbe };
    shader.uniforms.strohSkala = { value: 0.55 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeltPos;\nvarying vec3 vWeltNorm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWeltNorm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D strohMap;\nuniform float strohSkala;\nvarying vec3 vWeltPos;\nvarying vec3 vWeltNorm;')
      .replace('#include <map_fragment>', `
        vec3 gew = pow(abs(normalize(vWeltNorm)), vec3(3.0));
        gew /= (gew.x + gew.y + gew.z + 1e-4);
        vec4 sx = texture2D(strohMap, vWeltPos.zy * strohSkala);
        vec4 sy = texture2D(strohMap, vWeltPos.xz * strohSkala);
        vec4 sz = texture2D(strohMap, vWeltPos.xy * strohSkala + vec2(0.37, 0.11));
        diffuseColor *= sx * gew.x + sy * gew.y + sz * gew.z;
      `).replace('#include <color_fragment>', '#include <color_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.2;');
  };
  return mat;
}

export function haufenAnsichtBauen(szene, hf, qualitaet) {
  const gruppe = new THREE.Group();
  gruppe.name = 'haufen';
  szene.add(gruppe);
  const mat = strohMaterial(qualitaet);
  let mesh = null;
  let geo = null;
  let halme = null;
  let halmDaten = null;
  let aktuell = null;
  let letzteAenderung = -1;

  function meshBauen(h) {
    if (mesh) { gruppe.remove(mesh); geo.dispose(); }
    const n = h.n;
    geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const index = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'haufenMesh';
    gruppe.add(mesh);
    aktuell = h;
    letzteAenderung = -1;
    halmeBauen(h);
  }

  function meshAktualisieren(h) {
    const n = h.n;
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const col = geo.attributes.color.array;
    const hh = h.h;
    const z = h.zelle;
    let maxH = 0.001;
    for (let k = 0; k < hh.length; k++) if (hh[k] > maxH) maxH = hh[k];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const y = hh[k];
        pos[k * 3] = h.x0 + i * z;
        // leere Zellen knapp unter den Boden, damit nichts flimmert
        pos[k * 3 + 1] = y > 0.004 ? y : -0.06;
        pos[k * 3 + 2] = h.z0 + j * z;
        const l = i > 0 ? hh[k - 1] : y;
        const r = i < n - 1 ? hh[k + 1] : y;
        const o = j > 0 ? hh[k - n] : y;
        const u = j < n - 1 ? hh[k + n] : y;
        let nx = (l - r) / (2 * z);
        let ny = 1;
        let nz = (o - u) / (2 * z);
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        // unten dunkler und staubiger, oben von der Sonne gebleicht
        const t = Math.min(1, y / maxH);
        const fuss = Math.min(1, y / 0.6);
        const hell = 0.86 + 0.26 * Math.pow(t, 0.6);
        col[k * 3] = hell * (0.85 + 0.15 * fuss);
        col[k * 3 + 1] = hell * (0.8 + 0.2 * fuss);
        col[k * 3 + 2] = hell * (0.72 + 0.28 * fuss);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }

  // Einzelne Halme: zwei gekreuzte schmale Streifen je Halm.
  function halmGeometrie() {
    const g = new THREE.BufferGeometry();
    const b = 0.008;
    const l = 0.3;
    const p = new Float32Array([
      -b, 0, -l / 2, b, 0, -l / 2, b, 0, l / 2, -b, 0, l / 2,
      0, -b, -l / 2, 0, b, -l / 2, 0, b, l / 2, 0, -b, l / 2,
    ]);
    // Alle Normalen zeigen nach oben (zur Fläche hin): beide Streifen sind so hell wie das Heu darunter.
    const nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    return g;
  }

  function halmeBauen(h) {
    if (halme) { gruppe.remove(halme); halme.dispose(); }
    const anzahl = qualitaet.halme;
    const halmMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x3a2610 });
    halme = new THREE.InstancedMesh(halmGeometrie(), halmMat, anzahl);
    halme.castShadow = false;
    halme.receiveShadow = true;
    halme.frustumCulled = false;
    halmDaten = new Float32Array(anzahl * 5); // u, v (polar), yaw, neigung, länge
    const farbe = new THREE.Color();
    for (let i = 0; i < anzahl; i++) {
      const r = Math.sqrt(Math.random());
      halmDaten[i * 5] = r;
      halmDaten[i * 5 + 1] = Math.random() * Math.PI * 2;
      halmDaten[i * 5 + 2] = Math.random() * Math.PI * 2;
      // die meisten liegen, manche stehen ab
      halmDaten[i * 5 + 3] = Math.random() < 0.18 ? 0.5 + Math.random() * 0.8 : (Math.random() - 0.5) * 0.5;
      halmDaten[i * 5 + 4] = 0.6 + Math.random() * 0.9;
      farbe.setHex(HALM_FARBEN[Math.floor(Math.random() * HALM_FARBEN.length)]);
      halme.setColorAt(i, farbe);
    }
    halme.instanceColor.needsUpdate = true;
    gruppe.add(halme);
    halmeSetzen(h, 0, anzahl);
  }

  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const quat2 = new THREE.Quaternion();
  const vPos = new THREE.Vector3();
  const vSkala = new THREE.Vector3();
  const vOben = new THREE.Vector3(0, 1, 0);
  const vNorm = new THREE.Vector3();
  const vAchse = new THREE.Vector3();
  const versteckt = new THREE.Matrix4().makeScale(0, 0, 0);
  let halmZeiger = 0;

  function halmeSetzen(h, von, bis) {
    if (!halme) return;
    const rMax = h.radius * 1.12;
    for (let i = von; i < bis; i++) {
      const r = halmDaten[i * 5] * rMax;
      const a = halmDaten[i * 5 + 1];
      const x = h.mitteX + Math.cos(a) * r;
      const z = h.mitteZ + Math.sin(a) * r;
      const y = haufenHoehe(h, x, z);
      if (y < 0.03) { halme.setMatrixAt(i, versteckt); continue; }
      const [nx, ny, nz] = haufenNormale(h, x, z);
      vNorm.set(nx, ny, nz);
      // erst um die Normale drehen (Richtung), dann aus der Fläche kippen
      quat.setFromUnitVectors(vOben, vNorm);
      quat2.setFromAxisAngle(vOben, halmDaten[i * 5 + 2]);
      quat.multiply(quat2);
      vAchse.set(1, 0, 0);
      quat2.setFromAxisAngle(vAchse, halmDaten[i * 5 + 3]);
      quat.multiply(quat2);
      vPos.set(x, y + 0.01, z);
      const l = halmDaten[i * 5 + 4];
      vSkala.set(1, 1, l);
      m4.compose(vPos, quat, vSkala);
      halme.setMatrixAt(i, m4);
    }
    halme.instanceMatrix.needsUpdate = true;
  }

  meshBauen(hf);

  return {
    gruppe,
    get mesh() { return mesh; },
    /** Neu aufbauen, wenn eine neue Ladung kommt. */
    neu(h) { meshBauen(h); },
    /** Pro Bild aufrufen: holt Änderungen nach, Halme in Portionen. */
    schritt(h) {
      if (h !== aktuell) meshBauen(h);
      if (h.aenderung !== letzteAenderung) {
        letzteAenderung = h.aenderung;
        meshAktualisieren(h);
      }
      // Halme wandern in Portionen mit der Oberfläche mit
      if (halme) {
        const portion = Math.min(halme.count, 700);
        const bis = Math.min(halme.count, halmZeiger + portion);
        halmeSetzen(h, halmZeiger, bis);
        halmZeiger = bis >= halme.count ? 0 : bis;
      }
    },
  };
}
