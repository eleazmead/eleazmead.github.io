import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  GuestHashMatch,
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from './guest-search.service';
import { SheetsService } from './sheets.service';
import { GuestRow } from './models/guest.model';

const guestRow: GuestRow = {
  rowIndex: 2,
  fullName: 'HELENA BELEN UMANDAL',
  guest1Name: 'JUAN DELA CRUZ',
  guest2Name: '',
  rsvpRaw: null,
  rsvpTotal: null,
  rsvpBeefCount: null,
  rsvpFishCount: null,
  rsvpSubmittedAt: null,
  rsvpSubmittedBy: null,
  fullNameHashMd5: 'c088e0676a3c180696fb8c708f604fee',
  guest1FullNameHashMd5: 'b4a608c6cba9fb0dd3ce825f82d2b0af',
  guest2FullNameHashMd5: '',
  letterAddress: '',
  letterMessage: '',
  letterShowForAll: '',
  letterSignedBy: '',
};

function makeService(row: GuestRow | null) {
  return new GuestSearchService({
    fetchGuestByHash: () => of(row),
  } as unknown as SheetsService);
}

describe('GuestSearchService', () => {
  let service: GuestSearchService;

  beforeEach(() => {
    service = makeService(guestRow);
  });

  it('matches the primary guest by MD5 hash', () => {
    return new Promise<void>((resolve) => {
      service.findByHash('c088e0676a3c180696fb8c708f604fee').subscribe((result) => {
        expect(result?.matchedName).toBe('HELENA BELEN UMANDAL');
        expect(result?.matchedField).toBe('fullName');
        expect(result?.row).toBe(guestRow);
        resolve();
      });
    });
  });

  it('matches a related guest by MD5 hash', () => {
    return new Promise<void>((resolve) => {
      service.findByHash('b4a608c6cba9fb0dd3ce825f82d2b0af').subscribe((result) => {
        expect(result?.matchedName).toBe('JUAN DELA CRUZ');
        expect(result?.matchedField).toBe('guest1FullName');
        resolve();
      });
    });
  });

  it('returns null when GAS finds no row', () => {
    return new Promise<void>((resolve) => {
      makeService(null).findByHash('unknown').subscribe((result) => {
        expect(result).toBeNull();
        resolve();
      });
    });
  });

  it('shows the guest letter for a primary hash match when letter fields are present', () => {
    const match = buildHashMatch('fullName', { letterAddress: 'Helena', letterMessage: 'Welcome.' });
    expect(shouldShowGuestLetterForMatch(match)).toBe(true);
  });

  it('shows the guest letter for related guest hash matches only when LetterShowForAll is 1', () => {
    expect(
      shouldShowGuestLetterForMatch(
        buildHashMatch('guest1FullName', { letterAddress: 'Juan', letterMessage: 'Welcome.', letterShowForAll: '1' }),
      ),
    ).toBe(true);
    expect(
      shouldShowGuestLetterForMatch(
        buildHashMatch('guest1FullName', { letterAddress: 'Juan', letterMessage: 'Welcome.', letterShowForAll: '' }),
      ),
    ).toBe(false);
  });

  it('hides the guest letter when either letter field is blank', () => {
    expect(shouldShowGuestLetterForMatch(buildHashMatch('fullName', { letterAddress: '' }))).toBe(false);
    expect(shouldShowGuestLetterForMatch(buildHashMatch('fullName', { letterMessage: '   ' }))).toBe(false);
  });
});

function buildHashMatch(
  matchedField: GuestHashMatch['matchedField'],
  rowOverrides: Partial<GuestRow> = {},
): GuestHashMatch {
  const row = { ...guestRow, letterAddress: 'Guest', letterMessage: 'Welcome.', ...rowOverrides };
  return { row, matchedName: row.fullName, matchedField };
}
