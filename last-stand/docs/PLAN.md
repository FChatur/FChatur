# Last Stand: Development Plan

## 1. Major technical risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| **Game logic tangled with rendering** | The most common way small Phaser games become unmaintainable. Makes 2x speed buggy, balancing slow, and testing impossible. | The simulation (`src/core`) is plain TypeScript with no Phaser or DOM imports. Phaser only draws state and forwards input. |
| **Frame-rate dependent gameplay** | Variable `delta` makes runs behave differently on 60 Hz and 144 Hz screens and breaks at 2x speed. | Fixed 60 Hz simulation step with an accumulator; rendering interpolates positions between steps. 2x speed = more steps per frame, same rules. |
| **Roguelite upgrade combinatorics** | Six upgrades that stack (chain + explosive + crit) can multiply into degenerate damage or be dead picks. | Upgrades will be data-driven modifiers applied through one stat pipeline, with explicit caps. A headless auto-player (already used for the Phase 1 probe) measures how far runs get with each build. |
| **Endless scaling cliff** | Exponential enemy health against linear income gives a run that is trivial for 20 waves and then collapses in one. | Resolved in 0.3.0: waves are capped in size and difficulty grows through enemy toughness; `npm run balance` tracks the warning gap per strategy and map. |
| **Late-wave performance** | Hundreds of projectiles and tweens per second on low-end laptops. | Addressed in 0.5.0 after profiling: static art baked to textures, tween-free hit feedback, per-category effect caps, pooled projectiles, one HUD refresh per frame. Simulation measured at ~0.1 ms/step at wave 100 on a full board. |
| **Browser audio policy** | Audio contexts start suspended until a user gesture; asset pipelines add weight and licensing risk. | Procedural Web Audio sound effects generated in code (no files), unlocked on the first click. |
| **Phaser canvas and HTML UI drifting apart** | Two UI systems can fight over input and layout. | Clear split: canvas = the board only; all menus, buttons and text are DOM. They communicate only through `GameSession` and its typed event bus. |
| **Deployment base paths** | GitHub Pages serves from `/<repo>/`, which breaks absolute asset URLs. | Vite `base: './'`; the build works from any sub-path. |

## 2. Recommended simplifications

These keep the game finishable without cutting what makes it fun.

1. **One handcrafted map.** Map selection adds content work, not depth.
2. **Manual wave start (build phase between waves).** Simpler than a continuous timer and gives the strategic pause roguelite choices need. An "early call" gold bonus can come later.
3. **Linear tower upgrades (3 levels, stat bumps + a visual change).** No branching upgrade trees; the roguelite layer provides build variety instead.
4. **Roguelite upgrades are global run modifiers**, not per-tower items. Easier to balance, easier to read, and combinations still matter (e.g. Frost + Frostbite + Rapid).
5. **Procedural waves from a formula plus composition rules**, not 50 hand-authored waves.
6. **Procedural graphics and sound.** No asset pipeline, no licensing questions, tiny download.
7. **No mid-run saves.** Runs are 10 to 25 minutes; only settings and personal best persist.
8. **Desktop mouse + keyboard only for v1.** Touch mostly works through pointer events but won't be designed for.
9. **Boss = a scaled, distinct enemy type** with more health and leak damage, not unique scripted mechanics.
10. **Armor as flat damage reduction.** One rule that makes Sniper vs Rapid a real choice.

## 3. Architecture

```
src/
  config/      Pure data: grid, path, towers, enemies, balance numbers. Tune the game here.
  core/        The simulation. No Phaser, no DOM. Unit-tested.
    Simulation.ts   Rules for one run: placement, waves, movement, targeting, damage, economy.
    Path.ts         Polyline route + path tile set.
    waves.ts        Wave generation from balance config.
    EventBus.ts     Typed pub/sub; the only way state changes are announced.
    events.ts, types.ts, grid.ts
  game/
    GameSession.ts  Owns the current Simulation and UI-level choices (selected tower). Shared by scene and HUD.
  render/      Phaser drawing only: board, entity views, placement preview, effects.
  scenes/
    GameScene.ts    Fixed-step loop, pointer input on the board, wiring of renderers.
  ui/
    Hud.ts          DOM overlay: stats, build bar, wave button, hints, game-over panel, keyboard shortcuts.
  main.ts       Bootstraps Phaser, the session and the HUD.
tests/          Vitest unit tests for core logic, including a balance smoke test.
```

