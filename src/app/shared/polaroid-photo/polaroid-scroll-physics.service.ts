import { Injectable } from '@angular/core';

const PARALLAX_RANGE_PX = 10;
const MAX_INERTIA_TILT_DEG = 10;
const INERTIA_SETTLE_MS = 120;
// Velocity is smoothed over this recent window instead of a single ~16ms
// frame delta, since real scroll/trackpad input moves in small per-frame
// increments that are too noisy to read a meaningful "flick speed" from.
const VELOCITY_WINDOW_MS = 120;

// At/above this scroll speed (px/ms), a gesture reads as a deliberate flick
// rather than casual scrolling - only then does the near-instant tracking
// transition kick in (see .polaroid--scrolling in the stylesheet); below it,
// the tilt still moves (see TILT_RESPONSE_K below) but eases via the slower,
// smoother spring transition instead of snapping. This is purely a choice of
// *transition style*, not a gate on whether any tilt is applied at all - see
// the note on inertiaTilt below for why that distinction matters.
const FLICK_VELOCITY_THRESHOLD = 0.5;

// How quickly tilt ramps toward MAX_INERTIA_TILT_DEG as scroll speed climbs.
// This is a saturating (not linear+hard-clamped) curve computed for EVERY
// speed, including slow ones - there is deliberately no minimum-speed cutoff
// below which tilt is zero. An earlier version gated tilt behind
// FLICK_VELOCITY_THRESHOLD entirely (0 below it, curve above it) with too
// steep a K - since real scroll gestures cross a low threshold almost
// immediately, that made the swing effectively jump straight to a large,
// near-constant value the instant ANY scrolling started, regardless of how
// fast or slow it actually was - not the "swing scales with scroll speed"
// physics this is supposed to simulate. A low K applied continuously from
// zero means a slow, deliberate scroll produces a barely-there sway while a
// fast flick ramps up toward the cap, with no discontinuity in between.
const TILT_RESPONSE_K = 1.1;

// Viewport-proximity culling: photos are only read/written by updateAll()
// while they're within one of these two IntersectionObserver "bands" around
// the viewport - far off-screen photos (Our Story can have well over a
// dozen) are skipped entirely, both the getBoundingClientRect() read AND
// the style writes/class toggles/timer scheduling, since their physics are
// invisible anyway. rootMargin percentages resolve against the viewport
// itself (root: null), so both bands scale automatically with viewport
// height - no separate mobile/desktop tuning needed.
//
// Two bands, not one, so the buffer can react to how fast the user is
// scrolling without ever recreating an IntersectionObserver (expensive/
// thrashy to do every frame): NEAR_ROOT_MARGIN is enough headroom for
// idle/slow scrolling, where a tight buffer wastes the least work. Once
// scroll speed crosses FAR_TIER_SPEED_THRESHOLD, updateAll() switches to
// consulting the wider FAR_ROOT_MARGIN band instead - both observers run
// continuously in the background at effectively zero cost (native,
// off-main-thread-eligible), so "switching" is just choosing which
// precomputed active set to read that frame, not recreating anything.
const NEAR_ROOT_MARGIN = '60% 0px';
const FAR_ROOT_MARGIN = '200% 0px';
// Deliberately lower than FLICK_VELOCITY_THRESHOLD, so the wider culling
// buffer engages slightly BEFORE the snappy tracking transition does - by
// the time a flick is fast enough to visibly snap-track, photos it's about
// to reach should already be "resumed" rather than popping in cold.
const FAR_TIER_SPEED_THRESHOLD = 0.3;

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
 *
 * On top of that batching, updateAll() only processes photos currently
 * within one of two IntersectionObserver-tracked bands around the viewport
 * (see NEAR_ROOT_MARGIN/FAR_ROOT_MARGIN above) - photos further away are
 * skipped entirely rather than computed and immediately overwritten with a
 * value nobody can see, cutting real per-frame work (not just avoiding
 * thrashing) on pages with many photos.
 */
@Injectable({ providedIn: 'root' })
export class PolaroidScrollPhysicsService {
  private readonly instances = new Set<PolaroidPhysicsHandle>();
  private readonly settleTimers = new WeakMap<
    PolaroidPhysicsHandle,
    ReturnType<typeof setTimeout>
  >();
  private readonly elementToHandle = new WeakMap<Element, PolaroidPhysicsHandle>();
  private readonly nearActive = new Set<PolaroidPhysicsHandle>();
  private readonly farActive = new Set<PolaroidPhysicsHandle>();
  private nearObserver?: IntersectionObserver;
  private farObserver?: IntersectionObserver;
  private scrollSamples: { time: number; y: number }[] = [];
  private listenerAttached = false;
  private ticking = false;

