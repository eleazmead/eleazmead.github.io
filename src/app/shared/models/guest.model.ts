export interface GuestRow {
  rowIndex: number; // 1-based sheet row number
  fullName: string;
  guest1Name: string;
  guest2Name: string;
  rsvpRaw: RsvpRawPayload | null;
  rsvpTotal: number | null;
  rsvpBeefCount: number | null;
  rsvpFishCount: number | null;
  rsvpSubmittedAt: string | null;
  rsvpSubmittedBy: string | null;
  fullNameHashMd5: string;
  guest1FullNameHashMd5: string;
  guest2FullNameHashMd5: string;
  letterAddress: string;
  letterMessage: string;
  letterShowForAll: string;
  letterSignedBy: string;
  ipAddress: string;
  lastAccessedAt: string;
  userAgent: string;
}

export type MealChoice = 'beef' | 'fish';

export type RsvpEntry = {
  Guest: string;
  RSVP: boolean;
  MealChoice?: MealChoice; // only present when RSVP is true
  Date: string; // ISO 8601 + 08:00
};

export type RsvpRawPayload = {
  [initiatorFullName: string]: RsvpEntry[];
};

export interface RsvpSubmission {
  initiatorFullName: string;
  entries: RsvpEntry[];
  rowIndex: number;
  rsvpTotal: number;
  rsvpBeefCount: number;
  rsvpFishCount: number;
  rsvpSubmittedAt: string;
  mergedRsvpRaw?: RsvpRawPayload;
}
