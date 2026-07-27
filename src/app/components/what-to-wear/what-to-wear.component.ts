import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  Renderer2,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

// Duration of the FLIP grow-into-focus transition (see playOpenFlip), same
// values as the Our Story polaroid focus mode this mirrors.
const FLIP_TRANSITION_MS = 450;
// Growing into focus: fast start, long smooth deceleration into rest.
const FLIP_OPEN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
// Landing back on the page: a slight settle/bounce rather than a flat stop.
const FLIP_CLOSE_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

@Component({
  selector: 'app-what-to-wear',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './what-to-wear.component.html',
  styleUrl: './what-to-wear.component.scss',
})
export class WhatToWearComponent implements OnDestroy {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  @ViewChild('imageButton') private imageButtonRef?: ElementRef<HTMLElement>;
  @ViewChild('overlayRoot') private overlayRootRef?: ElementRef<HTMLElement>;
  @ViewChild('overlayContent') private overlayContentRef?: ElementRef<HTMLElement>;

  readonly attireGuideImage = APP_CONFIG.assets.attireGuideImage;
  readonly ladiesColorGuide = APP_CONFIG.whatToWear.colorGuide.ladies;
  readonly gentlemenColorGuide = APP_CONFIG.whatToWear.colorGuide.gentlemen;
  readonly imageFailed = signal(false);
  // Conceals the inline board image the instant focus mode opens (mirrors
  // PolaroidPhotoComponent.focused) so it isn't visible behind the backdrop
  // while the overlay is open - the FLIP animation below is what makes it
  // read as that same inline image growing into the overlay, rather than a
  // separate copy appearing on top of it.
  readonly focused = signal(false);
  // Separate from `focused` so the overlay can stay mounted for the full
  // duration of the closing shrink-back-to-page animation, instead of
  // vanishing the instant the close button/backdrop is clicked.
  readonly overlayVisible = signal(false);

