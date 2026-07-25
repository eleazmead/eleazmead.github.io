import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { APP_CONFIG } from '../config/app.config';
import { TranslationService } from './translation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

// Routes containing personal guest data must never be indexed or shared as canonical.
function isPrivateRoute(path: string): boolean {
  return path !== '/' && path !== '';
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly ts = inject(TranslationService);

  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0].split('#')[0]),
      startWith(this.router.url.split('?')[0].split('#')[0]),
    ),
    { initialValue: this.router.url.split('?')[0].split('#')[0] },
  );

  constructor() {
    effect(() => {
      const locale = this.ts.locale();
      const translations = this.ts.translations();
      const path = this.currentPath();
      if (Object.keys(translations).length === 0) return;
      this.updateTags(locale, path);
    });
  }

  private updateTags(locale: string, path: string): void {
    const seo = APP_CONFIG.seo;
    const name1 = this.ts.t('couple.name1');
    const name2 = this.ts.t('couple.name2');
    const weddingDate = this.ts.t('couple.weddingDate');

    const pageTitle = this.fill(this.ts.t('seo.titleTemplate'), [name1, name2, weddingDate]);
    const description = this.fill(this.ts.t('seo.description'), [name1, name2, weddingDate]);
    const keywords = this.fill(this.ts.t('seo.keywords'), [name1, name2]);

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });

    const privateRoute = isPrivateRoute(path);
    this.meta.updateTag({
      name: 'robots',
      content: privateRoute ? 'noindex, nofollow' : 'index, follow',
    });

    // Guest-hash and admin routes carry personal data - always canonicalize to the homepage.
    const canonicalUrl = `${seo.siteUrl}/`;
    this.setLinkTag('canonical', canonicalUrl);
    this.setLinkTag('alternate', canonicalUrl, 'en');
    this.setLinkTag('alternate', canonicalUrl, 'fil');
    this.setLinkTag('alternate', canonicalUrl, 'x-default');

    const ogImageUrl = `${seo.siteUrl}/${seo.ogImage}`;
    const ogLocale = (seo.ogLocaleMap as Record<string, string>)[locale] ?? 'en_US';
    const ogLocaleAlternate =
      locale === 'en' ? seo.ogLocaleMap.fil : seo.ogLocaleMap.en;

    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: `${name1} & ${name2}` });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: ogImageUrl });
    this.meta.updateTag({ property: 'og:locale', content: ogLocale });
    this.meta.updateTag({ property: 'og:locale:alternate', content: ogLocaleAlternate });

    this.meta.updateTag({ name: 'twitter:card', content: seo.twitterCard });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: ogImageUrl });
  }

  private fill(template: string, values: string[]): string {
    return values.reduce((acc: string, value, index) => acc.replaceAll(`{${index}}`, value), template);
  }

  private setLinkTag(rel: string, href: string, hreflang?: string): void {
    const selector = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]:not([hreflang])`;
    let el = this.document.head.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = this.document.createElement('link');
      el.setAttribute('rel', rel);
      if (hreflang) el.setAttribute('hreflang', hreflang);
      this.document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }
}
