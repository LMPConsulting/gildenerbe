// Die Bedienung über der 3D-Welt, gestaltet nach dem HUD des Vorbilds:
// Geld oben rechts mit „Heu übrig“ und $/min, die Missionskarte oben links
// („Schritt n von m“, goldener Titel, Zähler), die Werkzeugleiste unten mittig,
// ein kleiner Kreis als Fadenkreuz mit Hinweis darunter. Fürs Handy dazu ein
// großer Aktionsknopf, Springen und Knöpfe für Bauen, Forschung und Nadeln.

import { MISSIONEN } from '../daten.js';
import { geld, halme, zahl, prozentAb, dauer } from '../format.js';

export function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat(Infinity)) {
    if (kind == null || kind === false) continue;
    e.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return e;
}

export function setzeText(e, t) {
  const s = String(t);
  if (e.textContent !== s) e.textContent = s;
}

const ICON = {
  hand: '<path d="M8 21c-2-3-3-6-3-9V8a1.5 1.5 0 0 1 3 0v4M8 11V5a1.5 1.5 0 0 1 3 0v6M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2 7-6 7H8"/>',
  sandschaufel: '<path d="M12 3v9"/><path d="M7 14c0-2 2-3 5-3s5 1 5 3c0 4-2 7-5 7s-5-3-5-7Z" fill="currentColor" fill-opacity=".35"/>',
  spaten: '<path d="M12 2v11"/><path d="M9 2h6"/><path d="M8 13h8l-1 7c-1 2-5 2-6 0Z"/>',
  heugabel: '<path d="M12 11v11"/><path d="M6 3v5c0 2 2 3 6 3s6-1 6-3V3M9 3v6M12 3v7M15 3v6"/>',
  besen: '<path d="M16 3 9 14"/><path d="M5 13l6 3-2 6c-2 0-5-2-6-4Z"/>',
  detektor: '<path d="M6 21 12 9"/><circle cx="15" cy="6" r="3"/><path d="M4 17l3 1"/>',
  sauger: '<path d="M4 20l7-7"/><rect x="11" y="5" width="9" height="8" rx="2"/><path d="M13 5V3h5v2"/>',
  bauen: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
  forschung: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5v3a3 3 0 0 0 3 3h1.5M18 8.5v3a3 3 0 0 1-3 3h-1.5"/>',
  nadel: '<path d="M4 20 17 7"/><ellipse cx="18.5" cy="5.5" rx="2.2" ry="1.2" transform="rotate(-45 18.5 5.5)"/>',
  menue: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  zu: '<path d="M6 6l12 12M18 6 6 18"/>',
  eimer: '<path d="M5 8h14l-2 12H7Z"/><path d="M5 8c0-3 3-5 7-5s7 2 7 5"/>',
  puste: '<path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z"/>',
  sprung: '<path d="M12 20V6M6 11l6-6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/>',
};

