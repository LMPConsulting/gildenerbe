// Die Staffelei mit Skizzenbuch, wie im Vorbild: mit dem Finger auf das Blatt
// zeichnen, das Bild behalten (es kommt ins Skizzenbuch) und ein behaltenes
// Bild wieder aufhängen. Striche werden als Punktlisten in 0..1 gespeichert,
// damit der Spielstand klein bleibt.

import { h, setzeText } from './oberflaeche.js';

export const SKIZZE_FARBEN = ['#1d1b19', '#c8321e', '#2f6fb3', '#3c8a3a', '#e3a032', '#ffffff'];
export const SKIZZEN_MAX = 12;
const PUNKTE_MAX = 5000;
const SEITE = 0.75; // Höhe zu Breite des Blatts

/** Zeichnet Striche auf ein 2D-Canvas (auch für die Textur an der Staffelei). */
export function skizzeMalen(ctx, striche, breite, hoehe) {
  ctx.fillStyle = '#fbf8f0';
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of striche || []) {
    const [farbe, dicke, ...p] = st;
    if (p.length < 2) continue;
    ctx.strokeStyle = SKIZZE_FARBEN[farbe] || SKIZZE_FARBEN[0];
    ctx.lineWidth = Math.max(1, dicke * breite);
    ctx.beginPath();
    ctx.moveTo(p[0] * breite, (p[1] / SEITE) * hoehe);
    if (p.length === 2) ctx.lineTo(p[0] * breite + 0.01, (p[1] / SEITE) * hoehe);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * breite, (p[i + 1] / SEITE) * hoehe);
    ctx.stroke();
  }
}

const punkteZahl = (striche) => striche.reduce((n, st) => n + (st.length - 2) / 2, 0);

/**
 * Tafel der Staffelei. rueck: { geaendert() } wird nach jeder Änderung gerufen
 * (Bild an der Staffelei neu zeichnen, speichern).
 */
