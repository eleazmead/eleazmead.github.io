import { Component } from '@angular/core';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

const ENTOURAGE_ITEMS = ['groomsParents', 'bridesParents', 'witnesses', 'ringBearer'] as const;
type EntourageItemId = (typeof ENTOURAGE_ITEMS)[number];

@Component({
  selector: 'app-with-gratitude',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './with-gratitude.component.html',
  styleUrl: './with-gratitude.component.scss',
})
export class WithGratitudeComponent {
  readonly itemIds = ENTOURAGE_ITEMS;

  textKey(itemId: EntourageItemId, field: 'role' | 'names'): string {
    return `withGratitude.items.${itemId}.${field}`;
  }
}
