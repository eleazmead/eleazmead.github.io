import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { TranslationService } from '../translation.service';
import { APP_CONFIG } from '../../config/app.config';
import { TranslatePipe } from '../translate.pipe';

type Locale = (typeof APP_CONFIG.i18n.supportedLocales)[number];

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-toggle.component.html',
  styleUrl: './language-toggle.component.scss',
})
export class LanguageToggleComponent {
  private readonly ts = inject(TranslationService);
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly locales = APP_CONFIG.i18n.supportedLocales;
  readonly isOpen = signal(false);
  readonly currentLocale = computed(() => this.ts.locale());
  readonly currentLabel = computed(() => this.ts.t(`languageToggle.labels.${this.ts.locale()}`));

  labelFor(locale: Locale): string {
    return this.ts.t(`languageToggle.labels.${locale}`);
  }

  toggleOpen(): void {
    this.isOpen.update((open) => !open);
  }

  select(locale: Locale): void {
    this.ts.setLocale(locale);
    localStorage.setItem('eleazmead_locale', locale);
    this.isOpen.set(false);
  }

  // Closes the dropdown on any click outside this component - the toggle
  // button itself is inside el.nativeElement, so its own click (which opens
  // the menu) doesn't immediately close it again via this same handler.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.el.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}
