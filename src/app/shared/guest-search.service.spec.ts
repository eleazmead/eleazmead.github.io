import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { GuestSearchService } from './guest-search.service';
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
  });
});
