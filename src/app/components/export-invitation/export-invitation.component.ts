import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../config/app.config';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslatePipe } from '../../shared/translate.pipe';
import { TranslationService } from '../../shared/translation.service';
import { cloudinaryResized } from '../../shared/utils/cloudinary.utils';
import { GuestRow, MealChoice, RsvpEntry } from '../../shared/models/guest.model';
import {
  GuestHashMatchField,
  GuestSearchService,
  shouldShowGuestLetterForMatch,
} from '../../shared/guest-search.service';
import { InvitationExportService } from '../../shared/invitation-export.service';
import { StoryManifestEntry, groupStoryPhotosByPrefix } from '../../shared/utils/story-photo.utils';
import {
  STORY_TIMELINE_ITEMS,
  StoryTimelineItem,
  StoryTimelineItemId,
} from '../our-story/our-story.component';
import {
  WEDDING_TIMELINE_EVENT_IDS,
  WeddingTimelineEventId,
} from '../wedding-timeline/wedding-timeline.component';

type ExportFormat = 'images' | 'pdf';
// Longest side for photos used in the export pages.
const MAX_PHOTO_SIDE = 900;

type ExportStatus = 'idle' | 'preparing' | 'error';
type GiftQrCodeId = keyof typeof APP_CONFIG.assets.giftQrCodes;
type QuestionAnswerId = (typeof APP_CONFIG.questionsAndAnswers.items)[number];

