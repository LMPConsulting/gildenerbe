import { drawSprite } from './sprites.js';
import { RARITY, RARITY_ORDER } from '../data/affixes.js';
import { CODEX } from '../data/codex.js';

// First-launch tutorial (7 swipeable cards) + Kodex accordion screen.
// All DOM access lives inside the mount functions — the module is node-safe.

const CW = 280; // illustration canvas size (logical px)
const CH = 132;

// Palette aligned with sprites.js.
const P = {
  bg: '#171019', floor: '#241b29', floor2: '#2b2135', ink: '#1a140f',
  red: '#c23a2c', redD: '#6e1d16', gold: '#d9a441', goldD: '#8a6120',
  steel: '#8a93a0', steelL: '#c6cfd8', white: '#f2f4ef', bone: '#ece3c4',
  leather: '#7a5230', shadow: '#43301d', stone: '#4f5160', paper: '#d8c9a3',
  copper: '#b06a3a', panel: '#2a2330',
};

// --- tiny canvas helpers -----------------------------------------------------

function fr(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function arrowR(ctx, x, y, len, c) {
  fr(ctx, x, y - 1, len, 3, c);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x + len, y - 5); ctx.lineTo(x + len + 7, y); ctx.lineTo(x + len, y + 5);
  ctx.closePath(); ctx.fill();
}

function arrowL(ctx, x, y, len, c) {
  fr(ctx, x - len, y - 1, len, 3, c);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x - len, y - 5); ctx.lineTo(x - len - 7, y); ctx.lineTo(x - len, y + 5);
  ctx.closePath(); ctx.fill();
}

function star(ctx, cx, cy, c) {
  fr(ctx, cx - 2, cy - 12, 5, 25, c);
  fr(ctx, cx - 12, cy - 2, 25, 5, c);
  fr(ctx, cx - 7, cy - 7, 3, 3, c); fr(ctx, cx + 5, cy - 7, 3, 3, c);
  fr(ctx, cx - 7, cy + 5, 3, 3, c); fr(ctx, cx + 5, cy + 5, 3, 3, c);
  fr(ctx, cx - 1, cy - 1, 3, 3, P.white);
}

function sword(ctx, cx, top) {
  fr(ctx, cx - 2, top, 5, 26, P.steelL);       // blade
  fr(ctx, cx - 2, top, 2, 26, P.white);        // edge shine
  fr(ctx, cx - 8, top + 26, 17, 4, P.gold);    // crossguard
  fr(ctx, cx - 2, top + 30, 5, 8, P.leather);  // grip
  fr(ctx, cx - 3, top + 38, 7, 4, P.goldD);    // pommel
}

function heart(ctx, x, y, s) {
  const m = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];
  m.forEach((row, ry) => row.forEach((v, rx) => { if (v) fr(ctx, x + rx * s, y + ry * s, s, s, P.red); }));
  fr(ctx, x + s, y + s, s, s, P.white); // glint
}

function shieldGlyph(ctx, cx, top) {
  fr(ctx, cx - 11, top, 22, 16, P.steel);
  fr(ctx, cx - 11, top, 22, 3, P.steelL);
  fr(ctx, cx - 8, top + 16, 16, 6, P.steel);
  fr(ctx, cx - 4, top + 22, 8, 5, P.stone);
  fr(ctx, cx - 2, top + 7, 4, 4, P.gold);      // boss
}

function house(ctx, x, groundY, w, h, roofC) {
  fr(ctx, x, groundY - h, w, h, P.leather);
  fr(ctx, x + ((w / 2) | 0) - 3, groundY - 10, 6, 10, P.ink); // door
  ctx.fillStyle = roofC;
  ctx.beginPath();
  ctx.moveTo(x - 4, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - 14);
  ctx.lineTo(x + w + 4, groundY - h);
  ctx.closePath(); ctx.fill();
}

// --- card illustrations ------------------------------------------------------

