# Seeschlacht — zehn Schiffe verstecken, zehn Schiffe finden

Jeder legt seine Flotte auf zehn mal zehn Felder, dann wird abwechselnd geschossen. Wer
zuerst alles versenkt hat, gewinnt. Von allen Spielen der Sammlung das, was am besten auf
zwei Handys passt: beide Flotten bleiben wirklich geheim.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

## Spielen

**Am Rechner:** `seeschlacht/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/seeschlacht/`.

**Bauen:** `npm run seeschlacht:build`.

Aus dem Spiel heraus: Menü → **Spiel als Datei sichern** legt `Seeschlacht.html` in die
Downloads.

## Die Flotte

| Anzahl | Schiff | Felder |
|---|---|---|
| 1× | Schlachtschiff | 5 |
| 2× | Kreuzer | 4 |
| 3× | Zerstörer | 3 |
| 4× | U-Boot | 2 |

Zusammen zehn Schiffe auf 30 der 100 Felder. Schiffe dürfen sich **nicht berühren**, auch
nicht über Eck — im Menü abschaltbar.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Meer | 10 × 10, Spalten A–J, Zeilen 1–10 |
| Legen | auf das erste Feld tippen, Richtung mit ↔ / ↕ umschalten, Schiff antippen nimmt es weg |
| Auffüllen | *Zufällig legen* ergänzt, was noch fehlt, und lässt Gelegtes stehen |
| Schuss | ein Feld je Zug |
| Treffer | bringt einen weiteren Schuss (abschaltbar) |
| Versenkt | wird gemeldet, die Felder ringsum werden automatisch als Wasser markiert |
| Sieg | alle zehn Schiffe der Gegenseite versenkt |

## Wer was sieht

**An einem Handy:** erst legt der eine, dann wird weitergereicht und der andere legt. Beim
Schießen zeigt der Bildschirm nur das **gegnerische** Meer — was dort steht, weiß ohnehin
jeder. Die eigene Flotte gibt es über *Meine Flotte ansehen*, und davor kommt wieder eine
Übergabe.

**Auf zwei Handys:** jeder sieht beides zugleich — oben das gegnerische Meer zum Schießen,
darunter klein das eigene. Die Schiffe der Gegenseite werden nie mitgeschickt: `gegnerSicht`
nimmt sie heraus und lässt nur Treffer, Wasser, schon versenkte Schiffe und die **Zahl** der
gelegten Schiffe stehen. Die Zahl muss bleiben — sonst könnte das Gerät nie erkennen, dass
die Gegenseite mit dem Legen fertig ist.

## Aufbau

```
seeschlacht/src/engine.js   Meere, Flotten, Schüsse, Sichtfilter — ohne DOM
seeschlacht/src/ui.js       Oberfläche, Raster, Übergaben, Kopplung
seeschlacht/src/style.css   Seekarte bei Nacht
seeschlacht/build.mjs       baut daraus eine einzige HTML-Datei
```

## Tests

`npx vitest run tests/seeschlacht` — 39 Fälle. Darunter:

- jede Legeregel einzeln: Rand, Überschneidung, Berührung über Eck, Abstandsregel aus
- **100 Zufallsflotten** mit gesetztem Zufall: immer zehn Schiffe, richtige Längen, nie
  doppelt belegt, nie berührend
- Schießen: Wasser, Treffer, versenkt, Umgebung, zweiter Schuss auf dasselbe Feld,
  außerhalb der Karte, vor Spielbeginn, nach Spielende
- **Sichtfilter**: die fremde Flotte fehlt, Treffer und versenkte Schiffe bleiben, die
  Bereitschaft ist trotzdem ablesbar
- **100 Partien gegen sich selbst**: jede läuft zu Ende, in plausibler Zahl von Schüssen,
  und am Ende steht kein Schiff mehr
