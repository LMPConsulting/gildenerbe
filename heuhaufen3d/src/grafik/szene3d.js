// Renderer, Himmel, Sonne und Landschaft draußen. Die Halle selbst baut hof3d.js.

import * as THREE from '../../vendor/three.module.min.js';
import { wolkenTextur, feldTextur, fleckTextur } from './texturen.js';
import { geoVereinen } from './modelle.js';

export const HIMMEL_OBEN = new THREE.Color('#24518a');
export const HIMMEL_HORIZONT = new THREE.Color('#aebfcc');

/** Qualitätsstufen: Pixeldichte und Schattenauflösung. */
export const QUALITAET = {
  niedrig: { pixel: 0.75, schatten: 1024, halme: 3000, aniso: 1 },
  mittel: { pixel: 1.25, schatten: 2048, halme: 9000, aniso: 4 },
  hoch: { pixel: 2, schatten: 2048, halme: 16000, aniso: 8 },
};

export function szeneBauen(leinwand, qualitaet = 'mittel') {
  const q = QUALITAET[qualitaet] || QUALITAET.mittel;
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand, antialias: qualitaet !== 'niedrig', powerPreference: 'high-performance', stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral statt ACES: das Heu soll golden bleiben und nicht ins Graue kippen.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixel));

  const szene = new THREE.Scene();
  // Nebel erst ab 120 m: die Nähe bleibt klar, die Ferne wird blau (Dunst wie S0/S2)
  szene.fog = new THREE.Fog(HIMMEL_HORIZONT.clone(), 120, 320);

  const kamera = new THREE.PerspectiveCamera(72, 1, 0.05, 900);
  kamera.position.set(0, 1.65, 12);

  // Himmel: große Kugel mit Verlauf, gezeichnet ohne Nebel.
  const himmelMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      oben: { value: HIMMEL_OBEN.clone() },
      horizont: { value: HIMMEL_HORIZONT.clone() },
      sonne: { value: new THREE.Vector3(0.4, 0.75, 0.3).normalize() },
    },
    vertexShader: `varying vec3 vRichtung;
      void main() {
        vRichtung = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 oben; uniform vec3 horizont; uniform vec3 sonne; varying vec3 vRichtung;
      void main() {
        float h = clamp(vRichtung.y, -0.1, 1.0);
        vec3 farbe = mix(horizont, oben, pow(max(h, 0.0), 0.3));
        float s = max(dot(normalize(vRichtung), sonne), 0.0);
        farbe += vec3(1.0, 0.92, 0.75) * pow(s, 180.0) * 1.6 + vec3(1.0, 0.85, 0.6) * pow(s, 8.0) * 0.04;
        gl_FragColor = vec4(farbe, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const himmel = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), himmelMat);
  himmel.renderOrder = -10;
  szene.add(himmel);

  // Licht: warme Sonne mit Schatten, Himmel und Boden als Grundhelligkeit.
  const halbkugel = new THREE.HemisphereLight(0xcdd6de, 0xa08a6c, 0.95);
  szene.add(halbkugel);
  const sonne = new THREE.DirectionalLight(0xfff0d8, 3.4);
  sonne.position.set(-24, 44, 14);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(q.schatten, q.schatten);
  const sk = sonne.shadow.camera;
  sk.left = -30; sk.right = 30; sk.top = 26; sk.bottom = -26; sk.near = 5; sk.far = 120;
  sonne.shadow.bias = -0.0004;
  sonne.shadow.normalBias = 0.03;
  szene.add(sonne);
  szene.add(sonne.target);
  himmelMat.uniforms.sonne.value.copy(sonne.position).normalize();

  // Wolken als Sprites, die langsam ziehen.
  const wolken = [];
  const wt = [wolkenTextur(3), wolkenTextur(9), wolkenTextur(17)];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.SpriteMaterial({ map: wt[i % 3], fog: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const s = new THREE.Sprite(mat);
    const winkel = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const weite = 250 + Math.random() * 150;
    s.position.set(Math.cos(winkel) * weite, 90 + Math.random() * 70, Math.sin(winkel) * weite);
    const g = 260 + Math.random() * 120;
    s.scale.set(g, g * 0.5, 1);
    s.renderOrder = -9;
    wolken.push({ s, geschw: 0.6 + Math.random() * 1.2 });
    szene.add(s);
  }

  landschaftBauen(szene, q);

  function groesseAnpassen() {
    const b = leinwand.clientWidth || window.innerWidth;
    const h = leinwand.clientHeight || window.innerHeight;
    renderer.setSize(b, h, false);
    kamera.aspect = b / Math.max(1, h);
    // Hochkant braucht mehr Sichtfeld nach oben, sonst sieht man den Haufen nicht.
    kamera.fov = kamera.aspect < 1 ? 82 : 72;
    kamera.updateProjectionMatrix();
  }
  groesseAnpassen();

  /** Pixeldichte ändern (dynamische Auflösung), höchstens die des Geräts. */
  function pixelSetzen(v) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, v));
    groesseAnpassen();
  }
  /** Schattenbereich an die Halle anpassen (wächst mit der Verlängerung). */
  function schattenAnpassen(x0, x1, z0, z1) {
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const rx = (x1 - x0) / 2 + 12;
    const rz = (z1 - z0) / 2 + 12;
    sonne.target.position.set(mx, 0, mz);
    sonne.position.set(mx - 24, 44, mz + 14);
    sk.left = -rx; sk.right = rx; sk.top = rz; sk.bottom = -rz;
    sk.updateProjectionMatrix();
  }

  return {
    renderer, szene, kamera, sonne, halbkugel, qualitaet: q,
    groesseAnpassen, pixelSetzen, schattenAnpassen,
    schritt(dt) {
      for (const w of wolken) {
        const p = w.s.position;
        const a = Math.atan2(p.z, p.x) + (w.geschw * dt) / 400;
        const r = Math.hypot(p.x, p.z);
        p.x = Math.cos(a) * r;
        p.z = Math.sin(a) * r;
      }
      himmel.position.copy(kamera.position);
    },
    zeichnen() { renderer.render(szene, kamera); },
  };
}

/**
 * Stoppelfeld, weiche Wiesenflecken, runde Grashügel mit Felsflanken und dunkle
 * Ballen draußen (S0/S2). Alles zu wenigen Meshes zusammengefasst: Wiesen, Hügel und
 * Ballen sind je ein Zeichenaufruf.
 */
function landschaftBauen(szene, q) {
  const feld = feldTextur(256, 51);
  feld.repeat.set(40, 40);
  const boden = new THREE.Mesh(
    new THREE.CircleGeometry(700, 48),
    new THREE.MeshLambertMaterial({ color: 0xffffff, map: feld }),
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.y = -0.02;
  boden.receiveShadow = false;
  szene.add(boden);

  // Grüne Wiesenflecken: weich auslaufend (Alpha-Verlauf), eine Geometrie
  const flecken = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 70 + Math.random() * 200;
    const g = (40 + Math.random() * 80);
    const pg = new THREE.PlaneGeometry(g, g * (0.6 + Math.random() * 0.5));
    pg.rotateZ(Math.random() * Math.PI);
    pg.rotateX(-Math.PI / 2);
    pg.translate(Math.cos(a) * r, -0.01 + i * 0.001, Math.sin(a) * r);
    flecken.push(pg);
  }
  const wiese = new THREE.Mesh(geoVereinen(flecken), new THREE.MeshLambertMaterial({
    color: 0x7d8f55, map: fleckTextur(128, 61), transparent: true, depthWrite: false,
  }));
  wiese.renderOrder = -1;
  szene.add(wiese);

  // Hügel und Berge: gestauchte Kugeln, weich schattiert; steile Flanken felsgrau (Vertexfarben)
  const huegel = [];
  const gras = new THREE.Color(0x6f8a45);
  const fels = new THREE.Color(0x8a857c);
  const tmp = new THREE.Color();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.1;
    const r = 260 + Math.random() * 180;
    const hoch = 30 + Math.random() * 70;
    const breit = 60 + Math.random() * 60;
    const geo = new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = geo.attributes.position;
    const felsig = i % 3 === 0;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k); const y = pos.getY(k); const z = pos.getZ(k);
      const beule = 1 + 0.12 * Math.sin(x * 5 + i) * Math.cos(z * 4 + i * 2);
      pos.setXYZ(k, x * breit * beule, y * hoch * (0.95 + 0.1 * Math.sin(x * 7 + z * 3)), z * breit * beule * (0.8 + 0.2 * Math.cos(i)));
    }
    geo.computeVertexNormals();
    const farben = new Float32Array(pos.count * 3);
    const nor = geo.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      const steil = 1 - nor.getY(k);
      tmp.copy(gras).lerp(fels, Math.min(1, Math.max(0, (steil - (felsig ? 0.25 : 0.45)) * 2.5)));
      farben[k * 3] = tmp.r; farben[k * 3 + 1] = tmp.g; farben[k * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    geo.translate(Math.cos(a) * r, -4, Math.sin(a) * r);
    huegel.push(geo);
  }
  const farbListe = huegel.map((g) => g.attributes.color.array);
  const berge = geoVereinen(huegel);
  const alle = new Float32Array(berge.attributes.position.count * 3);
  let o = 0;
  for (const f of farbListe) { alle.set(f, o); o += f.length; }
  berge.setAttribute('color', new THREE.BufferAttribute(alle, 3));
  szene.add(new THREE.Mesh(berge, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Draußen liegen kleine dunkle Ballen auf den Feldern
  const ballenGeo = new THREE.BoxGeometry(0.9, 0.5, 0.5);
  const ballenMat = new THREE.MeshLambertMaterial({ color: 0x6e5a3c });
  const anzahl = q.halme > 5000 ? 90 : 40;
  const ballen = new THREE.InstancedMesh(ballenGeo, ballenMat, anzahl);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const achse = new THREE.Vector3(0, 1, 0);
  const eins = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  for (let i = 0; i < anzahl; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 45 + Math.random() * 160;
    quat.setFromAxisAngle(achse, Math.random() * Math.PI);
    m4.compose(v.set(Math.cos(a) * r, 0.25, Math.sin(a) * r), quat, eins);
    ballen.setMatrixAt(i, m4);
  }
  szene.add(ballen);
}