// 1. The loop: Held -> Dungeon -> Erbe -> Basis -> (zurück zum Helden).
function drawLoop(ctx) {
  const gy = 100;
  fr(ctx, 0, gy, CW, 2, P.shadow);
  drawSprite(ctx, 'hero', 10, gy - 64, 4);          // der Held
  arrowR(ctx, 80, 72, 13, P.goldD);
  fr(ctx, 106, 48, 40, 52, P.stone);                // Dungeon-Tor
  fr(ctx, 106, 48, 40, 3, P.steel);
  fr(ctx, 118, 66, 16, 34, P.ink);
  ctx.fillStyle = P.ink;
  ctx.beginPath(); ctx.arc(126, 66, 8, Math.PI, 0); ctx.fill();
  arrowR(ctx, 150, 72, 12, P.goldD);
  ctx.fillStyle = P.gold;                           // Erbe-Kugel
  ctx.beginPath(); ctx.arc(190, 72, 11, 0, Math.PI * 2); ctx.fill();
  fr(ctx, 185, 66, 3, 3, P.white);
  arrowR(ctx, 206, 72, 12, P.goldD);
  house(ctx, 232, gy, 34, 30, P.goldD);             // die Basis
  for (let x = 52; x < 238; x += 14) fr(ctx, x, 116, 7, 2, P.shadow); // Rückweg
  ctx.fillStyle = P.shadow;
  ctx.beginPath(); ctx.moveTo(48, 112); ctx.lineTo(38, 117); ctx.lineTo(48, 122); ctx.closePath(); ctx.fill();
}

// 2. Dungeon controls: floor, red 3x3 telegraph, hero dodging, joystick + buttons.
function drawControls(ctx) {
  for (let ty = 0; ty < 8; ty++)
    for (let tx = 0; tx < 24; tx++)
      fr(ctx, tx * 12, ty * 12, 12, 12, (tx + ty) % 2 ? P.floor : P.floor2);
  for (let ty = 0; ty < 3; ty++)                    // Boss-Telegraph (3x3 rot)
    for (let tx = 0; tx < 3; tx++) {
      const x = 168 + tx * 12, y = 24 + ty * 12;
      fr(ctx, x, y, 12, 12, P.redD);
      fr(ctx, x + 1, y + 1, 10, 10, P.red);
      fr(ctx, x + 3, y + 3, 6, 6, P.redD);
    }
  drawSprite(ctx, 'hero', 112, 30, 3);              // Held weicht aus
  arrowL(ctx, 106, 54, 16, P.white);
  ctx.strokeStyle = P.steel; ctx.lineWidth = 2;     // Joystick
  ctx.fillStyle = P.panel;
  ctx.beginPath(); ctx.arc(38, 110, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.steelL;
  ctx.beginPath(); ctx.arc(32, 113, 8, 0, Math.PI * 2); ctx.fill();
  [210, 242].forEach((bx, i) => {                   // Fähigkeiten-Buttons
    fr(ctx, bx, 98, 26, 26, P.goldD);
    fr(ctx, bx + 2, 100, 22, 22, P.shadow);
    if (i === 0) {
      fr(ctx, bx + 11, 103, 4, 11, P.steelL);
      fr(ctx, bx + 8, 114, 10, 3, P.gold);
    } else {
      ctx.strokeStyle = P.steelL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx + 13, 111, 7, 0.4, 5.4); ctx.stroke();
      fr(ctx, bx + 18, 103, 3, 3, P.steelL);
    }
  });
}

// 3. Stats: sword (STR), star (AGI/Krit), heart (STA/HP), shield (Rüstung).
function drawStats(ctx) {
  sword(ctx, 35, 28);
  star(ctx, 105, 48, P.gold);
  heart(ctx, 161, 36, 4);
  shieldGlyph(ctx, 245, 32);
  ctx.textAlign = 'center';
  ctx.font = 'bold 8px monospace';
  [
    { x: 35, label: 'Stärke', sub: '+2 AK' },
    { x: 105, label: 'Beweglichkeit', sub: '+Krit' },
    { x: 175, label: 'Ausdauer', sub: '+10 LP' },
    { x: 245, label: 'Rüstung', sub: '−Schaden %' },
  ].forEach((c) => {
    ctx.fillStyle = P.bone; ctx.fillText(c.label, c.x, 100);
    ctx.fillStyle = P.gold; ctx.fillText(c.sub, c.x, 114);
  });
}

