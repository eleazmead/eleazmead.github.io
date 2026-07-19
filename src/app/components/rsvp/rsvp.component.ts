import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { GuestSearchService } from '../../shared/guest-search.service';
import { SheetsService } from '../../shared/sheets.service';
import { APP_CONFIG } from '../../config/app.config';
import { GuestRow, RsvpEntry, MealChoice } from '../../shared/models/guest.model';
import { nowSGT } from '../../shared/utils/date.utils';

export type RsvpFlowState =
  | 'idle'
  | 'no_invitation_link'
  | 'searching'
  | 'found'
  | 'confirming'
  | 'submitting'
  | 'success'
  | 'not_found'
  | 'error';

type Selection = { attending: boolean; included: boolean };

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './rsvp.component.html',
  styleUrl: './rsvp.component.scss',
})
export class RsvpComponent implements OnInit {
  private readonly guestSearch = inject(GuestSearchService);
  private readonly sheets = inject(SheetsService);
  private readonly ts = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);

  readonly config = APP_CONFIG;
  readonly whatsappUrl = APP_CONFIG.contacts.whatsappUrl;
  readonly state = signal<RsvpFlowState>('idle');
  readonly rsvpHashInput = signal('');
  readonly hasInvitationHash = computed(() => this.rsvpHashInput().trim().length > 0);
  readonly matchedRow = signal<GuestRow | null>(null);
  readonly initiatorName = signal('');
  readonly relatedNames = signal<string[]>([]);
  readonly selections = signal<Map<string, Selection>>(new Map());
  readonly mealSelections = signal<Map<string, MealChoice>>(new Map());
  readonly mealError = signal('');
  readonly errorMessage = signal('');
  readonly mainCourseOptions = APP_CONFIG.mealChoices.options;

  /** True only when the current initiator already has an entry in the primary guest's entries array. */
  readonly initiatorAlreadyRsvped = computed(() => {
    const row = this.matchedRow();
    const initiator = this.initiatorName();
    if (!row?.rsvpRaw || !initiator) return false;
    const entries = row.rsvpRaw[row.fullName] ?? [];
    return entries.some((e) => e.Guest === initiator);
  });

  /** Map of guest name → RSVP boolean for related guests who already have an entry (excluding the current initiator). */
  readonly respondedNames = computed((): Map<string, boolean> => {
    const row = this.matchedRow();
    const initiator = this.initiatorName();
    if (!row?.rsvpRaw) return new Map();
    const entries = row.rsvpRaw[row.fullName] ?? [];
    const result = new Map<string, boolean>();
    for (const entry of entries) {
      if (entry.Guest !== initiator) result.set(entry.Guest, entry.RSVP);
    }
    return result;
  });

  readonly alreadyRsvpedMessage = computed(() => {
    const row = this.matchedRow();
    const initiator = this.initiatorName();
    if (!row?.rsvpRaw || !initiator) return '';
    const entries = row.rsvpRaw[row.fullName] ?? [];
    const myEntry = entries.find((e) => e.Guest === initiator);
    const submittedBy = row.rsvpSubmittedBy ?? Object.keys(row.rsvpRaw)[0] ?? initiator;
    const date = this.formatDate(myEntry?.Date ?? row.rsvpSubmittedAt ?? '');
    return this.ts
      .t('rsvp.alreadyRsvped.message')
      .replace('{initiator}', submittedBy)
      .replace('{date}', date);
  });

  ngOnInit(): void {
    const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
    this.rsvpHashInput.set(hashInput);

    if (!hashInput) {
      this.state.set('no_invitation_link');
      return;
    }

    this.searchByHash(hashInput);
  }

  private searchByHash(hashInput: string): void {
    if (!hashInput.trim()) {
      this.state.set('no_invitation_link');
      return;
    }

    this.state.set('searching');

    this.guestSearch.loadGuests().subscribe({
      next: () => {
        const result = this.guestSearch.findMatchByHash(hashInput);
        if (!result) {
          this.state.set('not_found');
          return;
        }

        this.prepareMatchedGuest(result.row, result.matchedName);
        this.state.set('found');
      },
      error: () => {
        this.errorMessage.set(this.ts.t('rsvp.errorMessage'));
        this.state.set('error');
      },
    });
  }

  private prepareMatchedGuest(row: GuestRow, matchedName: string): void {
    this.matchedRow.set(row);
    this.initiatorName.set(matchedName);

    const allGroupNames = [row.fullName, row.guest1Name, row.guest2Name].filter((n) => n.trim());
    const related = allGroupNames.filter((n) => n !== matchedName);
    this.relatedNames.set(related);

    const map = new Map<string, Selection>();
    map.set(matchedName, { attending: true, included: true });
    for (const name of related) {
      map.set(name, { attending: true, included: false });
    }
    this.selections.set(map);
    this.mealSelections.set(new Map());
    this.mealError.set('');
  }

  toggleInclude(name: string): void {
    const map = new Map(this.selections());
    const current = map.get(name);
    if (current) map.set(name, { ...current, included: !current.included });
    this.selections.set(map);
  }

  setAttending(name: string, attending: boolean): void {
    const map = new Map(this.selections());
    const current = map.get(name);
    if (current) map.set(name, { ...current, attending });
    this.selections.set(map);
  }

  setMealChoice(name: string, choice: MealChoice): void {
    const map = new Map(this.mealSelections());
    map.set(name, choice);
    this.mealSelections.set(map);
    this.mealError.set('');
  }

  getMealChoice(name: string): MealChoice | undefined {
    return this.mealSelections().get(name);
  }

  onReview(): void {
    const hasIncluded = Array.from(this.selections().values()).some((v) => v.included);
    if (!hasIncluded) return;

    const allAttendingHaveMeal = Array.from(this.selections().entries())
      .filter(([, v]) => v.included && v.attending)
      .every(([name]) => this.mealSelections().has(name));
    if (!allAttendingHaveMeal) {
      this.mealError.set(this.ts.t('mainCourse.required'));
      return;
    }

    this.state.set('confirming');
  }

  onBackToFound(): void {
    this.state.set('found');
  }

  onSubmit(): void {
    const row = this.matchedRow();
    if (!row) return;
    this.state.set('submitting');

    const timestamp = nowSGT();
    const entries: RsvpEntry[] = Array.from(this.selections().entries())
      .filter(([, v]) => v.included)
      .map(([name, v]) => ({
        Guest: name,
        RSVP: v.attending,
        ...(v.attending && this.mealSelections().has(name)
          ? { MealChoice: this.mealSelections().get(name) }
          : {}),
        Date: timestamp,
      }));

    const initiator = this.initiatorName();
    const mainKey = row.fullName;
    const existingEntries = row.rsvpRaw?.[mainKey] ?? [];
    const newGuestNames = new Set(entries.map((e) => e.Guest));
    const preserved = existingEntries.filter((e) => !newGuestNames.has(e.Guest));
    const mergedEntries = [...preserved, ...entries];
    const mergedRsvpRaw = { [mainKey]: mergedEntries };
    const rsvpTotal = mergedEntries.filter((e) => e.RSVP).length;
    const rsvpBeefCount = mergedEntries.filter((e) => e.RSVP && e.MealChoice === 'beef').length;
    const rsvpFishCount = mergedEntries.filter((e) => e.RSVP && e.MealChoice === 'fish').length;

    this.sheets
      .submitRsvp({
        initiatorFullName: initiator,
        entries,
        rowIndex: row.rowIndex,
        rsvpTotal,
        rsvpBeefCount,
        rsvpFishCount,
        rsvpSubmittedAt: timestamp,
        mergedRsvpRaw,
      })
      .subscribe({
        next: () => this.state.set('success'),
        error: () => {
          this.errorMessage.set(this.ts.t('rsvp.errorMessage'));
          this.state.set('error');
        },
      });
  }

  retryFromError(): void {
    this.errorMessage.set('');
    this.searchByHash(this.rsvpHashInput());
  }

  getSelectionFor(name: string): Selection | undefined {
    return this.selections().get(name);
  }

  getIncludedEntries(): [string, Selection][] {
    return Array.from(this.selections().entries()).filter(([, v]) => v.included);
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  }

  mealLabel(choice: MealChoice): string {
    return this.ts.t(`mainCourse.options.${choice}.label`);
  }

  mealDescription(choice: MealChoice): string {
    return this.ts.t(`mainCourse.options.${choice}.description`);
  }
}
