// Sky Team — alles zum Erklären: Einweisung vor dem ersten Flug, Hinweise, die
// im richtigen Moment aufpoppen, und ein Nachschlagewerk fürs Cockpit.
//
// Kein DOM hier drin, nur Text und die Frage „passt das gerade?“.

import {
  PILOT, KOPILOT, FLUGLAGE_GRENZE, KAFFEE_MAX, BREMSWERTE, AERO_START,
  FAHRWERK_WERTE, KLAPPEN_WERTE, BREMSEN_WERTE,
  bremswert, istLanderunde, windAufschlag,
} from './engine.js';

/* ------------------------------------------------ Einweisung vor dem Start */

/** Die Karten, die vor dem allerersten Flug durchgeblättert werden. */
export const EINWEISUNG = [
  {
    bild: 'crew',
    titel: 'Ihr fliegt zusammen',
    text: `Einer sitzt links und ist <b>Pilot</b>, einer rechts und ist <b>Kopilot</b>.
      Ihr spielt nicht gegeneinander, sondern gemeinsam gegen das Flugzeug.
      Ihr landet zusammen — oder ihr stürzt zusammen ab.`,
  },
  {
    bild: 'schweigen',
    titel: 'Und ihr schweigt dabei',
    text: `Sobald die Würfel liegen, wird <b>kein Wort</b> mehr gesagt. Keine Zahlen,
      keine Andeutungen, kein „mach du mal“. Geredet wird nur im Briefing zwischen
      den Runden — da dürft ihr alles besprechen.`,
  },
  {
    bild: 'wuerfel',
    titel: 'Vier Würfel, verdeckt',
    text: `Jede Runde wirft jeder <b>vier Würfel</b>, hinter seinem Sichtschirm.
      Du siehst nur deine. Dann legt ihr <b>abwechselnd je einen Würfel</b> auf ein
      Feld eurer Seite des Cockpits.`,
  },
  {
    bild: 'panel',
    titel: 'Gelegte Würfel liegen offen',
    text: `Das ist euer einziger Draht zueinander: Was schon im Cockpit liegt,
      sieht die andere Seite. Wer als Zweiter ans Ruder geht, kann also
      <b>genau darauf antworten</b>. Nutzt das.`,
  },
  {
    bild: 'pflicht',
    titel: 'Zwei Felder sind Pflicht',
    text: `<b>Ruder</b> und <b>Schub</b> müssen jede Runde von <em>beiden</em> belegt werden —
      sonst stürzt ihr ab. Die App legt dir dafür automatisch genug Würfel beiseite.
      Was übrig bleibt, ist frei.`,
  },
  {
    bild: 'sinken',
    titel: 'Jede Runde 1000 Fuß tiefer',
    text: `Sind alle acht Würfel gelegt, wird ausgewertet und das Flugzeug sinkt.
      Bei <b>0 Fuß</b> setzt ihr auf — ob es passt oder nicht. Wie viele Runden ihr
      habt, sagt euch die Höhe beim Start.`,
  },
  {
    bild: 'ziel',
    titel: 'Was am Ende stimmen muss',
    text: `Genau auf der Landebahn · Flugzeug <b>waagerecht</b> · Fahrwerk und Klappen
      komplett draußen · kein fremdes Flugzeug mehr im Weg · und <b>langsam genug</b>
      für eure Bremsen. Fünf Häkchen. Alle fünf.`,
  },
];

/* ------------------------------------------------------ Hinweise im Spiel */

const feldOffen = (s, id) => s.belegt[id] === undefined;

/**
 * Hinweise, die genau dann kommen, wenn das Thema zum ersten Mal dran ist.
 * `wann(s, k)` bekommt den Spielstand und ein bisschen Oberflächenkontext.
 * Jeder Hinweis erscheint einmal und wird dann weggehakt.
 */
