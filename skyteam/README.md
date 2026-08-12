# Sky Team — kooperatives Cockpit für zwei

Pilot und Kopilot landen zusammen ein Flugzeug. Acht Würfel pro Runde, zwei Pflichthebel,
ein enger Anflug — und **kein Wort dazwischen**. Ihr gewinnt gemeinsam oder gar nicht.

**Komplett offline.** Eine einzige HTML-Datei, keine Server, keine Bibliotheken.

## Spielen

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im
Browser öffnen, antippen — die Seite lädt sich selbst als `SkyTeam.html` in den
Downloads-Ordner.

**Aufs zweite Handy bringen:** Im Menü **Aufs zweite Handy schicken** übergibt `SkyTeam.html`
an das Teilen-Menü von Android — Nearby Share, WhatsApp, Bluetooth. Die andere Person
speichert die Datei und öffnet sie im Browser.

**Am Rechner:** `skyteam/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/skyteam/`.

## Die eine große Regel

Solange Würfel auf dem Tisch liegen, wird **nicht geredet**. Keine Zahlen, keine
Andeutungen. Geredet wird nur im Briefing zwischen den Runden. Jeder sieht ausschließlich
seine eigenen vier Würfel — das ist der ganze Reiz.

## Eine Runde

1. Beide werfen **vier Würfel**, verdeckt voreinander.
2. Abwechselnd legt jeder **einen Würfel** auf ein Feld seiner Seite. Wer anfängt, wechselt
   von Runde zu Runde.
3. Sind alle Würfel gelegt, wird ausgewertet — erst das Ruder, dann der Schub. Das Flugzeug
   sinkt **1000 Fuß**. Bei 0 Fuß wird gelandet, ob es passt oder nicht.

## Das Cockpit

| Feld | Wer | Verlangt | Wirkung |
|---|---|---|---|
| **Ruder** | beide, Pflicht | 1–6 | Differenz kippt das Flugzeug (Pilot höher → rechts) |
| **Schub** | beide, Pflicht | 1–6 | Summe bestimmt, wie weit ihr fliegt: 0, 1 oder 2 Felder |
| **Fahrwerk** ×3 | Pilot | 1·2 / 3·4 / 5·6 | muss zur Landung komplett raus; bremst |
| **Landeklappen** ×4 | Kopilot | 1·2 / 2·3 / 3·4 / 4·5, der Reihe nach | muss komplett raus; bremst |
| **Bremsen** ×3 | Pilot | 1·2 / 3·4 / 5·6, der Reihe nach | hebt das Landetempo: 2 → 5 → 8 → 11 |
| **Funk** ×1 / ×2 | Pilot / Kopilot | 1–6 | räumt die fremde Maschine genau *Würfelwert* Felder voraus |
| **Kaffee** ×1 / ×1 | Pilot / Kopilot | 1–6 | sammelt eine Tasse; eine Tasse verschiebt einen eigenen Würfel um ±1 |

Ruder und Schub sind Pflicht — bleibt eines leer, stürzt ihr ab. Die App lässt automatisch
genug Würfel übrig und sperrt die Kür, sobald es eng wird.

## Die Klemme

Zu Beginn ist das Flugzeug schnell: Schubsumme bis **4** heißt stehenbleiben, bis **8** ein
Feld, darüber zwei. Jedes ausgefahrene Fahrwerk hebt die untere Grenze, jede Klappe die
obere — am Ende braucht ihr **mehr Schub für dieselbe Strecke**, während die Summe
gleichzeitig **unter eurem Bremswert** bleiben muss. Genau dazwischen liegt das Spiel.

Die Fluglage summiert sich über alle Runden. Jenseits von **±3** trudelt ihr, und zur
Landung muss sie **genau 0** sein.

## Die Landung

In der letzten Runde muss alles zusammenpassen:

- genau auf der Landebahn — nicht davor, nicht dahinter,
- Fluglage genau 0,
- Fahrwerk und Klappen komplett draußen,
- kein fremdes Flugzeug mehr im Anflug,
- Schubsumme nicht über dem Bremswert.

## Elf Ziele

| | Flughafen | Runden | Anflug | Fremdverkehr | Wind |
|---|---|---|---|---|---|
| 1 | YUL Montréal | 6 | 4 | 1 | – |
| 2 | ZRH Zürich | 7 | 6 | 3 | – |
| 3 | ORD Chicago | 7 | 6 | 2 | ja |
| 4 | GRU São Paulo | 6 | 5 | 2 | – |
| 5 | LHR London | 8 | 8 | 4 | – |
| 6 | CPT Kapstadt | 7 | 7 | 3 | – |
| 7 | KEF Reykjavík | 8 | 9 | 4 | ja |
| 8 | DXB Dubai | 8 | 8 | 4 | ja |
| 9 | SYD Sydney | 7 | 7 | 3 | ja |
| 10 | MEX Mexiko-Stadt | 9 | 10 | 5 | ja |
| 11 | HND Tokio | 9 | 11 | 6 | ja |

