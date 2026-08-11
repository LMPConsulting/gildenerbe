// Qwixx — reine Spiellogik, ohne DOM. Alles serialisierbar (localStorage-tauglich).

export const COLORS = ['red', 'yellow', 'green', 'blue'];

export const COLOR_LABEL = { red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau' };

// Rot/Gelb aufsteigend 2..12, Grün/Blau absteigend 12..2.
export const ROW_VALUES = {
  red:    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  yellow: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  green:  [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  blue:   [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

export const LAST_INDEX = 10;               // Spalte der "letzten Zahl" (12 bzw. 2)
export const LOCK_MIN_CROSSES = 5;          // so viele Kreuze braucht es davor
export const PENALTY_POINTS = -5;
export const MAX_PENALTIES = 4;
export const LOCKS_TO_END = 2;

// Kreuze (inkl. Schloss) -> Punkte. Dreieckszahlen, 12 Kreuze = 78.
export const SCORE_TABLE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];

const emptyRow = () => new Array(11).fill(false);

function makePlayer(name) {
  return {
    name,
    rows: { red: emptyRow(), yellow: emptyRow(), green: emptyRow(), blue: emptyRow() },
    locks: { red: false, yellow: false, green: false, blue: false },
    penalties: 0,
  };
}

export function createGame(names) {
  return {
    v: 1,
    players: names.map(makePlayer),
    lockedRows: { red: false, yellow: false, green: false, blue: false },
    active: 0,          // Index des aktiven Spielers (der würfelt)
    turn: 1,
    dice: null,         // { w1, w2, red, yellow, green, blue } — Farbe null = Würfel raus
    pending: [],        // Warteschlange offener Entscheidungen
    pendingLocks: [],   // Farben, die in diesem Zug gesperrt wurden (greifen am Zugende)
    activeCrossed: false,
    lastMoves: [],      // Züge dieser Runde, für die Zusammenfassung
    phase: 'roll',      // 'roll' | 'decide' | 'over'
  };
}

/** Index des am weitesten rechts liegenden Kreuzes, sonst -1. */
export function rightmostCross(rowArr) {
  let last = -1;
  for (let i = 0; i < rowArr.length; i++) if (rowArr[i]) last = i;
  return last;
}

export function crossCount(player, color) {
  return player.rows[color].reduce((n, x) => n + (x ? 1 : 0), 0);
}

/** Darf Spieler `pi` in `color` das Feld `index` ankreuzen? */
export function canCross(state, pi, color, index) {
  if (state.lockedRows[color]) return false;
  const row = state.players[pi].rows[color];
  if (index < 0 || index > LAST_INDEX) return false;
  if (row[index]) return false;
  if (index <= rightmostCross(row)) return false;  // nur von links nach rechts
  if (index === LAST_INDEX && crossCount(state.players[pi], color) < LOCK_MIN_CROSSES) return false;
  return true;
}

/** Die gerade anstehende Entscheidung: { p, kind: 'white' | 'color' } oder null. */
export function currentStep(state) {
  return state.pending.length ? state.pending[0] : null;
}

export function whiteSum(state) {
  return state.dice ? state.dice.w1 + state.dice.w2 : null;
}

/**
 * Alle erlaubten Züge der aktuellen Entscheidung.
 * -> [{ color, index, value, from }]   from: 'white' | 'w1+farbe' …
 */
export function legalMoves(state) {
  const step = currentStep(state);
  if (!step || !state.dice) return [];
  const moves = [];
  const push = (color, value, from) => {
    const index = ROW_VALUES[color].indexOf(value);
    if (index === -1) return;
    if (!canCross(state, step.p, color, index)) return;
    if (moves.some((m) => m.color === color && m.index === index)) return;
    moves.push({ color, index, value, from });
  };

  if (step.kind === 'white') {
    const sum = whiteSum(state);
    for (const c of COLORS) push(c, sum, 'weiß + weiß');
  } else {
    for (const c of COLORS) {
      const cd = state.dice[c];
      if (cd == null) continue;
      push(c, state.dice.w1 + cd, `weiß ${state.dice.w1} + ${COLOR_LABEL[c].toLowerCase()} ${cd}`);
      push(c, state.dice.w2 + cd, `weiß ${state.dice.w2} + ${COLOR_LABEL[c].toLowerCase()} ${cd}`);
    }
  }
  return moves;
}

/** Alle Kombinationen aus weiß + Farbe, auch die nicht ankreuzbaren (für die Anzeige). */
export function colorCombos(state) {
  if (!state.dice) return [];
  const out = [];
  for (const c of COLORS) {
    const cd = state.dice[c];
    if (cd == null) continue;
    for (const w of [state.dice.w1, state.dice.w2]) {
      if (out.some((o) => o.color === c && o.value === w + cd)) continue;
      out.push({ color: c, white: w, die: cd, value: w + cd });
    }
  }
  return out;
}

export function rollDice(state, rnd = Math.random) {
  const d6 = () => 1 + Math.floor(rnd() * 6);
  const dice = { w1: d6(), w2: d6(), red: null, yellow: null, green: null, blue: null };
  for (const c of COLORS) if (!state.lockedRows[c]) dice[c] = d6();

  state.dice = dice;
  state.activeCrossed = false;
  state.pendingLocks = [];
  state.lastMoves = [];

  // Der aktive Spieler entscheidet erst über die weiße Summe, dann über weiß+Farbe.
  // Danach sind die Mitspieler mit der weißen Summe dran (ein Handy, eine Reihenfolge).
  const n = state.players.length;
  state.pending = [
    { p: state.active, kind: 'white' },
    { p: state.active, kind: 'color' },
  ];
  for (let i = 1; i < n; i++) state.pending.push({ p: (state.active + i) % n, kind: 'white' });

  state.phase = 'decide';
  return state;
}

/** Entscheidung abgeben: `move` aus legalMoves() oder null zum Aussetzen. */
export function submit(state, move) {
  const step = currentStep(state);
  if (!step) return state;

  if (move) {
    const player = state.players[step.p];
    player.rows[move.color][move.index] = true;
    if (move.index === LAST_INDEX) {
      player.locks[move.color] = true;
      if (!state.pendingLocks.includes(move.color)) state.pendingLocks.push(move.color);
    }
    if (step.p === state.active) state.activeCrossed = true;
    state.lastMoves.push({ p: step.p, color: move.color, index: move.index, value: move.value });
  }

  state.pending.shift();
  if (state.pending.length === 0) endTurn(state);
  return state;
}

export function endTurn(state) {
  // Wer als aktiver Spieler kein einziges Kreuz gemacht hat, kassiert einen Fehlwurf.
  if (!state.activeCrossed) state.players[state.active].penalties += 1;

  // Sperren greifen erst jetzt — so kann in derselben Runde noch jemand dieselbe
  // Zahl ankreuzen (im Original entscheiden alle gleichzeitig).
  for (const c of state.pendingLocks) {
    state.lockedRows[c] = true;
    if (state.dice) state.dice[c] = null;
  }

  const locked = COLORS.filter((c) => state.lockedRows[c]).length;
  const worstPenalties = Math.max(...state.players.map((p) => p.penalties));
  if (locked >= LOCKS_TO_END || worstPenalties >= MAX_PENALTIES) {
    state.phase = 'over';
    return state;
  }

  state.active = (state.active + 1) % state.players.length;
  state.turn += 1;
  state.phase = 'roll';
  return state;
}

export function playerScore(player) {
  const rows = {};
  let total = 0;
  for (const c of COLORS) {
    const n = crossCount(player, c) + (player.locks[c] ? 1 : 0);
    rows[c] = SCORE_TABLE[n];
    total += rows[c];
  }
  const penalties = player.penalties * PENALTY_POINTS;
  return { rows, penalties, total: total + penalties };
}

/** Endstand, absteigend sortiert. Bei Gleichstand teilen sich alle Platz 1. */
export function standings(state) {
  return state.players
    .map((p, i) => ({ index: i, name: p.name, ...playerScore(p) }))
    .sort((a, b) => b.total - a.total);
}

export function endReason(state) {
  if (state.phase !== 'over') return null;
  const locked = COLORS.filter((c) => state.lockedRows[c]);
  if (locked.length >= LOCKS_TO_END) {
    return `Zwei Reihen gesperrt (${locked.map((c) => COLOR_LABEL[c]).join(' & ')})`;
  }
  const who = state.players.find((p) => p.penalties >= MAX_PENALTIES);
  return `${who.name} hat ${MAX_PENALTIES} Fehlwürfe`;
}
