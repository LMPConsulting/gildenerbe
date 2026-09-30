// Was man in der Ich-Perspektive sieht, außer der Halle: das Werkzeug in der
// Hand (mittig unten wie im Vorbild) mit Heu darauf, Eimer oder Schubkarre,
// lose Halmbüschel am Boden, glitzernde Nadeln, fliegende Halme beim Stechen.

import * as THREE from '../../vendor/three.module.min.js';
import {
  spatenModell, heugabelModell, sandschaufelModell, besenModell, detektorModell, saugerModell, handModell,
  eimerModell, heuBueschel, nadelModell, gegenstandGeometrien, GEGENSTAND_FARBEN, heuStueckMaterial,
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
    hand: (() => { const m = handModell(); m.scale.setScalar(0.72); return m; })(),
    sandschaufel: sandschaufelModell(), spaten: spatenModell(), heugabel: heugabelModell(),
    besen: besenModell(), detektor: detektorModell(), sauger: saugerModell(),
  };
  // Köpfe liegen bei 62–68 % Bildhöhe (über Status- und Werkzeugleiste, S3/S4: Stiel füllt die Bildmitte unten).
  const RUHE = {
    hand: { p: [0.3, -0.24, -0.5], r: [0.25, 0.1, 0] },
    sandschaufel: { p: [0.02, -0.26, -0.46], r: [0.28, 0, 0] },
    spaten: { p: [0.03, -0.085, -0.01], r: [-0.12, 0, 0] },
    heugabel: { p: [0, -0.112, 0.037], r: [-0.1, 0, 0] },
    besen: { p: [0.1, -0.7, -0.35], r: [0.85, 0.05, 0] },
    detektor: { p: [0.2, -0.28, -0.42], r: [0.55, 0.12, 0] },
    sauger: { p: [0.16, -0.34, -0.36], r: [0.35, 0.08, 0] },
  };
  for (const [id, m] of Object.entries(modelle)) {
    m.visible = false;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 5; } });
    hand.add(m);
  }
  // Heu, das auf dem Werkzeug liegt (S4: dicke Ladung flacher Halme auf den Zinken).
  // Hängt am Werkzeugkopf und macht Stoß und Wippen mit.
  const ladung = heuBueschel(64, 0.16, { breite: 0.012, laenge: 0.22, hoch: 0.55 });
  ladung.visible = false;
  ladung.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 6; } });
  const LADUNG_AM = {
    heugabel: { p: [0, 0.075, -0.83], s: 1 },
    spaten: { p: [0, 0.05, -0.72], s: 0.8 },
    sandschaufel: { p: [0, 0.03, -0.31], s: 0.62 },
  };
  // Behälter: Eimer links neben der Werkzeugleiste, Heubündel in den Armen
  const eimer = eimerModell();
  eimer.scale.setScalar(0.6);
  eimer.position.set(-0.74, -0.28, -0.64);
  eimer.rotation.set(0.25, 0.3, 0.12);
  kamera.add(eimer);
  const armHeu = heuBueschel(26, 0.1);
  armHeu.position.set(-0.28, -0.36, -0.45);
  kamera.add(armHeu);
  // Die Schubkarre schiebt man vor sich her: sie folgt Standort und Blickrichtung,
  // aber nicht dem Nicken. Schaut man nach unten, sieht man Mulde, Rad und Griffe.
  const koerper = new THREE.Group();
  koerper.name = 'koerper';
  szene.add(koerper);
  const karre = schubkarreModell();
  koerper.add(karre);
  const blickVec = new THREE.Vector3();
  // Ein Stück in beiden Händen (Pressballen, Knäuel, Ziegel …)
  const stueckGeos = gegenstandGeometrien();
  const STUECK_GEO = {
    roh: stueckGeos.buendel, knaeuel: stueckGeos.knaeuel, ballen: stueckGeos.ballen, pellet: stueckGeos.pellet,
    brei: stueckGeos.brei, silage: stueckGeos.silage, papier: stueckGeos.papier, brikett: stueckGeos.ziegel,
  };
  const gehaltenMat = new THREE.MeshStandardMaterial({ color: GEGENSTAND_FARBEN.roh, roughness: 0.9 });
  const gehalten = new THREE.Mesh(STUECK_GEO.roh, heuStueckMaterial());
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

  // Fliegende Halme beim Stechen: flache Streifen, die herumwirbeln, liegen bleiben und
  // dann vergehen („digging throws hundreds of straws around“). Eine Instanzgruppe.
  const MAX_T = 600;
  const teilchenGeo = new THREE.PlaneGeometry(0.012, 0.24);
  teilchenGeo.rotateX(-Math.PI / 2);
  const teilchenMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x4a3214 });
  teilchenMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
  };
  teilchenMat.customProgramCacheKey = () => 'halmOhneFlip';
  const teilchen = new THREE.InstancedMesh(teilchenGeo, teilchenMat, MAX_T);
  teilchen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  teilchen.frustumCulled = false;
  teilchen.count = 0;
  const farbe = new THREE.Color();
  for (let i = 0; i < MAX_T; i++) { farbe.setHex(HALM_TOENE[(i * 7) % HALM_TOENE.length]); teilchen.setColorAt(i, farbe); }
  szene.add(teilchen);
  const flug = []; // {x,y,z,vx,vy,vz,rx,ry,leben,liegt}
  // Staubwolke an der Stichstelle
  const staub = new THREE.Sprite(new THREE.SpriteMaterial({ map: staubSprite(), color: 0xd8c29a, transparent: true, opacity: 0, depthWrite: false }));
  staub.visible = false;
  szene.add(staub);
  let staubZeit = 1;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const unsichtbar = new THREE.Matrix4().makeScale(0, 0, 0);
  let aktuell = null;
  let stoss = 0; // 1 → 0 nach einem Stich
  let handZeit = 0; // wie lange die Hand beim Zupfen noch zu sehen ist
  let ladungZeit = 0;
  let zeit = 0;
  let loseSchluessel = '';

  function werkzeugZeigen(id) {
    if (id === aktuell) return;
    aktuell = id;
    for (const [k, m] of Object.entries(modelle)) m.visible = k === id && k !== 'hand';
    const am = LADUNG_AM[id];
    if (am) {
      modelle[id].add(ladung);
      ladung.position.set(...am.p);
      ladung.scale.setScalar(am.s);
    } else if (ladung.parent) ladung.parent.remove(ladung);
  }

  return {
    stich(ev) {
      stoss = 1;
      handZeit = 0.5;
      if (ev.menge > 0 && ev.werkzeug !== 'hand') { ladungZeit = 0.7; }
      // Halme fliegen an der Stichstelle hoch
      const n = ev.menge > 0 ? Math.min(80, 40 + Math.round(ev.menge / 3)) : 12;
      for (let i = 0; i < n; i++) {
        if (flug.length >= MAX_T) flug.shift();
        const a = Math.random() * Math.PI * 2;
        const v = 0.5 + Math.random() * 1.6;
        flug.push({
          x: ev.x + (Math.random() - 0.5) * 0.2, y: ev.y + 0.05, z: ev.z + (Math.random() - 0.5) * 0.2,
          vx: Math.cos(a) * v, vy: 1.4 + Math.random() * 2.4, vz: Math.sin(a) * v,
          rx: Math.random() * 6, ry: Math.random() * 6, wx: 4 + Math.random() * 8, wy: 2 + Math.random() * 6,
          leben: 1.5 + Math.random() + 2, liegt: false,
        });
      }
      if (ev.menge > 0) {
        staub.position.set(ev.x, ev.y + 0.25, ev.z);
        staub.visible = true;
        staubZeit = 0;
      }
    },
    schwung() { stoss = 1; handZeit = 0.5; },

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
          if (art === 'roh' || art === 'knaeuel' || !GEGENSTAND_FARBEN[art]) gehalten.material = heuStueckMaterial();
          else { gehaltenMat.color.setHex(GEGENSTAND_FARBEN[art]); gehalten.material = gehaltenMat; }
        }
        const wippen = Math.min(1, (info.tempo || 0) / 4);
        gehalten.position.set(0.02, -0.34 - Math.abs(Math.cos(zeit * 7.5)) * 0.012 * wippen, -0.62);
        gehalten.rotation.set(0.25, 0.4, 0);
      }
      // Wippen beim Gehen, Stoß nach vorn beim Stechen
      const gehen = Math.min(1, (info.tempo || 0) / 4);
      const wx = Math.sin(zeit * 7.5) * 0.012 * gehen;
      const wy = Math.abs(Math.cos(zeit * 7.5)) * 0.014 * gehen;
      stoss = Math.max(0, stoss - dt * 4.2);
      handZeit = Math.max(0, handZeit - dt);
      if (!weg) {
        const ruhe = RUHE[sp.werkzeug] || RUHE.hand;
        const m = modelle[sp.werkzeug];
        const st = Math.sin(stoss * Math.PI);
        const saugZittern = sp.sauger.an ? (Math.random() - 0.5) * 0.006 : 0;
        if (sp.werkzeug === 'hand') {
          // Die Hand ist nur beim Zupfen zu sehen (Vorbild: keine Hand im Bild); sie kommt von unten rechts.
          m.visible = handZeit > 0;
          const rein = Math.max(0, Math.min(1, handZeit / 0.12, (0.5 - handZeit) / 0.08));
          m.position.set(ruhe.p[0] + wx - (1 - rein) * 0.04, ruhe.p[1] - (1 - rein) * 0.16, ruhe.p[2] - st * 0.12);
          m.rotation.set(ruhe.r[0] - st * 0.35, ruhe.r[1], ruhe.r[2]);
        } else {
          m.position.set(ruhe.p[0] + wx + saugZittern, ruhe.p[1] - wy - st * 0.05, ruhe.p[2] - st * 0.22);
          m.rotation.set(ruhe.r[0] - st * 0.35, ruhe.r[1], ruhe.r[2]);
        }
        // Heu auf dem Blatt kurz sichtbar, dann in den Behälter
        ladungZeit = Math.max(0, ladungZeit - dt);
        ladung.visible = ladungZeit > 0 && !!LADUNG_AM[sp.werkzeug];
        if (ladung.visible) ladung.rotation.y = zeit * 0.3;
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
      eimer.position.y = -0.28 - wy * 0.6;
      armHeu.visible = b === 'arme' && sp.last > 0 && sp.werkzeug !== 'besen';
      armHeu.scale.setScalar(0.4 + fuell * 0.9);
      koerper.visible = b === 'schubkarre' && !info.bauen;
      if (koerper.visible) {
        kamera.getWorldDirection(blickVec);
        koerper.position.set(kamera.position.x, sp.y || 0, kamera.position.z);
        koerper.rotation.set(0, Math.atan2(-blickVec.x, -blickVec.z), 0);
        karre.position.y = wy * 0.3;
        const kf = karre.getObjectByName('fuellung');
        if (kf) { kf.scale.y = Math.max(0.02, fuell); kf.visible = fuell > 0.01; }
      }

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
        if (!sichtbar.has(n)) { nadelGruppe.remove(o); o.traverse((x) => { if (x.isSprite) x.material.dispose(); }); nadelObjekte.delete(n); }
      }

      // Staub
      if (staub.visible) {
        staubZeit += dt;
        const u = staubZeit / 0.6;
        if (u >= 1) staub.visible = false;
        else {
          staub.scale.setScalar(0.3 + u * 0.9);
          staub.material.opacity = 0.35 * (1 - u);
          staub.position.y += dt * 0.25;
        }
      }
      // fliegende Halme: flattern (Luftwiderstand), landen, bleiben liegen, vergehen
      const bremse = Math.max(0, 1 - 1.6 * dt);
      for (let i = flug.length - 1; i >= 0; i--) {
        const p = flug[i];
        p.leben -= dt;
        if (p.leben <= 0) { flug.splice(i, 1); continue; }
        if (p.liegt) continue;
        p.vy -= 7 * dt;
        p.vx *= bremse; p.vz *= bremse; if (p.vy < 0) p.vy *= bremse;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += dt * p.wx; p.ry += dt * p.wy;
        const bodenH = info.boden ? info.boden(p.x, p.z) : 0;
        if (p.y < bodenH + 0.01) {
          p.y = bodenH + 0.01;
          p.liegt = true;
          p.rx = 0;
          p.leben = Math.min(p.leben, 2 + Math.random() * 0.5);
        }
      }
      const anzahl = Math.min(flug.length, MAX_T);
      for (let i = 0; i < anzahl; i++) {
        const p = flug[i];
        v3.set(p.x, p.y, p.z);
        q.setFromEuler(e3.set(p.rx, p.ry, 0));
        s3.setScalar(Math.min(1, p.leben * 1.5));
        m4.compose(v3, q, s3);
        teilchen.setMatrixAt(i, m4);
      }
      teilchen.count = anzahl;
      if (anzahl) teilchen.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Schubkarre (Blick nach -z, Boden bei y = 0): rote Mulde, Rad vorn, zwei Griffe zum Spieler. */
