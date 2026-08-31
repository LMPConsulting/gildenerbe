# Sperrsteine — elf Steine stehen im Weg

Fünf Figuren durch ein Wegenetz nach oben. Über einen Sperrstein kommt niemand hinweg —
nur wer ihn **genau trifft**, nimmt ihn weg und stellt ihn irgendwo anders wieder hin, am
liebsten der Gegenseite vor die Nase. Die **erste** Figur oben gewinnt.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

> Die Regeln stammen aus der Familie von *Malefiz* bzw. *Barricade* (Ravensburger, 1960).
> Spielregeln sind frei — **Name und Brettgestaltung nicht**. Deshalb heißt es hier
> Sperrsteine, und das Wegenetz ist ein eigener Entwurf.

## Spielen

**Am Rechner:** `sperre/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/sperre/`.

**Bauen:** `npm run sperre:build`.

## Das Brett

79 Felder auf 12 Reihen. Es wechseln sich **Straßen** (lange waagerechte Reihen, auf denen
man sich frei bewegt) und **Leitern** (wenige senkrechte Übergänge) ab. Genau dieser
Wechsel macht eine Sperre gefährlich: eine Leiter ist ein Nadelöhr, eine Straße nicht.

```
Reihe  0                        Z                    Ziel
Reihe  1                   o    o    o
Reihe  2         o    o    o    o    o    o    o     Straße
Reihe  3         o              o              o     Leitern
Reihe  4    o o o o o o o o o o o                    Straße
Reihe  5    o         o         o         o          Leitern
Reihe  6    o o o o o o o o o o o                    Straße
Reihe  7         o              o              o     Leitern
Reihe  8    o o o o o o o o o o o                    Straße
Reihe  9    o         o         o         o          Leitern
Reihe 10    o o o o o o o o o o o                    unterste Straße
Reihe 11    A A A A A   B B B B B                    Heimfelder
```

Zwei Entwurfsentscheidungen, die keine Kosmetik sind:

1. **Das Ziel hängt an drei Wegen.** Hinge es nur an einem, könnte ein einzelner Stein das
   ganze Spiel zusperren, und beide Seiten müssten warten, bis jemand genau trifft.
2. **Das Brett ist spiegelsymmetrisch.** Beim Original stehen vier Spieler nebeneinander
   am unteren Rand und haben verschieden weite Wege. Zu zweit ist Gleichstand besser: die
   fünf Heimfelder sind 16, 17, 16, 15 und 16 Schritte vom Ziel entfernt — für beide
   Seiten dieselben Zahlen.

**Elf Sperrsteine** stehen zu Beginn auf den Leitern: drei geschlossene Mauern zwischen
Heimat und Ziel, dazu der mittlere Zugang ganz oben. Der Weg nach oben muss also erst
aufgebrochen werden — und was du aufbrichst, steht auch der Gegenseite offen.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Figuren | 5 je Spieler, von Anfang an auf den eigenen Heimfeldern |
| Würfeln | ein Würfel, ein Zug — kein Herauskommen mit einer Sechs nötig |
| Ziehen | **genau** die gewürfelte Zahl, entlang der Linien, Richtung frei |
| Kein Zurück | innerhalb eines Zuges nicht auf das gerade verlassene Feld zurück |
| Überspringen | Figuren dürfen übersprungen werden — **Sperrsteine nicht** |
| Sperre treffen | genau darauf landen: Stein aufnehmen und **neu setzen** |
| Wohin nicht | nicht aufs Ziel, nicht auf Heimfelder, nicht auf die unterste Straße |
| Schlagen | genau auf einer fremden Figur landen schickt sie zurück ins Heim |
| Eigene Figur | darf nicht Ziel eines Zuges sein (überspringen ist erlaubt) |
| Heim | einmal verlassen kein Feld mehr — nur Geschlagene kommen zurück |
| Ziel | muss **genau** getroffen werden und darf nicht überlaufen werden |
| Zugzwang | gibt es einen gültigen Zug, muss einer gemacht werden |
| Sieg | die **erste** Figur im Ziel |

Warum die unterste Straße frei bleiben muss: jedes Heimfeld hängt an **genau einem** Feld
dieser Reihe. Dürfte man dort einen Stein hinstellen, ließe sich jemand im eigenen Heim
einmauern — und die Partie liefe endlos weiter.