Data flow: input (DOM buttons, keys, canvas clicks) → `GameSession` / `Simulation` commands → state changes + events → renderers and HUD read state / react to events.

## 4. Minimum viable product (the "share it with friends" version)

- 4 towers (Turret, Sniper, Rapid, Frost), each with 3 upgrade levels, plus selling.
- 4 enemies (Grunt, Runner, Armored, Boss every 10 waves).
- Endless waves on one map, increasing difficulty.
- Roguelite pick (1 of 3) every 5 waves from a pool of 6 upgrades.
- Main menu, pause, 1x/2x speed, restart, game-over summary, personal best wave.
- Procedural sound effects with mute; settings and best wave in localStorage.
- Contextual tutorial hints for the first run.
- Deployed to a public URL.

Explicitly **not** in the MVP: multiple maps, meta-progression between runs, accounts/leaderboards, mobile layout, music.

## 5. Development phases

Each phase ends with a playable build, passing tests, and a browser playtest.

### Phase 1: Playable prototype ✅
- Fixed map and path, grid placement with validity + range preview.
- One tower (Turret), one enemy (Grunt), homing projectiles, "first" targeting.
- Gold, health, wave counter, wave clear bonus, procedural wave scaling.
- Game over with run summary and restart.
- HTML HUD, keyboard shortcuts, contextual hints.
- Unit tests for path, waves, placement, combat, economy, game over.

### Phase 2: Core tower defense ✅
- Sniper, Rapid and Frost towers; slow status effect (strongest slow wins).
- Runner, Brute (flat armor) and Warlord boss enemies; deterministic mixed wave composition.
- Tower selection panel: upgrade (3 levels, next-level preview) and sell (70% refund).
- Sniper targets the toughest enemy in range; others target the furthest along.
- Pulled forward from Phase 4 at the owner's request: 1x/2x/3x game speed.

### Phase 3: Roguelite system and balance ✅
- Upgrade pick every 5 waves: Chain Lightning, Overclock, Critical Strike, Compound Interest, Frostbite, Explosive Rounds.
  Each stackable to rank 3; no reroll or skip in this phase.
- Modifier pipeline so upgrades compose predictably; caps where needed. Seeded RNG for reproducible runs.
- Headless balance harness (`npm run balance`): scripted builds, waves-survived report per map; fix the
  late-game cliff. Built map-agnostic per the balance principles below.
- Provisional target **for the baseline map only**: strong builds reach waves 30–40, with leaks starting
  several waves before a run ends.
- Result (0.3.0): capped wave size + gentler health growth. Strong strategies reach a median of 32–40 on
  Switchback with 2–8 waves of warning. Bosses every 10 waves act as checkpoints that cost 6 health.
  Remaining spread: Frost + Rapid and Economy builds sit at the low end (~32); revisit if playtesting agrees.

### Phase 4: UI, effects, sound, QoL ✅
- Main menu, pause/resume, personal best wave (per map). (Game speed shipped in Phase 2.)
- Procedural Web Audio SFX + mute toggle; settings persisted.
- Effect polish (muzzle flashes, slow visuals, boss intro), first-run tutorial flow.

### Phase 5: Testing, optimization, deployment ✅
- Cross-browser: end-to-end tests in Chromium, Firefox and WebKit in CI; build targets 2022+ browsers;
  CSS fallbacks.
- Profiled late waves (Chrome CPU profiler): baked static art, tween-free hit feedback, capped effects,
  pooled projectiles, frame-batched HUD.
- Robustness: invariant-checked fuzz tests, wave-100 soak test; crash and GPU-reset notices.
- Error-free console, tab-switch auto-pause and window resizing covered by end-to-end tests.
- Deployment gated on all tests; link preview image and meta tags; README as a public front page;
  reduced-motion support and visible keyboard focus.

