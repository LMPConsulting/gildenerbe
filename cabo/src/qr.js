// Minimaler QR-Erzeuger: Byte-Modus, Fehlerkorrektur L, Versionen 1 bis 15.
// Eigenbau, weil das Spiel eine einzelne Datei ohne Netz bleiben soll.
//
// qrMatrix('text') -> { groesse, module: boolean[][] }   true = dunkel

// [Gesamt-Codewörter, EC-Codewörter je Block, [Blöcke, Datenwörter], [Blöcke, Datenwörter]?]
const VERSIONEN = {
  1: [26, 7, [1, 19]],
  2: [44, 10, [1, 34]],
  3: [70, 15, [1, 55]],
  4: [100, 20, [1, 80]],
  5: [134, 26, [1, 108]],
  6: [172, 18, [2, 68]],
  7: [196, 20, [2, 78]],
  8: [242, 24, [2, 97]],
  9: [292, 30, [2, 116]],
  10: [346, 18, [2, 68], [2, 69]],
  11: [404, 20, [4, 81]],
  12: [466, 24, [2, 92], [2, 93]],
  13: [532, 26, [4, 107]],
  14: [581, 30, [3, 115], [1, 116]],
  15: [655, 22, [5, 87], [1, 88]],
};

const AUSRICHTUNG = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
  15: [6, 26, 48, 70],
};

/* ------------------------------------------------------- Galois-Feld GF(256) */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function tabellen() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(grad) {
  let g = [1];
  for (let i = 0; i < grad; i++) {
    const next = new Array(g.length + 1).fill(0);
    // Multiplikation mit (x + α^i): der x-Anteil bleibt an Ort und Stelle,
    // der Faktor rutscht eine Stelle nach unten. Führender Koeffizient bleibt 1.
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** Reed-Solomon-Rest: die Fehlerkorrektur-Codewörter eines Blocks. */
function ecBlock(daten, ecAnzahl) {
  const g = generator(ecAnzahl);
  const rest = new Array(ecAnzahl).fill(0);
  for (const wort of daten) {
    const faktor = wort ^ rest[0];
    rest.shift();
    rest.push(0);
    if (faktor !== 0) for (let i = 0; i < ecAnzahl; i++) rest[i] ^= mul(g[i + 1], faktor);
  }
  return rest;
}

/* ------------------------------------------------------------- Datenkodierung */

function datenKapazitaet(version) {
  const [, , g1, g2] = VERSIONEN[version];
  return g1[0] * g1[1] + (g2 ? g2[0] * g2[1] : 0);
}

function versionWaehlen(byteLaenge) {
  for (let v = 1; v <= 15; v++) {
    const zaehlerBits = v < 10 ? 8 : 16;
    const noetig = Math.ceil((4 + zaehlerBits + byteLaenge * 8) / 8);
    if (noetig <= datenKapazitaet(v)) return v;
  }
  throw new Error('Text zu lang für einen QR-Code dieser Größe');
}

function codewoerter(bytes, version) {
  const zaehlerBits = version < 10 ? 8 : 16;
  const bits = [];
  const schiebe = (wert, anzahl) => {
    for (let i = anzahl - 1; i >= 0; i--) bits.push((wert >> i) & 1);
  };

  schiebe(0b0100, 4);              // Byte-Modus
  schiebe(bytes.length, zaehlerBits);
  for (const b of bytes) schiebe(b, 8);

  const kapazitaet = datenKapazitaet(version) * 8;
  for (let i = 0; i < 4 && bits.length < kapazitaet; i++) bits.push(0);   // Terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const worte = [];
  for (let i = 0; i < bits.length; i += 8) {
    worte.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  }
  const fueller = [0xec, 0x11];
  let f = 0;
  while (worte.length < datenKapazitaet(version)) worte.push(fueller[f++ % 2]);
  return worte;
}

/** Datenwörter in Blöcke schneiden, EC anhängen, beides verschachteln. */
function endgueltigeWoerter(daten, version) {
  const [, ecAnzahl, g1, g2] = VERSIONEN[version];
  const gruppen = g2 ? [g1, g2] : [g1];

  const datenBloecke = [];
  let pos = 0;
  for (const [anzahl, laenge] of gruppen) {
    for (let i = 0; i < anzahl; i++) {
      datenBloecke.push(daten.slice(pos, pos + laenge));
      pos += laenge;
    }
  }
  const ecBloecke = datenBloecke.map((b) => ecBlock(b, ecAnzahl));

  const raus = [];
  const maxDaten = Math.max(...datenBloecke.map((b) => b.length));
  for (let i = 0; i < maxDaten; i++) {
    for (const b of datenBloecke) if (i < b.length) raus.push(b[i]);
  }
  for (let i = 0; i < ecAnzahl; i++) for (const b of ecBloecke) raus.push(b[i]);
  return raus;
}

/* -------------------------------------------------------------- Matrixaufbau */

function leereMatrix(groesse) {
  return Array.from({ length: groesse }, () => new Array(groesse).fill(null));
}

function sucherSetzen(m, zeile, spalte) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = zeile + r;
      const x = spalte + c;
      if (y < 0 || y >= m.length || x < 0 || x >= m.length) continue;
      const imSucher = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      if (!imSucher) { m[y][x] = false; continue; }   // die helle Trennlinie ringsum
      const rahmen = r === 0 || r === 6 || c === 0 || c === 6;
      const kern = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      m[y][x] = rahmen || kern;
    }
  }
}

