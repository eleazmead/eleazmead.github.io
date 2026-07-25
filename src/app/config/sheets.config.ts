import { environment } from '../../environments/environment';

export const SHEETS_CONFIG = {
  spreadsheetId: environment.sheetsSpreadsheetId,
  apiKey: environment.sheetsApiKey,
  gasWebAppUrl: environment.gasWebAppUrl,
  ranges: {
    guestList: 'GuestList!A:P',
    log: 'Log!A:F',
  },
  guestListColumns: {
    fullName: 0, // A
    guest1Name: 1, // B
    guest2Name: 2, // C
    rsvpRaw: 3, // D
    rsvpTotal: 4, // E
    rsvpBeefCount: 5, // F
    rsvpFishCount: 6, // G
    rsvpSubmittedAt: 7, // H
    rsvpSubmittedBy: 8, // I
    fullNameHashMd5: 9, // J
    guest1FullNameHashMd5: 10, // K
    guest2FullNameHashMd5: 11, // L
    letterAddress: 12, // M
    letterMessage: 13, // N
    letterShowForAll: 14, // O
    letterSignedBy: 15, // P
  },
  logColumns: {
    id: 0,
    name: 1,
    event: 2,
    count: 3,
    createdAt: 4,
  },
} as const;
