import { generateSudoku, validate } from '../systems/sudoku.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

let autoSeed = 1;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CSS = `
.sud { display: flex; flex-direction: column; gap: 8px; align-items: center;
  max-height: 88vh; }
.sud-top { display: flex; gap: 12px; align-items: baseline; font-size: 14px;
  color: #e8d5ab; flex-wrap: wrap; justify-content: center; }
.sud-title { font-weight: 700; color: #c8a04a; }
.sud-time { font-weight: 700; color: #c8a04a; min-width: 44px; font-variant-numeric: tabular-nums; }
.sud-status { font-size: 12px; opacity: .85; min-height: 16px; }
.sud-main { display: flex; gap: 14px; align-items: center; justify-content: center;
  flex-wrap: wrap; }
.sud-board { --sud-cell: clamp(24px, min(8.2vh, 9.6vw), 44px);
  display: grid; grid-template-columns: repeat(9, var(--sud-cell));
  grid-auto-rows: var(--sud-cell);
  border: 2px solid #8a6a3a; border-radius: 6px; overflow: hidden;
  background: #221c12; touch-action: manipulation; }
.sud-cell { display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--sud-cell) * .55); color: #e8d5ab; cursor: pointer;
  border: 0; border-right: 1px solid #3a3120; border-bottom: 1px solid #3a3120;
  background: transparent; padding: 0; font-family: inherit;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.sud-cell:nth-child(9n) { border-right: 0; }
.sud-cell.sud-bxr { border-right: 2px solid #8a6a3a; }
.sud-cell.sud-bxb { border-bottom: 2px solid #8a6a3a; }
.sud-cell.sud-fixed { font-weight: 700; color: #c8a04a; background: #2c2516; cursor: default; }
.sud-cell.sud-same { background: #3a3018; }
.sud-cell.sud-sel { box-shadow: inset 0 0 0 2px #c8a04a; background: #33290f; }
.sud-cell.sud-conflict { color: #ff6a55; background: #3a1d16; }
.sud-side { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.sud-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.sud-pad button { min-width: 48px; min-height: 44px; font-size: 18px; }
.sud-actions { display: flex; gap: 8px; }
.sud-actions button { min-height: 40px; min-width: 84px; }
.sud-done { display: flex; flex-direction: column; gap: 10px; align-items: center;
  padding: 14px 18px; border: 1px solid #8a6a3a; border-radius: 8px;
  background: #2c2516; color: #e8d5ab; }
.sud-done h3 { margin: 0; color: #c8a04a; }
.sud-done button { min-height: 44px; min-width: 120px; }
@media (max-height: 460px) {
  .sud { flex-direction: row; align-items: center; gap: 14px; }
  .sud-top { flex-direction: column; gap: 4px; align-items: flex-start; }
}
`;

