import { generateSudoku, validate, boxDims } from '../systems/sudoku.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

let autoSeed = 1;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CSS = `
.sud-top { display: flex; gap: 12px; align-items: baseline; font-size: 14px; color: #e8d5ab; }
.sud-time { font-weight: 700; color: #c8a04a; min-width: 44px; }
.sud-sub { font-size: 12px; opacity: .85; }
.sud-board { display: grid; border: 2px solid #5a4a2a; border-radius: 6px; overflow: hidden;
  background: #221c12; touch-action: manipulation; }
.sud-cell { display: flex; align-items: center; justify-content: center; position: relative;
  min-width: 40px; min-height: 40px; font-size: 22px; color: #e8d5ab; cursor: pointer;
  border-right: 1px solid #3a3120; border-bottom: 1px solid #3a3120;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.sud-cell.sud-bxr { border-right: 2px solid #8a6a3a; }
.sud-cell.sud-bxb { border-bottom: 2px solid #8a6a3a; }
.sud-cell.sud-fixed { font-weight: 700; color: #c8a04a; background: #2c2516; cursor: default; }
.sud-cell.sud-sel { box-shadow: inset 0 0 0 2px #c8a04a; background: #33290f; }
.sud-cell.sud-conflict { color: #ff6a55; background: #3a1d16; }
.sud-pad { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.sud-pad button { min-width: 48px; min-height: 44px; font-size: 18px; }
.sud-actions button { min-height: 40px; min-width: 72px; }
`;

function injectStyle() {
  if (document.querySelector('style[data-sud]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-sud', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Blitz-Sudoku: je schneller gelöst, desto besser die Belohnung.
export function mountSudokuScreen(root, { onSolve, onClose, size = 4, seed } = {}) {
  injectStyle();
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini sud';
  root.appendChild(wrap);

  const rngSeed = (seed ?? ((performance.now() | 0) + autoSeed++)) >>> 0;
  const holes = size === 4 ? 8 : 14;
  const { puzzle } = generateSudoku(makeRng(rngSeed), { size, holes });
  const grid = puzzle.map((row) => row.slice());
  const fixed = puzzle.map((row) => row.map((v) => v !== null));
  const { w: boxW, h: boxH } = boxDims(size);
  const cellPx = size === 4 ? 56 : 48;

  let selected = null; // { r, c }
  let solvedQuality = null; // null solange ungelöst
  let rewarded = false;
  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const timerId = setInterval(() => {
    if (!wrap.isConnected) return clearInterval(timerId); // extern entfernt -> aufräumen
    if (solvedQuality !== null) return;
    const el = wrap.querySelector('#sud-time');
    if (el) el.textContent = fmt(elapsed());
  }, 500);

  // Alle Zellen, die in ihrer Zeile, Spalte oder Box einen Duplikatwert tragen.
  function conflictSet() {
    const bad = new Set();
    const mark = (cells) => {
      const byVal = new Map();
      for (const [r, c] of cells) {
        const v = grid[r][c];
        if (!v) continue;
        if (!byVal.has(v)) byVal.set(v, []);
        byVal.get(v).push(`${r},${c}`);
      }
      for (const list of byVal.values()) if (list.length > 1) list.forEach((k) => bad.add(k));
    };
    for (let i = 0; i < size; i++) {
      mark(Array.from({ length: size }, (_, j) => [i, j])); // Zeile
      mark(Array.from({ length: size }, (_, j) => [j, i])); // Spalte
    }
    for (let r0 = 0; r0 < size; r0 += boxH) {
      for (let c0 = 0; c0 < size; c0 += boxW) {
        const cells = [];
        for (let r = r0; r < r0 + boxH; r++) for (let c = c0; c < c0 + boxW; c++) cells.push([r, c]);
        mark(cells);
      }
    }
    return bad;
  }

  function setCell(v) {
    if (!selected || solvedQuality !== null) return;
    grid[selected.r][selected.c] = v;
    const full = grid.every((row) => row.every((x) => x !== null));
    if (full && validate(grid, size)) {
      solvedQuality = clamp(1.2 - elapsed() / 90, 0.3, 1);
      selected = null;
      clearInterval(timerId);
      playSfx('puzzleSolve');
      render();
      if (!rewarded) { rewarded = true; onSolve && onSolve(solvedQuality); }
      return;
    }
    render();
  }

  function render() {
    const bad = conflictSet();
    const done = solvedQuality !== null;
    let cells = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = grid[r][c];
        const cls = ['sud-cell'];
        if (fixed[r][c]) cls.push('sud-fixed');
        if (selected && selected.r === r && selected.c === c) cls.push('sud-sel');
        if (bad.has(`${r},${c}`)) cls.push('sud-conflict');
        if ((c + 1) % boxW === 0 && c !== size - 1) cls.push('sud-bxr');
        if ((r + 1) % boxH === 0 && r !== size - 1) cls.push('sud-bxb');
        cells += `<div class="${cls.join(' ')}" data-r="${r}" data-c="${c}">${v ?? ''}</div>`;
      }
    }
    const pad = Array.from({ length: size }, (_, i) => `<button data-v="${i + 1}">${i + 1}</button>`).join('')
      + '<button data-v="0" class="ghost">⌫</button>';
    wrap.innerHTML = `
      <h2>Blitz-Sudoku</h2>
      <div class="sud-top">⏱ <span id="sud-time" class="sud-time">${fmt(elapsed())}</span>
        <span class="sud-sub">Jede Zeile, Spalte &amp; Box: 1–${size}</span></div>
      <div class="sud-board" style="grid-template-columns:repeat(${size},${cellPx}px);grid-auto-rows:${cellPx}px">${cells}</div>
      ${done ? '' : `<div class="sud-pad">${pad}</div>`}
      <div class="mini-result">${done ? '<b style="color:#7bd88f">Gelöst! ✨</b>' : ''}</div>
      <div class="btn-row sud-actions"><button id="sud-back" class="ghost">Zurück</button></div>
    `;
    if (!done) {
      wrap.querySelectorAll('.sud-cell:not(.sud-fixed)').forEach((el) => {
        el.onclick = () => {
          const r = +el.dataset.r, c = +el.dataset.c;
          selected = selected && selected.r === r && selected.c === c ? null : { r, c };
          render();
        };
      });
      wrap.querySelectorAll('[data-v]').forEach((b) => {
        b.onclick = () => setCell(+b.dataset.v || null); // 0 = ⌫ löschen
      });
    }
    wrap.querySelector('#sud-back').onclick = () => { clearInterval(timerId); onClose && onClose(); };
  }

  render();
}
