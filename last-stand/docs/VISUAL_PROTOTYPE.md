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

## 8. Visual Prototype V2: colour, life and polish (GitHub issue #1)

Owner feedback on V1: "A little more polished! Pixelated is also cool, but it lacks color and life."
V2 keeps the pixel-art direction and makes it warmer, livelier and clearer. Review-only: not on `main`.

### What V2 changes (implemented in code, visible in the game on the development branch)
- **Colour and light:** warmer, more saturated meadow greens and cooler, deeper forest greens, so the
  clearing glows against the forest frame; warmer road earth with a dark rim, so the path is the
  strongest shape on the map. Sunlit glades and shaded hollows instead of one flat green; warm sunlight
  from the upper left is baked into the ground (no per-frame cost). New pink and water colours.
- **Living battlefield:** a composed tree line hugging the clearing, canopies casting dappled shade;
  undergrowth, flower meadows in one or two colours each, a pond with lily pads and reeds, a
  timber-framed cave with torches and eyes blinking in the dark, a gatehouse with torches. Ambient
  motion: flickering torches, butterflies over meadows, falling leaves, swaying grass at the edge.
  Everything ambient stays behind creatures and towers, and is off with reduced motion.
- **Distinct towers:** Archer = red, steel and stone, rectangular (watchtower → keep with twin banners);
  Ranger = green and organic (treehouse with leafy boughs, lantern, rope ladder; pale-green hooded ranger
  with a longbow); Ballista = heavy artillery (sandbags, iron bands, bolt rack, larger iron-banded
  crossbow); Frost Mage = magical (pale spire with glowing runes and ice shards; wizard whose staff
  crystal pulses and flares when casting). Each upgrade level adds visible material, height or regalia.
- **Expressive enemies:** olive-khaki goblins (they no longer blend into the grass) with red eyes;
  wolves with a dark back and red eyes; orcs with horned helmets, glowing eyes and a red cape; the ogre
  with glowing eyes.