function injectStyle() {
  if (document.querySelector('style[data-sud]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-sud', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Klassisches 9x9-Sudoku auf Zeit: je schneller gelöst, desto besser die Beute.
export function mountSudokuScreen(root, { onSolve, onClose, seed } = {}) {
  injectStyle();
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini sud';
  root.appendChild(wrap);

  const rngSeed = (seed ?? ((performance.now() | 0) + autoSeed++)) >>> 0;
  const { puzzle } = generateSudoku(makeRng(rngSeed), { holes: 45 });
  const grid = puzzle.map((row) => row.slice());
  const fixed = puzzle.map((row) => row.map((v) => v !== null));

  let selected = null; // { r, c }
  let solved = false;
  let rewarded = false;
  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const timerId = setInterval(() => {
    if (!wrap.isConnected) return clearInterval(timerId);
    if (solved) return;
    const el = wrap.querySelector('.sud-time');
    if (el) el.textContent = fmt(elapsed());
  }, 500);

  // Alle Zellen, deren Wert in Zeile, Spalte oder 3x3-Box doppelt vorkommt.
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
    for (let i = 0; i < 9; i++) {
      mark(Array.from({ length: 9 }, (_, j) => [i, j]));
      mark(Array.from({ length: 9 }, (_, j) => [j, i]));
      const r0 = Math.floor(i / 3) * 3;
      const c0 = (i % 3) * 3;
      mark(Array.from({ length: 9 }, (_, j) => [r0 + Math.floor(j / 3), c0 + (j % 3)]));
    }
    return bad;
  }

  wrap.innerHTML = `
    <div class="sud-top">
      <span class="sud-title">Sudoku 9×9</span>
      <span>⏱ <span class="sud-time">0:00</span></span>
      <span class="sud-status"></span>
    </div>
    <div class="sud-main">
      <div class="sud-board" role="grid" aria-label="Sudoku-Gitter"></div>
      <div class="sud-side">
        <div class="sud-pad"></div>
        <div class="sud-actions"><button type="button" class="sud-back">Zurück</button></div>
      </div>
    </div>`;

  const boardEl = wrap.querySelector('.sud-board');
  const padEl = wrap.querySelector('.sud-pad');
  const statusEl = wrap.querySelector('.sud-status');

  const cellEls = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sud-cell';
      if (c % 3 === 2 && c !== 8) btn.classList.add('sud-bxr');
      if (r % 3 === 2 && r !== 8) btn.classList.add('sud-bxb');
      if (fixed[r][c]) btn.classList.add('sud-fixed');
      btn.addEventListener('click', () => {
        if (solved) return;
        selected = selected && selected.r === r && selected.c === c ? null : { r, c };
        playSfx('click');
        render();
      });
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
  }

  for (let v = 1; v <= 9; v++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(v);
    btn.addEventListener('click', () => setValue(v));
    padEl.appendChild(btn);
  }
  const eraseBtn = document.createElement('button');
  eraseBtn.type = 'button';
  eraseBtn.textContent = '⌫';
  eraseBtn.setAttribute('aria-label', 'Löschen');
  eraseBtn.addEventListener('click', () => setValue(null));
  padEl.appendChild(eraseBtn);

  wrap.querySelector('.sud-back').addEventListener('click', () => {
    if (typeof onClose === 'function') onClose();
  });

  function setValue(v) {
    if (solved || !selected) return;
    const { r, c } = selected;
    if (fixed[r][c]) return;
    grid[r][c] = v;
    playSfx('click');
    render();
    checkDone();
  }

  function render() {
    const bad = conflictSet();
    const selVal = selected ? grid[selected.r][selected.c] : null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const el = cellEls[r * 9 + c];
        const v = grid[r][c];
        el.textContent = v ? String(v) : '';
        el.classList.toggle('sud-sel', !!selected && selected.r === r && selected.c === c);
        el.classList.toggle('sud-conflict', bad.has(`${r},${c}`));
        el.classList.toggle('sud-same', !!selVal && v === selVal && !(selected.r === r && selected.c === c));
      }
    }
  }

  function checkDone() {
    if (grid.some((row) => row.some((v) => v === null))) return;
    if (!validate(grid)) {
      statusEl.textContent = 'Da stimmt noch etwas nicht …';
      return;
    }
    solved = true;
    selected = null;
    const secs = elapsed();
    const q = clamp(1.15 - secs / 300, 0.25, 1);
    playSfx('puzzleSolve');
    statusEl.textContent = '';
    render();

    const done = document.createElement('div');
    done.className = 'sud-done';
    done.innerHTML = `
      <h3>Gelöst! ✨</h3>
      <div>Zeit: ${fmt(secs)} — Qualität ${Math.round(q * 100)}%</div>
      <button type="button" class="sud-reward">Belohnung</button>`;
    wrap.querySelector('.sud-main').replaceWith(done);
    done.querySelector('.sud-reward').addEventListener('click', () => {
      if (rewarded) return;
      rewarded = true;
      if (typeof onSolve === 'function') onSolve(q);
    });
  }

  render();

  return function unmount() {
    clearInterval(timerId);
    root.innerHTML = '';
  };
}
