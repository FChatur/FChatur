#!/usr/bin/env python3
"""
Turns the soundtrack master into the looping, chunked files the game streams.

Technical edits only (the owner's rule: never remix or alter the music):
  - remove the small DC offset;
  - one linear gain change to -16 LUFS (no compression or limiting), which also takes the peaks that
    went over full scale back under it;
  - an intro (start .. loop start) that plays once, then a loop region that repeats forever. The loop
    joins two bars that the track itself repeats 48 bars apart, with a short equal-power crossfade at
    the join;
  - the unused end (rest of the last section, outro and trailing silence) is dropped;
  - encoded as Ogg Opus (all current browsers) with an AAC .m4a fallback.

Memory: a decoded track is ~23 MB per stereo minute at 48 kHz, so instead of one file the game gets
short chunks (~9 s) and keeps only the few it is about to play decoded (see src/audio/MusicPlayer.ts).
Each chunk file carries MARGIN seconds of the neighbouring audio on both sides. The game plays only
the chunk's core, so codec edge effects and decoder start delays stay inside the margins, and the
chunks join seamlessly.

Usage (from last-stand/; needs Python 3 with numpy, and ffmpeg with libopus):
  python3 tools/prepare-music.py
Prints the manifest for src/config/audio.ts and writes public/audio/music/<id>/.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

SRC = 'assets-src/music/picnic-at-the-tower-gate.mp3'
TRACK_ID = 'picnic-at-the-tower-gate'
OUT = f'public/audio/music/{TRACK_ID}'
SR = 44100
BPM = 110
# Found by self-similarity analysis: the downbeat grid starts 0.0716 s in, and beat 72 (bar 18,
# 39.344 s) is repeated by beat 264 (144.072 s), 48 bars later.
GRID_OFFSET = 0.0716
LOOP_FROM_BEAT = 72
LOOP_BARS = 48
CROSSFADE = 0.08  # seconds, equal-power, ending exactly on the loop's downbeat
MARGIN = 0.25  # seconds of neighbouring audio on each side of every chunk
TARGET_LUFS = -16.0
MAX_TRUE_PEAK = -1.5  # dBTP; gain is lowered (never limited) if needed
INTRO_CHUNKS = 4
LOOP_CHUNKS = 12  # 4 bars each
OPUS_KBPS = 96
AAC_KBPS = 160


def ffmpeg(*args, data=None):
    return subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', *args], input=data, capture_output=True, check=True)


def decode(path):
    raw = ffmpeg('-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-').stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def loudness(x):
    """Integrated loudness (LUFS) and true peak (dBTP) via ffmpeg's EBU R128 meter."""
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
         '-af', 'ebur128=peak=true', '-f', 'null', '-'],
        input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stderr.decode()
    summary = out[out.rfind('Summary:'):]
    lufs = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    peak = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return lufs, peak


