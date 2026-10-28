# Changelog

All notable changes to Last Stand. Newest first.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each version has a matching
git tag `last-stand-vX.Y.Z` that can be checked out to play or restore that build.

## [Unreleased]

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
  Scheduled for Phase 3 balancing.
