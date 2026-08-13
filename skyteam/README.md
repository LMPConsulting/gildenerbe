# Sky Team — kooperatives Cockpit für zwei

Pilot und Kopilot landen zusammen ein Flugzeug. Acht Würfel pro Runde, zwei Pflichthebel,
ein enger Anflug — und **kein Wort dazwischen**. Ihr gewinnt gemeinsam oder gar nicht.

**Komplett offline.** Eine einzige HTML-Datei, keine Server, keine Bibliotheken.

## Spielen

**Direkt aus dem Spiel heraus:** Im Menü gibt es **Spiel als Datei sichern**. Einmal im
Browser öffnen, antippen — die Seite lädt sich selbst als `SkyTeam.html` in den
Downloads-Ordner.

**Aufs zweite Handy bringen:** Im Menü **Aufs zweite Handy schicken** übergibt `SkyTeam.html`
an das Teilen-Menü von Android — Nearby Share, WhatsApp, Bluetooth.

**Am Rechner:** `skyteam/index.html` doppelklicken — läuft direkt über `file://`.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/skyteam/`.

## Wenn man es noch nie gespielt hat

Es gibt drei Stufen Hilfe, und keine davon muss man suchen:

1. **Einweisung** — sieben Karten vor dem ersten Flug: was das für ein Spiel ist, warum
   geschwiegen wird, wie eine Runde läuft, was am Ende stimmen muss. Auf dem Startbildschirm
   und jederzeit über das Menü.
2. **Hinweise im Spiel** — kleine Kästen, die genau dann auftauchen, wenn das Thema zum
   ersten Mal dran ist: beim ersten Ruderwürfel, wenn die Gegenseite vorgelegt hat, wenn
   das erste fremde Flugzeug im Weg steht, wenn die Landerunde beginnt. Jeder Hinweis kommt
   einmal und wird dann weggehakt (das merkt sich das Gerät).
3. **Was ist was?** — jede Gruppenüberschrift im Cockpit hat ein **?**. Antippen erklärt
   genau dieses Feld. Das komplette Nachschlagewerk liegt im Menü, die ausführlichen Regeln
   gleich daneben.

## Die eine große Regel

Solange Würfel auf dem Tisch liegen, wird **nicht geredet**. Keine Zahlen, keine
Andeutungen. Geredet wird nur im Briefing zwischen den Runden.

Jeder sieht nur seine eigenen vier Würfel — **gelegte** Würfel sehen beide. Das ist euer
einziger Draht zueinander, und darauf beruht das ganze Spiel: Wer als Zweiter ans Ruder
geht, sieht die Zahl der Gegenseite und kann exakt darauf antworten.

## Eine Runde

1. **Briefing** — hier darf geredet werden. Absprechen, wer was vorhat.
2. Beide werfen **vier Würfel**, verdeckt voreinander.
3. Abwechselnd legt jeder **einen Würfel** auf ein Feld seiner Seite. Wer eröffnet, wechselt
   von Runde zu Runde.
4. Sind alle acht gelegt: Ruder auswerten, dann Schub. Das Flugzeug sinkt **1000 Fuß**.
   Bei 0 Fuß wird gelandet, ob es passt oder nicht.

## Das Cockpit

| Feld | Wer | Verlangt | Wirkung |
|---|---|---|---|
| **Ruder** | beide, Pflicht | 1–6 | Differenz kippt das Flugzeug zum höheren Würfel hin |
| **Schub** | beide, Pflicht | 1–6 | Summe auf der Skala: 0, 1 oder 2 Felder |
| **Fahrwerk** ×3 | Pilot | 1·2 / 3·4 / 5·6, beliebige Reihenfolge | muss komplett raus; schiebt **blau** +1 |
| **Landeklappen** ×4 | Kopilot | 1·2 / 2·3 / 3·4 / 4·5, der Reihe nach | muss komplett raus; schiebt **orange** +1 |
| **Bremsen** ×3 | Pilot | genau **2**, dann **4**, dann **6** | Landetempo 1 → 2 → 3 → 4 |
| **Funk** ×1 / ×2 | Pilot / Kopilot | 1–6 | räumt die Maschine *Würfelwert* Felder voraus |
| **Kaffee** ×1 / ×1 | Pilot / Kopilot | 1–6 | sammelt eine Tasse; eine Tasse schiebt einen eigenen Würfel um ±1 |

Ruder und Schub sind Pflicht — bleibt eines leer, stürzt ihr ab. Die App legt automatisch
genug Würfel beiseite und sperrt die Kür, sobald es eng wird.

**Neuwurf:** Zweimal pro Flug dürfen **alle** noch nicht gelegten Würfel neu geworfen
werden — beide Seiten gleichzeitig.

## Die Klemme

Die Geschwindigkeitsskala läuft von 2 bis 12. Anfangs steht die **blaue** Marke bei 4 und
die **orange** bei 8: Summe bis 4 heißt stehen bleiben, bis 8 ein Feld, darüber zwei. Jedes
Fahrwerk schiebt blau nach rechts, jede Klappe orange — am Ende steht blau auf 7 und orange
auf 12.

Heißt: Ihr braucht später **mehr Schub für dieselbe Strecke**. Und gleichzeitig darf das
Tempo beim Aufsetzen **höchstens so hoch wie euer Bremswert** sein — mit allen drei Bremsen
also **4**.

Daraus folgt die harte Wahrheit der letzten Runde: Ein Schub von 4 bewegt ein Flugzeug mit
ausgefahrenem Fahrwerk keinen Meter mehr. **Ihr müsst also vorher an der Landebahn
ankommen** und in der Landerunde nur noch stillhalten. Wer zu spät ankommt, kann nicht mehr
bremsen; wer zu früh ankommt, muss mehrere Runden lang die Summe klein halten.

Die Fluglage summiert sich über alle Runden. Ab **±3** trudelt ihr, und zur Landung muss sie
**genau 0** sein.

## Die Landung

- genau auf der Landebahn — nicht davor, nicht dahinter,
- Fluglage genau 0,
- Fahrwerk und Klappen komplett draußen,
- kein fremdes Flugzeug mehr im Anflug,
- Tempo höchstens Bremswert.

Der Endbildschirm hakt alle fünf einzeln ab, damit man sieht, woran es lag.

## Elf Ziele

| | Flughafen | Runden | Anflug | Fremdverkehr | Verkehrswürfel | Wind |
|---|---|---|---|---|---|---|
| 1 | YUL Montréal | 8 | 4 | – | – | – |
| 2 | ZRH Zürich | 8 | 5 | 1 | – | – |
| 3 | GRU São Paulo | 8 | 6 | 2 | – | – |
| 4 | ORD Chicago | 8 | 7 | 2 | – | – |
| 5 | CPT Kapstadt | 8 | 7 | 2 | – | ja |
| 6 | LHR London | 8 | 8 | 3 | – | – |
| 7 | ATL Atlanta | 8 | 7 | 2 | 1× | – |
| 8 | SYD Sydney | 7 | 6 | 2 | – | ja |
| 9 | KEF Reykjavík | 8 | 8 | 2 | 2× | ja |
| 10 | MEX Mexiko-Stadt | 9 | 10 | 3 | 2× | ja |
| 11 | HND Tokio | 9 | 11 | 4 | 3× | ja |

**Verkehrswürfel:** Steht ihr zu Rundenbeginn auf einem markierten Feld (◆), rollt ein
Würfel und setzt eine neue fremde Maschine so viele Felder voraus ein.

**Wind:** Solange das Flugzeug waagerecht liegt, ist er nicht zu spüren. Liegt es schräg,
kommt die Schräglage als Tempo obendrauf — schräg fliegen macht euch also schneller, als
euch lieb ist.

## Balance

Die Reihenfolge ist **per Simulation eingestellt**. Der simulierte Auto-Pilot spielt wie
eine ordentliche, aber nicht geniale Crew: Absprache im Briefing, danach entscheidet jede
Seite nur mit ihren eigenen Würfeln plus dem, was offen im Cockpit liegt — inklusive des
Antwort-Tricks (wer als Zweiter legt, kann exakt kontern).

Seine Trefferquote fällt von rund **25 % in Montréal auf 5 % in Tokio**, mit einer weitgehend
gleichmäßigen Kurve dazwischen. Diese Zahlen sind als *Rangordnung* gedacht, nicht als
Prognose für euch: Der Bot plant nie mehr als einen Zug voraus, spart Kaffee nur nach einer
starren Regel und nutzt den Neuwurf nur in der Landerunde. Zwei Menschen, die sich im
Briefing wirklich absprechen, liegen deutlich darüber.

Reproduzieren lässt sich das mit der Simulation aus dem Scratchpad (`sim2.mjs`) gegen
`skyteam/src/engine.js`.

## Auf zwei Handys

Beide Geräte müssen im **selben WLAN oder Hotspot** hängen. Auf dem Startbildschirm
**Auf zwei Handys** wählen; ein Gerät führt (und wählt dabei seine Rolle), das andere
steigt zu.

1. Das führende Gerät zeigt einen QR-Code, das andere scannt ihn.
2. Das zweite Gerät zeigt einen zurück, das erste scannt.
3. Fertig — ab hier läuft alles direkt zwischen den Handys.

Kein Server dazwischen: Die Geräte tauschen beim Koppeln nur ihre lokalen Adressen aus (der
Code ist rund 90 Zeichen kurz) und reden danach direkt miteinander.

Das führende Gerät rechnet; das andere schickt seine Züge hinüber und bekommt den Spielstand
zurück — **ohne die ungesetzten Würfel der Gegenseite**. Das ganze übrige Cockpit sehen
beide, so wie am Tisch.

**Wenn die Kamera streikt:** Der Code lässt sich unter „Code als Text“ auch kopieren.
**Wenn es gar nicht klappt:** Viele Hotspots trennen verbundene Geräte voneinander ab. Dann
hilft nur ein gemeinsames WLAN — oder eben ein Handy.

## An einem Handy

Das Gerät wandert nach **jedem gelegten Würfel** weiter; dazwischen liegt ein
Übergabe-Bildschirm, damit die Würfel geheim bleiben. Wem das zu viel Hin und Her ist,
schaltet beim Start **„Würfel offen zeigen“** ein — deutlich leichter, aber eben nicht mehr
Sky Team.

## Aufbau

```
skyteam/src/engine.js   Cockpit, Würfelregeln, Rundenauswertung, Landung — ohne DOM
skyteam/src/lehre.js    Einweisung, Hinweistexte, Cockpit-Lexikon — ohne DOM
skyteam/src/qr.js       QR-Erzeuger (Byte-Modus, Stufe L, Versionen 1–15), Eigenbau
skyteam/src/funk.js     Direktverbindung zweier Geräte, Kurzcode, QR-Scanner
skyteam/src/ui.js       Instrumente, Cockpit, Würfel, Kopplung, Briefing, Hinweise
skyteam/src/style.css   Gestaltung
skyteam/build.mjs       fügt alles zu skyteam/index.html zusammen
skyteam/index.html      das Ergebnis — die eine Datei, die man mitnimmt (generiert)
tests/skyteam/          60 Tests (vitest)
```

Nach Änderungen in `src/`:

```bash
npm run skyteam:build   # baut skyteam/index.html neu
npm test                # prüft Cockpit, Würfelregeln, Auswertung und Landung
```

`skyteam/index.html` wird generiert — Änderungen gehören nach `skyteam/src/`.

## Was recherchiert ist und was nicht

**Aus der Recherche übernommen** (Regelseiten, Rezensionen und Regel-Datenbanken zum
Original; die Rulebook-PDFs selbst waren aus dieser Umgebung nicht erreichbar, die Angaben
stammen aus mehreren übereinstimmenden Quellen):

- Aufbau: Pilot blau, Kopilot orange, vier Würfel je Seite, abwechselnd legen, Schweigen
  ab dem Wurf, Reden nur im Briefing.
- Die 19 Cockpitfelder und ihre Verteilung (Pilot: Ruder, Schub, 3× Fahrwerk, 3× Bremsen,
  1× Funk, Kaffee — Kopilot: Ruder, Schub, 4× Klappen, 2× Funk, Kaffee).
- Ruder: Differenz der Würfel, kippt zum höheren hin, bleibt liegen und summiert sich;
  ±2 sind sicher, ab dem dritten Strich trudelt es.
- Geschwindigkeitsskala: Summe unter blau = 0 Felder, zwischen blau und orange = 1, über
  orange = 2. Startpositionen blau zwischen 4 und 5, orange zwischen 8 und 9. Jedes
  Fahrwerk schiebt blau, jede Klappe orange — mit allem draußen steht blau zwischen 7 und 8,
  orange knapp hinter der 12.
- Fahrwerk 1·2 / 3·4 / 5·6 in beliebiger Reihenfolge, Klappen der Reihe nach, Bremsen genau
  2, dann 4, dann 6 in dieser Reihenfolge.
- Bremsmarke startet links der 2 und rückt pro Bremse ein Feld; das Tempo beim Aufsetzen
  darf den Markerwert nicht überschreiten (gleich ist erlaubt).
- Kaffee: Tasse sammeln, höchstens drei, eine Tasse verschiebt einen eigenen Würfel um ±1
  ohne Überlauf. Funk: der Würfelwert ist die Entfernung. Verkehrswürfel zu Rundenbeginn.
  Neuwurf-Marken lassen beide Seiten neu würfeln.
- Die fünf Landebedingungen.
- Wind als Modul: was aus der Mitte gedreht ist, schlägt sich auf die Geschwindigkeit nieder.

**Nicht 1:1**: die Flughafentabelle. Welche elf Ziele es im Original gibt, mit welcher Höhe,
welcher Anfluglänge und welchem Verkehr, war nicht vollständig recherchierbar — diese Tabelle
ist eigene Arbeit und per Simulation auf eine ansteigende Kurve gebracht. Auch die
Wind-Umsetzung ist vereinfacht (im Original läuft sie über eine eigene Windstärkeskala).

**Nicht umgesetzt**: die übrigen Erweiterungsmodule (Kerosin, Vereisung, Praktikant) und
die Kampagne.
