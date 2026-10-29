# Art direction study: enhanced pixel art vs illustrated 2D

Status: **proposal for the owner's approval.** Nothing in the game has changed.
- Prototype: `docs/prototypes/manny.html` (open it in a browser; also published as a private hosted page).
- Manny the Manhandler is a concept used only for this test, not an approved tower.

## 1. Why

The owner's feedback on v0.6.0: the pixel art is too small and stiff to carry the heroes' personalities.
At gameplay scale a hero today is about 18 × 27 art pixels including the pedestal, and the body itself is
about 15 pixels tall. The face is 3–4 pixels. Animations are 2–3 frames.

## 2. The test

To compare fairly, one animation rig (Manny and five goblins) drives two renderers:
- same poses;
- same timing;
- same in-game scale (a tile is 64 screen pixels at 1600 × 900, as today).

The beat sheet:
1. **Idle:** breathing, a shoulder flex, an eyebrow waggle.
2. **Wind-up:** a crouch and a fist drawn back that starts to glow (anticipation).
3. **Haymaker:** a lunge with stretch, a motion smear, a hit-stop freeze on contact, an impact burst and
   shockwave, and screen shake.
4. **Launch:** the whole goblin cluster flies up and backward along the road, spinning.
5. **Landing:** dust clouds, a small bounce, then a slide into a dazed heap with circling stars.
6. **Dust-off:** Manny claps the dust off his hands three times with a smug wink.

| | A · Enhanced pixel art | B · Illustrated 2D |
| --- | --- | --- |
| How it's drawn | The rig is drawn at half resolution (32 art px per tile, twice today's 16), every pixel is snapped to the game's palette, translucent effects become ordered dither, and a 1-pixel ink outline is added. | The same rig at full screen resolution: smooth shapes, soft gradients, translucent dust and glows, thick cartoon outlines. |
| Manny's size | ~40 × 55 art px (today's heroes: ~15 px bodies) | ~100 screen px tall at gameplay scale |

## 3. What the test shows

Most of the personality comes from things that work in **either** style, and should be adopted whatever is
chosen:
- **Bigger characters.** Manny stands about 1.6 tiles tall, against today's 15-pixel bodies.
- **Real anticipation and follow-through:** wind-up, overshoot, a recovery hop.
- **Squash and stretch, hit-stop and screen shake.**
- **Exaggerated physics:** launches, spin, bounce, a dazed heap.
- **Expressions that change per beat:** grin, focus, smug wink.

Where the two styles differ:

**A · Enhanced pixel art**
- Keeps the current identity and the crisp look. Effects become chunky and retro (dithered dust, a
  pixel shockwave).
- Faces and muscles read clearly at 2× today's detail.
- Rotation and scaling in a pixel style "shimmer": edges jump as shapes turn, which shows on the tumbling
  goblins. Hand-drawn pixel frames avoid this, but cost much more to make: roughly 8 frames × 6 animations
  × 3 levels per hero.
- **Scaling trap:** pixel art must be drawn at whole-number scales to stay crisp. A map twice as detailed
  is 640 × 384 art pixels, so on a 1366 × 768 laptop it only fits at 1×, which is half the size it has
  today. The choice is between a small map with wide scenery margins, or non-integer scaling (uneven or
  soft pixels).

**B · Illustrated 2D**
- The smoothest and most expressive motion. Translucent dust, glows and smears look natural, and it's
  sharp at any size and on any screen with no scaling trap.
- The prototype's quality is a **clean flat-cartoon** level. **Rush Royale-level polish comes from
  painted artwork** (rich shading, texture, lighting), which drawing in code can only approximate. Getting
  there needs commissioned illustrations, or a lot more detail per part. The engine side is the same
  either way, so artist-made parts could replace code-drawn ones later.

## 4. Technical tradeoffs

| | A · Enhanced pixel art | B · Illustrated 2D |
| --- | --- | --- |
| Pipeline | Today's (code-drawn bitmaps, one atlas), at 2× resolution | New: "cutout" rigs (each character is ~10 part images, animated by moving and rotating parts), rendered by Phaser; or frames baked into an atlas |
| Animation | Smooth motion needs many frames; rotation shimmers unless hand-drawn | Smooth by construction (60 fps rig poses); squash, stretch and rotation are free |
| Effects | Dither and solid colours; can't fade smoothly | Alpha, additive glow, soft particles |
| Screen sizes | Whole-number scaling; on mid-size screens the map shrinks to half size | Any scale; textures drawn at 2× for sharp high-DPI screens |
| Terrain and UI | Terrain painter re-tuned at 32 px per tile | Terrain repainted in the illustrated style; UI cards and portraits follow |
| Performance | Like today (one atlas, nearest filtering) | More texture memory and more transparent pixels; fine on any real GPU. The software-rendering risk from the v0.6.0 investigation grows a little |
| Who can make it | Me, with the rig-to-pixel method or hand-made frames (slow) | Me, code-drawn as in the prototype (clean cartoon); an illustrator for painted quality |
| Risk | Low technically; limited ceiling on expressiveness | Medium: a new animation pipeline and a full art conversion |
| Size of work | Large (every sprite and the terrain redrawn at 2×) | Large (every character rigged, terrain and effects redone) |

## 5. Recommendation

**B (illustrated 2D), built as cutout rigs, with a vertical slice first.** It is the only one of the two
that reaches the expressiveness asked for, and it avoids the pixel-scaling trap on common laptop
screens.

The vertical slice is a review gate before anything else is converted. It contains:
- Wren (all levels and animations), the Goblin, the Millbrook terrain, and the hit and death effects;
- inside the real game, behind a setting;
- with a hosted preview for the owner to judge.

If painted, Rush Royale-level art is the goal, decide on commissioning an illustrator before the full
conversion. The rig pipeline takes their parts directly.

If the owner prefers to keep the pixel identity, A is viable with the same motion principles, accepting
the scaling trade-off and a lower ceiling.
