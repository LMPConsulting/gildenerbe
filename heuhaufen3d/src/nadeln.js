// Nadeln stecken an echten Stellen im Haufen. Sinkt die Oberfläche unter eine
// Nadel, springt sie heraus: liegt dann glitzernd obenauf (Hand oder Werkzeug hebt
// sie auf) oder steckt im Heu, das eine Maschine gerade wegnimmt, und fährt mit
// aufs Band. Ein Scanner hält sie fest; wird sie mitverkauft, fällt sie zurück in
// den Haufen. Reine Logik.

import { NADEL_LAGEN, NADELN } from './daten.js';
import { haufenHoehe } from './haufen.js';
import { nadelArten, werte } from './wirtschaft.js';

/** Sechs Nadeln für eine neue Ladung verstecken. */
export function nadelnVerteilen(s, hf, zufall) {
  const arten = nadelArten(s.ladung, zufall);
  return NADEL_LAGEN.map((lage, i) => {
    const pos = nadelStelle(hf, lage, zufall);
    return { nr: i, art: arten[i], ...pos, zustand: 'versteckt' };
  });
}

function nadelStelle(hf, lage, zufall) {
  if (lage === NADEL_LAGEN[0]) {
    // Die erste Nadel steckt flach am Fuß des Haufens: vom Boden aus erreichbar und
    // höchstens gut 30 cm unter der Oberfläche, damit der Detektor „heiß“ zeigen kann.
    for (let versuch = 0; versuch < 80; versuch++) {
      const winkel = zufall() * Math.PI * 2;
      const rand = 0.68 + zufall() * 0.28;
      const x = hf.mitteX + Math.cos(winkel) * rand * hf.radius;
      const z = hf.mitteZ + Math.sin(winkel) * rand * hf.radius;
      const h = haufenHoehe(hf, x, z);
      if (h < 0.5 || h > 1.8) continue;
      return { x, y: Math.max(0.08, h - (0.12 + zufall() * 0.2)), z };
    }
  }
  for (let versuch = 0; versuch < 40; versuch++) {
    const winkel = zufall() * Math.PI * 2;
    const rand = lage.rand[0] + zufall() * (lage.rand[1] - lage.rand[0]);
    const x = hf.mitteX + Math.cos(winkel) * rand * hf.radius;
    const z = hf.mitteZ + Math.sin(winkel) * rand * hf.radius;
    const h = haufenHoehe(hf, x, z);
    if (h < 0.4) continue;
    const tiefe = lage.tiefe[0] + zufall() * (lage.tiefe[1] - lage.tiefe[0]);
    // Die erste Nadel soll man vom Boden aus erreichen: nicht höher als Schulterhöhe.
    let y = h * (1 - tiefe);
    if (lage === NADEL_LAGEN[0]) y = Math.min(y, 1.5);
    return { x, y: Math.max(0.08, y), z };
  }
  return { x: hf.mitteX, y: 0.2, z: hf.mitteZ };
}

/**
 * Nach dem Abtragen: welche versteckten Nadeln liegen jetzt frei?
 * quelle: { art: 'spieler'|'maschine'|'rutsch', x, z, radius, werkzeug }.
 * Liefert die Nadeln, die mit dem weggenommenen Heu mitgehen (bei Maschinen und
 * der Kinderschaufel); die übrigen werden 'lose' und liegen obenauf.
 */
export function nadelnFreilegen(s, hf, quelle, ereignisse) {
  const mit = [];
  for (const n of s.nadeln) {
    if (n.zustand !== 'versteckt') continue;
    const oben = haufenHoehe(hf, n.x, n.z);
    if (oben > n.y + 0.03) continue;
    const nahe = quelle && Math.hypot(n.x - quelle.x, n.z - quelle.z) <= (quelle.radius || 0.8) + 0.25;
    if (nahe && quelle.art === 'maschine') {
      n.zustand = 'unterwegs';
      mit.push(n);
    } else if (nahe && quelle.art === 'spieler' && quelle.werkzeug === 'sandschaufel') {
      // Die Kinderschaufel hebt Nadeln sanft heraus: sie liegt gleich auf der Schaufel.
      n.zustand = 'lose';
      n.y = oben;
      mit.push(n);
    } else {
      n.zustand = 'lose';
      n.y = Math.max(0.02, oben) + 0.02;
      n.zeit = s.zeit;
      if (ereignisse) ereignisse.push({ typ: 'nadelFrei', nadel: n });
    }
  }
  return mit;
}

