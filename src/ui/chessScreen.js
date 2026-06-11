import {
  generatePuzzle,
  legalMoves,
  allLegalMoves,
  applyMove,
  isCheckmate,
  inCheck,
  solveMate,
  applyBlackBestDefense,
} from '../systems/chessPuzzle.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

const GLYPHS = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};
const TEXT_STYLE = String.fromCharCode(0xfe0e); // erzwingt Text- statt Emoji-Darstellung (v. a. ♟)
const FILES = 'abcdefgh';

let autoSeed = 1;

const CSS = `
.chs { display: flex; flex-direction: column; gap: 8px; align-items: center;
  max-height: 88vh; }
.chs-top { display: flex; gap: 12px; align-items: baseline; font-size: 14px;
  color: #e8d5ab; flex-wrap: wrap; justify-content: center; }
.chs-title { font-weight: 700; color: #c8a04a; }
.chs-status { font-size: 12px; opacity: .9; min-height: 16px; }
.chs-main { display: flex; gap: 14px; align-items: center; justify-content: center;
  flex-wrap: wrap; }
.chs-board { --chs-cell: clamp(30px, min(9.2vh, 10.5vw), 52px);
  display: grid; grid-template-columns: repeat(8, var(--chs-cell));
  grid-auto-rows: var(--chs-cell);
  border: 2px solid #5a4a2a; border-radius: 6px; overflow: hidden;
  touch-action: manipulation; }
.chs-cell { position: relative; display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--chs-cell) * .68); line-height: 1; cursor: pointer;
  border: 0; padding: 0; font-family: inherit;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.chs-cell.chs-light { background: #cdb380; }
.chs-cell.chs-dark { background: #7a5a34; }
.chs-cell.chs-w { color: #fbf3df; text-shadow: 0 1px 2px #00000088; }
.chs-cell.chs-b { color: #221306; text-shadow: 0 1px 1px #e8d5ab44; }
.chs-cell.chs-sel { box-shadow: inset 0 0 0 3px #c8a04a; }
.chs-cell.chs-last { box-shadow: inset 0 0 0 3px #8a5ac8aa; }
.chs-cell.chs-tip { box-shadow: inset 0 0 0 3px #4ac86a; }
.chs-cell.chs-move::after { content: ''; position: absolute; width: 26%; height: 26%;
  border-radius: 50%; background: #c8a04acc; pointer-events: none; }
.chs-cell.chs-take::after { content: ''; position: absolute; inset: 6%;
  border-radius: 50%; border: 3px solid #c8a04acc; background: none; pointer-events: none; }
.chs-coord { position: absolute; font-size: calc(var(--chs-cell) * .26);
  font-weight: 700; opacity: .75; pointer-events: none; text-shadow: none; }
.chs-coord.chs-rank { top: 2px; left: 3px; }
.chs-coord.chs-file { bottom: 1px; right: 3px; }
.chs-light .chs-coord { color: #6a4a24; }
.chs-dark .chs-coord { color: #e3cf9e; }
.chs-side { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.chs-side button { min-height: 44px; min-width: 96px; }
.chs-over { display: flex; flex-direction: column; gap: 10px; align-items: center;
  padding: 14px 18px; border: 1px solid #8a6a3a; border-radius: 8px;
  background: #2c2516; color: #e8d5ab; }
.chs-over h3 { margin: 0; color: #c8a04a; }
.chs-over.chs-lost h3 { color: #ff6a55; }
.chs-over button { min-height: 44px; min-width: 120px; }
@media (max-height: 460px) {
  .chs { flex-direction: row; gap: 14px; }
  .chs-top { flex-direction: column; gap: 4px; align-items: flex-start; max-width: 130px; }
}
`;

