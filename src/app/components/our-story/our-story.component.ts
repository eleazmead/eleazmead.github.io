import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '../../shared/translate.pipe';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { PolaroidPhotoComponent } from '../../shared/polaroid-photo/polaroid-photo.component';

const STORY_TIMELINE_ITEMS = [
  { id: 'metAtWork', filePrefix: 'Sep_2016' },
  { id: 'coffeeRuns', filePrefix: 'Apr_2017' },
  { id: 'longDistance', filePrefix: 'Sep_2019' },
  { id: 'lionCity', filePrefix: 'Feb_2020' },
  { id: 'fluffyEra', filePrefix: 'Mar_2022' },
  { id: 'fitnessJourney', filePrefix: 'Nov_2024' },
  { id: 'proposal', filePrefix: 'May_2025' },
  { id: 'bigDay', filePrefix: 'Jan_2027' },
] as const;

type StoryTimelineItem = (typeof STORY_TIMELINE_ITEMS)[number];
type StoryTimelineItemId = StoryTimelineItem['id'];

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
  readonly photoManifest = signal<string[]>([]);
  readonly photosByPrefix = computed(() => {
    const grouped = new Map<string, string[]>();

    for (const filename of this.photoManifest()) {
      const match = filename.match(/^([a-z]{3}_\d{4})_([12])\.(jpe?g|png)$/i);
      if (!match) continue;

      const prefix = match[1].toLowerCase();
      const imageNumber = Number(match[2]);
      const existing = grouped.get(prefix) ?? [];
      existing[imageNumber - 1] = `our-story/${filename}`;
      grouped.set(prefix, existing);
    }

    return grouped;
  });

  ngOnInit(): void {
    this.http.get<string[]>('our-story/manifest.json').subscribe({
      next: (files) => this.photoManifest.set(files),
      error: () => this.photoManifest.set([]),
    });
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
