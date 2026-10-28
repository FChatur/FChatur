# Visual Identity and Combat Prototype

Requested by the owner after playtesting v0.5.0 to about wave 35: the game runs smoothly and the
difficulty curve is reasonable, but combat looks dull ("abstract orbs attacking other orbs on a dark
grid"). Goal: turn Last Stand into a **pixel-art fantasy** tower defense roguelite, starting with a
focused, reviewable prototype on the existing map (Switchback) with the existing four towers.

**Status:** prototype on the development branch only. `main` and the `last-stand-v0.5.0` tag stay as
they are until the owner has reviewed screenshots or a playable preview and approved the direction.

**Scope (set by the owner):** no new maps, towers, enemies, run upgrades or major systems. Reuse the
simulation, economy, waves, upgrades, performance work and tests. New in this prototype: the art style,
the interface layout, drag-and-drop building, and per-tower targeting controls.

## 1. Pixel-art visual specification

### Style
- **Medieval fantasy, top-down three-quarter view**: the ground is seen from above; trees, towers and
  creatures stand up from it and show their front. One light source, from the **upper left**.
- **Readable first.** Creatures and projectiles are the most saturated, highest-contrast things on screen;
  terrain is calmer and slightly desaturated, so units pop even in crowded waves.

### Pixel grid and scale
- **16 × 16 art pixels per tile.** One art pixel = 3 world units (tiles are 48 world units), so the
  simulation, ranges and speeds are untouched.
- The map (20 × 12 tiles = 320 × 192 art pixels) is drawn at a **whole number of device pixels per art
  pixel** (for example 4 × 4 at 1080p, 6 × 6 at 1440p), with nearest-neighbour sampling: every art pixel
  is a crisp square of identical size. No fractional scaling, no blur.
- Leftover space around the map is filled with **more scenery** (forest and rocks beyond the clearing),
  not black bars. The playable area stays exactly the same.
- Sprites move smoothly in whole device pixels. Art is never freely rotated or scaled; animation uses
  frames, horizontal flips and transparency. Directional art (ballista, arrows) is drawn per direction.

### Sprite sizes (art pixels)
| Thing | Size | Notes |
| --- | --- | --- |
| Tile | 16 × 16 | grass and road variants |
| Tower | 16 wide, up to 28 tall | base per level + an animated defender on top; stands on its tile |
| Goblin (Grunt) | ~12 × 13 | small, green skin, red rag, dagger |
| Wolf (Runner) | ~16 × 11 | long, low, grey |
| Armored Orc (Brute) | ~14 × 16 | broad, steel armor and helmet |
| Ogre (Warlord boss) | ~24 × 26 | huge, club, war paint |
| Projectiles | 5–11 long | arrows, ballista bolt, ice shard |
| Effects | 5–32 | sparks, impacts, frost burst, explosion, dust, coins |

### Palette and rendering rules
- One shared palette of ramps (outline ink, stone, wood, dirt, grass/foliage, skins, fur, metal, red,
  gold, frost blue, arcane purple). Every sprite uses only palette colours; a unit test enforces it.
- 1-pixel dark outline around creatures, towers, props and projectiles; terrain has none.
- Three-tone shading per material (shadow, base, light), light from the upper left.
- Soft oval shadows under creatures, towers and trees.
- Animation: walk and run cycles of 4 frames, timed by **distance travelled** so feet never slide and
  slowed enemies visibly walk slower; attack animations of 2–3 frames when a tower fires; effects of 3–5
  frames in real time, so they stay readable at 3x speed.
- In-canvas text uses an original 5 × 7 pixel font with a baked outline; the HTML interface uses
  Pixelify Sans (SIL Open Font License), bundled with the game.

### Identities (from the owner's suggestions; roles unchanged)
| Game role | Look | Attack and feedback |
| --- | --- | --- |
| Turret | **Archer Tower**: wooden watchtower → stone tower → banner and roof | arrow that turns toward its target, small hit spark |
| Sniper | **Ballista Tower**: heavy crossbow on a platform, aims in 8 directions | long, heavy bolt; big impact; damage number on heavy hits |
| Rapid | **Ranger Tower**: wooden hut with a green canopy, hooded ranger | quick, short green-fletched arrows |
| Frost | **Frost Mage Tower**: stone spire with a mage and an ice crystal | ice shard, frost burst; slowed enemies turn icy blue |
| Grunt | **Goblin** | dust puff and coin on death |
| Runner | **Wolf** | |
| Brute | **Armored Orc** | |
| Warlord | **Ogre Boss** | ground-shaking entrance, large health bar |

### Environment (Switchback)
Grassy clearing with a dirt road (worn edges, pebbles), wildflowers and grass tufts on buildable land
(purely decorative, never blocking). Trees, bushes and rocks frame the clearing outside the playable
area. The road enters from a dark cave on the left and ends at a wooden palisade gate on the right (the
thing being defended).

## 2. Asset creation and integration

- **All art is original and lives in the repository as code**: small indexed pixel maps (rows of
  characters mapped to palette colours) for creatures, towers, props and the font, plus deterministic
  generators for things that are better computed (grass and road tiles, arrows in 16 directions, effect
  frames, range circles).
- At startup the game rasterises them into one set of textures (milliseconds, a few kilobytes of source,
  no image downloads). The same rasteriser runs in Node: `npm run art` writes a contact sheet PNG for
  reviewing every sprite at once.
- Unit tests check the art: palette-only colours, consistent frame sizes per animation, every enemy and
  tower type has a complete sprite set.
- **Replacing art later**: texture keys and frame layouts are the contract. An artist can deliver PNG
  sprite sheets (or Aseprite exports, which Phaser reads natively) with the same frames and the code that
  places them stays the same.
- No third-party artwork. The UI font is Pixelify Sans (SIL OFL 1.1, via the `@fontsource` package).

## 3. Proposed interface layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ LAST STAND  v0.6   [run upgrade chips]      ⚔ Wave 12  ● 340  ♥ 18   🔊 │
├─────────────┬──────────────────────────────────────────────┬───────────┤
│ TOWERS    « │                                              │ ARCHER    │
│ ┌─────────┐ │                                              │ TOWER  ★★ │
│ │ [art]   │ │          battlefield (whole-pixel scale,     │ stats     │
│ │ Archer  │ │          scenery fills the spare space)      │ targeting │
│ │ ● 50  1 │ │                                              │ [F][L][S] │
│ └─────────┘ │                                              │ [Fast]    │
│ (Ballista)  │                                              │ Upgrade   │
│ (Ranger)    │                                              │ Sell      │
│ (Frost Mage)│                                              │ (overlay) │
├─────────────┴──────────────────────────────────────────────┴───────────┤
│ hint …                          [1x 2x 3x]  [Pause]  [Auto]  [Wave 13 ▶]│
└────────────────────────────────────────────────────────────────────────┘
```

- **Left sidebar shop**: large cards with tower artwork, name, price and hotkey. Unaffordable towers are
  dimmed with the price in red. A clear collapse button (« / ») shrinks it to an icon rail; the choice is
  remembered. Collapsing gives the battlefield more room.
- **Drag and drop**: drag a card onto the map. While dragging, the target tile, a ghost of the tower and
  its range are shown in green (valid) or red (blocked, with the reason). Releasing on a valid tile builds;
  releasing anywhere else, pressing Esc or right-clicking cancels. Nothing is ever built during a drag,
  only on a valid release, and a drop never leaves a tower "armed".
- **Click to build still works**: click a card (or press 1–4), then click tiles. Building now happens on
  click release on the same tile, so a click that turns into a drag can't build by accident.
- **Battlefield**: whole-pixel scaling only, so it never stretches or distorts when the window or sidebar
  changes; it is always centred, and the extra space shows scenery.
- **Right tower panel** (kept as an overlay so selecting a tower never resizes the map): clearer
  hierarchy. Tower art, name and level stars; key stats with the next level's values; a **Targeting**
  segmented control; then Upgrade and Sell.
- The bottom bar keeps speed, pause, Auto Wave and Start Wave, slimmer than before.

## 4. Targeting controls

- Four modes on every built tower: **First** (closest to the exit), **Last** (furthest from the exit),
  **Strongest** (most health left), **Fastest** (fastest-moving right now, after slows).
- Changed in the tower panel (segmented buttons, selected one highlighted, tooltip explaining each) or
  with **T** to cycle. Each tower keeps its own mode; defaults are unchanged (Ballista: Strongest, others:
  First), so existing balance is identical until the player changes something.
- Global range is untouched: the Ballista can use any mode across the whole map.

## 5. Combat balance review (evidence)

Tools: `npm run balance` now also writes `tower-report.md`: paper stats, damage dealt per tower type in
bot runs, swap tests (the Mixed build with one tower slot changed), early-game openings and
Frostbite on/off. Eight seeds per build. The numbers below are from v0.5.0's balance.

| Finding | Evidence |
| --- | --- |
| On paper the Sniper has the lowest damage per gold | DPS per 100 gold: Sniper 18–20, Turret 27–28, Rapid 33–36 (vs. unarmored) |
| In real runs it deals the most damage per gold, because global range means it is never idle | Mixed build, damage per gold: Sniper 340, Rapid 241, Turret 199, Frost 35 (support) |
| Its slot is the most valuable in a mixed build | Replacing the Sniper slot with any other tower: −6 waves (44 → 38) |
| It is a poor early purchase | Turret → Sniper → Turret opening: leaks from wave 1 in every seed, health 8/20 by wave 12; a Turret or Rapid there: no leaks |
| Snipers scale best late | Two Turrets, then only Snipers: median wave 40; only Turrets or only Rapids: 33 |
| Turret and Rapid are worth the same | Swapping one for the other in the Mixed build: ±0 waves |
| One Frost is very valuable, a second is not | Mixed without its Frost: −4 waves; a second Frost instead of the Rapid: −4 waves |
| Frostbite is not overpowered for the bots | Frostbite allowed vs never picked: ±1 wave (Frost + Rapid build and Mixed) |

**Reading:** the bots disagree with "the Sniper is extremely weak": it is the strongest late-game tower
and only weak early (110 gold, overkill on low-health enemies). What the playtest felt is mostly
**feedback**: v0.5.0's Sniper fires a tiny, nearly invisible dot every 2.2 s at the toughest enemy
anywhere, often far from where the player is looking, and each hit removes a sliver of a late-game health
bar. Likewise the Turret is as effective as Rapid, but its slow single orbs look like nothing is
happening, while Rapid's stream and Frost's visible slow look effective.

**Recommendations:**
1. **No stat changes in this prototype.** Two candidate Sniper tweaks were tested: a cheaper build with
   the same total cost (100 + 110 + 170), and a faster level-1 fire rate. Neither improved results
   consistently. The cheaper build helped a Sniper-second opening (+3 waves) but cost 2–4 waves in other
   builds. Both were rejected.
2. Fix the feel. The Ballista gets a heavy, visible bolt, a big impact and a damage number on heavy hits.
   The Archer gets visible arrows with hit sparks.
3. **Targeting controls** let the player aim the Ballista at the enemy closest to the exit (First) or
   at Runners (Fastest) instead of a far-away tank. This answers "my expensive tower ignores what's
   leaking".
4. The tooltip states each tower's role plainly. The Ballista's says it is an expensive late-game
   investment.
5. Re-playtest with the new visuals before changing numbers. The report makes any proposed change quick
   to measure.

Bot limitations: the bots don't sell, don't change targeting, and upgrade every tower before building
more. Humans play differently, so the playtest stays the final judge.

## 6. Implementation steps

1. This document and the roadmap entry (before the Maps and Map Selection work).
2. Balance tooling and the evidence above.
3. Targeting modes in the simulation, with unit tests.
4. Art pipeline: palette, sprite format, rasteriser, contact sheet, art tests.
5. Sprites: terrain and props, the four towers at three levels, the four creatures with animations,
   projectiles, effects, pixel font.
6. Renderer: whole-pixel viewport with scenery bleed, terrain, creatures and towers with depth sorting,
   projectiles and impacts, placement preview, range circles.
7. Interface: left sidebar, drag and drop, redesigned tower panel with targeting, restyled bars and
   overlays, UI font.
8. Verification: unit tests, end-to-end tests in three browsers (updated and new: drag and drop, sidebar,
   targeting), a performance comparison with v0.5.0 on a crowded late wave, a real-browser playtest,
   screenshots for review.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Hand-made programmer art looks amateurish | Strict palette, outline and shading rules; contact-sheet reviews; art is swappable for an artist's later |
| Whole-pixel scaling leaves unused space at some window sizes, and small windows get a smaller map | Scenery fills the space; the map only ever shrinks to the next whole step |
| Crowded waves become unreadable | Distinct silhouettes and colours per creature, outlines, depth sorting, health bars only when damaged, capped effects |
| Performance with many animated sprites | Single texture sets (batched draws), no per-frame allocation, pooling kept; measured against v0.5.0 |
| Drag-and-drop edge cases (leaving the window, Esc, right-click, touch) | Pointer capture, explicit cancel paths, end-to-end tests |
| End-to-end tests assumed the canvas is exactly the map | Tests read the map's on-screen rectangle from the page instead |
| Rotated pixel art looks broken | Directional frames and flips instead of rotation |
