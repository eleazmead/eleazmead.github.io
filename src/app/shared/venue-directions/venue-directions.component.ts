import { Component, computed, inject, input } from '@angular/core';
import { APP_CONFIG } from '../../config/app.config';
import { TranslatePipe } from '../translate.pipe';
import { TranslationService } from '../translation.service';
import { MRT_CODE_IMAGES } from './mrt-code-images';

type VenueId = keyof typeof APP_CONFIG.transport.venues;
type MrtLine = keyof typeof APP_CONFIG.transport.mrtLineColors;

// "How to get there" for a venue: nearest MRT stations (official line colours and codes) and the
// nearest bus stop. Shared by the website Venues section and the exported Timing & Venues page, so it
// sizes itself in `em` (the parent sets the font size) and uses plain colours (html2canvas-safe).
@Component({
  selector: 'app-venue-directions',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './venue-directions.component.html',
  styleUrl: './venue-directions.component.scss',
})
export class VenueDirectionsComponent {
  private readonly ts = inject(TranslationService);

  readonly venueId = input.required<VenueId>();
  readonly directions = computed(() => APP_CONFIG.transport.venues[this.venueId()]);

  // The badge image for a station code, e.g. { line: 'DT', number: 21 } -> DT 21.
  chip(code: { line: MrtLine; number: number }): { uri: string; ratio: number } {
    return MRT_CODE_IMAGES[`${code.line}${code.number}`];
  }

  walkText(minutes: number): string {
    return this.ts.t('venues.directions.walk').replace('{0}', String(minutes));
  }

  exitText(exit: string): string {
    return this.ts.t('venues.directions.exit').replace('{0}', exit);
  }

  busStopText(name: string, code: string): string {
    return this.ts.t('venues.directions.busStop').replace('{0}', name).replace('{1}', code);
  }
}
