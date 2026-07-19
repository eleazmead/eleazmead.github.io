import { Component, signal } from '@angular/core';
import { TranslatePipe } from '../../shared/translate.pipe';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { APP_CONFIG } from '../../config/app.config';

const VENUE_IDS = ['church', 'reception'] as const;
type VenueId = (typeof VENUE_IDS)[number];

@Component({
  selector: 'app-venues',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './venues.component.html',
  styleUrl: './venues.component.scss',
})
export class VenuesComponent {
  readonly venueIds = VENUE_IDS;
  readonly failedPhotos = signal<Set<VenueId>>(new Set());

  textKey(venueId: VenueId, field: 'name' | 'description' | 'address'): string {
    return `venues.items.${venueId}.${field}`;
  }

  photoUrl(venueId: VenueId): string {
    return APP_CONFIG.assets.venuePhotos[venueId];
  }

  shouldShowPhoto(venueId: VenueId): boolean {
    return Boolean(this.photoUrl(venueId)) && !this.failedPhotos().has(venueId);
  }

  markPhotoFailed(venueId: VenueId): void {
    const failedPhotos = new Set(this.failedPhotos());
    failedPhotos.add(venueId);
    this.failedPhotos.set(failedPhotos);
  }
}
