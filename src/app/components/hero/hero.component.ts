import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
export class HeroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('backdropVideo') private backdropVideo!: ElementRef<HTMLVideoElement>;
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly route = inject(ActivatedRoute);
  private readonly guestSearch = inject(GuestSearchService);
  private readonly ts = inject(TranslationService);
  private visibilityObserver?: IntersectionObserver;

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

    // The backdrop is purely decorative and only visible while the hero
    // section itself is on screen - once the user scrolls past it, the
    // <video> keeps decoding frames in the background regardless (browsers
    // don't auto-pause off-screen video in a normal scrolling page), which
    // costs real CPU/GPU work on mobile for zero visual benefit and
    // competes with everything else on the page, including the Our Story
    // polaroid scroll physics further down. Pausing while off-screen and
    // resuming on return removes that cost entirely when it can't matter.
    if (typeof IntersectionObserver === 'undefined') return;
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 },
    );
    this.visibilityObserver.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
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
