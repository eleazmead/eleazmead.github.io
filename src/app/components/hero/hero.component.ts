import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG } from '../../config/app.config';
import { GuestSearchService } from '../../shared/guest-search.service';
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
  readonly guestFirstName = signal<string | null>(null);
  readonly guestNameLoading = signal(false);
  readonly headlineTemplate = computed(() => this.ts.t('hero.headline'));
  readonly loadingHeadline = computed(() =>
    this.headlineTemplate().replace('{0}', this.ts.t('hero.loadingGreeting')),
  );
  readonly unpersonalizedHeadline = computed(() =>
    this.headlineTemplate().replace(/^\{0\},\s*/, ''),
  );

  ngOnInit(): void {
    const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
    if (!hashInput) return;

    this.guestNameLoading.set(true);
    this.guestSearch.loadGuests().subscribe({
      next: () => {
        const result = this.guestSearch.findMatchByHash(hashInput);
        const firstName = result?.matchedName.trim().split(/\s+/)[0];
        if (firstName) this.guestFirstName.set(firstName);
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
    document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
