# Plan: Spielmodi, ein neues Spiel und ein überarbeitetes Brett

Auslöser: die Sammlung hat zehn Spiele, aber fast jedes kennt nur *eine* Fassung. Wer
Qwixx zum fünften Mal spielt, spielt genau dasselbe Qwixx. Dieser Plan beschreibt, was
sich daran ändert.

Drei Teile:

1. **Ein neues Spiel** — *Mauern*, nach dem Vorbild von Quoridor (das, was auf
   barricade.gg gespielt wird). Ein anderes Spiel als die Sperrsteine, obwohl beide
   Mauern haben.
2. **Modi für alle zehn Spiele** — je Spiel zwei bis vier Fassungen, die sich wirklich
   unterschiedlich anfühlen, nicht bloß andere Zahlen.
3. **Ärger überarbeiten** — größeres, schöneres Brett und eine andere Art der Steuerung.

Dazu am Ende eine Liste weiterer Spiele, die zu zweit taugen.

---

## Wie ein Modus technisch aussieht

Es gibt das Muster schon: `Ärger` und `Wiener Runde` legen eine `VORGABE` an und
speichern die tatsächlich gewählten `regeln` im Spielstand. Das wird jetzt für alle
Spiele einheitlich:

```js
export const MODI = [
  { id: 'klassisch', titel: 'Klassisch', zeile: '…', regeln: { … } },
  { id: 'blitz',     titel: 'Blitz',     zeile: '…', regeln: { … } },
];
```

- **Im Spielstand**, nicht im Gerät. Damit reist der Modus beim Koppeln automatisch mit
  und beide Handys spielen dieselbe Fassung — ohne eine einzige neue Nachricht.
- **Auf dem Startbildschirm** wählbar, in einer Liste mit einer Zeile Erklärung. Wer
  nichts anfasst, bekommt „Klassisch".
- **Ein Test je Modus**, der belegt, dass der Modus tatsächlich etwas ändert — sonst ist
  es Zierde.
- **Alte Spielstände** ohne `regeln` fallen auf die Vorgabe zurück.

---

## Teil 1: *Mauern* — das neue Spiel

### Was es ist

Quoridor (Gigamic, Mirko Marchesi, 1997). Auf barricade.gg heißt es Barricade; der
Play-Store-Eintrag der App heißt bezeichnenderweise `com.quoridor.gg.Quoridor`.

Es hat mit den Sperrsteinen **nur das Wort gemeinsam**:

| | Sperrsteine (Malefiz) | Mauern (Quoridor) |
|---|---|---|
| Würfel | ja | **nein** — reines Denkspiel |
| Figuren | 5 je Seite | **1** je Seite |
| Sperren | 11 gemeinsame, versetzen | **10 eigene je Seite, neu bauen** |
| Zug | würfeln und ziehen | **entweder** ein Feld gehen **oder** eine Mauer setzen |
| Ziel | ein Feld ganz oben | **die gegenüberliegende Reihe** |

### Name

*Quoridor* ist eine Marke von Gigamic, *Barricade* eine von Ravensburger. Regeln sind
frei. Also wie immer in dieser Sammlung: eigener Name, eigene Gestaltung. Es heißt
**Mauern** — das ist zugleich, was man tut, und was man auf Deutsch tut, wenn man auf
Zeit spielt.

### Regeln, die programmiert werden

| Regel | Umsetzung |
|---|---|
| Brett | 9 × 9 Felder |
| Figuren | eine je Seite, in der Mitte der eigenen Grundreihe |
| Zug | **entweder** die Figur ein Feld waagerecht/senkrecht **oder** eine Mauer setzen |
| Mauern | 10 je Seite, zwei Felder lang, zwischen den Feldern, waagerecht oder senkrecht |
| Mauern | dürfen sich nicht überlappen und nicht kreuzen |
| **Wegregel** | eine Mauer darf **niemals** den letzten Weg einer Seite zu ihrer Zielreihe zusperren — das wird bei jedem Setzen geprüft |
| Springen | steht die Gegenfigur direkt daneben, springt man über sie hinweg |
| Schräg | steht hinter ihr eine Mauer oder der Rand, geht es stattdessen schräg an ihr vorbei |
| Ziel | irgendein Feld der gegenüberliegenden Grundreihe |
| Aus | wer keine Mauern mehr hat, kann nur noch laufen |

