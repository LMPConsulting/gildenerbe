// 5x5 "Schlag den König"-Schachrätsel: weiß muss den schwarzen König in exakt
// N Zügen schlagen — Schwarz zieht in diesem Rätseltyp NIE.
//
// Board: 5x5-Array, indiziert board[y][x]; y = 0 ist die OBERSTE Reihe, weiße
// Bauern ziehen "nach oben" = -y. Zellen sind null oder
// { type: 'K'|'Q'|'R'|'B'|'N'|'P', white: boolean }.
// Kein Rochieren, kein En-passant, keine Umwandlung.

export const SIZE = 5;

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL8 = [...ORTHO, ...DIAG];
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const inBounds = (board, x, y) => y >= 0 && y < board.length && x >= 0 && x < board.length;
const at = (board, x, y) => (inBounds(board, x, y) ? board[y][x] : undefined);

// Single-step movers (König, Springer): one hop per delta, may capture enemies.
function stepMoves(board, x, y, piece, deltas) {
  const out = [];
  for (const [dx, dy] of deltas) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(board, nx, ny)) continue;
    const target = board[ny][nx];
    if (!target || target.white !== piece.white) out.push({ x: nx, y: ny });
  }
  return out;
}

// Sliding movers (Dame, Turm, Läufer): ray per delta until blocked; the first
// enemy piece on a ray can be captured, own pieces block one square earlier.
function slideMoves(board, x, y, piece, deltas) {
  const out = [];
  for (const [dx, dy] of deltas) {
    let nx = x + dx, ny = y + dy;
    while (inBounds(board, nx, ny)) {
      const target = board[ny][nx];
      if (!target) out.push({ x: nx, y: ny });
      else { if (target.white !== piece.white) out.push({ x: nx, y: ny }); break; }
      nx += dx; ny += dy;
    }
  }
  return out;
}

// Bauer: gerade nur auf leere Felder, schlagen nur diagonal vorwärts.
// Weiß marschiert Richtung y = 0 (-y), Schwarz Richtung y = SIZE-1 (+y).
function pawnMoves(board, x, y, piece) {
  const fy = y + (piece.white ? -1 : 1);
  const out = [];
  if (inBounds(board, x, fy) && !board[fy][x]) out.push({ x, y: fy });
  for (const dx of [-1, 1]) {
    const target = at(board, x + dx, fy);
    if (target && target.white !== piece.white) out.push({ x: x + dx, y: fy });
  }
  return out;
}

// Reine Zuglogik pro Figurentyp.
export const PIECES = {
  K: { name: 'König', moves: (b, x, y, p) => stepMoves(b, x, y, p, ALL8) },
  Q: { name: 'Dame', moves: (b, x, y, p) => slideMoves(b, x, y, p, ALL8) },
  R: { name: 'Turm', moves: (b, x, y, p) => slideMoves(b, x, y, p, ORTHO) },
  B: { name: 'Läufer', moves: (b, x, y, p) => slideMoves(b, x, y, p, DIAG) },
  N: { name: 'Springer', moves: (b, x, y, p) => stepMoves(b, x, y, p, KNIGHT) },
  P: { name: 'Bauer', moves: pawnMoves },
};

export function legalMoves(board, x, y) {
  const piece = at(board, x, y);
  if (!piece) return [];
  return PIECES[piece.type].moves(board, x, y, piece);
}

// Immutable: liefert ein neues Brett, Zielfeld wird überschrieben (Schlag).
export function applyMove(board, from, to) {
  const next = board.map((row) => row.slice());
  next[to.y][to.x] = next[from.y][from.x];
  next[from.y][from.x] = null;
  return next;
}

// Gewonnen, sobald kein schwarzer König mehr auf dem Brett steht.
export function isWon(board) {
  for (const row of board) {
    for (const cell of row) if (cell && cell.type === 'K' && !cell.white) return false;
  }
  return true;
}

// Tiefenbegrenzte Suche über NUR weiße Züge. Liefert eine Gewinnsequenz
// [{ from:{x,y}, to:{x,y} }, ...] mit Länge <= movesToWin oder null.
export function solve(board, movesToWin) {
  if (isWon(board)) return [];
  if (movesToWin <= 0) return null;
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board.length; x++) {
      const piece = board[y][x];
      if (!piece || !piece.white) continue;
      for (const to of legalMoves(board, x, y)) {
        const rest = solve(applyMove(board, { x, y }, to), movesToWin - 1);
        if (rest) return [{ from: { x, y }, to: { x: to.x, y: to.y } }, ...rest];
      }
    }
  }
  return null;
}

const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

const WHITE_POOL = ['Q', 'R', 'B', 'N', 'P'];
const BLACK_MINORS = ['N', 'B'];

// Zufällige Aufstellung -> Lösungssuche -> akzeptieren, wenn der schwarze
// König in GENAU movesToWin weißen Zügen fällt (und nicht in weniger).
export function generatePuzzle(rng, { movesToWin = 1 } = {}) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = emptyBoard();
    const free = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) free.push({ x, y });
    const take = () => free.splice(rng.int(0, free.length - 1), 1)[0];

    const king = take();
    board[king.y][king.x] = { type: 'K', white: false };
    const minors = rng.int(0, 2);
    for (let i = 0; i < minors; i++) {
      const c = take();
      board[c.y][c.x] = { type: rng.pick(BLACK_MINORS), white: false };
    }
    const whites = rng.int(1, 3);
    for (let i = 0; i < whites; i++) {
      const c = take();
      board[c.y][c.x] = { type: rng.pick(WHITE_POOL), white: true };
    }

    if (movesToWin > 1 && solve(board, movesToWin - 1)) continue; // zu leicht
    const seq = solve(board, movesToWin);
    if (seq && seq.length === movesToWin) return { board, movesToWin, white: true };
  }
  // Fallback: garantiert lösbares Turm-Layout (praktisch nie nötig).
  const board = emptyBoard();
  board[0][0] = { type: 'K', white: false };
  if (movesToWin === 1) board[4][0] = { type: 'R', white: true }; // Turm zieht die Linie hoch
  else board[4][4] = { type: 'R', white: true }; // Ecke -> Linie -> König: exakt 2 Züge
  return { board, movesToWin, white: true };
}