export function icon(name, klasse = 'ic') {
  return h('span', { class: klasse, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ''}</svg>` });
}

/**
 * Baut das HUD. rueckruf: { werkzeug(id), aktion(an), sprung(), bauen(), forschung(), nadeln(), menue(), ducken(an) }.
 */
export function oberflaecheBauen(wurzel, rueckruf) {
  const el = {};
  // oben rechts: Geld, Heu übrig, $/min
  el.geld = h('div', { class: 'hgeld num' });
  el.rest = h('div', { class: 'hrest num' });
  el.rate = h('div', { class: 'hrate num' });
  el.schulden = h('div', { class: 'hschulden num' });
  const kasse = h('div', { class: 'kasse' }, el.geld, el.schulden, el.rest, el.rate);
  // Knopfleiste oben rechts
  const knopf = (name, label, fn) => h('button', { class: 'rundknopf', 'aria-label': label, onclick: (ev) => { ev.stopPropagation(); fn(); } }, icon(name));
  el.nadelKnopf = knopf('nadel', 'Nadeln und Ladungen', rueckruf.nadeln);
  el.forschungKnopf = knopf('forschung', 'Forschung', rueckruf.forschung);
  el.forschungMarke = h('span', { class: 'marke' });
  el.forschungKnopf.append(el.forschungMarke);
  el.bauKnopf = knopf('bauen', 'Bauen', rueckruf.bauen);
  const leiste = h('div', { class: 'knopfleiste' }, el.nadelKnopf, el.forschungKnopf, el.bauKnopf, knopf('menue', 'Menü', rueckruf.menue));

  // Missionskarte oben links
  el.missionSchritt = h('div', { class: 'mschritt' });
  el.missionTitel = h('div', { class: 'mtitel' });
  el.missionHilfe = h('div', { class: 'mhilfe' });
  el.missionBalken = h('div', { class: 'fuellung' });
  el.missionZaehler = h('div', { class: 'mzaehler num' });
  el.missionLohn = h('div', { class: 'mlohn' });
  el.mission = h('div', { class: 'missionkarte', onclick: () => el.mission.classList.toggle('klein') },
    el.missionSchritt, el.missionTitel, el.missionHilfe,
    h('div', { class: 'mfuss' }, h('div', { class: 'mbalken' }, el.missionBalken), el.missionZaehler), el.missionLohn);

  // Mitte: Fadenkreuz und Hinweis
  el.fadenkreuz = h('div', { class: 'fadenkreuz' });
  el.hinweis = h('div', { class: 'zielhinweis' });
  el.detektor = h('div', { class: 'detektorleiste', hidden: true },
    h('div', { class: 'segmente' }, Array.from({ length: 12 }, () => h('span', { class: 'seg' }))), h('span', { class: 'dtext num' }));

  // Werkzeugleiste unten mittig
  el.leiste = h('div', { class: 'werkzeugleiste', role: 'toolbar', 'aria-label': 'Werkzeuge' });
  el.slots = {};
  // Behälter und Puste darüber
  el.behaelterText = h('span', { class: 'num' });
  el.behaelterFuellung = h('div', { class: 'fuellung' });
  el.behaelter = h('div', { class: 'balken behaelter' }, el.behaelterFuellung, icon('eimer', 'ic klein'), el.behaelterText);
  el.pusteFuellung = h('div', { class: 'fuellung' });
  el.puste = h('div', { class: 'balken puste' }, el.pusteFuellung, icon('puste', 'ic klein'));
  el.hitzeFuellung = h('div', { class: 'fuellung' });
  el.hitze = h('div', { class: 'balken hitze', hidden: true }, el.hitzeFuellung, h('span', {}, 'Hitze'));
  const status = h('div', { class: 'statuszeile' }, el.behaelter, el.puste, el.hitze);

  // rechts unten: Aktion und Springen
  el.aktion = h('button', { class: 'aktionsknopf', 'aria-label': 'Aktion' }, h('span', { class: 'atext' }, 'Aktion'));
  el.aktionText = el.aktion.firstChild;
  el.aktion.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); el.aktion.setPointerCapture?.(ev.pointerId); rueckruf.aktion(true); });
  const los = () => rueckruf.aktion(false);
  el.aktion.addEventListener('pointerup', los);
  el.aktion.addEventListener('pointercancel', los);
  el.aktion.addEventListener('lostpointercapture', los);
  el.sprung = h('button', { class: 'sprungknopf', 'aria-label': 'Springen' }, icon('sprung'));
  el.sprung.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); rueckruf.sprung(); });
  // Kleiner Knopf „Ansehen“: öffnet die Tafel einer Maschine, auch wenn man Heu trägt
  el.info = h('button', { class: 'infoknopf', 'aria-label': 'Ansehen', hidden: true }, icon('info'));
  el.info.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (rueckruf.info) rueckruf.info(); });

  el.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  el.modal = h('div', { class: 'modalhalter' });
  el.schwebe = h('div', { class: 'schwebetexte' });

  const hud = h('div', { class: 'hud' }, kasse, leiste, el.mission, el.fadenkreuz, el.hinweis, el.detektor,
    status, el.leiste, el.aktion, el.sprung, el.info, el.schwebe, el.toasts, el.modal);
  wurzel.append(hud);

  /* ------------------------------ Toasts und Einblendungen */
  function toast(text, art = '') {
    for (const t of el.toasts.children) if (t.textContent === text && !t.classList.contains('weg')) return;
    const t = h('div', { class: `toast ${art}` }, text);
    el.toasts.append(t);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('weg'), 3200);
    setTimeout(() => t.remove(), 3600);
  }

  const warteschlange = [];
  const modalOffen = () => el.modal.classList.contains('offen');
  function modalSchliessen() {
    el.modal.classList.remove('offen');
    el.modal.innerHTML = '';
    if (rueckruf.modalZu) rueckruf.modalZu();
  }
  function naechstesModal() { if (!modalOffen() && warteschlange.length) modal(warteschlange.shift()); }
  function modal(o) {
    if (modalOffen()) { warteschlange.push(o); return; }
    const { titel, ober, absaetze = [], inhalt = null, knoepfe = [], klasse = '' } = o;
    el.modal.innerHTML = '';
    const knopfListe = knoepfe.map((k) => h('button', {
      class: `knopf ${k.klasse || ''}`,
      onclick: () => { modalSchliessen(); if (k.aktion) k.aktion(); naechstesModal(); },
    }, k.text));
    const karte = h('div', { class: `modal ${klasse}`, role: 'dialog', 'aria-modal': 'true' },
      ober ? h('p', { class: 'ober' }, ober) : null,
      titel ? h('h2', {}, titel) : null,
      absaetze.map((p) => h('p', {}, p)),
      inhalt,
      knopfListe.length ? h('div', { class: 'modalknoepfe' }, knopfListe) : null);
    el.modal.append(h('div', { class: 'schleier' }), karte);
    el.modal.classList.add('offen');
    if (rueckruf.modalAuf) rueckruf.modalAuf();
  }

  /** Kurzer Text, der an einer Bildschirmstelle aufsteigt (Verkaufsbetrag, „+6“). */
  function schwebeText(text, x, y, art = '') {
    const t = h('div', { class: `schwebetext ${art}`, style: { left: `${x}px`, top: `${y}px` } }, text);
    el.schwebe.append(t);
    while (el.schwebe.children.length > 12) el.schwebe.firstChild.remove();
    setTimeout(() => t.remove(), 1300);
  }

  /* ------------------------------ Werkzeugleiste */
  let leistenSchluessel = '';
  function leisteSetzen(werkzeuge, aktiv, extra = []) {
    const schluessel = werkzeuge.map((w) => w.id).join(',') + '|' + extra.map((x) => x.id).join(',');
    if (schluessel !== leistenSchluessel) {
      leistenSchluessel = schluessel;
      el.leiste.innerHTML = '';
      el.slots = {};
      werkzeuge.forEach((wz, i) => {
        const b = h('button', {
          class: 'slot', 'aria-label': wz.name, title: wz.text,
          onclick: (ev) => { ev.stopPropagation(); rueckruf.werkzeug(wz.id); },
        }, h('span', { class: 'taste' }, String(i + 1)), icon(wz.id), h('span', { class: 'sname' }, wz.kurz));
        el.slots[wz.id] = b;
        el.leiste.append(b);
      });
      for (const x of extra) {
        const b = h('button', { class: 'slot extra', 'aria-label': x.name, onclick: (ev) => { ev.stopPropagation(); x.aktion(); } },
          h('span', { class: 'taste' }, x.taste), h('span', { class: 'sname gross' }, x.kurz));
        el.leiste.append(b);
      }
    }
    for (const [id, b] of Object.entries(el.slots)) b.classList.toggle('gewaehlt', id === aktiv);
  }

  /* ------------------------------ Anzeigen */
  function missionZeigen(ms, nr) {
    el.mission.hidden = !ms;
    if (!ms) return;
    setzeText(el.missionSchritt, `Schritt ${nr + 1} von ${MISSIONEN.length}`);
    setzeText(el.missionTitel, ms.m.text);
    setzeText(el.missionHilfe, ms.m.hilfe || '');
    el.missionHilfe.hidden = !ms.m.hilfe;
    const zaehlbar = !['tech', 'werkzeug', 'ladungen', 'haelfte', 'strom'].includes(ms.m.art);
    let z = '';
    if (ms.m.art === 'haelfte') z = `${prozentAb(ms.ist)} von 50 %`;
    else if (zaehlbar && ms.ziel >= 1e5) z = prozentAb(ms.ist / ms.ziel);
    else if (ms.m.art === 'umgesehen' || ms.m.art === 'gelaufen') z = `${Math.floor(ms.ist)} / ${ms.ziel}`;
    else z = `${zahl(Math.floor(ms.ist))} / ${zahl(ms.ziel)}`;
    setzeText(el.missionZaehler, z);
    el.missionBalken.style.width = `${Math.min(100, (ms.ist / ms.ziel) * 100)}%`;
    const lohn = ms.m.geschenk ? 'Geschenk' : ms.m.geschenkTech ? 'Geschenk' : ms.m.geld ? `+${geld(ms.m.geld)}` : '';
    setzeText(el.missionLohn, lohn);
  }

  return {
    el, toast, modal, modalOffen, modalSchliessen, schwebeText, leisteSetzen, missionZeigen,
    kasseZeigen({ geldBetrag, schulden, rest, rate }) {
      setzeText(el.geld, geld(geldBetrag));
      setzeText(el.schulden, schulden > 0 ? `Schulden ${geld(schulden)}` : '');
      el.schulden.hidden = !(schulden > 0);
      setzeText(el.rest, `${halme(rest)} Heu übrig`);
      setzeText(el.rate, `${geld(rate)}/min`);
    },
    hinweisZeigen(text) {
      setzeText(el.hinweis, text || '');
      el.hinweis.classList.toggle('sichtbar', !!text);
    },
    infoZeigen(sichtbar) {
      if (el.info.hidden === !sichtbar) return;
      el.info.hidden = !sichtbar;
    },
    aktionZeigen(text, aktiv = true) {
      setzeText(el.aktionText, text);
      el.aktion.classList.toggle('matt', !aktiv);
    },
    behaelterZeigen(name, menge, platz) {
      setzeText(el.behaelterText, `${halme(menge)} / ${halme(platz)}`);
      el.behaelterFuellung.style.width = `${Math.min(100, (menge / Math.max(1, platz)) * 100)}%`;
      el.behaelter.classList.toggle('voll', menge >= platz);
      el.behaelter.title = name;
    },
    pusteZeigen(anteil, leer) {
      el.pusteFuellung.style.width = `${Math.round(Math.max(0, Math.min(1, anteil)) * 100)}%`;
      el.puste.classList.toggle('leer', leer);
    },
    hitzeZeigen(sichtbar, anteil, heiss) {
      el.hitze.hidden = !sichtbar;
      el.hitzeFuellung.style.width = `${Math.round(anteil * 100)}%`;
      el.hitze.classList.toggle('heiss', heiss);
    },
    detektorZeigen(sichtbar, staerke, text) {
      el.detektor.hidden = !sichtbar;
      if (!sichtbar) return;
      const segs = el.detektor.firstChild.children;
      const an = Math.round(staerke * segs.length);
      for (let i = 0; i < segs.length; i++) {
        segs[i].classList.toggle('an', i < an);
        segs[i].classList.toggle('heiss', i < an && i >= segs.length * 0.7);
      }
      setzeText(el.detektor.lastChild, text || '');
    },
    forschungMarke(n) {
      setzeText(el.forschungMarke, n ? String(n) : '');
      el.forschungMarke.classList.toggle('sichtbar', n > 0);
    },
    dauerText: dauer,
  };
}
