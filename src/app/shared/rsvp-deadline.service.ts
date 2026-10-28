import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { APP_CONFIG } from '../config/app.config';
import { SheetsService } from './sheets.service';
import { TranslationService } from './translation.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTL_LOCALES: Record<string, string> = { en: 'en-GB', fil: 'fil-PH', zh: 'zh-SG' };

/** Current date in Singapore as YYYY-MM-DD. */
export function getSgtDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** True once the Singapore date is after the deadline day (the deadline day itself is still open). */
export function isAfterDeadline(currentDate: Date, deadlineDate: string): boolean {
  const deadline = deadlineDate.trim();
  if (!ISO_DATE.test(deadline)) return false;
  return getSgtDateKey(currentDate) > deadline;
}

/**
 * RSVP deadline (last day to RSVP, YYYY-MM-DD, inclusive in SGT). The source of truth is the
 * RSVP_DEADLINE script property set from the sheet's Admin menu; APP_CONFIG is only a fallback
 * when the backend is unreachable or the property is unset.
 */
@Injectable({ providedIn: 'root' })
export class RsvpDeadlineService {
  private readonly sheets = inject(SheetsService);
  private readonly ts = inject(TranslationService);

  readonly deadline = signal<string>(APP_CONFIG.rsvp.deadlineDate);
  readonly closed = computed(() => isAfterDeadline(new Date(), this.deadline()));

  /** Deadline formatted for the active locale, e.g. "16 December 2026". */
  readonly displayDate = computed(() => {
    const [y, m, d] = this.deadline().split('-').map(Number);
    const locale = INTL_LOCALES[this.ts.locale()] ?? 'en-GB';
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  });

  private loaded$?: Observable<string>;

  /** Fetches the deadline once; never errors (falls back to the config value). */
  load(): Observable<string> {
    this.loaded$ ??= this.sheets.fetchRsvpDeadline().pipe(
      map((res) => (res.deadline && ISO_DATE.test(res.deadline) ? res.deadline : null)),
      catchError(() => of(null)),
      tap((value) => {
        if (value) this.deadline.set(value);
      }),
      map(() => this.deadline()),
      shareReplay(1),
    );
    return this.loaded$;
  }
}
