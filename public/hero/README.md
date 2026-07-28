Place the hero backdrop video at:

```text
public/hero/EleazMead_hero.webm
public/hero/hero-backdrop.mp4
```

`HeroComponent` references both paths through `APP_CONFIG.assets.heroBackdropWebm` /
`heroBackdropMp4`. The `<video>` tries the WebM source first and falls back to the
MP4 for browsers that can't play WebM - keep both in sync (same content, same
loop point) whenever the backdrop changes. To regenerate the MP4 from a WebM
source:

```bash
ffmpeg -i EleazMead_hero.webm -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -preset medium -crf 23 -movflags +faststart hero-backdrop.mp4
```

The video is paused automatically via `IntersectionObserver` while the hero
section is scrolled out of view, and resumed when it scrolls back in.
