# Heuhaufen 3D — die Halle in der Ich-Perspektive

Dieselbe Geschichte wie in [Heuhaufen](../heuhaufen/README.md), diesmal als echtes
3D-Spiel: Du stehst in der Lagerhalle unter den Stahlbögen, vor dir rund sechs Millionen
Halme, irgendwo darin sechs Nadeln. Du läufst herum, gräbst mit Kinderschaufel, Spaten
und Heugabel, trägst das Heu im Arm, im Eimer oder in der Schubkarre zum Stand und kippst
es in den Trichter. Vom Geld kaufst du Werkzeuge und Forschung, und irgendwann legst du
Förderbänder, stellst Kolbenrechen und Greifarme an den Haufen und ziehst Strom vom
Hausanschluss über Masten zu den Maschinen.

**Komplett offline.** Eine einzige HTML-Datei. three.js (MIT) ist eingebettet, alles
andere ist eigener Code: Halle, Haufen, Werkzeuge und Maschinen werden aus Formen
gebaut, Texturen gezeichnet, Geräusche erzeugt.

> Nachgebaut nach *Find The Needle* (FindTheNeedleDev / Hay Passionates, Steam, Demo
> September 2026). Übernommen sind Idee, Ablauf und Aufbau: die Halle mit dem Stand links
> hinten, Verkauf zu 0,0222 $ pro Halm, Werkzeuge mit Puste, Bänder mit Wegfindung, die am
> Stand einrasten, Kolbenrechen, die Heu im Bogen aufs Band werfen, Greifarme, Scanner,
> Generatoren, Strommasten mit Spannweite, der Laster am Tor für Aufträge, der
> Forschungsbaum „Yard Research“, das Missionsbuch als Karte oben links. Name, Grafik und
> Texte sind eigene.

## Spielen

**Am Rechner:** `heuhaufen3d/index.html` doppelklicken. WASD gehen, Maus umsehen (Klick
fängt den Zeiger), Umschalt rennen, Leertaste springen, E oder Klick für die Aktion,
1–9 Werkzeuge, B Baukatalog, R Forschung, N Nadelbuch, Q drehen und F Einrasten beim
Bauen, Esc zurück.

**Am Handy (quer halten):** links den Daumen aufsetzen und schieben zum Gehen, ganz
nach außen zum Rennen. Rechts wischen zum Umsehen, tippen für die Aktion. Unten die
Werkzeugleiste, rechts der Aktions- und der Sprungknopf.

**Bauen:** `npm run heuhaufen3d:build` (oder `node heuhaufen3d/build.mjs`).

## So läuft es

1. **Von Hand.** Heu stechen, Arme voll, zum Stand. Eimer und Spaten kosten ein paar
   Dollar am Werkzeugstand. Was beim Stechen danebenfällt, rollt den Hang hinunter; der
   Besen fegt es wieder auf.
2. **Nadeln.** Der Metalldetektor piept, je näher eine steckt. Sinkt der Haufen unter eine
   Nadel, glitzert sie obenauf. Jede Art schaltet einen dauerhaften Bonus frei.
3. **Bänder.** Im Baukatalog Anfang und Ende setzen; der Weg dazwischen wird gesucht,
   Enden rasten an Stand, Maschinen, Laster und anderen Bändern ein. Was am Ende niemand
   annimmt, fällt herunter.
4. **Maschinen.** Der Kolbenrechen steht am Haufen und wirft Heu nach hinten, am besten
   aufs Band. Greifarme heben vom Haufen oder einem Band aufs Band vor sich. Scanner
   halten Nadeln fest, Silo, Kompressor und die anderen Verarbeiter machen Waren daraus.
5. **Strom.** Der Hausanschluss liefert 5 kW, Generatoren verbrennen Heu für 15 kW. Masten
   verbinden sich in Spannweite, Maschinen hängen am nächsten Mast. Tippen am Mast
   schaltet das ganze Netz.
6. **Aufträge.** Mit dem Auftragsbuch setzt ein Laster ans Tor. Was auf seiner Ladefläche
   landet, zählt; ist der Auftrag voll, gibt es den Lohn.

## Aufbau

Reine Logik ohne three.js und ohne DOM, mit Tests in `tests/heuhaufen3d/`:
`haufen.js` (Höhenfeld, Abtragen, Rutschen), `werkzeuge.js`, `nadeln.js`, `lose.js`,
`wirtschaft.js`, `gegenstaende.js` (Würfe, Landen, Fangen), `baender.js` (Wegfindung,
Transport), `maschinen.js`, `versorgung.js` (Strom und Wasser), `laster.js`, `drohnen.js`,
`bauen.js`, `automatik.js` (hält alles zusammen), `spiel.js` (Stand, Takt, Speichern).
Darüber `grafik/` (Szene, Halle, Haufen, Ich-Ansicht, Bauten), `ui/` und `main.js`.
