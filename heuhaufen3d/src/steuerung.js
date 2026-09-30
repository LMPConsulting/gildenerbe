// Eingabe fürs Handy und für den Rechner.
// Handy: linke Bildhälfte ist ein Stick (erscheint, wo der Daumen aufsetzt),
// rechte Hälfte zum Umsehen; Knöpfe für Aktion, Springen und Werkzeuge legt die
// Oberfläche darüber. Rechner: WASD, Maus (Zeiger sperren per Klick), Leertaste,
// Umschalt zum Rennen, E benutzen, B bauen, Q fallenlassen, 1–9 Werkzeuge.

import { SPIELER } from './daten.js';

export function steuerungBauen(flaeche, { beiTaste = () => {}, beiAktion = () => {} } = {}) {
  const z = {
    vor: 0, seit: 0, // -1..1, vor = +1 heißt nach vorn
    blickX: 0, blickY: 0, // aufgesammelte Drehung seit dem letzten Bild (Radiant)
    springen: false,
    rennen: false,
    aktion: false, // gehalten
    aktionNeu: false, // in diesem Bild gedrückt
    empfindlichkeit: 1,
    gesperrt: false, // Zeiger gesperrt (Rechner)
    touch: false,
  };
  const tasten = new Set();
  let stick = null; // {id, x0, y0, x, y}
  let blick = null; // {id, x, y, t0, weg}
  const stickEl = document.createElement('div');
  stickEl.className = 'stick';
  stickEl.innerHTML = '<div class="stickknopf"></div>';
  stickEl.hidden = true;
  flaeche.appendChild(stickEl);
  const stickKnopf = stickEl.firstChild;
  const STICK_RADIUS = 56;

  function stickZeigen() {
    if (!stick) { stickEl.hidden = true; return; }
    stickEl.hidden = false;
    stickEl.style.left = `${stick.x0}px`;
    stickEl.style.top = `${stick.y0}px`;
    let dx = stick.x - stick.x0;
    let dy = stick.y - stick.y0;
    const l = Math.hypot(dx, dy);
    if (l > STICK_RADIUS) { dx = (dx / l) * STICK_RADIUS; dy = (dy / l) * STICK_RADIUS; }
    stickKnopf.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  flaeche.addEventListener('pointerdown', (ev) => {
    if (ev.target !== flaeche) return;
    if (ev.pointerType === 'mouse') {
      if (!z.gesperrt && flaeche.requestPointerLock) {
        try { const p = flaeche.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* egal */ }
      } else if (ev.button === 0) { z.aktion = true; z.aktionNeu = true; beiAktion(true); }
      return;
    }
    z.touch = true;
    const r = flaeche.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    if (x < r.width * 0.42 && !stick) {
      stick = { id: ev.pointerId, x0: x, y0: y, x, y };
      stickZeigen();
    } else if (!blick) {
      blick = { id: ev.pointerId, x, y, t0: performance.now(), weg: 0 };
    } else return;
    try { flaeche.setPointerCapture(ev.pointerId); } catch { /* egal */ }
    ev.preventDefault();
  });

  flaeche.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') {
      if (z.gesperrt) {
        z.blickX -= ev.movementX * SPIELER.blickEmpfindlichkeit * 0.55 * z.empfindlichkeit;
        z.blickY -= ev.movementY * SPIELER.blickEmpfindlichkeit * 0.55 * z.empfindlichkeit;
      }
      return;
    }
    const r = flaeche.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    if (stick && ev.pointerId === stick.id) {
      stick.x = x; stick.y = y;
      stickZeigen();
    } else if (blick && ev.pointerId === blick.id) {
      const dx = x - blick.x;
      const dy = y - blick.y;
      blick.x = x; blick.y = y;
      blick.weg += Math.hypot(dx, dy);
      z.blickX -= dx * SPIELER.blickEmpfindlichkeit * z.empfindlichkeit;
      z.blickY -= dy * SPIELER.blickEmpfindlichkeit * z.empfindlichkeit;
    }
  });

  function loslassen(ev) {
    if (ev.pointerType === 'mouse') {
      if (ev.button === 0 && z.aktion) { z.aktion = false; beiAktion(false); }
      return;
    }
    if (stick && ev.pointerId === stick.id) { stick = null; stickZeigen(); }
    if (blick && ev.pointerId === blick.id) {
      // kurzes Tippen ohne Wischen: wie ein Druck auf die Aktion
      const kurz = performance.now() - blick.t0 < 260 && blick.weg < 12;
      blick = null;
      if (kurz) { z.aktionNeu = true; beiAktion(true); beiAktion(false); }
    }
  }
  flaeche.addEventListener('pointerup', loslassen);
  flaeche.addEventListener('pointercancel', loslassen);
  flaeche.addEventListener('contextmenu', (ev) => ev.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    z.gesperrt = document.pointerLockElement === flaeche;
    if (!z.gesperrt && z.aktion) { z.aktion = false; beiAktion(false); }
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    const k = ev.key.toLowerCase();
    if (!tasten.has(k)) {
      tasten.add(k);
      if (k === ' ') z.springen = true;
      beiTaste(k, ev);
    }
    if ([' ', 'tab'].includes(k)) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => tasten.delete(ev.key.toLowerCase()));
  window.addEventListener('blur', () => { tasten.clear(); stick = null; blick = null; stickZeigen(); });

  return {
    zustand: z,
    /** Einmal pro Bild: Stick und Tasten in vor/seit umrechnen. */
    lesen() {
      let vor = 0;
      let seit = 0;
      if (tasten.has('w') || tasten.has('arrowup')) vor += 1;
      if (tasten.has('s') || tasten.has('arrowdown')) vor -= 1;
      if (tasten.has('d') || tasten.has('arrowright')) seit += 1;
      if (tasten.has('a') || tasten.has('arrowleft')) seit -= 1;
      z.rennen = tasten.has('shift');
      if (stick) {
        const dx = stick.x - stick.x0;
        const dy = stick.y - stick.y0;
        const l = Math.hypot(dx, dy);
        const tot = 8;
        if (l > tot) {
          const k = Math.min(1, (l - tot) / (STICK_RADIUS - tot));
          seit += (dx / l) * k;
          vor -= (dy / l) * k;
          // ganz nach außen gedrückt: rennen
          if (l > STICK_RADIUS * 1.35) z.rennen = true;
        }
      }
      const l = Math.hypot(vor, seit);
      if (l > 1) { vor /= l; seit /= l; }
      z.vor = vor;
      z.seit = seit;
      return z;
    },
    /** Nach dem Bild: Einmal-Ereignisse zurücksetzen. */
    verbraucht() {
      z.blickX = 0;
      z.blickY = 0;
      z.springen = false;
      z.aktionNeu = false;
    },
    aktionDruecken(an) {
      if (an && !z.aktion) z.aktionNeu = true;
      z.aktion = an;
      beiAktion(an);
    },
    springenDruecken() { z.springen = true; },
    zeigerFreigeben() { if (document.exitPointerLock) document.exitPointerLock(); },
  };
}
