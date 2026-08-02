import { Directive, ElementRef, OnInit, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[appFadeUp]',
  standalone: true,
  host: { class: 'fade-up' },
})
export class FadeUpDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up--visible');
          this.observer?.unobserve(entry.target);
        }
      },
      // threshold:0 fires as soon as any pixel intersects.
      // rootMargin bottom 120px extends detection below the fold so elements
      // at the viewport edge (e.g. guest letter, our-story items on short
      // mobile viewports) trigger immediately on load without requiring scroll.
      { threshold: 0, rootMargin: '0px 0px 120px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
