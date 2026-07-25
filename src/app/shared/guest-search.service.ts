import { Injectable } from '@angular/core';
import { Observable, of, tap, map, shareReplay, finalize } from 'rxjs';
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
  private guestList: GuestRow[] = [];
  private loaded = false;
  private loadRequest?: Observable<void>;

  constructor(private readonly sheets: SheetsService) {}

  loadGuests(): Observable<void> {
    if (this.loaded) return of(undefined);
    if (this.loadRequest) return this.loadRequest;

    this.loadRequest = this.sheets.fetchGuestList().pipe(
      tap((rows) => {
        this.guestList = rows;
        this.loaded = true;
      }),
      map(() => undefined),
      finalize(() => {
        this.loadRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.loadRequest;
  }

  findMatchByHash(hashInput: string): GuestHashMatch | null {
    const normalizedHash = this.normalizeHash(hashInput);
    if (!normalizedHash) return null;

    for (const row of this.guestList) {
      const candidates = [
        { hash: row.fullNameHashMd5, name: row.fullName, field: 'fullName' as const },
        { hash: row.guest1FullNameHashMd5, name: row.guest1Name, field: 'guest1FullName' as const },
        { hash: row.guest2FullNameHashMd5, name: row.guest2Name, field: 'guest2FullName' as const },
      ];
      for (const candidate of candidates) {
        if (candidate.name.trim() && this.normalizeHash(candidate.hash) === normalizedHash) {
          return { row, matchedName: candidate.name, matchedField: candidate.field };
        }
      }
    }
    return null;
  }

  getRelatedNames(row: GuestRow): string[] {
    return [row.guest1Name, row.guest2Name].filter((n) => n.trim().length > 0);
  }

  private normalizeHash(hash: string): string {
    return hash.trim().toLowerCase();
  }
}
