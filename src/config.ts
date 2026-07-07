// Single source of truth for content, timing, and copy.

// Countdown target — Christmas 2026 (local midnight).
export const RELEASE_DATE = new Date('2026-12-25T00:00:00');

export const INTRO = {
  whiteHold: 800,  // ms of pure white before the title
  titleFade: 2200, // title fade-in duration
  titleHold: 2800, // how long the title breathes before the phrase
  phrase: 'Against such things there is no law.',
  phraseHold: 3200, // phrase on screen before the dissolve
  dissolve: 1600,   // auto-transition into the experience
};

// Galatians 5:22–23 order; love/joy pairings come from the sketch doc columns.
export const SECTIONS = [
  { fruit: 'love', flesh: 'selfish ambition' },
  { fruit: 'joy', flesh: 'quarrels' },
  { fruit: 'peace', flesh: 'hostility' },
  { fruit: 'patience', flesh: 'anger' },
  { fruit: 'kindness', flesh: 'envy' },
  { fruit: 'goodness', flesh: 'harmful desire' },
  { fruit: 'faithfulness', flesh: 'betrayal' },
  { fruit: 'gentleness', flesh: 'aggression' },
  { fruit: 'self-control', flesh: 'indulgence' },
] as const;

export const SECTION_SEC = 8; // must match scripts/ingest.mjs

export const HOLD = {
  intentMs: 150,     // press shorter than this is a tap, not a hold
  revealSec: 0.7,    // full flesh visibility (audio distorts from 0s, flicker 0.3–0.7s)
  releaseSec: 0.4,   // ease back to fruit
  repentAfterSec: 4, // sustained hold → REPENT surfaces
};

export const HINT_AFTER_MS = 8000; // passive watching before "Press and hold."

export const HEARTBEAT = { restBpm: 58, heldBpm: 128 };
