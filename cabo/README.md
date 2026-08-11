# Cabo — Kartenspiel für ein Handy

Jeder hat vier verdeckte Karten, zwei davon darf man sich am Anfang ansehen. Danach zählt
das Gedächtnis: Wer am Ende die **niedrigste Summe** hat, gewinnt die Runde. Wer sich sicher
ist, ruft **Cabo** — und riskiert Strafpunkte.

**Komplett offline.** Eine einzige HTML-Datei, keine Server, keine Bibliotheken.

## Spielen

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im
Browser öffnen, antippen — die Seite lädt sich selbst als `Cabo.html` in den Downloads-Ordner.

**Am Rechner:** `cabo/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/cabo/`.

## Regeln

**Karten.** 52 Stück: die 0 und die 13 je zweimal, die Werte 1 bis 12 je viermal. Der Wert
ist gleichzeitig der Punktwert — wenig ist gut.

**Start.** Jeder bekommt vier Karten verdeckt und darf sich die **beiden unteren** ansehen.

**Ein Zug.** Entweder vom Nachziehstapel ziehen oder die oberste Ablagekarte nehmen.

- Vom **Stapel**: Karte gegen eine eigene tauschen (die alte kommt offen auf die Ablage) —
  oder abwerfen und dabei ihre Kraft nutzen.
- Von der **Ablage**: nur tauschen, keine Kraft.

**Die Kräfte** gelten nur für abgeworfene Karten und sind freiwillig:

| Werte | Kraft | Wirkung |
|---|---|---|
| 7 · 8 | Peek | Eine eigene Karte ansehen |
| 9 · 10 | Spy | Eine fremde Karte ansehen |
| 11 · 12 | Swap | Eine eigene blind gegen eine fremde tauschen |

**Gleiche Karten abwerfen.** Nach dem Ziehen darfst du behaupten, mehrere deiner Karten
hätten denselben Wert — Pärchen, Triplett oder alle vier. Aufgedeckt wird für alle sichtbar.

- **Richtig:** Die Karten wandern auf die Ablage, die gezogene Karte rückt auf den ersten frei
  gewordenen Platz. Deine Hand wird kleiner — und damit deine Summe.
- **Falsch:** Alles bleibt liegen, die gezogene Karte kommt auf die Ablage, dein Zug ist
  verloren. Und die Gegenseite hat deine Karten gesehen.

**Cabo rufen.** Statt zu ziehen. Alle anderen bekommen noch genau einen Zug, dann wird
aufgedeckt.

- Rufer hat wirklich die niedrigste Summe → **0 Punkte**. Bei Gleichstand gewinnt der Rufer.
- Rufer liegt daneben → seine Summe **+5 Strafpunkte**.
- Alle anderen bekommen ihre Kartensumme.

**Spielende.** Sobald jemand **100 Punkte** erreicht. Es gewinnt, wer am **wenigsten** hat.
Genau 100 Punkte werden auf 50 zurückgesetzt.

Ist der Nachziehstapel leer, wandert die Ablage bis auf die oberste Karte zurück und wird
gemischt — die Runde läuft weiter.

## An einem Handy

Das Handy wandert reihum. Alles, was nur eine Person sehen darf — die beiden Startkarten,
Peek und Spy — erscheint als Vollbild und verschwindet danach wieder. Vor jedem Zug kommt
ein Übergabe-Bildschirm.

**Die App merkt sich nichts für dich.** Karten liegen immer verdeckt, auch die eigenen, auch
die eben angesehenen. Genau das ist das Spiel.

## Aufbau

```
cabo/src/engine.js   Deck, Züge, Kräfte, Cabo, Wertung — ohne DOM
cabo/src/ui.js       Tisch, Kartenflip, Übergabe, Auswertung
cabo/src/style.css   Gestaltung
cabo/build.mjs       fügt alles zu cabo/index.html zusammen
cabo/index.html      das Ergebnis — die eine Datei, die man mitnimmt (generiert)
tests/cabo/          44 Tests (vitest)
```

Nach Änderungen in `src/`:

```bash
npm run cabo:build   # baut cabo/index.html neu
npm test             # prüft Deck, Kräfte, Cabo-Wertung und Rundenlauf
```

`cabo/index.html` wird generiert — Änderungen gehören nach `cabo/src/`.

## Nicht umgesetzt

Die Reaktionsvariante, bei der *alle gleichzeitig* eine passende Karte nachwerfen dürfen,
fehlt bewusst: Sie lebt von Schnelligkeit und passt nicht zu einem Handy, das reihum wandert.
Das eigene Pärchen auf dem eigenen Zug abzuwerfen geht dagegen (siehe oben).
