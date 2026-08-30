# Mauern — laufen oder bauen, beides geht nicht

Eine Figur, zehn Mauern. In jedem Zug machst du **entweder** einen Schritt **oder** baust
eine Mauer. Wer zuerst die gegenüberliegende Reihe erreicht, gewinnt. Und niemand darf
komplett zugemauert werden — nach jeder Mauer muss für beide noch ein Weg übrig sein.

Kein Würfel. Das einzige reine Denkspiel der Sammlung.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

> Die Regeln stammen von *Quoridor* (Gigamic, Mirko Marchesi, 1997) — dasselbe Spiel, das
> online als *Barricade* läuft. Spielregeln sind frei, **Name und Gestaltung nicht**.
> Deshalb heißt es hier Mauern.

## Nicht zu verwechseln mit den Sperrsteinen

Beide haben Mauern im Weg, sonst nichts gemeinsam:

| | [Sperrsteine](../sperre/README.md) (Malefiz) | Mauern (Quoridor) |
|---|---|---|
| Würfel | ja | **nein** |
| Figuren | 5 je Seite | **1** je Seite |
| Sperren | 11 gemeinsame, werden versetzt | **10 eigene je Seite, werden neu gebaut** |
| Zug | würfeln und ziehen | **entweder** gehen **oder** mauern |
| Ziel | ein Feld ganz oben | **die gegenüberliegende Reihe** |

## Spielen

**Am Rechner:** `mauern/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/mauern/`.

**Bauen:** `npm run mauern:build`.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Brett | 9 × 9 Felder, eine Figur je Seite in der Mitte der eigenen Grundreihe |
| Zug | **entweder** ein Feld waagerecht/senkrecht **oder** eine Mauer — nie beides |
| Mauern | 10 je Seite, zwei Felder lang, zwischen den Feldern |
| Mauern | dürfen sich nicht überlappen und nicht kreuzen; sie halten **beide** Seiten auf |
| **Wegregel** | eine Mauer darf **nie** den letzten Weg einer Seite zusperren — wird bei jedem Setzen für beide Seiten geprüft |
| Springen | steht die Gegenfigur daneben, springt man über sie hinweg (zwei Felder) |
| Schräg | steht dahinter eine Mauer oder der Rand, geht es schräg an ihr vorbei |
| Ziel | irgendein Feld der eigenen Zielreihe, farblich markiert |
| Aus | wer keine Mauern mehr hat, kann nur noch laufen |

## Die fünf Fassungen

| Fassung | Was anders ist | Züge je Partie |
|---|---|---|
| **Klassisch** | 9 × 9, zehn Mauern, gegenüberliegende Seiten | 74 |
| **Kurz** | 7 × 7, sieben Mauern | 50 |
| **Wettlauf** | beide starten **nebeneinander** und wollen auf **dieselbe** Seite | 70 |
| **Sparsam** | großes Brett, nur fünf Mauern — fast ein Wettrennen | 39 |
| **Festung** | vierzehn Mauern je Seite — jeder Weg wird zum Labyrinth | 94 |

Die gewählte Fassung steht im Spielstand, nicht im Gerät. Sie reist beim Koppeln also von
selbst mit, ohne eine einzige zusätzliche Nachricht.

## Bedienung — der eigentliche Entwurfsaufwand

Eine Mauer sitzt **zwischen** den Feldern. So eine Fuge ist auf einem Handy kein Ziel, das
man treffen kann. Deshalb in drei klaren Schritten statt in einer Geste:

1. unten umschalten: **Laufen** oder **Mauer bauen**
2. beim Mauern die **Richtung** wählen (quer oder längs)
3. einen **Punkt** antippen — die Mauer erscheint als Vorschau — und **bestätigen**

Der Bestätigungsschritt ist Absicht: eine gesetzte Mauer bleibt, wo sie ist, und
entscheidet oft die Partie. Erlaubte Fugen erscheinen als Punkte; wo eine Mauer die
Wegregel verletzen würde, gibt es gar keinen Punkt.

