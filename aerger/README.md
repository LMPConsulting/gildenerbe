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

## Die vier Fassungen

| Fassung | Was anders ist | Züge | Geschlagen |
|---|---|---|---|
| **Klassisch** | vier Figuren, nur mit einer Sechs heraus | 145 | 5,8 |
| **Blitz** | zwei Figuren, **jede Zahl** bringt heraus | **53** | 1,2 |
| **Bösartig** | Schlagen ist Pflicht | 178 | **11,4** |
| **Zwei Würfel** | beide werfen, **einen davon** benutzen | 144 | 5,6 |

Gemessen über je 400 Partien (`node scripts/aerger-messung.mjs`). Die Siegquote liegt in
allen vier Fassungen zwischen 48 und 53 % — keine Seite ist bevorzugt.

**Blitz** ist tatsächlich ein Drittel so lang: ohne die Sechs-Hürde entfallen die
Leerwürfe, die den Klassiker in die Länge ziehen. Deshalb gibt es dort auch nur einen
Wurf statt drei — die drei Würfe existierten ja nur, weil man ohne Sechs nicht herauskam.

**Zwei Würfel** ist gleich lang wie Klassisch und schlägt gleich oft. Der Unterschied
liegt woanders und lässt sich beziffern: in **65 % aller Würfe** ermöglichen *beide*
Zahlen einen Zug, und zwar verschiedene — das sind rund **114 echte Entscheidungen je
Partie**, wo der Klassiker keine einzige hat.

Zusätzlich lassen sich im Menü einzelne Regeln nachjustieren: **zwei Figuren**,
**Schlagen ist Pflicht**, **Sechs-Vorrang** aus.

## Das Brett

Überarbeitet, weil die erste Fassung ein Feld gleich aussehender Kringel war:

- Die **Bahn ist ein durchgehender Weg**, kein loser Punktehaufen — man sieht jetzt, dass
  die 40 Felder zusammenhängen.
- **Zielbahnen** sind farbige Wege von der Einfahrt bis in die Mitte.
- Die **Basen** sind beschriftete Platten mit eigener Farbe, nicht bloß vier Kreise.
- Die **Startfelder** tragen einen Pfeil in Laufrichtung — das Brett sagt damit selbst,
  wo herum es geht.
- Die **Felder sind größer** und die Figuren sind Kegel mit Schatten statt flacher Kreise.

## Steuerung

Vorher tippte man eine Figur an und sie zog sofort — bei vier Figuren auf einem kleinen
Brett hat man sich leicht vertippt. Jetzt in zwei Schritten:

1. eine der **umrandeten Figuren** antippen
2. es erscheint eine **gestrichelte Linie** zum Zielfeld und dort ein **goldener Ring** —
   diesen antippen führt den Zug aus

Ist der Ring **rot**, wird dort geschlagen. Kann nur eine Figur ziehen, ist sie schon
ausgewählt. Bei **Zwei Würfel** erscheinen unten beide Würfel zur Auswahl.

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

`npx vitest run tests/aerger` — 71 Fälle. Darunter:

- jede Einzelregel als eigener Fall, samt Randfällen (überwürfeln, blockiertes Haus,
  Sechs-Vorrang, Zugzwang, Spielende)
- **Brettgeometrie**: 40 Felder, keine Dopplung, lückenloser Ring ohne Diagonalen,
  Häuser am richtigen Ende, nichts überlappt
- **1000 Partien gegen sich selbst** mit gesetztem Zufall: jede läuft zu Ende, die Siege
  verteilen sich ungefähr gleich, und kein Durchlauf erreicht einen ungültigen Zustand
  (keine zwei eigenen Figuren auf einem Feld, keine Schritte außerhalb des Bretts)
- **jede Fassung einzeln**: 60 Partien je Modus, keine hängt, und Blitz muss messbar
  kürzer sein als Klassisch — sonst hieße er nicht so
- **Zwei Würfel**: die Wahl gibt erst Züge frei, die nicht gewählte Zahl verfällt, eine
  gewählte Sechs bringt einen weiteren Wurf, und eine nicht geworfene Zahl wird abgelehnt

Ein bestehender Test ist beim Umbau rot geworden und hat dabei etwas Echtes gefunden: Ein
Spielstand, der **vor** dieser Fassung gespeichert wurde, kennt die neuen Regelschlüssel
nicht. Direkt gelesen käme `undefined` heraus, und aus „Sechs nötig" würde stillschweigend
„jede Zahl bringt heraus" — ein altes Spiel hätte sich nach dem Update anders verhalten.
Regeln werden deshalb jetzt grundsätzlich mit Rückfall auf die Vorgabe gelesen.
