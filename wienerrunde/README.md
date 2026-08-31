# Wiener Runde — kaufen, bauen, Miete kassieren

Das Straßenkaufspiel für zwei, aber mit Wiener Orten und in 40 Runden zu Ende. Wer dann
mehr besitzt, gewinnt; wer vorher zahlungsunfähig wird, verliert sofort.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

> Der Spielablauf eines Straßenkaufspiels ist frei. Name, Brettgestaltung, Straßennamen
> und Kartentexte des bekanntesten Vertreters sind es nicht — die gehören Hasbro. Deshalb
> hier ein eigenes Brett mit Wiener Orten, eigene Karten und eigene Preise. Für einen
> Wien-Urlaub ohnehin die schönere Fassung.

## Spielen

**Am Rechner:** `wienerrunde/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/wienerrunde/`.

**Bauen:** `npm run wienerrunde:build`.

## Das Brett

40 Felder: **22 Orte** in acht Farbgruppen (Vorstadt, Märkte, Bezirke, Grüne Lungen,
Kaffeehäuser, Bühnen, Museen, Kaiserlich), **vier U-Bahn-Linien**, **zwei Werke**, dazu
Los, Kommissariat, Freier Platz, Ab-ins-Kommissariat, zwei Steuerfelder und je drei
Zufalls- und Kaffeehauskarten-Felder.

Jedes Feld lässt sich antippen — dann erscheint seine Karte mit Preis und allen sechs
Mietstufen; die gerade geltende ist hervorgehoben.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Startgeld | 1500 €, über Los 200 € |
| Kaufen | freie Felder zum Listenpreis; **keine Versteigerung** — zu zweit macht das keinen Spaß |
| Miete | doppelt bei vollständiger Farbgruppe ohne Häuser |
| U-Bahn | 25 / 50 / 100 / 200 € je nach Zahl der Linien |
| Werke | 4× bzw. 10× die Augensumme |
| Bauen | nur auf voller Gruppe und nur gleichmäßig; vier Häuser, dann Hotel |
| Abreißen | bringt die Hälfte |
| Hypothek | halber Preis sofort, Auslösen mit 10 % Aufschlag; nicht auf bebautem Grund |
| Kommissariat | Pasch, Freikarte oder 50 €; beim dritten Fehlversuch wird die Kaution fällig |
| Pasch | noch einmal würfeln, dreimal hintereinander führt ins Kommissariat |
| Handel | ein Ort gegen Geld, die Gegenseite nimmt an oder lehnt ab |
| Ende | Zahlungsunfähigkeit — oder nach 40 Runden das größere Vermögen |

Im Menü einstellbar: 20, 30, 40, 60 Runden oder bis zur Pleite.

## Warum 40 Runden — und warum Handeln kein Beiwerk ist

Zwei Messungen über je 400 Selbstspiele haben die Voreinstellung bestimmt:

1. **Bis zur Pleite** dauert eine Partie im Schnitt **149 Runden**, und jede fünfte war
   nach 300 Runden noch offen. Nichts fürs Handy im Urlaub.
2. Bei einer Begrenzung kommt es darauf an, dass überhaupt gebaut wird:

   | Runden | Felder verkauft | volle Farbgruppen | Häuser |
   |---|---|---|---|
   | 30 | 19,9 | 2,6 | 3,3 |
   | **40** | **22,0** | **3,7** | **6,6** |
   | 50 | 23,4 | 4,5 | 11,2 |

Und der wichtigste Befund: **ohne Handel** bleiben die Farbgruppen fast immer
unvollständig — mit demselben Testspieler ohne Handelsschritt sinken die vollen Gruppen
von 2,6 auf 0,75 und die Häuser von 3,3 auf 0,9. Handeln ist keine Zugabe, sondern die
Voraussetzung dafür, dass der Bauteil des Spiels überhaupt vorkommt. Deshalb zeigt die
Besitzübersicht von sich aus an, welcher eine Ort noch zu einer Farbgruppe fehlt.

## Die vier Fassungen

| Fassung | Was anders ist |
|---|---|
| **Klassisch** | 40 Runden, alles wird erlaufen |
| **Schnellstart** | jede Seite beginnt mit **drei zufälligen Orten** |
| **Versteigerung** | wer nicht kauft, dem greift die Gegenseite den Ort weg |
| **Bis zur Pleite** | kein Rundenlimit |

**Schnellstart** ist die direkte Antwort auf die Messung weiter unten: ohne Handel bleiben
die Farbgruppen fast immer unvollständig, und der Bauteil des Spiels kommt gar nicht vor.
Mit drei Orten je Seite gibt es von der ersten Runde an etwas zu tauschen.

**Versteigerung** ist zu zweit bewusst keine echte Auktion — es gäbe ja nur ein Gebot.
Stattdessen bekommt die Gegenseite den Ort zum Listenpreis angeboten. Entscheiden muss
sie selbst: dafür wandert `dran` für diesen einen Schritt hinüber, sonst hinge auf dem
zweiten Handy der Knopf beim Falschen.

## Auf zwei Handys

Über **Menü → Auf zwei Handys spielen**. Nichts ist geheim — beide sehen dasselbe Brett
und dieselben Konten. Ein Handelsangebot erscheint sofort auf dem anderen Gerät.

## Aufbau

```
wienerrunde/src/brett.js      Felder, Preise, Mietstufen, Karten — reine Daten
wienerrunde/src/geometrie.js  wo die 40 Felder liegen, ohne DOM
wienerrunde/src/engine.js     Regeln, Geld, Bauen, Handel — ohne DOM, serialisierbar
wienerrunde/src/ui.js         Oberfläche, Brett als SVG, Feldkarten, Kopplung
wienerrunde/src/style.css     Brett in Creme auf dunklem Samt
wienerrunde/build.mjs         baut daraus eine einzige HTML-Datei
```

## Tests

`npx vitest run tests/wienerrunde` — 81 Fälle. Darunter:

- **Brettdaten**: 40 Felder lückenlos, 22 Orte in acht Gruppen, ansteigende Mietstufen,
  teurere Gruppen auch teurer, 24 Karten mit eindeutigen Kennungen
- jede Regel einzeln: Los, Steuern, Pasch, drei Paschs, Kaufen, alle Mietarten, Bauen
  (gleichmäßig, Hotelgrenze, ohne Geld, auf beliehenem Grund), Abreißen, Hypothek,
  Kommissariat, jede Kartenart, Handel, Pleite
- **fremder Besitz**: beleihen, auslösen und abreißen gehen nur auf eigenem Grund
- **Brettgeometrie**: 40 Felder auf dem Rand eines 11×11-Rasters, lückenlos, Ecken richtig
- **200 Partien gegen sich selbst**: keine hängt, kein ungültiger Zustand (Häuser nur
  0–5, nie bebaut ohne Besitzer, nie beliehen und bebaut zugleich)
