import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '../../shared/translate.pipe';
import { FadeUpDirective } from '../../shared/fade-up.directive';
import { TranslationService } from '../../shared/translation.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [TranslatePipe, FadeUpDirective],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly ts = inject(TranslationService);

  readonly images = signal<string[]>([]);
  readonly selectedIndex = signal<number | null>(null);

  ngOnInit(): void {
    this.http.get<string[]>('gallery/manifest.json').subscribe({
      next: (files) => this.images.set(files),
      error: () => this.images.set([]),
    });
  }

  open(index: number): void {
    this.selectedIndex.set(index);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.selectedIndex.set(null);
    document.body.style.overflow = '';
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  imageUrl(filename: string): string {
    return `gallery/${filename}`;
  }

  textWithNumber(key: string, number: number): string {
    return this.ts.t(key).replace('{0}', String(number));
  }
}
