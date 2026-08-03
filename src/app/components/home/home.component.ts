import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { HeroComponent } from '../hero/hero.component';
import { GuestLetterComponent } from '../guest-letter/guest-letter.component';
import { OurStoryComponent } from '../our-story/our-story.component';
import { VenuesComponent } from '../venues/venues.component';
import { RsvpComponent } from '../rsvp/rsvp.component';
import { WeddingTimelineComponent } from '../wedding-timeline/wedding-timeline.component';
import { WhatToWearComponent } from '../what-to-wear/what-to-wear.component';
import { WhereToStayComponent } from '../where-to-stay/where-to-stay.component';
import { GiftRegistryComponent } from '../gift-registry/gift-registry.component';
import { QuestionsAnswersComponent } from '../questions-answers/questions-answers.component';
import { MadeWithLoveComponent } from '../made-with-love/made-with-love.component';
import { FooterComponent } from '../footer/footer.component';
import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgIf,
    HeroComponent,
    GuestLetterComponent,
    OurStoryComponent,
    VenuesComponent,
    RsvpComponent,
    WeddingTimelineComponent,
    WhatToWearComponent,
    WhereToStayComponent,
    GiftRegistryComponent,
    QuestionsAnswersComponent,
    MadeWithLoveComponent,
    FooterComponent,
    LanguageToggleComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  // Facebook/Messenger/Instagram in-app browsers inject these UA strings.
  // Their WebViews block cross-origin requests to script.google.com, which
  // breaks all GAS calls. Show a banner prompting users to open in Safari/Chrome.
  readonly isInAppBrowser = signal(
    /FBAN|FBAV|FBIOS|FBSS|Instagram|MessengerForiOS/i.test(navigator.userAgent),
  );
  readonly bannerDismissed = signal(false);

  dismissBanner(): void {
    this.bannerDismissed.set(true);
  }
}
