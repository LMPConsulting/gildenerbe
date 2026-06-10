// Kodex: das Nachschlagewerk im Spiel. Reine Daten — gerendert von
// ui/tutorialScreen.js (mountCodexScreen). Kurze, präzise Einträge auf Deutsch.
export const CODEX = [
  {
    id: 'spielschleife',
    title: 'Spielschleife',
    entries: [
      { term: 'Der Kreislauf', text: 'Held anwerben → Dungeon erkunden → Erbe ernten → Basis ausbauen → der nächste Held startet stärker. Jede Runde trägt dich weiter.' },
      { term: 'Tod = Ernte', text: 'Fällt dein Held, endet der Lauf — aber alle Taten werden voll zu Erbe. Kein Totalverlust, nur das nächste Kapitel.' },
      { term: 'Erbe', text: 'Die bleibende Währung deiner Gilde. Wächst mit Heldenstufe, Ausrüstungsqualität und gemeisterten Begegnungen — tiefer pushen lohnt sich immer.' },
    ],
  },
  {
    id: 'werte',
    title: 'Werte',
    entries: [
      { term: 'Stärke', text: '+2 Angriffskraft je Punkt. Mehr Wucht hinter jedem Hieb.' },
      { term: 'Beweglichkeit', text: 'Erhöht die Chance auf kritische Treffer (+0,05 % je Punkt). Flinke Helden treffen öfter ins Schwarze.' },
      { term: 'Ausdauer', text: '+10 Lebenspunkte je Punkt. Dein Polster gegen den Heldentod.' },
      { term: 'Rüstung', text: 'Mindert erlittenen Schaden prozentual. Gegen stärkere Gegner braucht dieselbe Minderung mehr Rüstung (Deckel: 75 %).' },
      { term: 'Kritischer Treffer', text: 'Doppelter Schaden. Basis 5 % Chance, mehr durch Beweglichkeit und Ausrüstung.' },
      { term: 'Waffenschaden', text: 'Der Grundwert deiner Angriffe. Alle Fähigkeiten skalieren daraus — eine bessere Waffe hebt alles.' },
      { term: 'Wut', text: 'Baut sich durch Treffer auf — ausgeteilte wie erlittene. Fähigkeiten kosten Wut: erst prügeln, dann entfesseln.' },
    ],
  },
  {
    id: 'kampf',
    title: 'Kampf',
    entries: [
      { term: 'Bewegen', text: 'Virtueller Joystick links unten. Positionierung gewinnt Kämpfe — wer richtig steht, wird seltener getroffen.' },
      { term: 'Auto-Angriff', text: 'Berührst du einen Gegner, schlägt dein Held von selbst zu und lädt dabei Wut auf.' },
      { term: 'Fähigkeiten', text: 'Buttons rechts unten antippen. Achte auf Wutkosten und Abklingzeit.' },
      { term: 'Krieger-Kit', text: 'Heldenhafter Stoß (harter Einzelschlag), Wirbelwind (trifft alle), Schildblock (mildert den nächsten Treffer), Hinrichten (Finisher unter 20 % LP).' },
      { term: 'Boss-Telegraphen', text: 'Rote Bodenflächen zeigen, wo der Boss gleich zuschlägt. RAUSLAUFEN — oder den Treffer mit Schildblock abfangen.' },
      { term: 'Fliehen', text: 'Wird es brenzlig, renn zum Ausgang. Etwas Beute geht verloren, aber der Held überlebt.' },
    ],
  },
  {
    id: 'beute',
    title: 'Beute',
    entries: [
      { term: 'Seltenheit', text: 'Grau → Weiß → Grün → Blau → Lila → Orange. Je weiter rechts, desto mehr Affixe und desto wertvoller das Teil.' },
      { term: 'Affixe', text: 'Bonuswerte wie „der Stärke" oder „des Schlächters". Höhere Seltenheit = mehr Affixe pro Item.' },
      { term: 'Anlegen', text: 'Im Helden-Schirm vergleichen und ausrüsten. Grüne Zahlen heißen: anziehen!' },
      { term: 'Verzaubern', text: 'Löse das Runen-Puzzle in der Werkstatt und brenne einen Extra-Affix auf dein Lieblingsteil.' },
      { term: 'Truhen & Rätselräume', text: 'Im Dungeon warten Truhen und Ereignisräume mit Runen-, Schach- und Sudoku-Rätseln. Knobeln zahlt sich in Beute aus.' },
    ],
  },
  {
    id: 'werkstatt',
    title: 'Werkstatt & Berufe',
    entries: [
      { term: 'Schmieden', text: 'Die Kette: Erz → Barren → Ausrüstung. Gesammeltes Erz wird eingeschmolzen und zu Gear gehämmert.' },
      { term: 'Perfektes Wirken', text: 'Beim Craften wandert ein Marker über eine Leiste. Triff die goldene Zone für höhere Qualität.' },
      { term: 'Angeln', text: 'Auswerfen, warten, im richtigen Moment tippen. Je enger das Fenster, desto seltener der Fang.' },
      { term: 'Verzaubern', text: 'Runen-Puzzle lösen = Affix aufs Item. Schwerere Bretter, stärkere Verzauberung.' },
    ],
  },
  {
    id: 'basis',
    title: 'Basis & Verteidigung',
    entries: [
      { term: 'Gebäude', text: 'Mit Erbe Stufe für Stufe ausbauen — jede Stufe wirkt permanent, für alle künftigen Helden.' },
      { term: 'Trainingshalle', text: 'Neue Helden starten mit mehr Werten je Stufe. Der Reroll-Beschleuniger.' },
      { term: 'Schatzkammer', text: '+15 % Erbe je Stufe und längerer Offline-Ertrag, während du weg bist.' },
      { term: 'Waffenkammer', text: 'Helden starten mit gehärteter Ausrüstung statt mit blanken Fäusten.' },
      { term: 'Heldengruft', text: 'Gefallene Helden stärken alle künftigen. Niemand stirbt umsonst.' },
      { term: 'Überfälle', text: 'Alle paar Läufe greifen Feinde deine Basis an. Mauer und Verteidigungsanlagen entscheiden, was stehen bleibt.' },
      { term: 'Fall der Basis', text: 'Wird die Basis überrannt, erhältst du Chronik-Punkte — und baust danach stärker wieder auf.' },
    ],
  },
  {
    id: 'chronik',
    title: 'Chronik',
    entries: [
      { term: 'Die Chronik', text: 'Die Ebene über der Basis: permanente Boni, die jedes Basis-Leben überdauern. Was hier steht, geht nie verloren.' },
      { term: 'Chronik-Punkte', text: 'Verdient durch große Taten und gefallene Basen. Investiere sie in Vorteile für alle Zeiten.' },
    ],
  },
  {
    id: 'missionen',
    title: 'Missionen',
    entries: [
      { term: 'Späher entsenden', text: 'Schicke Späher auf Missionen — sie sind in Echtzeit unterwegs, auch wenn die App geschlossen ist.' },
      { term: 'Rückkehr', text: 'Nach Ablauf der Zeit kehren sie mit Beute, Materialien und Berichten zurück. Abholen nicht vergessen!' },
    ],
  },
];
