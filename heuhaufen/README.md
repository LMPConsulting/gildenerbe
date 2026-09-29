# Heuhaufen — sechs Millionen Halme, sechs Nadeln

Du wachst in einer Lagerhalle auf, die Tore sind zu. Vor dir ein Heuhaufen mit rund sechs
Millionen Halmen, irgendwo darin sechs Nadeln. Du hast eine Schaufel und einen
Metalldetektor. Schaufle von Hand, verkauf das Heu an der Ankaufklappe und steck das Geld
in Förderbänder und Maschinen, bis du nicht mehr selbst graben musst.

**Komplett offline.** Eine einzige HTML-Datei, kein Server, keine Bibliotheken, keine
Bilder und keine Audiodateien: Halle und Haufen werden gezeichnet, alle Geräusche erzeugt.

> Nachgebaut nach *Find The Needle* (FindTheNeedleDev / Hay Passionates, Steam, Demo
> September 2026). Übernommen sind Idee und Spielablauf, nicht Name, Grafik oder Texte.
> Weil sich das Original in 3D mit frei verlegten Bändern spielt, ist die Halle hier auf
> das Wesentliche fürs Handy verdichtet: Maschinen kaufen, Strom, Band und Scanner im
> Gleichgewicht halten, statt jeden Förderbandmeter selbst zu legen.

## Spielen

**Direkt aus dem Spiel heraus:** Menü → **Spiel als Datei sichern** legt `Heuhaufen.html`
in den Downloads-Ordner. Die Datei läuft auch ohne Netz.

**Am Rechner:** `heuhaufen/index.html` doppelklicken.

**Im Dev-Server:** `npm run dev`, dann `http://localhost:5173/heuhaufen/`.

**Bauen:** `npm run heuhaufen:build`.

Der Spielstand liegt im Browser (localStorage) und wird alle fünf Sekunden sowie beim
Schließen gesichert. Wer weg ist, dessen Halle arbeitet weiter: zwei Stunden mit halber
Kraft, mit der Forschung *Nachtschicht* und *Nachtwächter* bis zu zwölf Stunden und 100 %.

## Ablauf

| Phase | Was du tust |
|---|---|
| Von Hand | Auf den Haufen tippen, die Tasche füllt sich. Volle Tasche zur Ankaufklappe tragen. |
| Werkzeug | Eimer, Schubkarre, Heugabel, Doppelgabel, Staubsauger (gedrückt halten, bis er überhitzt). |
| Drohnen | Fliegen Heu von allein zum Ankauf. Bis zu 13 Stück. |
| Automatisierung | Greifarme holen Heu aufs Förderband. Strom kommt aus Heu-Generatoren, die vom Band fressen. |
| Scanner | Ohne Scanner rutschen Nadeln ungesehen in den Ausschuss. Faustregel: ein Scanner für zwei Arme. |
| Verarbeitung | Pressballen, Heupellets, Heubrei, Wickelballen, Heupapier, Öko-Ziegel — jede Stufe bringt mehr pro Halm. |
| Ende | Nach der sechsten Nadel gehen die Tore auf. Danach wartet ein neuer, anderthalbmal so großer Haufen mit Bonus. |

**Der Haufen schrumpft als Volumen.** Bei halbem Rest ist er noch 79 % so hoch — am
Anfang tut sich optisch fast nichts. Das ist Absicht; der Zähler oben zählt jeden Halm.

**Der Metalldetektor** piept schneller, je näher die nächste Nadel ist. Mit *Lauter
Piepser* sagt er „kalt“, „warm“, „heiß“; mit dem *Nadelkompass* die genaue Zahl der Halme.

**Die Nadeln** geben winzige, fast lächerliche Boni (Griff +1 %, Tasche +1 Halm …) und je
ein Stück Geschichte. Eine Nadel, die ungescannt durchs Band rutscht, landet im
**Ausschuss**. Dort findet man sie mit 30 Griffen von Hand oder mit einem Nadelsichter.

**Fundstücke** stecken im Heu, von der Hühnerfeder bis zum goldenen Ei, in fünf
Seltenheiten. Jede neu entdeckte Art macht alles 1 % mehr wert. Maschinen legen
Fundstücke nur beiseite, wenn Fundsortierer am Band stehen.

## Forschung

Wie im Vorbild ist der Forschungsbaum nach **Schritten vom Start** aufgebaut: jede Spalte
eine Stufe tiefer. 96 Knoten mit zusammen **320 Upgrade-Stufen** in acht Ästen:

Hofarbeit · Werkzeug · Hofbau · Erkennung · Förderung · Strom · Verarbeitung · Handel

Oben lässt sich der Baum durchsuchen. Grün umrandete Karten sind gerade bezahlbar; der
Reiter zeigt, wie viele es sind.

## Balance

Ein Auto-Spieler (`heuhaufen/sim.mjs`) spielt ganze Haufen durch: er sticht dreimal pro
Sekunde, geht mit voller Tasche zum Ankauf und kauft immer das Billigste, was ihm etwas
bringt. `node scripts/heuhaufen-messung.mjs` ergibt über fünf Seeds:

| | Median |
|---|---|
| Heugabel | 4 min |
| Automatisierung | 32 min |
| erste Nadel | 34 min |
| Hälfte des Haufens | 111 min |
| sechste Nadel | 147 min |

Der Auto-Spieler tippt ohne Pause; wer zwischendurch das Handy weglegt, braucht länger,
bekommt dafür aber die Offline-Stunden der Halle geschenkt. Beim ersten Haufen bleibt
etwa ein Viertel der Forschung unerforscht, für den nächsten.

`tests/heuhaufen/balance.test.js` hält diese Grenzen fest: Halle zwischen 15 und 60
Minuten, erste Nadel unter zwei Stunden, alle sechs zwischen 90 Minuten und 6 Stunden.

## Aufbau

```
heuhaufen/
  src/daten.js     alle Zahlen: Techtree, Maschinen, Produkte, Fundstücke, Nadeln, Geschichte
  src/engine.js    Spiellogik ohne DOM, speicherbar als JSON, eigener Zufall im Stand
  src/format.js    Zahlen und Geld auf Deutsch
  src/klang.js     Web-Audio: Rascheln, Kasse, Detektor, Sauger, Fanfare
  src/symbole.js   SVG-Zeichen für Reiter, Maschinen und Fundstücke
  src/szene.js     Canvas: Lagerhalle mit Haufen, Förderband-Ansicht
  src/ui.js        Reiter, Einblendungen, Speichern, Offline-Nachholen
  sim.mjs          der Auto-Spieler
  build.mjs        baut index.html als eine Datei
```
