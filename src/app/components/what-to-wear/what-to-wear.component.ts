import { Component, signal } from '@angular/core';
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
export class WhatToWearComponent {
  readonly attireGuideImage = APP_CONFIG.assets.attireGuideImage;
  readonly ladiesColorGuide = APP_CONFIG.whatToWear.colorGuide.ladies;
  readonly gentlemenColorGuide = APP_CONFIG.whatToWear.colorGuide.gentlemen;
  readonly imageFailed = signal(false);

  shouldShowImage(): boolean {
    return Boolean(this.attireGuideImage) && !this.imageFailed();
  }

  markImageFailed(): void {
    this.imageFailed.set(true);
  }
}