Die Wegregel ist der Kern: ohne sie ist das Spiel kaputt (man mauert den anderen einfach
ein). Sie wird als Wegsuche über das Gitter geprüft, bevor eine Mauer angenommen wird.

### Modi

| Modus | Was anders ist |
|---|---|
| **Klassisch** | 9 × 9, gegenüberliegende Grundreihen, 10 Mauern je Seite |
| **Kurz** | 7 × 7, 7 Mauern — für zwischendurch |
| **Wettlauf** | beide starten **nebeneinander auf derselben Seite** und müssen beide zur gegenüberliegenden Reihe. Wer zuerst ankommt, gewinnt. Fühlt sich völlig anders an: man behindert jemanden, der denselben Weg will |
| **Ohne Sprung** | Springen abgeschaltet — die Figuren blockieren sich gegenseitig wie Mauern |

---

## Teil 2: Modi für die zehn vorhandenen Spiele

### Qwixx

| Modus | Was anders ist |
|---|---|
| **Klassisch** | wie bisher |
| **Gemischt** | die Zahlen in den vier Reihen stehen in zufälliger Reihenfolge statt 2→12. Man muss jedes Mal neu schauen, wo man ist |
| **Kurz** | zwei Fehlwürfe statt vier beenden das Spiel |

### Dreikampf

| Modus | Was anders ist |
|---|---|
| **Alle drei** | wie bisher: Wissen, Wahrheit, Wagnis |
| **Nur Wissen** | reines Quizduell |
| **Kein Wagnis** | für Orte, an denen Mutproben unangebracht sind (Flugzeug!) |
| **Schnell** | Zeitlimit je Frage |

### Cabo

| Modus | Was anders ist |
|---|---|
| **Klassisch** | vier Karten |
| **Sechs Karten** | mehr zu merken, deutlich schwerer |
| **Ohne Kräfte** | Peek, Spy und Swap raus — reines Gedächtnis |
| **Blitz** | eine einzige Runde entscheidet |

### Sky Team

| Modus | Was anders ist |
|---|---|
| **Montréal** | wie bisher, der Übungsflughafen |
| **Zürich** | Seitenwind: eine zusätzliche Achse, die ausgeglichen werden muss |
| **Tokio** | ein Würfel weniger je Runde |
| Freischaltung | wer einen Flughafen schafft, bekommt den nächsten angeboten |

### Galgenmännchen

| Modus | Was anders ist |
|---|---|
| **Klassisch** | elf Fehlversuche |
| **Hart** | sieben Fehlversuche, keine Tipps |
| **Vokale kosten** | A, E, I, O, U zu raten kostet einen Fehlversuch — man muss mit Konsonanten anfangen |
| **Doppelwort** | zwei Wörter gleichzeitig, ein Strichvorrat |

### Ärger

| Modus | Was anders ist |
|---|---|
| **Klassisch** | vier Figuren, nur mit einer Sechs heraus |
| **Blitz** | zwei Figuren, jede Zahl bringt heraus — halbe Spielzeit |
| **Bösartig** | Schlagen ist Pflicht |
| **Zwei Würfel** | beide werfen, einen davon benutzen — viel mehr Entscheidungen |

### Seeschlacht

| Modus | Was anders ist |
|---|---|
| **Klassisch** | 10 × 10, zehn Schiffe |
| **Kurz** | 8 × 8, sechs Schiffe |
| **Salvo** | pro Zug so viele Schüsse auf einmal, wie man noch Schiffe hat; die Treffer werden erst danach gemeldet |
| **Sonderwaffen** | drei Einsätze je Partie, jeder einmal: **Luftschlag** (drei Felder in einer Reihe), **Radar** (meldet nur, wie viele Schiffsteile in einem 3 × 3-Feld liegen), **Mine** (ein eigenes Feld verminen — wer daraufschießt, setzt einen Zug aus) |

