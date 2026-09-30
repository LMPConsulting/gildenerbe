# Heuhaufen — sechs Millionen Halme, sechs Nadeln

Du wachst in einer Lagerhalle auf. Das Dach ist offen, die Tore sind zu. Vor dir ein
Heuhaufen mit rund sechs Millionen Halmen, irgendwo darin sechs Nadeln. Du hast einen
Spaten und einen Metalldetektor. Stich das Heu von Hand, verkauf es am Stand und steck
das Geld in Förderbänder und Maschinen, bis du nicht mehr selbst graben musst.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken, keine
Bilder und keine Audiodateien: Halle und Haufen werden gezeichnet, alle Geräusche erzeugt.

> Nachgebaut nach *Find The Needle* (FindTheNeedleDev / Hay Passionates, Steam, Demo
> September 2026). Übernommen sind Idee, Ablauf und Aufbau: Verkauf zu 0,0222 $ pro Halm,
> die Werkzeugleiste, der Forschungsbaum „Yard Research“ mit zehn Ästen, Spalten nach
> Schritten und Upgrade-Gruppen, Aufträge per Laster, das Missionsbuch, neue Ladungen auf
> Rechnung, Nadeln, die ungescannt zurück in den Haufen fallen. Name, Grafik und Texte
> sind eigene. Weil man im Original in 3D jedes Band selbst verlegt, ist die Halle fürs
> Handy verdichtet: Maschinen kaufen, Strom, Wasser, Band und Scanner im Gleichgewicht
> halten.

## Spielen

**Aus dem Spiel heraus:** Menü → **Spiel mit Spielstand herunterladen** legt eine
HTML-Datei in den Downloads-Ordner. Sie läuft ohne Netz und bringt den Stand mit.