### Phase 6: Visual identity and combat prototype ✅ (released in 0.6.0)
Set by the owner after playtesting 0.5.0: the game runs well, but combat looks dull. Before more content,
turn it into a **pixel-art fantasy** tower defense. Full proposal: [VISUAL_PROTOTYPE.md](VISUAL_PROTOTYPE.md)
(visual specification, asset approach, interface layout, steps, risks, balance evidence).
- Switchback redesigned as a grassy clearing with a dirt road; recognizable animated creatures (Goblin,
  Wolf, Armored Orc, Ogre Warlord) and fantasy towers (Archer, Ballista, Ranger, Frost Mage) with
  visible projectiles and impacts. Crisp at any resolution (whole-pixel scaling only).
- Interface: collapsible left sidebar shop with large cards, drag-and-drop building (click-to-build kept),
  clearer tower panel.
- Tower personality (issue #2, direction approved): each tower is a named hero (Wren, Brakk, Fen, Old
  Rime) who animates with the tower's fire rhythm, reacts to bosses, lost lives and won waves, and grows
  with the three upgrade levels. Late-wave declutter and occlusion fading.
- Per-tower targeting: First, Last, Strongest, Fastest.
- Combat balance review with new tooling; no stat changes without evidence.
- Scope limits: no new maps, towers, enemies, upgrades or major systems. Released in 0.6.0
  after the owner playtested a hosted preview.

### Phase 7: Audio & Music ✅ (released in 0.7.0)
Scheduled by the owner after 0.6.0, ahead of the map work. Requirements and design in section 8; the
system as built and the soundtrack's processing and licensing in [AUDIO.md](AUDIO.md).
- Background music: "Picnic at the Tower Gate" (generated with Google Gemini), looped seamlessly.
- Master, Music and SFX volume sliders, global mute, saved preferences; in the main menu and the pause
  menu.
- Smooth music transitions, pause and focus behaviour, browser autoplay rules, mobile support.

### Phase 8: Maps and map selection (v0.8.0; design proposal awaiting approval: [PROGRESSION.md](PROGRESSION.md))
Moved from v0.7.0 to v0.8.0 when Audio & Music was scheduled first; the planned features are unchanged.
- **Additional maps**, each balanced individually against the shared difficulty expectations (see
  section 6), and a way to choose between them.

### Future (after the MVP, not scheduled)
- **Mobile**: touch-first controls and layout, then **PWA installation** (web app manifest, icons,
  "Add to Home Screen") and **offline support** (service worker caching the built game so it runs without
  a connection; versioned cache so a new release replaces the old one).
- **Audio, later steps**: more tracks (a boss-intensity layer or variant, a game-over sting) and richer
  sound effects with recorded samples (section 8). The first audio milestone is Phase 7.

## 6. Balance principles (multi-map)

Set by the owner. The current map ("Switchback") is the **baseline**, not the universal standard.

