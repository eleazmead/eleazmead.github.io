import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './shared/seo.service';
import { TranslationService } from './shared/translation.service';
import { GuestSearchService } from './shared/guest-search.service';
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
    this.prefetchHashIfPresent();
  }

  private prefetchHashIfPresent(): void {
    // Strip leading slash to get the raw path segment (the rsvpHash).
    // Ignore the root path and the /admin route.
    const hash = window.location.pathname.replace(/^\//, '').trim();
    if (!hash || hash === 'admin') return;
    // Fire the GAS request immediately at bootstrap. GuestSearchService caches
    // the result via shareReplay, so when RsvpComponent (and Hero, GuestLetter)
    // call findByHash() after Angular finishes rendering, they subscribe to the
    // already-in-flight Observable and get the result the moment it arrives
    // rather than starting a fresh request after component init.
    inject(GuestSearchService).findByHash(hash).subscribe();
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
