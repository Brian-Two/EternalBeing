import { INTRO, RELEASE_DATE, HINT_AFTER_MS, HOLD } from './config';

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

// Intro: white → ETERNAL BEING (letterpressed) → scripture fragment →
// dissolves into the experience on its own. Audio is unlocked separately,
// on the visitor's first gesture (see main.ts) — browsers require one.
export function runIntro(): Promise<void> {
  const intro = el('intro');
  const title = el('intro-title');
  const phrase = el('intro-phrase');
  phrase.textContent = INTRO.phrase;

  return new Promise((resolve) => {
    setTimeout(() => title.classList.add('visible'), INTRO.whiteHold);
    const phraseAt = INTRO.whiteHold + INTRO.titleFade + INTRO.titleHold;
    setTimeout(() => phrase.classList.add('visible'), phraseAt);
    setTimeout(() => {
      intro.classList.add('dissolved');
      resolve();
    }, phraseAt + INTRO.phraseHold + INTRO.dissolve);
  });
}

export function startCountdown() {
  const node = el('countdown');
  const render = () => {
    let ms = RELEASE_DATE.getTime() - Date.now();
    if (ms < 0) ms = 0;
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    const p = (n: number) => String(n).padStart(2, '0');
    node.textContent = `${days} DAYS : ${p(hours)} HOURS : ${p(mins)} MINUTES`;
  };
  render();
  setInterval(render, 15_000);
  node.classList.add('visible');
}

// "Press and hold." appears only after passive watching; hides once discovered.
export function armHint(getEverHeld: () => boolean) {
  const hint = el('hint');
  setTimeout(() => {
    if (!getEverHeld()) hint.classList.add('visible');
  }, HINT_AFTER_MS);
  return () => hint.classList.remove('visible');
}

export function updateRepent(heldSeconds: number) {
  el('repent').classList.toggle(
    'visible',
    heldSeconds >= HOLD.repentAfterSec,
  );
}

export function setupSoundToggle(toggle: () => boolean) {
  const btn = el('sound');
  btn.classList.add('visible');
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', () => {
    btn.classList.toggle('muted', toggle());
  });
}
