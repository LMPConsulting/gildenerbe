# Hütchenjagd — einmal herum, wenn dich keiner fängt

Vier Hüte müssen einmal um das Brett und wieder in den eigenen Hof. Nur: Wer auf deinen
Hut tritt, nimmt ihn mit und schleppt ihn herum. Frei kommst du erst, wenn der Räuber
heimkommt — und dann fängst du von vorn an.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

> Nach dem Vorbild von *Fang den Hut* (Ravensburger, 1927). Die Regeln stammen aus der
> Pachisi-Familie und sind frei; Name und Brettgestaltung gehören Ravensburger. Deshalb
> hier ein eigenes Brett und ein eigener Name.

## Spielen

**Am Rechner:** `hut/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/hut/`.

**Bauen:** `npm run hut:build`.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Brett | Ring aus 20 Feldern — der Rand eines 6 × 6-Rasters |
| Höfe | zwei gegenüberliegende Ecken, je vier Warteplätze |
| Hüte | vier je Seite |
| Losziehen | jede Augenzahl bringt einen Hut aus dem Hof, keine Sechs nötig |
| Weg | **einmal ganz herum und wieder in den eigenen Hof** — 20 Schritte |
| Fangen | Landen auf einem fremden Hut nimmt ihn darunter; er zieht ab da mit |
| Stapel | trug der Gefangene selbst welche, gehen die gleich mit über |
| Befreien | kommt der Räuber heim, gehen die Gefangenen in **ihren Hof** zurück — also ganz von vorn |
| Heimkommen | der eigene Hof muss genau getroffen werden; auf einen eigenen Hut darf man nicht ziehen |
| Sieg | alle vier eigenen Hüte sind daheim |

Die kleine Zahl am Hut sagt, wie viele fremde er gerade schleppt.

## Warum der Weg einmal ganz herum geht

Die erste Fassung ließ jeden bis zum gegenüberliegenden Hof laufen — zwölf Schritte auf
einem 24er-Ring. Alle Einzeltests dazu waren grün. Aber in 2000 Probepartien fiel **kein
einziger Fang**: bei dieser Aufteilung benutzt jede Seite ihre eigene Ringhälfte, die Wege
überschneiden sich nirgends. Ausgerechnet die Regel, die dem Spiel den Namen gibt, konnte
nie greifen.

Mit dem Rundlauf teilen sich beide jedes Feld. Gemessen: **4,1 Fänge je Partie**, 13 von
2000 Partien ohne Fang, 76 Züge im Schnitt. Seitdem gehört „wird überhaupt gefangen?" als
eigener Test dazu.

## Auf zwei Handys

Über **Menü → Auf zwei Handys spielen**, per Raumcode oder QR im selben WLAN. Hier gibt es
nichts zu verbergen — beide sehen dasselbe Brett. An einem Handy geht es genauso: liegen
lassen und abwechselnd tippen.

## Aufbau

```
hut/src/brett.js    wo die Felder liegen — reine Geometrie, ohne DOM
hut/src/engine.js   Regeln, Fangen, Spielstand — ohne DOM, alles serialisierbar
hut/src/ui.js       Oberfläche, Brett als SVG, Kopplung
hut/src/style.css   heller Karton auf grünem Filz
hut/build.mjs       baut daraus eine einzige HTML-Datei
```

## Tests

`npx vitest run tests/hut` — 43 Fälle. Darunter:

- jede Einzelregel: Losziehen, Blockieren, Fangen, Stapel übernehmen, Befreien,
  genaues Heimkommen, gefangene Hüte ziehen nicht
- **Brettgeometrie**: 20 Felder, lückenloser Ring ohne Diagonalen, Höfe in
  gegenüberliegenden Ecken, Warte- und Zielplätze überschneidungsfrei
- **beide Seiten benutzen jedes Feld** — der Test, der den Konstruktionsfehler von oben
  verhindert hätte
- **1000 Partien gegen sich selbst**: jede läuft zu Ende, Siege ungefähr gleich verteilt,
  nie zwei Stapel auf einem Feld, nie ein verlorener Hut
- **„wird überhaupt gefangen?"** — mindestens zwei Fänge je Partie im Schnitt