- **Combat impact:** creatures flinch one pixel away from each hit as they flash; slowed creatures carry
  a bobbing snowflake; ballista hits add a small, rate-limited camera kick; explosions are a fiery core
  and an expanding shockwave ring (V1's solid blasts hid the enemies inside them).

### Proposed only (shown in mockups, not built yet)
- The interface: collapsible left sidebar shop with large cards, drag-and-drop building with ghost and
  build grid, and the redesigned tower panel with targeting buttons. The game logic behind it exists
  (targeting modes, drag state, release-to-build); the HTML interface is still v0.5.0's. V2 mockups use
  bigger, higher-contrast text and a smaller, opaque tower panel placed on the side of the board away
  from the selected tower.

### Results (measured on the development branch)
- Unit tests 143/143; production build passes; browser tests 9/9 in Chromium (Firefox and WebKit run in
  CI; not installed locally). Two browser tests were updated for the new tower names and one helper to
  find the map on the larger canvas.
- Crowded wave 50 (20 maxed towers, 31 enemies, 3x, 1600×1012, headless software rendering, so compare
  relatively): v0.5.0 10.8 fps, V1 16.3 fps, V2 18 fps (p95 frame 66.7 ms vs 116.7 ms on v0.5.0). A
  first V2 attempt drew sunlight as a full-screen translucent layer and dropped to 13.7 fps; baking it into
  the ground fixed that.
- Legibility: checked at actual scale (4× at 1600×1012, 3× at 1366×768): the whole map fits at a whole
  scale, the road is the strongest shape, slowed and damaged enemies are distinguishable.

## 9. Tower personality and character identity (GitHub issue #2)

Goal: four defenders players recognise and get attached to, not four interchangeable buildings. Each
tower becomes a named hero standing on a structure that grows with them. Review-only: nothing here is on
`main`, and nothing below changes stats, targeting or the simulation.

### What exists now (art code and preview tooling, not wired into the game)
- `src/art/sprites/characters.ts`: the four heroes, three levels each, with idle (3 frames), attack
  (2 frames; Ballista 3) and victory (2 frames) poses, plus their pedestals. Same pipeline as V2: palette
  colours only, auto ink outline, 3 world px per art px, rasterised at runtime.
- `tests/art/heroes.art.ts` and `tests/art/combat.ts` (`npm run art`, output in `art-preview/`): lineup at
  real scale (4×) and enlarged (10×), the upgrade stages, animated reels (APNG) per hero at level 1 and 3,
  shop portraits, transparent placement ghosts and a crowded wave-27 still.
- `docs/mockups/heroes-shop.html`: the left shop and tower panel, built from those images
  (`?view=select`, `?view=place`, `?view=drag`). Run `npm run art` first.
- The game itself still draws the V2 towers and the v0.5.0 interface.

### The four heroes
Sprite sizes are in art px (one tile = 16): 18 wide, 26–36 tall, so every hero stands about 1.6–2.2 tiles
tall on a one-tile footprint; the Ballista is 30 wide.

**Wren, Archer (dependable starter).**
- Silhouette: crimson hood with a long tail that kinks in the wind, a cheeky grin, and a bow held across
  the body. The only red hero, so a group of them reads at a glance.
- Animation: a calm idle with a slight breathing bob; a deliberate full draw (arrow at the cheek), then a
  loose with the arm thrown forward. Victory: the bow raised overhead.
- Upgrades: L1 timber lookout → L2 stone tower with banner, feather in the hood and a steel pauldron →
  L3 keep with crest and twin banners, gold-trimmed hood, red cape and gilded bow.
- Feedback: an arrow per shot (unchanged); the draw/loose frames line up with the projectile spawn.

**Brakk, Ballista (heavy hitter).**
- Silhouette: a stocky dwarf engineer, steel helmet with goggles pushed up, ginger beard, blue overalls,
  next to a crossbow nearly twice his size. The widest sprite in the game, on purpose.
- Animation: idle tapping the frame with a wrench; attack is three beats: wind-up (wrench raised, bow
  cocking), release (the bow kicks back), recovery. The bow keeps V2's eight aiming directions.
- Upgrades: L1 plank deck, wooden bow → L2 stone emplacement with sandbags, iron-banded bow, apron and
  lamp → L3 iron bunker with banner, steel and gold bow, gold helmet crest and goggles.
- Feedback: V2's camera kick and the damage number (the only tower that shows numbers), bolt impact
  burst.

**Fen, Ranger (energetic sharpshooter).**
- Silhouette: a lean blond elf with a pointed ear and a green cloak flaring behind; narrower and more
  forward-leaning than Wren, green instead of red, no hood over the face.
- Animation: a bouncy idle; attacks alternate two quick shots while leaning into them, so at 5–7.5 shots/s
  he looks busy without strobing. Victory: a little hop.
- Upgrades: L1 mossy stump → L2 sapling platform, leaf circlet and second quiver → L3 great tree with
  lanterns, gold-edged cloak, glowing bow and a falcon circling above his head.
- Feedback: many small arrows, no numbers, no particles (keeps late waves clean).

**Old Rime, Frost Mage (mysterious spellcaster).**
- Silhouette: an oversized star-spangled blue hat, glowing eyes in the brim shadow, a white beard and a
  staff with a crystal. The tallest hero; the hat is what you spot first.
- Animation: idle with the crystal pulsing; attack raises the staff as the crystal blazes; victory has
  the crystal flaring overhead.
- Upgrades: L1 rune stone → L2 frozen pillar with ice, taller hat with a bent tip → L3 floating ice dais
  over a rune circle, a crystal on the hat and gold stars on the robe.
- Feedback: the frost bolt, then V2's bobbing snowflake on every slowed enemy.

### Shop, ghost, panel and upgrade preview (proposed interface)
- One portrait per hero is used everywhere: the shop card, the collapsed rail, the placement ghost (the
  real sprite, semi-transparent, with its range ring), the selected-tower panel and the upgrade preview
  (current level → next level, with the stat changes and what visibly changes).
- Expanded shop (~270 px): large portrait, tower name, hero name in the tower's accent colour, a one-line
  role, cost and hotkey. Accents: Archer crimson, Ballista brass, Ranger leaf green, Frost ice blue.
- States: selected for building (bright frame, glow in the accent colour, "PLACING" tag); unaffordable
  (desaturated and dimmed, cost in red, "Need N more gold"); the same states on the rail.
- Collapsed rail (~85 px): portraits, cost and hotkey only; the board gains ~185 px of width, which the
  forest margin fills.
- Click-to-place and drag-and-drop both stay; the ghost and range ring follow the pointer in both.

### Late-wave clutter (proposed)
- Health bars: thin (1 art px fill in an ink frame), shown only on damaged enemies.
- Damage numbers: only for heavy single hits (Ballista); never for Ranger or Frost ticks.
- Particles: impacts are a few pixels, capped per frame; slowed enemies carry one snowflake each.
- Overlapping enemies: a small sideways draw offset per enemy (render only, the path and simulation stay
  the same) so a pack spreads instead of stacking into one blob. Not in the mockup yet.
- Tall heroes occluding the road behind them: draw towers and enemies sorted by their feet; if that is
  not enough, fade a tower when the pointer or an enemy is behind it.

### Options and tradeoffs
1. **Hero on a pedestal (proposed)** vs **structure-first** (V2: the building is the identity).
   Heroes give the attachment the issue asks for and read better at real scale; the cost is height:
   sprites reach about 2 tiles, so they overlap the tile above (see occlusion above).
2. **Ballista footprint:** keep the 30-px-wide crossbow (proposed: it says "heavy artillery" instantly)
   or shrink it to about 22 px so it never overhangs a neighbouring tile. The footprint and placement
   rules stay one tile either way.
3. **Hero names on cards:** shown under the tower name (proposed) or left out for a plainer UI. Names
   are flavour only; no other text or rules change.
4. **Reaction animations:** idle, attack and victory are drawn. Hit/ability is covered by the attack
   frames and effects. A short "alarmed" reaction (e.g. when a boss spawns or a life is lost) is not
   drawn yet; it would be one extra frame per hero.
5. **Victory timing:** play it when a wave is cleared (proposed) or only after a boss wave, to keep it
   special.

### After approval (implementation outline)
Replace the V2 tower sprites with the heroes in the atlas; drive idle, attack (on the shot event) and
victory (on wave clear) in `EntityRenderer`; build the left shop, rail, ghost and panel from the mockup;
add the declutter rules; then unit, browser and performance checks (wave-50 benchmark against V2's
18 fps) and screenshots for review.
