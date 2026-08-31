# Galgenmännchen — ein Wort, elf Fehlgriffe

Einer denkt sich ein Wort aus, der andere rät Buchstaben. Jeder Fehlgriff zeichnet einen
Strich am Galgen. Steht das Wort, hat der Rater gewonnen; steht das Männchen, der andere.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken, keine
Schriften aus dem Netz.

## Spielen

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im
Browser öffnen, antippen — die Seite lädt sich selbst als `Galgenmaennchen.html` in den
Downloads-Ordner.

**Am Rechner:** `hangman/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/hangman/`.

**Bauen:** `npm run hangman:build`.

## Die Runde

Wer an der Reihe ist, tippt sein Wort ein — auf Wunsch verdeckt, damit niemand mitliest.
Dazu darf ein kurzer Tipp stehen („steht in Wien herum“). Danach fordert das Spiel zum
Weiterreichen auf; erst dann erscheint das Rätsel.

Wer keine Lust aufs Ausdenken hat, lässt **das Handy das Wort stellen**: 270 deutsche
Wörter in sieben Listen — Allerlei, Reise, Wien, Essen & Trinken, Tiere & Natur, Zuhause
und eine Liste mit langen, gemeinen Brocken. Die Liste ist dann zugleich der Tipp. Für
solche Runden gibt es keine Punkte für den Wortgeber — das Handy spielt nicht mit.

Nach jeder Runde werden die Rollen getauscht. Die Punkte laufen über den ganzen Urlaub
weiter und stehen auch nach dem Schließen der App noch da.

## Buchstaben

A bis Z sowie **Ä, Ö, Ü** sind eigene Tasten: ein geratenes A deckt kein Ä auf. Ein **ß**
gibt es nicht — in Großschrift steht dafür SS, und wer „Straße“ eintippt, bekommt
`STRASSE`. Leerzeichen und Bindestriche sind von Anfang an zu sehen, damit man erkennt,
wie viele Wörter gesucht sind.

Wer eine Idee hat, kann über **Ganzes Wort** alles auf einmal sagen. Danebengeraten kostet
einen Fehlversuch — sonst wäre Durchprobieren gratis.

## Punkte

| | |
|---|---|
| Erraten | 10 Punkte |
| je nicht verbrauchter Fehlversuch | 3 Punkte |
| Wort ab zwölf Buchstaben | 5 Punkte obendrauf |
| nicht erraten | 15 Punkte für den, der das Wort stellte |

Fehlerfrei auf **Leicht** bringt also 43 Punkte, mit halb gezeichnetem Männchen auf
**Schwer** eher 22. Lange Wörter lohnen sich für beide Seiten: schwerer zu raten, aber
mehr wert.

## Schwierigkeit

Sie legt fest, wie viel vom Galgen schon steht, bevor es losgeht:

| Stufe | Vorgezeichnet | Fehlversuche |
|---|---|---|
| Leicht | nichts | 11 |
| Normal | Boden und Pfosten | 9 |
| Schwer | der ganze Galgen | 7 |

## Die vier Fassungen

| Fassung | Was anders ist |
|---|---|
| **Klassisch** | ein Wort, Schwierigkeit im Menü einstellbar |
| **Hart** | nur sieben Fehler — **und keine Tipps** |
| **Vokale kosten** | A, E, I, O, U kosten einen Fehler, auch wenn sie im Wort stehen |
| **Doppelwort** | zwei Wörter auf einmal, ein einziger Strichvorrat |

**Vokale kosten** dreht das Spiel um: sonst rät man erst die Vokale, weil sie fast immer
drin sind. Hier muss man mit Konsonanten anfangen und die Vokale erschließen. Macht ein
Vokal das Wort voll, zählt der Sieg — auch wenn derselbe Zug den letzten Fehler kostet.

**Doppelwort** zieht zwei verschiedene Wörter und setzt sie mit einem Leerzeichen
zusammen. Leerzeichen sind ohnehin Trenner und stehen von Anfang an da; beide Wörter
teilen sich damit denselben Strichvorrat, ohne dass es dafür eine zweite Runde nebenher
bräuchte.

Die gewählte Fassung steht im Spielstand, nicht im Gerät: sie reist beim Koppeln von
selbst mit. Ein Spielstand von vor den Fassungen wird weiter wie der Klassiker behandelt.

## Auf zwei Handys

Über **Menü → Auf zwei Handys spielen**. Zwei Wege:

- **Raumcode über das Internet** — nur in der Fassung auf der Webseite, dafür von überall.
- **QR-Code im selben WLAN** — ohne Server, direkt von Handy zu Handy. Beide Geräte
  müssen dafür im selben WLAN hängen; ein Handy, das den Hotspot *selbst* aufspannt,
  meldet Android oft gar kein Netz und findet dann keine Adresse.

Wer das Wort stellt, tippt es bei sich ein. Auf dem Bildschirm des Ratenden erscheinen nur
die Lücken, und gespeichert wird es dort auch nicht. Rechnen muss allerdings ein Gerät für
beide — das hat das Wort so lange im Arbeitsspeicher. Wer ganz sichergehen will, spielt an
einem Handy und reicht es weiter.

## Aufbau

```
hangman/src/woerter.js   die sieben Wortlisten
hangman/src/engine.js    Regeln, Punkte, Spielstand — ohne DOM, alles serialisierbar
hangman/src/galgen.js    die elf Striche als SVG, ebenfalls ohne DOM
hangman/src/ui.js        Oberfläche, Übergabe, Kopplung
hangman/src/style.css    Schultafel: Schiefergrün, Kreide
hangman/src/qr.js        eigener QR-Encoder (Byte-Modus, Version 1–15)
hangman/src/funk.js      Direktverbindung per WebRTC, Kopplung über QR
hangman/src/netz.js      Durchreiche über den Raumcode (nur Webfassung)
hangman/build.mjs        baut daraus eine einzige HTML-Datei
```

Tests: `npx vitest run tests/hangman` — 77 Stück über Regeln, Punkte, Wortlisten und
Zeichnung.
