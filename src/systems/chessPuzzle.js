// Echte Schach-Mattaufgaben auf dem 8x8-Brett.
// board[y][x]; y=0 = schwarze Grundreihe (Reihe 8), Weiß zieht nach oben (-y).
// Figuren: { type: 'K'|'Q'|'R'|'B'|'N'|'P', white: boolean } oder null.
// Regeln: vollwertige Figurenzüge inkl. Schach/Schachmatt/Patt und
// Bauern-Doppelschritt; ohne Rochade, En-passant und Umwandlung
// (die kuratierten Stellungen kommen ohne aus). DOM-frei, deterministisch.

export const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const inBounds = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

export function emptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

// Baut ein Brett aus einer Figurenliste [{type,white,x,y}, ...].
export function boardFromPieces(pieces) {
  const b = emptyBoard();
  for (const p of pieces) {
    if (!inBounds(p.x, p.y)) throw new Error(`Feld außerhalb: ${p.x},${p.y}`);
    if (b[p.y][p.x]) throw new Error(`Feld doppelt belegt: ${p.x},${p.y}`);
    b[p.y][p.x] = { type: p.type, white: p.white };
  }
  return b;
}

// Immutable: liefert ein neues Brett, Original bleibt unverändert.
export function applyMove(board, from, to) {
  const b = board.map((row) => row.slice());
  b[to.y][to.x] = b[from.y][from.x];
  b[from.y][from.x] = null;
  return b;
}

// Pseudo-legale Zielfelder (ohne Selbstschach-Prüfung).
export function pseudoMoves(board, x, y) {
  const p = board[y][x];
  if (!p) return [];
  const out = [];
  const tryPush = (tx, ty) => {
    if (!inBounds(tx, ty)) return;
    const t = board[ty][tx];
    if (!t || t.white !== p.white) out.push({ x: tx, y: ty });
  };

  if (p.type === 'P') {
    const dir = p.white ? -1 : 1;
    const startY = p.white ? 6 : 1;
    // Einzelschritt (nur auf leeres Feld, kein Schlagen geradeaus)
    if (inBounds(x, y + dir) && !board[y + dir][x]) {
      out.push({ x, y: y + dir });
      // Doppelschritt von der Grundstellung
      if (y === startY && !board[y + 2 * dir][x]) out.push({ x, y: y + 2 * dir });
    }
    // Schlagen diagonal
    for (const dx of [-1, 1]) {
      const tx = x + dx;
      const ty = y + dir;
      if (inBounds(tx, ty) && board[ty][tx] && board[ty][tx].white !== p.white) {
        out.push({ x: tx, y: ty });
      }
    }
    return out;
  }

  if (p.type === 'N') {
    for (const [dx, dy] of KNIGHT_JUMPS) tryPush(x + dx, y + dy);
    return out;
  }

  if (p.type === 'K') {
    for (const [dx, dy] of ALL_DIRS) tryPush(x + dx, y + dy);
    return out;
  }

  const dirs = p.type === 'R' ? ROOK_DIRS : p.type === 'B' ? BISHOP_DIRS : ALL_DIRS;
  for (const [dx, dy] of dirs) {
    let tx = x + dx;
    let ty = y + dy;
    while (inBounds(tx, ty)) {
      const t = board[ty][tx];
      if (!t) {
        out.push({ x: tx, y: ty });
      } else {
        if (t.white !== p.white) out.push({ x: tx, y: ty });
        break;
      }
      tx += dx;
      ty += dy;
    }
  }
  return out;
}

