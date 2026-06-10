# Gildenerbe (Guild Legacy) — Design-Dokument

> **Arbeitstitel:** *Gildenerbe* / *Guild Legacy* (umbenennbar)
> **Genre:** Aktives Action-RPG-Roguelite mit Idle-/Automatisierungs-Meta-Progression
> **Vibe:** Classic-MMORPG (WoW-Classic-inspiriert), eigenständige IP, Pixelart + Chiptune
> **Plattform:** Android-App, **100 % offline** (Capacitor-APK), Hochformat, Touch
> **Status:** Vision-Spec (Richtung freigegeben am 2026-06-10). Implementierung beginnt mit dem **v1 Vertical Slice** (Kapitel 18).

---

## Inhaltsverzeichnis

1. Vision & Designsäulen
2. Der Kern-Loop (zwei Ebenen + Reroll)
3. Der Held: Klassen, Stats, Fähigkeiten
4. Kampfsystem & Formeln
5. Die drei Minigames
6. Welt, Zonen & Leveldesign
7. Gegner & Bosse
8. Loot & Itemisierung
9. Berufe & Crafting (Automatisierungs-Rückgrat)
10. Die Gildenhalle (Meta-Basisbau)
11. Währungen & Wirtschaft (mit Formeln)
12. Talente (Draft-System)
13. Events & Reroll-Modifikatoren
14. Progression, Pacing & Offline/Idle
15. Art-Direction (Pixelart)
16. Audio-Direction (Chiptune)
17. Technische Architektur
18. v1 Vertical Slice (Umfang)
19. Roadmap nach v1
20. Risiken & offene Punkte

---

## 1. Vision & Designsäulen

**Pitch:** Du bist Gildenmeister. Jeder „Run" verkörperst du einen frisch angeworbenen **Helden**, der aktiv durch eine klassische Fantasywelt zieht — kämpfen, sammeln, craften, angeln, Runen-Puzzles lösen, Zonen und Dungeons erobern. Fällt der Held (riskanter Tod) oder geht er in den Ruhestand, werden seine Taten zu **Erbe**, das deine bleibende **Gildenhalle** dauerhaft stärkt. Der nächste Held startet schneller und mächtiger. So kommst du iterativ immer weiter.

**Designsäulen (jede Entscheidung dient diesen):**

1. **Aktiv im Kern.** Der Spieler *spielt* — steuert Kämpfe, trifft Timing-Fenster, löst Puzzles. Kein reines Zahlen-Anstarren.
2. **Automatisierung ist verdient, nicht geschenkt.** Jede Tätigkeit ist zuerst aktiv. Wer sie *meistert*, schaltet eine Automatisierung frei, die die Arbeit abnimmt **und** verbessert (Effizienz-Upgrade).
3. **Roguelite-Reroll mit bleibendem Account.** Helden sind vergänglich, die Gildenhalle ist permanent. Variety pro Run (Talent-Draft, Loot, Modifikatoren), Fortschritt über Runs (Erbe, Gebäude, Klassen, Rezepte).
4. **Stetiges Optimieren.** Gear, Builds, Crafting-Ketten, Gebäude-Level — überall gibt es eine bessere Konfiguration zu finden.
5. **Offline-fähig & handytauglich.** Alles lokal, Daumen-Bedienung, kurze aktive Sessions + Offline-Fortschritt.

**Anti-Ziele (YAGNI):** kein Online/Multiplayer, kein Echtgeld/Shop, keine Server, keine Cloud-Pflicht, kein riesiges Open-World-Streaming. Bewusst fokussiert.

---

## 2. Der Kern-Loop (zwei Ebenen + Reroll)

### Ebene A — Der Run (aktiv, pro Held)
Klasse wählen → Zonen-Knotenkarte durchziehen → Mobs/Elites kämpfen, sammeln, craften, angeln, verzaubern → Dungeon-Boss → nächste Zone → Level & Gear & Talente steigern → so weit pushen, wie es geht.

### Ebene B — Die Gildenhalle (persistent, Account)
Run-Beute (Erbe + Materialien + Rezepte + Ruf) → in Gebäude/Automatisierungen/Klassen/Forschung investieren → permanente Boni.

### Der Reroll (Bindeglied)
Ein Held endet auf zwei Wegen:
- **Fall (Tod):** Stirbt der Held in einem Kampf, endet der Run sofort (Hardcore-Spannung). **Aber:** seine bis dahin gesammelten Taten werden voll zu Erbe — Tod ist kein Totalverlust, sondern „Ernte".
- **Ruhestand (freiwillig):** Jederzeit am Gildenhallen-Schrein wählbar. Wandelt den Helden geordnet in Erbe um (+kleiner Ruhestands-Bonus), wenn Fortschritt stockt.

