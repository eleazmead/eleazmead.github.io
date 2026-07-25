import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GuestRow } from '../../shared/models/guest.model';
import {
  GuestHashMatchField,
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from '../../shared/guest-search.service';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';

@Component({
  selector: 'app-guest-letter',
  standalone: true,
  imports: [FadeUpDirective, TranslatePipe],
  templateUrl: './guest-letter.component.html',
  styleUrl: './guest-letter.component.scss',
})
export class GuestLetterComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly guestSearch = inject(GuestSearchService);
  private readonly ts = inject(TranslationService);

  readonly matchedRow = signal<GuestRow | null>(null);
  readonly matchedField = signal<GuestHashMatchField | null>(null);
  readonly shouldShowLetter = computed(() => {
    const row = this.matchedRow();
    const matchedField = this.matchedField();
    if (!row || !matchedField) return false;

    return shouldShowGuestLetterForMatch({ row, matchedField, matchedName: '' });
  });
  readonly signatureName = computed(
    () => this.matchedRow()?.letterSignedBy.trim() || this.ts.t('guestLetter.coupleName'),
  );

  ngOnInit(): void {
    const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
    if (!hashInput) return;

    this.guestSearch.loadGuests().subscribe({
      next: () => {
        const result = this.guestSearch.findMatchByHash(hashInput);
        this.matchedRow.set(result?.row ?? null);
        this.matchedField.set(result?.matchedField ?? null);
      },
      error: () => {
        this.matchedRow.set(null);
        this.matchedField.set(null);
      },
    });
  }

  scrollToRsvp(event: Event): void {
    event.preventDefault();
    document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
