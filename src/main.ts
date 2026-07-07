import { Renderer } from './renderer';
import { AudioEngine } from './audio';
import { HoldTracker } from './hold';
import { runIntro, startCountdown, armHint, updateRepent, setupSoundToggle } from './ui';

// State machine: INTRO → (tap gate: unlocks audio + video) → LOOP ⇄ HOLDING.
// The two reels are time-aligned by construction (scripts/ingest.mjs), so the
// flesh layer is always "underneath" the fruit at the same timecode.

const fruitVideo = document.getElementById('fruit-video') as HTMLVideoElement;
const fleshVideo = document.getElementById('flesh-video') as HTMLVideoElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const audio = new AudioEngine();
let hideHint: (() => void) | null = null;
const hold = new HoldTracker(() => hideHint?.());

const renderer = new Renderer(canvas, fruitVideo, fleshVideo, reducedMotion);

async function enterExperience() {
  // muted video autoplay needs no gesture; ambient audio unlocks on the
  // visitor's first interaction (browser policy requires one)
  const unlockAudio = () => void audio.start();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  try {
    await Promise.all([fruitVideo.play(), fleshVideo.play()]);
  } catch {
    // if a decode stalls, retry on the next interaction
    window.addEventListener(
      'pointerdown',
      () => {
        void fruitVideo.play();
        void fleshVideo.play();
      },
      { once: true },
    );
  }

  hold.enabled = true;
  startCountdown();
  setupSoundToggle(() => {
    void audio.start(); // the button click is itself a valid unlock gesture
    return audio.toggleMute();
  });
  hideHint = armHint(() => hold.everHeld);
}

// keep the hidden layer in lockstep with the visible one
setInterval(() => {
  if (fruitVideo.paused || fleshVideo.paused) return;
  const drift = Math.abs(fleshVideo.currentTime - fruitVideo.currentTime);
  if (drift > 0.08) fleshVideo.currentTime = fruitVideo.currentTime;
}, 2000);

// resume playback when returning to the tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && hold.enabled) {
    void fruitVideo.play();
    void fleshVideo.play();
  }
});

const start = performance.now();
function frame() {
  const holdT = hold.update();
  audio.setHold(holdT);
  updateRepent(hold.heldSeconds);
  renderer.render(holdT, (performance.now() - start) / 1000);
  requestAnimationFrame(frame);
}
frame();

void runIntro().then(enterExperience);