// Greift die Seite `byWhite` das Feld (x,y) an?
export function attacks(board, x, y, byWhite) {
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const p = board[py][px];
      if (!p || p.white !== byWhite) continue;
      if (p.type === 'P') {
        const dir = p.white ? -1 : 1;
        if (py + dir === y && Math.abs(px - x) === 1) return true;
        continue;
      }
      if (p.type === 'N') {
        const dx = Math.abs(px - x);
        const dy = Math.abs(py - y);
        if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) return true;
        continue;
      }
      if (p.type === 'K') {
        if (Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1 && (px !== x || py !== y)) return true;
        continue;
      }
      // Schieber: Ausrichtung prüfen, dann freie Bahn
      const straight = px === x || py === y;
      const diagonal = Math.abs(px - x) === Math.abs(py - y) && px !== x;
      const fits =
        (p.type === 'R' && straight) ||
        (p.type === 'B' && diagonal) ||
        (p.type === 'Q' && (straight || diagonal));
      if (!fits) continue;
      const dx = Math.sign(x - px);
      const dy = Math.sign(y - py);
      let cx = px + dx;
      let cy = py + dy;
      let blocked = false;
      while (cx !== x || cy !== y) {
        if (board[cy][cx]) {
          blocked = true;
          break;
        }
        cx += dx;
        cy += dy;
      }
      if (!blocked) return true;
    }
  }
  return false;
}

function kingPos(board, white) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (p && p.type === 'K' && p.white === white) return { x, y };
    }
  }
  return null;
}

export function inCheck(board, white) {
  const k = kingPos(board, white);
  if (!k) return false; // Testbretter ohne König: nie im Schach
  return attacks(board, k.x, k.y, !white);
}

// Legale Züge: pseudo-legal minus alles, was den eigenen König im Schach lässt.
export function legalMoves(board, x, y) {
  const p = board[y][x];
  if (!p) return [];
  return pseudoMoves(board, x, y).filter(
    (t) => !inCheck(applyMove(board, { x, y }, t), p.white),
  );
}

export function allLegalMoves(board, white) {
  const out = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p || p.white !== white) continue;
      for (const t of legalMoves(board, x, y)) out.push({ from: { x, y }, to: t });
    }
  }
  return out;
}

export function isCheckmate(board, white) {
  return inCheck(board, white) && allLegalMoves(board, white).length === 0;
}

export function isStalemate(board, white) {
  return !inCheck(board, white) && allLegalMoves(board, white).length === 0;
}

// Sucht einen weißen Erstzug, der Matt in <= n Zügen erzwingt (n=1: sofort
// Schachmatt; n=2: jede legale schwarze Antwort erlaubt Matt-in-1; usw.).
// Patt zählt nicht als Erfolg. Liefert {from,to} oder null.
export function solveMate(board, n) {
  if (!Number.isInteger(n) || n < 1) return null;
  for (const m of allLegalMoves(board, true)) {
    const b1 = applyMove(board, m.from, m.to);
    if (isCheckmate(b1, false)) return m;
    if (n >= 2) {
      const replies = allLegalMoves(b1, false);
      if (replies.length === 0) continue; // Patt -> kein Matt
      let forced = true;
      for (const r of replies) {
        if (!solveMate(applyMove(b1, r.from, r.to), n - 1)) {
          forced = false;
          break;
        }
      }
      if (forced) return m;
    }
  }
  return null;
}

// Wählt die zäheste legale schwarze Antwort: bevorzugt Züge, nach denen Weiß
// kein Matt-in-1 mehr hat; sonst möglichst wenige Mattzüge übrig lassen.
// Gleichstand: wertvollster Schlag, dann seeded Zufall. null wenn zugunfähig.
export function applyBlackBestDefense(board, rng) {
  const moves = allLegalMoves(board, false);
  if (moves.length === 0) return null;
  let best = [];
  let bestScore = -Infinity;
  for (const m of moves) {
    const b1 = applyMove(board, m.from, m.to);
    let mates = 0;
    for (const w of allLegalMoves(b1, true)) {
      if (isCheckmate(applyMove(b1, w.from, w.to), false)) mates++;
    }
    const target = board[m.to.y][m.to.x];
    const capture = target ? PIECE_VALUES[target.type] : 0;
    const score = (mates === 0 ? 1000 : -10 * mates) + capture;
    if (score > bestScore) {
      bestScore = score;
      best = [m];
    } else if (score === bestScore) {
      best.push(m);
    }
  }
  return rng ? rng.pick(best) : best[0];
}

// ---------------------------------------------------------------------------
// Kuratierte Aufgaben-Bibliothek. Felder algebraisch ('e4'): x = Linie a..h,
// y = 8 - Reihe (e1 -> {x:4,y:7}). Jede Stellung wird bei der Auswahl mit
// solveMate verifiziert (Matt in genau movesToWin, nicht schneller).

