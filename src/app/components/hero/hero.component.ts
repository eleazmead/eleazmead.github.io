import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG } from '../../config/app.config';
import {
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from '../../shared/guest-search.service';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent implements OnInit, AfterViewInit {
  @ViewChild('backdropVideo') private backdropVideo!: ElementRef<HTMLVideoElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly guestSearch = inject(GuestSearchService);
  private readonly ts = inject(TranslationService);

  readonly config = APP_CONFIG;
  readonly hasInvitationHash = signal(false);
  readonly guestHeadlineName = signal<string | null>(null);
  readonly guestNameLoading = signal(false);
  readonly shouldMoveRsvpCta = signal(false);
  readonly headlineTemplate = computed(() => this.ts.t('hero.headline'));
  readonly loadingHeadline = computed(() =>
    this.headlineTemplate().replace('{0}', this.ts.t('hero.loadingGreeting')),
  );
  readonly noInputHeadline = computed(() =>
    this.headlineTemplate().replace('{0}', this.ts.t('hero.noInputGreeting')),
  );
  readonly unpersonalizedHeadline = computed(() =>
    this.headlineTemplate().replace(/^\{0\},\s*/, ''),
  );
  readonly showHeroCta = computed(() => !this.guestNameLoading() && !this.shouldMoveRsvpCta());

  ngOnInit(): void {
    const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
    if (!hashInput) return;

    this.hasInvitationHash.set(true);
    this.guestNameLoading.set(true);
    this.guestSearch.loadGuests().subscribe({
      next: () => {
        const result = this.guestSearch.findMatchByHash(hashInput);
        if (result) {
          const letterAddress = result.row.letterAddress.trim();
          const shouldShowGuestLetter = shouldShowGuestLetterForMatch(result);
          const headlineName = shouldShowGuestLetter
            ? letterAddress
            : result.matchedName.trim().split(/\s+/)[0];

          this.shouldMoveRsvpCta.set(shouldShowGuestLetter);
          if (headlineName) this.guestHeadlineName.set(headlineName);
        }
        this.guestNameLoading.set(false);
      },
      error: () => {
        this.guestNameLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    const video = this.backdropVideo.nativeElement;
    video.muted = true;
    video.play().catch(() => {});
  }

  scrollToRsvp(event: Event): void {
    event.preventDefault();
    const rsvpContainer = document.querySelector<HTMLElement>('#rsvp .rsvp__container');
    rsvpContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    window.setTimeout(() => {
      rsvpContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 450);
  }
}
