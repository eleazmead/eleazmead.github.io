import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Injector,
  NgZone,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';

const MAX_CAPTION_LENGTH = 50;
const MAX_REST_TILT_DEG = 7;
const MAX_STATIC_OFFSET_PX = 8;
const PARALLAX_RANGE_PX = 10;
const MAX_INERTIA_TILT_DEG = 18;
const INERTIA_SENSITIVITY = 4;
const INERTIA_SETTLE_MS = 120;
// Velocity is smoothed over this recent window instead of a single ~16ms
// frame delta, since real scroll/trackpad input moves in small per-frame
// increments that are too noisy to read a meaningful "flick speed" from.
const VELOCITY_WINDOW_MS = 120;

// Gives the pin's pluck-off animation a clear window to play before the
// lightbox backdrop fades in and covers it - otherwise the two race and the
// lift is barely visible before it's obscured.
const OVERLAY_OPEN_DELAY_MS = 220;

// The pin's needle tip sits at this fixed distance from the card's top edge,
// regardless of the card's own height - see .polaroid__pin in the stylesheet
// (top: -0.95rem + ~90% down its own 2.05rem height). Assumes the default
// 16px root font size.
const PIN_ANCHOR_PX = 14.4;

// Deterministic pseudo-random float in [0, 1) from a string, via FNV-1a.
// Used to derive each photo's tilt/inertia physics from its own image URL,
// rather than a small array indexed by a low integer - a short lookup table
// only has a handful of distinct values, so nearby indices (e.g. from photos
// that happen to sit at consecutive positions) can land on similarly-signed,
// similarly-sized values by pure coincidence, making the page look uniform
// instead of "randomly" pinned. Hashing each photo's own unique URL avoids
// that clustering while staying fully deterministic (same photo, same look,
// every time it's rendered).
function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

// SVG <defs> ids are document-global, not component-scoped - each instance needs a unique one.
let nextPinGradientId = 0;

