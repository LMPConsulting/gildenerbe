# Gildenerbe v2 — Feedback-Iteration (Übernacht-Plan)

**Quelle:** Spielerfeedback nach v1 (2026-06-10). **Modus:** 5 parallele Agents + Orchestrator-Integration.

## Scope
1. **Dungeon-Kampf** (statt Side-View-Autobattler): begehbare Top-Down-Floors, Joystick-Bewegung,
   Gegner-Aggro-KI, Fähigkeiten in Nahkampf-Reichweite, Boss-Telegraphen als ausweichbare Bodenflächen,
   Truhen, Event-Räume, Ausgang → nächster Floor. Deterministisch + getestet.
2. **Challenge-Minigames:** Schach-Rätsel (5×5, Schlag-/Mattaufgaben) + Speed-Sudoku (4×4/6×6) als Event-Räume.
3. **Visuelle Basis:** Canvas-Szene mit wachsenden Gebäude-Sprites je Stufe, Held steht in der Basis,
   Gebäude antippen → Upgrade-Panel. Paper-Doll-Charakteransicht.
4. **Verteidigung + Doppel-Meta:** Überfall-Wellen (~alle 4 Runs, angekündigt), Basis-HP + Mauer,
   Basis-Fall → **Chronik-Punkte** (Meta-Meta) → permanente Upgrades (Baukosten −, Start-Erbe, Schutz).
   **Missionen:** Späher entsenden (Echtzeit-Dauer) → Beute bei Rückkehr.
5. **Tutorial** (Erst-Start, 6–8 Karten, überspringbar) + **Codex** (Werte-Erklärungen, "?"-Button).
6. **Epische Musik:** mehrstimmige Arrangements (Pads mit langsamem Attack, Vibrato-Lead, Bass,
   Delay-Raum), Stadt-Hymne im Sturmwind-Geist. Format/API bleibt kompatibel.
7. Abschluss: Vollverifikation, APK, **Push zu github.com/LMPConsulting**.

## Datei-Eigentum (strikt disjunkt)
| Wer | Dateien |
|---|---|
| Agent Musik | `src/audio/**`, `tests/audio/**` |
| Agent Dungeon | `src/systems/dungeonSim.js`, `src/ui/dungeonScreen.js`, `tests/systems/dungeonSim.test.js` |
| Agent Minigames | `src/systems/{chessPuzzle,sudoku}.js`, `src/ui/{chessScreen,sudokuScreen}.js`, deren Tests |
| Agent Basis-Visual | `src/ui/{baseScreen,baseSprites,characterScreen}.js` |
| Agent Tutorial | `src/ui/tutorialScreen.js`, `src/data/codex.js` |
| Orchestrator | `main.js`, `run.js`, `style.css`, `core/state.js`, `core/save.js` (Migration v2), `systems/{defense,missions,chronik}.js` + Tests, Integration, Verify, APK, GitHub |

Regeln: Agents nutzen kein git/npm-install; neue Screens injizieren eigene `<style>`-Blöcke
(Klassen-Präfix), UI-Texte Deutsch; Logik deterministisch (seeded RNG) und in Node testbar.

## Save-Migration v1→v2 (Orchestrator)
`base {hp,maxHp,wallLevel,runsSinceAttack,underAttack}`, `chronik {punkte, upgrades{baumeister,gruendung,schutz}}`,
`missions {active:null}`, `tutorialSeen:false`.