Bei Wind schiebt jede Runde eine zufällige Böe von −1, 0 oder +1 in die Fluglage — man
erfährt sie beim Würfeln, nicht vorher.

Die Reihenfolge ist **per Simulation eingestellt**: ein Auto-Pilot mit einer einfachen
Heuristik landet in Montréal in rund 77 % der Fälle und in Tokio in rund 5 %, mit einer
sauber fallenden Kurve dazwischen. Echte Crews haben es schwerer, weil sie die Würfel der
Gegenseite nicht sehen.

## Auf zwei Handys

Beide Geräte müssen im **selben WLAN oder Hotspot** hängen. Auf dem Startbildschirm
**Auf zwei Handys** wählen; ein Gerät führt (und wählt dabei seine Rolle), das andere
steigt zu.

1. Das führende Gerät zeigt einen QR-Code, das andere scannt ihn.
2. Das zweite Gerät zeigt einen zurück, das erste scannt.
3. Fertig — ab hier läuft alles direkt zwischen den Handys.

Es gibt keinen Server dazwischen: Die Geräte tauschen beim Koppeln nur ihre lokalen
Adressen aus (der Code ist rund 90 Zeichen kurz) und reden danach direkt miteinander.

Das führende Gerät rechnet; das andere schickt seine Züge hinüber und bekommt den
Spielstand zurück — **ohne die ungesetzten Würfel der Gegenseite**. Das ganze übrige
Cockpit sehen beide, so wie am Tisch.

**Wenn die Kamera streikt** — etwa in einer eingebetteten Ansicht — lässt sich der Code
unter „Code als Text“ auch kopieren oder eintippen.

**Wenn es gar nicht klappt:** Viele Hotspots trennen verbundene Geräte voneinander ab.
Dann hilft nur ein gemeinsames WLAN — oder eben ein Handy.

## An einem Handy

Das Gerät wandert nach **jedem gelegten Würfel** weiter; dazwischen liegt ein
Übergabe-Bildschirm, damit die Würfel geheim bleiben. Wem das zu viel Hin und Her ist,
schaltet beim Start **„Würfel offen zeigen“** ein — deutlich leichter, aber eben nicht mehr
Sky Team.

## Aufbau

```
skyteam/src/engine.js   Cockpit, Würfelregeln, Rundenauswertung, Landung — ohne DOM
skyteam/src/qr.js       QR-Erzeuger (Byte-Modus, Stufe L, Versionen 1–15), Eigenbau
skyteam/src/funk.js     Direktverbindung zweier Geräte, Kurzcode, QR-Scanner
skyteam/src/ui.js       Instrumente, Cockpit, Würfel, Kopplung, Briefing
skyteam/src/style.css   Gestaltung
skyteam/build.mjs       fügt alles zu skyteam/index.html zusammen
skyteam/index.html      das Ergebnis — die eine Datei, die man mitnimmt (generiert)
tests/skyteam/          46 Tests (vitest)
```

Nach Änderungen in `src/`:

```bash
npm run skyteam:build   # baut skyteam/index.html neu
npm test                # prüft Cockpit, Würfelregeln, Auswertung und Landung
```

`skyteam/index.html` wird generiert — Änderungen gehören nach `skyteam/src/`.

## Was aus der Vorlage stammt und was nicht

Recherchiert und übernommen sind der Aufbau (Pilot/Kopilot, vier Würfel je Seite,
abwechselnd legen, Schweigen im Cockpit), die Felder (Ruder, Schub, Fahrwerk, Klappen,
Bremsen, Funk, Kaffee), die Rolle der Aerodynamik-Marker und die Landebedingungen.

**Selbst kalibriert** sind dagegen alle konkreten Zahlen: die Startwerte der beiden Marker,
die Bremsstufen, die Augenzahlen auf den Schaltern, die Fluglagengrenze und die komplette
Flughafentabelle. Die ausführlichen Regelseiten waren beim Bauen nicht erreichbar, also
wurde die Balance per Simulation auf eine ansteigende Schwierigkeitskurve gebracht statt
aus der Anleitung abgeschrieben. Wer das Original kennt, wird Abweichungen finden — das
Spielgefühl trifft es trotzdem.

Nicht umgesetzt sind die Erweiterungsmodule des Originals (Kerosin, Vereisung, wechselnde
Verkehrslage als eigene Karten). Der Wind ist als einfache Böe drin.
