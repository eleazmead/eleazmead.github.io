import { Component } from '@angular/core';
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
import { FooterComponent } from '../footer/footer.component';
import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
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
    FooterComponent,
    LanguageToggleComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