// 4. Loot: the six rarity tiles, grau -> orange.
function drawLoot(ctx) {
  const ts = 28, gap = 10;
  let x = ((CW - (RARITY_ORDER.length * ts + (RARITY_ORDER.length - 1) * gap)) / 2) | 0;
  RARITY_ORDER.forEach((key) => {
    const col = RARITY[key].color;
    fr(ctx, x, 40, ts, ts, col);
    fr(ctx, x + 2, 42, ts - 4, ts - 4, '#1f1812');
    fr(ctx, x + 10, 50, 8, 8, col);
    x += ts + gap;
  });
  fr(ctx, x - gap - 6, 33, 3, 3, P.white);          // Funkeln am Legendären
  fr(ctx, x - gap - ts - 2, 68, 3, 3, P.white);
  arrowR(ctx, 96, 90, 80, P.goldD);
  ctx.textAlign = 'center'; ctx.font = 'bold 9px monospace';
  ctx.fillStyle = P.gold; ctx.fillText('immer seltener, immer stärker', 140, 114);
}

// 5. Crafting chain: Erz -> Barren -> Schwert, plus Perfekt-Wirken-Leiste.
function drawCraft(ctx) {
  fr(ctx, 28, 52, 26, 18, P.shadow);                // Erzbrocken
  fr(ctx, 32, 46, 18, 8, P.shadow);
  fr(ctx, 34, 54, 6, 5, P.copper);
  fr(ctx, 44, 60, 5, 5, P.copper);
  fr(ctx, 38, 48, 4, 3, P.copper);
  arrowR(ctx, 64, 60, 18, P.goldD);
  fr(ctx, 100, 56, 44, 14, P.gold);                 // Barren
  fr(ctx, 100, 56, 44, 4, P.bone);
  fr(ctx, 100, 66, 44, 4, P.goldD);
  arrowR(ctx, 154, 60, 18, P.goldD);
  sword(ctx, 208, 30);                              // fertiges Gear
  fr(ctx, 40, 100, 200, 12, P.ink);                 // Perfekt-Wirken-Leiste
  fr(ctx, 41, 101, 198, 10, P.panel);
  fr(ctx, 150, 101, 30, 10, P.goldD);
  fr(ctx, 156, 101, 18, 10, P.gold);                // Gold-Zone
  fr(ctx, 163, 96, 3, 20, P.white);                 // Marker
}

// 6. Base under attack: houses behind a wall, a raider wolf charging.
function drawBase(ctx) {
  const gy = 104;
  fr(ctx, 0, gy, CW, CH - gy, '#1d1714');
  house(ctx, 34, gy, 34, 28, P.shadow);
  house(ctx, 82, gy, 40, 36, P.goldD);
  fr(ctx, 138, 58, 18, 46, P.stone);                // Mauer
  fr(ctx, 138, 58, 18, 3, P.steelL);
  fr(ctx, 138, 52, 6, 6, P.stone);                  // Zinnen
  fr(ctx, 150, 52, 6, 6, P.stone);
  fr(ctx, 142, 70, 3, 3, P.ink);                    // Schießscharten
  fr(ctx, 148, 84, 3, 3, P.ink);
  drawSprite(ctx, 'wolf', 196, gy - 48, 3);         // Angreifer
  fr(ctx, 216, 30, 5, 13, P.red);                   // Alarm!
  fr(ctx, 216, 47, 5, 5, P.red);
}

// 7. The Chronik: an open tome with a permanent star above it.
function drawChronik(ctx) {
  fr(ctx, 70, 104, 140, 8, P.leather);              // Buchdeckel
  fr(ctx, 74, 64, 64, 40, P.paper);                 // Seiten
  fr(ctx, 142, 64, 64, 40, P.paper);
  fr(ctx, 138, 60, 4, 48, P.shadow);                // Buchrücken
  [72, 80, 88].forEach((y) => {                     // Schriftzeilen
    fr(ctx, 82, y, 46, 2, '#a4906a');
    fr(ctx, 152, y, 46, 2, '#a4906a');
  });
  star(ctx, 140, 32, P.gold);
  fr(ctx, 116, 20, 3, 3, P.gold);
  fr(ctx, 164, 42, 3, 3, P.gold);
  fr(ctx, 122, 44, 2, 2, P.bone);
}

// --- the 7 tutorial cards ----------------------------------------------------

