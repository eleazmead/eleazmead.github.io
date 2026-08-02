import { Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { SheetsService } from './sheets.service';
import { GuestRow } from './models/guest.model';

export type GuestHashMatchField = 'fullName' | 'guest1FullName' | 'guest2FullName';

export interface GuestHashMatch {
  row: GuestRow;
  matchedName: string;
  matchedField: GuestHashMatchField;
}

export function shouldShowGuestLetterForMatch(match: GuestHashMatch | null): boolean {
  const row = match?.row;
  if (!match || !row?.letterAddress.trim() || !row.letterMessage.trim()) return false;

  if (match.matchedField === 'fullName') return true;

  return (
    (match.matchedField === 'guest1FullName' || match.matchedField === 'guest2FullName') &&
    row.letterShowForAll.trim() === '1'
  );
}

@Injectable({ providedIn: 'root' })
export class GuestSearchService {
  private cache = new Map<string, Observable<GuestHashMatch | null>>();

  constructor(private readonly sheets: SheetsService) {}

  findByHash(hash: string): Observable<GuestHashMatch | null> {
    const key = hash.trim().toLowerCase();
    if (!this.cache.has(key)) {
      const req = this.sheets.fetchGuestByHash(hash).pipe(
        map((row) => (row ? this.resolveMatch(row, key) : null)),
        catchError((err) => {
          // Don't cache errors so retries make a fresh network request.
          this.cache.delete(key);
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(key, req);
    }
    return this.cache.get(key)!;
  }

  getRelatedNames(row: GuestRow): string[] {
    return [row.guest1Name, row.guest2Name].filter((n) => n.trim().length > 0);
  }

  private resolveMatch(row: GuestRow, normalizedHash: string): GuestHashMatch | null {
    const candidates: { hash: string; name: string; field: GuestHashMatchField }[] = [
      { hash: row.fullNameHashMd5, name: row.fullName, field: 'fullName' },
      { hash: row.guest1FullNameHashMd5, name: row.guest1Name, field: 'guest1FullName' },
      { hash: row.guest2FullNameHashMd5, name: row.guest2Name, field: 'guest2FullName' },
    ];
    for (const c of candidates) {
      if (c.name.trim() && c.hash.trim().toLowerCase() === normalizedHash) {
        return { row, matchedName: c.name, matchedField: c.field };
      }
    }
    // Fallback: return fullName match if hash comparison is inconclusive
    return { row, matchedName: row.fullName, matchedField: 'fullName' };
  }
}
