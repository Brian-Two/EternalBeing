import { HOLD } from './config';

// Tracks press-and-hold anywhere on screen and exposes eased progress.
// holdT ramps 0→1 over HOLD.revealSec while held (after an intent threshold
// so taps don't trigger), and back to 0 over HOLD.releaseSec on release.

export class HoldTracker {
  private pressedAt: number | null = null;
  private holdT = 0;
  private lastFrame = performance.now();
  /** seconds the user has been holding past the intent threshold */
  heldSeconds = 0;
  everHeld = false;
  enabled = false;

  constructor(onFirstHold?: () => void) {
    const down = (e: Event) => {
      if (!this.enabled) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('button')) return; // sound toggle
      this.pressedAt = performance.now();
    };
    const up = () => {
      this.pressedAt = null;
      this.heldSeconds = 0;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    this.onFirstHold = onFirstHold;
  }

  private onFirstHold?: () => void;

  /** Call once per frame; returns eased holdT in [0,1]. */
  update(): number {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    const holding =
      this.pressedAt !== null && now - this.pressedAt >= HOLD.intentMs;

    if (holding) {
      if (!this.everHeld) {
        this.everHeld = true;
        this.onFirstHold?.();
      }
      this.heldSeconds += dt;
      this.holdT = Math.min(1, this.holdT + dt / HOLD.revealSec);
    } else {
      this.holdT = Math.max(0, this.holdT - dt / HOLD.releaseSec);
    }
    return this.holdT;
  }
}
