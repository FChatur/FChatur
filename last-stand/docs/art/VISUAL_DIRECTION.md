# Last Stand visual direction (v0.8.0)

Status: **draft for the owner's agreement** (2026-10-30). Nothing is generated or implemented until
it's agreed. Design only: no game changes.

Manny-specific work (knockback, balance, his design lab) is **on hold** and kept as decided:
[KNOCKBACK.md](../KNOCKBACK.md), [MANNY_ASSETS.md](MANNY_ASSETS.md), [balance/manny.md](../balance/manny.md).

## 1. Direction: clean, colourful, spacious

**Target:** a polished, colourful, readable tower-defense game, not a crowded fantasy painting.

The first Storybook Painted scene ([reference/scene-a-v1.webp](reference/scene-a-v1.webp)) was
attractive but cramped:
- characters too large for the map;
- detail everywhere;
- a busy, heavily bordered interface.

The concept sheet ([reference/concept-sheet-v1.webp](reference/concept-sheet-v1.webp)) still sets the
bar for **personality**, not for detail level.

**Keep:**
- soft, colourful 2D fantasy art;
- expressive, distinctive characters with clean silhouettes and appealing animation;
- a polished fantasy interface.

**Change:**
- characters 30–40% smaller in the gameplay view, with simpler rendering;
- simple terrain, road and grass, with detailed scenery mainly at the map edges;
- less interface ornamentation and fewer borders;
- a larger, more open battlefield with room for free tower placement and enemy movement;
- effects that read clearly without visual noise.

## 2. Rules

Sizes are on the 1600 × 900 screen. The map area is 1336 × 768, about 28 × 16 tiles of 48 px.

### Scale (about 35% below scene v1)

| | Scene v1 | Target | In tiles |
| --- | --- | --- | --- |
| Heroes | ~120 px | **75–85 px** | ~1.7 tall, ~1 tile footprint |
| Goblin | ~75 px | **~45 px** | ~1 |
| Wolf | ~60 px tall | **~35 px tall, ~55 px long** | ~1 long |
| Armoured orc | ~95 px | **~60 px** | ~1.3 |
| Ogre Warlord (boss) | ~260 px | **~140 px** | ~3 |
| Road width | varies, opens into clearings | **~70 px, constant** | ~1.5 |

### Characters
- **Personality comes from shape:**
  - a recognisable head or hat shape;
  - one signature colour;
  - a signature weapon;
  - a clear pose.

  Faces are simple, with readable eyes and expression, but no fine painted detail.
- **Rendering:**
  - flat base colours with one soft shadow tone and one highlight;
  - a medium dark outline (about 2–3 px at gameplay size);
  - a soft contact shadow.
- **Hero colours:** Wren red, Brakk rust-orange and brass, Fen teal and cream, Old Rime icy blue and
  white. Each enemy type has its own hue family, distinct from the grass.
- **Placement marker:** a small flat base disc (about 1 tile), with a ring when the hero is selected.
  Large stone plinths take too much room.

### Map
- **The open playfield:**
  - two or three grass tones in large soft shapes;
  - sparse small tufts or flowers;
  - no per-blade or per-stone texture.
- **The road:**
  - one flat, light, warm colour, clearly lighter than the grass;
  - soft, continuous edges;
  - a constant width, with no clearings.
- **Scenery** (trees, rocks, cliffs, water, buildings, the gate):
  - concentrated in a border band of about 1–2 tiles;
  - a few small accents further in, kept well away from the road.
- **At least about 60% of the playfield** is open, buildable ground. The road's turns leave clear
  pockets for heroes on both sides.

### Interface
- **Panels:**
  - flat dark violet panels at slight transparency;
  - one thin gold accent line;
  - rounded corners;
  - no double frames, rivets or banners.
- **Bars:**
  - a slim top bar (about 56 px) with icons and numbers only;
  - a compact bottom bar.
- **Hero shop:**
  - illustrated portraits are kept (the one place for detailed art);
  - simple cards without star rows or heavy frames;
  - the shop can collapse to give the map more room.
- **Upgrade panel:** appears only when a hero is selected.
- **Gold:** saved for primary actions (Next wave, Upgrade).

### Effects
- **Projectiles:** short, thin streaks in the hero's colour (an arrow, a bolt, a frost shard).
- **Impacts:** small and brief, about 1 tile or less and 0.2–0.3 s, with no screen-wide glow.
- **Enemy states:** tint and outline only (frost blue for slowed, a white flash for a hit); never
  cover the enemy.
- **Big moments:** the boss hit and the ballista get one extra frame of punch, not more particles.

### Animation
A few strong poses with squash and stretch:
- idle breathing;
- attack anticipation, release and recoil;
- a hit flinch;
- a victory pose.

Built as a small set of parts or frames per character, light enough to cover 12–20 heroes and 15–25
enemies.

## 3. Next step, after agreement

1. Update the layout guide ([reference/scene-layout-guide.png](reference/scene-layout-guide.png)) to the
   sizes above. It still shows the earlier, larger sizes.
2. Generate one scene with it in this simpler direction, then review it as before.

**History:** an earlier version of this file compared three directions (Storybook Painted, Bold Toon,
Toy Diorama) and held their scene prompts. Bold Toon and Toy Diorama are parked. That version is in git
history at commit `89fb4ea`.
