// Das Wegenetz der Sperrsteine. Reine Daten und Geometrie, kein DOM.
//
// Vorbild ist Malefiz/Barricade (Ravensburger, 1960). Die Regeln sind frei,
// Name und Brettgestaltung nicht — dieses Brett ist darum ein eigener Entwurf.
//
// Aufbau: es wechseln sich **Straßen** (lange waagerechte Reihen, auf denen man
// sich frei hin und her bewegt) und **Leitern** (wenige senkrechte Übergänge)
// ab. Nur so wird eine Sperre gefährlich: eine Leiter ist ein Nadelöhr, eine
// Straße nicht.
//
//   Reihe  0                     Z                 Ziel
//   Reihe  1                o    o    o
//   Reihe  2      o    o    o    o    o    o    o  Straße
//   Reihe  3      o              o              o  Leitern
//   Reihe  4   o o o o o o o o o o o              Straße
//   Reihe  5   o         o         o         o     Leitern
//   Reihe  6   o o o o o o o o o o o              Straße
//   Reihe  7      o              o              o  Leitern
//   Reihe  8   o o o o o o o o o o o              Straße
//   Reihe  9   o         o         o         o     Leitern
//   Reihe 10   o o o o o o o o o o o              unterste Straße
//   Reihe 11   A A A A A   B B B B B              Heimfelder
//
// Zwei Entwurfsentscheidungen, die nicht Kosmetik sind:
//
// 1. **Das Ziel hängt an drei Wegen** (1/4, 1/5 und 1/6 — die äußeren beiden
//    schräg). Hinge es nur an 1/5, könnte ein einziger Stein das Spiel
//    zusperren und beide Seiten müssten warten, bis jemand genau trifft.
// 2. **Das Brett ist spiegelsymmetrisch.** Beim Original stehen vier Spieler
//    nebeneinander am unteren Rand und haben verschieden weite Wege. Zu zweit
//    ist Gleichstand besser: 16 bzw. 17 Schritte, für beide dieselben.

export const REIHEN = 12;
export const SPALTEN = 11;
export const UNTERSTE_STRASSE = 10;      // Reihe direkt über den Heimfeldern

/** Welche Spalten in welcher Reihe ein Feld tragen. */
const STRASSE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REIHENPLAN = [
  [5],                                   //  0  Ziel
  [4, 5, 6],                             //  1
  [2, 3, 4, 5, 6, 7, 8],                 //  2  Straße
  [2, 5, 8],                             //  3  Leitern
  STRASSE,                               //  4  Straße
  [0, 3, 7, 10],                         //  5  Leitern
  STRASSE,                               //  6  Straße
  [2, 5, 8],                             //  7  Leitern
  STRASSE,                               //  8  Straße
  [0, 3, 7, 10],                         //  9  Leitern
  STRASSE,                               // 10  unterste Straße
  [0, 1, 2, 3, 4, 6, 7, 8, 9, 10],       // 11  Heimfelder, Mitte bleibt frei
];

/* --------------------------------------------------------------- Aufbau */

const felder = [];
const nummer = new Map();                // "reihe/spalte" -> id

REIHENPLAN.forEach((spalten, reihe) => {
  for (const spalte of spalten) {
    const art = reihe === 0 ? 'ziel' : reihe === REIHEN - 1 ? 'heim' : 'weg';
    nummer.set(`${reihe}/${spalte}`, felder.length);
    felder.push({ id: felder.length, reihe, spalte, art });
  }
});

export const FELDER = felder;

/** Feldnummer aus Reihe und Spalte, oder -1 wenn dort keins liegt. */
export const feldId = (reihe, spalte) => {
  const id = nummer.get(`${reihe}/${spalte}`);
  return id === undefined ? -1 : id;
};

export const ZIEL = feldId(0, 5);

// Unten links Spieler 0, unten rechts Spieler 1 — und zwar **in gespiegelter
// Reihenfolge**. Damit ist Figur i der einen Seite das exakte Spiegelbild von
// Figur i der anderen. Das ist keine Kosmetik: die Heimfelder sind verschieden
// weit vom Ziel entfernt (16, 17, 16, 15, 16). Zählte man beide Seiten von
// links nach rechts durch, bekäme eine geschlagene Figur der einen Seite
// systematisch ein besseres Feld zurück als die der anderen — in der Messung
// waren das rund 6 Prozentpunkte Siegquote aus dem Nichts.
export const HEIM = [
  [0, 1, 2, 3, 4].map((c) => feldId(REIHEN - 1, c)),
  [10, 9, 8, 7, 6].map((c) => feldId(REIHEN - 1, c)),
];

/* ---------------------------------------------------------- Verbindungen */

const kanten = felder.map(() => []);
const verbinden = (a, b) => {
  if (a < 0 || b < 0 || a === b) return;
  if (!kanten[a].includes(b)) kanten[a].push(b);
  if (!kanten[b].includes(a)) kanten[b].push(a);
};

REIHENPLAN.forEach((spalten, reihe) => {
  const heimreihe = reihe === REIHEN - 1;
  for (const spalte of spalten) {
    // Waagerecht nur zwischen unmittelbar benachbarten Spalten — aber nicht in
    // der Heimreihe: dort soll jedes Feld an genau einer Straße hängen. Darauf
    // beruht die Regel, dass auf der untersten Straße kein Stein stehen darf.
    if (!heimreihe) verbinden(feldId(reihe, spalte), feldId(reihe, spalte + 1));
    // senkrecht in die Reihe darunter, wo dort ebenfalls ein Feld liegt
    verbinden(feldId(reihe, spalte), feldId(reihe + 1, spalte));
  }
});

// Die beiden schrägen Zugänge zum Ziel.
verbinden(ZIEL, feldId(1, 4));
verbinden(ZIEL, feldId(1, 6));

export const NACHBARN = kanten.map((liste) => liste.slice().sort((a, b) => a - b));

/* -------------------------------------------------- Entfernung zum Ziel */

// Ohne Rücksicht auf Sperren und Figuren — dient der Anzeige und dem
// Selbstspieler, nicht der Regel.
const entfernung = felder.map(() => Infinity);
entfernung[ZIEL] = 0;
for (let welle = [ZIEL]; welle.length;) {
  const naechste = [];
  for (const id of welle) {
    for (const n of NACHBARN[id]) {
      if (entfernung[n] === Infinity) { entfernung[n] = entfernung[id] + 1; naechste.push(n); }
    }
  }
  welle = naechste;
}

export const zumZiel = (id) => entfernung[id];

/** Mittelpunkt eines Feldes im Zeichenraster. */
export const mitte = (id, zelle = 10) => {
  const x = FELDER[id].spalte * zelle + zelle / 2;
  const y = FELDER[id].reihe * zelle + zelle / 2;
  return [x, y];
};

/* ------------------------------------------------------------- Sperren */

// Elf Steine auf den Leiterreihen: drei Mauern zwischen Heimat und Ziel,
// dazu der mittlere Zugang ganz oben. Spiegelsymmetrisch, damit keine Seite
// leichter durchkommt.
export const START_SPERREN = [
  ...[2, 5, 8].map((c) => feldId(7, c)),
  ...[0, 3, 7, 10].map((c) => feldId(5, c)),
  ...[2, 5, 8].map((c) => feldId(3, c)),
  feldId(1, 5),
];