### Hütchenjagd

| Modus | Was anders ist |
|---|---|
| **Klassisch** | vier Hüte |
| **Kurz** | drei Hüte |
| **Beutejagd** | nicht alle Hüte heimbringen zählt, sondern wer zuerst drei fremde gefangen hat |

### Wiener Runde

| Modus | Was anders ist |
|---|---|
| **20 / 40 / 60 Runden / bis zur Pleite** | wie bisher |
| **Schnellstart** | jede Seite beginnt mit drei zufälligen Orten — Handel und Bau kommen sofort in Gang |
| **Versteigerung** | wer nicht kauft, bietet die Gegenseite mit |

### Sperrsteine

| Modus | Was anders ist |
|---|---|
| **Klassisch** | elf Steine, die erste Figur oben gewinnt |
| **Mauerschlacht** | fünfzehn Steine — jede Reihe eine Mauer |
| **Alle fünf** | alle Figuren müssen ins Ziel. Lange Partie, ganz andere Abwägung |

---

## Teil 3: Ärger überarbeiten

Was heute nicht gut ist:

- Das Brett ist ein 11 × 11-Kreuz aus gleich großen Kringeln. Es füllt den Bildschirm
  schlecht aus, und Bahn, Haus und Basis sehen fast gleich aus.
- Gesteuert wird durch Antippen der Figur. Bei mehreren möglichen Zügen ist nicht auf
  einen Blick zu sehen, welcher welcher ist.

Was geändert wird:

1. **Größeres Brett, klarere Zonen.** Die Bahn wird als durchgehender Weg gezeichnet,
   nicht als lose Punktreihe. Basis und Haus bekommen eigene Formen und eine Beschriftung,
   die Startfelder eine Markierung. Die Felder werden größer — sie sind heute kleiner
   als ein Daumen.
2. **Zug statt Figur antippen.** Wie bei den Sperrsteinen: die ziehbaren Figuren
   leuchten, das Antippen zeigt den *Zielpunkt*, und der wird angetippt. Bei genau einer
   Möglichkeit reicht weiterhin ein Tipp.
3. **Der Zug wird gezeigt, bevor er passiert.** Eine dünne Linie von der Figur zum Ziel,
   und ein rotes Ziel, wenn dort geschlagen wird.
4. **Vier Modi** wie oben.

---

## Weitere Spiele, die zu zweit taugen

Sortiert danach, was ich für diese Sammlung am meisten empfehle.

| Spiel | Warum | Aufwand |
|---|---|---|
| **Schnapsen (66)** | *das* österreichische Zwei-Personen-Kartenspiel. Passt zum Wien-Urlaub wie kein zweites, und es ist gemeinfrei. Auf zwei Handys sogar besser als auf Karten, weil das Verdecken von selbst funktioniert | mittel |
| **Backgammon** | der Reiseklassiker überhaupt, exakt für zwei, Würfel plus echte Entscheidungen. Brett passt hochkant aufs Handy | mittel |
| **Mühle** | in zwei Minuten erklärt, überraschend tief. Winziges Brett, ideal fürs Handy | klein |
| **Käsekästchen** | das Papierspiel mit den Punkten und Kästchen. Reines Antippen, keine Regeln zu lernen, und die Endphase ist echte Taktik | klein |
| **Reversi** | zwei Regeln, hundert Partien. Sehr gutes Format für ein Handy | klein |
| **Ultimate Tic-Tac-Toe** | neun kleine Felder in einem großen; dein Zug bestimmt, in welchem der andere spielen muss. Aus Kinderkram wird ein richtiges Spiel | klein |
| **Kniffel** | kennt jeder, würfelt sich gut, und der Blockzettel ist auf dem Handy sogar bequemer | klein |
| **Stadt Land Fluss** | auf zwei Handys endlich ohne Zettel und ohne Streit ums Zeitnehmen. Auswertung Punkt für Punkt | mittel |
| **Wer bin ich?** | ein Handy an die Stirn, der andere gibt Hinweise. Braucht keine Tastatur und funktioniert im Flugzeug ausgezeichnet | klein |
| **Schwimmen (31)** | schnelles Kartenspiel, drei Leben, kurze Runden | klein |
| **Set** | Mustersuche gegeneinander, beide sehen dieselben zwölf Karten und drücken, wer zuerst etwas sieht. Auf einem Handy zu zweit spielbar | mittel |
| **Codenames Duett** | kooperatives Worträtsel, ausdrücklich für zwei gebaut. Braucht eine gute Wortliste — die haben wir vom Galgenmännchen schon halb | groß |

