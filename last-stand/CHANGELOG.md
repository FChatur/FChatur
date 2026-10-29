# Changelog

All notable changes to Last Stand. Newest first.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each version has a matching
git tag `last-stand-vX.Y.Z` that can be checked out to play or restore that build.

## [Unreleased]

Phase 6 (visual identity and combat prototype) in progress on the development branch; not released yet.

### Added
- Per-tower targeting modes: First, Last, Strongest and Fastest. Each built tower keeps its own mode;
  defaults are unchanged (Sniper: Strongest, the rest: First), so balance is identical until the player
  changes one. Global range is unaffected.
- Balance tooling: `npm run balance` also writes `tower-report.md`, comparing towers by paper stats, damage
  actually dealt per gold in bot runs, swap tests on the Mixed build, early-game openings, and Frostbite
  on/off.

- Visual Prototype V2 (issue #1, review only): warmer palette and sunlight, composed forest edge with
  dappled shade, flower meadows, pond, torch-lit cave and gatehouse, ambient life (torches, butterflies,
  falling leaves, swaying grass); distinct Archer, Ranger, Ballista and Frost Mage towers with visible
  upgrade progression; more expressive enemies; hit flinch, slowed-enemy snowflakes, ballista thump and
  see-through explosions. Details and measurements: docs/VISUAL_PROTOTYPE.md section 8.
- Tower personality (issue #2, review only): every tower is a named hero (Wren the Archer, Brakk the
  dwarf Ballista engineer, Fen the elf Ranger, Old Rime the Frost Mage) on a structure that grows with
  the three upgrade levels. Heroes draw and release in time with their shots, react to a boss (alarm,
  red "!") and lost lives (sweat drop), cheer after each wave and celebrate boss waves with stars and
  sparkles. The upgrade draft opens 1.4 s after its wave so the celebration is seen. The Ballista is now
  22 px wide, with Brakk behind an oversized crossbow that recoils.
- Permanent left tower shop: large hero cards (portrait, hero name, tower, role, cost, hotkey; building
  and unaffordable states), drag-and-drop from a card onto the map alongside click-to-place, and a
  collapse button for a narrow rail that is remembered between visits (compact cards on short screens).
- Tower panel: hero portrait and rank, an upgrade preview (next level's look and stats), and targeting
  buttons (`T` cycles).
- Interface restyled with the art palette and the Pixelify Sans pixel font.
- Late-wave declutter: heroes fade while an enemy is behind them; creatures spread across the road
  instead of stacking (drawing only); no "+gold" numbers in crowds; lower caps on cosmetic effects.
  Crowded wave 50: 16.5 → 20 fps in the same environment. Details: docs/VISUAL_PROTOTYPE.md section 9.1.
- `npm run art` renders hero previews (lineup, stages, poses, animated reels) to art-preview/.

### Docs
- Phase 6 proposal: [docs/VISUAL_PROTOTYPE.md](docs/VISUAL_PROTOTYPE.md) (pixel-art specification, asset
  approach, interface layout, steps and risks, combat balance evidence). Roadmap: Phase 6, then Phase 7
  (maps and map selection).

## [0.5.0] - 2026-10-28 (Phase 5: testing, performance, polish; MVP complete)

### Added
- Robustness tests: a shared invariant checker (gold, health, towers, enemies, projectiles, phases,
  drafts, countdown, stacks), seeded fuzz tests that perform thousands of random and invalid actions on
  the game and the session, and a wave-100 soak test on a maxed-out board (`npm run test:slow`).
- End-to-end browser tests (`npm run test:e2e`, Playwright) of the production build: clean load and
  1:1 canvas, building/tooltips/panel/upgrade/sell, a full wave with Auto Wave and pause, settings
  persisting across reloads, losing a run and recording a personal best, and resizing.
- CI runs the end-to-end tests in Chromium (Chrome, Edge), Firefox and WebKit (Safari's engine) on every
  push, plus the slow soak test; deploys and release tags now wait for all of them to pass.

- Resilience: a clear notice (with Reload) for unexpected errors in the game's own code, and for the
  browser resetting the graphics context; the game pauses and recovers when graphics come back. A
  message is shown if JavaScript is disabled.
- Link previews: an image and description when the game's link is shared (Discord, Slack, Teams,
  Messages, social), captured from real gameplay.
- Accessibility: reduced-motion support (no screen shake, pop or pulse animations when the system asks
  for reduced motion) and a visible focus outline for keyboard navigation.
- README rewritten as a front page with the play link, a screenshot, browser support and test commands.
- End-to-end tests for keyboard-focus tooltips, tab-switch auto-pause, and the board actually rendering.

### Compatibility
- Build output targets Chrome/Edge 100+, Firefox 100+ and Safari 15+ (newer syntax is downlevelled).
- Every CSS `color-mix()` has a plain-colour fallback for browsers that lack it.

### Docs
- Roadmap: a dedicated Audio & Music milestone (PLAN.md section 8) with requirements, design notes and
  acceptance criteria. Not implemented yet; the current audio is unchanged.

### Changed
- **Late-game performance** (measured with Chrome's CPU profiler at wave 40, 3x speed):
  - Static art (board, tower bases, enemy bodies) is baked into textures at the current screen resolution
    instead of being re-tessellated every frame; re-baked when the zoom changes, so it stays crisp.
  - Hit flashes and barrel recoil are animated directly instead of creating thousands of tweens (and
    searching all of them on every hit).
  - Cosmetic effects have per-category caps (sparks, particles, floating text), so heavy fire can't pile
    up thousands of objects; important feedback is never skipped.
  - Projectile visuals are pooled and reused.
  - The HUD redraws at most once per frame, caches personal records, and only rebuilds the upgrade
    chips when they change; the per-frame display-scaling check no longer forces a layout.
  - Result on a realistic late-game board: live objects 329 → ~50, tweens 366 → ~2, JavaScript cost per
    shot about 3.4× lower. On an extreme 203-tower board, throughput rose about 6.8×.

### Fixed
- When a leak ended the run, the enemies that leaked on that final frame were left in the game state
  (invisible, but stale). Found by the fuzz tests.

## [0.4.3] - 2026-10-28 (tower tooltips)

### Added
- **Tower tooltips** when hovering a tower in the shop (or focusing it with the keyboard) and on the
  battlefield. Dark, minimal cards with the tower's name, role, cost, a short description, and its
  combat stats: damage per hit, attack speed, range ("Global" for the Sniper) and targeting priority.
- **Mechanics explained in plain English**, generated from tower data: global range, toughest-enemy
  targeting, slows, and how well each tower copes with armor (e.g. Rapid: "Brutes block 4 damage from
  every hit. With 5 damage per hit, only 25% gets through.").
- **Built towers** show their current level and stats including run upgrades (e.g. attack speed
  "7.8/s +30%"), plus a Run bonuses list naming the upgrades that apply to that tower type.
- Smart positioning: above shop buttons, beside towers on the board, flipping sides near edges and
  always inside the window. Tooltips never intercept clicks, and hide while placing a tower, for the
  selected tower (its panel already shows details), and during pause, upgrade picks and game over.

### Changed
- Every tower has a role line and a purpose-focused description in `config/towers.ts`; all other card
  content is derived from stats, so new towers get complete tooltips with no UI code.
- Tower panel uses the same terms as tooltips ("Attack speed", "Targeting", ranges in tiles).

## [0.4.2] - 2026-10-28 (Auto Wave)

Builds on 0.4.1 (crisp rendering, smooth motion, global-range Sniper), which shipped just before.

### Added
- **Auto Wave** (on by default): after a wave is cleared, the next one starts after a 3-second countdown.
  - Countdown shown at the top of the board ("Next wave in 3") and on the Start Wave button.
  - Keep building, upgrading and selling during the countdown; the countdown never blocks the board.
  - Start Wave / Space skips the countdown and starts immediately; a wave can never start twice.
  - Waits while an upgrade pick is open, then runs a fresh 3-second countdown after you choose.
  - Counts game time: pausing freezes it, and it follows 1x / 2x / 3x speed.
  - Toggle with the Auto button, the `A` key or the main menu. Turning it off cancels a running
    countdown. The setting is saved and carries over restarts; the first wave is always started by you.
  - Countdown length is configurable (`autoWaveDelay` in `config/balance.ts`).

### Changed
- The bottom-bar hint is hidden below 1400 px wide to make room for the Auto button.

## [0.4.1] - 2026-10-28 (rendering quality, global Sniper)

### Fixed
- **Blurry, jagged rendering.** The game drew into a fixed 960×576 buffer that the browser then stretched
  by uneven factors (1.4× at 1080p, about 2× at 1440p, more with display scaling), smearing every edge.
  The canvas buffer now matches the device pixels it covers at any window size, display scaling or
  browser zoom, the world is fitted with the camera zoom, each tile spans a whole number of device
  pixels, and the canvas sits on whole device pixels. Antialiasing is set explicitly (Phaser otherwise
  switches to pixel-art mode when zoomed), and text renders at the zoomed resolution.
- **Uneven motion.** The simulation advanced by Phaser's smoothed frame time instead of real elapsed
  time, so movement surged and lagged whenever frame times varied (and ran slow when frames were long).
  It now uses real elapsed time: on-screen speed is constant at 1x and 3x. The catch-up limit per frame
  was raised so 3x stays accurate on slower machines.
- Mouse input stays aligned after resizing the window or changing display scaling mid-game.
- Towers no longer shoot enemies that haven't entered the map yet.

### Changed
- **Sniper: global range** at all three levels, like BTD6's Sniper Monkey. It still targets the toughest
  enemy (now anywhere on the map), fires slowly and hits hard. The panel shows Range "Global", and
  placing or selecting a Sniper outlines the whole board instead of drawing a circle.
- Sniper rebalanced around global range: cost 90 → 110, upgrades 80 → 100 and 140 → 170; faster shots
  (2400–2800 px/s) so cross-map hits land promptly.
- **Smarter targeting for all towers**: towers skip enemies that shots already in flight will kill,
  avoiding wasted overkill (which global range made common when several Snipers picked the same enemy).

### Balance (Switchback, median waves reached; before → after)
- Turrets + upgrades 33 → 33, Sniper crit 33 → 30, Frost + Rapid 30 → 31, Mixed 40 → 40, Economy 32 → 33.
  All strong strategies remain in the provisional 30–40 band.

## [0.4.0] - 2026-10-28 (Phase 4: menus, sound, tutorial, polish)

### Added
- **Main menu**: Play (Enter), personal best for the map, sound and tutorial toggles, controls summary.
- **Pause** (P, Esc, or the Pause button) with Resume, Restart run and Main menu. Switching tabs pauses
  automatically. Time stops completely while paused.
- **Personal best** per map: best wave, best kills and run count, saved in the browser. The game-over
  screen shows your best and a "New best!" badge; it also has a Main menu button.
- **Sound effects**, generated in code (no audio files): distinct shots per tower, kills, leaks, wave start
  and clear, boss arrival, upgrades, building, selling, critical hits, splash, lightning, game over.
  Rate-limited so fast towers at 3x stay pleasant. **Mute** with M or the speaker button.
- **Saved settings**: mute, volume and game speed are remembered between visits. Everything falls back
  to defaults if browser storage is unavailable (private windows, blocked storage).
- **First-run tutorial**: five short steps that advance as you do them (build, send a wave, select a tower,
  clear a wave, pick an upgrade). Skippable; turn it back on from the menu.
- **Polish**: muzzle flashes, a "Wave N" banner, and a boss entrance (banner, screen shake, sound).

### Changed
- The game opens on the main menu instead of straight into a run.
- Esc now resumes if paused, otherwise clears the selection, otherwise pauses.

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