def main():
    x = decode(SRC)
    beat = 60 / BPM
    loop_start = round((GRID_OFFSET + LOOP_FROM_BEAT * beat) * SR)  # 39.344 s, the join's target
    period = round(LOOP_BARS * 4 * beat * SR)
    seam = loop_start + period  # 144.072 s, where playback jumps back
    m = round(MARGIN * SR)
    f = round(CROSSFADE * SR)

    x = x - x.mean(axis=0)  # DC offset

    # The virtual timeline V: intro, then the loop region repeating. The file timeline is shifted by the
    # margin so that both sides of the loop boundary are plain copies of the same audio: V(t) for
    # t in [seam, seam + m) is x(t - period), which is exactly what follows the boundary on the first
    # pass too. Every chunk margin is therefore identical however the chunk is reached.
    intro_end = loop_start + m
    body = x[intro_end:seam + m].copy()
    a = seam - f - intro_end  # crossfade start inside body
    t = np.linspace(0, np.pi / 2, f)[:, None]
    body[a:a + f] = x[seam - f:seam] * np.cos(t) + x[loop_start - f:loop_start] * np.sin(t)
    body[a + f:] = x[loop_start:loop_start + m]
    assert len(body) == period

    # Loudness of what players hear most: the loop. One linear gain for everything.
    lufs, peak = loudness(np.vstack([body, body]))
    gain_db = min(TARGET_LUFS - lufs, MAX_TRUE_PEAK - peak)
    g = 10 ** (gain_db / 20)
    intro = x[:intro_end] * g
    body = body * g
    lufs2, peak2 = loudness(np.vstack([body, body]))
    _, peak_intro = loudness(intro)
    print(f'source loop {lufs:.1f} LUFS, true peak {peak:+.1f} dBTP; gain {gain_db:+.2f} dB; '
          f'result {lufs2:.1f} LUFS, true peak {max(peak2, peak_intro):+.1f} dBTP', file=sys.stderr)

    # Chunks over V. Each file holds [start - m, end + m] of V (silence before the very start).
    full = np.vstack([intro, body, body])  # intro + two loops covers every margin we need

    def vseg(start, end):
        pre = max(0, -start)
        return np.vstack([np.zeros((pre, 2)), full[max(0, start):end]])

    bounds = [round(i * intro_end / INTRO_CHUNKS) for i in range(INTRO_CHUNKS)]
    bounds += [intro_end + round(i * period / LOOP_CHUNKS) for i in range(LOOP_CHUNKS + 1)]
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        os.remove(os.path.join(OUT, name))
    chunks = []
    for i in range(len(bounds) - 1):
        s, e = bounds[i], bounds[i + 1]
        seg = np.clip(vseg(s - m, e + m), -1, 1).astype(np.float32).tobytes()
        name = f'{i:02d}'
        common = ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-map_metadata', '-1']
        ffmpeg('-y', *common, '-c:a', 'libopus', '-b:a', f'{OPUS_KBPS}k', '-application', 'audio',
               f'{OUT}/{name}.ogg', data=seg)
        ffmpeg('-y', *common, '-c:a', 'aac', '-b:a', f'{AAC_KBPS}k', '-movflags', '+faststart',
               f'{OUT}/{name}.m4a', data=seg)
        chunks.append({'file': name, 'start': s, 'length': e - s})

    sizes = {ext: sum(os.path.getsize(f'{OUT}/{c["file"]}.{ext}') for c in chunks) for ext in ('ogg', 'm4a')}
    manifest = {
        'id': TRACK_ID,
        'sampleRate': SR,
        'margin': m,
        'loopChunk': INTRO_CHUNKS,
        'chunks': chunks,
    }
    print(f'loop {intro_end / SR:.3f}..{(intro_end + period) / SR:.3f} s of the edit '
          f'(source {loop_start / SR:.3f}..{seam / SR:.3f} s); {len(chunks)} chunks; '
          f'ogg {sizes["ogg"] / 1e6:.2f} MB, m4a {sizes["m4a"] / 1e6:.2f} MB', file=sys.stderr)
    print(json.dumps(manifest))
    verify(manifest, intro, body)


def verify(manifest, intro, body):
    """Decodes the encoded chunks (ffmpeg's decoders) and rebuilds intro + two loops the way the game
    does, then checks that every join is as continuous as the music around it."""
    m = manifest['margin']
    expect = np.vstack([intro, body, body])
    for ext in ('ogg', 'm4a'):
        parts = []
        order = list(range(len(manifest['chunks']))) + list(range(manifest['loopChunk'], len(manifest['chunks'])))
        for i in order:
            c = manifest['chunks'][i]
            d = decode(f'{OUT}/{c["file"]}.{ext}')
            parts.append(d[m:m + c['length']])
        got = np.vstack(parts)
        n = min(len(got), len(expect))
        err = got[:n] - expect[:n]
        snr = 10 * np.log10((expect[:n] ** 2).mean() / (err ** 2).mean())
        # Largest sample-to-sample step at the joins versus anywhere in the music.
        joins = np.cumsum([manifest['chunks'][i]['length'] for i in order])[:-1]
        step = np.abs(np.diff(got[:, 0]))
        worst_join = max(step[j - 2:j + 2].max() for j in joins)
        print(f'{ext}: rebuilt vs edit SNR {snr:.1f} dB; largest step at a join {worst_join:.3f}, '
              f'99.9th percentile step in the music {np.percentile(step, 99.9):.3f}', file=sys.stderr)


if __name__ == '__main__':
    main()
