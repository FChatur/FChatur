# Audio & Music (v0.7.0)

Requirements: [PLAN.md](PLAN.md) section 8. This document covers what was built, how the soundtrack was
prepared, and its provenance and licensing.

## 1. The system

```
 Sfx (procedural)  ──► SFX bus ───┐
                                  ├─► Master ─► limiter ─► output fade ─► speakers
 MusicPlayer chunks ─► level ─► low-pass ─► Music bus ──┘
```

| Module | Job |
| --- | --- |
| `src/audio/AudioEngine.ts` | The single audio context and its buses. Unlocks on the first key press, mouse press or touch release. Suspends the context while the tab is hidden or nothing can be heard (muted, or Master at 0). |
| `src/audio/MusicPlayer.ts` | Streams the soundtrack from short chunks, gaplessly, on the audio clock. Handles fades, the level and the pause low-pass. |
| `src/audio/Music.ts` | Turns game state into music behaviour, using the rules in `mixing.ts`. |
| `src/audio/mixing.ts` | Pure rules, unit-tested: the volume curve, the music level per game state, and chunk order and timing. |
| `src/audio/Sfx.ts` | The existing procedural sound effects, unchanged, now routed through the SFX bus. |
| `src/ui/AudioSettings.ts` | The Master, Music and Effects sliders, plus a mute toggle in the pause menu. |
| `src/config/audio.ts` | Every tunable number (default volumes, levels, fades) and the soundtrack's chunk manifest. |

**Volumes**
- Master, Music and Effects are each 0–100%, saved in the same localStorage settings as before.
- Gain is the slider value squared, so 50% sounds about half as loud.
- Every change is smoothed over about 50 ms, so moving a slider never clicks.
- Mute silences Master and keeps the slider values. The `M` key, the speaker button and the Sound buttons
  all toggle the same setting.
- Default levels: Master 80%, Music 75%, Effects 100%.
- Players from before 0.7.0 had one linear volume (0.6). It becomes Master 77%, which is the same
  loudness, so sound effects are as loud as before.
- A limiter on Master (threshold −1 dB) keeps stacked sounds from clipping.

**What the music does** (`musicTarget` in `mixing.ts`):

| Situation | Music |
| --- | --- |
| Page loaded, before any interaction | Nothing. No audio context exists and nothing has been downloaded. |
| Main menu | Silent. The first chunk downloads in the background after the first interaction. |
| Play pressed | Starts from the beginning of the intro and fades in over 0.6 s. |
| Upgrade draft | Drops to 70%. |
| Pause menu | Drops to 35% behind a 900 Hz low-pass: muffled, but still playing. |
| Window visible but unfocused | Plays at half the level. |
| Tab hidden | Fades out over 0.2 s, then the context is suspended. It resumes where it left off. The game also auto-pauses, as before. |
| Muted | Fades out, then the context is suspended. The music resumes where it was. |
| Game over | Fades out over 2 s. |
| Restart run / Play again | The old music fades out over 0.4 s, and the new run starts the track from the top. |
| Back to the main menu | Fades out over 0.8 s. |

**Browsers and mobile**
- Audio starts only inside a user gesture: `keydown`, a mouse `pointerdown`, `click`, or a touch
  `pointerup`/`touchend`. On touch devices sound now starts on the first tap; before this release, only a
  later tap started it.
- After an iOS interruption (a call, Siri) the next tap resumes audio.
- On iPhone, Web Audio follows the silent switch, as games usually do.
- Phaser's own sound manager is now disabled (`audio: { noAudio: true }`). It used to open a second
  audio context on page load, before any interaction; the game never used it.
- For tests, `<body>` carries `data-audio` (`locked`, `running` or `suspended`), `data-music` (`off`,
  `loading`, `playing` or `error`) and `data-music-format`.

## 2. The soundtrack

**"Picnic at the Tower Gate"**
- Instrumental, 2:57 as delivered, 110 BPM.
- Master file, unmodified: `assets-src/music/picnic-at-the-tower-gate.mp3` (192 kbps MP3, 44.1 kHz,
  SHA-256 `c1007df19380a31ad3276916370a55a53d6001764889bac9e47c408cdc9ffb6b`).
- Game files: `public/audio/music/picnic-at-the-tower-gate/`, built by `tools/prepare-music.py`, which
  needs Python 3 with numpy, and ffmpeg.
