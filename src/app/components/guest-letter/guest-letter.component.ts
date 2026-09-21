import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GuestRow } from '../../shared/models/guest.model';
import {
  GuestHashMatchField,
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from '../../shared/guest-search.service';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { PolaroidPhotoComponent } from '../../shared/polaroid-photo/polaroid-photo.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';

// Matches the desktop layout breakpoint in guest-letter.component.scss.
const DESKTOP_QUERY = '(min-width: 1024px)';
// Resting tilt of the taped polaroid. Desktop leans clockwise off the top-right
// corner of the paper; mobile leans slightly the other way above the salutation.
const DESKTOP_PHOTO_TILT_DEG = 4.5;
const MOBILE_PHOTO_TILT_DEG = -3.5;

@Component({
  selector: 'app-guest-letter',
  standalone: true,
  imports: [FadeUpDirective, PolaroidPhotoComponent, TranslatePipe],
  templateUrl: './guest-letter.component.html',
  styleUrl: './guest-letter.component.scss',
})
export class GuestLetterComponent implements OnInit, OnDestroy {
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
  // Only http(s) links are accepted: the value comes straight from a sheet cell
  // and is bound to an <img src>. A blank cell means no polaroid at all.
  readonly photoUrl = computed(() => {
    const url = this.matchedRow()?.imageUrl.trim() ?? '';
    return /^https?:\/\//i.test(url) ? url : '';
  });
  private readonly isDesktop = signal(false);
  readonly photoTiltDeg = computed(() =>
    this.isDesktop() ? DESKTOP_PHOTO_TILT_DEG : MOBILE_PHOTO_TILT_DEG,
  );
  private desktopQuery?: MediaQueryList;
  private readonly onDesktopChange = (event: MediaQueryListEvent) =>
    this.isDesktop.set(event.matches);
  readonly signatureName = computed(
    () => this.matchedRow()?.letterSignedBy.trim() || this.ts.t('guestLetter.coupleName'),
  );

  ngOnInit(): void {
    if (typeof window.matchMedia === 'function') {
      this.desktopQuery = window.matchMedia(DESKTOP_QUERY);
      this.isDesktop.set(this.desktopQuery.matches);
      this.desktopQuery.addEventListener('change', this.onDesktopChange);
    }

    const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
    if (!hashInput) return;

    this.guestSearch.findByHash(hashInput).subscribe({
      next: (result) => {
        this.matchedRow.set(result?.row ?? null);
        this.matchedField.set(result?.matchedField ?? null);
      },
      error: () => {
        this.matchedRow.set(null);
        this.matchedField.set(null);
      },
    });
  }

  ngOnDestroy(): void {
    this.desktopQuery?.removeEventListener('change', this.onDesktopChange);
  }

  scrollToRsvp(event: Event): void {
    event.preventDefault();
    document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
