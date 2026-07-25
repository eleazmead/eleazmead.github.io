import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from '../config/app.config';

type Locale = (typeof APP_CONFIG.i18n.supportedLocales)[number];

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private http = inject(HttpClient);

  readonly locale = signal<Locale>('en');
  private readonly _translations = signal<Record<string, unknown>>({});
  readonly translations = this._translations.asReadonly();

  constructor() {
    effect(() => {
      this.fetchTranslations(this.locale());
    });
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
  }

  // Called from TranslatePipe (pure: false) - re-evaluated each CD cycle
  t(key: string): string {
    const result = key.split('.').reduce((obj: unknown, k: string) => {
      return (obj as Record<string, unknown>)?.[k];
    }, this._translations() as unknown);

    if (typeof result === 'string' && result.length > 0) return result;

    // Fallback to English cache for empty/missing values in other locales
    if (this.locale() !== 'en') {
      const fallback = key.split('.').reduce((obj: unknown, k: string) => {
        return (obj as Record<string, unknown>)?.[k];
      }, this._enFallback as unknown);
      if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    }

    return '';
  }

  private _enFallback: Record<string, unknown> = {};

  private fetchTranslations(locale: Locale): void {
    this.http.get<Record<string, unknown>>(`i18n/${locale}.json`).subscribe({
      next: (data) => {
        this._translations.set(data);
        if (locale === 'en') this._enFallback = data;
      },
      error: () => {
        if (locale !== 'en') this.fetchTranslations('en');
      },
    });
  }
}
