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
    const body = JSON.stringify({ action: 'getGuestList' });
    return this.http
      .post<{ values: string[][] }>(SHEETS_CONFIG.gasWebAppUrl, body, {
        headers: { 'Content-Type': 'text/plain' },
      })
      .pipe(
        map((res) => {
          const rows = res.values ?? [];
          return rows.slice(1).map((row, i) => this.parseRow(row, i + 2));
        }),
      );
  }

  fetchGuestByHash(hash: string): Observable<GuestRow | null> {
    const body = JSON.stringify({ action: 'getGuestByHash', hash });
    return this.http
      .post<{ found: boolean; row?: string[]; rowIndex?: number }>(
        SHEETS_CONFIG.gasWebAppUrl,
        body,
        { headers: { 'Content-Type': 'text/plain' } },
      )
      .pipe(
        map((res) => {
          if (!res.found || !res.row) return null;
          return this.parseRow(res.row, res.rowIndex ?? 0);
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

  verifyAdminPassword(passwordHash: string): Observable<{ authorized: boolean }> {
    const body = JSON.stringify({ action: 'verifyAdmin', passwordHash });
    return this.http.post<{ authorized: boolean }>(SHEETS_CONFIG.gasWebAppUrl, body, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  private parseRow(row: unknown[], rowIndex: number): GuestRow {
    const cols = SHEETS_CONFIG.guestListColumns;
    const str = (v: unknown): string => (v == null ? '' : String(v));
    const rsvpRawStr = str(row[cols.rsvpRaw]);
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
      fullName: str(row[cols.fullName]),
      guest1Name: str(row[cols.guest1Name]),
      guest2Name: str(row[cols.guest2Name]),
      rsvpRaw,
      rsvpTotal: row[cols.rsvpTotal] ? Number(row[cols.rsvpTotal]) : null,
      rsvpBeefCount: row[cols.rsvpBeefCount] ? Number(row[cols.rsvpBeefCount]) : null,
      rsvpFishCount: row[cols.rsvpFishCount] ? Number(row[cols.rsvpFishCount]) : null,
      rsvpSubmittedAt: row[cols.rsvpSubmittedAt] != null ? str(row[cols.rsvpSubmittedAt]) : null,
      rsvpSubmittedBy: row[cols.rsvpSubmittedBy] != null ? str(row[cols.rsvpSubmittedBy]) : null,
      fullNameHashMd5: str(row[cols.fullNameHashMd5]),
      guest1FullNameHashMd5: str(row[cols.guest1FullNameHashMd5]),
      guest2FullNameHashMd5: str(row[cols.guest2FullNameHashMd5]),
      letterAddress: str(row[cols.letterAddress]),
      letterMessage: str(row[cols.letterMessage]),
      letterShowForAll: str(row[cols.letterShowForAll]),
      letterSignedBy: str(row[cols.letterSignedBy]),
    };
  }
}
