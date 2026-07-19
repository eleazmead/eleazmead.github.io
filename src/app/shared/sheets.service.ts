import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { SHEETS_CONFIG } from '../config/sheets.config';
import { GuestRow, RsvpRawPayload, RsvpSubmission } from './models/guest.model';
import { buildEventString } from './utils/rsvp.utils';

@Injectable({ providedIn: 'root' })
export class SheetsService {
  private http = inject(HttpClient);

  fetchGuestList(): Observable<GuestRow[]> {
    const { spreadsheetId, apiKey, ranges } = SHEETS_CONFIG;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${ranges.guestList}?key=${apiKey}`;
    return this.http.get<{ values: string[][] }>(url).pipe(
      map((res) => {
        const rows = res.values ?? [];
        return rows.slice(1).map((row, i) => this.parseRow(row, i + 2));
      }),
    );
  }

  submitRsvp(submission: RsvpSubmission): Observable<{ status: string }> {
    const payload = {
      action: 'updateRsvp',
      rowIndex: submission.rowIndex,
      rsvpRaw: JSON.stringify(
        submission.mergedRsvpRaw ?? { [submission.initiatorFullName]: submission.entries },
      ),
      rsvpBeefCount: submission.rsvpBeefCount,
      rsvpFishCount: submission.rsvpFishCount,
      rsvpTotal: submission.rsvpTotal,
      rsvpSubmittedAt: submission.rsvpSubmittedAt,
      rsvpSubmittedBy: submission.initiatorFullName,
      log: {
        id: crypto.randomUUID(),
        name: submission.initiatorFullName,
        fullName: submission.initiatorFullName,
        event: buildEventString(submission),
        count: submission.entries.filter((e) => e.RSVP).length,
        createdAt: submission.rsvpSubmittedAt,
      },
    };

    return this.http.post<{ status: string }>(SHEETS_CONFIG.gasWebAppUrl, JSON.stringify(payload), {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  private parseRow(row: string[], rowIndex: number): GuestRow {
    const cols = SHEETS_CONFIG.guestListColumns;
    const rsvpRawStr = row[cols.rsvpRaw] ?? '';
    let rsvpRaw: RsvpRawPayload | null = null;
    if (rsvpRawStr.trim()) {
      try {
        rsvpRaw = JSON.parse(rsvpRawStr) as RsvpRawPayload;
      } catch {
        rsvpRaw = null;
      }
    }
    return {
      rowIndex,
      fullName: row[cols.fullName] ?? '',
      guest1Name: row[cols.guest1Name] ?? '',
      guest2Name: row[cols.guest2Name] ?? '',
      rsvpRaw,
      rsvpTotal: row[cols.rsvpTotal] ? Number(row[cols.rsvpTotal]) : null,
      rsvpBeefCount: row[cols.rsvpBeefCount] ? Number(row[cols.rsvpBeefCount]) : null,
      rsvpFishCount: row[cols.rsvpFishCount] ? Number(row[cols.rsvpFishCount]) : null,
      rsvpSubmittedAt: row[cols.rsvpSubmittedAt] ?? null,
      rsvpSubmittedBy: row[cols.rsvpSubmittedBy] ?? null,
      fullNameHashMd5: row[cols.fullNameHashMd5] ?? '',
      guest1FullNameHashMd5: row[cols.guest1FullNameHashMd5] ?? '',
      guest2FullNameHashMd5: row[cols.guest2FullNameHashMd5] ?? '',
    };
  }
}
