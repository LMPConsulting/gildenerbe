import {
  COLORS, ROW_VALUES, LAST_INDEX, SCORE_TABLE, MAX_PENALTIES,
  createGame, rollDice, submit, legalMoves, canCross, currentStep,
  crossCount, rightmostCross, playerScore, standings, endReason,
} from '../../qwixx/src/engine.js';

const game2 = () => createGame(['A', 'B']);

/** Würfel direkt setzen und die Entscheidungsschlange aufbauen. */
function setup(state, dice) {
  rollDice(state, () => 0);            // baut pending/Flags auf
  Object.assign(state.dice, { red: null, yellow: null, green: null, blue: null }, dice);
  for (const c of COLORS) if (state.lockedRows[c]) state.dice[c] = null;
  return state;
}

const cross = (state, pi, color, index) => { state.players[pi].rows[color][index] = true; };
const crossUpTo = (state, pi, color, n) => { for (let i = 0; i < n; i++) cross(state, pi, color, i); };

describe('Blattaufbau', () => {
  it('Rot/Gelb laufen aufsteigend, Grün/Blau absteigend', () => {
    expect(ROW_VALUES.red).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(ROW_VALUES.yellow).toEqual(ROW_VALUES.red);
    expect(ROW_VALUES.green).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(ROW_VALUES.blue).toEqual(ROW_VALUES.green);
    expect(ROW_VALUES.red).toHaveLength(11);
  });

  it('startet leer, ohne Sperren und ohne Fehlwürfe', () => {
    const s = game2();
    expect(s.players).toHaveLength(2);
    expect(crossCount(s.players[0], 'red')).toBe(0);
    expect(Object.values(s.lockedRows)).toEqual([false, false, false, false]);
    expect(playerScore(s.players[0]).total).toBe(0);
  });
});

describe('Ankreuzen von links nach rechts', () => {
  it('erlaubt jedes Feld rechts vom letzten Kreuz', () => {
    const s = game2();
    cross(s, 0, 'red', 3);
    expect(rightmostCross(s.players[0].rows.red)).toBe(3);
    expect(canCross(s, 0, 'red', 4)).toBe(true);
    expect(canCross(s, 0, 'red', 9)).toBe(true);
  });

  it('sperrt Felder links davon und das bereits angekreuzte selbst', () => {
    const s = game2();
    cross(s, 0, 'red', 3);
    expect(canCross(s, 0, 'red', 2)).toBe(false);
    expect(canCross(s, 0, 'red', 3)).toBe(false);
  });

  it('gilt pro Spieler getrennt', () => {
    const s = game2();
    cross(s, 0, 'red', 8);
    expect(canCross(s, 0, 'red', 4)).toBe(false);
    expect(canCross(s, 1, 'red', 4)).toBe(true);
  });
});

describe('Letzte Zahl und Sperre', () => {
  it('braucht mindestens 5 Kreuze in der Reihe', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 4);
    expect(canCross(s, 0, 'red', LAST_INDEX)).toBe(false);
    cross(s, 0, 'red', 4);
    expect(crossCount(s.players[0], 'red')).toBe(5);
    expect(canCross(s, 0, 'red', LAST_INDEX)).toBe(true);
  });

  it('vergibt beim Ankreuzen der letzten Zahl das Schloss', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);
    setup(s, { w1: 6, w2: 6 });                       // weiße Summe 12 -> Rot ganz rechts
    const move = legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX);
    expect(move).toBeTruthy();
    submit(s, move);
    expect(s.players[0].locks.red).toBe(true);
    expect(s.pendingLocks).toContain('red');
  });

  it('sperrt die Reihe erst am Zugende — Mitspieler dürfen dieselbe Zahl noch nehmen', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);
    crossUpTo(s, 1, 'red', 5);
    setup(s, { w1: 6, w2: 6, red: 1, yellow: 1, green: 1, blue: 1 });

    submit(s, legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX));  // A weiß
    expect(s.lockedRows.red).toBe(false);
    submit(s, null);                                                                    // A Farbe

    expect(currentStep(s).p).toBe(1);
    const forB = legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX);
    expect(forB).toBeTruthy();
    submit(s, forB);

    expect(s.lockedRows.red).toBe(true);
    expect(s.players[1].locks.red).toBe(true);
  });

  it('nimmt den Farbwürfel nach der Sperre aus dem Spiel', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);
    setup(s, { w1: 6, w2: 6, red: 3, yellow: 3, green: 3, blue: 3 });
    submit(s, legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX));
    submit(s, null);
    submit(s, null);                                  // B setzt aus -> Zugende
    expect(s.dice.red).toBe(null);

    rollDice(s, () => 0.5);
    expect(s.dice.red).toBe(null);
    expect(s.dice.blue).not.toBe(null);
  });

  it('lässt in einer gesperrten Reihe nichts mehr zu', () => {
    const s = game2();
    s.lockedRows.green = true;
    expect(canCross(s, 0, 'green', 0)).toBe(false);
  });
});

