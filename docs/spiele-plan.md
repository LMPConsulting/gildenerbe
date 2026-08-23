# Plan: vier weitere Reisespiele

Stand: die Sammlung hat fünf Spiele (Qwixx, Dreikampf, Cabo, Sky Team, Galgenmännchen).
Dieser Plan beschreibt vier weitere, wie sie gebaut und wie sie geprüft werden.

## Was gebaut wird — und warum unter eigenem Namen

| Ordner | Titel | Vorbild | Warum so benannt |
|---|---|---|---|
| `aerger/` | **Ärger** | Mensch ärgere dich nicht | Das Spiel stammt von 1907 und ist gemeinfrei; **der Name ist eine eingetragene Marke** von Schmidt Spiele. Regeln übernehmen, Namen nicht. |
| `seeschlacht/` | **Seeschlacht** | Schiffe versenken | Gemeinfreier Klassiker, der Name ist beschreibend. Eigene Zutat: passt von allen am besten auf zwei Handys, weil beide Flotten geheim bleiben. |
| `hut/` | **Hütchenjagd** | Fang den Hut | Regeln aus der Pachisi-Familie, frei. **„Fang den Hut" ist eine Marke** von Ravensburger, das Brett ist deren Gestaltung. Eigenes Brett, eigener Name. |
| `wienerrunde/` | **Wiener Runde** | Monopoly | Der Spielablauf ist frei, aber **Name, Brett, Straßennamen und Kartentexte gehören Hasbro**. Also: derselbe Ablauf, eigenes Brett mit Wiener Orten, eigene Karten. Für einen Wien-Urlaub ohnehin die schönere Fassung. |

Das ist keine Einschränkung des Umfangs — nur der Verzicht darauf, fremde Gestaltung
nachzubauen. Die Spielabläufe bleiben die, die ihr kennt.

## Reihenfolge

Von klein nach groß, jedes einzeln fertig und veröffentlicht, damit nichts hängen bleibt:

1. **Ärger** — überschaubare Regeln, gutes Aufwärmen für die Brettmechanik.
2. **Seeschlacht** — der beste Zwei-Handy-Kandidat der Sammlung.
3. **Hütchenjagd** — Brett aus der Pachisi-Familie, aber ganz andere Spannung: Fangen.
4. **Wiener Runde** — die größte Baustelle, kommt zuletzt.

## Wie gebaut wird

Wie die fünf bestehenden Spiele, ohne Ausnahme:

- **Eine HTML-Datei.** Kein CDN, keine Bibliothek, keine Schrift aus dem Netz. Läuft per
  Doppelklick über `file://` und ohne Internet.
- **Regeln ohne DOM.** `src/engine.js` kennt kein `document`. Alles im Spielstand ist
  serialisierbar — das ist die Voraussetzung dafür, dass zwei Handys denselben Stand
  teilen können und dass sich alles testen lässt.
- **Oberfläche getrennt.** `src/ui.js` rendert, `src/style.css` färbt. Jedes Spiel bekommt
  eine eigene Farbwelt, damit man auf dem Startbildschirm sofort weiß, wo man ist.
- **Zwei Handys** über dieselbe Technik wie bisher: Raumcode über die Durchreiche oder
  QR-Kopplung im selben WLAN (`src/qr.js`, `src/funk.js`, `src/netz.js`, unverändert
  übernommen). Der Gastgeber rechnet, der Gast schickt Züge; was der Gegenseite verborgen
  bleiben muss, wird beim Verschicken herausgefiltert (`standFuer`).
- **Ein Handy** zum Weiterreichen mit Übergabe-Bildschirm überall dort, wo es etwas zu
  verbergen gibt.
- **Regelwerk im Spiel.** Jedes bekommt ein Regel-Overlay, das die Regeln erklärt, die
  tatsächlich programmiert sind — keine allgemeinen Beschreibungen.

## Wie geprüft wird

**Testgetrieben, in dieser Reihenfolge:**

1. **Regeln aufschreiben** — als Tabelle im Plan, bevor eine Zeile Code entsteht.
2. **Tests zuerst.** `tests/<spiel>/engine.test.js` bildet jede Regel als eigenen Fall ab,
   samt Randfällen (überwürfeln, blockierte Felder, Zug nicht möglich, Spielende).
   Die Tests laufen gegen eine Engine, die es noch nicht gibt — sie müssen also erst
   **rot** sein. Das wird bewusst einmal ausgeführt und festgehalten.
3. **Engine bauen**, bis alles grün ist. Kein Feature ohne vorher geschriebenen Test.
4. **Zufall abschalten.** Jede Funktion, die würfelt, nimmt einen Zufallsgeber als
   Argument (`rnd = Math.random`). Im Test wird er ersetzt — damit sind alle Abläufe
   reproduzierbar.
