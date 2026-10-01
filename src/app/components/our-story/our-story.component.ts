import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '../../shared/translate.pipe';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { PolaroidPhotoComponent } from '../../shared/polaroid-photo/polaroid-photo.component';
import { StoryManifestEntry, groupStoryPhotosByPrefix } from '../../shared/utils/story-photo.utils';

export const STORY_TIMELINE_ITEMS = [
  { id: 'metAtWork', filePrefix: 'Sep_2016' },
  { id: 'coffeeRuns', filePrefix: 'Apr_2017' },
  { id: 'programming', filePrefix: 'Dec_2018' },
  { id: 'longDistance', filePrefix: 'Sep_2019' },
  { id: 'lionCity', filePrefix: 'Feb_2020' },
  { id: 'fluffyEra', filePrefix: 'Mar_2022' },
  { id: 'fitnessJourney', filePrefix: 'Nov_2024' },
  { id: 'proposal', filePrefix: 'May_2025' },
  { id: 'bigDay', filePrefix: 'Jan_2027' },
] as const;

export type StoryTimelineItem = (typeof STORY_TIMELINE_ITEMS)[number];
export type StoryTimelineItemId = StoryTimelineItem['id'];

@Component({
  selector: 'app-our-story',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective, PolaroidPhotoComponent],
  templateUrl: './our-story.component.html',
  styleUrl: './our-story.component.scss',
})
export class OurStoryComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly timelineItems = STORY_TIMELINE_ITEMS;
  readonly failedPhotos = signal<Set<string>>(new Set());
  readonly photoManifest = signal<StoryManifestEntry[]>([]);
  readonly photosByPrefix = computed(() => groupStoryPhotosByPrefix(this.photoManifest()));

  // Actual intrinsic pixel dimensions per photo URL, from the manifest
  // (populated at build time by generate-gallery-manifest.mjs via the
  // image-size package). Passed through to PolaroidPhotoComponent as native
  // width/height attributes so the browser can reserve the correct
  // aspect-ratio box before the image loads, instead of collapsing to 0
  // height and shifting the page once it does - this is what Lighthouse's
  // "unsized images" audit flags and what drives a meaningful chunk of
  // cumulative layout shift on a page with a dozen-plus photos.
  readonly photoDimensionsByUrl = computed(() => {
    const map = new Map<string, { width: number; height: number }>();
    for (const entry of this.photoManifest()) {
      if (entry.width > 0 && entry.height > 0) {
        map.set(`our-story/${entry.file}`, { width: entry.width, height: entry.height });
      }
    }
    return map;
  });

  ngOnInit(): void {
    this.http.get<StoryManifestEntry[]>('our-story/manifest.json').subscribe({
      next: (entries) => this.photoManifest.set(entries),
      error: () => this.photoManifest.set([]),
    });
  }

  photoWidth(url: string): number | undefined {
    return this.photoDimensionsByUrl().get(url)?.width;
  }

  photoHeight(url: string): number | undefined {
    return this.photoDimensionsByUrl().get(url)?.height;
  }

  photoUrls(item: StoryTimelineItem): string[] {
    return (this.photosByPrefix().get(item.filePrefix.toLowerCase()) ?? [])
      .filter((url): url is string => Boolean(url))
      .slice(0, 2);
  }

  textKey(itemId: StoryTimelineItemId, field: 'date' | 'title' | 'body'): string {
    return `ourStory.timeline.${itemId}.${field}`;
  }

  captionKey(itemId: StoryTimelineItemId, photoIndex: number): string {
    return `ourStory.timeline.${itemId}.photoCaption${photoIndex + 1}`;
  }

  isPhotoVisible(url: string): boolean {
    return !this.failedPhotos().has(url);
  }

  visiblePhotoCount(item: StoryTimelineItem): number {
    return this.photoUrls(item).filter((url) => this.isPhotoVisible(url)).length;
  }

  markPhotoFailed(url: string): void {
    const failedPhotos = new Set(this.failedPhotos());
    failedPhotos.add(url);
    this.failedPhotos.set(failedPhotos);
  }
}