@Component({
  selector: 'app-export-invitation',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './export-invitation.component.html',
  styleUrl: './export-invitation.component.scss',
})
export class ExportInvitationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly guestSearch = inject(GuestSearchService);
  private readonly http = inject(HttpClient);
  private readonly ts = inject(TranslationService);
  private readonly exporter = inject(InvitationExportService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @ViewChildren('pageEl') private pageElements?: QueryList<ElementRef<HTMLElement>>;

  readonly isMenuOpen = signal(false);
  readonly status = signal<ExportStatus>('idle');
  // Shown under the error so phone failures (no console) are diagnosable.
  readonly errorDetail = signal('');
  // Canvas readback is being scrambled (Brave Shields / privacy mode), so exports cannot work.
  readonly shieldsHint = signal(false);
  // Pages waiting for a fresh tap (iOS share() needs a recent gesture).
  readonly pendingImages = signal<{ blobs: Blob[]; name: string } | null>(null);
  readonly showPages = signal(false);
  readonly letterPhotoFailed = signal(false);
  readonly letterPhotoData = signal('');
  // Downscaled copies (object URLs) of large photos: decoding full-size photos made iOS exports crawl or time out.
  private readonly resizedByUrl = signal(new Map<string, string>());
  private readonly naturalSizeByUrl = signal<Map<string, { width: number; height: number }>>(
    new Map(),
  );

  readonly pageWidth = APP_CONFIG.exportInvitation.pageWidth;
  readonly pageHeight = APP_CONFIG.exportInvitation.pageHeight;

  readonly storyItems = STORY_TIMELINE_ITEMS;
  readonly coverStoryItem = STORY_TIMELINE_ITEMS.find(
    (item) => item.id === APP_CONFIG.exportInvitation.coverStoryItemId,
  )!;
  readonly timelineEventIds = WEDDING_TIMELINE_EVENT_IDS;
  readonly qaItemIds = APP_CONFIG.questionsAndAnswers.items;
  readonly attireGuideImage = APP_CONFIG.assets.attireGuideImage;
  readonly attireImageFailed = signal(false);
  readonly giftDetails = APP_CONFIG.questionsAndAnswers.giftBlessing;
  readonly ladiesColorGuide = APP_CONFIG.whatToWear.colorGuide.ladies;
  readonly gentlemenColorGuide = APP_CONFIG.whatToWear.colorGuide.gentlemen;
  private readonly giftQrCodes = APP_CONFIG.assets.giftQrCodes;

  private readonly failedGiftQrCodes = signal<Set<GiftQrCodeId>>(new Set());

  readonly storyPathImage = 'export/story-path.svg';
  // Stop coordinates in the story-path.svg viewBox (1000x1350): three runs of the
  // serpentine, alternating direction, three stops each, in chapter order.
  readonly storyStops = [
    { x: 165, y: 80, tilt: -2.5 },
    { x: 500, y: 80, tilt: 2 },
    { x: 835, y: 80, tilt: -1.5 },
    { x: 835, y: 520, tilt: 2.5 },
    { x: 500, y: 520, tilt: -2 },
    { x: 165, y: 520, tilt: 1.5 },
    { x: 165, y: 960, tilt: -2 },
    { x: 500, y: 960, tilt: 2.5 },
    { x: 835, y: 960, tilt: -2.5 },
  ];
  readonly venueIds = ['church', 'reception'] as const;
  readonly venuePhotos = APP_CONFIG.assets.venuePhotos;
  readonly gratitudeIds = ['groomsParents', 'bridesParents', 'witnesses', 'ringBearer'] as const;
  readonly hotelGroups = APP_CONFIG.whereToStay.hotelGroups;
  // Pre-rendered raster of export/burnt-paper.svg: rasterizing the live SVG filters inside html2canvas timed out on iPadOS.
  readonly letterPaperImage = 'letter/burnt-paper.webp';
  readonly mainCourseOptions = APP_CONFIG.mealChoices.options;

  private readonly matchedRow = signal<GuestRow | null>(null);
  private readonly matchedField = signal<GuestHashMatchField | null>(null);
  private readonly matchedName = signal('');
  private guestFetched = false;

  readonly shouldShowLetterPage = computed(() => {
    const row = this.matchedRow();
    const field = this.matchedField();
    if (!row || !field) return false;
    return shouldShowGuestLetterForMatch({ row, matchedField: field, matchedName: '' });
  });

  readonly letterRow = computed(() => this.matchedRow());
  readonly letterPhotoUrl = computed(() => {
    const url = this.matchedRow()?.imageUrl.trim() ?? '';
    return /^https?:\/\//i.test(url) ? url : '';
  });
  readonly signatureName = computed(
    () => this.matchedRow()?.letterSignedBy.trim() || this.ts.t('guestLetter.coupleName'),
  );

  // This guest's own entry, same per-guest lookup as RsvpComponent.existingEntryFor(); undefined if not RSVP-ed.
  readonly letterRsvpEntry = computed<RsvpEntry | undefined>(() => {
    const row = this.matchedRow();
    const name = this.matchedName();
    if (!row?.rsvpRaw || !name) return undefined;
    const entries = row.rsvpRaw[row.fullName] ?? [];
    return entries.find((entry) => entry.Guest === name);
  });

  // Same deadline text the RSVP section shows, minus its trailing full stop, for the not-yet-RSVP-ed note.
  notYetBody(): string {
    const deadline = this.ts.t('rsvp.deadline.date').replace(/[.。]$/, '');
    return this.ts.t('exportInvitation.rsvpStatus.notYetBody').replace('{0}', deadline);
  }

  mealLabel(choice: MealChoice): string {
    return this.ts.t(`mainCourse.options.${choice}.label`);
  }

  private readonly photoManifest = signal<StoryManifestEntry[]>([]);
  private manifestFetched = false;
  private readonly photosByPrefix = computed(() => groupStoryPhotosByPrefix(this.photoManifest()));

  readonly coverPhotoUrl = computed(() => this.storyPhotoUrl(this.coverStoryItem));

  storyPhotoUrl(item: StoryTimelineItem): string {
    return this.photosByPrefix().get(item.filePrefix.toLowerCase())?.[0] ?? '';
  }

  // The event label embeds its time ("Wedding Mass Ceremony 2:00 PM"); split it so only the time is underlined.
  venueEventParts(id: string): { before: string; time: string; after: string } {
    const label = this.ts.t(id === 'church' ? 'hero.ceremonyLabel' : 'hero.receptionLabel');
    const match = /(?:下午|晚上|上午)?\d{1,2}:\d{2}(?:\s?[AP]M)?/i.exec(label);
    if (!match) return { before: label, time: '', after: '' };
    const end = match.index + match[0].length;
    return { before: label.slice(0, match.index), time: match[0], after: label.slice(end) };
  }

  // Height as a % of width for a padding-top box (not CSS `aspect-ratio`, which html2canvas may mis-size).
  // Uses the size recorded by preloadOne, so it works for photos outside the Our Story manifest.
  photoSrc(url: string): string {
    return this.resizedByUrl().get(url) ?? url;
  }

  photoRatioPercent(url: string, fallbackPercent = 75): number {
    const size = this.naturalSizeByUrl().get(url);
    if (!size || size.width <= 0) return fallbackPercent;
    return (size.height / size.width) * 100;
  }

  // Clamped so tall collage photos don't dominate the story path; `contain` still shows them uncropped.
  storyPhotoRatioPercent(item: StoryTimelineItem): number {
    const url = this.storyPhotoUrl(item);
    const percent = this.photoRatioPercent(url);
    return Math.min(115, Math.max(65, percent));
  }

  venuePhotoRatioPercent(id: 'church' | 'reception'): number {
    return Math.min(130, Math.max(55, this.photoRatioPercent(this.venuePhotos[id])));
  }

  venueKey(id: 'church' | 'reception', field: 'name' | 'description' | 'address'): string {
    return `venues.items.${id}.${field}`;
  }

  gratitudeKey(id: string, field: 'role' | 'names'): string {
    return `withGratitude.items.${id}.${field}`;
  }

  hotelGroupHeadingKey(groupId: string): string {
    return `whereToStay.hotelGroups.${groupId}.heading`;
  }

  hotelNameKey(groupId: string, hotelId: string): string {
    return `whereToStay.hotelGroups.${groupId}.hotels.${hotelId}`;
  }

  storyTextKey(itemId: StoryTimelineItemId, field: 'date' | 'title'): string {
    return `ourStory.timeline.${itemId}.${field}`;
  }

  timelineTextKey(
    eventId: WeddingTimelineEventId,
    field: 'time' | 'title' | 'description',
  ): string {
    return `weddingTimeline.events.${eventId}.${field}`;
  }

  qaTextKey(itemId: QuestionAnswerId, field: 'question' | 'answer'): string {
    return `questionsAndAnswers.items.${itemId}.${field}`;
  }

  isGiftBlessingItem(itemId: QuestionAnswerId): boolean {
    return itemId === 'giftBlessing';
  }

  giftQrCodeUrl(qrCodeId: GiftQrCodeId): string {
    return this.giftQrCodes[qrCodeId];
  }

  shouldShowGiftQrCode(qrCodeId: GiftQrCodeId): boolean {
    return Boolean(this.giftQrCodeUrl(qrCodeId)) && !this.failedGiftQrCodes().has(qrCodeId);
  }

  markGiftQrCodeFailed(qrCodeId: GiftQrCodeId): void {
    const failed = new Set(this.failedGiftQrCodes());
    failed.add(qrCodeId);
    this.failedGiftQrCodes.set(failed);
  }

  ngOnInit(): void {
    // The guest lookup is shared (memoized) with the hero and letter, so starting it now costs nothing extra
    // and the export no longer waits for the Sheets round trip after the tap.
    if (this.route.snapshot.paramMap.get('rsvpHash')?.trim()) void this.ensureData();
  }

  toggleMenu(): void {
    if (this.status() === 'preparing') return;
    this.isMenuOpen.update((open) => !open);
    // Opening the menu is a strong hint the guest will export: start loading photos and the letter photo now.
    if (this.isMenuOpen()) void this.warm();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen.set(false);
  }

  async selectFormat(format: ExportFormat): Promise<void> {
    this.isMenuOpen.set(false);
    if (this.status() === 'preparing') return;

    this.status.set('preparing');
    this.errorDetail.set('');
    this.shieldsHint.set(false);
    this.pendingImages.set(null);

    try {
      await this.warm();
      this.showPages.set(true);
      await this.settleWithin(this.waitForRender(), 2_000);
      // Fonts swapping in change text metrics; measure only after they settle.
      await this.settleWithin(document.fonts?.ready, 5_000);
      this.fitOverflowingContent();

      const elements = (this.pageElements?.toArray() ?? []).map((ref) => ref.nativeElement);
      const pages = await this.exporter.captureAsBlobs(elements);

      const fileBaseName = `EleazMead_Invitation_${this.dateStamp()}`;
      // Preparing is over: some browsers never settle share() when the sheet is dismissed, which left the button spinning.
      this.status.set('idle');
      if (format === 'images') {
        const result = await this.exporter.exportAsImages(pages, fileBaseName);
        if (result === 'needs-tap') this.pendingImages.set({ blobs: pages, name: fileBaseName });
      } else {
        await this.exporter.exportAsPdf(pages, fileBaseName, this.pageWidth, this.pageHeight);
      }
    } catch (err) {
      // Keep the console trace: export failures are otherwise undebuggable.
      console.error('Invitation export failed:', err);
      this.errorDetail.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      // Only now (export actually failed) check for scrambled canvas pixels, so a false positive can never block an export.
      if (await this.canvasReadbackBlocked()) this.shieldsHint.set(true);
      this.status.set('error');
    } finally {
      this.showPages.set(false);
      this.resizedByUrl().forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      this.resizedByUrl.set(new Map());
      this.warmPromise = undefined;
    }
  }

  // Brave Shields and similar privacy modes add noise to canvas pixels. A row of distinct exact colours
  // (a single solid colour can slip through) must read back unchanged and encode to a blob promptly.
  private async canvasReadbackBlocked(): Promise<boolean> {
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      const expected: number[] = [];
      for (let x = 0; x < size; x++) {
        const r = (x * 37 + 11) % 256;
        const g = (x * 91 + 53) % 256;
        const b = (x * 17 + 201) % 256;
        expected.push(r, g, b);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, 0, 1, 4);
      }
      const data = ctx.getImageData(0, 0, size, 4).data;
      for (let x = 0; x < size; x++) {
        for (let c = 0; c < 3; c++) {
          if (data[x * 4 + c] !== expected[x * 3 + c]) return true;
        }
      }
      const blob = await new Promise<Blob | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 3000);
        canvas.toBlob((b) => {
          clearTimeout(timer);
          resolve(b);
        }, 'image/jpeg');
      });
      return !blob;
    } catch {
      return true;
    }
  }

  // Must stay free of awaits before the share call so the tap still counts as a gesture.
  savePendingImages(): void {
    const pending = this.pendingImages();
    if (!pending) return;
    void this.exporter.shareImages(pending.blobs, pending.name).then(() => {
      this.pendingImages.set(null);
    });
  }

  private preloadPhotos(): Promise<void> {
    const urls = new Set<string>();

    const cover = this.coverPhotoUrl();
    if (cover) urls.add(cover);

    for (const item of this.storyItems) {
      const url = this.storyPhotoUrl(item);
      if (url) urls.add(url);
    }

    const philippinesQr = this.giftQrCodeUrl('philippines');
    if (philippinesQr) urls.add(philippinesQr);

    const singaporeQr = this.giftQrCodeUrl('singapore');
    if (singaporeQr) urls.add(singaporeQr);

    if (this.attireGuideImage) urls.add(this.attireGuideImage);
    if (this.shouldShowLetterPage()) urls.add(this.letterPaperImage);
    urls.add(this.storyPathImage);
    urls.add(this.venuePhotos.church);
    urls.add(this.venuePhotos.reception);

    return Promise.all([
      this.loadLetterPhotoData(),
      ...Array.from(urls).map((url) => this.preloadOne(url)),
    ]).then(() => undefined);
  }

  // Cloudinary originals are often 4000px+; request a 900px JPEG so iOS doesn't run out of memory.
  private exportPhotoUrl(url: string): string {
    return cloudinaryResized(url, 'w_900,c_limit,q_auto:good,f_jpg');
  }

  // Inlined as a data URL: a remote background-image can taint the canvas when Safari reuses a cached
  // non-CORS copy, which makes toBlob throw and kills the whole export.
  private async loadLetterPhotoData(): Promise<void> {
    const url = this.letterPhotoUrl();
    if (!url) return;
    try {
      const response = await fetch(this.exportPhotoUrl(url), { mode: 'cors', cache: 'reload' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      this.letterPhotoData.set(dataUrl);
      await this.preloadOne(dataUrl);
    } catch (err) {
      console.warn('Guest letter photo could not be loaded for export (CORS?):', url, err);
      this.letterPhotoFailed.set(true);
    }
  }

  // Photos larger than MAX_PHOTO_SIDE are redrawn smaller (the pages show them at ~250-500px wide anyway).
  private async downscale(url: string, image: HTMLImageElement): Promise<void> {
    const side = Math.max(image.naturalWidth, image.naturalHeight);
    if (side <= MAX_PHOTO_SIDE || url.endsWith('.svg') || url.startsWith('data:')) return;
    try {
      const ratio = MAX_PHOTO_SIDE / side;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * ratio);
      canvas.height = Math.round(image.naturalHeight * ratio);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88),
      );
      canvas.width = canvas.height = 0;
      if (!blob) return;
      const map = new Map(this.resizedByUrl());
      map.set(url, URL.createObjectURL(blob));
      this.resizedByUrl.set(map);
    } catch {
      // Keep the original URL if resizing is unavailable.
    }
  }

  private preloadOne(url: string): Promise<void> {
    return new Promise((resolve) => {
      const image = new Image();
      // Only matters for the guest letter photo, which may be hosted on a
      // third-party domain (Azure, S3, ...) - harmless for same-origin URLs.
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const sizes = new Map(this.naturalSizeByUrl());
        sizes.set(url, { width: image.naturalWidth, height: image.naturalHeight });
        this.naturalSizeByUrl.set(sizes);
        void this.downscale(url, image).then(resolve);
      };
      image.onerror = () => {
        if (url === this.letterPhotoUrl()) {
          // Almost always the photo host not sending CORS headers (Azure/S3
          // need a CORS rule for this site's origin) - a tainted canvas can't
          // be exported, so the photo is omitted rather than breaking the export.
          console.warn('Guest letter photo could not be loaded for export (CORS?):', url);
          this.letterPhotoFailed.set(true);
        }
        if (url === this.giftQrCodeUrl('philippines')) this.markGiftQrCodeFailed('philippines');
        if (url === this.giftQrCodeUrl('singapore')) this.markGiftQrCodeFailed('singapore');
        if (url === this.attireGuideImage) this.attireImageFailed.set(true);
        resolve();
      };
      image.src = url;
    });
  }

  // Data + photo preloading, started once (on menu open or export) and shared by both.
  private warmPromise?: Promise<void>;

  private warm(): Promise<void> {
    // Photos are CSS backgrounds (html2canvas ignores object-fit), so preload them via Image() to avoid blank captures.
    this.warmPromise ??= (async () => {
      await this.settleWithin(this.ensureData(), 20_000);
      await this.settleWithin(this.preloadPhotos(), 25_000);
    })();
    return this.warmPromise;
  }

  private dataPromise?: Promise<void>;

  private ensureData(): Promise<void> {
    this.dataPromise ??= this.loadData();
    return this.dataPromise;
  }

  private loadData(): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (!this.manifestFetched) {
      this.manifestFetched = true;
      tasks.push(
        firstValueFrom(this.http.get<StoryManifestEntry[]>('our-story/manifest.json')).then(
          (entries) => {
            this.photoManifest.set(entries);
          },
          () => {
            this.photoManifest.set([]);
          },
        ),
      );
    }

    if (!this.guestFetched) {
      const hashInput = this.route.snapshot.paramMap.get('rsvpHash')?.trim() ?? '';
      this.guestFetched = true;
      if (hashInput) {
        tasks.push(
          firstValueFrom(this.guestSearch.findByHash(hashInput)).then(
            (result) => {
              this.matchedRow.set(result?.row ?? null);
              this.matchedField.set(result?.matchedField ?? null);
              this.matchedName.set(result?.matchedName ?? '');
            },
            () => {
              this.matchedRow.set(null);
              this.matchedField.set(null);
              this.matchedName.set('');
            },
          ),
        );
      }
    }

    return Promise.all(tasks).then(() => undefined);
  }

  // Two frames: Angular renders the pages host, then the browser commits layout (one tick was sometimes too early).
  // Resolves when `work` settles or after `ms`, whichever is first, so one stalled step cannot freeze the export.
  private settleWithin(work: Promise<unknown> | undefined, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      (work ?? Promise.resolve()).then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        () => {
          clearTimeout(timer);
          resolve();
        },
      );
    });
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  // Safety net for longer copy (other locales, long guest letters): fixed-height
  // pages clip silently, so scale any overflowing .export-fit block down to fit.
  private fitOverflowingContent(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    host.querySelectorAll<HTMLElement>('.export-fit').forEach((el) => {
      el.style.transform = '';
      el.style.justifyContent = '';
      // Centered/space-evenly flex containers push overflow off BOTH ends, and
      // scrollHeight only counts the end side, so measure from flex-start.
      el.style.justifyContent = 'flex-start';
      const available = el.clientHeight;
      const needed = el.scrollHeight;
      if (available > 0 && needed > available + 1) {
        el.style.transformOrigin = 'top center';
        el.style.transform = `scale(${available / needed})`;
      } else {
        el.style.justifyContent = '';
      }
    });
  }

  private dateStamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  }
}