describe('Erlaubte Züge', () => {
  it('weiße Summe gilt für jede Reihe', () => {
    const s = game2();
    setup(s, { w1: 3, w2: 4, red: 1, yellow: 1, green: 1, blue: 1 });
    const moves = legalMoves(s);
    expect(moves.map((m) => m.color).sort()).toEqual(['blue', 'green', 'red', 'yellow']);
    expect(new Set(moves.map((m) => m.value))).toEqual(new Set([7]));
  });

  it('weiß + Farbe trifft nur die eigene Reihe und beide weißen Würfel', () => {
    const s = game2();
    setup(s, { w1: 2, w2: 5, red: 3 });               // nur Rot im Spiel
    submit(s, null);                                  // weiße Phase überspringen
    expect(currentStep(s).kind).toBe('color');

    const moves = legalMoves(s);
    expect(moves.every((m) => m.color === 'red')).toBe(true);
    expect(new Set(moves.map((m) => m.value))).toEqual(new Set([5, 8]));
  });

  it('bietet keine Kombination für ausgeschiedene Farbwürfel', () => {
    const s = game2();
    s.lockedRows.blue = true;
    setup(s, { w1: 2, w2: 2, red: 3, yellow: 3, green: 3 });
    submit(s, null);
    expect(legalMoves(s).some((m) => m.color === 'blue')).toBe(false);
  });

  it('liefert nichts mehr, wenn die Reihe rechts zu ist', () => {
    const s = game2();
    for (const c of COLORS) cross(s, 0, c, LAST_INDEX - 1);   // vorletztes Feld belegt
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });  // Summe 2
    expect(legalMoves(s)).toEqual([]);
  });
});

describe('Zugreihenfolge an einem Handy', () => {
  it('aktiver Spieler zuerst (weiß, dann Farbe), danach die Mitspieler', () => {
    const s = createGame(['A', 'B', 'C']);
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
    expect(s.pending).toEqual([
      { p: 0, kind: 'white' }, { p: 0, kind: 'color' },
      { p: 1, kind: 'white' }, { p: 2, kind: 'white' },
    ]);
  });

  it('reicht den aktiven Spieler nach dem Zug weiter', () => {
    const s = game2();
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
    submit(s, legalMoves(s)[0]);
    submit(s, null);
    submit(s, null);
    expect(s.active).toBe(1);
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('roll');
  });
});

describe('Fehlwurf', () => {
  it('trifft den aktiven Spieler, wenn er gar nichts ankreuzt', () => {
    const s = game2();
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
    submit(s, null);
    submit(s, null);
    submit(s, null);
    expect(s.players[0].penalties).toBe(1);
    expect(s.players[1].penalties).toBe(0);
  });

  it('bleibt aus, sobald der aktive Spieler ein Kreuz macht', () => {
    const s = game2();
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
    submit(s, null);                                  // weiß ausgelassen
    submit(s, legalMoves(s)[0]);                      // dafür weiß + Farbe
    submit(s, null);
    expect(s.players[0].penalties).toBe(0);
  });

  it('trifft Mitspieler nie', () => {
    const s = game2();
    setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
    submit(s, legalMoves(s)[0]);
    submit(s, null);
    submit(s, null);                                  // B lässt aus
    expect(s.players[1].penalties).toBe(0);
  });
});

describe('Spielende', () => {
  it('endet nach der zweiten gesperrten Reihe', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);
    crossUpTo(s, 0, 'yellow', 5);
    setup(s, { w1: 6, w2: 6, yellow: 6 });            // weiß 12 -> Rot rechts; 6+6=12 -> Gelb rechts
    submit(s, legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX));
    submit(s, legalMoves(s).find((m) => m.color === 'yellow' && m.index === LAST_INDEX));
    submit(s, null);                                  // B -> Zugende

    expect(s.lockedRows.red).toBe(true);
    expect(s.lockedRows.yellow).toBe(true);
    expect(s.phase).toBe('over');
    expect(endReason(s)).toContain('Zwei Reihen gesperrt');
  });

  it('endet beim vierten Fehlwurf', () => {
    const s = game2();
    for (let i = 0; i < 8 && s.phase !== 'over'; i++) {
      setup(s, { w1: 1, w2: 1, red: 1, yellow: 1, green: 1, blue: 1 });
      while (s.pending.length) submit(s, null);
    }
    expect(s.players[0].penalties).toBe(MAX_PENALTIES);
    expect(s.phase).toBe('over');
    expect(endReason(s)).toContain('Fehlwürfe');
  });

  it('läuft ohne Sperre und ohne vierten Fehlwurf weiter', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);
    setup(s, { w1: 6, w2: 6, red: 1, yellow: 1, green: 1, blue: 1 });
    submit(s, legalMoves(s).find((m) => m.color === 'red' && m.index === LAST_INDEX));
    submit(s, null);
    submit(s, null);
    expect(s.phase).toBe('roll');
  });
});

describe('Punkte', () => {
  it('folgt der Wertungstabelle', () => {
    expect(SCORE_TABLE).toEqual([0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78]);
  });

  it('zählt das Schloss als zusätzliches Kreuz', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 5);                        // 5 Kreuze -> 15
    expect(playerScore(s.players[0]).rows.red).toBe(15);

    cross(s, 0, 'red', LAST_INDEX);
    s.players[0].locks.red = true;                    // 6 Kreuze + Schloss -> 7 -> 28
    expect(playerScore(s.players[0]).rows.red).toBe(28);
  });

  it('kommt bei einer vollen Reihe auf 78', () => {
    const s = game2();
    crossUpTo(s, 0, 'blue', 11);
    s.players[0].locks.blue = true;
    expect(playerScore(s.players[0]).rows.blue).toBe(78);
  });

  it('zieht 5 Punkte je Fehlwurf ab', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 3);                        // 3 Kreuze -> 6
    s.players[0].penalties = 2;
    const score = playerScore(s.players[0]);
    expect(score.penalties).toBe(-10);
    expect(score.total).toBe(-4);
  });

  it('sortiert den Endstand nach Punkten', () => {
    const s = game2();
    crossUpTo(s, 0, 'red', 2);                        // 2 Kreuze -> 3
    crossUpTo(s, 1, 'blue', 4);                       // 4 Kreuze -> 10
    const table = standings(s);
    expect(table[0].name).toBe('B');
    expect(table[0].total).toBe(10);
    expect(table[1].total).toBe(3);
  });
});
