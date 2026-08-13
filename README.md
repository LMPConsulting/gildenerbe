> **Auch in diesem Repo** — vier eigenständige Reisespiele, unabhängig von Gildenerbe,
> jeweils als eine einzige HTML-Datei und komplett offline:
>
> - [`qwixx/`](qwixx/README.md) — das Würfelspiel *Qwixx*, an einem Handy oder auf zweien.
> - [`dreikampf/`](dreikampf/README.md) — *Wissen · Wahrheit · Wagnis*, ein Duell zu zweit mit
>   Punktekonto über den ganzen Urlaub. Auch auf zwei Handys, Antworten bleiben verdeckt.
> - [`cabo/`](cabo/README.md) — das Kartenspiel *Cabo*: vier verdeckte Karten, Peek, Spy, Swap.
>   Wahlweise an einem Handy oder auf zweien, per QR gekoppelt ohne Server.
> - [`skyteam/`](skyteam/README.md) — *Sky Team*: Pilot und Kopilot landen kooperativ ein
>   Flugzeug, schweigend, mit acht Würfeln pro Runde. Ebenfalls auf einem oder zwei Handys.
>
> **Als Webseite:** `npm run spiele:web -- <ordner>` baut alle vier plus eine Startseite.
> Mit `--ohne-server` entsteht eine Fassung für reine Dateiablagen (GitHub Pages) — dort
> koppeln sich zwei Handys bei **allen vier Spielen** per QR im selben WLAN oder Hotspot. Ohne den Schalter kommt der Raumcode
> über das Internet dazu; dafür braucht es die Durchreiche aus
> `LMPConsulting/docmatch` unter `spiele/`. Der Arbeitsablauf
> [`.github/workflows/spiele-pages.yml`](.github/workflows/spiele-pages.yml) veröffentlicht
> die serverlose Fassung automatisch auf GitHub Pages.

# Gildenerbe (Guild Legacy)

Ein aktives Action-RPG-Roguelite mit Automatisierungs-Meta-Progression im Classic-MMO-Stil.
Pixelart + prozedurale Chiptune-Musik, 100 % offline, als Android-App spielbar.

**Der Loop:** Du spielst einen sterblichen Helden aktiv durch Zone & Boss (Kampf, Angeln,
Schmieden, Runen-Puzzles). Fällt er oder geht in Ruhestand, wird seine Reise zu **Erbe** —
das du in der bleibenden **Gildenhalle** investierst. Jeder neue Held startet dadurch stärker.

## Spielen (Entwicklung, im Browser)

```bash
npm install
npm run dev        # http://localhost:5173
```

## Tests

```bash
npm test           # Vitest, deterministische Engine-Tests (107+)
node scripts/balance-check.mjs   # Auto-Spieler: prüft, dass Zone 1 schaffbar ist
```

## Android-APK bauen

Voraussetzungen (einmalig, liegen unter `C:\Android`):
- **JDK 21** (Temurin) — `C:\Android\jdk-21.0.11+10`
- **Android SDK** — `C:\Android` (platform-tools, platforms;android-34, build-tools;34.0.0)

```bash
npm run build                  # Web-Build nach dist/
npx cap sync android           # dist/ ins Android-Projekt kopieren
cd android
JAVA_HOME="C:/Android/jdk-21.0.11+10" ANDROID_HOME="C:/Android" ./gradlew assembleDebug
```

Ergebnis: `android/app/build/outputs/apk/debug/app-debug.apk`

**Aufs Handy:** APK per USB/Cloud aufs Gerät kopieren → antippen → Installation aus
unbekannten Quellen einmalig erlauben → spielen (kein Internet nötig).

## Projektstruktur

```
src/core/      Engine: seeded RNG, Event-Bus, Save/Load (versioniert), Loop, Offline-Zeit
src/data/      Daten-getrieben: Fähigkeiten, Gegner, Zonen, Items/Affixe, Talente, Rezepte, Gebäude
src/systems/   Pure Logik: Kampf-Sim, Stats/Schaden, Leveln, Loot, Crafting, Angeln, Puzzle, Erbe, Gildenhalle
src/ui/        Screens: Kampf, Charakter, Werkstatt (Angeln/Schmieden/Verzaubern), Gildenhalle
src/audio/     Prozedurale Chiptune (4 Themes) + 9 SFX via Web Audio — keine Audiodateien
docs/superpowers/   Design-Spec + Milestone-Pläne (1–6)
```

## Meilensteine (git tags)

`v1-m1-foundation` Engine-Kern · `v1-m2-combat` Kampf + Zone 1 · `v1-m3-progression`
Leveln/Talente/Loot · `v1-m4-professions` Berufe + Minigames · `v1-m5-meta` Gildenhalle/Erbe/Reroll