function injectStyle() {
  if (document.querySelector('style[data-chs]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-chs', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Echtes Mattproblem: Weiß zieht, Schwarz antwortet mit der zähesten
// Verteidigung. Matt in N weißen Zügen oder die Aufgabe ist verpatzt.
export function mountChessScreen(root, { onSolve, onClose, movesToWin = 1, seed } = {}) {
  injectStyle();
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini chs';
  root.appendChild(wrap);

  let currentSeed = (seed ?? ((performance.now() | 0) + autoSeed++)) >>> 0;
  let board = null;
  let moveNum = 0; // verbrauchte weiße Züge
  let selected = null; // { x, y }
  let targets = []; // legale Ziele der Auswahl
  let lastMove = null; // schwarzer Antwortzug { from, to }
  let tipMove = null;
  let tippUsed = false;
  let busy = false; // Schwarz "denkt"
  let finished = false;
  let rewarded = false;
  let blackTimer = null;
  let defenseRng = null;

  wrap.innerHTML = `
    <div class="chs-top">
      <span class="chs-title">Matt in ${movesToWin}</span>
      <span class="chs-moves"></span>
      <span class="chs-status"></span>
    </div>
    <div class="chs-main">
      <div class="chs-board" role="grid" aria-label="Schachbrett"></div>
      <div class="chs-side">
        <button type="button" class="chs-tipbtn">Tipp</button>
        <button type="button" class="chs-back">Zurück</button>
      </div>
    </div>`;

  const boardEl = wrap.querySelector('.chs-board');
  const movesEl = wrap.querySelector('.chs-moves');
  const statusEl = wrap.querySelector('.chs-status');

  const cellEls = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chs-cell ${(x + y) % 2 === 0 ? 'chs-light' : 'chs-dark'}`;
      btn.addEventListener('click', () => onTap(x, y));
      boardEl.appendChild(btn);
      cellEls.push(btn);
    }
  }

  wrap.querySelector('.chs-back').addEventListener('click', () => {
    if (typeof onClose === 'function') onClose();
  });
  wrap.querySelector('.chs-tipbtn').addEventListener('click', () => {
    if (finished || busy || !board) return;
    const hint = solveMate(board, movesToWin - moveNum);
    if (!hint) return fail();
    tippUsed = true;
    tipMove = hint;
    statusEl.textContent = 'Tipp benutzt — halbe Belohnung';
    playSfx('click');
    render();
  });

  function newGame(s) {
    currentSeed = s >>> 0;
    const puzzle = generatePuzzle(makeRng(currentSeed), { movesToWin });
    board = puzzle.board;
    defenseRng = makeRng((currentSeed ^ 0x9e3779b9) >>> 0);
    moveNum = 0;
    selected = null;
    targets = [];
    lastMove = null;
    tipMove = null;
    tippUsed = false;
    busy = false;
    finished = false;
    rewarded = false;
    const over = wrap.querySelector('.chs-over');
    if (over) over.remove();
    wrap.querySelector('.chs-main').style.display = '';
    statusEl.textContent = 'Du bist am Zug (Weiß)';
    render();
  }

  function onTap(x, y) {
    if (finished || busy || !board) return;
    const hit = targets.find((t) => t.x === x && t.y === y);
    if (selected && hit) return doWhiteMove(selected, { x, y });
    const p = board[y][x];
    if (p && p.white) {
      if (selected && selected.x === x && selected.y === y) {
        selected = null;
        targets = [];
      } else {
        selected = { x, y };
        targets = legalMoves(board, x, y);
      }
      playSfx('click');
      render();
      return;
    }
    selected = null;
    targets = [];
    render();
  }

  function doWhiteMove(from, to) {
    playSfx(board[to.y][to.x] ? 'hit' : 'click');
    board = applyMove(board, from, to);
    moveNum++;
    selected = null;
    targets = [];
    tipMove = null;
    lastMove = { from, to };

    if (isCheckmate(board, false)) return win();
    if (allLegalMoves(board, false).length === 0) return fail('Patt — kein Matt mehr');
    if (moveNum >= movesToWin) return fail();

    busy = true;
    statusEl.textContent = 'Schwarz zieht …';
    render();
    blackTimer = setTimeout(() => {
      blackTimer = null;
      if (!wrap.isConnected || finished) return;
      const reply = applyBlackBestDefense(board, defenseRng);
      if (!reply) return fail('Patt — kein Matt mehr');
      board = applyMove(board, reply.from, reply.to);
      lastMove = reply;
      busy = false;
      playSfx('click');
      if (!solveMate(board, movesToWin - moveNum)) return fail();
      statusEl.textContent = inCheck(board, true)
        ? 'Schach! Du musst reagieren.'
        : 'Du bist am Zug (Weiß)';
      render();
    }, 400);
  }

  function showOverlay(html, lost) {
    finished = true;
    busy = false;
    wrap.querySelector('.chs-main').style.display = 'none';
    const over = document.createElement('div');
    over.className = `chs-over${lost ? ' chs-lost' : ''}`;
    over.innerHTML = html;
    wrap.appendChild(over);
    return over;
  }

  function win() {
    playSfx('puzzleSolve');
    render();
    const q = (movesToWin === 2 ? 1 : 0.6) * (tippUsed ? 0.5 : 1);
    const over = showOverlay(`
      <h3>Schachmatt! ✨</h3>
      <div>Matt in ${movesToWin} — Qualität ${Math.round(q * 100)}%</div>
      <button type="button" class="chs-reward">Belohnung</button>`, false);
    over.querySelector('.chs-reward').addEventListener('click', () => {
      if (rewarded) return;
      rewarded = true;
      if (typeof onSolve === 'function') onSolve(q);
    });
  }

  function fail(msg = 'Kein Matt mehr') {
    playSfx('block');
    render();
    const over = showOverlay(`
      <h3>${msg}</h3>
      <div>Die Mattführung ist dahin.</div>
      <div style="display:flex;gap:8px;">
        <button type="button" class="chs-retry">Nochmal</button>
        <button type="button" class="chs-quit">Zurück</button>
      </div>`, true);
    over.querySelector('.chs-retry').addEventListener('click', () => newGame(currentSeed + 1));
    over.querySelector('.chs-quit').addEventListener('click', () => {
      if (typeof onClose === 'function') onClose();
    });
  }

  function render() {
    movesEl.textContent = `Zug ${Math.min(moveNum + 1, movesToWin)}/${movesToWin}`;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const el = cellEls[y * 8 + x];
        const p = board ? board[y][x] : null;
        let html = '';
        if (x === 0) html += `<span class="chs-coord chs-rank">${8 - y}</span>`;
        if (y === 7) html += `<span class="chs-coord chs-file">${FILES[x]}</span>`;
        if (p) html += GLYPHS[p.white ? 'w' : 'b'][p.type] + TEXT_STYLE;
        el.innerHTML = html;
        el.classList.toggle('chs-w', !!p && p.white);
        el.classList.toggle('chs-b', !!p && !p.white);
        el.classList.toggle('chs-sel', !!selected && selected.x === x && selected.y === y);
        const isTarget = targets.some((t) => t.x === x && t.y === y);
        el.classList.toggle('chs-move', isTarget && !p);
        el.classList.toggle('chs-take', isTarget && !!p);
        el.classList.toggle(
          'chs-last',
          !!lastMove &&
            ((lastMove.from.x === x && lastMove.from.y === y) ||
              (lastMove.to.x === x && lastMove.to.y === y)),
        );
        el.classList.toggle(
          'chs-tip',
          !!tipMove &&
            ((tipMove.from.x === x && tipMove.from.y === y) ||
              (tipMove.to.x === x && tipMove.to.y === y)),
        );
      }
    }
  }

  newGame(currentSeed);

  return function unmount() {
    if (blackTimer) clearTimeout(blackTimer);
    root.innerHTML = '';
  };
}
