# EternalBeing.io

An immersive digital art experience inspired by the structure and emotional logic of [Network Effect](https://networkeffect.io/) (Jonathan Harris & Greg Hochmuth, 2015). Short human video moments are organized around the **nine fruits of the Spirit** from Galatians 5:22–23. Press and hold anywhere, and the **works of the flesh** (Galatians 5:19–21) surface from beneath the same timeline — faster, harsher, distorted — then recede the moment you release.

> *Form is the sermon.* The emotional argument is made by pacing, grain, sound, and contrast — never by explanatory paragraphs over the footage.

## Preview experience

The current build is a single-page preview:

- **Intro** — white screen → "ETERNAL BEING" in letterpressed black type → fragmentary scripture → auto-dissolves into the loop (audio unlocks on first interaction)
- **Loop** — full-screen video cycling through all nine fruits in scriptural order (12.8s per fruit, 115.2 seconds total, 4 clips per word)
- **Press and hold** — reveals the flesh layer, time-aligned to the fruit timeline; release returns instantly at the same point
- **Countdown** — minimal release timer at the bottom of the screen (Christmas 2026)
- **Sound toggle** — the only visible control besides the interaction itself

### Fruit ↔ flesh contrast pairs

| Fruit | Flesh |
|---|---|
| Love | Selfish ambition |
| Joy | Quarrels |
| Peace | Envy |
| Patience | Outbursts of anger |
| Kindness | Dissension |
| Goodness | Revelry |
| Faithfulness | Idolatry |
| Gentleness | Enmity |
| Self-control | Sexual immorality |

All nine pairings come from the columns of the sketch document.

## The clip manifest

Every one of the 72 portions — source URL, exact in/out timestamp, framing note, optional crop — lives in [`clips.json`](clips.json). That file is the single source of truth for the reels and doubles as the rights-clearance checklist.

### Fixing one clip

Edit that clip's entry in `clips.json`, then:

```bash
npm run ingest
```

Only the clip whose entry changed is re-cut (each slot stores a hash of its manifest entry); everything else is reused, and only the affected reel is rebuilt. Source windows are cached, so nudging a trim by a second usually needs no download at all.

To force one slot regardless of hash:

```bash
npm run ingest -- --clip fruit-goodness-3
```

| Command | Effect |
|---|---|
| `npm run ingest` | download what's missing, re-cut stale slots, rebuild changed reels |
| `npm run ingest -- --clip <id>` | force one slot (`--clip a,b` or repeat the flag) |
| `npm run ingest -- --section goodness` | both layers of one contrast pair |
| `npm run ingest -- --layer flesh` | one whole layer |
| `npm run ingest -- --reels` | re-concat from existing segments only |
| `npm run ingest -- --sheet` | regenerate the review page |
| `npm run ingest -- --force` | ignore caches, rebuild all 72 |
| `npm run ingest -- --no-reels` | cut only, leave the reels alone |
| `npm run ingest -- --no-download` | never touch the network |

### Reviewing the set

Every build writes `media-cache/review.html` — all 72 finished slots as a grid, each labelled with its window, speed, applied crop, source link, framing note, and the exact command to re-cut it. Hover a clip to play it.

```bash
open media-cache/review.html
```

### Framing

Landscape 16:9 is ideal; anything else is centre-crop-zoomed to fill. The pipeline auto-detects black bars (`cropdetect`) and blurred pillarbox fill (sobel edge-energy), but when a shot needs specific framing — "keep the hug on screen" — set an explicit crop on that clip:

```jsonc
{ "url": "...", "start": "1:44", "end": "1:48",
  "note": "keep the hug on screen",
  "crop": "1080:608:420:180" }        // w:h:x:y, applied before scaling
```

Setting `crop` disables auto-detection for that clip; `"autocrop": false` disables it without supplying one.

## Providing your own edited clips

Drop hand-cut portions into `media-clips/` and run `npm run ingest`. Files there **always win** over the manifest URL and over generated placeholders.

**Naming:** `media-clips/fruit/<word>-<1..4>.mp4` and `media-clips/flesh/<word>-<1..4>.mp4` (`.mov`/`.m4v`/`.webm` also accepted)

Fruit words: `love joy peace patience kindness goodness faithfulness gentleness self-control`
Flesh words: `selfish-ambition quarrels envy outbursts-of-anger dissension revelry idolatry enmity sexual-immorality`

Example: `media-clips/fruit/love-1.mp4`, `media-clips/flesh/quarrels-3.mp4`

### Clip length spec

Every slot plays for **exactly 3.2 seconds** on screen — 4 clips × 9 words per layer, **72 portions total**. Your portion is auto-sped to fill its slot, so the length you deliver controls playback speed:

| Layer | You provide | Plays at | Feel |
|---|---|---|---|
| Fruit | **4.0s** | 1.25× | calm, dreamlike |
| Flesh | **6.0s** | 1.875× | rushed, frantic |

Those two rates are constant across every clip in a layer, so the contrast between the reels stays even. Any length technically works (a 3.2s fruit portion just plays at 1.0×), but varying it varies the pacing. Fruit and flesh reels share one 115.2s timeline in Galatians order, so `flesh/selfish-ambition-*` plays underneath `fruit/love-*`, `flesh/quarrels-*` underneath `fruit/joy-*`, and so on.

## Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 7 |
| Language | TypeScript 5 |
| Rendering | Three.js + EffectComposer shader passes |
| Audio | Web Audio API |
| Media prep | yt-dlp + ffmpeg (local dev only) |

## Getting started

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

### Other commands

```bash
npm run build    # typecheck + production build
npm run preview  # serve the production build locally
npm run ingest   # cut all 72 clips from clips.json and bake the reels
```

## Project structure

```
eternalbeing/
├── clips.json      # the 72-portion manifest: urls, windows, framing
├── docs/           # PRD, research, design references
├── public/media/   # processed video and audio assets
├── scripts/        # ingest pipeline
└── src/
    ├── main.ts     # state machine + bootstrapping
    ├── config.ts   # fruits, pairs, timings, countdown, copy
    ├── renderer.ts # Three.js scene + shader stack
    ├── audio.ts    # Web Audio layers and distortion
    ├── hold.ts     # press-and-hold interaction
    └── ui.ts       # intro, countdown, hint, sound toggle
```

Copy, pairings, and timings live in `src/config.ts`; the footage itself lives in `clips.json` — iterate on either without touching engine code.

## Status

**Phase 1 (preview)** — local interactive preview with intro, loop, hold interaction, shaders, ambient audio, and countdown.

**Upcoming** — full audio recordings, rights-cleared media, public deployment at eternalbeing.io, and the complete experience the countdown promises.

See [docs/PRD.md](docs/PRD.md) for the full product requirements.

## Media rights

Downloaded third-party footage in `media-cache/` is for **private prototyping only** and is not committed to the repo. Before any public deployment, replace with licensed or original footage.

## References

- [Network Effect](https://networkeffect.io/)
- [Galatians 5:16–26](https://www.biblegateway.com/passage/?search=Galatians%205%3A16-26&version=NIV)
- [Bad TV Shader](https://github.com/felixturner/bad-tv-shader) — distortion reference for the flesh layer
