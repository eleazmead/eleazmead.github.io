import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './shared/seo.service';
import { TranslationService } from './shared/translation.service';
import { APP_CONFIG } from './config/app.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Injected eagerly so its reactive tag updates start running at bootstrap.
  private readonly seo = inject(SeoService);

  constructor() {
    this.applyLocaleParam();
  }

  private applyLocaleParam(): void {
    const supported = APP_CONFIG.i18n.supportedLocales as readonly string[];
    const ts = inject(TranslationService);
    const STORAGE_KEY = 'eleazmead_locale';

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('locale')?.trim().toLowerCase();

    if (fromParam && supported.includes(fromParam)) {
      ts.setLocale(fromParam as (typeof APP_CONFIG.i18n.supportedLocales)[number]);
      localStorage.setItem(STORAGE_KEY, fromParam);
      params.delete('locale');
      const newSearch = params.toString();
      const cleanUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      history.replaceState(null, '', cleanUrl);
      return;
    }

    // No param - restore saved preference if any.
    const saved = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    if (saved && supported.includes(saved)) {
      ts.setLocale(saved as (typeof APP_CONFIG.i18n.supportedLocales)[number]);
    }
  }
}