export const HINWEISE = [
  {
    id: 'ruder',
    titel: 'Das Ruder',
    text: `Ruder links und Ruder rechts sind <b>Pflicht</b>. Die <b>Differenz</b> der beiden
      Würfel kippt das Flugzeug: Wer die höhere Zahl legt, zu dem kippt es.
      Gleiche Zahlen heißen: alles bleibt, wie es ist.`,
    wann: (s) => s.phase === 'setzen' && s.runde === 1,
  },
  {
    id: 'antwort',
    titel: 'Jetzt antworten',
    text: `Die andere Seite hat das Ruder schon belegt — du siehst die Zahl.
      Legst du <b>dieselbe</b>, bleibt das Flugzeug waagerecht. Genau so redet ihr
      miteinander, ohne zu reden.`,
    wann: (s, k) => s.phase === 'setzen' && feldOffen(s, k.meinAchse) && !feldOffen(s, k.fremdAchse),
  },
  {
    id: 'schub',
    titel: 'Der Schub',
    text: `Beide Schubwürfel werden <b>addiert</b>. Die Summe sagt, wie weit ihr fliegt:
      bis ${AERO_START.blau} gar nicht, bis ${AERO_START.orange} ein Feld, darüber zwei.
      Schau auf die Skala — die Grenzen verschieben sich im Lauf des Flugs.`,
    wann: (s, k) => s.phase === 'setzen' && feldOffen(s, k.meinMotor) && !feldOffen(s, k.meinAchse),
  },
  {
    id: 'traegheit',
    titel: 'Das Flugzeug wird träger',
    text: `Jedes Fahrwerk schiebt die <b>blaue</b> Grenze nach rechts, jede Klappe die
      <b>orange</b>: mehr Schub für dieselbe Strecke — dafür leichter stehen bleiben.`,
    wann: (s) => s.aero.blau > AERO_START.blau || s.aero.orange > AERO_START.orange,
  },
  {
    id: 'bremse',
    titel: 'Bremsen sind Gold',
    text: `Genau eine <b>2</b>, dann eine <b>4</b>, dann eine <b>6</b> — in dieser Reihenfolge.
      Jede hebt euer Landetempo: ${BREMSWERTE.join(' → ')}. Ohne Bremsen keine Landung.`,
    wann: (s, k) => s.phase === 'setzen' && k.ich === PILOT && s.bremsen[0] === false && s.runde <= 2,
  },
  {
    id: 'funk',
    titel: 'Funk räumt den Weg',
    text: `Ein Würfel auf dem Funkfeld nimmt die fremde Maschine weg, die <b>genau
      so viele Felder</b> voraus steht, wie der Würfel zeigt. Fliegt dort nichts,
      war der Würfel umsonst.`,
    wann: (s) => s.phase === 'setzen' && s.flugzeuge.length > 0,
  },
  {
    id: 'kollision',
    titel: 'Da steht wer im Weg',
    text: `Direkt vor euch ist eine fremde Maschine. Fliegt ihr auf ihr Feld, war's das.
      Entweder ihr funkt sie weg — oder ihr bleibt diese Runde stehen.`,
    wann: (s) => s.phase === 'setzen' && s.flugzeuge.includes(s.position + 1),
  },
  {
    id: 'kaffee',
    titel: 'Kaffee verschiebt Würfel',
    text: `Für eine Tasse darfst du einen eigenen Würfel um <b>±1</b> verändern.
      Höchstens ${KAFFEE_MAX} Tassen auf Vorrat. Hebt euch mindestens eine für die
      Landerunde auf — dort zählt jeder einzelne Punkt.`,
    wann: (s) => s.kaffee > 0,
  },
  {
    id: 'neuwurf',
    titel: 'Der Neuwurf',
    text: `Zweimal pro Flug dürft ihr <b>alle</b> noch nicht gelegten Würfel neu werfen —
      beide Seiten gleichzeitig. Das ist eure Notbremse, wenn ein Wurf gar nichts hergibt.`,
    wann: (s) => s.phase === 'setzen' && s.runde >= 2 && s.neuwurf > 0,
  },
  {
    id: 'wind',
    titel: 'Böiger Wind',
    text: `Hier bläst es von der Seite. Solange ihr <b>waagerecht</b> fliegt, merkt ihr
      nichts. Liegt das Flugzeug schräg, kommt die Schräglage als Tempo obendrauf —
      und macht euch schneller, als euch lieb ist.`,
    wann: (s) => s.wind && s.phase === 'setzen',
  },
  {
    id: 'schraeg',
    titel: 'Achtung, Schräglage',
    text: `Das Flugzeug liegt schief. Ab <b>±${FLUGLAGE_GRENZE + 1}</b> trudelt es und ihr habt
      verloren. Und zum Landen muss es <b>exakt waagerecht</b> sein — korrigiert das
      lieber jetzt als später.`,
    wann: (s) => Math.abs(s.fluglage) >= 1 && s.phase === 'setzen',
  },
  {
    id: 'zuletzt',
    titel: 'Die Landerunde',
    text: `Jetzt wird nicht mehr geflogen, jetzt wird nur noch stillgehalten.
      Der Schub muss auf <b>höchstens ${'%BREMSE%'}</b> kommen, sonst bremst ihr nicht
      rechtzeitig. Und das Ruder muss die Lage auf <b>0</b> bringen.`,
    wann: (s) => s.phase === 'setzen' && istLanderunde(s),
  },
  {
    id: 'ankunft',
    titel: 'Ihr seid da',
    text: `Ihr steht auf der Landebahn. Ab jetzt gilt: <b>keinen Meter weiter</b>.
      Haltet die Schubsumme unter der blauen Grenze — und macht das Cockpit fertig:
      Fahrwerk, Klappen, Bremsen.`,
    wann: (s) => s.position >= s.anflugLaenge && !istLanderunde(s) && s.phase === 'setzen',
  },
];

/** Der nächste Hinweis, der dran ist — oder null. */
export function naechsterHinweis(s, kontext, gesehen) {
  for (const h of HINWEISE) {
    if (gesehen.includes(h.id)) continue;
    if (!h.wann(s, kontext)) continue;
    return { ...h, text: h.text.replace('%BREMSE%', String(bremswert(s))) };
  }
  return null;
}

/* --------------------------------------------------------- Nachschlagewerk */

const reihe = (werte) => werte.map((w) => w.join(' oder ')).join(' · ');

