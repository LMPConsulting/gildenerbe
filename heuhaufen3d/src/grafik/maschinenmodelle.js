// Platzhalter, bis die ausgearbeiteten Modelle da sind: jede Maschine als
// schlichter Kasten in ihren Maßen, Mast als Stange, Laster und Drohne grob.

import * as THREE from '../../vendor/three.module.min.js';
import { BAU_BY_ID } from '../welt.js';

const PLATZHALTER_FARBE = { auto: 0xe0641e, strom: 0x5a6068, suche: 0xd8d4c8, verarbeitung: 0xb86f2c, wasser: 0x3d6fa8, linien: 0x6a6f75, hofbau: 0x9c7349 };

export function maschinenModell(typ) {
  const d = BAU_BY_ID[typ];
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PLATZHALTER_FARBE[d.kat] || 0x888888, roughness: 0.7 });
  if (typ === 'mast') {
    const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, d.h, 8), mat);
    stange.position.y = d.h / 2;
    g.add(stange);
    return g;
  }
  const k = new THREE.Mesh(new THREE.BoxGeometry(d.b, d.h, d.t), mat);
  k.position.y = d.h / 2;
  g.add(k);
  return g;
}

export function lasterModell() {
  const g = new THREE.Group();
  const kabine = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x2f5f9f }));
  kabine.position.set(2.3, 1.3, 0);
  const bett = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 2.1), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
  bett.position.set(-0.4, 0.9, 0);
  g.add(kabine, bett);
  return g;
}

export function drohnenModell() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 })));
  return g;
}
