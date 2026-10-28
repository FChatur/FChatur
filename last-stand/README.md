# Last Stand

A browser roguelite tower defense game. Build towers along the path, survive escalating waves, and see how long you can hold the line.

Built with TypeScript, Phaser 3 and Vite. No backend.

**Status:** Phase 2 (full tower and enemy roster, upgrades, selling, game speed). See [docs/PLAN.md](docs/PLAN.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for what has shipped. Each release is tagged `last-stand-vX.Y.Z`.

## How to play

| Action | Mouse | Keyboard |
| --- | --- | --- |
| Pick a tower to build | Click it in the build bar | `1` Turret, `2` Sniper, `3` Rapid, `4` Frost |
| Build | Click a free tile | |
| Select a built tower | Click it | |
| Upgrade selected tower (3 levels) | Upgrade button | `U` |
| Sell selected tower (70% refund) | Sell button | `S` |
| Cancel / deselect | Right-click | `Esc` |
| Game speed 1x / 2x / 3x | Speed buttons | `F` cycles |
| Pick a run upgrade (every 5th wave) | Click a card | `1` `2` `3` |
| Start next wave | Start Wave button | `Space` |
| Restart after game over | Play again | `R` |

**Towers:** Turret (balanced), Sniper (long range, big hits, targets the toughest enemy), Rapid (fast weak shots, poor against armor), Frost (slows what it hits).

**Run upgrades:** after every 5th wave you pick 1 of 3 upgrades that last for the rest of the run, each
stackable to rank III: Chain Lightning, Overclock, Critical Strike, Compound Interest, Frostbite, Explosive Rounds.
They combine: Frost + Frostbite + Rapid shreds slowed enemies, Sniper + Critical Strike handles bosses.

**Enemies:** Grunt, Runner (fast, from wave 3), Brute (armored, from wave 5), Warlord boss (every 10th wave). Armor removes a flat amount from every hit, so prefer big hits against Brutes and bosses.

Hover a tower to see its range. Enemies that reach the red exit cost health (bosses cost much more); the run ends at 0.

## Run locally

Requires Node.js 20 or newer.

```bash
cd last-stand
npm ci          # install exact locked dependencies
npm run dev     # start dev server at http://localhost:5173
```

Other scripts:

```bash
npm test          # unit tests (Vitest)
npm run typecheck # TypeScript only
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build at http://localhost:4173
npm run balance   # bots play every map with several strategies; prints a waves-survived report
```

## Deploy

The build is a static folder (`dist/`) with relative asset paths, so it works from any URL path.

### GitHub Pages (automatic)

The workflow at `.github/workflows/last-stand.yml` tests and builds on every push that touches `last-stand/`, and deploys when the push is to `main`. On `main` it also tags each new version as `last-stand-vX.Y.Z` (taken from `package.json`).

One-time setup: in the repository on GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. After the next push to `main` the game is live at `https://<user>.github.io/<repo>/`.

### Cloudflare Pages

Create a Pages project connected to the repository with:

- Root directory: `last-stand`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

### Anywhere else

Run `npm run build` and upload the contents of `dist/` to any static host.

## Project layout

```
src/config   Tunable game data: towers, enemies, upgrades, global balance, maps (with per-map modifiers)
src/core     Simulation and rules (no Phaser, unit-tested)
src/game     GameSession: glue between simulation, scene and UI
src/balance  Headless balance harness (not part of the game bundle)
src/render   Phaser drawing
src/scenes   Phaser scene: game loop and board input
src/ui       HTML HUD and keyboard shortcuts
tests        Vitest tests
```

All gameplay numbers live in `src/config`. Change a value there, and the game and tests pick it up.
