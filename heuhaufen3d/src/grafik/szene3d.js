// Renderer, Himmel, Sonne und Landschaft draußen. Die Halle selbst baut hof3d.js.

import * as THREE from '../../vendor/three.module.min.js';
import { wolkenTextur, feldTextur } from './texturen.js';

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
  szene.fog = new THREE.Fog(HIMMEL_HORIZONT.clone(), 70, 320);

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
    const g = 180 + Math.random() * 120;
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

/** Hügel, Felsen und Heufelder um die Halle, einfach gehalten und im Nebel verblassend. */
function landschaftBauen(szene, q) {
  const feld = feldTextur(256, 51);
  feld.repeat.set(40, 40);
  const boden = new THREE.Mesh(
    new THREE.CircleGeometry(700, 48),
    new THREE.MeshLambertMaterial({ color: 0xd8ccb0, map: feld }),
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.y = -0.02;
  boden.receiveShadow = false;
  szene.add(boden);

  // Grüne Wiesenflecken
  const wiese = new THREE.MeshLambertMaterial({ color: 0x7f9a4a });
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 70 + Math.random() * 200;
    const m = new THREE.Mesh(new THREE.CircleGeometry(20 + Math.random() * 40, 16), wiese);
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.cos(a) * r, -0.01, Math.sin(a) * r);
    szene.add(m);
  }

  // Hügelkette und Berge als verbeulte Kegel
  const hang = new THREE.MeshLambertMaterial({ color: 0x8c9a62, flatShading: true });
  const fels = new THREE.MeshLambertMaterial({ color: 0x9a948a, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.1;
    const r = 260 + Math.random() * 180;
    const hoch = 30 + Math.random() * 70;
    const geo = new THREE.ConeGeometry(60 + Math.random() * 60, hoch, 7, 3);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setX(k, pos.getX(k) * (0.85 + Math.random() * 0.3));
      pos.setZ(k, pos.getZ(k) * (0.85 + Math.random() * 0.3));
      if (pos.getY(k) < hoch / 2 - 1) pos.setY(k, pos.getY(k) + (Math.random() - 0.5) * 6);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, i % 3 === 0 ? fels : hang);
    m.position.set(Math.cos(a) * r, hoch / 2 - 4, Math.sin(a) * r);
    szene.add(m);
  }

  // Draußen liegen Heuballen in Reihen auf den Feldern
  const ballenGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12);
  ballenGeo.rotateZ(Math.PI / 2);
  const ballenMat = new THREE.MeshLambertMaterial({ color: 0xd9b25e });
  const anzahl = q.halme > 5000 ? 90 : 40;
  const ballen = new THREE.InstancedMesh(ballenGeo, ballenMat, anzahl);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  for (let i = 0; i < anzahl; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 45 + Math.random() * 160;
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.7, Math.sin(a) * r), quat, new THREE.Vector3(1, 1, 1));
    ballen.setMatrixAt(i, m4);
  }
  szene.add(ballen);
}
