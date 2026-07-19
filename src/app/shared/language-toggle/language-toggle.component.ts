import { Component, inject, computed } from '@angular/core';
import { TranslationService } from '../translation.service';
import { APP_CONFIG } from '../../config/app.config';
import { TranslatePipe } from '../translate.pipe';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-toggle.component.html',
  styleUrl: './language-toggle.component.scss',
})
export class LanguageToggleComponent {
  private ts = inject(TranslationService);

  readonly locales = APP_CONFIG.i18n.supportedLocales;
  readonly currentLabel = computed(() => this.ts.t(`languageToggle.labels.${this.ts.locale()}`));

  toggle(): void {
    const current = this.ts.locale();
    const next = this.locales.find((l) => l !== current) ?? 'en';
    this.ts.setLocale(next);
  }
}