Beides → **Erbe** → Gildenhalle stärken → neuer Held startet besser (Trainingshalle-Level, Start-Gear, bekannte Rezepte, freigeschaltete Klassen). → „immer wieder weiterkommen".

> Designnotiz Hardcore: Der Tod muss sich *fair* anfühlen. Gegenmaßnahmen: deutliche Boss-Telegraphen, Flucht-Option aus Kämpfen (mit Beute-Abzug), Heiltränke, eine einmalige „Federzauber"-Rettung pro Run (freischaltbar). So bleibt Spannung ohne Frust.

---

## 3. Der Held: Klassen, Stats, Fähigkeiten

### Primärattribute
| Attribut | Effekt | Skalierung |
|---|---|---|
| **STR** (Stärke) | Angriffskraft (Nahkampf) | 1 STR = +2 AP |
| **AGI** (Beweglichkeit) | Angriffskraft (flink), Krit, Ausweichen | 1 AGI = +2 AP, +0,05 % Krit |
| **INT** (Intelligenz) | Zaubermacht, Max-Mana, Zauber-Krit | 1 INT = +1 SP, +15 Mana |
| **STA** (Ausdauer) | Lebenspunkte | 1 STA = +10 HP |

### Abgeleitete Werte
- **HP** = 50 + Level·10 + STA·10
- **AP** (Angriffskraft) → erhöht Waffenschaden-Beitrag
- **Krit** = 5 % + AGI-Anteil + Gear; **Krit-Schaden** = ×2,0
- **Rüstung → Schadensreduktion:** `DR = Armor / (Armor + 50·EnemyLevel + 400)` (gedeckelt ~75 %)
- **Tempo/Haste** → kürzere Auto-Angriff-Intervalle & Cooldowns
- Ausweichen/Blocken/Parieren → Vermeidung (rollenabhängig)

### Klassen (Start + freischaltbar)
| Klasse | Ressource | Primärstat | Rolle | Freischaltung |
|---|---|---|---|---|
| **Krieger** | Wut (0–100, baut auf) | STR | Tank/DD | **Start** |
| **Magier** | Mana | INT | AoE-DD | Erbe + „Magiergilde"-Ruf |
| **Schurke** | Energie (regeneriert schnell) | AGI | Burst-DD | Erbe-Meilenstein |
| **Priester** | Mana | INT | Heiler/DD | Erbe-Meilenstein |
| **Jäger** *(post-v1)* | Fokus | AGI | Ranged + Pet | Roadmap |
| **Paladin** *(post-v1)* | Mana | STR | Tank/Heal-Hybrid | Roadmap |

### Beispiel-Kit: **Krieger** (v1-Klasse, voll ausdesignt)
Wut baut durch Auto-Angriffe (+10) und erlittenen Schaden auf; wird von Fähigkeiten verbraucht.

| Fähigkeit | Kosten | CD | Effekt | Freischaltung (Lvl) |
|---|---|---|---|---|
| **Auto-Angriff** | – | 2,0 s | Waffenschaden, +10 Wut | 1 |
| **Heldenhafter Stoß** | 15 Wut | – | 120 % Waffenschaden, sofort | 1 |
| **Schildblock** | 10 Wut | 12 s | +40 % Block für 6 s (Verteidigung) | 2 |
| **Wirbelwind** | 25 Wut | 6 s | 80 % Schaden an *allen* Gegnern (AoE) | 4 |
| **Schlachtruf** | 20 Wut | 30 s | +10 % Gruppenschaden, 20 s | 6 |
| **Hinrichten** | 25 Wut | 8 s | 250 % Schaden an Zielen < 20 % HP | 8 |
| **Berserkerwut** *(Kapstein)* | 30 Wut | 90 s | +30 % Tempo & Lebensraub, 12 s | Talent |

Andere Klassen erhalten je 5–7 Fähigkeiten in gleicher Struktur (siehe Roadmap). Daten-getrieben in `data/classes/*.json`, damit Balancing = Datenpflege ist.

---

## 4. Kampfsystem & Formeln