**Am Rechner:** `heuhaufen/index.html` doppelklicken.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/heuhaufen/` (zeigt die
gebaute Datei, nach Änderungen an `src/` also erst bauen).

**Bauen:** `npm run heuhaufen:build`.

Der Spielstand liegt im Browser und wird alle fünf Sekunden sowie beim Schließen
gesichert. Wer weg ist, dessen Halle arbeitet weiter: zwei Stunden mit halber Kraft, mit
*Nachtschicht*, *Nachtwächter* und den Wänden bis zu zwölf Stunden und fast voller Kraft.
Läuft das Spiel in zwei Fenstern, ruht das ältere, statt den Stand zu überschreiben.

## Ablauf

| Phase | Was du tust |
|---|---|
| Von Hand | Werkzeug wählen, auf den Haufen tippen, volle Tasche zum Stand tragen. Jeder Stich kostet Ausdauer; die Sandschaufel nicht. |
| Werkzeug | Spaten, Heugabel, Sandschaufel, Besen (holt Verschüttetes zurück), Hofsauger (halten, bis er heiß wird), Detektor. Dazu Eimer, Schubkarre, Heusack. |
| Förderband | Ab jetzt landet jeder Stich direkt auf dem Band zum Stand. Kein Laufen mehr. |
| Automatisierung | Kolbenrechen, dann orange Greifarme. Strom kommt aus Heu-Generatoren, die vom Band fressen. Drohnen fliegen nebenher. |
| Suche | Ohne Scanner werden Nadeln mit dem Heu verkauft und fallen zurück in den Haufen. Faustregel: ein Scanner für zwei Arme. Der Nadelradar meldet die Entfernung. |
| Verarbeitung | Silo (Knäuel), Kompressor (Ballen), Pelletpresse, Pulper und Papiermaschine (brauchen Wasser aus Brunnen), Wickler, Ziegelpresse. |
| Aufträge | Ein Laster will eine bestimmte Ware und zahlt mehr als der Stand. Unpassende Aufträge lassen sich ablehnen. |
| Ladungen | Sind alle sechs Nadeln gefunden, gehen die Tore auf. Die nächste Ladung (10, 16, dann 26 Millionen Halme) kostet Geld oder kommt auf Rechnung; die Hälfte jeder Einnahme tilgt dann die Schulden. Maschinen und Forschung bleiben. |

Das **Missionsbuch** steht oben im Bild und zeigt immer den nächsten Schritt, mit
Belohnung in Geld oder einer geschenkten Maschine.

Der **Haufen schrumpft als Volumen**: bei halbem Rest ist er noch 79 % so hoch. Am
Anfang tut sich optisch fast nichts. Der Zähler oben zählt jeden Halm.

Es gibt **24 Nadelarten**, sechs je Ladung. Jede gibt einmal einen absichtlich
lächerlichen Bonus (Griff +1 %, Tasche +1 Halm, die Tannennadel riecht nur gut). Die
Sammlung steht unter „Nadeln“, zusammen mit der Statistik: erste Nadel, erste geschaffte
Ladung, größter Verkauf, meiste Kasse.

## Forschung

Wie im Vorbild nach **Schritten vom Start** in Spalten gelegt, mit Suchfeld und
Upgrade-Gruppen als schmale Zeilen unter einer Überschrift („Band-Upgrades: Schnellerer
Bandmotor 15 $ 0/12“). 111 Knoten mit zusammen **379 Stufen** in zehn Ästen:

Handarbeit · Hofbau · Heulinien · Strom · Verarbeitung · Automatisierung · Wasser · Suche · Verkauf · Fitness

Die Leiste unter dem Suchfeld springt zu jedem Ast und zeigt, wie viele Karten gerade
bezahlbar sind. Die Lupe oben rechts schaltet auf Übersicht.

## Balance

Ein Auto-Spieler (`heuhaufen/sim.mjs`) spielt Ladungen durch: drei Stiche pro Sekunde,
Sandschaufel bei leerer Puste, Sauger wenn kühl, fegt, folgt dem Missionsbuch, kauft
sonst das Billigste mit Nutzen und lehnt Aufträge ab, die die Halle nicht bedienen kann.
`node scripts/heuhaufen-messung.mjs` ergibt:

| | Median |
|---|---|
| Heugabel | 1 min |
| Förderband | 10 min |
| erste Nadel | 5 min |
| halbe Ladung | 78 min |
| Ladung 1 geschafft | 98 min |
| Ladung 2 (10 Mio. Halme) | knapp eine Stunde |
| alle 24 Nadelarten (vier Ladungen) | etwa 4¾ h |

Am Ende tragen Maschinen gut zwei Drittel ab, die Hand weniger als ein Drittel.
`tests/heuhaufen/balance.test.js` hält das fest, dazu einen langsamen Spieler mit einem
Stich pro Sekunde.

Die Simulation hat eine echte Sackgasse aufgedeckt: leerer Haufen, zu wenig Geld für die
nächste Ladung, und die Generatoren bekommen kein Heu mehr. Deshalb geht „auf Rechnung“
immer; die Forschung *Heu auf Rechnung* senkt nur den Aufschlag von 50 auf 10 %.

## Aufbau

```
heuhaufen/
  src/daten.js     alle Zahlen: Werkzeuge, Forschung, Maschinen, Produkte, Nadeln, Missionen, Aufträge, Ladungen
  src/engine.js    Spiellogik ohne DOM, speicherbar als JSON, eigener Zufall im Stand
  src/format.js    Zahlen und Geld auf Deutsch, mit geschützten Leerzeichen
  src/klang.js     Web-Audio: Rascheln, Kasse, Detektor, Sauger, Fanfare
  src/symbole.js   SVG-Zeichen für Reiter, Werkzeuge und Maschinen
  src/szene.js     Canvas: Lagerhalle bei Tag mit Haufen, Förderband-Ansicht
  src/ui.js        Reiter, Einblendungen, Speichern, Offline-Nachholen
  sim.mjs          der Auto-Spieler
  build.mjs        baut index.html als eine Datei
```