  private flipOrigin?: DOMRect;
  private flipCleanupTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this.flipCleanupTimer);
    this.unlockBodyScroll();
  }

  shouldShowImage(): boolean {
    return Boolean(this.attireGuideImage) && !this.imageFailed();
  }

  markImageFailed(): void {
    this.imageFailed.set(true);
    this.close();
  }

  open(): void {
    if (!this.shouldShowImage()) return;

    // Capture the inline button's exact on-page position/size before
    // anything changes, so the overlay can grow FROM there instead of just
    // popping in centered - see playOpenFlip.
    const button = this.imageButtonRef?.nativeElement;
    this.flipOrigin = button?.getBoundingClientRect();

    this.focused.set(true);
    this.overlayVisible.set(true);
    this.document.body.style.overflow = 'hidden';
    // <main> establishes its own stacking context (position: relative;
    // z-index: 1 in styles.scss, needed to layer its decorative ::before/
    // ::after pseudo-elements) - any position: fixed overlay left inside it
    // gets capped at that z-index of 1 for STACKING purposes no matter how
    // high its own z-index is set, even though position: fixed positions it
    // relative to the viewport for LAYOUT purposes. That let the fixed
    // language toggle (a sibling of <main>, z-index: 1000) render on top of
    // this overlay's close button. Reparenting to <body> escapes <main>'s
    // stacking context entirely - the same fix already used by the polaroid
    // focus overlay for the same underlying reason (see
    // PolaroidPhotoComponent.moveOverlayToBody).
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

    const button = this.imageButtonRef?.nativeElement;
    const overlayContent = this.overlayContentRef?.nativeElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!button || !overlayContent || reduceMotion) {
      this.focused.set(false);
      this.overlayVisible.set(false);
      this.unlockBodyScroll();
      return;
    }

    this.playCloseFlip(button, overlayContent);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.focused()) this.close();
  }

  // FLIP (First-Last-Invert-Play): the overlay content is rendered at its
  // natural centered/full size (the "last" state), then we measure that,
  // compute the transform delta from the inline button's captured "first"
  // state, and apply that delta instantly (so it visually looks identical to
  // the inline image) before animating it back to identity. The result reads
  // as the board image growing from its on-page spot into focus, rather than
  // a separate overlay popping in from nowhere on top of the (still visible)
  // inline image.
  private playOpenFlip(): void {
    const origin = this.flipOrigin;
    const overlayContent = this.overlayContentRef?.nativeElement;
    if (!origin || !overlayContent) return;

    // Inline styles set below would override the stylesheet's own
    // prefers-reduced-motion rules, so that preference is checked directly
    // here - skip the motion entirely and let the content sit at its resting
    // centered position with no transform to animate away.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lastRect = overlayContent.getBoundingClientRect();
    const { deltaX, deltaY, scaleX, scaleY } = this.flipDelta(origin, lastRect);

    this.renderer.setStyle(overlayContent, 'will-change', 'transform');
    this.renderer.setStyle(overlayContent, 'transition', 'none');
    this.renderer.setStyle(
      overlayContent,
      'transform',
      this.flipTransform(deltaX, deltaY, scaleX, scaleY),
    );

    // Force a reflow so the browser commits the inverted starting state
    // above before the transition (and target value) below is applied -
    // otherwise the two style writes would be batched together and there
    // would be nothing to animate from.
    void overlayContent.offsetWidth;

    this.renderer.setStyle(overlayContent, 'transition', this.flipTransitionCss(FLIP_OPEN_EASING));
    this.renderer.setStyle(overlayContent, 'transform', 'translate3d(0, 0, 0) scale(1, 1)');

    clearTimeout(this.flipCleanupTimer);
    this.flipCleanupTimer = setTimeout(() => {
      this.clearFlipStyles(overlayContent);
    }, FLIP_TRANSITION_MS);
  }

  // Reverse of playOpenFlip: animates the overlay content FROM its current
  // resting/centered state back down to the inline button's on-page rect, so
  // closing reads as the image shrinking back to exactly where it's about to
  // reappear, instead of just vanishing. The backdrop fades out over the same
  // duration so the page is visible again right as the image lands.
  private playCloseFlip(button: HTMLElement, overlayContent: HTMLElement): void {
    const targetRect = button.getBoundingClientRect();
    const currentRect = overlayContent.getBoundingClientRect();
    const { deltaX, deltaY, scaleX, scaleY } = this.flipDelta(targetRect, currentRect);

    this.renderer.setStyle(overlayContent, 'will-change', 'transform');
    this.renderer.setStyle(overlayContent, 'transition', this.flipTransitionCss(FLIP_CLOSE_EASING));
    this.renderer.setStyle(
      overlayContent,
      'transform',
      this.flipTransform(deltaX, deltaY, scaleX, scaleY),
    );

    // Fades the backdrop's own painted background, NOT the overlay root's
    // opacity - opacity cascades to children via compositing, which would
    // fade the image itself to transparent as a side effect of dimming the
    // backdrop, right as it's landing. background-color only affects the
    // box's own paint, so the image stays fully solid throughout.
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
      this.unlockBodyScroll();
    };

    // A fixed setTimeout isn't frame-accurate against the actual CSS
    // transition - if it fires even slightly before the shrink visually
    // finishes landing, the overlay gets swapped out mid-motion, which reads
    // as a flash/pop right at the end. The real transitionend event is
    // exact, so it's the primary completion signal; the timer below is only
    // a safety net in case it never fires.
    overlayContent.addEventListener(
      'transitionend',
      (event) => {
        if (event.target === overlayContent && event.propertyName === 'transform') finish();
      },
      { once: true },
    );

    clearTimeout(this.flipCleanupTimer);
    this.flipCleanupTimer = setTimeout(finish, FLIP_TRANSITION_MS + 120);
  }

  // Shared delta math for both directions: the transform (translate + scale)
  // that would make an element currently occupying `fromRect` visually
  // appear at `toRect` instead.
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

  // A single combined `transform` (translate3d + scale) rather than separate
  // translate/scale CSS properties - translate3d's explicit Z component is
  // the classic cross-browser trick to force a hardware-accelerated
  // compositor layer, notably on Safari/WebKit (see the same choice, with
  // the same reasoning, in PolaroidPhotoComponent.flipTransform).
  private flipTransform(deltaX: number, deltaY: number, scaleX: number, scaleY: number): string {
    return `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`;
  }

  private flipTransitionCss(easing: string): string {
    return `transform ${FLIP_TRANSITION_MS}ms ${easing}`;
  }

  private clearFlipStyles(overlayContent: HTMLElement): void {
    this.renderer.removeStyle(overlayContent, 'transition');
    this.renderer.removeStyle(overlayContent, 'transform');
    this.renderer.removeStyle(overlayContent, 'will-change');
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }

  private moveOverlayToBody(): void {
    const overlay = this.overlayRootRef?.nativeElement;
    if (overlay && overlay.parentElement !== this.document.body) {
      this.renderer.appendChild(this.document.body, overlay);
    }
  }
}