1. Enemy health, armor, speed, wave scaling and economy values stay configurable (`src/config`).
2. **Global** balance settings (`config/balance.ts`, `config/enemies.ts`, `config/towers.ts`) are kept
   separate from **map-specific difficulty modifiers** (each map's `modifiers` in `config/maps.ts`).
3. The balance harness takes a map as input and runs the same strategies on every registered map.
4. Future maps are expected to differ in path length, build space and strategic challenge.
5. No balance rule or value may assume the baseline map's path length, layout or tower positions. Bots
   pick tower spots by analysing whichever map they're given, never from hardcoded tiles.
6. With multiple maps, each is tested and tuned individually (mainly via its modifiers) while keeping
   overall difficulty expectations consistent.
7. The "strong builds reach waves 30–40" target is a provisional baseline for the current map only.

## 7. Long-term content direction (set by the owner)

Last Stand should offer significant roguelite build diversity and genuine randomness. The six Phase 3
upgrades are the foundation, not the final pool. Content is added gradually after the MVP; none of these
targets are scheduled phases yet.

| Content | Now | Long-term target |
| --- | --- | --- |
| Roguelite upgrades | 6 | 60–100+, across Common / Uncommon / Rare / Legendary |
| Tower types | 4 | 12–20 |
| Enemy types | 4 (incl. 1 boss) | 15–25, with multiple bosses |
| Maps | 1 | several, each balanced individually (section 6) |

### Upgrade system design principles

1. Data-driven and expandable: adding an upgrade means adding a definition, not changing the engine.
2. Every upgrade has a unique ID, effects, a rarity, eligibility requirements and a stacking rule.
3. Both generic upgrades (all towers) and tower-specific upgrades (scoped to tower types).
4. Nothing assumes a fixed pool size.
5. Each pick offers three distinct, randomized upgrades.
6. Weighted rarity probabilities (configurable weights per rarity).
7. Upgrades whose prerequisites aren't met, or that are at max stacks, are never offered.
8. No guaranteed perfect synergies: offers are random by rarity weight only, never steered toward the
   player's build. Adapting to imperfect choices is part of the game.
9. Upgrades can change mechanics (new behaviours), not only numbers.
10. Testable, deterministic with seeded randomness, and independent of specific maps.

### How the architecture supports this (in place since 0.3.1)

Adding an upgrade: add an `UpgradeDef` to `UPGRADE_DEFS` (no other file changes for existing effect
kinds), run `npm test` (registry checks) and `npm run balance`.

- `config/upgrades.ts` is a registry of `UpgradeDef` entries: `id`, `name`, `rarity`, `maxStacks`,
  optional `towers` scope, optional `requires` (min wave, owned upgrades, built tower types), and a list
  of `effects`. Descriptions are generated from effects, so new content is pure data.
- Effects are typed primitives (`fireRate`, `crit`, `damageVsSlowed`, `splash`, `chain`, `interest`, ...).
  Numeric effects aggregate in one place (`core/modifiers.ts`, cached per tower type). A mechanic-changing
  upgrade adds a new effect kind plus one handler in the simulation; the draft, UI, stacking and tests
  handle it with no further changes.
- The draft filters by eligibility, then samples three distinct upgrades weighted by rarity using the
  run's seeded RNG.
- Registry integrity (unique IDs, valid references, known effect kinds) is checked by unit tests, so a bad
  content entry fails CI instead of breaking a run.
- Towers and enemies are already keyed registries (`config/towers.ts`, `config/enemies.ts`) and maps are
  data (`config/maps.ts`); bosses are enemy definitions, so more of each is additive.

## 8. Milestone: Audio & Music (set by the owner)

Scheduled as v0.7.0 (Phase 7). Requirements below were agreed before the work started; what was built
and how is in [AUDIO.md](AUDIO.md). Boss-intensity music and recorded sound effects come later: the
first soundtrack has no separate layers or boss variant.

**Priority:** a cohesive soundtrack and satisfying combat feedback matter more than the number of tracks.
A small, consistent set (for example a build/menu theme, a combat loop with a boss-intensity variant,
and a game-over sting) beats many unrelated tracks.

### Requirements

- Energetic background music that is **original or properly licensed** for a public web game and a
  public repository.
- **Seamless looping** (no audible gap or click at the loop point) and **smooth transitions** between
  tracks or states.
- **More intense music during boss waves.**
- **Distinct sound effects** for towers, enemies, upgrades and UI.
- Separate **Master, Music and SFX volume sliders** (0–100%).
- A **global mute** toggle.
- Audio preferences **saved in LocalStorage**.
- **Pause or appropriately reduce audio when the game loses focus.**
- **Respect browser autoplay restrictions**: no sound before the player interacts with the page.
- A **modular, performant** audio system on desktop and mobile.

### Starting point (as of 0.5.0, unchanged until this milestone)

- `src/audio/Sfx.ts`: procedural Web Audio sound effects driven by game events, with per-sound rate
  limits and one master gain. No music and no audio files.
- Settings persist `muted` and a single `volume` (0.6; no control in the UI yet). `M` and the speaker
  button toggle mute.
- The audio context starts on the first `pointerdown` or `keydown`. That suits mouse and keyboard, but a
  touch `pointerdown` doesn't count as a user activation (touch activates on `pointerup`/`touchend`), so
  on touch devices sound may only start on a later tap.
- The game auto-pauses when the tab is hidden, which stops new sound effects but leaves the audio context
  running.

### Design notes

- **Bus structure.** One audio context; Music and SFX buses (gain nodes) feed a Master bus with a limiter
  (dynamics compressor) so overlapping sounds don't clip. Effective level = master × bus. Sliders map to
  gain on a perceptual curve (e.g. squared), so 50% sounds about half as loud. Mute silences the master
  without losing slider values. Volume changes are ramped to avoid clicks.
- **Gapless music.** Decode tracks to audio buffers and loop them with buffer sources, setting the loop
  points explicitly (which also skips encoder padding); HTML `<audio>` loops can leave audible gaps.
  Crossfade between two players with equal-power curves, ideally on bar boundaries so transitions stay in
  time.
- **Boss intensity.** Preferably layered stems started together on the audio clock (bring in percussion
  or a lead layer on boss waves, fade it out after), or a dedicated boss variant crossfaded at a bar line.
  Driven by game events (boss spawned, boss killed, wave cleared, game over), as the sound effects are
  today.
- **Music states.** Menu → build → wave → boss → game over, plus paused (music lowered, not stopped), as a
  small pure state machine so it can be unit-tested without Web Audio.
- **Sound effects.** Keep procedural sounds as the base and allow recorded samples through the same SFX
  bus. Map game events to sounds with a data table, so new towers, enemies and upgrades get sounds by
  configuration (consistent with the data-driven content direction in section 7). Add small pitch and
  volume variation, a cap on simultaneous voices with priorities, and brief music ducking for big moments
  (boss arrival, upgrade pick).
- **Focus and visibility.** Tab hidden: fade out, then suspend the audio context (saves battery on
  mobile). Window unfocused but visible: lower the music. Restore with a short fade on return.
- **Autoplay.** Create or resume the audio context only inside a user-activation event: `keydown`, a
  mouse `pointerdown` or `click`, or a touch `pointerup`/`touchend`. Music starts when the player presses
  Play, never on page load.
- **Assets and licensing.** Original compositions, or tracks with a license that allows redistribution in
  a public web game and repository (e.g. CC0, or a royalty-free license that permits it). Keep license
  texts and attributions with the audio files and show credits in the game. Ship Ogg (Opus/Vorbis) with
  an AAC/M4A fallback for Safari, loudness-matched across tracks. Load music lazily after the first
  interaction so the first page load stays small (about 355 KB today); budget roughly 1–1.5 MB per
  compressed track.
- **Performance.** Decoded audio is large (about 23 MB per stereo minute at 48 kHz), so keep loops short,
  keep only the current and next track decoded, and release the rest; if mobile memory is still tight,
  stream music through media elements and hide the loop point with a short crossfade. Cap concurrent
  voices (lower on mobile) and suspend the audio context while hidden or fully muted. Audio never runs
  inside the simulation, only as an event listener.
- **Modules.** `src/audio/` with an engine (context, buses, unlock, focus handling), a music player
  (states, crossfades, layers), the SFX mapper, and audio settings in `game/persistence.ts`.
- **Settings and migration.** Add master, music and SFX volumes to the saved settings (stored 0–1, shown
  as 0–100%). Migrate today's `volume` into Master so sound effects keep their current loudness. Sliders
  go in the main menu and the pause menu, usable with the keyboard; the existing `M` key and speaker
  button stay as the global mute.

### Acceptance criteria and tests

- Unit tests: volume maths, settings migration and persistence, music state transitions.
- End-to-end tests: sliders and mute persist across reloads; no audio before the first interaction.
- Manual listening checklist: inaudible loop seams, a clean boss transition, no clipping at full volume
  with a full board at 3x, behaviour on focus loss and return, and mobile Safari and Chrome.
