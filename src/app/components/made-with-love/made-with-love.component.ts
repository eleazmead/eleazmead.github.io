import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../shared/translate.pipe';

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 550;
const LOOP_COUNT = 5;
const SCROLL_TOP_RESET_PX = 4;

type Phase = 'pending' | 'playing' | 'scattered';

@Component({
  selector: 'app-made-with-love',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './made-with-love.component.html',
  styleUrl: './made-with-love.component.scss',
})
export class MadeWithLoveComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly phase = signal<Phase>('pending');
  readonly frameIndex = signal(0);

  private intersectionObserver?: IntersectionObserver;
  private frameTimer?: ReturnType<typeof setInterval>;
  private readonly onScroll = () => this.handleScroll();

  private eleazFrame(index: number): string {
    return `made-with-love/eleaz${index + 1}.webp`;
  }

  private meadFrame(index: number): string {
    return `made-with-love/mead${index + 1}.webp`;
  }

  get eleazImageUrl(): string {
    return this.eleazFrame(this.frameIndex());
  }

  get meadImageUrl(): string {
    return this.meadFrame(this.frameIndex());
  }

  readonly eleazScatteredUrls = [0, 1, 2].map((index) => this.eleazFrame(index));
  readonly meadScatteredUrls = [0, 1, 2].map((index) => this.meadFrame(index));

  ngAfterViewInit(): void {
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && this.phase() === 'pending') {
          this.startAnimation();
        }
      },
      { threshold: 0.4 },
    );
    this.intersectionObserver.observe(this.el.nativeElement);
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
    if (this.frameTimer) clearInterval(this.frameTimer);
  }

  private startAnimation(): void {
    this.phase.set('playing');
    this.frameIndex.set(0);
    let completedLoops = 0;

    this.frameTimer = setInterval(() => {
      const nextFrame = (this.frameIndex() + 1) % FRAME_COUNT;
      this.frameIndex.set(nextFrame);

      if (nextFrame === 0) {
        completedLoops += 1;
        if (completedLoops >= LOOP_COUNT) {
          if (this.frameTimer) clearInterval(this.frameTimer);
          this.phase.set('scattered');
        }
      }
    }, FRAME_INTERVAL_MS);
  }

  private handleScroll(): void {
    if (window.scrollY <= SCROLL_TOP_RESET_PX && this.phase() === 'scattered') {
      this.phase.set('pending');
      this.intersectionObserver?.observe(this.el.nativeElement);
    }
  }
}