const CARDS = [
  {
    title: 'Willkommen, Gildenmeister!',
    lines: [
      'Du führst eine Gilde — jeder Held ist ein Lauf.',
      'Held → Dungeon → Erbe → Basis → stärkerer Held.',
      'Tod ist Ernte, kein Verlust: Alle Taten werden zu Erbe.',
    ],
    draw: drawLoop,
  },
  {
    title: 'Steuerung im Dungeon',
    lines: [
      'Joystick links: bewegen. Buttons rechts: Fähigkeiten.',
      'Auto-Angriff trifft Gegner in Reichweite von selbst.',
      'Rote Bodenflächen = Boss-Schlag: rauslaufen oder Schildblock!',
      'Fliehen geht jederzeit über den Ausgang.',
    ],
    draw: drawControls,
  },
  {
    title: 'Deine Werte',
    lines: [
      'Stärke: +2 Angriffskraft je Punkt. Ausdauer: +10 LP.',
      'Beweglichkeit erhöht die Kritchance — Krits machen doppelten Schaden.',
      'Rüstung mindert Schaden prozentual.',
      'Wut wächst durch Treffer und bezahlt deine Fähigkeiten.',
    ],
    draw: drawStats,
  },
  {
    title: 'Beute & Ausrüstung',
    lines: [
      'Seltenheit: Grau → Weiß → Grün → Blau → Lila → Orange.',
      'Affixe geben Bonuswerte — Vergleichen lohnt sich.',
      'Anlegen im Helden-Schirm, Verzaubern per Runen-Puzzle.',
    ],
    draw: drawLoot,
  },
  {
    title: 'Werkstatt & Berufe',
    lines: [
      'Erz schmelzen, Barren schmieden, Ausrüstung craften.',
      'Perfektes Wirken: in der Gold-Zone tippen = bessere Qualität.',
      'Angeln bringt seltene Fänge, Verzaubern stärkt dein Gear.',
    ],
    draw: drawCraft,
  },
  {
    title: 'Basis, Überfälle & Missionen',
    lines: [
      'Erbe baut Gebäude aus — jede Stufe ein permanenter Bonus.',
      'Alle paar Läufe greifen Feinde an: Mauer und Verteidigung zählen.',
      'Fällt die Basis, gibt es Chronik-Punkte — du baust stärker wieder auf.',
      'Späher kehren in Echtzeit mit Beute von Missionen zurück.',
    ],
    draw: drawBase,
  },
  {
    title: 'Die Chronik — und los!',
    lines: [
      'Die Chronik steht über allem: permanente Boni über Basis-Leben hinweg.',
      'Jedes Ende schreibt ein Kapitel, jeder Anfang wird leichter.',
      'Alles Wichtige findest du jederzeit im Kodex. Viel Erfolg!',
    ],
    draw: drawChronik,
  },
];

// --- shared styles -----------------------------------------------------------

const STYLES = `
.tut-screen{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%;padding:48px 16px 16px;box-sizing:border-box;color:#ece3c4;text-align:center}
.tut-skip{position:absolute;top:10px;right:12px;background:none;border:none;color:#9d9d9d;font:inherit;font-size:14px;padding:6px 10px;cursor:pointer}
.tut-card{width:100%;max-width:340px;background:#241b12;border:2px solid #8a6120;border-radius:10px;padding:18px 16px 14px;box-shadow:0 6px 18px rgba(0,0,0,.5);touch-action:pan-y}
.tut-card h2{margin:0 0 10px;font-size:19px;color:#d9a441}
.tut-canvas{display:block;margin:0 auto 12px;width:100%;max-width:280px;border-radius:6px;background:#171019;image-rendering:pixelated}
.tut-line{margin:5px 0;font-size:14px;line-height:1.45}
.tut-dots{display:flex;gap:7px;justify-content:center;margin:14px 0 12px}
.tut-dot{width:8px;height:8px;border-radius:50%;background:#43301d}
.tut-dot.on{background:#d9a441}
.tut-nav{display:flex;gap:10px}
.tut-btn{flex:1;padding:10px 0;font:inherit;font-size:15px;border-radius:8px;border:1px solid #8a6120;background:#43301d;color:#ece3c4;cursor:pointer}
.tut-btn:disabled{opacity:.35;cursor:default}
.tut-btn.tut-primary{background:#8a6120;color:#fff;font-weight:bold}
.tut-codex{display:flex;flex-direction:column;min-height:100%;padding:14px;box-sizing:border-box;color:#ece3c4}
.tut-codex h1{margin:4px 0 2px;font-size:20px;color:#d9a441;text-align:center}
.tut-codex-sub{margin:0 0 12px;font-size:12px;color:#9d9d9d;text-align:center}
.tut-acc{border:1px solid #43301d;border-radius:8px;margin-bottom:8px;overflow:hidden;background:#241b12}
.tut-acc-head{display:flex;justify-content:space-between;align-items:center;width:100%;padding:11px 12px;background:none;border:none;color:#d9a441;font:inherit;font-size:15px;font-weight:bold;cursor:pointer;text-align:left}
.tut-acc-arrow{color:#8a6120;transition:transform .15s}
.tut-acc.open .tut-acc-arrow{transform:rotate(90deg)}
.tut-acc-body{display:none;padding:0 12px 10px}
.tut-acc.open .tut-acc-body{display:block}
.tut-entry{margin:8px 0}
.tut-term{font-weight:bold;font-size:14px;color:#ece3c4}
.tut-text{font-size:13px;line-height:1.45;color:#bfb39a}
.tut-close{margin-top:8px;flex:none}
`;

