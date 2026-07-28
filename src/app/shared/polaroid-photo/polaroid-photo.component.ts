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
import {
  PolaroidPhysicsHandle,
  PolaroidScrollPhysicsService,
} from './polaroid-scroll-physics.service';

// A generous safety cap, not the primary truncation mechanism - the
// caption now wraps onto up to 2 lines and is visually clamped with an
// ellipsis via CSS (-webkit-line-clamp: 2 on .polaroid__caption), so this
// only guards against a genuinely runaway-long string slipping through.
const MAX_CAPTION_LENGTH = 110;
const MAX_REST_TILT_DEG = 7;
const MAX_STATIC_OFFSET_PX = 8;

// Duration of the FLIP grow-into-focus transition (see playFlipTransition).
const FLIP_TRANSITION_MS = 450;
// Growing into focus: fast start, long smooth deceleration into rest.
const FLIP_OPEN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
// Landing back on the page: same spring feel as the pin's own re-pin
// animation, so the whole close sequence (card lands, then pin snaps back)
// reads as one consistent, slightly tactile "settle" rather than a flat stop.
const FLIP_CLOSE_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

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
  private readonly physicsService = inject(PolaroidScrollPhysicsService);

  @ViewChild('card') private cardRef?: ElementRef<HTMLElement>;
  @ViewChild('photoImg') private photoImgRef?: ElementRef<HTMLImageElement>;
  @ViewChild('overlayRoot') private overlayRootRef?: ElementRef<HTMLElement>;

  readonly imageUrl = input.required<string>();
  // Intrinsic pixel dimensions, when known - rendered as native width/height
  // attributes on the <img> so the browser can reserve the correct
  // aspect-ratio box before it loads instead of collapsing to 0 height and
  // shifting the page once it does (Lighthouse's "unsized images" audit).
  // Purely a layout-shift hint: CSS still controls the actual rendered size
  // (see .polaroid__photo - width: 100%; height: auto), so a photo's real
  // natural aspect ratio is never overridden by these.
  readonly imageWidth = input<number>();
  readonly imageHeight = input<number>();
  readonly alt = input.required<string>();
  readonly caption = input<string>('');
  readonly imageError = output<void>();

  readonly focused = signal(false);
  // Separate from `focused` so the overlay can stay mounted for the duration
  // of the reverse FLIP shrink-back-to-page animation on close, instead of
  // vanishing the instant the close button/backdrop is clicked.
  readonly overlayVisible = signal(false);
  readonly pinGradientId = `polaroid-pin-${nextPinGradientId++}`;
  readonly pinShadeId = `polaroid-pin-shade-${nextPinGradientId++}`;

  private flipOrigin?: { rect: DOMRect; rotate: string };
  private flipCleanupTimer?: ReturnType<typeof setTimeout>;

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

  private physicsHandle?: PolaroidPhysicsHandle;
  private pinShiftResizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Scroll-linked parallax/inertia is driven by a single shared service
      // across every polaroid on the page (batched reads-then-writes, one
      // listener/rAF loop total) instead of each instance running its own -
      // see PolaroidScrollPhysicsService for why.
      const card = this.cardRef?.nativeElement;
      if (card) {
        this.physicsHandle = {
          hostElement: this.el.nativeElement,
          cardElement: card,
          sensitivityMultiplier: () => this.sensitivityMultiplier(),
          settleDelayExtraMs: () => this.settleDelayExtraMs(),
        };
        this.physicsService.register(this.physicsHandle);
      }

      this.applyPinShift();
      const img = this.photoImgRef?.nativeElement;
      if (img && !img.complete) {
        img.addEventListener('load', () => this.applyPinShift(), { once: true });
      }

      // The card's rendered width/height (and so the correct pin position)
      // can change on viewport resize since it's a fluid, not fixed, width.
      if (card && typeof ResizeObserver !== 'undefined') {
        this.pinShiftResizeObserver = new ResizeObserver(() => this.applyPinShift());
        this.pinShiftResizeObserver.observe(card);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.physicsHandle) this.physicsService.unregister(this.physicsHandle);
    this.pinShiftResizeObserver?.disconnect();
    clearTimeout(this.flipCleanupTimer);
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
    // Capture the inline card's exact on-page position/size/rotation before
    // anything changes, so the overlay can grow FROM there instead of just
    // popping in centered - see playFlipTransition. Falls back to a plain
    // appearance (no motion) if the card isn't measurable for some reason.
    const card = this.cardRef?.nativeElement;
    this.flipOrigin = card
      ? { rect: card.getBoundingClientRect(), rotate: getComputedStyle(card).rotate }
      : undefined;

    // The pin lifts off and the overlay appears together - the card itself
    // growing from its on-page spot into focus IS the "picked up" motion now,
    // so there's no need to stagger the pin ahead of it.
    this.focused.set(true);
    this.overlayVisible.set(true);
    this.document.body.style.overflow = 'hidden';
    // The overlay is rendered inside this component's normal tree first, then
    // teleported to <body> - some ancestor in the page (e.g. FadeUpDirective's
    // transform) would otherwise become its containing block and clip a
    // position:fixed overlay to that ancestor's box instead of the viewport.
    afterNextRender(
      () => {
        this.moveOverlayToBody();
        this.playOpenFlip();
      },
      { injector: this.injector },
    );
  }

  close(): void {
    clearTimeout(this.flipCleanupTimer);

    const card = this.cardRef?.nativeElement;
    const overlayCard = this.overlayRootRef?.nativeElement.querySelector<HTMLElement>('.polaroid');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!card || !overlayCard || reduceMotion) {
      this.focused.set(false);
      this.overlayVisible.set(false);
      this.document.body.style.overflow = '';
      return;
    }

    this.playCloseFlip(card, overlayCard);
  }

  // FLIP (First-Last-Invert-Play): the overlay card is rendered at its
  // natural centered/full size (the "last" state), then we measure that,
  // compute the transform delta from the inline card's captured "first"
  // state, and apply that delta instantly (so it visually looks identical to
  // the inline card) before animating it back to identity. The result reads
  // as one continuous photo growing from its page position into focus,
  // rather than two disconnected elements (a static inline card plus a
  // separate overlay popping in from nowhere).
  private playOpenFlip(): void {
    const origin = this.flipOrigin;
    const overlayCard = this.overlayRootRef?.nativeElement.querySelector<HTMLElement>('.polaroid');
    if (!origin || !overlayCard) return;

    // Inline styles set below would override the stylesheet's own
    // prefers-reduced-motion rules, so that preference is checked directly
    // here - skip the motion entirely and let the card sit at its resting
    // centered position with no transform to animate away.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lastRect = overlayCard.getBoundingClientRect();
    const { deltaX, deltaY, scaleX, scaleY } = this.flipDelta(origin.rect, lastRect);
    const startRotate = origin.rotate === 'none' ? '0deg' : origin.rotate;

    this.renderer.setStyle(overlayCard, 'will-change', 'transform');
    this.renderer.setStyle(overlayCard, 'transition', 'none');
    this.renderer.setStyle(
      overlayCard,
      'transform',
      this.flipTransform(deltaX, deltaY, scaleX, scaleY, startRotate),
    );

    // Force a reflow so the browser commits the inverted starting state
    // above before the transition (and target value) below is applied -
    // otherwise the two style writes would be batched together and there
    // would be nothing to animate from.
    void overlayCard.offsetWidth;

    this.renderer.setStyle(overlayCard, 'transition', this.flipTransitionCss(FLIP_OPEN_EASING));
    this.renderer.setStyle(
      overlayCard,
      'transform',
      'translate3d(0, 0, 0) rotate(0deg) scale(1, 1)',
    );

    clearTimeout(this.flipCleanupTimer);
    this.flipCleanupTimer = setTimeout(() => {
      // Hand control back to the stylesheet's own rules once the morph
      // finishes, so later interactions (e.g. re-opening) aren't affected by
      // this one-off inline override.
      this.clearFlipStyles(overlayCard);
    }, FLIP_TRANSITION_MS);
  }

  // Reverse of playOpenFlip: animates the overlay card FROM its current
  // resting/centered state back down to the inline card's on-page rect, so
  // closing reads as the photo shrinking back to exactly where it's about to
  // be re-pinned, instead of just vanishing. The backdrop fades out over the
  // same duration so the page is visible again right as the photo lands.
  // The overlay stays mounted (overlayVisible) until the animation finishes;
  // `focused` only flips at the very end, revealing the inline card and
  // re-pinning it at the same moment the shrunk overlay is removed.
  private playCloseFlip(card: HTMLElement, overlayCard: HTMLElement): void {
    const targetRect = card.getBoundingClientRect();
    const targetRotate = getComputedStyle(card).rotate;
    const currentRect = overlayCard.getBoundingClientRect();
    const { deltaX, deltaY, scaleX, scaleY } = this.flipDelta(targetRect, currentRect);
    const endRotate = targetRotate === 'none' ? '0deg' : targetRotate;

    this.renderer.setStyle(overlayCard, 'will-change', 'transform');
    this.renderer.setStyle(overlayCard, 'transition', this.flipTransitionCss(FLIP_CLOSE_EASING));
    this.renderer.setStyle(
      overlayCard,
      'transform',
      this.flipTransform(deltaX, deltaY, scaleX, scaleY, endRotate),
    );

    // Fades the backdrop's own painted background, NOT the overlay root's
    // opacity - opacity cascades to children via compositing, which was
    // fading the card (and photo) itself to transparent as a side effect of
    // dimming the backdrop, right as it was landing. background-color only
    // affects the box's own paint, so the card stays fully solid throughout.
    const overlayRoot = this.overlayRootRef?.nativeElement;
    if (overlayRoot) {
      this.renderer.setStyle(
        overlayRoot,
        'transition',
        `background-color ${FLIP_TRANSITION_MS}ms ease`,
      );
      this.renderer.setStyle(overlayRoot, 'background-color', 'rgba(18, 18, 18, 0)');
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this.flipCleanupTimer);
      this.focused.set(false);
      this.overlayVisible.set(false);
      this.document.body.style.overflow = '';
    };

    // A fixed setTimeout isn't frame-accurate against the actual CSS
    // transition - if it fires even slightly before the shrink visually
    // finishes landing, the overlay gets swapped out for the inline card
    // mid-motion, which reads as a flash/pop right at the end. The real
    // transitionend event is exact, so it's the primary completion signal;
    // the timer below is only a safety net in case it never fires.
    overlayCard.addEventListener(
      'transitionend',
      (event) => {
        if (event.target === overlayCard && event.propertyName === 'transform') finish();
      },
      { once: true },
    );

    clearTimeout(this.flipCleanupTimer);
    this.flipCleanupTimer = setTimeout(finish, FLIP_TRANSITION_MS + 120);
  }

  // Shared delta math for both directions: the transform (translate + scale)
  // that would make an element currently occupying `fromRect` visually
  // appear at `toRect` instead - see playOpenFlip/playCloseFlip for how the
  // two directions each use this.
  private flipDelta(
    toRect: DOMRect,
    fromRect: DOMRect,
  ): { deltaX: number; deltaY: number; scaleX: number; scaleY: number } {
    return {
      deltaX: toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2),
      deltaY: toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2),
      scaleX: toRect.width / fromRect.width,
      scaleY: toRect.height / fromRect.height,
    };
  }

  // A single combined `transform` (translate3d + rotate + scale) rather than
  // the three separate rotate/translate/scale CSS properties used elsewhere
  // in this component. The individual-properties API (CSS Transforms Level
  // 2) doesn't have as mature/consistent GPU-compositing support across
  // browsers - notably Safari/WebKit - as the long-standing `transform`
  // shorthand does. translate3d's explicit (even zero) Z component is the
  // classic, most reliable cross-browser trick to force a hardware-
  // accelerated compositor layer. Switching to this combo is what actually
  // resolved stutter that persisted even after adding will-change hints and
  // dropping box-shadow from the animated properties.
  private flipTransform(
    deltaX: number,
    deltaY: number,
    scaleX: number,
    scaleY: number,
    rotate: string,
  ): string {
    return `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotate}) scale(${scaleX}, ${scaleY})`;
  }

  // box-shadow is deliberately NOT animated - unlike transform, it isn't
  // GPU-compositable, so animating it forces a CPU repaint on every single
  // frame, stacked right on top of the transform animation. The shadow just
  // snaps to its new value instantly, which is far less noticeable than the
  // frame drops caused by animating it would be.
  private flipTransitionCss(easing: string): string {
    return `transform ${FLIP_TRANSITION_MS}ms ${easing}`;
  }

  private clearFlipStyles(overlayCard: HTMLElement): void {
    this.renderer.removeStyle(overlayCard, 'transition');
    this.renderer.removeStyle(overlayCard, 'transform');
    this.renderer.removeStyle(overlayCard, 'will-change');
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
}
