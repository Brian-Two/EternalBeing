# EternalBeing.io

An immersive digital art experience inspired by the structure and emotional logic of [Network Effect](https://networkeffect.io/) (Jonathan Harris & Greg Hochmuth, 2015). Short human video moments are organized around the **nine fruits of the Spirit** from Galatians 5:22–23. Press and hold anywhere, and the **works of the flesh** (Galatians 5:19–21) surface from beneath the same timeline — faster, harsher, distorted — then recede the moment you release.

> *Form is the sermon.* The emotional argument is made by pacing, grain, sound, and contrast — never by explanatory paragraphs over the footage.

## Preview experience

The current build is a single-page preview:

- **Intro** — black screen → "Eternal Being" → fragmentary scripture → tap to begin
- **Loop** — full-screen video cycling through all nine fruits in scriptural order (~36 seconds)
- **Press and hold** — reveals the flesh layer, time-aligned to the fruit timeline; release returns instantly at the same point
- **Countdown** — minimal release timer at the bottom of the screen
- **Sound toggle** — the only visible control besides the interaction itself

### Fruit ↔ flesh contrast pairs

| Fruit | Flesh |
|---|---|
| Love | Hostility |
| Joy | Envy |
| Peace | Conflict |
| Patience | Anger |
| Kindness | Selfish ambition |
| Goodness | Harmful desire |
| Faithfulness | Betrayal |
| Gentleness | Aggression |
| Self-control | Indulgence |

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
npm run ingest   # download and process clips via yt-dlp + ffmpeg
```

## Project structure

```
eternalbeing/
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

Content and timing live in `src/config.ts` — iterate on clips, copy, and dates without touching engine code.

## Status

**Phase 1 (preview)** — local interactive preview with intro, loop, hold interaction, shaders, ambient audio, and countdown.

**Upcoming** — full audio recordings, rights-cleared media, public deployment at eternalbeing.io, and the complete experience the countdown promises.

See [docs/PRD.md](docs/PRD.md) for the full product requirements.

## Media rights

Downloaded third-party clips in `media-cache/` are for **private prototyping only** and are not committed to the repo. Before any public deployment, replace with licensed or original footage.

## References

- [Network Effect](https://networkeffect.io/)
- [Galatians 5:16–26](https://www.biblegateway.com/passage/?search=Galatians%205%3A16-26&version=NIV)
- [Bad TV Shader](https://github.com/felixturner/bad-tv-shader) — distortion reference for the flesh layer