function injectStyles() {
  if (document.querySelector('style[data-tut]')) return;
  const st = document.createElement('style');
  st.setAttribute('data-tut', '');
  st.textContent = STYLES;
  document.head.appendChild(st);
}

// --- tutorial (first launch) -------------------------------------------------

export function mountTutorial(root, { onDone } = {}) {
  injectStyles();
  let idx = 0;
  root.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'tut-screen';
  const skip = document.createElement('button');
  skip.className = 'tut-skip';
  skip.textContent = 'Überspringen';
  skip.onclick = () => onDone && onDone();
  const card = document.createElement('div');
  card.className = 'tut-card';
  screen.append(skip, card);
  root.appendChild(screen);

  const next = () => { if (idx < CARDS.length - 1) { idx++; render(); } else { onDone && onDone(); } };
  const prev = () => { if (idx > 0) { idx--; render(); } };

  // Wischen navigiert ebenfalls.
  let swipeX = null;
  screen.addEventListener('touchstart', (e) => { swipeX = e.touches[0].clientX; }, { passive: true });
  screen.addEventListener('touchend', (e) => {
    if (swipeX == null) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    swipeX = null;
    if (dx < -40) next(); else if (dx > 40) prev();
  }, { passive: true });

  function render() {
    const c = CARDS[idx];
    const last = idx === CARDS.length - 1;
    card.innerHTML = `
      <h2>${c.title}</h2>
      <canvas class="tut-canvas" width="${CW}" height="${CH}"></canvas>
      ${c.lines.map((l) => `<div class="tut-line">${l}</div>`).join('')}
      <div class="tut-dots">${CARDS.map((_, i) => `<span class="tut-dot${i === idx ? ' on' : ''}"></span>`).join('')}</div>
      <div class="tut-nav">
        <button class="tut-btn" data-prev ${idx === 0 ? 'disabled' : ''}>Zurück</button>
        <button class="tut-btn tut-primary" data-next>${last ? "Los geht's!" : 'Weiter'}</button>
      </div>`;
    const ctx = card.querySelector('canvas').getContext('2d');
    fr(ctx, 0, 0, CW, CH, P.bg);
    c.draw(ctx);
    card.querySelector('[data-prev]').onclick = prev;
    card.querySelector('[data-next]').onclick = next;
  }
  render();
}

// --- Kodex (accordion over CODEX data) ----------------------------------------

export function mountCodexScreen(root, { onClose } = {}) {
  injectStyles();
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'tut-codex';
  wrap.innerHTML = `
    <h1>Kodex</h1>
    <div class="tut-codex-sub">Das gesammelte Wissen deiner Gilde</div>
    ${CODEX.map((sec) => `
      <div class="tut-acc" data-sec="${sec.id}">
        <button class="tut-acc-head">${sec.title}<span class="tut-acc-arrow">›</span></button>
        <div class="tut-acc-body">
          ${sec.entries.map((e) => `<div class="tut-entry"><div class="tut-term">${e.term}</div><div class="tut-text">${e.text}</div></div>`).join('')}
        </div>
      </div>`).join('')}
    <button class="tut-btn tut-primary tut-close">Schließen</button>
  `;
  root.appendChild(wrap);
  wrap.querySelectorAll('.tut-acc-head').forEach((h) => {
    h.onclick = () => h.parentElement.classList.toggle('open');
  });
  const first = wrap.querySelector('.tut-acc');
  if (first) first.classList.add('open');
  wrap.querySelector('.tut-close').onclick = () => onClose && onClose();
}
