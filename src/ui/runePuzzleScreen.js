import { generatePuzzle, validate } from '../systems/runePuzzle.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

const PAIR_COLORS = ['#e0533d', '#3b82f6', '#1eba5a', '#a335ee', '#ffb300'];
let seed = 1;

// Runen-Verbindung (logic): connect same-colour rune pairs without crossing.
export function mountRunePuzzleScreen(root, { onSolve, onClose, size = 5, pairs = 3 } = {}) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini rune';
  root.appendChild(wrap);

  const puzzle = generatePuzzle(makeRng((performance.now() | 0) + seed++), { size, pairs });
  let paths = puzzle.endpoints.map(() => []);
  let active = null;

  const epAt = (x, y) => {
    for (const ep of puzzle.endpoints) {
      if (ep.a.x === x && ep.a.y === y) return ep.idx;
      if (ep.b.x === x && ep.b.y === y) return ep.idx;
    }
    return -1;
  };
  const usedBy = (x, y) => paths.findIndex((p) => p.some((c) => c.x === x && c.y === y));

  function tapCell(x, y) {
    const ep = epAt(x, y);
    if (ep >= 0 && paths[ep].length === 0) { active = ep; paths[ep] = [{ x, y }]; return render(); }
    if (active === null) { if (ep >= 0) { active = ep; paths[ep] = [{ x, y }]; return render(); } return; }
    const path = paths[active];
    const idxInPath = path.findIndex((c) => c.x === x && c.y === y);
    if (idxInPath >= 0) { paths[active] = path.slice(0, idxInPath + 1); return render(); }
    const head = path[path.length - 1];
    const adjacent = Math.abs(x - head.x) + Math.abs(y - head.y) === 1;
    if (adjacent && usedBy(x, y) === -1) {
      path.push({ x, y });
      if (epAt(x, y) === active) active = null; // reached the matching endpoint
      return render();
    }
  }

  const reset = () => { paths = puzzle.endpoints.map(() => []); active = null; render(); };

  function solved() {
    const complete = puzzle.endpoints.every((ep, i) => {
      const p = paths[i];
      if (p.length < 2) return false;
      const f = p[0], l = p[p.length - 1];
      return (f.x === ep.a.x && f.y === ep.a.y && l.x === ep.b.x && l.y === ep.b.y)
        || (f.x === ep.b.x && f.y === ep.b.y && l.x === ep.a.x && l.y === ep.a.y);
    });
    return complete && validate(puzzle, paths);
  }

  let announced = false;
  function render() {
    const done = solved();
    if (done && !announced) { announced = true; playSfx('puzzleSolve'); }
    if (!done) announced = false;
    let grid = '';
    for (let y = 0; y < puzzle.size; y++) {
      for (let x = 0; x < puzzle.size; x++) {
        const ep = epAt(x, y);
        const owner = usedBy(x, y);
        const color = ep >= 0 ? PAIR_COLORS[ep % PAIR_COLORS.length] : (owner >= 0 ? PAIR_COLORS[owner % PAIR_COLORS.length] : '');
        const cls = ['rune-cell'];
        if (ep >= 0) cls.push('endpoint');
        else if (owner >= 0) cls.push('path');
        if (active !== null && active === (ep >= 0 ? ep : owner)) cls.push('active');
        grid += `<div class="${cls.join(' ')}" data-x="${x}" data-y="${y}"${color ? ` style="--c:${color}"` : ''}>${ep >= 0 ? '◉' : ''}</div>`;
      }
    }
    wrap.innerHTML = `
      <h2>Runen verbinden</h2>
      <div class="rune-hint">Verbinde gleichfarbige Runen ohne Kreuzung.</div>
      <div class="rune-grid" style="grid-template-columns:repeat(${puzzle.size},36px)">${grid}</div>
      <div class="mini-result">${done ? '<b style="color:#7bd88f">Gelöst! ✨</b>' : ''}</div>
      <div class="btn-row">
        <button id="rreset" class="ghost">Reset</button>
        ${done ? '<button id="rdone">Verzaubern</button>' : ''}
        <button id="rback" class="ghost">Zurück</button>
      </div>
    `;
    wrap.querySelectorAll('.rune-cell').forEach((c) => { c.onclick = () => tapCell(+c.dataset.x, +c.dataset.y); });
    wrap.querySelector('#rreset').onclick = reset;
    wrap.querySelector('#rback').onclick = () => onClose && onClose();
    const d = wrap.querySelector('#rdone');
    if (d) d.onclick = () => { const quality = Math.min(1, (size * pairs) / 20); onSolve && onSolve(quality); };
  }
  render();
}
