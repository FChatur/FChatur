# Last Stand visual direction (v0.8.0): process and options

Status: **proposal for the owner's approval** (2026-10-30). Design only: no game changes.

**Priority (owner, 2026-10-30):** one cohesive, high-quality visual identity for the whole game comes
first, across:
- the four heroes (Wren, Brakk, Fen, Old Rime);
- enemies and their readability;
- maps (terrain, roads, scenery);
- the interface (menus, portraits, upgrade panels);
- combat effects and polish.

Manny-specific work (knockback, balance, his design lab) is **on hold** and kept as decided:
[KNOCKBACK.md](../KNOCKBACK.md), [MANNY_ASSETS.md](MANNY_ASSETS.md), [balance/manny.md](../balance/manny.md).

The concept sheet ([reference/concept-sheet-v1.webp](reference/concept-sheet-v1.webp)) sets the bar
for personality and quality. Its details aren't final.

## 1. Process (four steps, judged on whole game scenes)

1. **Pick the candidates.** This document proposes three strong, clearly different directions
   (section 2). You can approve, drop, or swap one.
2. **One complete scene per direction, same layout.** Each direction is generated as a full
   1600 × 900 gameplay screen from one fixed layout guide
   ([reference/scene-layout-guide.png](reference/scene-layout-guide.png)).
   - The guide fixes the route, the castle gate, the four heroes, every enemy type and the boss, the
     shots and impacts, and the whole interface (top bar, hero shop with portraits, upgrade panel,
     bottom bar).
   - Everything is at real gameplay size: heroes ~100–118 px tall, a goblin 55 px, the boss 150 px.
     The scenes therefore differ only in style.
   - Two or three attempts per direction in ChatGPT; keep the best. The prompts are in section 4.
3. **Review at real scale.** I check each scene:
   - at 100% on a 1600 × 900 screen, and at phone scale;
   - in greyscale (do heroes, enemies, road and interface separate by brightness alone?);
   - with a squint/blur test (what reads first);
   - for cohesion of characters, map, interface and effects.

   You get one side-by-side comparison with a short scorecard (section 3). There's no new tooling: just
   the images and the analysis.
4. **Decide and lock.** You choose a direction, or a blend such as "A's characters with B's
   readability". I then write **style guide v2**: palette, outline and lighting rules, proportions,
   enemy readability rules, map kit, interface kit, effect language, and the production order. Manny
   later resumes inside it.

Only after step 4 come shortlist extras (a main-menu or upgrade-draft screen) and any asset or
animation production.

## 2. Three directions

All three keep the game's personality bar: big readable heroes with attitude, comic enemies, juicy hits.

### A. Storybook Painted (the concept sheet, refined)
- **Look:** painted cel shading with soft gradients, warm afternoon light, thick plum-brown outlines;
  heroic cartoon proportions; a richly propped, layered environment (cliffs, water, fences, crates).
- **Interface:** a dark violet and gold trim, illustrated portraits.
- **Effects:** glowing additive bursts, debris and dust.
- **Strengths:** the closest to what you liked; feels premium and full of life.
- **Risks:**
  - Painted detail turns to mush at 100 px.
  - A busy, detailed ground competes with enemies for attention.
  - Painterly style is the hardest to keep consistent across dozens of generated assets.

### B. Bold Toon (graphic, readability first)
- **Look:** flat colour with one crisp shadow tone, very thick uniform outlines, chunky simple shapes,
  exaggerated poses and faces. The environment is built from big clean colour areas, stylised
  patterned foliage and a high-contrast road. A strict palette: warm heroes, cool or neutral ground,
  saturated enemies.
- **Interface:** chunky, bright, sticker-like badges.
- **Effects:** graphic shapes such as star bursts, speed lines and comic "pow" frames.
- **Strengths:**
  - reads best at 100 px and on phones;
  - the easiest style to keep consistent across a growing roster and to animate (clean parts suit
    rigs);
  - the lightest on performance.
- **Risks:** can look less premium, or like generic mobile art, if the shapes and palette aren't
  distinctive enough.

### C. Toy Diorama (soft 3D-render look in 2D)
- **Look:** characters like rounded vinyl or clay toys under soft studio light with gentle ambient
  occlusion; the map as a tilt-shift diorama with chunky terrain tiles, bevelled stone and plush trees.
- **Interface:** glossy rounded buttons and toy-box panels.
- **Effects:** soft glows, puffy smoke, chunky particles.
- **Strengths:**
  - very polished and distinctive, with strong depth;
  - one consistent material makes generated assets match each other more easily;
  - the scene reads like a physical board.
- **Risks:**
  - expressive animation is harder (toy forms look rigid when moved as cut-outs);
  - large sprites;
  - can slide into a generic "AI 3D render" look;
  - the interface and effects must be designed to match the material.

**Left out:**
- **High-resolution pixel art**, which can't carry the expressiveness you're after.
- **Dark painterly fantasy**, which is off the colourful, playful tone.

Either can be brought back if you want it compared.

## 3. Scorecard (1–5 per direction, filled in at step 3)

