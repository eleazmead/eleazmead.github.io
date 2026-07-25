import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  GuestHashMatch,
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from './guest-search.service';
import { SheetsService } from './sheets.service';
import { GuestRow } from './models/guest.model';

const guestRows: GuestRow[] = [
  {
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
  },
];

describe('GuestSearchService', () => {
  let service: GuestSearchService;

  beforeEach(() => {
    service = new GuestSearchService({
      fetchGuestList: () => of(guestRows),
    } as SheetsService);
  });

  it('matches the primary guest by MD5 hash after normalizing case and spacing', () => {
    service.loadGuests().subscribe();

    const result = service.findMatchByHash('  C088E0676A3C180696FB8C708F604FEE  ');

    expect(result?.matchedName).toBe('HELENA BELEN UMANDAL');
    expect(result?.matchedField).toBe('fullName');
    expect(result?.row).toBe(guestRows[0]);
  });

  it('treats blank hash input as no match', () => {
    service.loadGuests().subscribe();

    expect(service.findMatchByHash('')).toBeNull();
    expect(service.findMatchByHash('   ')).toBeNull();
  });

  it('matches a related guest by MD5 hash', () => {
    service.loadGuests().subscribe();

    const result = service.findMatchByHash('b4a608c6cba9fb0dd3ce825f82d2b0af');

    expect(result?.matchedName).toBe('JUAN DELA CRUZ');
    expect(result?.matchedField).toBe('guest1FullName');
  });

  it('shows the guest letter for a primary hash match when letter fields are present', () => {
    const match = buildHashMatch('fullName', {
      letterAddress: 'Helena',
      letterMessage: 'Welcome.',
    });

    expect(shouldShowGuestLetterForMatch(match)).toBe(true);
  });

  it('shows the guest letter for related guest hash matches only when LetterShowForAll is 1', () => {
    const guest1Match = buildHashMatch('guest1FullName', {
      letterAddress: 'Juan',
      letterMessage: 'Welcome.',
      letterShowForAll: '1',
    });
    const guest2Match = buildHashMatch('guest2FullName', {
      letterAddress: 'Maria',
      letterMessage: 'Welcome.',
      letterShowForAll: ' 1 ',
    });
    const hiddenRelatedMatch = buildHashMatch('guest1FullName', {
      letterAddress: 'Juan',
      letterMessage: 'Welcome.',
      letterShowForAll: '',
    });

    expect(shouldShowGuestLetterForMatch(guest1Match)).toBe(true);
    expect(shouldShowGuestLetterForMatch(guest2Match)).toBe(true);
    expect(shouldShowGuestLetterForMatch(hiddenRelatedMatch)).toBe(false);
  });

  it('hides the guest letter when either letter field is blank', () => {
    expect(shouldShowGuestLetterForMatch(buildHashMatch('fullName', { letterAddress: '' }))).toBe(
      false,
    );
    expect(
      shouldShowGuestLetterForMatch(buildHashMatch('fullName', { letterMessage: '   ' })),
    ).toBe(false);
  });
});

function buildHashMatch(
  matchedField: GuestHashMatch['matchedField'],
  rowOverrides: Partial<GuestRow> = {},
): GuestHashMatch {
  const row = {
    ...guestRows[0],
    letterAddress: 'Guest',
    letterMessage: 'Welcome.',
    ...rowOverrides,
  };

  return {
    row,
    matchedName: row.fullName,
    matchedField,
  };
}
