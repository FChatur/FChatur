# Last Stand: Development Plan

## 1. Major technical risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| **Game logic tangled with rendering** | The most common way small Phaser games become unmaintainable. Makes 2x speed buggy, balancing slow, and testing impossible. | The simulation (`src/core`) is plain TypeScript with no Phaser or DOM imports. Phaser only draws state and forwards input. |
| **Frame-rate dependent gameplay** | Variable `delta` makes runs behave differently on 60 Hz and 144 Hz screens and breaks at 2x speed. | Fixed 60 Hz simulation step with an accumulator; rendering interpolates positions between steps. 2x speed = more steps per frame, same rules. |
| **Roguelite upgrade combinatorics** | Six upgrades that stack (chain + explosive + crit) can multiply into degenerate damage or be dead picks. | Upgrades will be data-driven modifiers applied through one stat pipeline, with explicit caps. A headless auto-player (already used for the Phase 1 probe) measures how far runs get with each build. |
| **Endless scaling cliff** | Exponential enemy health against linear income gives a run that is trivial for 20 waves and then collapses in one. The Phase 1 probe shows exactly this at wave ~23. | Rebalance in Phase 3 once tower upgrades and armored enemies exist; track "waves survived" from scripted bots per build. |
| **Late-wave performance** | Hundreds of projectiles and tweens per second on low-end laptops. | Entity counts are small by design; views are created and destroyed per entity today. If profiling shows GC spikes, add object pooling (contained to `EntityRenderer`/`Effects`). |
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

### Phase 2: Core tower defense
- Sniper, Rapid and Frost towers; slow status effect.
- Runner, Armored (flat armor) and Boss enemies; mixed wave composition.
- Tower selection panel: upgrade (3 levels) and sell (partial refund).
- Targeting improvements only if playtesting shows a need.

### Phase 3: Roguelite system and balance
- Upgrade pick every 5 waves: Chain Lightning, Overclock, Critical Strike, Compound Interest, Frostbite, Explosive Rounds.
- Modifier pipeline so upgrades compose predictably; caps where needed.
- Headless balance harness: scripted builds, waves-survived report; fix the late-game cliff.

### Phase 4: UI, effects, sound, QoL
- Main menu, pause/resume, 1x/2x speed, personal best wave.
- Procedural Web Audio SFX + mute toggle; settings persisted.
- Effect polish (muzzle flashes, slow visuals, boss intro), first-run tutorial flow.

### Phase 5: Testing, optimization, deployment
- Cross-browser pass (Chrome, Firefox, Edge, Safari), profiling late waves, pooling if needed.
- Error-free console, tab-switch behaviour, window resizing.
- GitHub Pages deployment and share link; README polish.
