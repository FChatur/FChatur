# Changelog

All notable changes to Last Stand. Newest first.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each version has a matching
git tag `last-stand-vX.Y.Z` that can be checked out to play or restore that build.

## [Unreleased]

## [0.3.1] - 2026-10-28 (Phase 3 complete: expandable upgrade system)

### Changed
- **Upgrade system is now data-driven** (foundation for 60–100+ upgrades; see PLAN.md section 7):
  - Each upgrade is a registry entry with a unique ID, rarity, max stacks, optional tower scope,
    eligibility requirements (minimum wave, owned upgrades, built tower types) and typed effects.
  - Descriptions are generated from effects; effects aggregate in one place, cached per tower type.
  - Tower-specific upgrades are supported (effects apply only to the listed tower types).
  - Nothing assumes a fixed pool size; tests run the draft on a synthetic 40-upgrade pool.
- **Rarities** (Common, Uncommon, Rare, Legendary) with weighted offers: 60 / 28 / 10 / 2.
  Overclock and Critical Strike are Common, Compound Interest and Frostbite Uncommon,
  Explosive Rounds and Chain Lightning Rare.
- **Eligibility**: maxed upgrades and upgrades with unmet requirements are never offered.
  Frostbite now only appears once a Frost tower is built.
- Pick cards show rarity and stacking (New / Rank I → II / max).

### Balance notes
- Strong strategies on Switchback: waves 30–40 (median), 2–5 waves of warning. Slightly lower than 0.3.0
  because Rare upgrades now appear less often and Frostbite needs a Frost tower.

## [0.3.0] - 2026-10-28 (Phase 3: roguelite upgrades and balance)

### Added
- **Run upgrades**: after every 5th wave, pick 1 of 3 (click or `1`–`3`); the next wave waits for your pick.
  Each stacks to rank III and lasts for the rest of the run:
  - **Chain Lightning**: hits jump to 1/2/3 more nearby enemies for 50% damage.
  - **Overclock**: all towers fire 15/30/45% faster (shown in the tower panel's fire rate).
  - **Critical Strike**: 15/30/45% chance for double damage.
  - **Compound Interest**: clearing a wave pays 10/20/30% of unspent gold (max 40/80/120).
  - **Frostbite**: slowed enemies take 25/50/75% more damage.
  - **Explosive Rounds**: hits splash 30/45/60% damage around the target.
- Pick screen with rank and "Now:" comparison, owned upgrades shown as chips in the top bar.
- Effects for critical hits, lightning jumps, explosions and interest payouts.
- Seeded randomness: every run gets a seed, so offers and critical hits are reproducible for testing.
- **Maps as data** (`config/maps.ts`): each map defines its grid, path and difficulty modifiers
  (enemy health, speed, count, gold income, starting gold). Switchback is the baseline with no modifiers.
- **Balance harness** (`npm run balance`): bots play every registered map with six strategies over
  several seeds and report waves reached, first leak, when health first drops below 75%, and the gap.
  Bots pick build spots by analysing the map, never from hardcoded tiles.

### Changed
- **Difficulty curve** (fixes the known late-game cliff): waves cap at 30 regular enemies, and enemy health
  grows 12% per wave plus 2% linear (was 13% with no cap). Late waves get tougher rather than longer, so a
  defence that falls behind loses a few health per wave instead of collapsing in one.
  Baseline map, strong strategies: waves 32–40 (median), 2–8 waves between serious trouble and the end
  (previously 29–45 with 1–2 waves of warning).

### Docs
- Multi-map balance principles (PLAN.md section 6, CLAUDE.md); PWA installation and offline support added
  to the future mobile roadmap.

## [0.2.0] - 2026-10-28 (Phase 2: core tower defense)

### Added
- Three new towers: **Sniper** (long range, heavy hits, targets the toughest enemy in range),
  **Rapid** (very fast, light shots), **Frost** (light damage, slows enemies it hits).
- Three upgrade levels for every tower, with level pips on the tower and a stronger look at max level.
- Tower panel: click a built tower to see its stats with a next-level preview, then **upgrade** (`U`)
  or **sell** (`S`, 70% of everything spent on it, works mid-wave).
- Game speed **1x / 2x / 3x** (buttons, or `F` to cycle). Speed carries over when restarting.
- Three new enemies: **Runner** (fast, fragile, from wave 3), **Brute** (armored, from wave 5),
  **Warlord** boss (every 10th wave, heavy armor, costs 6 health if it gets through).
- Armor: flat reduction per hit, never below 25% of the hit, so big hits beat armor and Rapid struggles.
- Mixed waves: enemy types are spread evenly through each wave, the same way every time.
- Distinct shapes per enemy type, frost ring on slowed enemies, upgrade and sell effects.
- Keyboard shortcuts `1`–`4` for the four towers.

### Changed
- Build bar shows all four towers; hints cover selecting, upgrading, selling and speed.
- CI uses current GitHub Actions versions (Node 24); fixes the Node 20 deprecation warning.

### Balance notes
- Bots using Turret-only, Sniper-heavy and mixed builds with upgrades all reach waves 22–24; Rapid-only
  reaches ~13 because Brutes punish it. The late-game difficulty cliff is unchanged (Phase 3).

## [0.1.1] - 2026-10-28

### Added
- In-game version label in the top bar, so it's clear which build is being played.
- `CHANGELOG.md` and project working rules (`/CLAUDE.md`) for ongoing development.
- CI creates the `last-stand-vX.Y.Z` checkpoint tag automatically when a new version lands on `main`.

### Notes
- `last-stand-v0.1.0` could not be auto-tagged: GitHub won't let the CI token tag a commit whose workflow
  file differs from the current one. 0.1.0 is commit `d64416d`; tag it by hand from the GitHub Releases page if wanted.

## [0.1.0] - 2026-10-28 (Phase 1: playable prototype)

### Added
- Fixed battlefield (20×12 grid) with a winding enemy path, spawn gate and exit gate.
- Turret tower: grid placement with green/red validity preview, range circle and blocked-tile labels;
  hover a built tower to see its range.
- Grunt enemy with health bars, procedural wave scaling (count, spawn rate, health).
- Homing projectiles, "first" targeting, hit flashes, death bursts, floating gold text, barrel recoil,
  screen shake when an enemy leaks.
- Economy: starting gold, kill rewards, wave-clear bonus. Health lost per leaked enemy.
- Game over summary (wave reached, kills, towers built, gold earned) and restart.
- HTML HUD: wave/gold/health, build bar, Start Wave button, contextual hints.
- Keyboard shortcuts: `1` select Turret, `Space` start wave, `Esc`/right-click cancel, `R` restart.
- Fixed-step simulation (60 Hz) with render interpolation, independent of display refresh rate.
- Unit tests (Vitest) for path, waves, placement, combat, economy and game over, plus a balance smoke test.
- GitHub Actions workflow: test + build on push, deploy to GitHub Pages from `main`.

### Known issues
- Difficulty cliff: a strong player holds without losses until about wave 23, then collapses within one wave.
  Fixed in 0.3.0.