function schubkarreModell() {
  const g = new THREE.Group();
  const rot = new THREE.MeshStandardMaterial({ color: 0xa83a28, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  const schwarz = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.8 });
  const stahl = new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.5, metalness: 0.5 });
  const mulde = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.32, 4, 1, true), rot);
  mulde.rotation.y = Math.PI / 4;
  mulde.scale.set(1.15, 1, 1.5);
  mulde.position.set(0, 0.58, -1.05);
  g.add(mulde);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.6), rot);
  boden.rotation.x = -Math.PI / 2;
  boden.position.set(0, 0.425, -1.05);
  g.add(boden);
  // Heu als flacher Hügel in der Mulde
  const fuellung = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), heuStueckMaterial());
  fuellung.name = 'fuellung';
  fuellung.geometry.scale(0.3, 0.2, 0.46);
  fuellung.position.set(0, 0.43, -1.05);
  g.add(fuellung);
  const rad = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), schwarz);
  rad.rotation.y = Math.PI / 2;
  rad.position.set(0, 0.2, -1.72);
  g.add(rad);
  for (const x of [-1, 1]) {
    // Holm von der Radachse unter der Mulde durch bis zum Griff (Griffe ~0,7 m hoch)
    const a = new THREE.Vector3(x * 0.06, 0.2, -1.72);
    const b = new THREE.Vector3(x * 0.3, 0.72, -0.25);
    const l = a.distanceTo(b);
    const holm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, l, 6), stahl);
    holm.position.copy(a).add(b).multiplyScalar(0.5);
    holm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(holm);
    const griff = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 8), schwarz);
    griff.position.set(x * 0.31, 0.745, -0.17);
    griff.rotation.x = Math.PI / 2 - 0.34;
    g.add(griff);
    const stuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), stahl);
    stuetze.position.set(x * 0.2, 0.22, -0.8);
    g.add(stuetze);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/** Weicher Staubfleck für die Wolke beim Stechen. */
function staubSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  for (const [px, py, r] of [[32, 34, 26], [22, 30, 16], [42, 28, 17], [32, 22, 14]]) {
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
