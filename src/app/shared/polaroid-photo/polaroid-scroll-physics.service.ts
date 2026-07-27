import { Injectable } from '@angular/core';

const PARALLAX_RANGE_PX = 10;
const MAX_INERTIA_TILT_DEG = 18;
const INERTIA_SENSITIVITY = 4;
const INERTIA_SETTLE_MS = 120;
// Velocity is smoothed over this recent window instead of a single ~16ms
// frame delta, since real scroll/trackpad input moves in small per-frame
// increments that are too noisy to read a meaningful "flick speed" from.
const VELOCITY_WINDOW_MS = 120;

export interface PolaroidPhysicsHandle {
  hostElement: HTMLElement;
  cardElement: HTMLElement;
  sensitivityMultiplier: () => number;
  settleDelayExtraMs: () => number;
}

/**
 * Drives scroll-linked parallax and inertia-tilt for every polaroid photo on
 * the page from a SINGLE shared scroll listener and rAF loop, instead of each
 * `PolaroidPhotoComponent` running its own independently.
 *
 * With many photos on screen (Our Story can have well over a dozen), N
 * independent per-instance loops each doing their own `getBoundingClientRect`
 * (layout read) interleaved with their own `style.setProperty` (layout-
 * invalidating write) causes layout thrashing - every read after another
 * instance's write forces a synchronous layout recalculation. This service
 * batches ALL reads first, then ALL writes, across every registered photo in
 * a single pass per frame, which eliminates that thrashing entirely and cuts
 * the number of live scroll listeners/rAF callbacks from N to 1. This was the
 * primary source of scroll jank reported on iOS Safari.
 *
 * Scroll velocity (and so the "how fast are we flicking" signal) is also
 * computed ONCE per frame here and shared across every photo, rather than
 * each one independently re-deriving the same value from the same
 * `window.scrollY`.
 */
@Injectable({ providedIn: 'root' })
export class PolaroidScrollPhysicsService {
  private readonly instances = new Set<PolaroidPhysicsHandle>();
  private readonly settleTimers = new WeakMap<
    PolaroidPhysicsHandle,
    ReturnType<typeof setTimeout>
  >();
  private scrollSamples: { time: number; y: number }[] = [];
  private listenerAttached = false;
  private ticking = false;

  register(handle: PolaroidPhysicsHandle): void {
    this.instances.add(handle);
    this.ensureListener();
    this.updateAll();
  }

  unregister(handle: PolaroidPhysicsHandle): void {
    this.instances.delete(handle);
    const timer = this.settleTimers.get(handle);
    if (timer) clearTimeout(timer);
    this.settleTimers.delete(handle);
  }

  private ensureListener(): void {
    if (this.listenerAttached) return;
    this.listenerAttached = true;
    this.scrollSamples = [{ time: performance.now(), y: window.scrollY }];
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
  }

  private requestTick(): void {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.updateAll();
      this.ticking = false;
    });
  }

  private updateAll(): void {
    if (this.instances.size === 0) return;

    const now = performance.now();
    const scrollY = window.scrollY;
    this.scrollSamples.push({ time: now, y: scrollY });
    this.scrollSamples = this.scrollSamples.filter(
      (sample) => now - sample.time <= VELOCITY_WINDOW_MS,
    );
    const oldest = this.scrollSamples[0];
    const deltaTime = Math.max(now - oldest.time, 1);
    const velocity = (scrollY - oldest.y) / deltaTime;
    const viewportCenter = window.innerHeight / 2;

    // Read phase: every layout-forcing getBoundingClientRect happens first,
    // before any style is written, so none of them trigger a forced reflow.
    const reads: { handle: PolaroidPhysicsHandle; top: number; height: number }[] = [];
    for (const handle of this.instances) {
      const rect = handle.hostElement.getBoundingClientRect();
      reads.push({ handle, top: rect.top, height: rect.height });
    }

    // Write phase: all style/class mutations happen after every read above.
    for (const { handle, top, height } of reads) {
      const elementCenter = top + height / 2;
      const distanceFromCenter = (elementCenter - viewportCenter) / viewportCenter;
      const parallax = Math.max(-1, Math.min(1, distanceFromCenter)) * PARALLAX_RANGE_PX;
      handle.hostElement.style.setProperty('--polaroid-parallax', `${parallax}px`);

      const sensitivity = INERTIA_SENSITIVITY * handle.sensitivityMultiplier();
      const inertiaTilt = Math.max(
        -MAX_INERTIA_TILT_DEG,
        Math.min(MAX_INERTIA_TILT_DEG, -velocity * sensitivity),
      );
      handle.hostElement.style.setProperty('--polaroid-inertia-tilt', `${inertiaTilt}deg`);
      handle.cardElement.classList.add('polaroid--scrolling');

      const existingTimer = this.settleTimers.get(handle);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        handle.hostElement.style.setProperty('--polaroid-inertia-tilt', '0deg');
        handle.cardElement.classList.remove('polaroid--scrolling');
      }, INERTIA_SETTLE_MS + handle.settleDelayExtraMs());
      this.settleTimers.set(handle, timer);
    }
  }
}
