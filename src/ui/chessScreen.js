import { generatePuzzle, legalMoves, applyMove, isWon, solve } from '../systems/chessPuzzle.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

const GLYPHS = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};
const TEXT_STYLE = String.fromCharCode(0xfe0e); // erzwingt Text- statt Emoji-Darstellung (v. a. ♟)

let autoSeed = 1;

const CSS = `
.chs-sub { font-size: 12px; opacity: .85; text-align: center; max-width: 300px; }
.chs-status { font-size: 14px; color: #e8d5ab; min-height: 18px; font-weight: 600; }
.chs-board { display: grid; grid-template-columns: repeat(5, 52px); grid-auto-rows: 52px;
  border: 2px solid #5a4a2a; border-radius: 6px; overflow: hidden; touch-action: manipulation; }
.chs-cell { display: flex; align-items: center; justify-content: center; position: relative;
  min-width: 40px; min-height: 40px; font-size: 32px; line-height: 1; cursor: pointer;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.chs-cell.chs-light { background: #e8d5ab; }
.chs-cell.chs-dark { background: #9a7544; }
.chs-cell.chs-w { color: #fdf8ee; text-shadow: 0 1px 2px rgba(0,0,0,.7); }
.chs-cell.chs-b { color: #17100a; text-shadow: 0 1px 1px rgba(255,255,255,.25); }
.chs-cell.chs-sel { box-shadow: inset 0 0 0 3px #c8a04a; }
.chs-cell.chs-dot::after { content: ''; position: absolute; width: 14px; height: 14px;
  border-radius: 50%; background: rgba(30,186,90,.6); pointer-events: none; }
.chs-cell.chs-cap { box-shadow: inset 0 0 0 3px rgba(224,83,61,.85); }
.chs-cell.chs-hint { box-shadow: inset 0 0 0 3px #ffb300; }
.chs-actions button { min-height: 40px; min-width: 72px; }
`;

function injectStyle() {
  if (document.querySelector('style[data-chs]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-chs', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

// Schach-Rätsel: Schlage den schwarzen König in exakt `movesToWin` Zügen.
export function mountChessScreen(root, { onSolve, onClose, movesToWin = 1, seed } = {}) {
  injectStyle();
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini chs';
  root.appendChild(wrap);

  let curSeed = (seed ?? ((performance.now() | 0) + autoSeed++)) >>> 0;
  let board, movesLeft, selected, targets, hint, hintUsed, state, message;

  function newGame() {
    board = generatePuzzle(makeRng(curSeed), { movesToWin }).board;
    movesLeft = movesToWin;
    selected = null; targets = []; hint = null; hintUsed = false;
    state = 'playing'; message = '';
    render();
  }

  const isTarget = (x, y) => targets.some((t) => t.x === x && t.y === y);

  function tapCell(x, y) {
    if (state !== 'playing') return;
    if (selected && isTarget(x, y)) {
      board = applyMove(board, selected, { x, y });
      movesLeft -= 1;
      selected = null; targets = []; hint = null; message = '';
      if (isWon(board)) { state = 'won'; playSfx('puzzleSolve'); }
      else if (movesLeft <= 0) state = 'lost';
      return render();
    }
    const piece = board[y][x];
    if (piece && piece.white && !(selected && selected.x === x && selected.y === y)) {
      selected = { x, y };
      targets = legalMoves(board, x, y);
    } else {
      selected = null; targets = [];
    }
    render();
  }

  function showHint() {
    if (state !== 'playing') return;
    const seq = solve(board, movesLeft);
    if (seq && seq.length) { hint = seq[0]; hintUsed = true; message = ''; }
    else { hint = null; message = 'Kein Sieg mehr möglich!'; }
    render();
  }

  function quality() {
    const base = movesToWin === 2 ? 1 : 0.6;
    return hintUsed ? base / 2 : base; // Tipp benutzt -> halbe Belohnung
  }

  function render() {
    let cells = '';
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board.length; x++) {
        const piece = board[y][x];
        const cls = ['chs-cell', (x + y) % 2 ? 'chs-dark' : 'chs-light'];
        if (piece) cls.push(piece.white ? 'chs-w' : 'chs-b');
        if (selected && selected.x === x && selected.y === y) cls.push('chs-sel');
        if (isTarget(x, y)) cls.push(piece ? 'chs-cap' : 'chs-dot');
        if (hint && ((hint.from.x === x && hint.from.y === y) || (hint.to.x === x && hint.to.y === y))) cls.push('chs-hint');
        const glyph = piece ? GLYPHS[piece.white ? 'w' : 'b'][piece.type] + TEXT_STYLE : '';
        cells += `<div class="${cls.join(' ')}" data-x="${x}" data-y="${y}">${glyph}</div>`;
      }
    }
    const result = state === 'won' ? '<b style="color:#7bd88f">Gelöst! ✨</b>'
      : state === 'lost' ? '<b style="color:#ff6a55">Fehlgeschlagen</b>'
        : message;
    wrap.innerHTML = `
      <h2>Schach-Rätsel</h2>
      <div class="chs-sub">Schlage den schwarzen König in ${movesToWin === 1 ? 'einem Zug' : `${movesToWin} Zügen`} — Schwarz zieht nicht!</div>
      <div class="chs-status">${state === 'playing' ? `Züge übrig: ${movesLeft}` : ''}</div>
      <div class="chs-board">${cells}</div>
      <div class="mini-result">${result}</div>
      <div class="btn-row chs-actions">
        ${state === 'playing' ? '<button id="chs-hint" class="ghost">Tipp</button>' : ''}
        ${state === 'won' ? '<button id="chs-reward">Belohnung</button>' : ''}
        ${state === 'lost' ? '<button id="chs-retry">Nochmal</button>' : ''}
        <button id="chs-back" class="ghost">Zurück</button>
      </div>
    `;
    wrap.querySelectorAll('.chs-cell').forEach((el) => { el.onclick = () => tapCell(+el.dataset.x, +el.dataset.y); });
    const hintBtn = wrap.querySelector('#chs-hint');
    if (hintBtn) hintBtn.onclick = showHint;
    const rewardBtn = wrap.querySelector('#chs-reward');
    if (rewardBtn) rewardBtn.onclick = () => onSolve && onSolve(quality());
    const retryBtn = wrap.querySelector('#chs-retry');
    if (retryBtn) retryBtn.onclick = () => { curSeed = (curSeed + 1) >>> 0; newGame(); };
    wrap.querySelector('#chs-back').onclick = () => onClose && onClose();
  }

  newGame();
}