- **Both are currently withheld from the repository** (section 4). Both paths are listed in
  `.gitignore`, so a local copy can't be committed by accident. The owner keeps them, with checksums
  and restore steps, in a private archive outside the repository.
- **Without the files:**
  - the build notices (`__SOUNDTRACK_AVAILABLE__` in `vite.config.ts`);
  - the game runs with sound effects, the volume settings and the music state machine, but no music:
    `data-music="unavailable"`, no requests and no errors;
  - the menu credit is hidden;
  - the e2e music tests skip, with a note saying so.
- **Restoring:** put the files back at those paths (or rebuild the game files from the master with the
  script), delete the two lines from `.gitignore`, and commit. Everything switches back on with no code
  changes.

**Technical edits only.** The melody, instruments, arrangement and mix are untouched; no remixing,
regeneration, EQ, compression or limiting.

| Edit | Detail |
| --- | --- |
| Loop | Self-similarity analysis found that bars 18–66 repeat: the music at 39.344 s returns at 144.072 s, exactly 48 bars later. The game plays 0–39.6 s once as an intro, then loops 104.73 s (48 bars). At the join, an 80 ms equal-power crossfade lands on the downbeat. |
| Trim | The end of the second main section, the outro and the 2.4 s of trailing silence (144.3–177 s) are not used. |
| Level | One linear gain change of −3.9 dB brings the loop to −16 LUFS. The source peaked at +0.5 dBTP, clipping over full scale; it now peaks at −3.4 dBTP. |
| DC offset | A constant offset of about 0.005 was removed. It's inaudible, but it wastes headroom and can click at edits. |

**Loop quality checks**
- The join's transient measures like an ordinary drum hit in the track: no spike in spectral flux.
- At the join, the two sides differ in level by 0.5 dB.
- Rebuilding intro + loop + loop from the encoded chunks gives joins that are smoother than the music
  itself: the largest sample step at a join is 0.034, against 0.107 at the 99.9th percentile of the
  music.
- The browser tests repeat this with each browser's own decoders (below).

**Formats**
- **Ogg Opus at 96 kbps** (2.1 MB): current Chrome, Edge, Firefox and Safari.
- **AAC at 160 kbps** (3.1 MB): a fallback, in `.mp4` files (the same container as `.m4a`; `.mp4` is
  served correctly by more hosts).
- The game tries Opus first and falls back if the browser can't decode it.
- Opus at 96 kbps is close to transparent for this material; the source is itself a lossy 192 kbps
  MP3. Re-encoding as AAC at 160 kbps measured slightly closer to the source, but it is 50% larger.

## 3. Memory: from ~51 MB to ~11 MB

Web Audio holds decoded music as 32-bit floats. The edit is 144 s, which at the common 48 kHz output
rate comes to 144 × 48,000 × 2 channels × 4 bytes ≈ **55 MB** (51 MB at 44.1 kHz) if decoded whole.
Mobile browsers can evict or fail at that size.

The track ships instead as **16 chunks**: four intro chunks of ~9.9 s and twelve loop chunks of 4 bars
(8.73 s) each.
- Compressed chunks (~2.1 MB in all) download one at a time as the music reaches them, and are kept for
  the rest of the session.
- Only three chunks are decoded at once: the one playing, the next one queued (~4 s ahead), and the one
  after that, being decoded. Measured peak in Chromium: about 7 MB of decoded audio playing or queued,
  ~11 MB including the chunk being prepared.

**Why the joins are seamless**
- Each chunk file carries 0.25 s of the neighbouring audio on both sides. The game plays only the core,
  so codec edge effects never reach the speakers.
- Some decoders keep their start-up delay and some trim it. The delay is the same for every chunk, so
  consecutive cores still line up.
- Neighbouring chunks overlap by 5 ms of identical audio with a linear crossfade, which hides any
  one-sample rounding of start times.
- The loop's last chunk ends with exactly the audio that precedes the loop start, so wrapping around is
  just another join.

**Verified**
- In a 150 s real-time run in Chromium, the scheduled chunks are contiguous through the loop wrap.
- The end-to-end test renders the intro → loop, loop → loop and wrap-around joins offline with the
  browser's own Opus and AAC decoders. It checks for gaps, clicks and alignment: the audio after a join
  must match the previous chunk's continuation, at correlation ≥ 0.95. Aligned joins score 0.995; a
  0.5 ms misalignment scores about 0.6.