5. **Selbstspieler.** Für die Brettspiele ein einfacher Auto-Spieler, der tausend Partien
   gegen sich selbst spielt. Der prüft nicht Schönheit, sondern: läuft jede Partie zu
   Ende, gibt es Endlosschleifen, ist die Siegverteilung ungefähr gleich, wird nie ein
   ungültiger Zustand erreicht.
6. **Oberfläche im Browser.** Playwright auf 390×844 (Handyformat): eine Partie
   durchklicken, Randfälle ansehen, Querformat prüfen, Konsole muss leer bleiben.
7. **Zwei Geräte.** Zwei Browser koppeln sich über den Textcode, spielen ein paar Züge,
   und bei allem Verdeckten wird geprüft, dass es auf dem anderen Gerät **weder im HTML
   noch im Speicher** auftaucht.
8. **Ohne Netz.** Nach dem Ausrollen: Seite laden, Netz kappen, alle Spiele müssen aus dem
   Vorrat starten.

Erst wenn das alles steht, geht ein Spiel live.

## Regeln, die programmiert werden

### Ärger

| Regel | Umsetzung |
|---|---|
| Brett | Ring aus 40 Feldern, Startfelder auf 0 und 20 |
| Figuren | 4 je Spieler (auf 2 verkürzbar), Basis → Bahn → Haus (4 Felder) |
| Herauskommen | nur mit einer 6 |
| Sechs | berechtigt zu einem weiteren Wurf |
| Drei Würfe | wer keine Figur auf der Bahn hat, darf bis zu dreimal werfen |
| Sechs-Pflicht | bei einer 6 muss zuerst herausgekommen werden; steht die eigene Figur auf dem Startfeld, muss diese zuerst weiter |
| Schlagen | Landen auf einer fremden Figur schickt sie zurück in die Basis |
| Eigene Figur | darf nicht übersprungen … nur im Haus; auf der Bahn darf man nicht auf sie ziehen |
| Haus | muss genau getroffen werden, Überwerfen ist kein Zug |
| Zugzwang | gibt es einen gültigen Zug, muss er gemacht werden |
| Sieg | alle Figuren im Haus |
| Wahlweise | „Schlagen ist Pflicht", 2 statt 4 Figuren, strenge Sechs abschaltbar |

### Seeschlacht

| Regel | Umsetzung |
|---|---|
| Meer | 10 × 10, Spalten A–J, Zeilen 1–10 |
| Flotte | 1×5, 2×4, 3×3, 4×2 — zusammen 10 Schiffe, 30 Felder |
| Legen | von Hand (tippen, drehen) oder auf Knopfdruck automatisch |
| Abstand | Schiffe dürfen sich nicht berühren, auch nicht über Eck (abschaltbar) |
| Schuss | ein Feld je Zug; Treffer bringt einen weiteren Schuss (abschaltbar) |
| Versenkt | wird gemeldet, die Umgebung wird automatisch als Wasser markiert |
| Sieg | alle 10 Schiffe des Gegners versenkt |
| Geheim | die eigene Flotte verlässt das Gerät nicht; der Gegner bekommt nur Treffer und Wasser |

### Hütchenjagd

| Regel | Umsetzung |
|---|---|
| Brett | Ring aus 24 Feldern, vier Höfe in den Ecken |
| Hüte | 4 je Spieler, Start im eigenen Hof, Ziel ist der gegenüberliegende Hof |
| Ziehen | ein Hut je Wurf, im Uhrzeigersinn |
| Fangen | Landen auf einem fremden Hut nimmt ihn unter den eigenen; der Stapel zieht zusammen |
| Befreien | erreicht ein Stapel das Ziel, werden gefangene Hüte an ihren Besitzer zurückgegeben — in dessen Hof |
| Einlaufen | der Zielhof muss genau getroffen werden |
| Sieg | alle vier eigenen Hüte stehen im Zielhof |

### Wiener Runde

| Regel | Umsetzung |
|---|---|
| Brett | 40 Felder, 22 Orte in 8 Farbgruppen, 4 U-Bahn-Linien, 2 Werke |
| Geld | Start 1500 €, über Los 200 € |
| Kaufen | wer auf einen freien Ort kommt, darf kaufen; keine Versteigerung |
| Miete | doppelt bei vollständiger Farbgruppe ohne Häuser |
| Bauen | 4 Häuser, dann ein Hotel; nur gleichmäßig innerhalb der Gruppe |
| U-Bahn | Miete nach Anzahl der besessenen Linien |
| Werke | Miete nach Würfelwurf, ×4 bzw. ×10 |
| Gefängnis | drei Versuche auf einen Pasch, 50 € oder Karte |
| Karten | eigene Ereignis- und Kaffeehauskarten |
| Hypothek | Orte beleihen und auslösen |
| Handel | Angebot Ort gegen Geld, die Gegenseite nimmt an oder lehnt ab |
| Sieg | Gegenseite ist zahlungsunfähig — oder, in der kurzen Partie, nach 30 Runden das größere Vermögen |
