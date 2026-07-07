import { Renderer } from './renderer';
import { AudioEngine } from './audio';
import { HoldTracker } from './hold';
import { requestAppFullscreen } from './fullscreen';
import { runIntro, startCountdown, armHint, updateRepent, setupSoundToggle } from './ui';

// State machine: INTRO → LOOP ⇄ HOLDING. Fullscreen on load; audio on first gesture.

const fruitVideo = document.getElementById('fruit-video') as HTMLVideoElement;
const fleshVideo = document.getElementById('flesh-video') as HTMLVideoElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

requestAppFullscreen();

const audio = new AudioEngine();
let hideHint: (() => void) | null = null;
let experienceEntered = false;
let gesturedBeforeEnter = false;
let audioStarted = false;
const hold = new HoldTracker(() => hideHint?.());

function tryStartAudio() {
  if (audioStarted || !experienceEntered) return;
  audioStarted = true;
  void audio.start();
}

function onVisitorGesture() {
  requestAppFullscreen();
  if (!experienceEntered) {
    gesturedBeforeEnter = true;
    return;
  }
  tryStartAudio();
}

window.addEventListener('pointerdown', onVisitorGesture, { once: true });
window.addEventListener('keydown', onVisitorGesture, { once: true });

const renderer = new Renderer(canvas, fruitVideo, fleshVideo, reducedMotion);

async function enterExperience() {
  experienceEntered = true;
  if (gesturedBeforeEnter) tryStartAudio();

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
    tryStartAudio(); // the button click is itself a valid unlock gesture
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

// dev-only introspection for automated verification
(window as unknown as Record<string, unknown>).__eb = { hold, audio };

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
