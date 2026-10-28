# Last Stand

A browser roguelite tower defense game. Build towers along the path, survive escalating waves, and see how long you can hold the line.

Built with TypeScript, Phaser 3 and Vite. No backend.

**Status:** Phase 1 (playable prototype). See [docs/PLAN.md](docs/PLAN.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for what has shipped. Each release is tagged `last-stand-vX.Y.Z`.

## How to play

| Action | Mouse | Keyboard |
| --- | --- | --- |
| Select Turret | Click it in the build bar | `1` |
| Build | Click a free tile | |
| Cancel selection | Right-click | `Esc` |
| Start next wave | Start Wave button | `Space` |
| Restart after game over | Play again | `R` |

Hover an existing tower to see its range. Each enemy that reaches the red exit costs 1 health; the run ends at 0.

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
src/config   Tunable game data (towers, enemies, map, balance)
src/core     Simulation and rules (no Phaser, unit-tested)
src/game     GameSession: glue between simulation, scene and UI
src/render   Phaser drawing
src/scenes   Phaser scene: game loop and board input
src/ui       HTML HUD and keyboard shortcuts
tests        Vitest tests
```

All gameplay numbers live in `src/config`. Change a value there, and the game and tests pick it up.
