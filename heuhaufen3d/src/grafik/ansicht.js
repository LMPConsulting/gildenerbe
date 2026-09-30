// Was man in der Ich-Perspektive sieht, außer der Halle: das Werkzeug in der
// Hand (mittig unten wie im Vorbild) mit Heu darauf, Eimer oder Schubkarre,
// lose Halmbüschel am Boden, glitzernde Nadeln, fliegende Halme beim Stechen.

import * as THREE from '../../vendor/three.module.min.js';
import {
  spatenModell, heugabelModell, sandschaufelModell, besenModell, detektorModell, saugerModell, handModell,
  eimerModell, heuBueschel, nadelModell, gegenstandGeometrien, GEGENSTAND_FARBEN,
} from './modelle.js';

const HALM_TOENE = [0xf6cf6a, 0xeeb94c, 0xe2a338, 0xf9de90, 0xd58f2c, 0xe8a940];

/** Ein Büschel aus Halmen als eine Geometrie, für Instanzen. */
function bueschelGeometrie() {
  const teile = [];
  const b = 0.009;
  for (let i = 0; i < 14; i++) {
    const g = new THREE.BoxGeometry(b, b, 0.22 + Math.random() * 0.12);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3((Math.random() - 0.5) * 0.28, Math.random() * 0.05, (Math.random() - 0.5) * 0.28),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    teile.push(g);
  }
  // zusammenführen ohne BufferGeometryUtils: Positionen und Normalen hintereinander
  const pos = [];
  const nor = [];
  const idx = [];
  let versatz = 0;
  for (const g of teile) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (const i of g.index.array) idx.push(i + versatz);
    versatz += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

export function ansichtBauen(szene, kamera) {
  szene.add(kamera);
  const hand = new THREE.Group();
  hand.name = 'hand';
  kamera.add(hand);
  // Werkzeuge liegen in der Ruhelage mittig unten, der Stiel steigt von unten ins Bild.
  const modelle = {
    hand: handModell(), sandschaufel: (() => { const m = sandschaufelModell(); m.scale.setScalar(1.3); return m; })(), spaten: spatenModell(), heugabel: heugabelModell(),
    besen: besenModell(), detektor: detektorModell(), sauger: saugerModell(),
  };
  const RUHE = {
    hand: { p: [0.2, -0.26, -0.42], r: [0.25, 0.1, 0] },
    sandschaufel: { p: [0, -0.13, -0.42], r: [0.5, 0, 0] },
    spaten: { p: [0.03, -0.12, -0.01], r: [-0.12, 0, 0] },
    heugabel: { p: [0, -0.124, 0.037], r: [-0.1, 0, 0] },
    besen: { p: [0.1, -0.7, -0.35], r: [0.85, 0.05, 0] },
    detektor: { p: [0.2, -0.28, -0.42], r: [0.55, 0.12, 0] },
    sauger: { p: [0.16, -0.34, -0.36], r: [0.35, 0.08, 0] },
  };
  for (const [id, m] of Object.entries(modelle)) {
    m.visible = false;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 5; } });
    hand.add(m);
  }
  // Heu, das auf dem Werkzeug liegt
  const ladung = heuBueschel(34, 0.11);
  ladung.visible = false;
  hand.add(ladung);
  // Behälter: Eimer links unten, Heubündel in den Armen
  const eimer = eimerModell();
  eimer.scale.setScalar(0.75);
  eimer.position.set(-0.38, -0.44, -0.6);
  eimer.rotation.set(0.25, 0.3, 0.12);
  kamera.add(eimer);
  const armHeu = heuBueschel(26, 0.1);
  armHeu.position.set(-0.28, -0.36, -0.45);
  kamera.add(armHeu);
  const karre = schubkarreModell();
  karre.position.set(0, -1.12, -1.05);
  kamera.add(karre);
  // Ein Stück in beiden Händen (Pressballen, Knäuel, Ziegel …)
  const stueckGeos = gegenstandGeometrien();
  const STUECK_GEO = {
    roh: stueckGeos.buendel, knaeuel: stueckGeos.knaeuel, ballen: stueckGeos.ballen, pellet: stueckGeos.pellet,
    brei: stueckGeos.brei, silage: stueckGeos.silage, papier: stueckGeos.papier, brikett: stueckGeos.ziegel,
  };
  const gehalten = new THREE.Mesh(STUECK_GEO.roh, new THREE.MeshStandardMaterial({ color: GEGENSTAND_FARBEN.roh, roughness: 0.9 }));
  gehalten.visible = false;
  gehalten.renderOrder = 5;
  kamera.add(gehalten);
  let gehaltenArt = null;

  // Lose Büschel am Boden
  const bueschelGeo = bueschelGeometrie();
  const bueschelMat = new THREE.MeshLambertMaterial({ color: 0xe9b95a });
  const MAX_B = 320;
  const bueschel = new THREE.InstancedMesh(bueschelGeo, bueschelMat, MAX_B);
  bueschel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bueschel.frustumCulled = false;
  bueschel.receiveShadow = true;
  szene.add(bueschel);

  // Lose Nadeln mit Glitzern
  const nadelGruppe = new THREE.Group();
  szene.add(nadelGruppe);
  const glanzTextur = glanzSprite();
  const nadelObjekte = new Map();

  // fliegende Halme beim Stechen
  const MAX_T = 240;
  const teilchenGeo = new THREE.BoxGeometry(0.008, 0.008, 0.16);
  const teilchenMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const teilchen = new THREE.InstancedMesh(teilchenGeo, teilchenMat, MAX_T);
  teilchen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  teilchen.frustumCulled = false;
  const farbe = new THREE.Color();
  for (let i = 0; i < MAX_T; i++) { farbe.setHex(HALM_TOENE[i % HALM_TOENE.length]); teilchen.setColorAt(i, farbe); }
  szene.add(teilchen);
  const flug = []; // {x,y,z,vx,vy,vz,rx,ry,leben}

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const unsichtbar = new THREE.Matrix4().makeScale(0, 0, 0);
  let aktuell = null;
  let stoss = 0; // 1 → 0 nach einem Stich
  let ladungZeit = 0;
  let zeit = 0;
  let loseSchluessel = '';

  function werkzeugZeigen(id) {
    if (id === aktuell) return;
    aktuell = id;
    for (const [k, m] of Object.entries(modelle)) m.visible = k === id;
  }

  return {
    stich(ev) {
      stoss = 1;
      if (ev.menge > 0 && ev.werkzeug !== 'hand') { ladungZeit = 0.32; }
      // Halme fliegen an der Stichstelle hoch
      const n = Math.min(26, 8 + Math.round((ev.menge || 1) / 2));
      for (let i = 0; i < n; i++) {
        if (flug.length >= MAX_T) flug.shift();
        const a = Math.random() * Math.PI * 2;
        const v = 1 + Math.random() * 2.2;
        flug.push({
          x: ev.x, y: ev.y + 0.05, z: ev.z, vx: Math.cos(a) * v * 0.6, vy: 1.2 + Math.random() * 2.2, vz: Math.sin(a) * v * 0.6,
          rx: Math.random() * 6, ry: Math.random() * 6, leben: 0.8 + Math.random() * 0.5,
        });
      }
    },
    schwung() { stoss = 1; },

    schritt(s, dt, info) {
      zeit += dt;
      const sp = s.spieler;
      // Mit einem Stück in den Händen oder beim Bauen ist das Werkzeug weggesteckt
      const weg = !!info.haelt || !!info.bauen;
      werkzeugZeigen(weg ? null : sp.werkzeug);
      gehalten.visible = !!info.haelt;
      if (info.haelt) {
        const art = info.haelt.art;
        if (art !== gehaltenArt) {
          gehaltenArt = art;
          gehalten.geometry = STUECK_GEO[art] || STUECK_GEO.roh;
          gehalten.material.color.setHex(GEGENSTAND_FARBEN[art] || GEGENSTAND_FARBEN.roh);
        }
        const wippen = Math.min(1, (info.tempo || 0) / 4);
        gehalten.position.set(0.02, -0.34 - Math.abs(Math.cos(zeit * 7.5)) * 0.012 * wippen, -0.62);
        gehalten.rotation.set(0.25, 0.4, 0);
      }
      // Wippen beim Gehen, Stoß nach vorn beim Stechen
      const gehen = Math.min(1, (info.tempo || 0) / 4);
      const wx = Math.sin(zeit * 7.5) * 0.012 * gehen;
      const wy = Math.abs(Math.cos(zeit * 7.5)) * 0.014 * gehen;
      if (!weg) {
        const ruhe = RUHE[sp.werkzeug] || RUHE.hand;
        const m = modelle[sp.werkzeug];
        stoss = Math.max(0, stoss - dt * 4.2);
        const st = Math.sin(stoss * Math.PI);
        const saugZittern = sp.sauger.an ? (Math.random() - 0.5) * 0.006 : 0;
        m.position.set(ruhe.p[0] + wx + saugZittern, ruhe.p[1] - wy - st * 0.05, ruhe.p[2] - st * 0.22);
        m.rotation.set(ruhe.r[0] - st * 0.35, ruhe.r[1], ruhe.r[2]);
        // Heu auf dem Blatt kurz sichtbar, dann in den Behälter
        ladungZeit = Math.max(0, ladungZeit - dt);
        ladung.visible = ladungZeit > 0 && ['spaten', 'heugabel', 'sandschaufel'].includes(sp.werkzeug);
        if (ladung.visible) {
          const lz = sp.werkzeug === 'sandschaufel' ? -0.62 : -0.86;
          ladung.position.set(m.position.x, m.position.y + 0.05 + Math.sin(ruhe.r[0]) * 0.25, m.position.z + lz * Math.cos(ruhe.r[0]) * 0.55);
        }
        // Detektoranzeige färbt sich
        if (sp.werkzeug === 'detektor') {
          const anzeige = modelle.detektor.getObjectByName('anzeige');
          if (anzeige) {
            const s01 = info.detektor || 0;
            anzeige.material.emissive.setRGB(0.2 + s01 * 1.4, 0.8 - s01 * 0.5, 0.3 - s01 * 0.2);
            anzeige.material.emissiveIntensity = 0.6 + s01 * 2 * (0.5 + 0.5 * Math.sin(zeit * (6 + s01 * 20)));
          }
        }
      }
      // Behälter
      const b = info.behaelter;
      const fuell = Math.min(1, (sp.last || 0) / Math.max(1, info.platz || 1));
      eimer.visible = b === 'eimer' && sp.werkzeug !== 'besen';
      const f = eimer.getObjectByName('fuellung');
      if (f) { f.position.y = -0.14 + fuell * 0.26; f.visible = fuell > 0.01; }
      eimer.position.y = -0.44 - wy * 0.6;
      armHeu.visible = b === 'arme' && sp.last > 0 && sp.werkzeug !== 'besen';
      armHeu.scale.setScalar(0.4 + fuell * 0.9);
      karre.visible = b === 'schubkarre';
      const kf = karre.getObjectByName('fuellung');
      if (kf) { kf.scale.y = Math.max(0.02, fuell); kf.visible = fuell > 0.01; }

      // lose Büschel am Boden (nur neu setzen, wenn sich etwas geändert hat)
      const lose = s.lose;
      const schluessel = `${lose.length}:${lose.reduce((n, x) => n + x.m, 0) | 0}`;
      if (schluessel !== loseSchluessel) {
        loseSchluessel = schluessel;
        const n = Math.min(lose.length, MAX_B);
        for (let i = 0; i < MAX_B; i++) {
          if (i >= n) { bueschel.setMatrixAt(i, unsichtbar); continue; }
          const l = lose[i];
          const g = Math.min(2.2, 0.55 + Math.sqrt(l.m) * 0.16);
          v3.set(l.x, info.boden ? info.boden(l.x, l.z) + 0.01 : 0.01, l.z);
          q.setFromEuler(e3.set(0, l.a || 0, 0));
          s3.set(g, Math.min(1.6, 0.6 + l.m / 60), g);
          m4.compose(v3, q, s3);
          bueschel.setMatrixAt(i, m4);
        }
        bueschel.count = MAX_B;
        bueschel.instanceMatrix.needsUpdate = true;
      }

      // lose Nadeln
      const sichtbar = new Set();
      for (const n of s.nadeln) {
        if (n.zustand !== 'lose') continue;
        sichtbar.add(n);
        let o = nadelObjekte.get(n);
        if (!o) {
          o = new THREE.Group();
          const modell = nadelModell(n.nr === 5);
          modell.scale.setScalar(2.2);
          o.add(modell);
          const glanz = new THREE.Sprite(new THREE.SpriteMaterial({ map: glanzTextur, color: 0xfff6d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          glanz.scale.set(0.6, 0.6, 1);
          glanz.name = 'glanz';
          o.add(glanz);
          nadelGruppe.add(o);
          nadelObjekte.set(n, o);
        }
        o.position.set(n.x, n.y + 0.05 + Math.sin(zeit * 2 + n.nr) * 0.02, n.z);
        o.children[0].rotation.y = zeit * 0.8 + n.nr;
        const glanz = o.getObjectByName('glanz');
        const puls = 0.5 + 0.5 * Math.sin(zeit * 5 + n.nr * 1.7);
        glanz.scale.setScalar(0.35 + puls * 0.5);
        glanz.material.opacity = 0.45 + puls * 0.55;
      }
      for (const [n, o] of nadelObjekte) {
        if (!sichtbar.has(n)) { nadelGruppe.remove(o); nadelObjekte.delete(n); }
      }

      // fliegende Halme
      for (let i = flug.length - 1; i >= 0; i--) {
        const p = flug[i];
        p.leben -= dt;
        if (p.leben <= 0) { flug.splice(i, 1); continue; }
        p.vy -= 9 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const bodenH = info.boden ? info.boden(p.x, p.z) : 0;
        if (p.y < bodenH) { p.y = bodenH; p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; }
        p.rx += dt * 7; p.ry += dt * 5;
      }
      for (let i = 0; i < MAX_T; i++) {
        const p = flug[i];
        if (!p) { teilchen.setMatrixAt(i, unsichtbar); continue; }
        v3.set(p.x, p.y, p.z);
        q.setFromEuler(e3.set(p.rx, p.ry, 0));
        s3.setScalar(Math.min(1, p.leben * 2));
        m4.compose(v3, q, s3);
        teilchen.setMatrixAt(i, m4);
      }
      teilchen.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Schubkarre, von vorn unten gesehen: Mulde, Rad, zwei Griffe. */
function schubkarreModell() {
  const g = new THREE.Group();
  const rot = new THREE.MeshStandardMaterial({ color: 0x9a3a28, roughness: 0.65, metalness: 0.3 });
  const schwarz = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.8 });
  const mulde = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.3, 4, 1, true), rot);
  mulde.rotation.y = Math.PI / 4;
  mulde.scale.set(1.2, 1, 1.6);
  mulde.material.side = THREE.DoubleSide;
  g.add(mulde);
  const fuellung = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.9), new THREE.MeshLambertMaterial({ color: 0xe6b456 }));
  fuellung.name = 'fuellung';
  fuellung.position.y = -0.1;
  fuellung.geometry.translate(0, 0.14, 0);
  g.add(fuellung);
  const rad = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), schwarz);
  rad.rotation.y = Math.PI / 2;
  rad.position.set(0, -0.25, -0.62);
  g.add(rad);
  for (const x of [-0.3, 0.3]) {
    const griff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), schwarz);
    griff.rotation.x = Math.PI / 2 + 0.25;
    griff.position.set(x, 0.05, 0.55);
    g.add(griff);
  }
  g.traverse((o) => { if (o.isMesh) o.renderOrder = 4; });
  return g;
}

/** Weicher Stern für das Glitzern der Nadeln. */
function glanzSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,245,200,0.7)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,255,255,0.9)';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.moveTo(2, 32); x.lineTo(62, 32); x.stroke();
  const t = new THREE.CanvasTexture(c);
  return t;
}