function funktionsMuster(version) {
  const groesse = version * 4 + 17;
  const m = leereMatrix(groesse);

  sucherSetzen(m, 0, 0);
  sucherSetzen(m, 0, groesse - 7);
  sucherSetzen(m, groesse - 7, 0);

  for (let i = 8; i < groesse - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  const zentren = AUSRICHTUNG[version];
  const letzte = zentren[zentren.length - 1];
  // Nur die drei Ecken entfallen — dort sitzen schon die Suchmuster. Muster,
  // die bloß die Taktspur kreuzen, werden gezeichnet.
  const beimSucher = (y, x) => (y === 6 && x === 6)
    || (y === 6 && x === letzte) || (y === letzte && x === 6);
  for (const zy of zentren) {
    for (const zx of zentren) {
      if (beimSucher(zy, zx)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          m[zy + r][zx + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  m[groesse - 8][8] = true;                       // immer dunkles Modul

  // Plätze für Format- und Versionsinfo freihalten (später überschrieben)
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][groesse - 1 - i] === null) m[8][groesse - 1 - i] = false;
    if (m[groesse - 1 - i][8] === null) m[groesse - 1 - i][8] = false;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        m[groesse - 11 + j][i] = false;
        m[i][groesse - 11 + j] = false;
      }
    }
  }
  return m;
}

/** Merkt sich, welche Felder zu Funktionsmustern gehören. */
function reserviert(version) {
  const m = funktionsMuster(version);
  return m.map((zeile) => zeile.map((wert) => wert !== null));
}

function datenSetzen(m, belegt, worte) {
  const groesse = m.length;
  const bits = [];
  for (const w of worte) for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);

  let bit = 0;
  let aufwaerts = true;
  for (let spalte = groesse - 1; spalte > 0; spalte -= 2) {
    if (spalte === 6) spalte -= 1;               // die senkrechte Taktspur überspringen
    for (let i = 0; i < groesse; i++) {
      const zeile = aufwaerts ? groesse - 1 - i : i;
      for (const s of [spalte, spalte - 1]) {
        if (belegt[zeile][s]) continue;
        m[zeile][s] = bit < bits.length ? bits[bit++] === 1 : false;
      }
    }
    aufwaerts = !aufwaerts;
  }
}

