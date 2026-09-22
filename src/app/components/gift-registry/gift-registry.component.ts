import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-gift-registry',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './gift-registry.component.html',
  styleUrl: './gift-registry.component.scss',
})
export class GiftRegistryComponent {
  private readonly document = inject(DOCUMENT);

  openGiftDetails(event: Event): void {
    event.preventDefault();

    const win = this.document.defaultView;
    const details = this.document.getElementById('gift-blessing') as HTMLDetailsElement | null;
    const scrollTarget = details ?? this.document.getElementById('questions-answers');

    if (details) {
      details.open = true;
    }

    if (win) {
      win.history.replaceState(
        null,
        '',
        `${win.location.pathname}${win.location.search}#gift-blessing`,
      );
    }

    scrollTarget?.scrollIntoView({
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  private prefersReducedMotion(): boolean {
    return (
      this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false
    );
  }
}
