import { AfterViewInit, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

type QuestionAnswerId = (typeof APP_CONFIG.questionsAndAnswers.items)[number];
type GiftQrCodeId = keyof typeof APP_CONFIG.assets.giftQrCodes;
const GIFT_BLESSING_HASH = '#gift-blessing';
const HASH_SCROLL_ALIGNMENT_DELAYS_MS = [0, 250, 750] as const;

@Component({
  selector: 'app-questions-answers',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './questions-answers.component.html',
  styleUrl: './questions-answers.component.scss',
})
export class QuestionsAnswersComponent implements AfterViewInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly itemIds = APP_CONFIG.questionsAndAnswers.items;
  readonly giftDetails = APP_CONFIG.questionsAndAnswers.giftBlessing;
  readonly failedGiftQrCodes = signal<Set<GiftQrCodeId>>(new Set());

  ngAfterViewInit(): void {
    queueMicrotask(() => this.openGiftBlessingFromHash());
  }

  @HostListener('window:hashchange')
  handleHashChange(): void {
    this.openGiftBlessingFromHash();
  }

  @HostListener('window:load')
  handleWindowLoad(): void {
    this.openGiftBlessingFromHash();
  }

  textKey(itemId: QuestionAnswerId, field: 'question' | 'answer'): string {
    return `questionsAndAnswers.items.${itemId}.${field}`;
  }

  isGiftBlessingItem(itemId: QuestionAnswerId): boolean {
    return itemId === 'giftBlessing';
  }

  giftQrCodeUrl(qrCodeId: GiftQrCodeId): string {
    return APP_CONFIG.assets.giftQrCodes[qrCodeId];
  }

  shouldShowGiftQrCode(qrCodeId: GiftQrCodeId): boolean {
    return Boolean(this.giftQrCodeUrl(qrCodeId)) && !this.failedGiftQrCodes().has(qrCodeId);
  }

  markGiftQrCodeFailed(qrCodeId: GiftQrCodeId): void {
    const failedGiftQrCodes = new Set(this.failedGiftQrCodes());
    failedGiftQrCodes.add(qrCodeId);
    this.failedGiftQrCodes.set(failedGiftQrCodes);
  }

  private openGiftBlessingFromHash(): void {
    if (window.location.hash !== GIFT_BLESSING_HASH) return;

    const details = this.elementRef.nativeElement.querySelector(
      GIFT_BLESSING_HASH,
    ) as HTMLDetailsElement | null;
    if (!details) return;

    details.open = true;
    HASH_SCROLL_ALIGNMENT_DELAYS_MS.forEach((delayMs) => {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          details.scrollIntoView({
            behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
          });
        });
      }, delayMs);
    });
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
