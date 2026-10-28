# Project: Last Stand

A browser roguelite tower defense game (TypeScript + Phaser 3 + Vite, no backend).
All game code lives in `last-stand/`. This repo is also the owner's GitHub profile repo,
so keep the repo root free of game files (no root README).

## Where things are

- `last-stand/README.md`: how to play, run, test, build and deploy.
- `last-stand/docs/PLAN.md`: risks, architecture, MVP and the phased roadmap (with status).
- `last-stand/CHANGELOG.md`: every completed feature and fix, by version.
- `last-stand/src/config/`: all tunable gameplay numbers. Balance changes go here, not in logic.
- `last-stand/src/core/`: simulation rules. Must not import Phaser or touch the DOM.

## Working rules (set by the owner, apply to every change)

1. **Modify, don't rebuild.** Extend the existing code and architecture; no rewrites unless asked.
2. **Preserve existing features** unless the owner explicitly asks for removal.
3. **Stay focused** on the requested change. Note unrelated ideas instead of doing them.
4. **Check for bugs and side effects** before committing:
   - `npm test`, `npm run build` (includes typecheck) in `last-stand/`.
   - Add or update unit tests for any rule change in `src/core`.
   - Playtest in a real browser (Playwright against `npm run preview`) for anything visible
     or interactive, and check the console for errors.
5. **Keep the playable version updated**: commit and push working changes; `main` auto-deploys
   to GitHub Pages via `.github/workflows/last-stand.yml`.
6. **Briefly explain what changed** to the owner after each change.
7. **Update `last-stand/CHANGELOG.md`** in the same commit as the change (under `Unreleased`,
   or under the new version when releasing).
8. **Checkpoint before major changes** (new phase, new system, refactor, balance overhaul):
   make sure the current state is committed and tagged (see Versioning) *before* starting.

## Versioning and checkpoints

- Semantic-ish versions in `last-stand/package.json`; the game shows its version in the UI.
  - Minor bump (`0.x.0`) per completed phase or significant feature set.
  - Patch bump (`0.x.y`) for fixes and small tweaks.
- A checkpoint = release commit + git tag `last-stand-vX.Y.Z` on a passing build.
  To release: move `Unreleased` entries under a new version heading in the changelog, bump
  `package.json` (`npm version X.Y.Z --no-git-tag-version`), commit, push, and get it onto `main`.
- Tags are created by CI, not by hand: when `main` builds green, the `tag` job in
  `.github/workflows/last-stand.yml` tags the commit that set the current version, if that tag
  doesn't exist yet. (Claude sessions can't push tags, only their own branch.)
- Before a major change, make sure the current version is released and its tag exists on GitHub.
- To roll back to a checkpoint: `git checkout last-stand-vX.Y.Z` (or branch from it).
