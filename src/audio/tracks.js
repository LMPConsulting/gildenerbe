// Chiptune note data for Gildenerbe's looping themes — pure data, no audio
// objects, safe to import anywhere (including Node tests).
//
// Format: each track has { bpm, loop, voices }. A voice is one melodic line
// for synth.playSequence: { id, type, gain, steps } where steps are
// [note, beats] tuples ('C4'-style names, null = rest). All voices of a track
// have the same total beat count so loops stay locked together.

// One bar of driving eighth notes (lo lo hi lo lo hi lo hi) — boss bass.
const pulseBar = (lo, hi) => [lo, lo, hi, lo, lo, hi, lo, hi].map((n) => [n, 0.5]);

// ---------------------------------------------------------------------------
// EXPLORE — calm wandering theme. G major, 16 bars of 4/4 at 84 bpm.
// Soft triangle lead over a slow root–fifth square bass.
// ---------------------------------------------------------------------------
const EXPLORE = {
  bpm: 84,
  loop: true,
  voices: [
    {
      id: 'lead',
      type: 'triangle',
      gain: 0.15,
      steps: [
        // Phrase A (bars 1–8)
        ['D4', 1], ['G4', 1], ['A4', 1], ['B4', 1],
        ['A4', 2], ['G4', 1], ['E4', 1],
        ['G4', 1], ['A4', 1], ['B4', 1], ['D5', 1],
        ['B4', 3], [null, 1],
        ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1],
        ['A4', 2], ['B4', 1], ['G4', 1],
        ['E4', 1], ['G4', 1], ['A4', 1], ['F#4', 1],
        ['G4', 3], [null, 1],
        // Phrase B (bars 9–16) — answer, reaching higher
        ['D5', 1], ['B4', 1], ['G4', 1], ['B4', 1],
        ['C5', 2], ['A4', 2],
        ['B4', 1], ['D5', 1], ['E5', 1], ['D5', 1],
        ['B4', 3], [null, 1],
        ['C5', 1], ['E5', 1], ['D5', 1], ['B4', 1],
        ['A4', 2], ['G4', 1], ['A4', 1],
        ['B4', 1], ['A4', 1], ['F#4', 1], ['A4', 1],
        ['G4', 4],
      ],
    },
    {
      id: 'bass',
      type: 'square',
      gain: 0.045,
      steps: [
        // G | Em | G | G | C | D | C->D | G
        ['G2', 2], ['D3', 2],
        ['E2', 2], ['B2', 2],
        ['G2', 2], ['D3', 2],
        ['G2', 2], ['B2', 2],
        ['C3', 2], ['G2', 2],
        ['D3', 2], ['A2', 2],
        ['C3', 2], ['D3', 2],
        ['G2', 2], ['D3', 2],
        // G | C | G | Em | C | D | D | G
        ['G2', 2], ['D3', 2],
        ['C3', 2], ['G2', 2],
        ['G2', 2], ['B2', 2],
        ['E2', 2], ['B2', 2],
        ['C3', 2], ['E3', 2],
        ['D3', 2], ['A2', 2],
        ['D3', 2], ['A2', 2],
        ['G2', 2], ['D2', 2],
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// BOSS — tense battle theme. A minor, 8 bars of 4/4 at 150 bpm.
// Stabbing square lead with chromatic tension over a relentless triangle pulse.
// ---------------------------------------------------------------------------
const BOSS = {
  bpm: 150,
  loop: true,
  voices: [
    {
      id: 'lead',
      type: 'square',
      gain: 0.085,
      steps: [
        ['A4', 0.5], ['A4', 0.5], ['C5', 0.5], ['A4', 0.5], ['E5', 1], ['D#5', 1],
        ['E5', 0.5], ['D5', 0.5], ['C5', 0.5], ['B4', 0.5], ['C5', 1], ['A4', 1],
        ['F4', 0.5], ['F4', 0.5], ['A4', 0.5], ['F4', 0.5], ['C5', 1], ['B4', 1],
        ['G#4', 0.5], ['A4', 0.5], ['B4', 0.5], ['G#4', 0.5], ['E4', 2],
        ['A4', 0.5], ['A4', 0.5], ['C5', 0.5], ['A4', 0.5], ['E5', 1], ['F5', 1],
        ['E5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 1], ['D5', 1],
        ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 0.5], ['B4', 1], ['G#4', 1],
        ['A4', 0.5], ['E4', 0.5], ['A4', 0.5], ['B4', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 0.5], ['G#4', 0.5],
      ],
    },
    {
      id: 'bass',
      type: 'triangle',
      gain: 0.17,
      steps: [
        // Am | Am | F | E | Am | Dm | E | Am->E
        ...pulseBar('A2', 'A3'),
        ...pulseBar('A2', 'A3'),
        ...pulseBar('F2', 'F3'),
        ...pulseBar('E2', 'E3'),
        ...pulseBar('A2', 'A3'),
        ...pulseBar('D2', 'D3'),
        ...pulseBar('E2', 'E3'),
        ['A2', 0.5], ['A2', 0.5], ['E2', 0.5], ['E2', 0.5], ['A2', 0.5], ['A2', 0.5], ['E2', 0.5], ['E2', 0.5],
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// TOWN — cozy tavern waltz. C major, 16 bars of 3/4 at 100 bpm.
// Gentle triangle melody over an oom-pah-pah square bass.
// ---------------------------------------------------------------------------
const TOWN = {
  bpm: 100,
  loop: true,
  voices: [
    {
      id: 'lead',
      type: 'triangle',
      gain: 0.14,
      steps: [
        ['E4', 1], ['G4', 1], ['C5', 1],
        ['G4', 2], ['E4', 1],
        ['F4', 1], ['A4', 1], ['C5', 1],
        ['A4', 2], ['F4', 1],
        ['G4', 1], ['B4', 1], ['D5', 1],
        ['C5', 2], ['G4', 1],
        ['A4', 1], ['G4', 1], ['F4', 1],
        ['E4', 2], [null, 1],
        ['E4', 1], ['G4', 1], ['C5', 1],
        ['G4', 2], ['A4', 1],
        ['F4', 1], ['A4', 1], ['C5', 1],
        ['D5', 2], ['C5', 1],
        ['B4', 1], ['D5', 1], ['G4', 1],
        ['A4', 1], ['B4', 1], ['C5', 1],
        ['D5', 1], ['B4', 1], ['G4', 1],
        ['C5', 3],
      ],
    },
    {
      id: 'bass',
      type: 'square',
      gain: 0.04,
      steps: [
        // C | C | F | F | G | C | F | C  (oom-pah-pah)
        ['C3', 1], ['E3', 1], ['G3', 1],
        ['C3', 1], ['G3', 1], ['E3', 1],
        ['F2', 1], ['A2', 1], ['C3', 1],
        ['F2', 1], ['C3', 1], ['A2', 1],
        ['G2', 1], ['B2', 1], ['D3', 1],
        ['C3', 1], ['E3', 1], ['G3', 1],
        ['F2', 1], ['A2', 1], ['C3', 1],
        ['C3', 1], ['G2', 1], ['C3', 1],
        // C | C | F | G | G | Am | G | C
        ['C3', 1], ['E3', 1], ['G3', 1],
        ['C3', 1], ['G3', 1], ['E3', 1],
        ['F2', 1], ['A2', 1], ['C3', 1],
        ['G2', 1], ['B2', 1], ['D3', 1],
        ['G2', 1], ['D3', 1], ['B2', 1],
        ['A2', 1], ['C3', 1], ['E3', 1],
        ['G2', 1], ['B2', 1], ['D3', 1],
        ['C3', 1], ['G2', 1], ['C2', 1],
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// VICTORY — short triumphant fanfare, plays once (no loop). ~2.7 s at 132 bpm.
// ---------------------------------------------------------------------------
const VICTORY = {
  bpm: 132,
  loop: false,
  voices: [
    {
      id: 'lead',
      type: 'square',
      gain: 0.1,
      steps: [
        ['C5', 0.5], ['C5', 0.5], ['C5', 0.5], ['E5', 0.5], ['G5', 1.5], ['C6', 2.5],
      ],
    },
    {
      id: 'bass',
      type: 'triangle',
      gain: 0.16,
      steps: [
        ['C3', 1], ['G2', 1], ['C3', 1], ['G2', 1], ['C3', 2],
      ],
    },
  ],
};

export const TRACKS = {
  explore: EXPLORE,
  boss: BOSS,
  town: TOWN,
  victory: VICTORY,
};

export const TRACK_NAMES = Object.keys(TRACKS);