### Ablauf (das Kampf-Minigame)
- **Echtzeit, taktisch, touch-first.** Links die Gruppe (v1: Held solo, später bis 4), rechts die Gegner. Auto-Angriff läuft selbstständig.
- **Aktionsleiste** unten (Daumenzone): Fähigkeiten-Buttons mit Cooldown-Ring, Ressourcenbalken (Wut/Mana/Energie), HP-Balken.
- **Tempo-Regler** 1×/2× und **Pause** (Planung).
- **Boss-Telegraphen:** Boss zeigt Cast-Leiste/Markierung → Reflex-Fenster: rechtzeitig **Unterbrechen** / **Blocken** / **Ausweichen** tippen → Schaden halbieren/vermeiden. (Verbindet Kampf mit dem Reflex-Pfeiler.)
- **Flucht:** Aus Nicht-Boss-Kämpfen fliehbar (Beute-Abzug), reduziert Frust.

### Schadensformel
```
Treffer = AbilityBase · (Krit ? 2,0 : 1,0) · (1 − ZielDR) · Varianz(0,9–1,1)
AbilityBase = Waffenschaden · AbilityCoef + AP · AbilityAPCoef (+ SP-Anteil bei Zaubern)
```

### Gegner-Skalierung
```
Gegner-HP   = BasisHP  · Level^1,8 · ZonenMult
Gegner-DMG  = BasisDMG · Level^1,5
Gegner-XP   = round(8 · Level^1,3)
```

### Held-Progression
```
XP bis nächstes Level = round(100 · Level^1,5)
Levelcap: v1 = 10; Vollspiel = 30 (skalierbar, NG+ erhöht effektiven Tier)
```

### Beispiel-Tuning (Krieger, Lvl 1–10, illustrativ)
| Lvl | HP | AP (nackt) | XP→next |
|---|---|---|---|
| 1 | 80 | 14 | 100 |
| 3 | 120 | 22 | 520 |
| 5 | 170 | 32 | 1.118 |
| 8 | 260 | 50 | 2.263 |
| 10 | 330 | 64 | 3.162 |

Alle Konstanten leben in `data/balance.json` und werden durch Unit-Tests + Tuning-Pässe geprüft.

---

## 5. Die drei Minigames

### (A) Kampf — *aktiv → Auto-Resolve*
Siehe Kapitel 4. **Automatisierung:** Ein Begegnungstyp/Dungeon, der 5× **ohne Tod** gemeistert wurde, schaltet einen **Auto-Modus** frei: der Kampf wird sofort/offline aufgelöst (zu ~90 % Effizienz). So farmt man Bekanntes passiv und konzentriert sich aufs nächste Frontier-Ziel.

### (B) Reflex/Timing — *Angeln & Perfektes Wirken*
- **Angeln:** Schwimmer auswerfen → nach 2–6 s beißt es (Ausrufezeichen + schrumpfender Ring) → im Fenster tippen → Fang. Engeres Fenster = seltenerer Fisch (Kochmats, Erbe-Tröpfchen, selten Loot/Rezept). **Auto:** „Fischteich"-Gebäude / Auto-Angler fängt passiv zu geringerem Ertrag.
- **Perfektes Wirken (Crafting/Casting):** Beim Craften (und für Krit-Fenster im Kampf) wandert ein Marker über eine Leiste mit „Perfekt-Zone" → im Fenster tippen → Qualitätsbonus (höhere Seltenheitschance, weniger Mats). **Auto:** Auto-Crafter produziert zu fixer Durchschnittsqualität.

### (C) Logik/Rätsel — *Verzauberung (Runen-Puzzle)*
- **Mechanik v1: „Runen-Verbindung" (Flow/Connect).** Gitter (z. B. 5×5–7×7) mit Runenpaaren; verbinde gleiche Runen mit Pfaden ohne Kreuzungen und fülle das Brett. Lösen = **ein Verzauberungs-Affix** auf ein Gear-Teil (z. B. +Krit, +SP) + ggf. Rezept-Freischaltung. Schwerere Bretter = bessere Affixe.
- Skaliert sauber in Schwierigkeit (Gittergröße, Hindernisse, Multi-Element-Constraints) und ist top für Touch.
- **Auto:** „Verzauberungskammer" wendet bekannte Affixe automatisch zur Basistier an (ohne Puzzle, ohne Bonus-Tier).

> Erweiterbarkeit: Später können weitere Puzzle-Varianten (Sudoku-artige Runenmatrix, Verdrahtungslogik) als alternative Verzauberungsarten dazukommen.

---

## 6. Welt, Zonen & Leveldesign

### Struktur
Die Welt = Abfolge von **Zonen**, nacheinander freigeschaltet. Jede Zone hat: Thema, Levelbereich, Mob-Set, 1–2 Elites, Sammelknoten (Erz/Kräuter/Fisch), 2–4 Quests/Events und einen **Dungeon mit Boss**, der die nächste Zone freischaltet.

