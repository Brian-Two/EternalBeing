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

// Galatians 5:22–23 order; every pairing comes from the sketch doc columns.
// Mirrors clips.json — keep the two in step.
export const SECTIONS = [
  { fruit: 'love', flesh: 'selfish ambition' },
  { fruit: 'joy', flesh: 'quarrels' },
  { fruit: 'peace', flesh: 'envy' },
  { fruit: 'patience', flesh: 'outbursts of anger' },
  { fruit: 'kindness', flesh: 'dissension' },
  { fruit: 'goodness', flesh: 'revelry' },
  { fruit: 'faithfulness', flesh: 'idolatry' },
  { fruit: 'gentleness', flesh: 'enmity' },
  { fruit: 'self-control', flesh: 'sexual immorality' },
] as const;

// 4 clips × 3.2s slots. Derived from clips.json (slotSec × clipsPerSection);
// the reels are SECTIONS.length × SECTION_SEC = 115.2s.
export const SECTION_SEC = 12.8;

export const HOLD = {
  intentMs: 150,     // press shorter than this is a tap, not a hold
  revealSec: 0.7,    // full flesh visibility (audio distorts from 0s, flicker 0.3–0.7s)
  releaseSec: 0.4,   // ease back to fruit
  repentAfterSec: 4, // sustained hold → REPENT surfaces
};

export const HINT_AFTER_MS = 8000; // passive watching before "Press and hold."

export const HEARTBEAT = { restBpm: 58, heldBpm: 128 };
