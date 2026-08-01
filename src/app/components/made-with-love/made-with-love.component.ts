import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../shared/translate.pipe';

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 400;
const LOOP_COUNT = 6;
const SCROLL_TOP_RESET_PX = 4;

type Phase = 'pending' | 'playing' | 'frozen';

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

  get eleazImageUrl(): string {
    return `made-with-love/eleaz${this.frameIndex() + 1}.webp`;
  }

  get meadImageUrl(): string {
    return `made-with-love/mead${this.frameIndex() + 1}.webp`;
  }

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
          // Lands back on frame 0 (eleaz1/mead1) and stays there - the
          // caption stays on screen throughout instead of being hidden.
          this.phase.set('frozen');
        }
      }
    }, FRAME_INTERVAL_MS);
  }

  private handleScroll(): void {
    if (window.scrollY <= SCROLL_TOP_RESET_PX && this.phase() === 'frozen') {
      this.phase.set('pending');
      this.intersectionObserver?.observe(this.el.nativeElement);
    }
  }
}
