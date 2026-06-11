// Chiptune-orchestral note data for Gildenerbe — pure data + tiny helpers,
// no audio objects, safe to import anywhere (including Node tests).
//
// Format: { bpm, loop, voices: [{ id, type, gain, steps, ...timbre }] }.
// steps are [note, beats] tuples ('C4'-style, null = rest). Timbre fields
// consumed by synth.playSequence: attackMs/releaseMs (pads), detune (chorus),
// vibrato {rateHz,cents}, filterHz (lowpass), octave, noise (percussion —
// the note then encodes the filter cutoff). All voices of a track have the
// same total beat count so loops stay locked together.

// --- helpers ----------------------------------------------------------------
const bar = (note, beats = 4) => [[note, beats]];
const seq = (...groups) => groups.flat();
// one entry per chord symbol, `beats` long each
const chordLine = (chords, map, beats = 4) => chords.map((c) => [map[c], beats]);
// bass: root half + fifth half per bar
const bassLine = (chords, roots, fifths) =>
  chords.flatMap((c) => [[roots[c], 2], [fifths[c], 2]]);
// gentle 8th-note arpeggio bar from 4 chord tones (repeated figure)
const arpBar = (n) => [n[0], n[1], n[2], n[1], n[3], n[1], n[2], n[1]].map((x) => [x, 0.5]);
// percussion bar: hits on the given beats (cutoffNote encodes the drum pitch)
const percBar = (cutoffNote, hits = [1]) => {
  const out = [];
  for (let b = 1; b <= 4; b++) out.push(hits.includes(b) ? [cutoffNote, 1] : [null, 1]);
  return out;
};
const rest = (beats) => [[null, beats]];

// ---------------------------------------------------------------------------
// TOWN — „Hymne der Gildenhalle". Stately Stormwind-spirit anthem in G major,
// 100 bpm, 32 bars of 4/4 (128 beats): horn lead over slow-attack pads,
// walking bass, triangle bells answering in the B section, soft timpani.
// ---------------------------------------------------------------------------
const TOWN_CHORDS = [
  // A (16 bars)
  'G', 'D', 'Em', 'C', 'G', 'D', 'Em', 'C',
  'G', 'Em', 'C', 'D', 'G', 'C', 'G', 'G',
  // B (16 bars)
  'C', 'G', 'Am', 'Em', 'C', 'G', 'D', 'D',
  'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G',
];
const T_HI = { G: 'B4', D: 'A4', Em: 'B4', C: 'C5', Am: 'C5' };
const T_LO = { G: 'D4', D: 'D4', Em: 'E4', C: 'E4', Am: 'E4' };
const T_ROOT = { G: 'G2', D: 'D2', Em: 'E2', C: 'C3', Am: 'A2' };
const T_FIFTH = { G: 'D3', D: 'A2', Em: 'B2', C: 'G2', Am: 'E3' };

