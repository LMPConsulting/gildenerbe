# Gildenerbe v3 — Feedback-Großiteration (Plan + Schnittstellen-Vertrag)

**Quelle:** Handytest-Feedback 2026-06-11. **Modus:** Orchestrator baut den gekoppelten Kern,
3 parallele Agents bauen die entkoppelten Hub-/Minigame-Systeme.

## Scope (10 Punkte)
1. **Querformat-Layout** — alle Menüs/Buttons sichtbar, breiter, mehr Platz (style.css + screens).
2. **Flüssiger Action-Kampf** — kontinuierliche Float-Bewegung + Drehung statt Kachel-Schritte,
   Arc-/Projektil-Hitboxen, interessantere Gegner-KI (Verfolger/Schütze/Stürmer), bessere Maps.
3. **Angeln → Hub** als eigenes Event; Angel-**Crafting** (Ruten unterschiedlicher Güte,
   Haltbarkeit/Verschleiß, kostet Gold) → kein Gratis-Gear. **Kochen** (Fisch → Essen → Buff vor Run).
4. **Verzaubern → Hub**, kostet gesammelte Materialien, **Erfolgschance** abhängig von Rätsel-Tempo;
   Rätsel-Interaktion + Schwierigkeit überarbeitet.
5. **Loot-Vergleich** — Item im Inventar zeigt Stat-Delta ggü. aktuell angelegtem Slot.
6. **Klassen** Krieger/Magier/Schurke — eigene Rüstungsart, Werte, Fähigkeiten.
7. **Rüstungsarten + klassenübergreifende Truhe** im Hub — Gear für andere Klassen aufheben;
   Truhe überlebt Heldentod, **stirbt mit der Basis**.
8. **Held-Tod ≠ Basis-Tod** — Basis steht ohne Held; neuen Helden erstellen; Truhe nutzbar.
   Basis zerstört → alles weg (Held egal, Truhe weg), nur Chronik-Punkte bleiben.
9. **Sudoku 9×9** klassisch, auf Zeit → Loot-Güte zeitabhängig.
10. **Schach** „Matt in 1/2" — Schwarz zieht zurück, echte Schachregeln.

---

## Schnittstellen-Vertrag (eingefroren für Agents)

### Item-Shape (Loot/Equip)
```
{ id, slot, rarity, ilvl, name, affixes:{str?,agi?,int?,sta?,crit?,ap?,armor?,hp?,spellPower?},
  weaponDmg?,                 // weapons only
  armorType: 'platte'|'leder'|'stoff'|null,   // null = jewelry/weapon (any class)
  classReq: string[]|null }   // allowed classIds; null = any
```
Enchanting MERGES new affix keys into `item.affixes` (additive) and may append to `name`.

### Klassen (data/classes.js — Orchestrator owns)
```
classId: { name, armorType:'platte'|'leder'|'stoff', primaryStat:'str'|'agi'|'int',
  primary:{str,agi,int,sta}, growth:{...}, weapon:{name,dmg,kind:'melee'|'ranged'},
  abilities:[id...], resourceType:'rage'|'mana'|'energy' }
```
krieger=platte/str/rage, schurke=leder/agi/energie, magier=stoff/int/mana.

### Persistent account economy (state.js v3 — Orchestrator owns; agents READ/WRITE these paths only)
- `account.gold` (int) — Hub-Währung; verdient pro Run + Verkauf von Schrott.
- `account.materials` (bag via systems/materials.js) — persistent; run.materials wird am Run-Ende eingezahlt.
- `account.rods` (array) — Fishing-Agent: `{id,name,tier,durability,maxDurability,luck}`.
- `account.fishpond` (array) — gefangene Fische `{id,name,quality}`.
- `account.larder` (array) — gekochtes Essen `{id,name,buff:{stat,value},servings}`.
- `account.pendingFood` (`{stat,value,label,runsLeft}` | null) — vom Orchestrator beim Heldenstart angewandt.
- `account.chest` (array of items) — klassenübergreifende Truhe; überlebt Heldentod, stirbt mit Basis.

### Materials API (systems/materials.js — FROZEN, read-only for agents)
`makeBag()`, `addMat(bag,key,n)`, `hasMats(bag,cost)`, `consumeMats(bag,cost)`.

### Minigame UI contract (unchanged)
`mount*Screen(root,{ onSolve(quality:0..1), onClose, seed, ... })`. quality scales loot.

---

## Datei-Eigentum (disjunkt)

| Wer | Dateien |
|---|---|
| **Orchestrator** | dungeonSim.js, dungeonScreen.js, enemies.js, zones.js, classes.js(new), abilities.js, hero.js, stats.js, affixes.js, loot.js, equipment.js, chest.js(new), characterScreen.js, state.js, save.js, main.js, run.js, baseScreen.js, panels.js, style.css + deren Tests |
| **Agent MINI** | systems/{sudoku,chessPuzzle}.js, ui/{sudokuScreen,chessScreen}.js + Tests |
| **Agent HUB-FOOD** | systems/{fishing,cooking}.js, data/{rods,foods}.js, ui/{fishingScreen,cookingScreen}.js + Tests |
| **Agent ENCHANT** | systems/{enchanting,runePuzzle}.js, ui/{runePuzzleScreen,enchantScreen}.js + Tests |

Regeln: kein git/npm-install; Logik DOM-frei + deterministisch (seeded rng); Screens injizieren
eigene `<style data-*>`; Deutsch; node-safe Imports. Save-Migration v2→v3 macht der Orchestrator.
