# Manny: asset spec and production workflow (v0.8.0 art test)

Manny is the first character made to the new style reference ([STYLE_REFERENCE.md](STYLE_REFERENCE.md)).
The workflow here becomes the template for every later hero and enemy.

> **Status (owner, 2026-10-30): the design is not approved, and the full animation set is on hold.**
> - First comes one excellent, consistent Manny design, validated at real gameplay size (section 7).
> - The frame list and pipeline below stay as the plan for afterwards.
> - His knockback is specified separately in [KNOCKBACK.md](../KNOCKBACK.md).

## 1. Design lock

This text goes into every Manny prompt word for word, so every image describes the same character:

> Manny the Manhandler: a cocky, cheerful, ridiculous bare-knuckle brawler. Spiky crimson hair swept
> back, a square jaw, thick eyebrows, a big confident grin. Shirtless, with a huge chest and shoulders and
> defined abs. Gigantic fists wrapped in cream bandages with gold knuckle rings, and brown leather
> bracers. A navy-blue sash with a round gold belt medallion bearing a star. Baggy orange-gold trousers,
> brown leather leg wraps, sandals. Proportions: a very large upper body and fists, short legs, a head
> about one fifth of his height.

**Silhouette test:** hair spikes, two oversized fists and a wide stance must read as a black shape at
gameplay size.

## 2. Sizes and format

| | Value |
| --- | --- |
| Gameplay height | ~128 px standing on the 1600 × 900 layout (two tiles; the reference shows ~127 px) |
| Export size | 2× gameplay: **256 px standing height**, for sharp phone and high-DPI screens. Attack frames can be wider (up to ~512 px). |
| Facing | Right only; the game mirrors him to face left |
| Background | Transparent PNG, or flat magenta `#FF00FF` that the pipeline removes |
| Anchor | The ground point between his feet; the pipeline finds it, and the lab can adjust it |
| File names | `manny/<animation>_<nn>.png`, e.g. `manny/attack_02.png` |
| Effects | Pure black background, drawn with additive blending (no keying) |

## 3. Frames needed (level 1)

Required (8 body frames, 1 portrait, 1 effect strip):

| Animation | Frames | Timing | Plays when |
| --- | --- | --- | --- |
| **Idle** | 2: breathe in (fists low) · breathe out (chest puffed, slight rise) | 450 ms each, looping; code adds a subtle squash | Always, between actions |
| **Attack (haymaker)** | 3: wind-up (crouch, right fist cocked behind his head) · strike (lunge, fist fully extended right) · follow-through (fist forward, upright, laughing) | 260 ms · 120 ms + 70 ms hit-stop · 320 ms | Every punch; enemies are launched on the strike frame |
| **Alarm** | 1: eyes wide, mouth open, fists up in guard, leaning back | 800 ms hold plus a code shake | A boss or a big wave arrives |
| **Victory** | 2: double-bicep pose · head back laughing, fists on hips | 500 ms · 700 ms, played twice | A wave is cleared |
| **Portrait** | 1: head and shoulders, cocky grin, square crop | — | Shop card and hero panel |
| **Impact effect** | 5: flash · starburst with sparks · streaks · fading sparks · embers | 40 ms each | The strike frame lands |

Optional (after the required set passes):

| Animation | Frames | Purpose |
| --- | --- | --- |
| **Idle fidget (flex)** | 2: bicep flex · kissing his fist | Personality every 6–10 s |
| **Landing** | 1: three-point landing | When he's placed on the map |
| **Expressions** | 4 heads: cocky · shout · smug · shocked | Speech moments, panel |
| **Uppercut** | 2: crouch · apex | A second attack for upgrade level 2 |

**Deferred:**
- **Upgrade levels 2 and 3** (for example gold gauntlets, then fiery fists): image edits of the
  approved level-1 frames, or code effects on top. Decided after level 1 is approved.
- **A walk cycle** (the sheet shows one): only if Manny becomes a roaming melee hero, which is a
  gameplay decision for later.

## 4. Generation workflow (ChatGPT image generation)

Generate several frames in **one image as a strip**: a model keeps one character far more consistent
within a single image than across separate images. Always attach the references.

1. **Master.** Attach the concept sheet. Prompt with the design lock, then:
   > Create one clean game sprite of Manny exactly as designed on the attached sheet, in his idle
   > stance. *(style + format lines below)*

   Generate three or four and pick the best against the checklist (section 6). This is the **Manny
   master**.
2. **Strips.** Attach the master first and the concept sheet second, then:
   > Using the first attached image as the exact character (same design, colours, proportions and size),
   > draw a horizontal strip of N poses of him, left to right, evenly spaced with clear gaps, all at the
   > same scale and standing on the same ground line, each full body facing right: 1) … 2) … 3) …

   - **Strip A, idle (2):** breathe in, fists low · breathe out, chest puffed and slightly taller.
   - **Strip B, attack (3):** the three attack poses from section 3.
   - **Strip C, reactions (3):** alarm · double-bicep · laughing with fists on hips.
   - **Strip D, fidget (2, optional):** bicep flex · kissing his fist.
3. **Portrait.** Attach the master:
   > Head-and-shoulders portrait of the same character, cocky grin, three-quarter view facing right,
   > square image.
