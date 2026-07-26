import { Component } from '@angular/core';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-where-to-stay',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './where-to-stay.component.html',
  styleUrl: './where-to-stay.component.scss',
})
export class WhereToStayComponent {
  readonly hotelGroups = APP_CONFIG.whereToStay.hotelGroups;

  hotelGroupHeadingKey(groupId: string): string {
    return `whereToStay.hotelGroups.${groupId}.heading`;
  }

  hotelNameKey(groupId: string, hotelId: string): string {
    return `whereToStay.hotelGroups.${groupId}.hotels.${hotelId}`;
  }
}