const MASKEN = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function strafe(m) {
  const n = m.length;
  let punkte = 0;

  // Regel 1: Ketten gleicher Farbe
  for (let i = 0; i < n; i++) {
    for (const waagrecht of [true, false]) {
      let lauf = 1;
      for (let j = 1; j < n; j++) {
        const a = waagrecht ? m[i][j] : m[j][i];
        const b = waagrecht ? m[i][j - 1] : m[j - 1][i];
        if (a === b) lauf++;
        else { if (lauf >= 5) punkte += 3 + (lauf - 5); lauf = 1; }
      }
      if (lauf >= 5) punkte += 3 + (lauf - 5);
    }
  }

  // Regel 2: gleichfarbige 2x2-Blöcke
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) punkte += 3;
    }
  }

  // Regel 3: sucherähnliche Folgen
  const muster = [true, false, true, true, true, false, true, false, false, false, false];
  const gedreht = muster.slice().reverse();
  const passt = (werte, soll) => soll.every((v, i) => werte[i] === v);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 11; j++) {
      const waagrecht = m[i].slice(j, j + 11);
      const senkrecht = Array.from({ length: 11 }, (_, k) => m[j + k][i]);
      for (const reihe of [waagrecht, senkrecht]) {
        if (passt(reihe, muster) || passt(reihe, gedreht)) punkte += 40;
      }
    }
  }

  // Regel 4: Abweichung vom Halbe-halbe-Verhältnis
  let dunkel = 0;
  for (const zeile of m) for (const v of zeile) if (v) dunkel++;
  const anteil = (dunkel * 100) / (n * n);
  punkte += Math.floor(Math.abs(anteil - 50) / 5) * 10;
  return punkte;
}

function formatBits(maske) {
  const daten = (0b01 << 3) | maske;             // Fehlerkorrektur L = 01
  let rest = daten << 10;
  for (let i = 14; i >= 10; i--) if ((rest >> i) & 1) rest ^= 0b10100110111 << (i - 10);
  return ((daten << 10) | rest) ^ 0b101010000010010;
}

function versionBits(version) {
  let rest = version << 12;
  for (let i = 17; i >= 12; i--) if ((rest >> i) & 1) rest ^= 0b1111100100101 << (i - 12);
  return (version << 12) | rest;
}

function infoSetzen(m, version, maske) {
  const n = m.length;
  const bits = formatBits(maske);
  // Die 15 Bits werden mit dem höchsten zuerst abgelegt, an zwei Stellen.
  const legen = (plaetze) => plaetze.forEach(([r, c], i) => {
    m[r][c] = ((bits >> (14 - i)) & 1) === 1;
  });

  legen([[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]);

  const zweite = [];
  for (let i = 1; i <= 7; i++) zweite.push([n - i, 8]);
  for (let i = 8; i >= 1; i--) zweite.push([8, n - i]);
  legen(zweite);

  m[n - 8][8] = true;                             // immer dunkles Modul

  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const wert = ((vb >> i) & 1) === 1;
      const zeile = Math.floor(i / 3);
      const spalte = i % 3;
      m[n - 11 + spalte][zeile] = wert;
      m[zeile][n - 11 + spalte] = wert;
    }
  }
}

export function qrMatrix(text, maskeErzwingen = null) {
  const bytes = new TextEncoder().encode(text);
  const version = versionWaehlen(bytes.length);
  const worte = endgueltigeWoerter(codewoerter(bytes, version), version);

  const belegt = reserviert(version);
  const roh = funktionsMuster(version);
  datenSetzen(roh, belegt, worte);

  let beste = null;
  for (let maske = 0; maske < 8; maske++) {
    if (maskeErzwingen !== null && maske !== maskeErzwingen) continue;
    const m = roh.map((zeile, r) => zeile.map((wert, c) => (
      belegt[r][c] ? wert : wert !== MASKEN[maske](r, c)
    )));
    infoSetzen(m, version, maske);
    const p = strafe(m);
    if (!beste || p < beste.punkte) beste = { punkte: p, module: m };
  }

  return { groesse: beste.module.length, version, module: beste.module };
}

/** Zeichnet den Code in ein Canvas — mit der vorgeschriebenen ruhigen Zone. */
export function qrZeichnen(canvas, text, { rand = 4, hell = '#f6f2e7', dunkel = '#16211e' } = {}) {
  const { groesse, module } = qrMatrix(text);
  const gesamt = groesse + rand * 2;
  const pixel = Math.max(1, Math.floor(canvas.width / gesamt));
  const kante = pixel * gesamt;

  canvas.width = kante;
  canvas.height = kante;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hell;
  ctx.fillRect(0, 0, kante, kante);
  ctx.fillStyle = dunkel;
  for (let r = 0; r < groesse; r++) {
    for (let c = 0; c < groesse; c++) {
      if (module[r][c]) ctx.fillRect((c + rand) * pixel, (r + rand) * pixel, pixel, pixel);
    }
  }
  return { groesse, kante };
}