4. **Impact effect.** Attach the concept sheet:
   > A game effect sprite strip on a pure black background: 5 frames left to right of a golden-white punch
   > impact burst: 1 small bright flash, 2 large starburst with sparks, 3 burst breaking into streaks,
   > 4 fading sparks and smoke, 5 last embers. Evenly spaced, no character, no text.

**Style line:** *Same art style as the attached reference: polished cartoon fantasy game art, painted cel
shading with soft gradients, warm light from the upper left, thick dark plum-brown outline.*

**Format line:** *Game sprite. Full body, three-quarter view facing right. Transparent background (if not
possible, a perfectly flat solid #FF00FF magenta). No ground shadow, no effects, no text, no other
characters, nothing cropped at the edges.*

Expect re-rolls. Budget about 10–20 generations and an hour or two for the required set.

## 5. Processing and integration (my side)

**The lab** (in the prototype) does this automatically when a strip or frame is added:
1. Background removal: alpha from a transparent PNG, or the flat key colour.
2. Splitting a strip into frames, by separating the figures (with an equal-columns fallback).
3. Trimming, then one scale per strip, matched to the idle height with an adjustable slider.
4. Anchoring each frame at its feet (adjustable), so nothing slides between frames.
5. Previewing at gameplay size and at 2×, with onion-skin against the idle frame, editable timings, and
   live use in the battle scene: idle, attack with the impact effect, alarm and victory.

**For the real game, after approval:**
- a packing script (`tools/`) that writes one texture atlas plus a JSON file of frames, anchors and
  timings;
- optional colour grading of every frame toward the master's palette;
- a Phaser animation set driven by the existing hero animation states (idle, attack, reaction,
  victory).

**Budget:** 10–15 frames at 2× ≈ 300–500 KB of WebP and ~5 MB of GPU memory for Manny, well within
limits.

## 6. Acceptance checklist

**Every frame:**
- spiky crimson hair, swept back;
- fists at least head-sized, with bandages, gold knuckle rings and leather bracers;
- the navy sash and the gold star medallion;
- orange-gold trousers, leg wraps and sandals;
- facing right, full body, nothing cropped;
- correct hands (no extra fingers), the same outline weight;
- a clean edge after background removal, with no magenta fringe.

**Every animation:**
- the feet stay planted (no sliding unless intended);
- the scale matches idle;
- anticipation, strike and recovery read clearly at gameplay size;
- the silhouette reads at 128 px;
- nothing flickers between frames (a costume or face that changes from frame to frame).

**Overall:** at gameplay size, next to the map and the interface, Manny looks charismatic and
ridiculous, and matches the reference.

## 7. Revised plan: design first, then animation

The owner's feedback: the sprites so far look too basic, and the concept sheet is closer but not final.
Before any animation pipeline, settle **one** Manny design and prove it works at gameplay size. The lab
changes below support that; none are made until approved.

### Stage 1: Manny design lab (new, replaces the animation lab for now)

- **Candidates side by side.** Add several single-image Manny candidates (variations generated from the
  reference). Each is shown:
  - large, to judge the face and costume;
  - at gameplay size (128 px) standing on the real map ground, next to Wren, Bones and the enemies for
    scale;
  - as a black silhouette at gameplay size;
  - at phone scale (~0.6×), where most of the detail is lost.
- **Readability checks.**
  - On grass, on the road and on dark ground.
  - With his ground shadow.
  - In the middle of a crowd of enemies.
  - Behind the bright impact effect.
- **Checklist scoring.** Each candidate is ticked against the design lock (section 1: hair, fists,
  rings, bracers, sash, medallion, trousers, wraps). There is a notes field and a "favourite" mark.
  - The checklist itself can change: if the best candidate departs from the lock in a good way, the
    lock is updated rather than the candidate rejected.
- **Consistency probe.** For the favourite only: the same Manny in two or three different poses (a
  turnaround, plus one action pose), shown side by side with a difference overlay that highlights what
  changed. If the costume or proportions drift here, they'll drift in every animation; better to find
  out now.
- **Exploration directions** for the candidates (prompts to follow once approved):
  - **A, faithful:** the reference as is.
  - **B, more ridiculous:** even bigger fists, smaller legs, a bigger chin.
  - **C, monk-brawler:** prayer beads and a topknot from the original concept.
  - **D, signature colours:** a stronger, simpler palette for readability.

  The goal is one design that is clearly better at 128 px, not the most detailed one.

### Stage 2: animation lab (the current lab, after the design is approved)

Changes to the existing lab:
- **Knockback preview.** Enemies launched backward along the road, as in KNOCKBACK.md:
  - an arc between the two route points, a tumble, landing dust, a dazed beat;
  - weight classes and the repeat rule visible, with a slow-motion scrubber.
- **Hit-frame marker.** Choose which frame lands the punch; the impact effect and the launch are timed
  to it.
- **Consistency tools.**
  - A frame-to-frame difference overlay to catch costume or face flicker.
  - A colour check against the master's palette.
  - A nudge for each frame's anchor, not only for the whole animation.
- **Timeline.** A scrubber with frame stepping and 0.25× playback.
- **Export.** A JSON of frames, anchors, timings and the hit frame, the format the game's atlas tool
  will read.