/** Lose Nadeln sinken mit, wenn unter ihnen weiter gegraben wird. */
export function loseNadelnSetzen(s, hf) {
  for (const n of s.nadeln) {
    if (n.zustand !== 'lose') continue;
    const oben = haufenHoehe(hf, n.x, n.z);
    if (n.y > oben + 0.03) n.y = Math.max(0.02, oben + 0.02);
  }
}

/** Die Nadel ist gefunden: zählt, schaltet ihren Bonus frei, erzählt ein Stück Geschichte. */
export function nadelFinden(s, n, ereignisse) {
  if (!n || n.zustand === 'gefunden') return;
  n.zustand = 'gefunden';
  s.nadelnGesamt++;
  const neu = !s.arten[n.art];
  s.arten[n.art] = (s.arten[n.art] || 0) + 1;
  if (neu) s.rev++;
  if (s.stat.ersteNadel == null) s.stat.ersteNadel = s.zeit;
  const nr = s.nadeln.filter((x) => x.zustand === 'gefunden').length;
  ereignisse.push({ typ: 'nadel', nadel: n, nr, art: n.art, neu, name: NADELN[n.art].name });
}

/** Mit einer Ware verkauft: die Nadel fällt zurück in den Haufen, an eine neue, tiefe Stelle. */
export function nadelZurueck(s, hf, n, zufall, ereignisse) {
  if (!n || n.zustand === 'gefunden') return;
  const lage = { tiefe: [0.35, 0.85], rand: [0.05, 0.6] };
  for (let versuch = 0; versuch < 30; versuch++) {
    const winkel = zufall() * Math.PI * 2;
    const r = (lage.rand[0] + zufall() * (lage.rand[1] - lage.rand[0])) * hf.radius;
    const x = hf.mitteX + Math.cos(winkel) * r;
    const z = hf.mitteZ + Math.sin(winkel) * r;
    const h = haufenHoehe(hf, x, z);
    if (h < 0.3) continue;
    n.x = x; n.z = z;
    n.y = h * (1 - (lage.tiefe[0] + zufall() * (lage.tiefe[1] - lage.tiefe[0])));
    n.zustand = 'versteckt';
    s.stat.nadelnZurueck = (s.stat.nadelnZurueck || 0) + 1;
    if (ereignisse) ereignisse.push({ typ: 'nadelZurueck', nadel: n });
    return;
  }
  // Kein Heu mehr da: dann liegt sie eben lose am Boden in der Mitte.
  n.x = hf.mitteX; n.z = hf.mitteZ; n.y = 0.02; n.zustand = 'lose';
}

/** Nächste Nadel (versteckt oder lose) zum Punkt, mit Abstand in Metern. */
export function naechsteNadel(s, x, y, z) {
  let beste = null;
  let d = Infinity;
  for (const n of s.nadeln) {
    if (n.zustand !== 'versteckt' && n.zustand !== 'lose') continue;
    const dd = Math.hypot(n.x - x, n.y - y, n.z - z);
    if (dd < d) { d = dd; beste = n; }
  }
  return beste ? { nadel: beste, abstand: d } : null;
}

/** Detektor: Stärke 0..1 (1 = direkt drauf), Stufe, Abstand. Gemessen an der Spule. */
export function detektorMessen(s, x, y, z) {
  const w = werte(s);
  const nn = naechsteNadel(s, x, y, z);
  if (!nn) return { staerke: 0, stufe: 'still', abstand: null };
  const staerke = Math.max(0, 1 - nn.abstand / w.detektor);
  const stufe = staerke <= 0 ? 'still' : staerke < 0.4 ? 'kalt' : staerke < 0.8 ? 'warm' : 'heiss';
  return { staerke, stufe, abstand: nn.abstand, nadel: nn.nadel };
}
