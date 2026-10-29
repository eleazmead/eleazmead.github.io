import { Component } from '@angular/core';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';
import { GRATITUDE_GROUPS, GratitudeItemId } from '../../shared/gratitude-groups';

@Component({
  selector: 'app-with-gratitude',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './with-gratitude.component.html',
  styleUrl: './with-gratitude.component.scss',
})
export class WithGratitudeComponent {
  readonly groups = GRATITUDE_GROUPS;

  textKey(itemId: GratitudeItemId, field: 'role' | 'names'): string {
    return `withGratitude.items.${itemId}.${field}`;
  }
}