export function skizzeZeigen(ui, s, bau, rueck) {
  if (!Array.isArray(bau.striche)) bau.striche = [];
  if (!Number.isInteger(bau.bild)) bau.bild = -1;
  // Ein aufgehängtes Bild wird zum Weitermalen auf das Blatt kopiert.
  let striche = bau.bild >= 0 && s.skizzen[bau.bild] ? s.skizzen[bau.bild].striche.map((x) => [...x]) : bau.striche.map((x) => [...x]);
  let farbe = 0;
  let dicke = 0.012;
  let blatt = bau.bild >= 0 ? s.skizzen.length : -1; // Blättern im Skizzenbuch: -1 = das Blatt auf der Staffelei

  const leinwand = h('canvas', { class: 'skizzenblatt', width: 640, height: 480 });
  const ctx = leinwand.getContext('2d');
  const hinweis = h('small', { class: 'skizzenhinweis' });
  const malen = () => {
    const zeigen = blatt >= 0 && blatt < s.skizzen.length ? s.skizzen[blatt].striche : striche;
    skizzeMalen(ctx, zeigen, leinwand.width, leinwand.height);
    setzeText(hinweis, blatt >= 0 && blatt < s.skizzen.length
      ? `Skizzenbuch: Bild ${blatt + 1} von ${s.skizzen.length}`
      : `Mit dem Finger zeichnen · ${s.skizzen.length} von ${SKIZZEN_MAX} im Skizzenbuch`);
  };
  const uebernehmen = () => {
    bau.striche = striche.map((x) => [...x]);
    bau.bild = -1;
    rueck.geaendert();
  };

  let strich = null;
  // Das Blatt wird mit object-fit: contain gezeigt: Ränder herausrechnen.
  const punkt = (ev) => {
    const r = leinwand.getBoundingClientRect();
    const mass = Math.min(r.width / leinwand.width, r.height / leinwand.height);
    const bw = leinwand.width * mass;
    const bh = leinwand.height * mass;
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left - (r.width - bw) / 2) / bw));
    const y = Math.max(0, Math.min(1, (ev.clientY - r.top - (r.height - bh) / 2) / bh)) * SEITE;
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  };
  leinwand.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (blatt >= 0 && blatt < s.skizzen.length) return; // im Skizzenbuch wird nicht gemalt
    if (punkteZahl(striche) > PUNKTE_MAX) { ui.toast('Das Blatt ist voll. Neu anfangen oder behalten.'); return; }
    leinwand.setPointerCapture?.(ev.pointerId);
    strich = [farbe, dicke, ...punkt(ev)];
    striche.push(strich);
    malen();
  });
  leinwand.addEventListener('pointermove', (ev) => {
    if (!strich) return;
    ev.preventDefault();
    const [x, y] = punkt(ev);
    const lx = strich[strich.length - 2];
    const ly = strich[strich.length - 1];
    if (Math.hypot(x - lx, y - ly) < 0.004) return;
    strich.push(x, y);
    malen();
  });
  const los = () => { if (strich) { strich = null; uebernehmen(); } };
  leinwand.addEventListener('pointerup', los);
  leinwand.addEventListener('pointercancel', los);

  const farbKnoepfe = SKIZZE_FARBEN.map((c, i) => h('button', {
    class: `farbknopf${i === 0 ? ' gewaehlt' : ''}`, style: { background: c }, 'aria-label': i === 5 ? 'Radierer' : `Farbe ${i + 1}`,
    onclick: (ev) => {
      ev.stopPropagation();
      farbe = i;
      for (const b of farbKnoepfe) b.classList.toggle('gewaehlt', b === ev.currentTarget);
    },
  }));
  const dickeKnopf = h('button', {
    class: 'knopf klein', onclick: (ev) => {
      ev.stopPropagation();
      dicke = dicke < 0.02 ? 0.03 : 0.012;
      setzeText(dickeKnopf, dicke < 0.02 ? 'Dünn' : 'Dick');
    },
  }, 'Dünn');
  const knopf = (text, fn, klasse = '') => h('button', { class: `knopf klein ${klasse}`, onclick: (ev) => { ev.stopPropagation(); fn(); } }, text);
  const farben = h('div', { class: 'skizzenfarben' }, farbKnoepfe);
  const leiste = h('div', { class: 'skizzenleiste' },
    dickeKnopf,
    knopf('Neu', () => { blatt = -1; striche = []; uebernehmen(); malen(); }),
    knopf('Zurück', () => { if (blatt < 0) { striche.pop(); uebernehmen(); malen(); } }));
  const buchLeiste = h('div', { class: 'skizzenleiste' },
    knopf('‹', () => { if (!s.skizzen.length) return; blatt = blatt < 0 ? s.skizzen.length - 1 : Math.max(0, blatt - 1); malen(); }),
    knopf('›', () => { if (blatt < 0) return; blatt += 1; if (blatt >= s.skizzen.length) blatt = -1; malen(); }),
    knopf('Aufhängen', () => {
      if (blatt < 0 || blatt >= s.skizzen.length) { ui.toast('Erst im Skizzenbuch ein Bild wählen.'); return; }
      striche = s.skizzen[blatt].striche.map((x) => [...x]);
      bau.striche = striche.map((x) => [...x]);
      bau.bild = blatt;
      rueck.geaendert();
      ui.toast('Das Bild hängt jetzt an der Staffelei.');
    }),
    knopf('Behalten', () => {
      if (!striche.length) { ui.toast('Das Blatt ist noch leer.'); return; }
      if (s.skizzen.length >= SKIZZEN_MAX) {
        // Das älteste Blatt fällt heraus: Staffeleien, die es zeigten, bekommen es als eigenes Bild,
        // alle anderen rücken eine Nummer vor
        const alt = s.skizzen.shift();
        for (const b of s.bauten) {
          if (b.typ !== 'staffelei' || !(b.bild >= 0)) continue;
          if (b.bild === 0) { b.striche = alt.striche.map((x) => [...x]); b.bild = -1; } else b.bild--;
        }
      }
      s.skizzen.push({ striche: striche.map((x) => [...x]), zeit: Math.round(s.zeit) });
      bau.bild = s.skizzen.length - 1;
      bau.striche = striche.map((x) => [...x]);
      rueck.geaendert();
      ui.toast('Ins Skizzenbuch gelegt.', 'gut');
      malen();
    }, 'primaer'));
  malen();
  const fertig = knopf('Fertig', () => ui.modalSchliessen());
  ui.modal({
    klasse: 'skizzentafel', ober: 'Staffelei', titel: 'Skizzenbuch',
    inhalt: h('div', { class: 'skizzeninhalt' },
      h('div', { class: 'skizzenflaeche' }, leinwand),
      h('div', { class: 'skizzenwerkzeug' }, hinweis, farben, leiste, buchLeiste, fertig)),
  });
}
