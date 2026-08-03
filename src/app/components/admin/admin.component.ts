import { Component, OnInit, inject, signal, computed } from '@angular/core';
import * as XLSX from 'xlsx';
import { SheetsService } from '../../shared/sheets.service';
import { GuestRow, MealChoice, RsvpEntry } from '../../shared/models/guest.model';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';

interface AdminRow {
  guestName: string;
  partyOf: string;
  invitationHash: string;
  meal: MealChoice | null;
  rsvp: 'yes' | 'no' | 'pending';
  dateSubmitted: string;
  dateRaw: string;
}

type SortKey = 'guestName' | 'partyOf' | 'meal' | 'rsvp' | 'dateSubmitted';
interface SortEntry { key: SortKey; dir: 'asc' | 'desc' }

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private static readonly SESSION_KEY = 'eleazmead_admin';
  private static readonly SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  private readonly sheets = inject(SheetsService);
  private readonly ts = inject(TranslationService);

  readonly authenticated = signal(false);
  readonly passwordInput = signal('');
  readonly loginError = signal('');
  readonly loggingIn = signal(false);
  readonly loading = signal(false);
  readonly fetchError = signal('');
  readonly guestRows = signal<GuestRow[]>([]);
  readonly lastRefreshed = signal<Date | null>(null);
  readonly copiedInvitationHash = signal('');
  readonly sortColumns = signal<SortEntry[]>([]);
  readonly clearingCache = signal(false);
  private passwordHash = '';

  readonly adminRows = computed((): AdminRow[] => {
    const rows: AdminRow[] = [];
    for (const g of this.guestRows()) {
      const members = [
        { name: g.fullName, hash: g.fullNameHashMd5 },
        { name: g.guest1Name, hash: g.guest1FullNameHashMd5 },
        { name: g.guest2Name, hash: g.guest2FullNameHashMd5 },
      ].filter((member) => member.name.trim());
      const entries: RsvpEntry[] = g.rsvpRaw?.[g.fullName] ?? [];
      for (const member of members) {
        const entry = entries.find((e) => e.Guest === member.name);
        rows.push({
          guestName: member.name,
          partyOf: g.fullName,
          invitationHash: member.hash.trim(),
          meal: entry?.MealChoice ?? null,
          rsvp: entry ? (entry.RSVP ? 'yes' : 'no') : 'pending',
          dateSubmitted: entry ? this.formatDate(entry.Date) : this.ts.t('admin.noValue'),
          dateRaw: entry?.Date ?? '',
        });
      }
    }
    return rows;
  });

  readonly sortedRows = computed((): AdminRow[] => {
    const rows = [...this.adminRows()];
    const cols = this.sortColumns();
    if (!cols.length) return rows;
    return rows.sort((a, b) => {
      for (const { key, dir } of cols) {
        const cmp = this.compareRows(a, b, key);
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
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

  ngOnInit(): void {
    try {
      const raw = sessionStorage.getItem(AdminComponent.SESSION_KEY);
      if (raw) {
        const { expiresAt } = JSON.parse(raw) as { expiresAt: number };
        if (expiresAt > Date.now()) {
          this.authenticated.set(true);
          this.fetchGuests();
          return;
        }
        sessionStorage.removeItem(AdminComponent.SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(AdminComponent.SESSION_KEY);
    }
  }

  toggleSort(key: SortKey): void {
    const cols = this.sortColumns();
    const idx = cols.findIndex((c) => c.key === key);
    if (idx === -1) {
      this.sortColumns.set([...cols, { key, dir: 'asc' }]);
    } else if (cols[idx].dir === 'asc') {
      const next = [...cols];
      next[idx] = { key, dir: 'desc' };
      this.sortColumns.set(next);
    } else {
      this.sortColumns.set(cols.filter((_, i) => i !== idx));
    }
  }

  sortDirOf(key: SortKey): 'asc' | 'desc' | null {
    return this.sortColumns().find((c) => c.key === key)?.dir ?? null;
  }

  sortPriorityOf(key: SortKey): number {
    const idx = this.sortColumns().findIndex((c) => c.key === key);
    return idx === -1 ? 0 : idx + 1;
  }

  onPasswordChange(value: string): void {
    this.passwordInput.set(value);
    this.loginError.set('');
  }

  async login(): Promise<void> {
    if (this.loggingIn()) return;
    this.loggingIn.set(true);
    this.loginError.set('');
    const hash = await this.sha256(this.passwordInput());
    this.sheets.verifyAdminPassword(hash).subscribe({
      next: ({ authorized }) => {
        this.loggingIn.set(false);
        if (authorized) {
          this.passwordHash = hash;
          sessionStorage.setItem(
            AdminComponent.SESSION_KEY,
            JSON.stringify({ expiresAt: Date.now() + AdminComponent.SESSION_TTL_MS }),
          );
          this.authenticated.set(true);
          this.fetchGuests();
        } else {
          this.loginError.set(this.ts.t('admin.loginError'));
        }
      },
      error: () => {
        this.loggingIn.set(false);
        this.loginError.set(this.ts.t('admin.loginNetworkError'));
      },
    });
  }

  logout(): void {
    sessionStorage.removeItem(AdminComponent.SESSION_KEY);
    this.authenticated.set(false);
    this.guestRows.set([]);
    this.lastRefreshed.set(null);
    this.fetchError.set('');
    this.passwordInput.set('');
    this.loginError.set('');
    this.sortColumns.set([]);
    this.copiedInvitationHash.set('');
    this.passwordHash = '';
  }

  clearCache(): void {
    if (this.clearingCache() || !this.passwordHash) return;
    this.clearingCache.set(true);
    this.sheets.clearGasCache(this.passwordHash).subscribe({
      next: () => {
        this.clearingCache.set(false);
        this.fetchGuests();
      },
      error: () => {
        this.clearingCache.set(false);
      },
    });
  }

  private async sha256(message: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
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

  copyInvitationLink(row: AdminRow): void {
    const link = this.invitationLink(row);
    if (!link) return;

    this.copyToClipboard(link)
      .then(() => {
        this.copiedInvitationHash.set(row.invitationHash);
        window.setTimeout(() => {
          if (this.copiedInvitationHash() === row.invitationHash) {
            this.copiedInvitationHash.set('');
          }
        }, 1800);
      })
      .catch(() => {
        this.fetchError.set(this.ts.t('admin.copyInvitation.error'));
      });
  }

  copyInvitationLabel(row: AdminRow): string {
    if (!row.invitationHash) return this.ts.t('admin.copyInvitation.unavailable');
    if (this.copiedInvitationHash() === row.invitationHash) {
      return this.ts.t('admin.copyInvitation.copied');
    }
    return this.ts.t('admin.copyInvitation.copy');
  }

  private compareRows(a: AdminRow, b: AdminRow, key: SortKey): number {
    switch (key) {
      case 'rsvp': {
        const order = { yes: 0, pending: 1, no: 2 } as const;
        return order[a.rsvp] - order[b.rsvp];
      }
      case 'meal': {
        const order = { beef: 0, fish: 1 } as const;
        const av = a.meal != null ? order[a.meal] : 2;
        const bv = b.meal != null ? order[b.meal] : 2;
        return av - bv;
      }
      case 'dateSubmitted':
        return a.dateRaw.localeCompare(b.dateRaw);
      default:
        return a[key].localeCompare(b[key], undefined, { sensitivity: 'base' });
    }
  }

  private invitationLink(row: AdminRow): string {
    return row.invitationHash ? `${window.location.origin}/${row.invitationHash}` : '';
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('Clipboard copy failed');
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
