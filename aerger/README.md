# Ärger — vier Figuren, ein Würfel, kein Erbarmen

Der Würfelklassiker für zwei: alle vier Figuren einmal um das Brett und ins eigene Haus.
Wer auf dich trifft, schickt dich zurück in die Ecke.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken.

> Das Spiel stammt von 1907 und ist gemeinfrei; der geläufige Name ist allerdings eine
> eingetragene Marke. Deshalb heißt es hier schlicht **Ärger** — die Regeln sind dieselben.

## Spielen

**Am Rechner:** `aerger/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/aerger/`.

**Bauen:** `npm run aerger:build`.

Aus dem Spiel heraus: Menü → **Spiel als Datei sichern** legt `Aerger.html` in die Downloads.

## Regeln, wie sie hier programmiert sind

| | |
|---|---|
| Brett | Ring aus 40 Feldern, die Startfelder liegen sich gegenüber |
| Figuren | vier je Seite, wahlweise zwei für eine kurze Partie |
| Herauskommen | nur mit einer Sechs, auf das farbig markierte Startfeld |
| Drei Würfe | wer keine Figur auf der Bahn hat, darf dreimal werfen |
| Sechs | berechtigt zu einem weiteren Wurf |
| Sechs-Vorrang | wer noch in der Ecke steht, muss mit der Sechs zuerst heraus; steht dort schon eine eigene Figur, muss die weiter |
| Schlagen | Landen auf einer fremden Figur schickt sie zurück; auf eine eigene darf man nicht ziehen |
| Haus | muss genau getroffen werden, Überwerfen ist kein Zug; im Haus wird nichts übersprungen |
| Zugzwang | gibt es einen gültigen Zug, muss er gemacht werden |
| Sieg | alle Figuren im Haus |

Im Menü umschaltbar: **kurze Partie** (zwei Figuren), **Schlagen ist Pflicht**,
**Sechs-Vorrang** aus.

## Auf zwei Handys

Über **Menü → Auf zwei Handys spielen**, per Raumcode oder QR im selben WLAN. Hier gibt
es nichts zu verbergen — beide sehen dasselbe Brett, jeder tippt auf seinem Gerät, wenn
er dran ist. An einem Handy geht es genauso: einfach liegen lassen und abwechselnd tippen,
ein Übergabe-Bildschirm ist nicht nötig.

## Aufbau

```
aerger/src/brett.js    wo die Felder liegen — reine Geometrie, ohne DOM
aerger/src/engine.js   Regeln, Züge, Spielstand — ohne DOM, alles serialisierbar
aerger/src/ui.js       Oberfläche, Brett als SVG, Kopplung
aerger/src/style.css   helles Holzbrett auf dunklem Tisch
aerger/build.mjs       baut daraus eine einzige HTML-Datei
```

## Tests

`npx vitest run tests/aerger` — 53 Fälle. Darunter:

- jede Einzelregel als eigener Fall, samt Randfällen (überwürfeln, blockiertes Haus,
  Sechs-Vorrang, Zugzwang, Spielende)
- **Brettgeometrie**: 40 Felder, keine Dopplung, lückenloser Ring ohne Diagonalen,
  Häuser am richtigen Ende, nichts überlappt
- **1000 Partien gegen sich selbst** mit gesetztem Zufall: jede läuft zu Ende, die Siege
  verteilen sich ungefähr gleich, und kein Durchlauf erreicht einen ungültigen Zustand
  (keine zwei eigenen Figuren auf einem Feld, keine Schritte außerhalb des Bretts)