## Was die Messung ergeben hat

`node scripts/mauern-messung.mjs 150` — 150 Partien je Fassung:

| Fassung | Züge | Mauern gesetzt | Siege der anziehenden Seite |
|---|---|---|---|
| Klassisch | 74,4 | 19,7 | 50,7 % |
| Kurz | 49,7 | 13,5 | 54,0 % |
| Wettlauf | 69,7 | 19,0 | 45,3 % |
| Sparsam | 39,1 | 10,0 | 49,3 % |
| Festung | 94,1 | 25,7 | 52,7 % |

**Zwei Fassungen wurden dabei aussortiert oder korrigiert:**

*Ohne Sprung* — eine bekannte Hausregel, bei der die Figuren einander wie Mauern
blockieren. Gemessen gewinnt die anziehende Seite **71 %**: ohne Sprung müssen zwei
Figuren einander frontal ausweichen, und wer ausweichen muss, entscheidet allein die
Zugparität. Ein Modus, den der Anwurf zu zwei Dritteln entscheidet, ist kein besseres
Spiel, sondern ein schlechteres. Verworfen.

*Der Testspieler selbst* — der erste Anlauf benutzte die übliche Quoridor-Faustregel
„mauere, wenn du hinten liegst". Ergebnis: 36 zu 64. Die Regel kippt aber schon bei einem
Schritt Rückstand — wer anzieht, liegt sofort vorn und wird prompt bemauert. Mit einer
einzigen Bewertung für **beide** Zugarten (wie steht der Abstand zum Ziel nachher?)
kommen 50,7 % heraus. Gemessen wurde vorher die Faustregel, nicht das Spiel.

## Fairness — belegt ohne Testspieler

Weil Siegquoten immer auch am Testspieler hängen, gibt es zusätzlich eine **Spiegelprobe**:
dreht man eine beliebige Stellung um (Zeilen spiegeln, Seiten tauschen), müssen genau die
gespiegelten Läufe, Mauern und Wegelängen herauskommen. Das prüft die Symmetrie direkt am
Regelwerk statt über den Umweg einer Statistik.

## Aufbau

```
mauern/src/engine.js    Regeln, Wegsuche, Wegregel — ohne DOM, serialisierbar
mauern/src/ui.js        Oberfläche, Brett als SVG, Mauerbedienung, Kopplung
mauern/src/style.css    helles Gitter auf tiefem Petrol
mauern/build.mjs        baut daraus eine einzige HTML-Datei
```

Eine eigene `brett.js` gibt es nicht: die Geometrie ist ein schlichtes Gitter und steht
dort, wo sie gebraucht wird.

## Tests

`npx vitest run tests/mauern` — 44 Fälle. Darunter:

- **Aufstellung** je Fassung, Modus reist im Spielstand mit
- **Bewegung**: ein Feld, kein Schräg, Rand, waagerechte und senkrechte Mauern
- **Springen**: gerade darüber hinweg, schräg vorbei bei Mauer oder Rand, kein schräger
  Ausweg durch eine Mauer — und dass der Sprung dem Übersprungenen ein Tempo kostet
- **Mauern**: Gitter­grenzen, gleiche Fuge, Überlappung, Kreuzung, leerer Vorrat,
  Aufzählung aller erlaubten Mauern
- **die Wegregel** in beide Richtungen: die zusperrende Mauer wird abgelehnt, dieselbe
  Mauer ohne die Vorbereitung angenommen, und die Gegenseite ist genauso geschützt
- **Wegsuche**: Länge, Verlängerung durch Mauern, Unendlich ohne Weg
- **Selbstspiel** in jeder Fassung: läuft zu Ende, es wird gemauert, kein ungültiger
  Zustand, beide haben jederzeit einen Weg
- **Spiegelprobe** über 40 zufällige Stellungen