### Zonen-Knotenkarte (Run-Variety, roguelite)
Innerhalb einer Zone bewegt sich der Held über eine **verzweigte Knotenkarte** (Pfad aus Begegnungen, à la „Karte mit Abzweigungen"): jeder Knoten ist Kampf / Sammelstelle / Quest-Event / Rast / Elite / Schatz. Bosskonten am Ende. Layout wird pro Run aus einem Seed generiert → Wiederspiel-Abwechslung.

### Zonenfolge (Vollspiel; **v1 = Zone 1–2**)
| # | Zone | Lvl | Gegner | Sammeln | Dungeon (Boss) |
|---|---|---|---|---|---|
| 1 | **Eichhain** | 1–5 | Wölfe, Räuber, Keiler | Kupfererz, Friedensblume | Räuberlager (*Hauptmann Krell*) |
| 2 | **Stollentiefe** | 5–10 | Kobolde, Höhlenspinnen, Schlamm | Zinnerz, Höhlenpilz | Verschüttete Mine (*Spinnenmatriarchin*) |
| 3 | **Modersumpf** | 10–16 | Gnolle, Schlangen, Untote | Eisenerz, Sumpfkraut | Versunkene Krypta (*Nekromant Vael*) |
| 4 | **Frostkamm** | 16–22 | Yetis, Eiselementare | Mithril, Frostlotus | Eishöhle (*Frostwyrm-Brut*) |
| 5 | **Aschefeste** | 22–28 | Dämonen, Höllenhunde | Thorium, Aschekraut | **Raid:** Aschefeste (3 Bosse) |
| 6 | **Schattentor** | 28–30 | Schatten, Kultisten | — | **End-Raid:** *Der Schattenfürst* (Mehrphasen) |

Der End-Raid-Clear ist ein „Sieg" → großer Erbe-Schub + natürlicher Reroll-Punkt. Danach **NG+/Tier-Erhöhung** für Endlos-Skalierung.

---

## 7. Gegner & Bosse

### Gegnertiers
- **Trash-Mob:** 1 Fähigkeit, wenig HP. Füllmaterial, Tempo.
- **Elite:** mehr HP, 1–2 Spezials (Enrage, Beschwören), bessere Beute.
- **Dungeon-Boss:** eigene Mechanik (Telegraph→Dodge/Interrupt), 2 Phasen, garantiert selten+ Loot, schaltet nächste Zone frei.
- **Raid-Boss:** 3+ Phasen, mehrere Mechaniken, braucht Gruppe + gutes Gear, droppt episch/legendär, viel Erbe.

### Statblock-Format (`data/enemies/*.json`)
`{ id, name, level, hp, dmg, armor, abilities[], lootTable, xp, copper, erbe, sprite }`

### Beispiel-Gegner (v1, illustrativ)
| Gegner | Lvl | HP | DMG | Besonderheit | Beute |
|---|---|---|---|---|---|
| Waldwolf | 2 | 45 | 8 | Rudel-Bonus | grau/weiß, Wolfsfell, 2–5 Kupfer |
| Räuber | 3 | 70 | 12 | Betäuben | weiß/grün, 5–12 Kupfer |
| Rudelführer *(Elite)* | 4 | 200 | 18 | beschwört 2 Wölfe | garantiert grün |
| Höhlenspinne | 7 | 110 | 16 | Gift-DoT | grün, Spinnenseide |
| Schlammgolem *(Elite)* | 8 | 350 | 22 | verlangsamt | grün/blau |

### Beispiel-Boss: **Banditenhauptmann Krell** (Lvl 5)
- HP 800, DMG 25, Rüstung 200.
- **Phase 1 (100–50 %):** Auto-Angriffe + *Wuchtiger Hieb* (2 s Cast, 60 Schaden → Block/Dodge halbiert).
- **Phase 2 (<50 %):** Enrage (+30 % Angriffstempo), beschwört 2 Räuber-Adds.
- Beute: garantiert grün, 20 % blau (*Krells Streitkolben*, Set-Teil), Kupfer/Silber, viel XP & Erbe.

---

## 8. Loot & Itemisierung

### Seltenheitstiers (Affix-Budget)
| Farbe | Tier | Affixe |
|---|---|---|
| Grau | Schrott | – (Verkauf) |
| Weiß | Gewöhnlich | nur Basiswerte |
| Grün | Ungewöhnlich | 1–2 |
| Blau | Selten | 2–3 (ggf. Proc) |
| Lila | Episch | 3–4 + Set-Potenzial |
| Orange | Legendär | unique, Spezialeffekt |

### Slots (~11)
Waffe (Haupthand), Nebenhand/Schild, Kopf, Brust, Beine, Hände, Füße, Ring ×2, Amulett, Umhang.

### Item-Level (ilvl) & Affixe
ilvl skaliert das Statbudget; Drops skalieren mit Zonen-/Gegnerlevel. Affix-Pool: +STR/AGI/INT/STA, +Krit, +Tempo, +Rüstung, +Lebensraub, +Zaubermacht, On-Hit-Procs. Werte ∝ ilvl.

### Sets
Z. B. **Räubers Garnitur** — 3 Teile: +Krit; 5 Teile: Burst-Proc. Fördert gezieltes Farmen = Optimierung.

### Loot-Quellen
Gegner-Drops (Tabelle nach Tier), Boss (garantiert selten+), Crafting, Angeln (selten), Quest-Belohnungen, **Verzauberung** (fügt Affixe via Puzzle hinzu).

### Optimierungs-Loop
Vergleichen → Upgrades anlegen → verzaubern → Sets jagen → höhere Zonen für höheres ilvl. (Item-Vergleichs-Tooltip mit grünen/roten Stat-Deltas.)

---

## 9. Berufe & Crafting (Automatisierungs-Rückgrat)

### Sammelberufe
Bergbau (Erz), Kräuterkunde (Kräuter), **Angeln** (Fisch), Kürschnerei (Leder, post-v1).

### Handwerksberufe
Schmiedekunst (Platten/Waffen), Alchemie (Tränke), **Verzauberung** (Affixe via Puzzle), Kochkunst (Essens-Buffs aus Fisch).

### Sammeln: aktiv → auto
- **Aktiv:** an einem Knoten tippen → Mats (optional Mini-Timing).
- **Auto:** einen **Gildenhallen-Arbeiter** dem Knotentyp zuweisen → passive Mats/Min, **auch offline**. Gebäude-Upgrade erhöht Rate & schaltet höhere Mat-Tiers frei.

### Crafting-Ketten (das befriedigende Automatisieren)
```
Erz  →[Schmelze]→ Barren  →[Amboss + Rezept]→ Ausrüstung
Kräuter →[Alchemielabor]→ Tränke
Fisch →[Kochstelle]→ Essens-Buffs
```
Jeder Schritt **manuell** (mit Perfekt-Wirken für Qualität) **oder automatisiert** (Auto-Crafter arbeitet eine Warteschlange zu Basisqualität ab). Beispiel: `Kupfererz ×10 →[Schmelze]→ Kupferbarren ×5 →[Amboss]→ Kupfer-Brustplatte (grün)`.

### Rezepte
Aus Drops, Ruf-Händlern, Verzauberungs-Puzzles, Beruf-Leveln. **Rezept-Codex liegt in der Gildenhalle (account-weit)** → jeder neue Held nutzt sofort bekannte Rezepte = Meta-Payoff.

---

## 10. Die Gildenhalle (Meta-Basisbau)

Die persistente Basis. Jedes Gebäude ist **stufenweise ausbaubar** (Erbe + Materialien) mit klar quantifizierten Boni.

| # | Gebäude | Funktion | Skaliert mit Level |
|---|---|---|---|
| 1 | **Anwerbestube** | Helden-Slots, Gefährten/Arbeiter rekrutieren | mehr/bessere Rekruten |
| 2 | **Schmelze & Schmiede** | Auto-Schmelzen & Auto-Craft-Queues | Tempo, höherer Tier, parallele Queues |
| 3 | **Kräutergarten + Alchemielabor** | Auto-Kräuter & Auto-Tränke | Ertrag, Trank-Stärke |
| 4 | **Fischteich** | Auto-Angeln | Fang-Rate, Seltenheit |
| 5 | **Verzauberungskammer** | Auto-Verzauberung bekannter Runen | leichtere Puzzles / besserer Auto-Tier |
| 6 | **Bergwerk** | Auto-Erz | Erz/Min, Erz-Tier |
| 7 | **Trainingshalle** | neuer Held startet auf höherem Level/mit Bonus-Stats | **Reroll-Beschleuniger** |
| 8 | **Schatzkammer** | +Erbe-Gewinn %, höheres Offline-Zeitlimit, Gold-Lager | Erbe-Mult, Offline-Cap |
| 9 | **Archiv/Bibliothek** | Rezept-/Lore-Codex, +XP, Talent-Einsicht | XP-Bonus, Forschung |
| 10 | **Heldengruft** | jeder Ruhestands-Held hinterlässt einen kleinen Dauer-Account-Buff | mehr Slots, stärkere Erbstücke |

Die **Heldengruft** belohnt den Reroll-Loop direkt: vergangene Helden „leben weiter" als permanente Mini-Boni.

---

## 11. Währungen & Wirtschaft (mit Formeln)

| Währung | Erhalt | Ausgeben für | Persistenz |
|---|---|---|---|
| **Kupfer/Silber/Gold** (1:100:100) | Drops, Verkauf, Quests | Mats, Händler-Gear, Reparatur | meist pro Run (Teil in Schatzkammer gebankt) |
| **Materialien** | Sammeln (aktiv/auto), Drops | Crafting-Ketten | Gildenhallen-Lager persistent |
| **Erbe (Legacy)** | Held-Umwandlung bei Tod/Ruhestand | Gildenhalle, Klassen-Freischaltung | **persistent (Meta)** |
| **Ruf** (Fraktionen) | Quests, Fraktions-Kills | Rezepte, Händler, Gefährten | persistent je Fraktion |
| **Marken** | Dungeon-/Raid-Clears | Endgame-Gear, Spezial-Rezepte | persistent |

### Erbe-Formel (das Herz der Meta-Progression)
```
Erbe = floor( Held-Level^1,5
             · (1 + ØilvlGear/100)
             · (1 + ZonenGeklärt·0,15)
             · ErfolgsMult )
       · Schatzkammer-Bonus
```
→ Weiter pushen ergibt **immer** mehr Erbe. Optimieren (Gear/Builds) erhöht den ilvl-Faktor.

### Gold-Fluss
Quellen: Kills (level-skaliert), Verkauf grau/weiß, Quests. **Sinks:** Reparatur (Gear-Haltbarkeit), Händler-Rezepte, Auktions-artige Käufe, Crafting-Reagenzien. Gold bleibt relevant, aber nicht der Kern.

### Material-Fluss
Sammeln (aktiv/auto) → Crafting verbraucht. Auto-Sammelrate vs. Craft-Verbrauch ist ein **Tuning-Knopf**: der Spieler optimiert Gebäudelevel, um die Kette auszubalancieren.

---

## 12. Talente (Draft-System)

Jede Klasse hat einen **Talentbaum mit 3 Zweigen** (Krieger: *Waffen / Furor / Schutz*), je ~18–21 Knoten (+% Schaden, neue Fähigkeitsränge, Procs, Kapsteine).

**Roguelite-Twist — Draft:** Bei jedem Level-Up wird eine **Auswahl aus 3 Talent-Optionen** angeboten (teils zufällig gewichtet). So unterscheidet sich jeder Run im Build. **Respec** in der Trainingshalle gegen Gold. → verbindet WoW-Talentbäume mit Roguelite-Drafting (Wunsch: Variety pro Reroll).

---

## 13. Events & Reroll-Modifikatoren

### Welt-Events (im Run, zufällig auf der Knotenkarte)
- **Invasion:** Welle-Verteidigung; Belohnung: extra Erbe + Mats.
- **Schatzfund:** kleines Puzzle/Skill-Check → Bonus-Loot/Gold.
- **Wandernder Händler:** seltenes Gear/Rezepte gegen Gold.
- **Verfluchter Schrein:** Risiko/Belohnung — Debuff akzeptieren für mächtigen Buff.
- **Rast/Taverne:** heilen, respec, Quest-Hook.
- **Eliten-Patrouille:** optionaler harter Kampf, super Beute.

### Reroll-Modifikatoren (Mutatoren, freischaltbar)
Beim Start eines neuen Helden optional wählbar, geben Bonus-Erbe:
- **Eisenmann:** keine Tränke, +50 % Erbe.
- **Hetzjagd:** Gegner +20 % Tempo, +30 % Erbe.
- **Glücksritter:** bessere Loot-Chance, −XP-Gewinn.
- (Mehr über Account-Fortschritt.) → Wiederspiel-Variety + selbst-gewählte Schwierigkeit.

### Meta-Events (post-v1)
Wöchentlicher Account-Modifikator aus **Tages-Seed** (offline-fähig, kein Server).

---

## 14. Progression, Pacing & Offline/Idle

- **Pro Run:** ~20–60 Min aktiv, um die aktuelle Bestzone zu pushen (länger, je tiefer).
- **Offline-Fortschritt:** Auto-Runs, Auto-Sammeln, Auto-Craft laufen weiter (gedeckelt durch Schatzkammer, Basis 8 h → bis 24 h ausbaubar).
- **„Während du weg warst"-Bildschirm** beim Start (klassischer Idle-Belohnungsmoment): gesammelte Mats, Loot, Gold, Erbe.
- **Meta-Pacing:** erste Rerolls schnell (Gildenhallen-Kern aufbauen), dann schiebt jeder Reroll die Frontier-Zone weiter.
- **Endlos-Skalierung:** Nach End-Raid global **Tier+1** (NG+): Gegner & Belohnungen skalieren, neue Modifikatoren.

### Offline-Berechnung (Logik)
Beim App-Start: `Δt = min(jetzt − letzterSpeicher, Offline-Cap)` → wende Auto-Systeme pro Sekunde/Tick gebatcht an (Mats, gecleartes-Dungeon-Loot, Craft-Queue-Fortschritt) → Zusammenfassung anzeigen.

---

## 15. Art-Direction (Pixelart)

- **Auflösung:** Charaktere/Gegner Basisraster **32×32**, Items/Icons **16×16**, ganzzahlig hochskaliert (knackige Pixel auf dem Handy).
- **Palette:** klassische High-Fantasy, leicht entsättigter „alt-MMO"-Look; feste ~32-Farben-Palette (DB32-artig) für Kohärenz. Seltenheitsfarben wie definiert.
- **UI:** Steinpanel-Rahmen mit Goldzier, Pergament-Tooltips, kräftige Pixel-Schrift, **untere Aktionsleiste** (Daumenzone), Tab-Navigation (*Held / Inventar / Gildenhalle / Karte / Berufe*).
- **Animation:** simple 2–4-Frame Idle/Angriff; Treffer-Blitze; **schwebende Schadenszahlen** (Farbe nach Seltenheit/Krit = „Juice").
- **Erstellung:** prozedural/handgezeichnete Pixel-Sprites via `game-assets`-Skill + Canvas, konsistente Palette, **vollständig selbst erzeugt**, keine externen Assets.

### v1-Sprite-Liste (Auszug)
Krieger (idle/attack/hit), 6 Mobs, 2 Bosse, ~30 Item-Icons, Sammelknoten (Erz/Kraut/Fisch), Gebäude-Icons, UI-Rahmen/Buttons, Schrift-Atlas.

---

## 16. Audio-Direction (Chiptune)

- **Engine:** **Web Audio API, prozedural** — Oszillatoren (Square/Triangle/Saw/Noise) für 8-Bit/NES-Palette, kleiner Tracker-/Sequencer-Kern. **Keine Audiodateien** → winzige APK, echt offline.
- **Musik:** ein Loop-Thema je Zone (eigene Tonart/Stimmung), Stadt/Gildenhalle-Thema, Boss-Thema, Sieg-Fanfare. Aus Notendaten generiert.
- **SFX:** Angriff, Krit, Block, Level-Up, **Loot-Ping (Tonhöhe nach Seltenheit)**, Klicks, Angel-Platsch, Puzzle-Lösungs-Chime, Münzen.
- **Steuerung:** Musik-/SFX-Lautstärkeregler, Stumm. Mobile-Audio startet beim ersten Tap.

---

## 17. Technische Architektur

- **Stack:** **HTML5 + Canvas** (Gameplay-Render) + **HTML/CSS** für Menüs & UI-Panels (scharfer Text, accessible, handytauglich). **Vanilla-JS (ES-Module)**, kein schweres Framework. Optional Vite als Build/Dev-Server.
- **Modulstruktur:**
  - `core/` — Game-Loop, Zeit/Tick, **seeded RNG**, Save/Load, Event-Bus.
  - `data/` — statische Configs (Klassen, Fähigkeiten, Items, Affixe, Gegner, Zonen, Rezepte, Gebäude, Balance). **Daten-getrieben** = Balancing per JSON.
  - `systems/` — combat, loot, crafting, professions, gildenhalle, talents, events, offline-progress.
  - `minigames/` — combat, fishing, enchant-puzzle, perfect-cast.
  - `ui/` — Screens (Held, Inventar, Karte, Kampf, Gildenhalle, Berufe), Komponenten (Bars, Tooltips, Item-Card, Nav).
  - `assets/` — generierte Sprites/Atlas, Palette.
  - `audio/` — Synth-Engine + Track-Daten.
- **Save:** JSON → **Capacitor Preferences/Filesystem** (persistent, offline). Auto-Save bei Schlüssel-Events + Intervall. **Versioniertes Schema** für Migrationen. Optional Export/Import als Datei (Backup).
- **Packaging:** **Capacitor** → `npm run build` → `npx cap sync android` → Gradle `assembleDebug` → **APK** (Sideload). Release-Signing optional. Toolchain (JDK 17 Temurin + Android cmdline-tools/platform/build-tools) wird **zum Packaging-Zeitpunkt installiert** (aktuell nicht vorhanden).
- **Performance:** Ziel 60 fps auf Mittelklasse-Android; Object-Pooling (Schadenszahlen/Partikel), Sprite-Atlas, minimaler GC.
- **Tests:** Unit-Tests für Formeln (Schaden, Erbe, Offline-Calc, Loot-Rolls) — **TDD**, deterministisch via seeded RNG.

---

## 18. v1 Vertical Slice (Umfang)

> Ziel: den **kompletten Loop** Ende-zu-Ende auf dem Handy beweisen. *Dieser Slice ist der Gegenstand des ersten Implementierungsplans.*

- **1 Klasse:** Krieger (5 Fähigkeiten, 1 Talentzweig + Draft).
- **2 Zonen:** Eichhain + Stollentiefe (Knotenkarten), ~6 Mob-Typen, **2 Dungeon-Bosse**. Levelcap 10.
- **Kampf-Minigame:** aktiv, Telegraphen, Auto-Resolve-Freischaltung.
- **Reflex:** Angeln + Perfekt-Wirken (Crafting). **Logik:** Runen-Verbindungs-Puzzle (Verzauberung) — je Grundform.
- **Berufe:** Bergbau, Schmiedekunst, Angeln, Verzauberung (Kette Sammeln→Schmelzen→Craften→Verzaubern).
- **Loot:** alle Seltenheitstiers, ~30 Items, 1 Set, Affixe, Verzauberung.
- **Gildenhalle:** 5 Gebäude inkl. ≥3 Automatisierungen (Auto-Bergwerk, Auto-Run, Auto-Craft) + Trainingshalle + Schatzkammer.
- **Reroll/Erbe-Loop** voll funktionsfähig; **Offline-Fortschritt** + „Während du weg warst".
- **Save/Load** (Capacitor-Storage).
- **Pixelart** für obiges; **Chiptune** für 2 Zonen + Stadt + Boss + Fanfare; Kern-SFX.
- **Als installierbare APK verpackt.**

**v1-Definition-of-Done:** Auf einem echten Android-Handy installierbar, offline spielbar, ein Held kann von Lvl 1 durch beide Zonen, sterben/in Ruhestand gehen, Erbe in die Gildenhalle stecken, ein zweiter Held startet messbar stärker.

---

## 19. Roadmap nach v1

1. **Mehr Klassen** (Magier, Schurke, Priester) + **Gefährten/Gruppe** (bis 4 Slots, Rollen Tank/Heal/DD).
2. **Zonen 3–6** inkl. erstem **Raid** (Mehrphasen-Boss).
3. **Sets & Legendäre**, Sockel/Gems, tiefere Affix-Pools.
4. **Reroll-Modifikatoren**, **NG+/Tier-Skalierung**, Heldengruft-Erbstücke.
5. **Weitere Puzzle-Varianten**, Kochkunst, Kürschnerei, Auktions-artiger Händler.
6. **Achievements, Codex/Lore, Einstellungen** (Save-Export/Import), Accessibility-Optionen.
7. Politur: mehr Animation/Partikel, mehr Musikstücke, Tutorials, Onboarding.

---

## 20. Risiken & offene Punkte

| Risiko | Gegenmaßnahme |
|---|---|
| APK-Toolchain auf Windows (JDK+SDK-Installation) | Scripted Setup; Fallback Android Studio / Online-Build |
| Scope-Creep | strikter v1-Slice; daten-getriebener Content für billige Erweiterung |
| Balancing | Formeln in Daten + Unit-Tests + Tuning-Pässe |
| Pixelart-Menge | kleine konsistente Palette, wiederverwendbare Teile, Skill-Generierung |
| Performance auf dem Handy | Pooling, Atlas, On-Device-Profiling |
| Hardcore-Tod frustet | Telegraphen, Flucht, Tränke, einmalige Rettung; Tod = Erbe-Ernte |

**Offene Punkte für die Implementierungsphase:**
- Endgültiger Name (Arbeitstitel „Gildenerbe").
- Genaue Balance-Konstanten (Tuning-Pass nach erstem spielbaren Build).
- Exakte Puzzle-Schwierigkeitskurve.
- Release- vs. Debug-Signing der APK.

---

*Ende des Design-Dokuments. Nächster Schritt: Implementierungsplan (Skill `writing-plans`) für den v1 Vertical Slice.*