## Was die Messung ergeben hat

`node scripts/sperre-messung.mjs 2000` spielt Partien gegen sich selbst, einmal mit einem
Spieler, der vorankommen will, und einmal rein zufällig:

| | zielgerichtet | zufällig |
|---|---|---|
| Halbzüge je Partie | 39,8 (Median 34) | 381,6 |
| Sperren getroffen | 15,3 | 34,7 |
| Geschlagen | 9,4 | 30,9 |
| Siege der beginnenden Seite | 49,1 % (abwechselnd begonnen) | 49,6 % |

**Ein echter Fehler kam dabei heraus**, den kein Einzeltest gefunden hätte: Anfangs gewann
eine Seite 66 % der Partien, obwohl das Brett nachweislich spiegelsymmetrisch ist. Ursache
war das Zurückschicken geschlagener Figuren — die Heimfelder sind verschieden weit vom
Ziel entfernt, und weil beide Seiten von links nach rechts durchgezählt wurden, bekam eine
Seite systematisch das bessere Feld zurück. Seitdem sind die Figurnummern gespiegelt.

Ein zweiter Befund betraf das Messgerät selbst: Solange der Testspieler Gleichstände nach
Feldnummer auflöste, maß er seine eigene Reihenfolge mit. Erst mit ausgewürfelten
Gleichständen wurde der Unterschied zwischen 34 : 66 (Fehler) und 50 : 50 (behoben)
überhaupt sichtbar.

## Die drei Fassungen

| Fassung | Was anders ist |
|---|---|
| **Klassisch** | elf Steine, die erste Figur oben gewinnt |
| **Mauerschlacht** | **fünfzehn** Steine: jede Leiterreihe ist zu — keine Reihe geht hoch, ohne einen Stein zu treffen |
| **Alle fünf** | erst wenn **alle fünf** Figuren oben sind, ist Schluss |

Für **Alle fünf** musste eine Regel nachgeben: im Ziel dürfen jetzt mehrere eigene Figuren
stehen. Es ist der Zielhafen, kein Feld, das besetzt wird — sonst käme dort nur die erste
Figur an. Geschlagen wird im Ziel ebenfalls nicht.

## Auf zwei Handys

Über **Menü → Auf zwei Handys spielen**. Nichts ist geheim — beide sehen dasselbe Brett
und dieselben Steine. Wer nicht dran ist, kann nichts antippen.

## Aufbau

```
sperre/src/brett.js     Wegenetz, Nachbarschaften, Entfernungen — reine Daten
sperre/src/engine.js    Regeln ohne DOM, serialisierbar
sperre/src/ui.js        Oberfläche, Brett als SVG, Kopplung
sperre/src/style.css    helles Wegenetz auf tiefem Indigo
sperre/build.mjs        baut daraus eine einzige HTML-Datei
```

## Tests

`npx vitest run tests/sperre` — 58 Fälle. Darunter:

- **Brett**: 79 Felder lückenlos, Nachbarschaften beidseitig, keine Sprünge über Reihen,
  drei Wege zum Ziel, Heimfelder an genau einer Straße und nicht untereinander verbunden,
  vollständige Spiegelsymmetrie inklusive Nachbarschaften, gleiche Entfernungen für beide
  Seiten, elf Steine symmetrisch auf Wegfeldern
- **jede Regel einzeln**: genaue Schrittzahl, Richtungswechsel an Kreuzungen, kein
  sofortiges Zurück, Sperren nicht überspringbar, Sperre genau treffen, eigene Figuren
  überspringen aber nicht besetzen, Schlagen, Heimfelder unbetretbar, Ziel nur genau und
  nicht durchlaufbar, Zugzwang, Zug abgeben
- **Sperre neu setzen**: nur freie Wegfelder, nie Ziel, Heim oder unterste Straße, Zug
  endet erst nach dem Setzen, es bleiben immer elf Steine
- **Partien gegen sich selbst**, zufällig und zielgerichtet: jede läuft zu Ende, Sperren
  werden getroffen, es wird geschlagen, erträgliche Länge, kein ungültiger Zustand — und
  **keine Seite ist benachteiligt**, mit Startvorteil in der erwarteten Größe