@Component({
  selector: 'app-polaroid-photo',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './polaroid-photo.component.html',
  styleUrl: './polaroid-photo.component.scss',
})
export class PolaroidPhotoComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  @ViewChild('card') private cardRef?: ElementRef<HTMLElement>;
  @ViewChild('photoImg') private photoImgRef?: ElementRef<HTMLImageElement>;
  @ViewChild('overlayRoot') private overlayRootRef?: ElementRef<HTMLElement>;

  readonly imageUrl = input.required<string>();
  readonly alt = input.required<string>();
  readonly caption = input<string>('');
  readonly imageError = output<void>();

  readonly focused = signal(false);
  readonly showOverlay = signal(false);
  readonly pinGradientId = `polaroid-pin-${nextPinGradientId++}`;
  readonly pinShadeId = `polaroid-pin-shade-${nextPinGradientId++}`;

  private openTimer?: ReturnType<typeof setTimeout>;

  readonly displayCaption = computed(() => {
    const value = this.caption().trim();
    return value.length > MAX_CAPTION_LENGTH ? `${value.slice(0, MAX_CAPTION_LENGTH - 1)}…` : value;
  });

  readonly rotationDeg = computed(() => {
    const t = hash01(this.imageUrl() + '::rotate');
    return (t * 2 - 1) * MAX_REST_TILT_DEG;
  });
  readonly staticOffsetPx = computed(() => {
    const t = hash01(this.imageUrl() + '::offset');
    return (t * 2 - 1) * MAX_STATIC_OFFSET_PX;
  });

  // A real polaroid pinned to a corkboard wouldn't all swing and settle in
  // perfect unison - or even in the same direction. Both magnitude and sign
  // are hash-derived per photo, so roughly half swing opposite the others for
  // the exact same scroll gesture instead of every one leaning the same way.
  private readonly sensitivityMultiplier = computed(() => {
    const magnitude = 0.6 + hash01(this.imageUrl() + '::sensitivity') * 0.7;
    const sign = hash01(this.imageUrl() + '::sensitivity-sign') < 0.5 ? -1 : 1;
    return magnitude * sign;
  });
  private readonly settleDelayExtraMs = computed(() => hash01(this.imageUrl() + '::settle') * 120);
  readonly springDurationS = computed(() => 0.5 + hash01(this.imageUrl() + '::spring') * 0.3);

  private scrollListener?: () => void;
  private ticking = false;
  private scrollSamples: { time: number; y: number }[] = [];
  private inertiaSettleTimer?: ReturnType<typeof setTimeout>;
  private pinShiftResizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.scrollSamples = [{ time: performance.now(), y: window.scrollY }];

    this.zone.runOutsideAngular(() => {
      this.updateScrollEffects();
      this.scrollListener = this.renderer.listen('window', 'scroll', () => this.requestTick());

      this.applyPinShift();
      const img = this.photoImgRef?.nativeElement;
      if (img && !img.complete) {
        img.addEventListener('load', () => this.applyPinShift(), { once: true });
      }

      // The card's rendered width/height (and so the correct pin position)
      // can change on viewport resize since it's a fluid, not fixed, width.
      const card = this.cardRef?.nativeElement;
      if (card && typeof ResizeObserver !== 'undefined') {
        this.pinShiftResizeObserver = new ResizeObserver(() => this.applyPinShift());
        this.pinShiftResizeObserver.observe(card);
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollListener?.();
    this.pinShiftResizeObserver?.disconnect();
    clearTimeout(this.inertiaSettleTimer);
    clearTimeout(this.openTimer);
  }

  // Pins the card's rotation pivot to wherever the pin's needle tip actually
  // sits, and derives that pin's horizontal position from gravity: a card
  // pinned exactly above its own center of mass hangs straight, so any
  // resting tilt must come from an off-center pin whose position determines
  // the tilt via equilibrium (the pin-to-centroid line must hang vertical).
  //
  // This is measured from the ACTUAL rendered card (post aspect-ratio, post
  // caption, post padding) rather than assumed from hardcoded constants,
  // since the card's height now varies per photo's own aspect ratio and no
  // longer has a fixed relationship to its width.
  private applyPinShift(): void {
    const host = this.el.nativeElement;
    const card = this.cardRef?.nativeElement;
    if (!card) return;

    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (!width || !height) return;

    const halfCentroidToPin = height / 2 - PIN_ANCHOR_PX;
    const thetaRad = (this.rotationDeg() * Math.PI) / 180;
    const shiftPx = -halfCentroidToPin * Math.tan(thetaRad);
    const shiftPercent = Math.max(-30, Math.min(30, (shiftPx / width) * 100));

    this.renderer.setStyle(
      host,
      '--polaroid-pin-shift',
      `${shiftPercent}%`,
      RendererStyleFlags2.DashCase,
    );
  }

  open(): void {
    // Pin lift starts immediately; the lightbox itself appears a beat later so
    // the pluck-off animation gets a clear, unobscured window to play.
    this.focused.set(true);
    this.document.body.style.overflow = 'hidden';
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      this.showOverlay.set(true);
      // The overlay is rendered inside this component's normal tree first,
      // then teleported to <body> - some ancestor in the page (e.g.
      // FadeUpDirective's transform) would otherwise become its containing
      // block and clip a position:fixed overlay to that ancestor's box
      // instead of the viewport.
      afterNextRender(() => this.moveOverlayToBody(), { injector: this.injector });
    }, OVERLAY_OPEN_DELAY_MS);
  }

  close(): void {
    clearTimeout(this.openTimer);
    this.focused.set(false);
    this.showOverlay.set(false);
    this.document.body.style.overflow = '';
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.focused()) this.close();
  }

  private moveOverlayToBody(): void {
    const overlay = this.overlayRootRef?.nativeElement;
    if (overlay && overlay.parentElement !== this.document.body) {
      this.renderer.appendChild(this.document.body, overlay);
    }
  }

  private requestTick(): void {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.updateScrollEffects();
      this.ticking = false;
    });
  }

  private updateScrollEffects(): void {
    const el = this.el.nativeElement;
    const card = this.cardRef?.nativeElement;

    // Parallax: subtle vertical drift based on distance from viewport center.
    const rect = el.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const elementCenter = rect.top + rect.height / 2;
    const distanceFromCenter = (elementCenter - viewportCenter) / viewportCenter;
    const parallax = Math.max(-1, Math.min(1, distanceFromCenter)) * PARALLAX_RANGE_PX;
    this.renderer.setStyle(
      el,
      '--polaroid-parallax',
      `${parallax}px`,
      RendererStyleFlags2.DashCase,
    );

    // Inertia: a fast scroll flick nudges the tilt further, then springs back to
    // rest once scrolling stops. While actively scrolling, a fast/near-instant
    // transition is used so the tilt visibly tracks the flick instead of being
    // perpetually chased by the slower spring-back transition.
    const now = performance.now();
    const scrollY = window.scrollY;
    this.scrollSamples.push({ time: now, y: scrollY });
    this.scrollSamples = this.scrollSamples.filter(
      (sample) => now - sample.time <= VELOCITY_WINDOW_MS,
    );
    const oldest = this.scrollSamples[0];
    const deltaTime = Math.max(now - oldest.time, 1);
    const velocity = (scrollY - oldest.y) / deltaTime;

    const sensitivity = INERTIA_SENSITIVITY * this.sensitivityMultiplier();
    const inertiaTilt = Math.max(
      -MAX_INERTIA_TILT_DEG,
      Math.min(MAX_INERTIA_TILT_DEG, -velocity * sensitivity),
    );
    this.renderer.setStyle(
      el,
      '--polaroid-inertia-tilt',
      `${inertiaTilt}deg`,
      RendererStyleFlags2.DashCase,
    );

    if (card) this.renderer.addClass(card, 'polaroid--scrolling');
    clearTimeout(this.inertiaSettleTimer);
    this.inertiaSettleTimer = setTimeout(() => {
      this.renderer.setStyle(el, '--polaroid-inertia-tilt', '0deg', RendererStyleFlags2.DashCase);
      if (card) this.renderer.removeClass(card, 'polaroid--scrolling');
    }, INERTIA_SETTLE_MS + this.settleDelayExtraMs());
  }
}