Nicht empfohlen, obwohl naheliegend: **Schach** (zu zweit auf einem Handy zwar leicht zu
bauen, aber wer Schach spielen will, hat längst eine bessere App) und **Rommé/Canasta**
(zu lange Partien fürs Handy, und zu zweit nur halb so gut).


---

## Umgesetzt — und was dabei anders kam als geplant

Stand nach der Umsetzung: **39 Fassungen über zehn Spiele**, alle im Browser gestartet und
ohne Konsolenfehler.

| Spiel | Fassungen |
|---|---|
| Qwixx | Klassisch · Gemischt · Kurz |
| Dreikampf | Alle drei · Nur Wissen · Ohne Mutproben · Nur persönlich |
| Cabo | Klassisch · Sechs Karten · Ohne Kräfte · Blitz |
| Sky Team | **hatte schon elf wählbare Flughäfen** — mehr als geplant |
| Galgenmännchen | Klassisch · Hart · Vokale kosten · Doppelwort |
| Ärger | Klassisch · Blitz · Bösartig · Zwei Würfel |
| Seeschlacht | Klassisch · Kurz · Salve · Sonderwaffen |
| Hütchenjagd | Klassisch · Kurz · Beutejagd |
| Wiener Runde | Klassisch · Schnellstart · Versteigerung · Bis zur Pleite |
| Sperrsteine | Klassisch · Mauerschlacht · Alle fünf |
| Mauern | Klassisch · Kurz · Wettlauf · Sparsam · Festung |

**Abweichungen vom Plan, jeweils mit Grund:**

- **Sky Team** bekam keine neuen Modi. Die elf Flughäfen (Montréal bis Tokio, mit
  Seitenwind, Verkehr und höherem Anflug) sind bereits genau das, was der Plan wollte —
  nur feiner abgestuft. Etwas danebenzustellen hätte nur verwirrt.
- **Galgenmännchen „Doppelwort"** ist nicht als zweite Runde nebenher gebaut, sondern als
  zwei Wörter mit einem Leerzeichen dazwischen. Leerzeichen sind ohnehin Trenner und
  stehen von Anfang an da; damit teilen sich beide Wörter denselben Strichvorrat, ohne
  dass das Regelwerk eine zweite Runde kennen müsste.
- **Wiener Runde „Versteigerung"** ist keine Auktion. Zu zweit gäbe es nur ein Gebot —
  also bekommt die Gegenseite den Ort schlicht zum Listenpreis angeboten.
- **Ein geplanter Modus wurde gemessen und verworfen:** Mauern *ohne Sprung*. Dort gewinnt
  die anziehende Seite 71 %, weil die Zugparität allein entscheidet, wer ausweichen muss.

**Ein Muster für alle:** die gewählte Fassung steht als `regeln` im Spielstand, nicht im
Gerät. Sie reist beim Koppeln damit von selbst mit, ohne eine einzige neue Nachricht.
Gelesen werden Regeln überall mit Rückfall auf die Vorgabe — ein Spielstand, der vor den
Fassungen gespeichert wurde, verhält sich sonst nach dem Update plötzlich anders. Genau
das hat ein bestehender Ärger-Test aufgedeckt, als er rot wurde.
