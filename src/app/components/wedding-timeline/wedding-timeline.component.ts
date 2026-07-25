import { Component } from '@angular/core';
import { TranslatePipe } from '../../shared/translate.pipe';
import { FadeUpDirective } from '../../shared/fade-up.directive';

const WEDDING_TIMELINE_EVENT_IDS = [
  'partyAssembles',
  'ceremonyBegins',
  'massConcludes',
  'break',
  'guestArrival',
  'dinnerBegins',
  'sde',
  'receptionConcludes',
] as const;

type WeddingTimelineEventId = (typeof WEDDING_TIMELINE_EVENT_IDS)[number];

@Component({
  selector: 'app-wedding-timeline',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './wedding-timeline.component.html',
  styleUrl: './wedding-timeline.component.scss',
})
export class WeddingTimelineComponent {
  readonly eventIds = WEDDING_TIMELINE_EVENT_IDS;

  textKey(eventId: WeddingTimelineEventId, field: 'time' | 'title' | 'description'): string {
    return `weddingTimeline.events.${eventId}.${field}`;
  }
}
