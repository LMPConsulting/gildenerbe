# Qwixx — Würfelspiel für ein Handy

Das Würfelspiel *Qwixx* (2 weiße + je 1 roter/gelber/grüner/blauer Würfel, vier Zahlenreihen
von 2 bis 12) für **zwei bis vier Leute an einem einzigen Handy**. Das Gerät wandert reihum,
die App sagt jedes Mal, wer dran ist und was zu tun ist.

**Komplett offline.** Keine Server, keine Bibliotheken, keine Schriften aus dem Netz —
alles steckt in einer einzigen HTML-Datei. Ideal für den Flug.

## Spielen

**Auf dem Handy (empfohlen für unterwegs):** `qwixx/index.html` herunterladen (in GitHub auf
die Datei → „Raw" → Datei sichern) und im Browser öffnen. Ab da braucht es kein Netz mehr.
Über „Zum Startbildschirm hinzufügen" liegt das Spiel wie eine App auf dem Homescreen.

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im Browser öffnen, antippen — die Seite lädt sich selbst als `Qwixx.html` in den Downloads-Ordner. Das ist der verlässlichste Weg auf ein Handy, weil es ein ganz normaler Browser-Download ist.

**Am Rechner:** Datei doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/qwixx/`.

Der Spielstand wird auf dem Gerät gespeichert; die App darf zwischendurch geschlossen werden.

## Ablauf an einem Gerät

Pro Runde wird das Handy genau **einmal** weitergegeben (bei zwei Spielenden):

1. Aktiver Spieler würfelt.
2. Aktiver Spieler entscheidet über die **weiße Summe** und danach über **weiß + Farbe**.
3. Handy weitergeben — die Mitspieler entscheiden über die weiße Summe.

Am Tisch passiert Schritt 2 und 3 gleichzeitig; an einem Gerät geht das nur nacheinander.
Damit das Ergebnis identisch bleibt, greifen **Sperren erst am Zugende**: Kreuzt jemand die
letzte Zahl einer Reihe an, dürfen die anderen im selben Wurf dieselbe Zahl noch nehmen.

Wer mit der weißen Summe nichts anfangen kann, wird übersprungen — das spart Übergaben,
die nichts bringen.

## Regeln (die in der App hinterlegt sind)

- Rot/Gelb 2 → 12, Grün/Blau 12 → 2; angekreuzt wird nur von links nach rechts.
- Weiße Summe: jeder darf, keiner muss. Weiß + Farbe: nur der aktive Spieler.
- Kein einziges Kreuz im eigenen Zug → **Fehlwurf, −5 Punkte**.
- Letzte Zahl nur ab **5 Kreuzen** in der Reihe; sie bringt das Schloss (zählt als Kreuz)
  und sperrt die Reihe für alle, der Farbwürfel fliegt raus.
- Ende bei **zwei gesperrten Reihen** oder **vier Fehlwürfen**.
- Punkte je Reihe: 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78.

## Aufbau

```
qwixx/src/engine.js   reine Spiellogik, ohne DOM — hier stecken die Regeln
qwixx/src/ui.js       Oberfläche: Blatt, Würfel, Übergabe, Endstand
qwixx/src/style.css   Gestaltung (Hoch- und Querformat)
qwixx/build.mjs       fügt alles zu qwixx/index.html zusammen
qwixx/index.html      das Ergebnis — die eine Datei, die man mitnimmt (generiert)
tests/qwixx/          27 Regeltests (vitest)
```

Nach Änderungen in `src/`:

```bash
npm run qwixx:build   # baut qwixx/index.html neu
npm test              # prüft die Regeln
```

`qwixx/index.html` wird generiert — Änderungen gehören nach `qwixx/src/`.