| Criterion | What is checked |
| --- | --- |
| Personality and charm | Do the four heroes feel like characters with attitude? |
| Readability at 1600 × 900 | Do heroes, enemies, the boss, the road and the interface separate at a glance? Greyscale and blur tests. |
| Readability at phone scale | The same at about 0.6 × |
| Enemy clarity | Are the four enemy types told apart instantly, and do slowed or damaged states read? |
| Cohesion | Do characters, map, interface and effects look like one game? |
| Polish | Lighting, materials, effects, finish |
| Production fit | How consistently can this be generated and cleaned up for 12–20 heroes and 15–25 enemies? |
| Animation fit | How well do the characters survive being animated (cut-out rig and key frames)? |

## 4. Scene prompts (ChatGPT image generation)

**For every direction:**
- Attach the layout guide, and write the shared brief below, then the direction's style paragraph.
- **Attach the concept sheet only for direction A.** It would pull B and C toward its style.
- Ask for 16:9, the largest size, then download the PNG.

**Shared brief:**
> A complete in-game screenshot of "Last Stand", a 2D fantasy tower defense game, 16:9. Use the
> attached layout guide as the exact composition: same top-down camera (looking down at about 65°),
> the same road route ending at a castle gate on the right, the same positions and on-screen sizes for
> every character and enemy, and the same interface layout. The guide is only a wireframe: replace
> every shape with finished art, and draw none of its boxes, guide labels or legend text.
>
> **Heroes** (placed beside the road, each roughly 100–118 px tall in a 1600 × 900 screen):
> - **Wren**, a young cocky archer in a red hood and cape with a long hood tail, freckles and a smirk,
>   shooting an arrow;
> - **Brakk**, a stout grumpy dwarf engineer with goggles, a leather apron and a big braided beard,
>   cranking a heavy wooden ballista that fires a bolt into the boss;
> - **Fen**, a lithe elf ranger in a green hood with a leaf circlet, firing rapid arrows;
> - **Old Rime**, an ancient frost mage with a huge white beard, a tall pointed blue hat and an ice
>   staff, casting a frost bolt that tints slowed enemies icy blue.
>
> **Enemies on the road:**
> - small comic **goblins** with oversized helmets and spears;
> - lean grey **wolves**;
> - hulking **armoured orcs** with iron plates and cleavers;
> - one huge **Ogre Warlord boss** with a horned helmet and a spiked club, taking a heavy impact.
>
> Each enemy has a small health bar.
>
> **Map:** a grassy fantasy valley with the dirt road, trees along the top and bottom edges, a pond
> lower left, and scattered props.
>
> **Interface:**
> - top bar: the "LAST STAND" logo, Wave 12, Gold 845, Lives 18;
> - left "Heroes" shop: four cards with portraits of Wren, Brakk, Fen and Old Rime and their costs
>   (Free, 110, 70, 60);
> - top-right upgrade panel for Brakk: "Siege Master", level 2 of 3, Upgrade 170 and Sell 147 buttons;
> - bottom bar: 1x, 2x, 3x, Pause, Auto and a big "Next wave" button.
>
> Mid-combat: arrows in flight, the ballista bolt hitting the boss, a frost burst. Every character
> must read clearly at its small size: bold silhouettes, strong contrast against the ground and the
> road.

**A · Storybook Painted** (also attach the concept sheet):
> Style: match the attached concept sheet's art quality and personality: polished cartoon fantasy,
> painted cel shading with soft gradients, warm afternoon light from the upper left, thick dark
> plum-brown outlines, a richly detailed layered environment with cliffs, water, fences and crates, an
> interface in dark violet with gold trim and illustrated portraits, and glowing golden impact effects.
> Keep the ground slightly calmer and less detailed than the characters so the enemies stand out.

**B · Bold Toon:**
> Style: bold graphic cartoon. Flat colours with one crisp shadow tone, very thick uniform dark
> outlines, chunky simplified shapes, exaggerated poses and faces. Environment from big clean colour
> areas and stylised patterned foliage, a high-contrast sandy road. Strict colour roles: heroes in warm
> saturated colours, enemies in their own distinct hues, ground in calm cool greens. Interface like
> chunky bright stickers and badges with thick outlines. Graphic effects: star bursts, speed lines,
> comic impact shapes.

**C · Toy Diorama:**
> Style: a charming toy diorama rendered in 2D. Characters look like rounded vinyl or clay toys with
> soft studio lighting and gentle ambient occlusion, big expressive heads and hands. The map is a
> tilt-shift tabletop diorama: chunky terrain tiles, bevelled stones, plush rounded trees, a glossy
> pond. Interface with glossy rounded buttons and toy-box style panels. Soft glowing effects, puffy
> smoke and chunky particles.

## 5. What you'll be asked to decide

After the review:
1. **Which direction**, or which blend.
2. **Which details from the concept sheet to keep:** for example Bones's hooded look versus the
   cardigan, and Manny's red hair versus the topknot.
3. **Then:** approve style guide v2 before any production starts.