function sq(s) {
  const x = s.charCodeAt(0) - 97;
  const y = 8 - Number(s[1]);
  if (!inBounds(x, y)) throw new Error(`Ungültiges Feld: ${s}`);
  return { x, y };
}

function side(white, specs) {
  return specs.map((spec) => {
    const { x, y } = sq(spec.slice(1));
    return { type: spec[0], white, x, y };
  });
}

function entry(name, whitePieces, blackPieces) {
  return { name, pieces: [...side(true, whitePieces), ...side(false, blackPieces)] };
}

export const PUZZLE_LIBRARY = {
  1: [
    entry('Grundreihenmatt', ['Re1', 'Kg1'], ['Kg8', 'Pf7', 'Pg7', 'Ph7']),
    entry('Damenmatt am Rand', ['Qh7', 'Ke6'], ['Ke8']),
    entry('Ersticktes Matt', ['Ng5', 'Ke1'], ['Kh8', 'Rg8', 'Pg7', 'Ph7']),
    entry('Treppenmatt', ['Ra7', 'Rb1', 'Ke1'], ['Kd8']),
    entry('Dame und Springer', ['Qg6', 'Nf5', 'Ka1'], ['Kh8', 'Pf7']),
    entry('Läuferbatterie', ['Qh5', 'Bd3', 'Ba3', 'Kg1'], ['Kg8', 'Pf7', 'Pg7']),
    entry('Epaulettenmatt', ['Qh6', 'Ka1'], ['Ke8', 'Rd8', 'Rf8']),
    entry('Arabisches Matt', ['Ra7', 'Nf6', 'Ka1'], ['Kh8']),
    entry('Eckmatt', ['Rh6', 'Ke1'], ['Ka8', 'Pa7', 'Pb7']),
    entry('Damenmatt mit König', ['Qb8', 'Kc5'], ['Ka5']),
  ],
  2: [
    entry('Turmtreppe rechts', ['Ra6', 'Rh5', 'Kh1'], ['Kd7']),
    entry('Turmtreppe links', ['Rh6', 'Ra5', 'Ka1'], ['Ke7']),
    entry('Doppelturm e-Linie', ['Re4', 'Re3', 'Kg1'], ['Kg8', 'Rd8', 'Pf7', 'Pg7', 'Ph7']),
    entry('Damentreppe', ['Ra6', 'Qh5', 'Kh1'], ['Kd7']),
    entry('Gefesselter Läufer', ['Rh6', 'Bd4', 'Kc7'], ['Ka8', 'Be8', 'Pa7', 'Pb7']),
    entry('Doppelturm d-Linie', ['Rd4', 'Rd3', 'Kb1'], ['Kb8', 'Re8', 'Pa7', 'Pb7', 'Pc7']),
    entry('Damentreppe gespiegelt', ['Rh6', 'Qa5', 'Ka1'], ['Ke7']),
    entry('Gefesselter Läufer gespiegelt', ['Ra6', 'Be4', 'Kf7'], ['Kh8', 'Bd8', 'Pg7', 'Ph7']),
    entry('Doppelturm gegen f8', ['Rd4', 'Rd3', 'Kg1'], ['Kf8', 'Rc8', 'Pe7', 'Pf7', 'Pg7']),
  ],
};

// Zieht eine verifizierte Aufgabe aus der Bibliothek (seeded Auswahl).
export function generatePuzzle(rng, { movesToWin = 1 } = {}) {
  const pool = (PUZZLE_LIBRARY[movesToWin] || []).slice();
  if (pool.length === 0) throw new Error(`Keine Aufgaben für Matt in ${movesToWin}`);
  // Seeded Fisher-Yates, dann erste verifizierte Stellung nehmen.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const cand of pool) {
    const board = boardFromPieces(cand.pieces);
    if (!solveMate(board, movesToWin)) continue;
    if (movesToWin > 1 && solveMate(board, movesToWin - 1)) continue;
    return { board, movesToWin, white: true, name: cand.name };
  }
  throw new Error('Keine gültige Mattaufgabe gefunden');
}
