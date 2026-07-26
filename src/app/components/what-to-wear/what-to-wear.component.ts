import { Component, OnDestroy, signal } from '@angular/core';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-what-to-wear',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './what-to-wear.component.html',
  styleUrl: './what-to-wear.component.scss',
})
export class WhatToWearComponent implements OnDestroy {
  readonly attireGuideImage = APP_CONFIG.assets.attireGuideImage;
  readonly ladiesColorGuide = APP_CONFIG.whatToWear.colorGuide.ladies;
  readonly gentlemenColorGuide = APP_CONFIG.whatToWear.colorGuide.gentlemen;
  readonly imageFailed = signal(false);
  readonly isImageOpen = signal(false);

  ngOnDestroy(): void {
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

    this.isImageOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isImageOpen.set(false);
    this.unlockBodyScroll();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }
}
