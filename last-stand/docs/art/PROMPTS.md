# Prompt pack: illustrated sprites for the v0.8.0 art test

These prompts are for an image-generation tool such as Gemini, used to make illustrated sprites for the
art-direction test. The images go into the gameplay-screen concept (`docs/prototypes/battle-screen.html`,
also a private hosted page). The page removes the flat background, trims the image and animates it in
the scene.

Nothing here is approved art. The aim is to judge whether this route can deliver a distinctive,
consistent look.

## How to keep a cast consistent

Image tools drift. The same prompt twice gives two different characters. The fix is to anchor every
image on earlier images:

1. **Style anchor.** Generate Manny first (four or more tries) and pick the best one. That image becomes
   the style reference for everything else.
2. **Same character, new pose or expression.** Attach the chosen image and begin the prompt with:
   *"Using the attached image as the exact character reference (same design, colours, proportions and
   outfit), show him …"*
3. **New character, same style.** Attach the Manny image and begin with: *"In exactly the same art style
   as the attached image (same outline weight, shading, colours and level of detail), draw a different
   character: …"*
4. **Background colour.** Ask for a flat key colour so the page can cut the background out.
   - Magenta `#FF00FF` for most characters.
   - Green `#00FF00` for Bones, whose purple eye-lights would be cut out by a magenta key.
5. **Export** the largest PNG the tool offers. Don't crop; the page trims.
6. **Reject an image** if any of these hold:
   - extra or missing fingers, or melted details;
   - text or a watermark;
   - a cast shadow on the background, or a gradient background;
   - parts cut off at the frame edge.

## Shared style prefix

Put this at the start of every character prompt, replacing `{KEY}` with the key colour:

> Colourful hand-painted 2D fantasy game character art, polished premium mobile-game quality, bold and
> instantly readable silhouette, exaggerated cartoon proportions (big head, big hands), thick dark plum
> outline, clean cel shading with soft painted highlights, warm sunny light from the upper left,
> saturated but not neon colours, crisp edges. Full body, three-quarter view facing right, the whole
> character visible with space around it, centred. Perfectly flat solid {KEY} background with no
> shadow, gradient, texture or floor. No text, no watermark, no frame.

## Heroes

| Slot | Key | Prompt (after the prefix) |
| --- | --- | --- |
| **Manny** (idle) | magenta | Manny the Manhandler: an absurdly strong, cheerful, cocky fist-fighting monk. Pear-shaped body on tiny legs, gigantic taped fists bigger than his head, bald with a ridiculous topknot tied with a red ribbon, huge cocky grin with one gold tooth, a taped broken nose, bushy eyebrows, an orange monk robe, a red sash with a big brass gong as the belt buckle, a necklace of oversized jade prayer beads, wrapped ankles, bare feet. He flexes one giant fist proudly, eyebrows raised. Charismatic, ridiculous, likeable. |
| **Manny** (attack) | magenta | *Reference: chosen Manny.* Show him mid-haymaker: lunging forward, one giant fist thrust out to the right, the other fist pulled back, robe flaring, a delighted grin. Same outfit and proportions. |
| **Wren** (idle) | magenta | Wren: a young, cocky archer prodigy and the game's signature hero. Recognizable red hood and short cape with a long pointed hood tail that streams like a pennant, freckles, a confident smirk, short auburn hair, a spare arrow tucked behind one ear, a leather jerkin, mismatched green and cream fletching in her quiver, a curved wooden longbow. Light and agile, smaller than the others, standing with the bow lowered and a smug look. |
| **Wren** (attack) | magenta | *Reference: chosen Wren.* Show her releasing an arrow: bow fully drawn toward the right, hood tail whipping back, one eye narrowed. Same outfit and proportions. |
| **Bones** (idle) | green | Bones: a tall, lanky, playful skeleton mage with deadpan humour (an original design). Clean ivory bones, very long thin limbs, a big friendly skull with glowing purple eye-lights shaped like half-closed, lazy eyes, a cosy knitted cardigan worn open over his ribcage, a long striped scarf, a slouchy pom-pom beanie, a staff made from a femur with a lit candle on top. Slouching, one hand casually raised as if about to tell a pun. Charming, not scary. |
| **Bones** (attack) | green | *Reference: chosen Bones.* Show him flinging one of his own ribs like a boomerang toward the right, purple sparkles trailing from his hand, a deadpan expression. Same outfit and proportions. |

## Enemies

| Slot | Key | Prompt (after the prefix, with Manny attached as the style reference) |
| --- | --- | --- |
| **Goblin** | magenta | A small scrappy goblin raider: green skin, huge floppy ears, an oversized dented helmet slipping over its eyes, a crude wooden spear, a patched leather vest, scurrying forward. Comic, not gory. |
| **Armoured Orc** | magenta | A hulking armoured orc brute: grey-green skin, a dented iron helmet with short horns, one big shoulder plate, tusks, a heavy cleaver, a slow stomping pose. Tough but cartoonish. |

## Map ground

Generate this without the character prefix, with Manny attached as the style reference:

> Top-down view (looking down at about 70 degrees) of a sunny fantasy meadow for a tower defense game,
> 16:9 landscape. Lush stylised grass with soft painted variation, scattered wildflowers and small
> rocks, clusters of round cartoon trees along the top and bottom edges, a small pond in one corner. No
> road, no buildings, no characters, no text. Same art style as the attached image: thick dark outlines
> on props, cel shading, warm light from the upper left.

The road and the gate are drawn by the game on top of the ground, so one ground image works with any
map layout.