const TOWN = {
  bpm: 100,
  loop: true,
  voices: [
    { // horn lead — detuned saw through a lowpass, light vibrato
      id: 'horn', type: 'sawtooth', gain: 0.11,
      detune: 9, filterHz: 1300, vibrato: { rateHz: 5, cents: 10 }, attackMs: 55, releaseMs: 140,
      steps: seq(
        // A — four noble four-bar phrases
        [['D4', 2], ['G4', 1], ['A4', 1]], [['B4', 2], ['A4', 1], ['G4', 1]],
        [['A4', 2], ['F#4', 1], ['D4', 1]], [['G4', 3], [null, 1]],
        [['B4', 2], ['C5', 1], ['B4', 1]], [['A4', 2], ['G4', 1], ['F#4', 1]],
        [['G4', 2], ['E4', 1], ['F#4', 1]], [['G4', 3], [null, 1]],
        [['D5', 2], ['B4', 1], ['G4', 1]], [['C5', 2], ['A4', 1], ['F#4', 1]],
        [['B4', 2], ['G4', 1], ['E4', 1]], [['A4', 3], [null, 1]],
        [['G4', 1], ['A4', 1], ['B4', 1], ['C5', 1]], [['D5', 2], ['B4', 1], ['G4', 1]],
        [['A4', 2], ['F#4', 2]], [['G4', 3], [null, 1]],
        // B — answer, reaching higher then settling home
        [['E5', 2], ['D5', 1], ['C5', 1]], [['B4', 2], ['C5', 1], ['D5', 1]],
        [['E5', 2], ['C5', 1], ['A4', 1]], [['B4', 3], [null, 1]],
        [['C5', 2], ['B4', 1], ['A4', 1]], [['B4', 2], ['A4', 1], ['G4', 1]],
        [['A4', 1], ['B4', 1], ['C5', 1], ['A4', 1]], [['D5', 3], [null, 1]],
        [['E4', 1], ['G4', 1], ['B4', 1], ['D5', 1]], [['C5', 2], ['E5', 1], ['D5', 1]],
        [['B4', 2], ['G4', 1], ['A4', 1]], [['B4', 2], ['A4', 2]],
        [['C5', 2], ['A4', 1], ['F#4', 1]], [['A4', 2], ['D5', 1], ['C5', 1]],
        [['B4', 1], ['A4', 1], ['G4', 1], ['F#4', 1]], [['G4', 4]],
      ),
    },
    { // upper pad — slow-attack chord tones
      id: 'padHigh', type: 'sawtooth', gain: 0.045,
      detune: 12, filterHz: 750, attackMs: 420, releaseMs: 600,
      steps: chordLine(TOWN_CHORDS, T_HI),
    },
    { // lower pad
      id: 'padLow', type: 'sawtooth', gain: 0.045,
      detune: 12, filterHz: 650, attackMs: 420, releaseMs: 600,
      steps: chordLine(TOWN_CHORDS, T_LO),
    },
    { // walking bass — root/fifth halves
      id: 'bass', type: 'triangle', gain: 0.08, releaseMs: 120,
      steps: bassLine(TOWN_CHORDS, T_ROOT, T_FIFTH),
    },
    { // bells — silent in A, answering sparkles in B (64 + 64 beats)
      id: 'bells', type: 'triangle', gain: 0.05, releaseMs: 200,
      steps: seq(
        rest(64),
        rest(3), [['G5', 1]], rest(3), [['E5', 1]],
        rest(3), [['C5', 1]], rest(4),
        rest(3), [['E5', 1]], rest(3), [['D5', 1]],
        rest(2), [['D5', 1], ['F#5', 1]], rest(4),
        rest(3), [['B4', 1]], rest(3), [['E5', 1]],
        rest(3), [['D5', 1]], rest(2), [['A4', 1], ['B4', 1]],
        rest(3), [['E5', 1]], rest(3), [['F#5', 1]],
        rest(2), [['G5', 2]], rest(4),
      ),
    },
    { // soft timpani on downbeats (B section adds beat 3)
      id: 'timpani', type: 'triangle', gain: 0.05, noise: true,
      steps: seq(
        ...Array.from({ length: 16 }, () => percBar('G2', [1])),
        ...Array.from({ length: 16 }, () => percBar('G2', [1, 3])),
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// EXPLORE — „Pfade im Eichhain". Airy and hopeful, A minor, 76 bpm,
// 16 bars (64 beats): pad bed, sparse pentatonic lead, gentle arp, calm bass.
// ---------------------------------------------------------------------------
const EXP_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am'];
const E_HI = { Am: 'C5', F: 'A4', C: 'G4', G: 'B4' };
const E_LO = { Am: 'E4', F: 'F4', C: 'E4', G: 'D4' };
const E_ROOT = { Am: 'A2', F: 'F2', C: 'C3', G: 'G2' };
const E_ARP = {
  Am: ['A3', 'E4', 'A4', 'C5'], F: ['F3', 'C4', 'F4', 'A4'],
  C: ['C4', 'G4', 'C5', 'E5'], G: ['G3', 'D4', 'G4', 'B4'],
};

const EXPLORE = {
  bpm: 76,
  loop: true,
  voices: [
    { // long-note pentatonic lead
      id: 'lead', type: 'triangle', gain: 0.10,
      vibrato: { rateHz: 4.5, cents: 8 }, attackMs: 40, releaseMs: 180,
      steps: seq(
        [['A4', 3], ['C5', 1]], [['E5', 2], ['D5', 2]],
        [['C5', 2], ['A4', 1], ['G4', 1]], [['A4', 4]],
        [[null, 2], ['E4', 1], ['G4', 1]], [['A4', 2], ['C5', 2]],
        [['G4', 2], ['E4', 2]], [['G4', 4]],
        [['A4', 3], ['C5', 1]], [['D5', 2], ['E5', 2]],
        [['D5', 2], ['C5', 1], ['A4', 1]], [['C5', 4]],
        [['E5', 2], ['D5', 2]], [['C5', 2], ['A4', 2]],
        [['G4', 2], ['A4', 1], ['C5', 1]], [['A4', 4]],
      ),
    },
    { id: 'padHigh', type: 'sawtooth', gain: 0.04, detune: 10, filterHz: 700, attackMs: 500, releaseMs: 700,
      steps: chordLine(EXP_CHORDS, E_HI) },
    { id: 'padLow', type: 'sawtooth', gain: 0.04, detune: 10, filterHz: 600, attackMs: 500, releaseMs: 700,
      steps: chordLine(EXP_CHORDS, E_LO) },
    { id: 'arp', type: 'triangle', gain: 0.035, releaseMs: 80,
      steps: EXP_CHORDS.flatMap((c) => arpBar(E_ARP[c])) },
    { id: 'bass', type: 'triangle', gain: 0.06, releaseMs: 150,
      steps: chordLine(EXP_CHORDS, E_ROOT) },
  ],
};

// ---------------------------------------------------------------------------
// BOSS — „Krells Zorn". Epic-dangerous, D minor, 140 bpm, 16 bars (64 beats):
// relentless eighth-note bass pulse, double stab chords, tense lead with a
// lifting B half, kick on beats 1 & 3.
// ---------------------------------------------------------------------------
const BOSS_CHORDS = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'A', 'Dm'];
const B_ROOT = { Dm: 'D2', Bb: 'Bb2', F: 'F2', C: 'C3', Gm: 'G2', A: 'A2' };
const B_STAB1 = { Dm: 'D4', Bb: 'D4', F: 'C4', C: 'E4', Gm: 'D4', A: 'C#4' };
const B_STAB2 = { Dm: 'F4', Bb: 'F4', F: 'F4', C: 'G4', Gm: 'G4', A: 'E4' };
const pulseBar = (root) => Array.from({ length: 8 }, (_, i) => [i === 7 ? null : root, 0.5]);
const stabBar = (n) => [[n, 0.5], [null, 1.5], [n, 0.5], [null, 1.5]];

const BOSS = {
  bpm: 140,
  loop: true,
  voices: [
    { // tense lead
      id: 'lead', type: 'square', gain: 0.085,
      vibrato: { rateHz: 6, cents: 6 }, releaseMs: 90,
      steps: seq(
        [['D5', 1], ['C5', 0.5], ['D5', 0.5], ['F5', 1], ['E5', 1]],
        [['D5', 1], ['C5', 1], ['A4', 2]],
        [['C5', 1], ['A4', 0.5], ['C5', 0.5], ['F5', 1], ['E5', 1]],
        [['E5', 2], ['C5', 2]],
        [['D5', 1], ['C5', 0.5], ['D5', 0.5], ['F5', 1], ['G5', 1]],
        [['F5', 1], ['D5', 1], ['Bb4', 2]],
        [['G4', 1], ['Bb4', 1], ['D5', 1], ['C5', 1]],
        [['C#5', 2], ['E5', 1], ['C#5', 1]],
        // B — lifts
        [['F5', 2], ['E5', 1], ['D5', 1]], [['F5', 1], ['G5', 1], ['F5', 2]],
        [['A4', 1], ['C5', 1], ['F5', 2]], [['E5', 2], ['G5', 2]],
        [['G5', 1], ['F5', 1], ['D5', 2]], [['D5', 1], ['F5', 1], ['Bb4', 2]],
        [['A4', 1], ['C#5', 1], ['E5', 2]], [['D5', 4]],
      ),
    },
    { id: 'stab1', type: 'square', gain: 0.05, releaseMs: 60,
      steps: BOSS_CHORDS.flatMap((c) => stabBar(B_STAB1[c])) },
    { id: 'stab2', type: 'square', gain: 0.045, releaseMs: 60,
      steps: BOSS_CHORDS.flatMap((c) => stabBar(B_STAB2[c])) },
    { id: 'pulse', type: 'triangle', gain: 0.075, releaseMs: 50,
      steps: BOSS_CHORDS.flatMap((c) => pulseBar(B_ROOT[c])) },
    { id: 'kick', type: 'triangle', gain: 0.06, noise: true,
      steps: BOSS_CHORDS.flatMap(() => percBar('G2', [1, 3])) },
  ],
};

// ---------------------------------------------------------------------------
// VICTORY — short triumphant fanfare (non-loop), G major, 120 bpm, 6 bars.
// ---------------------------------------------------------------------------
const VICTORY = {
  bpm: 120,
  loop: false,
  voices: [
    { id: 'fanfare', type: 'square', gain: 0.10, releaseMs: 120,
      steps: seq(
        [['G4', 0.5], ['G4', 0.5], ['G4', 1], ['B4', 1], ['D5', 1]],
        [['E5', 2], ['D5', 1], ['B4', 1]],
        [['C5', 0.5], ['D5', 0.5], ['E5', 1], ['D5', 1], ['B4', 1]],
        [['A4', 1], ['B4', 1], ['C5', 1], ['A4', 1]],
        [['G4', 0.5], ['A4', 0.5], ['B4', 1], ['D5', 2]],
        [['G5', 3], [null, 1]],
      ) },
    { id: 'pad', type: 'sawtooth', gain: 0.05, detune: 12, filterHz: 800, attackMs: 200, releaseMs: 500,
      steps: seq(bar('B4'), bar('C5'), bar('C5'), bar('D5'), bar('B4'), bar('B4')) },
    { id: 'bass', type: 'triangle', gain: 0.08, releaseMs: 150,
      steps: seq(bar('G2'), bar('C3'), bar('C3'), bar('D3'), bar('G2', 2), bar('D3', 2), bar('G2')) },
    { id: 'bells', type: 'triangle', gain: 0.06, releaseMs: 250,
      steps: seq(rest(8), rest(3), [['G5', 1]], rest(4), rest(2), [['D5', 0.5], ['E5', 0.5], ['G5', 1]], rest(4)) },
  ],
};

export const TRACKS = {
  explore: EXPLORE,
  boss: BOSS,
  town: TOWN,
  victory: VICTORY,
};

export const TRACK_NAMES = Object.keys(TRACKS);
