# EternalBeing.io — Product Requirements Document

**Version:** 1.0 · **Date:** 2026-07-07 · **Author:** Brian Too (with Claude)
**Status:** Approved for preview build (Phase 1 executes today)

---

## 1. Executive Summary

EternalBeing.io is an immersive digital art experience — not a product website — inspired by the structure, pacing, and emotional logic of [Network Effect](https://networkeffect.io/) (Jonathan Harris & Greg Hochmuth, 2015). Where Network Effect organized 10,000 clips around 100 neutral human behaviors to critique internet overload, EternalBeing organizes short human video moments around the **nine fruits of the Spirit** from Galatians 5:22–23 (love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control). Its defining interaction: **press and hold anywhere**, and the works of the flesh (Galatians 5:19–21) surface from beneath the same timeline — faster, harsher, distorted — then recede the moment you release.

The full experience is a longer build. This PRD covers two things: (1) the **preview page** built today — a sleek, iPhone-caliber intro ("Eternal Being" → a fragmentary scripture line), flowing into a ~36-second looping audiovisual sequence of all nine fruits with the press-and-hold flesh layer and a release countdown; and (2) the **milestones** required to ship the complete experience.

**MVP goal:** a single-page preview that a visitor can open, tap to enter, watch, instinctively press-and-hold, feel the contrast, and leave curious about the countdown — all built and running locally today.

## 2. Mission

**Mission statement:** Let people *feel* the difference between life in the Spirit and life in the flesh — through form, not explanation — before a single word of teaching is spoken.

**Core principles:**
1. **Form is the sermon.** The emotional argument is made by pacing, grain, sound, and contrast — never by explanatory paragraphs over the footage.
2. **The flesh is underneath, not elsewhere.** Holding reveals a layer that was always present beneath the fruit — same timeline, same moment, opposite nature (Gal 5:17).
3. **Restraint over spectacle.** Warm, human, stable when in the Spirit; the distortion budget is spent only on the flesh layer.
4. **Digital experience, not landing page.** No nav, no cards, no marketing copy. One full-screen moment at a time.
5. **Scripture anchors everything.** Fruit order, contrast pairs, and copy all trace to Galatians 5.

## 3. Target Users

| Persona | Description | Needs |
|---|---|---|
| **The scroller** | 16–35, finds the link on Instagram/TikTok/X, watches on a phone | Instant visual hook, works on mobile touch, loops without demanding action |
| **The seeker** | Spiritually curious, not necessarily churched | Beauty and mystery before doctrine; no jargon walls |
| **The believer** | Recognizes Galatians 5 within seconds | Depth and reverence; wants to share it |
| **The creator/press** | Digital-art audience (the Network Effect lineage crowd) | Craft: shader work, sound design, interaction novelty |

Technical comfort: none assumed. The only instruction ever shown is **"Press and hold."**

## 4. MVP Scope (Preview Page — built today)

### In Scope
**Core experience**
- ✅ Intro sequence: white (Apple-white #fbfbfd) → "ETERNAL BEING" in black letterpressed/imprinted type → fragmentary scripture line → auto-dissolves into the loop (no tap prompt; ambient audio unlocks on the visitor's first interaction instead, since browsers require a gesture)
- ✅ Continuous full-screen video loop through all nine fruits in Galatians order, 8s each (4 clips per fruit, ~72s full loop)
- ✅ Press-and-hold (touch + mouse) reveals the works-of-the-flesh layer, time-aligned to the fruit timeline. Pairings follow the sketch-doc columns: Love↔Selfish ambition, Joy↔Quarrels; remaining placeholder pairs: Peace↔Hostility, Patience↔Anger, Kindness↔Envy, Goodness↔Harmful desire, Faithfulness↔Betrayal, Gentleness↔Aggression, Self-control↔Indulgence
- ✅ Hold transition: 0–0.3s audio distortion begins → 0.3–0.7s image flickers/darkens → ~0.7s flesh fully visible; release returns instantly at the equivalent timeline point (never restarts from Love)
- ✅ "REPENT" text surfaces during a sustained hold (teasing the full experience's mechanic; no punishment/lockout in the preview)
- ✅ Release countdown, bottom-center, minimal: `NNN DAYS : HH HOURS : MM MINUTES`, target: **Christmas 2026** (2026-12-25, one config value)
- ✅ "Press and hold." hint appears only after several seconds of passive watching
- ✅ Sound toggle (the only button)

**Visual treatment (the "dream" recipe — see §7)**
- ✅ WebGL post-processing over the video: film grain, soft vignette, warm desaturated grade (fruit layer)
- ✅ Held state: RGB shift / chromatic aberration, Bad-TV-style distortion, darker vignette, higher contrast, 1.5–2× playback, harder cuts

**Audio (ambient-only for the preview)**
- ✅ Fruit layer: childhood vocals track (already in `docs/`), slow heartbeat, quiet atmosphere
- ✅ Flesh layer: heartbeat accelerates, vocals distort/detune, music drops away
- ✅ No spoken sentences yet — the nine voice recordings are a full-build asset; the audio engine leaves slots for them

**Assets & pipeline**
- ✅ Clips downloaded from the curated links in `docs/EternalBeing.io.pdf` via yt-dlp, trimmed/cropped/sped with ffmpeg into 1.5–2s segments (**private prototype use only — see Risks**)
- ✅ Ingest script so new links → processed clips is one command

**Technical**
- ✅ Vite + vanilla TypeScript + Three.js (EffectComposer shader passes); no framework
- ✅ Desktop and mobile browsers; graceful `prefers-reduced-motion` fallback (no strobe/flicker)
- ✅ Runs locally today; deployable as a static site when clip rights are resolved

### Out of Scope (deferred to full build)
- ❌ Nine spoken fruit sentences + flesh sentences (human recordings)
- ❌ Per-fruit exploration/drill-down, data visualizations, histograms
- ❌ Hold-to-the-end consequence: REPENT → hell screen → early exit / lockout
- ❌ Time-limit mechanic (life-expectancy timer or any session gating)
- ❌ Dante-inspired nine-circles descent visual for the flesh
- ❌ Email capture / notify-me, analytics, social share cards
- ❌ CMS, database, accounts, PWA/offline
- ❌ Public deployment of downloaded third-party footage

## 5. User Stories

1. **As a first-time visitor**, I want an elegant, wordless entrance, so that I feel I've stepped into an artwork, not a website. *(Black → "Eternal Being" → scripture fragment → tap.)*
2. **As a phone user**, I want the loop to autoplay full-screen with sound after one tap, so that the experience "just happens." *(Tap-to-begin satisfies autoplay policy.)*
3. **As a curious viewer**, I want to discover press-and-hold on my own, so that the reveal feels like *my* discovery. *(Hint appears only after ~8s of passivity.)*
4. **As someone holding the screen**, I want the world to degrade around me — faster, harsher, distorted — so that I viscerally *feel* the works of the flesh rather than read about them.
5. **As someone who releases**, I want to return to exactly where the fruit timeline would be, so that the flesh feels like a layer beneath reality, not a separate page.
6. **As a believer**, I want the nine fruits in scriptural order with faithful contrasts, so that the piece rewards recognition.
7. **As a return visitor**, I want the countdown, so that I know something larger is coming and when.
8. **(Technical) As the builder**, I want one config file for clips, timings, contrast pairs, and the countdown date, so that iterating on content never touches engine code.

## 6. Core Architecture & Patterns

The preview is a **state machine driving a WebGL-composited video player** — deliberately close to Network Effect's own architecture (custom imperative orchestration, jQuery+Three.js in 2015; ours is TypeScript+Three.js in 2026).

```
INTRO_BLACK → INTRO_TITLE → INTRO_PHRASE → GATE(tap) → LOOP
LOOP ⇄ HOLDING (press ≥ threshold; release returns at aligned timecode)
```

```
eternalbeing/
├── docs/                      # PRD, sketches, research
├── scripts/
│   └── ingest.sh              # yt-dlp + ffmpeg: links → trimmed clips
├── public/
│   └── media/
│       ├── fruit/<fruit>/     # <fruit>-1.mp4, <fruit>-2.mp4 (1.5–2s each)
│       ├── flesh/<work>/      # aligned contrast clips
│       └── audio/             # vocals, heartbeat, atmosphere
├── src/
│   ├── main.ts                # state machine + bootstrapping
│   ├── config.ts              # fruits, pairs, timings, countdown date, copy
│   ├── sequencer.ts           # timeline: which clip, when, both layers
│   ├── renderer.ts            # Three.js scene, video texture, EffectComposer
│   ├── shaders/               # grain, vignette, grade, RGB shift, badtv
│   ├── audio.ts               # WebAudio: layers, ducking, distortion, heartbeat rate
│   ├── hold.ts                # pointer events, hold progress 0→1
│   └── ui/                    # intro, countdown, hint, REPENT, sound toggle
└── index.html
```

**Key patterns**
- **Dual-timeline sequencer:** one master clock; fruit and flesh playlists are parallel tracks over the same timecode. Holding crossfades *tracks*, never resets the clock. Both current-segment videos stay loaded (flesh video pre-seeked, muted) so the swap is instant.
- **Hold progress as a uniform:** `holdT ∈ [0,1]` (eased) feeds every shader pass and audio node — one scalar drives the entire degradation.
- **Config-driven content:** `config.ts` is the single source of truth for the nine fruits, contrast pairs, clip filenames, per-segment durations, playback rates, countdown target, and all on-screen copy.

## 7. Features — Detailed Specification

### 7.1 Intro sequence
| Beat | Content | Timing |
|---|---|---|
| 1 | Pure white (#fbfbfd), silence | ~0.8s |
| 2 | **ETERNAL BEING** — black, letterpressed/imprinted (Apple-style deboss: dark bite above, paper highlight beneath), gentle fade/blur-in (SF-adjacent stack: `-apple-system, "Helvetica Neue", Inter`) | ~2.2s |
| 3 | Fragmentary scripture line (working: **"Against such things there is no law."** — Gal 5:23) | ~3.2s |
| 4 | Auto-dissolve into Love clip 1 — no tap prompt; ambient audio unlocks on the visitor's first interaction | ~1.6s |

### 7.2 The loop (fruit layer)
- Order fixed by Gal 5:22–23: Love, Joy, Peace, Patience, Kindness, Goodness, Faithfulness, Gentleness, Self-control. 8s per fruit (4 clips ≈ 2s each), 72s total, seamless return to Love. No visible fruit labels.
- Clip grammar per fruit: **Clip 1 = everyday expression**, **Clip 2 = costly expression** (sacrifice, restraint, forgiveness).
- Source clips 3–5s → served at 1.5–2s at 1.1–1.4× speed. Direct cuts; occasional emotional clip at natural speed.
- Grade: warm, slightly lifted blacks, gentle desaturation; fine film grain; soft vignette; stable framing. Target: "viewing a dream."

### 7.3 Press-and-hold (flesh layer)
- Anywhere on screen, touch or mouse. Intentional-hold threshold ~150ms (taps don't trigger).
- Transition curve (per sketch doc): **0–0.3s** audio begins distorting → **0.3–0.7s** image flickers and darkens → **≥0.7s** flesh fully visible.
- Flesh treatment: 1.5–2× playback, sharper/more frequent cuts, increased contrast, RGB shift, Bad-TV distortion (occasional roll/tear), crushed darker vignette, cropped/obstructed faces preferred in clip selection.
- Audio: heartbeat rate climbs (~60 → ~120+ bpm), vocals detune/degrade (playbackRate warble + distortion node), music ducks to silence; optional low fire-crackle bed.
- Sustained hold (≥ ~4s): **REPENT** fades in, sparse type, slow pulse. Preview only teases — no lockout.
- Release: `holdT` eases back over ~0.4s; fruit resumes at the aligned timecode.

### 7.4 Countdown
- Bottom-center, minimal mono-spaced digits: `142 DAYS : 04 HOURS : 31 MINUTES`, updating each minute. Small on desktop, readable on mobile, never covers faces.
- Target: single `RELEASE_DATE` constant in `config.ts`, currently **Christmas 2026 (2026-12-25)**.

### 7.5 The dream-look shader stack (research-grounded)
Network Effect's epilogue credits its GLSL to **Felix Turner, Altered Qualia, and Iñigo Quílez** — i.e., the classic Three.js post-processing school: [Bad TV Shader](https://github.com/felixturner/bad-tv-shader) (distortion + vertical roll), static/RGB-shift passes, film grain. Replication plan, all as EffectComposer passes over a `VideoTexture`, every intensity driven by `holdT`:

| Pass | Fruit state (holdT=0) | Flesh state (holdT=1) |
|---|---|---|
| Color grade | Warm, lifted, desaturated ~15% | Cold-shifted, crushed blacks, contrast + |
| Film grain | Fine, subtle | Coarse, animated |
| Vignette | Soft, wide | Tight, dark |
| RGB shift | ~0 | Strong, jittering |
| Bad TV (distort/roll) | Off | Active, intermittent tears |
| Flicker | Off | Luminance flicker (capped for photosensitivity; disabled under `prefers-reduced-motion`) |

### 7.6 Asset ingest pipeline
`scripts/ingest.sh`: reads a manifest (fruit/work → URL → in/out timestamps) → `yt-dlp` download → `ffmpeg` trim, crop to cover-safe aspect, speed-adjust, strip/keep audio, transcode to H.264 MP4 (≤1080p, faststart) → `public/media/`. Manifest lives in the repo; re-running is idempotent.

## 8. Technology Stack

| Layer | Choice | Version / notes |
|---|---|---|
| Build | Vite | ^7, vanilla-ts template |
| Language | TypeScript | ^5 |
| 3D/post | Three.js + EffectComposer | ^0.17x; ShaderPass-based custom GLSL |
| Audio | Web Audio API | native; no library |
| UI | Hand-rolled DOM/CSS | no framework — the page has ~5 UI elements |
| Media prep | yt-dlp + ffmpeg | local dev tools, never shipped |
| Hosting (later) | Vercel or Cloudflare Pages | static; decision deferred to full build |
| Full build (later) | Next.js + Postgres/Supabase + object storage | per deep-research report; preview's sequencer/shaders port over |

No runtime third-party services in the preview. No analytics yet.

## 9. Security & Configuration

- **No auth, no user data, no cookies** in the preview. Nothing to secure server-side; it's a static page.
- **Configuration:** all content/timing/date in `src/config.ts`; no environment variables required to run. (`.env.example` in repo is legacy from the starter — unused by the preview.)
- **Media rights (the real "security" issue):** downloaded YouTube/TikTok clips are for **private prototyping only**. Before any public deployment: replace with licensed/original/stock footage or obtain permissions. The ingest manifest doubles as the rights-clearance checklist.
- **Photosensitivity:** flicker amplitude capped; `prefers-reduced-motion` disables flicker/roll and slows transitions.

## 10. API Specification

Not applicable — the preview is fully static with no backend. (Full build will introduce content APIs per the deep-research architecture; specified in that phase's design doc.)

## 11. Success Criteria

**The preview succeeds when a visitor:**
- ✅ Understands the clips are organized around positive human qualities (without labels)
- ✅ Discovers press-and-hold unprompted or via the delayed hint
- ✅ Feels a clear emotional difference between the two states (calm/warm vs. anxious/harsh)
- ✅ Returns to the fruit layer seamlessly on release — no restart, no jank
- ✅ Notices the countdown and asks "what's coming?"

**Functional requirements:**
- ✅ Full loop plays continuously ≥5 minutes without stutter on a mid-range phone
- ✅ Hold→flesh transition completes in ~0.7s; release→fruit in ~0.4s
- ✅ Audio unlocks reliably on first tap (iOS Safari included)
- ✅ 60fps desktop / ≥30fps mobile with all passes enabled
- ✅ Reduced-motion mode verified

**Quality indicators:** the footage reads "dreamlike" (grain+grade visible but not gimmicky); type feels iPhone-keynote sleek; nothing on screen explains the project.

## 12. Implementation Phases

### Phase 1 — Preview page (today)
**Goal:** working preview running locally end-to-end.
- ✅ Vite/TS/Three.js scaffold; state machine; intro sequence
- ✅ Ingest script + download/trim clips from the PDF's curated links (Love, Joy + flesh counterparts first; placeholder-fill remaining fruits from the same pipeline as links are curated)
- ✅ Dual-timeline sequencer + video textures + shader stack
- ✅ Hold interaction, audio engine (vocals + heartbeat + distortion), countdown, hint, REPENT tease
- **Validation:** all §11 functional criteria pass in Chrome desktop + iOS Safari.

### Phase 2 — Content completion & polish (~2–4 weeks)
**Goal:** every fruit/work slot filled with intentional footage; audio matured.
- ✅ Curate remaining clip links (18 fruit + 18 flesh), run through ingest
- ✅ Record or commission the 9 fruit sentences + flesh sentences; wire into audio slots
- ✅ Sound design pass (atmosphere beds, transition texture, mastering levels)
- ✅ Motion/typography polish; share/OG card
- **Validation:** full 36s loop with voices; blind-test 5 viewers — ≥4 discover the hold and describe the contrast unprompted.

### Phase 3 — Rights & public launch of the preview (~2 weeks, overlaps P2)
**Goal:** the preview goes live at eternalbeing.io.
- ✅ Resolve media rights: license/replace every clip (manifest as checklist)
- ✅ Deploy static build (Vercel/Cloudflare), domain, OG/meta, privacy-friendly analytics (Plausible)
- ✅ Set the real countdown date
- **Validation:** Lighthouse ≥90 performance/accessibility; public URL live; countdown accurate.

### Phase 4 — Full experience (~3 months, per deep-research plan)
**Goal:** the complete EternalBeing experience the countdown promises.
- ✅ Next.js app; content model (contrast pairs, scripture, media) in Postgres/Supabase
- ✅ Per-fruit exploration depth (the "atlas": scripture, testimonies, reflections)
- ✅ Full consequence mechanic: sustained hold → REPENT → hell screen (Dante nine-circles descent motif) → early end of experience
- ✅ Session/time mechanic design (the eternal-life inversion of Network Effect's mortality timer — e.g., the timer *counts up*, or access is unlimited "for eternity")
- ✅ Nine full audio compositions; expanded clip library through the same ingest+rights pipeline
- ✅ Accessibility (WCAG 2.2 AA), i18n scaffolding, PWA
- **Validation:** three polished fruits at full depth before widening; Web Vitals targets (LCP <2.5s, INP <200ms, CLS <0.1).

## 13. Future Considerations
- **Testimony engine:** replace scripted sentences with real submitted testimonies (moderated) — the faith-analog of Network Effect's Mechanical Turk voices.
- **Group/church mode:** synchronized viewing via Supabase Realtime; discussion prompts per fruit.
- **The inversion thesis:** Network Effect limits your time because life is short; EternalBeing can invert every mechanic around eternity (unlimited time, count-up timer, "come back tomorrow" as invitation not punishment). Worth a dedicated design exploration before Phase 4.
- Seasonal states (Advent/Lent/Easter grading and audio), AR "contrast lens" (WebXR, enhancement-only), native shell (Expo) only if PWA retention proves out.

## 14. Risks & Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Copyright on downloaded clips** — publishing YouTube/TikTok footage invites takedowns/legal exposure | Preview stays private until Phase 3 rights pass; ingest manifest doubles as clearance checklist; budget for stock/original footage |
| 2 | **iOS autoplay/audio quirks** — muted-inline rules, WebAudio unlock, dual-video decode limits on old devices | Tap gate unlocks audio; `playsinline muted` + WebAudio graph; test early on real iPhone; fallback = flesh video swaps in only at hold start |
| 3 | **Mobile GPU perf** — two decoding videos + 6 shader passes may drop frames | Cap at 1080p, merge passes into one über-shader if needed, pre-seek instead of dual-decode on weak devices (detect via fps sampling) |
| 4 | **Tone risk** — flesh layer reads as horror-shock or, worse, as mockery; REPENT reads as condemnation | Restraint principle (§2.3); flesh clips show emptiness/compulsion, not gore; blind-test wording with believers *and* non-churched viewers in Phase 2 |
| 5 | **Scope creep into the full build** — preview quietly becomes the product | This PRD's Out-of-Scope list is the contract; anything beyond it goes to Phase 4 backlog |

## 15. Appendix

- **Sketch document:** [docs/EternalBeing.io.pdf](EternalBeing.io.pdf) — preview plan, clip links, audio direction, contrast table, Dante reference
- **Research:** [docs/deep-research-report.md](deep-research-report.md) — Network Effect reverse-engineering + modern stack recommendations
- **Ambient asset on hand:** [docs/childhoodvocalsG_major121bpm441hzm4a.m4a](childhoodvocalsG_major121bpm441hzm4a.m4a) (childhood vocals, G major, 121bpm)
- **Key references:** [networkeffect.io](https://networkeffect.io/) · [Network Effect — Jonathan Harris](https://jjh.org/network-effect) · [Bad TV Shader (Felix Turner)](https://github.com/felixturner/bad-tv-shader) · Galatians 5:16–26
- **Contrast pairs (canonical for this project):** Love↔Hostility · Joy↔Envy · Peace↔Conflict · Patience↔Anger · Kindness↔Selfish ambition · Goodness↔Harmful desire · Faithfulness↔Betrayal/Idolatry · Gentleness↔Aggression · Self-control↔Indulgence *(artistic pairings, not claims that Galatians assigns one official opposite per fruit)*