  register(handle: PolaroidPhysicsHandle): void {
    this.instances.add(handle);
    this.ensureListener();

    if (typeof IntersectionObserver === 'undefined') {
      // No IO support: fall back to always-active so physics still works,
      // just without the culling optimization.
      this.nearActive.add(handle);
      this.farActive.add(handle);
    } else {
      this.ensureObservers();
      this.elementToHandle.set(handle.hostElement, handle);
      this.nearObserver?.observe(handle.hostElement);
      this.farObserver?.observe(handle.hostElement);
    }

    this.updateAll();
  }

  unregister(handle: PolaroidPhysicsHandle): void {
    this.instances.delete(handle);
    this.nearActive.delete(handle);
    this.farActive.delete(handle);
    this.elementToHandle.delete(handle.hostElement);
    this.nearObserver?.unobserve(handle.hostElement);
    this.farObserver?.unobserve(handle.hostElement);

    const timer = this.settleTimers.get(handle);
    if (timer) clearTimeout(timer);
    this.settleTimers.delete(handle);
  }

  private ensureObservers(): void {
    if (this.nearObserver && this.farObserver) return;

    const makeCallback = (activeSet: Set<PolaroidPhysicsHandle>) => {
      return (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          const handle = this.elementToHandle.get(entry.target);
          if (!handle) continue;
          if (entry.isIntersecting) activeSet.add(handle);
          else activeSet.delete(handle);
        }
      };
    };

    this.nearObserver = new IntersectionObserver(makeCallback(this.nearActive), {
      rootMargin: NEAR_ROOT_MARGIN,
    });
    this.farObserver = new IntersectionObserver(makeCallback(this.farActive), {
      rootMargin: FAR_ROOT_MARGIN,
    });
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
    const speed = Math.abs(velocity);

    // Only genuine flicks (speed at/above the threshold) get the near-instant
    // tracking transition - slower scrolling still tilts (see inertiaTilt
    // below), just eased via the smoother spring transition so it doesn't
    // snap. This was the actual cause of the original "sharp/hanging" swing
    // during slow scrolling: previously EVERY scroll tick (however small)
    // added .polaroid--scrolling and kept re-arming its settle timer, so a
    // slow multi-second scroll gesture spent the whole time in the snappy
    // 0.06s-linear tracking transition instead of the smooth spring one.
    const isFlick = speed >= FLICK_VELOCITY_THRESHOLD;

    // Which culling band to consult this frame - see the constants' doc
    // comment above for why this is a choice between two always-running
    // observers rather than resizing either one.
    const activeSet = speed >= FAR_TIER_SPEED_THRESHOLD ? this.farActive : this.nearActive;

    // Read phase: every layout-forcing getBoundingClientRect happens first,
    // before any style is written, so none of them trigger a forced reflow.
    // Skips anything outside the current culling band entirely.
    const reads: { handle: PolaroidPhysicsHandle; top: number; height: number }[] = [];
    for (const handle of activeSet) {
      const rect = handle.hostElement.getBoundingClientRect();
      reads.push({ handle, top: rect.top, height: rect.height });
    }

    // Write phase: all style/class mutations happen after every read above.
    for (const { handle, top, height } of reads) {
      const elementCenter = top + height / 2;
      const distanceFromCenter = (elementCenter - viewportCenter) / viewportCenter;
      const parallax = Math.max(-1, Math.min(1, distanceFromCenter)) * PARALLAX_RANGE_PX;
      handle.hostElement.style.setProperty('--polaroid-parallax', `${parallax}px`);

      // sensitivityMultiplier's own sign is what makes roughly half the
      // photos swing opposite the rest for the exact same scroll gesture
      // (see the doc comment on that computed() in the component) - it has
      // to be factored into the tilt's sign here, not just its magnitude.
      const multiplier = handle.sensitivityMultiplier();
      const sign = (velocity > 0 ? -1 : 1) * Math.sign(multiplier || 1);
      // Saturating curve (1 - e^-kx), computed for every speed including
      // slow ones - see TILT_RESPONSE_K above for why there's no minimum-
      // speed cutoff. It ramps up smoothly and only asymptotically
      // approaches the cap, so there's no visible kink where a hard clamp
      // would otherwise "catch" the tilt at high scroll speeds.
      const inertiaTilt =
        sign *
        MAX_INERTIA_TILT_DEG *
        (1 - Math.exp(-TILT_RESPONSE_K * speed * Math.abs(multiplier)));
      handle.hostElement.style.setProperty('--polaroid-inertia-tilt', `${inertiaTilt}deg`);
      handle.cardElement.classList.toggle('polaroid--scrolling', isFlick);

      // Scheduled on every tick (not just flicks) so tilt eases back to 0
      // shortly after ANY scrolling stops, slow or fast - once the last
      // 'scroll' event fires, nothing else drives this loop.
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
