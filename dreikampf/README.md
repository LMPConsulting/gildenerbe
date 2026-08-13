# Dreikampf — Wissen · Wahrheit · Wagnis

Ein Duell zu zweit an einem einzigen Handy: Allgemeinwissen gegeneinander, ehrliche Fragen
übereinander, Mutproben für unterwegs. Die Punkte laufen über den **ganzen Urlaub** weiter.

**Komplett offline.** Keine Server, keine Bibliotheken, keine Schriften aus dem Netz — alles
steckt in einer einzigen HTML-Datei.

## Spielen

**Auf dem Handy:** `dreikampf/index.html` herunterladen und im Browser öffnen. Ab da braucht
es kein Netz mehr. Über „Zum Startbildschirm hinzufügen“ liegt es wie eine App auf dem
Homescreen.

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im Browser öffnen, antippen — die Seite lädt sich selbst als `Dreikampf.html` in den Downloads-Ordner. Das ist der verlässlichste Weg auf ein Handy, weil es ein ganz normaler Browser-Download ist.

**Aufs zweite Handy bringen:** Im Menü **Spiel weitergeben** übergibt `Dreikampf.html` an das Teilen-Menü von Android — Nearby Share, WhatsApp, Bluetooth. Die andere Person speichert die Datei und öffnet sie im Browser.

**Am Rechner:** Datei doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/dreikampf/`.

## Der Ablauf

Wer dran ist, wählt eine der drei Disziplinen — und trägt damit auch das Risiko. Danach
wechselt der Zug.

| Disziplin | Wer macht was | Punkte |
|---|---|---|
| **Wissen** | Beide beantworten dieselbe Frage, verdeckt und nacheinander | 10 richtig · **15**, wenn nur einer richtig lag |
| **Wahrheit** | Beide antworten laut, danach bewertet jeder den anderen | **20** für ehrlich · 0 für ausgewichen |
| **Wagnis** | Nur wer dran ist, muss ran; der andere entscheidet, ob es zählt | **40** durchgezogen · **−15** gekniffen |

Das Handy wird nur einmal pro Wissensrunde weitergereicht — die Antworten sind verdeckt.
Wahrheit und Wagnis passieren offen, die App sagt jeweils, wer gerade entscheidet.

## Die Stapel

| Stapel | Karten | Bandbreite |
|---|---|---|
| Wissen | 284 | Wien & Österreich, Geografie, Geschichte, Natur, Tiere, Technik & Weltraum, Kunst & Literatur, Musik, Film, Sport, Essen, Alltag, Mythologie |
| Wahrheit | 150 | Wir beide, Alltag, Nähe, Geld & Arbeit, Familie, Zukunft, Ich selbst, Früher, Reisen — je nach Karte leicht, ehrlich oder tief |
| Wagnis | 145 | Überall (45), Unterwegs (25), In Wien (50), Abends (25) |

Jede Karte kommt erst wieder, wenn ihr Stapel durch ist. Mutproben lassen sich danach
filtern, wo ihr gerade seid — **Menü → Wo seid ihr?**

## Punkte über den Urlaub

Der Stand liegt in `localStorage` dieses Geräts und läuft weiter, bis er zurückgesetzt wird.
Gespeichert werden Punkte, Zug, Rundennummer, Verlauf, Statistik, benutzte Karten und sogar
eine mittendrin unterbrochene Runde.

Weil `localStorage` an die Adresse gebunden ist, gibt es **Menü → Punktestand sichern**:
der komplette Stand als Code zum Kopieren oder als Datei. Auf einem anderen Gerät oder unter
einer anderen Adresse dort wieder einspielen.

## Aufbau

```
dreikampf/src/wissen.js     284 Wissensfragen (richtige Antwort steht an erster Stelle)
dreikampf/src/wahrheit.js   150 Wahrheitsfragen mit Tiefe und Thema
dreikampf/src/wagnis.js     145 Mutproben mit Ortszuordnung
dreikampf/src/engine.js     Ziehen, Runden, Punkte, Statistik, Sicherungscode — ohne DOM
dreikampf/src/ui.js         Oberfläche: Tafel, Karten, Übergabe, Menü
dreikampf/src/style.css     Gestaltung
dreikampf/build.mjs         fügt alles zu dreikampf/index.html zusammen
dreikampf/index.html        das Ergebnis — die eine Datei, die man mitnimmt (generiert)
tests/dreikampf/            37 Tests (vitest)
```

Nach Änderungen in `src/`:

```bash
npm run dreikampf:build   # baut dreikampf/index.html neu
npm test                  # prüft Logik und Kartenstapel
```

`dreikampf/index.html` wird generiert — Änderungen gehören nach `dreikampf/src/`.
Der Builder zieht alle Module in einen Scope und bricht ab, wenn zwei Dateien denselben
Namen deklarieren.

## Neue Karten hinzufügen

Einfach ans Ende des passenden Stapels anhängen, `id` eindeutig halten:

```js
{ id: 'geo31', cat: 'Geografie', q: 'Frage?', o: ['richtig', 'falsch', 'falsch', 'falsch'] }
{ id: 'ich25', tiefe: 'tief', thema: 'Ich selbst', q: 'Frage?' }
{ id: 's51', ort: 'stadt', q: 'Mutprobe.' }
```

Die Tests prüfen dabei automatisch mit: vier verschiedene Antwortmöglichkeiten, eindeutige
ids, bekannte Tiefen und Orte.
