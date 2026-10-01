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
  // Hides the inline board image while focused (mirrors PolaroidPhotoComponent.focused); the FLIP animation makes it read as the same image growing.
  readonly focused = signal(false);
  // Separate from `focused` so the overlay stays mounted for the closing animation.
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

    // Capture the inline button's rect first so the overlay can grow from it (see playOpenFlip).
    const button = this.imageButtonRef?.nativeElement;
    this.flipOrigin = button?.getBoundingClientRect();

    this.focused.set(true);
    this.overlayVisible.set(true);
    this.document.body.style.overflow = 'hidden';
    // <main> has its own stacking context (z-index: 1), which would cap this fixed overlay below the language toggle.
    // Reparenting to <body> escapes it (same fix as PolaroidPhotoComponent.moveOverlayToBody).
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

  // FLIP: render the overlay at its final size, measure it, invert it onto the inline image's rect,
  // then animate to identity so the image appears to grow into focus.
  private playOpenFlip(): void {
    const origin = this.flipOrigin;
    const overlayContent = this.overlayContentRef?.nativeElement;
    if (!origin || !overlayContent) return;

    // Inline styles override the stylesheet's reduced-motion rules, so check the preference here and skip the motion.
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

    // Force a reflow so the inverted start state is committed before the transition is applied.
    void overlayContent.offsetWidth;

    this.renderer.setStyle(overlayContent, 'transition', this.flipTransitionCss(FLIP_OPEN_EASING));
    this.renderer.setStyle(overlayContent, 'transform', 'translate3d(0, 0, 0) scale(1, 1)');

    clearTimeout(this.flipCleanupTimer);
    this.flipCleanupTimer = setTimeout(() => {
      this.clearFlipStyles(overlayContent);
    }, FLIP_TRANSITION_MS);
  }

  // Reverse of playOpenFlip: shrinks the overlay back to the inline image while the backdrop fades out.
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

    // Fade the backdrop's background-color, not the root's opacity, which would fade the image too.
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

    // Primary completion signal is the real transitionend event: a fixed timer can fire early and pop the overlay mid-shrink.
    // The timer below is only a safety net.
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

  // Transform (translate + scale) that makes an element at `fromRect` appear at `toRect`.
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

  // Single combined `transform` with translate3d to force a GPU layer (same choice as PolaroidPhotoComponent.flipTransform).
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
