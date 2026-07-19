import { Component, inject, signal, computed } from '@angular/core';
import * as XLSX from 'xlsx';
import { SheetsService } from '../../shared/sheets.service';
import { GuestRow, MealChoice, RsvpEntry } from '../../shared/models/guest.model';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';

interface AdminRow {
  guestName: string;
  partyOf: string;
  meal: MealChoice | null;
  rsvp: 'yes' | 'no' | 'pending';
  dateSubmitted: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly sheets = inject(SheetsService);
  private readonly ts = inject(TranslationService);

  readonly authenticated = signal(false);
  readonly passwordInput = signal('');
  readonly loginError = signal('');
  readonly loading = signal(false);
  readonly fetchError = signal('');
  readonly guestRows = signal<GuestRow[]>([]);
  readonly lastRefreshed = signal<Date | null>(null);

  readonly adminRows = computed((): AdminRow[] => {
    const rows: AdminRow[] = [];
    for (const g of this.guestRows()) {
      const members = [g.fullName, g.guest1Name, g.guest2Name].filter((n) => n.trim());
      const entries: RsvpEntry[] = g.rsvpRaw?.[g.fullName] ?? [];
      for (const member of members) {
        const entry = entries.find((e) => e.Guest === member);
        rows.push({
          guestName: member,
          partyOf: g.fullName,
          meal: entry?.MealChoice ?? null,
          rsvp: entry ? (entry.RSVP ? 'yes' : 'no') : 'pending',
          dateSubmitted: entry ? this.formatDate(entry.Date) : this.ts.t('admin.noValue'),
        });
      }
    }
    return rows;
  });

  readonly summary = computed(() => {
    const rows = this.adminRows();
    return {
      total: rows.length,
      attending: rows.filter((r) => r.rsvp === 'yes').length,
      declined: rows.filter((r) => r.rsvp === 'no').length,
      pending: rows.filter((r) => r.rsvp === 'pending').length,
      beef: rows.filter((r) => r.rsvp === 'yes' && r.meal === 'beef').length,
      fish: rows.filter((r) => r.rsvp === 'yes' && r.meal === 'fish').length,
    };
  });

  onPasswordChange(value: string): void {
    this.passwordInput.set(value);
    this.loginError.set('');
  }

  login(): void {
    if (this.passwordInput() === environment.adminPassword) {
      this.authenticated.set(true);
      this.fetchGuests();
    } else {
      this.loginError.set(this.ts.t('admin.loginError'));
    }
  }

  fetchGuests(): void {
    this.loading.set(true);
    this.fetchError.set('');
    this.sheets.fetchGuestList().subscribe({
      next: (rows) => {
        this.guestRows.set(rows);
        this.lastRefreshed.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.fetchError.set(this.ts.t('admin.fetchError'));
        this.loading.set(false);
      },
    });
  }

  exportToExcel(): void {
    const data = this.adminRows().map((r) => ({
      [this.ts.t('admin.table.guestName')]: r.guestName,
      [this.ts.t('admin.table.partyOf')]: r.partyOf,
      [this.ts.t('admin.table.mealChoice')]: this.mealLabel(r.meal),
      [this.ts.t('admin.table.rsvp')]: this.rsvpLabel(r.rsvp),
      [this.ts.t('admin.table.dateSubmitted')]: r.dateSubmitted,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.ts.t('admin.exportSheetName'));
    const now = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    XLSX.writeFile(wb, `${this.ts.t('admin.exportFilenamePrefix')}_${now}.xlsx`);
  }

  mealLabel(meal: AdminRow['meal']): string {
    return meal ? this.ts.t(`mainCourse.options.${meal}.label`) : this.ts.t('admin.noValue');
  }

  rsvpLabel(status: AdminRow['rsvp']): string {
    return this.ts.t(`admin.rsvpStatus.${status}`);
  }

  private formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-SG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
