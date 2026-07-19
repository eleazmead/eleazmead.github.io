import { Component } from '@angular/core';
import { HeroComponent } from '../hero/hero.component';
import { OurStoryComponent } from '../our-story/our-story.component';
import { VenuesComponent } from '../venues/venues.component';
import { RsvpComponent } from '../rsvp/rsvp.component';
import { WeddingTimelineComponent } from '../wedding-timeline/wedding-timeline.component';
import { WhatToWearComponent } from '../what-to-wear/what-to-wear.component';
import { GiftRegistryComponent } from '../gift-registry/gift-registry.component';
import { QuestionsAnswersComponent } from '../questions-answers/questions-answers.component';
import { FooterComponent } from '../footer/footer.component';
import { LanguageToggleComponent } from '../../shared/language-toggle/language-toggle.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeroComponent,
    OurStoryComponent,
    VenuesComponent,
    RsvpComponent,
    WeddingTimelineComponent,
    WhatToWearComponent,
    GiftRegistryComponent,
    QuestionsAnswersComponent,
    FooterComponent,
    LanguageToggleComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
