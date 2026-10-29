# How to get polished 2D character art (investigation)

Status: **investigation for the owner.** Nothing in the game has changed. The character studies it refers to
are in `docs/prototypes/characters.html` (also a private hosted page).

## 1. The short answer

- **Design** (who a character is, silhouette, costume, expressions, signature moves) decides whether a
  hero is memorable. I can do this well; the character studies are the evidence.
- **Rendering quality** (painted shading, texture, refined linework) decides whether art looks
  *polished*. A clean flat-cartoon level is within reach of code-drawn vector art. Painted art at the level
  of top mobile character games needs a dedicated illustrator.
- **Animation and game feel** (timing, anticipation, squash and stretch, freeze-frames, effects) decide
  whether characters feel *alive*. The engine side is mine to build in any case. The frames or rig parts
  come from whoever makes the art.

## 2. Ways to make animated 2D characters

| Method | How it works | Strengths | Costs and limits |
| --- | --- | --- | --- |
| **Frame-by-frame sprite sheets** | Every animation frame is drawn or painted, then packed into an atlas (one image plus frame data). Phaser plays atlases natively; v0.6.0 already works this way. | The most expressive: smears, squash, hair and cloth all hand-timed. Any style. | The most drawing work: frames × animations × upgrade levels. Art changes mean redrawing frames. Memory grows with frame count. |
| **Skeletal (cutout) animation** | The artist paints the character in separate layers (head, torso, arms, hands, cloth). An animator binds the layers to bones and keys poses; the game plays the poses. Mesh deformation bends parts for squash, stretch and cloth. | One painting gives many smooth animations at 60 fps. Upgrade levels can be *skins* (swapped parts). Small files. Easy to retime. | Needs a rigging tool and skill. Very fast cartoon motion looks slightly "puppet-like" without hand-drawn extras. |
| **Hybrid** | Skeletal bodies, plus frame-by-frame for smears, faces, impacts and effects. | The usual approach in polished mobile character games: lively and affordable. | Two pipelines to support (both are well understood). |
| **Code-drawn vector** (these studies) | Characters described as shapes in code, rendered at any resolution, animated with a code rig. | Fast iteration, any size, no external tools. I can produce the whole roster. | Ceiling: a clean flat-cartoon look. Rich painting and texture are impractical. |

Tools for skeletal animation:
- **Spine:** the industry standard for 2D game characters. It has an official Phaser runtime, mesh
  deformation and skins. A paid editor licence is required per animator, and its runtime licence is tied
  to having one.
- **DragonBones:** free, but its Phaser 3 support is community-maintained and ageing.
- **A small runtime of our own:** bones, slots and keyframes from JSON. This is enough for code-drawn or
  simple layered art.

Any of these can also **bake** animations to sprite sheets, which removes the runtime dependency at the
cost of memory.

## 3. Getting illustrations from outside

- **Commissioned illustrator or animator:** the route to genuinely polished, original art.
  - What to agree up front: the deliverables (layered source files or finished sheets), the resolution,
    the number of revisions, and **an IP assignment or a commercial licence** in writing.
  - Prices vary widely by artist, region and scope; get quotes per character (design, rig-ready layers,
    animation).
  - A style guide and the character sheets from this study make briefs concrete.
- **Asset packs** (marketplaces for game art):
  - cheap and immediate;
  - but generic, inconsistent between packs, and other games use the same characters, which works
    against "memorable and original";
  - check each licence for web distribution and modification.
- **AI image generation:**
  - quick for mood boards and early exploration;
  - weak at consistency across poses and frames, and its output still has to be separated into layers
    by hand;
  - copyright and licence questions are unsettled, and the vault's rule is original art;
  - this environment can't generate raster images anyway.
  - Use it, if at all, for inspiration, not final assets.
- **Making it yourself:** free tools such as Krita (painting) and Aseprite (pixel art) work, if you want
  to draw.

## 4. What I can do with the current tools

**Can:**
- Design characters: personalities, silhouettes, costumes, expression sheets, pose storyboards, palettes
  and upgrade progressions.
- Draw the whole roster as clean vector cartoon art in code, and animate it with a code rig in the game.
  This is a valid finished style if it's chosen on purpose.
- Build the engine side for any art source:
  - atlas and skeletal playback;
  - an animation state machine (idle, attack, reaction, victory);
  - upgrade skins;
  - effects and game feel (freeze-frames, shake, particles, launches);
  - performance work and tests;
  - review tools like the preview pages.
- Write precise art briefs for an artist: sizes, layer lists and names, animation lists with timings,
  palettes, file formats. Then integrate and review the deliveries.

**Cannot:**
- Paint richly rendered illustrations or textures.
- Hand-draw frame-by-frame animation at professional quality.
- Judge appeal with a human eye. I iterate with screenshots, so your review is the real test.

## 5. Recommended path

1. **Approve the designs** (these three, or changes to them). Design is the part that decides
   personality, and it's independent of the rendering method.
2. **Choose the rendering route:**
   - **With an illustrator (recommended for "polished"):** commission one character, Wren, as layered
     artwork plus three animations. I rig and integrate it in the game as a vertical slice; you judge it
     in a hosted preview, then decide on the rest.
   - **Without one:** commit to the clean vector cartoon style shown here. Put the effort into animation
     and effects, where most of the life is. Keep assets swappable so an artist can replace them later.
3. **Engine:** I recommend support for layered skeletal art (bones, parts and skins) plus sprite sheets
   for effects, so both routes, and a later switch between them, use the same game code. Spine versus our
   own runtime can be decided once we know whether an animator will use Spine.

In-game size check: heroes appear about 90–110 px tall at 1600 × 900, so source art should be drawn about
three times larger (around 300 px tall) to stay sharp on high-density screens.