/** Was ist was im Cockpit — für das Info-Menü und den Erklärmodus. */
export const LEXIKON = [
  {
    gruppe: 'achse',
    titel: 'Ruder',
    wer: 'beide, jede Runde Pflicht',
    kurz: 'Die Differenz beider Würfel kippt das Flugzeug.',
    lang: `Wer die höhere Zahl legt, zu dem kippt das Flugzeug — um so viele Striche,
      wie die Zahlen auseinanderliegen. Das bleibt liegen und summiert sich über die
      Runden. Ab <b>±${FLUGLAGE_GRENZE + 1}</b> trudelt ihr. Zum Landen muss die Lage <b>0</b> sein.`,
  },
  {
    gruppe: 'motor',
    titel: 'Schub',
    wer: 'beide, jede Runde Pflicht',
    kurz: 'Die Summe beider Würfel bestimmt die Strecke.',
    lang: `Summe bis zur <b>blauen</b> Marke: ihr bleibt stehen. Bis zur <b>orangen</b>:
      ein Feld. Darüber: zwei Felder. Zu Beginn stehen die Marken bei
      ${AERO_START.blau} und ${AERO_START.orange}; Fahrwerk und Klappen schieben sie
      nach rechts.`,
  },
  {
    gruppe: 'fahrwerk',
    titel: 'Fahrwerk',
    wer: 'Pilot · 3 Schalter',
    kurz: `Verlangt ${reihe(FAHRWERK_WERTE)} — in beliebiger Reihenfolge.`,
    lang: `Muss zur Landung <b>komplett</b> ausgefahren sein. Jedes Rad schiebt die
      <b>blaue</b> Marke ein Feld nach rechts: ihr werdet langsamer, könnt aber
      leichter stehen bleiben.`,
  },
  {
    gruppe: 'klappe',
    titel: 'Landeklappen',
    wer: 'Kopilot · 4 Schalter',
    kurz: `Verlangt ${reihe(KLAPPEN_WERTE)} — streng der Reihe nach.`,
    lang: `Muss zur Landung <b>komplett</b> ausgefahren sein. Jede Klappe schiebt die
      <b>orange</b> Marke ein Feld nach rechts — Zwei-Felder-Sprünge werden damit
      immer unwahrscheinlicher.`,
  },
  {
    gruppe: 'bremse',
    titel: 'Bremsen',
    wer: 'Pilot · 3 Schalter',
    kurz: `Verlangt genau ${BREMSEN_WERTE.map((v) => v[0]).join(', dann ')}.`,
    lang: `Jede Bremse hebt das Tempo, das ihr beim Aufsetzen noch verkraftet:
      ${BREMSWERTE.join(' → ')}. Ohne Bremsen ist keine Landung möglich —
      das ist der engste Punkt des ganzen Spiels.`,
  },
  {
    gruppe: 'funk',
    titel: 'Funk',
    wer: 'Pilot 1× · Kopilot 2×',
    kurz: 'Räumt die fremde Maschine weg, die genau so weit voraus steht.',
    lang: `Der Würfelwert ist die <b>Entfernung</b>: eine 3 nimmt die Maschine drei
      Felder voraus weg. Steht dort nichts, passiert nichts. Fremde Maschinen müssen
      alle weg sein, bevor ihr landen dürft — und wer in eine hineinfliegt, verliert
      sofort.`,
  },
  {
    gruppe: 'kaffee',
    titel: 'Kaffee',
    wer: 'beide · je 1 Feld',
    kurz: `Sammelt eine Tasse, höchstens ${KAFFEE_MAX} auf Vorrat.`,
    lang: `Eine Tasse verschiebt einen deiner Würfel um <b>±1</b> (nicht über 6, nicht
      unter 1). Das Kaffeefeld nimmt jede Augenzahl — dafür ist es der Platz für
      Würfel, mit denen sonst nichts anzufangen ist.`,
  },
];

export const lexikonFuer = (gruppe) => LEXIKON.find((e) => e.gruppe === gruppe) || null;

/* ------------------------------------------------------ Lage in Worten */

/** Ein Satz, der sagt, worauf es diese Runde ankommt. */
export function ratschlag(s, ich) {
  const rest = s.anflugLaenge - s.position;
  const w = windAufschlag(s);
  if (istLanderunde(s)) {
    return `Landerunde: Schub zusammen höchstens <b>${bremswert(s)}</b>${
      w ? ` (der Wind legt gerade ${w} drauf)` : ''}, Ruder gleich hoch, Lage auf 0.`;
  }
  if (rest === 0) return 'Ihr seid auf der Bahn — jetzt nur noch stehen bleiben und fertig machen.';
  const rundenUebrig = s.runden - s.runde;
  if (rest > rundenUebrig * 2) return 'Zu weit weg: Ihr braucht Zwei-Felder-Sprünge, also viel Schub.';
  if (rest > rundenUebrig) return 'Es ist knapp — mindestens ein Feld pro Runde.';
  return `Noch ${rest} Feld${rest === 1 ? '' : 'er'} in ${rundenUebrig} Runden. Zeit für die Schalter.`;
}