- CI runs these checks in Chromium, Firefox and WebKit.

A streaming `<audio>` element would use even less memory, but its loop timing isn't sample-accurate in
every browser, so it would audibly hiccup at the seam. The chunked approach keeps seamless loops and
small memory.

## 4. Provenance and licensing

### What is established

- **Source:** generated by the owner with Google Gemini. The MP3 contains a **C2PA content-credentials
  manifest signed by Google**:
  - certificate chain "Google C2PA Media Services", time-stamped by Google's TSA;
  - action `c2pa.created`: "Created by Google Generative AI", digital source type
    `trainedAlgorithmicMedia`;
  - action `c2pa.edited`: "Applied imperceptible SynthID watermark".
- **Generation date:** the manifest's time-stamp is **2026-10-29 19:01:20 UTC**. The file reached this
  project at 19:05 UTC the same day.
- **Watermark:** the audio carries Google's inaudible SynthID watermark. Our edits are technical (gain,
  trim, loop crossfade, re-encode) and very likely leave it detectable. The re-encoded game files don't
  carry the C2PA manifest; the master in `assets-src/` keeps it.
- **Credit:** the main menu says "Music: 'Picnic at the Tower Gate', AI-generated with Google Gemini".

### Terms that apply (research summary, not legal advice)

- **Ownership:** Google's Terms of Service say: "Some of our services allow you to generate original
  content. Google won't claim ownership over that content." Gemini Apps are covered by the Google Terms
  of Service and the **Generative AI Prohibited Use Policy**. The Gemini API terms add that Google may
  generate the same or similar content for others, so the track is not guaranteed to be unique.
- **Commercial use:** secondary sources (not Google) report that music made in the Gemini app may be
  used commercially, at least on paid plans (Google AI Plus, Pro or Ultra), subject to the Prohibited
  Use Policy. I could not confirm plan-specific rules from Google's own pages. `policies.google.com` and
  `blog.google` are not reachable from this build environment.
- **Disclosure:** the Prohibited Use Policy forbids misrepresenting AI-generated content as made by a
  human. The game credits the track as AI-generated.
- **Copyright:** music generated by AI without meaningful human authorship is generally **not protected
  by copyright** (the US Copyright Office's position; Norwegian law likewise protects only human
  creative works).
  - Practically: anyone could reuse the track from the public repository or the game, and it can't be
    registered with content-ID systems.
  - It does not stop Last Stand from using it.
- **Third-party risk:** I could not confirm any indemnity for consumer Gemini plans. Any risk that the
  track resembles an existing song stays with the publisher. If a claim ever arises, the track is a
  swappable data file.
- **The repository has no license file.** The code is therefore "all rights reserved". The music is
  listed separately here so it is not mistaken for code under a future license.

### Owner's confirmations (status 2026-10-29)

**Public distribution of the audio is on hold** until the licensing is verified. Nothing goes to `main`
or the public site without the owner's approval.

| # | Point | Status |
| --- | --- | --- |
| 1 | Product and plan | Made with Google Gemini's music-generation feature. **Pending:** the exact account plan. |
| 2 | Terms allow distribution in a public game and repository | **Pending:** Google's public documentation reviewed by the owner; explicit permission not yet verified. |
| 3 | Prompt | Confirmed: written for Last Stand, asking for an original, whimsical fantasy game soundtrack, with no named artist or existing song. |
| 4 | Generation date | 2026-10-29, matching the C2PA time-stamp. **Pending:** check against the Gemini history. |
| 5 | AI credit, no exclusive copyright | Confirmed: credited as AI-generated with Google Gemini; the owner accepts that others could reuse it. |

**The composition is preserved.** Only the technical edits in section 2 are allowed.

**Withheld from the repository (owner's decision, 2026-10-29).** This repository is public.
- The master MP3 and the game's music files were removed from the development branch
  (`claude/last-stand-tower-defense-h0g381`) in a normal commit; history was not rewritten.
- They no longer appear in the branch, but stay downloadable from its earlier commits (from 81924c7 up
  to the removal) for anyone who looks them up.
- The public game site (`main`) never had them.
- The copies kept outside the repository are a private archive page and the private hosted preview,
  both visible only to the owner.
