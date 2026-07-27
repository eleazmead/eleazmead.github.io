# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
An identical copy exists as `AGENTS.md` for OpenAI Codex. **Always update both files together.**

## Strict rules

- **No emdashes (`-`) anywhere** - not in code, comments, documentation, UI text, i18n strings, or any file in this repo. Use a regular hyphen (`-`) instead.

## Commands

```bash
npm start                    # Dev server at localhost:4200 (auto-generates asset manifests first)
npm run start:staging        # Dev server with staging environment
npm run build                # Production build (auto-generates asset manifests first)
npm run build:staging        # Staging build
npm run build:production     # Explicit production build
npm run generate-gallery     # Regenerate public/gallery/manifest.json and public/our-story/manifest.json manually
npm test                     # Run tests with Vitest via Angular CLI
```

To run a single test file, use Vitest directly:

```bash
npx vitest run src/app/app.spec.ts
```

There is no lint script configured - use Prettier for formatting:

```bash
npx prettier --write "src/**/*.{ts,html,scss}"
npx prettier --check "src/**/*.{ts,html,scss}"
```

## Architecture

This is an **Angular 22** single-page application (SPA) bootstrapped with standalone components - no `NgModule`. The entry point is `src/main.ts`, which bootstraps `AppComponent` via `src/app/app.config.ts`.

### Key architectural decisions

- **Standalone components throughout.** Every component uses `imports: [...]` directly; there is no shared module.
- **Test runner is Vitest**, not Karma/Jasmine. Test types come from `vitest/globals` (see `tsconfig.spec.json`). The Angular CLI delegates to Vitest via `@angular/build:unit-test`.
- **SCSS, not CSS.** Despite the project being scaffolded with CSS intent, `angular.json` configures `inlineStyleLanguage: scss` and all component style files use `.scss`.
- **Multi-environment config.** Three environment files under `src/environments/` (`development`, `staging`, `production`). The production build sets `baseHref: /eleazmead/` for GitHub Pages hosting.
- **Path-based routing** with a `404.html` workaround for GitHub Pages. `postbuild` copies `index.html` → `404.html` so direct navigation to `/admin` works. No hash prefix.

### CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push/PR to `main`:

- PRs: builds with `--configuration development` (no deploy)
- Merges to `main`: injects secrets → production build → deploys to GitHub Pages at `dist/eleazmead/browser`

**Secrets** - set these in GitHub repo → Settings → Secrets and variables → Actions. CI injects them into `environment.production.ts` before the build (replaces `REPLACE_*` placeholders). Never stored in git.

| Secret name             | Description                              |
| ----------------------- | ---------------------------------------- |
| `ADMIN_PASSWORD`        | Password for the `/admin` dashboard      |
| `SHEETS_SPREADSHEET_ID` | Google Sheets spreadsheet ID             |
| `SHEETS_API_KEY`        | Google Sheets simple API key (not OAuth) |
| `GAS_WEB_APP_URL`       | Deployed Google Apps Script Web App URL  |

### Local setup after cloning

`environment.ts` and `environment.staging.ts` are gitignored - only template files are committed. Copy and fill in real values before running locally:

```bash
cp src/environments/environment.ts.example src/environments/environment.ts
cp src/environments/environment.staging.ts.example src/environments/environment.staging.ts
# Fill in sheetsSpreadsheetId, sheetsApiKey, gasWebAppUrl in both files
```

### Formatter

Prettier with `singleQuote: true`, `printWidth: 100`, and the `angular` HTML parser for `.html` files.

### App structure

`AppComponent` is a thin router shell (`<router-outlet />`). Routes:

- `/` → `HomeComponent` (`src/app/components/home/`) - the public wedding website
- `/:rsvpHash` → `HomeComponent` (`src/app/components/home/`) - public wedding website with an RSVP invitation hash from the URL path
- `/admin` → `AdminComponent` (`src/app/components/admin/`) - password-protected RSVP dashboard

The public site renders ten standard sections in order: Hero → Our Story → Venues → RSVP → Wedding Timeline → What to Wear → Gift Registry → Questions & Answers → Made With Love → Footer, all inside `HomeComponent`. A conditional Guest Letter section appears after Hero when the matched RSVP sheet row has both `LetterAddress` and `LetterMessage` and the URL RSVP hash either matches `FullNameHash_MD5` or matches a related guest hash with `LetterShowForAll` set to `1`.

**Config layer** - `src/app/config/app.config.ts` exports `APP_CONFIG` (`as const`), a typed constant holding non-copy configuration such as theme tokens, asset paths, stable option IDs, locale settings, and contact URLs. Do not put display text in `APP_CONFIG`; all user-facing text belongs in i18n JSON.

Notable `APP_CONFIG` fields:

- `assets.heroBackdropAvif` — animated AVIF backdrop path for the first section; placeholder target is `public/hero/eleaz-mead-backdrop-placeholder.avif`
- `assets.attireGuideImage` — wedding attire guide image path under `public/`; blank or failed paths render a visible placeholder. The attire guide title lives in `whatToWear.imageTitle`; the image is centered at 70% width with a white border on stacked layouts, and sits in a second desktop column beside the attire copy.
- `assets.venuePhotos` — ceremony/reception venue photo paths under `public/`; blank or failed paths render visible placeholders. Real venue photos preserve their natural aspect ratio, are centered at 70% width within each venue item, and must not be cropped. Venue items render in two columns on desktop.
- `mealChoices.options` — stable meal choice IDs (`beef` / `fish`); labels and descriptions live in i18n JSON
- `whatToWear.colorGuide` — configurable attire color swatches for ladies and gentlemen. The visible "Color guide" label lives in i18n JSON.
- `rsvp.deadlineDate` — machine-readable RSVP cutoff date in `YYYY-MM-DD` format. The displayed deadline copy still lives in i18n JSON.
- `questionsAndAnswers.items` — ordered stable Q&A IDs; matching `questionsAndAnswers.items.<id>.question` and `.answer` text must exist in i18n JSON
- `contacts.whatsappUrl` — WhatsApp CTA link used in the RSVP not-found state
- `i18n.defaultLocale` / `i18n.supportedLocales` — locale configuration for the language toggle and translation service

**Visual direction** - The site follows a wedding mood board of light brown and black with white space, blush pink floral accents, and taupe neutrals. Global styling uses a subtle wedding-stationery background with vellum warmth, lace-like linework, and soft blush/taupe washes. Keep the look refined, romantic, candlelit, and editorial rather than bright, playful, or highly saturated.

**Responsive spacing** — Public content sections use tighter mobile-first vertical padding, then expand at desktop breakpoints. Preserve the compact mobile rhythm when adding sections so the page does not feel overly spaced on phones.

**i18n** — All display text lives in `public/i18n/en.json` and `public/i18n/fil.json`. Keep both files structurally complete whenever adding or changing copy. `TranslationService` (`src/app/shared/translation.service.ts`) fetches `public/i18n/{locale}.json` at runtime via `HttpClient`, and the language toggle switches between English and Tagalog. A `pure: false` `TranslatePipe` exposes `'key.path' | translate` to templates. When a `fil.json` value is empty, the service falls back to the `en.json` value automatically. `provideHttpClient()` must be present in `src/app/app.config.ts` (Angular's ApplicationConfig) for this to work.

- `hero.headline` in `public/i18n/en.json` includes a `{0}` placeholder. `HeroComponent` replaces it with the first word of the matched guest name from `FullName`, `Guest1Name`, or `Guest2Name` after resolving the URL RSVP hash. When the Guest Letter section is shown, the placeholder uses `LetterAddress` instead. When no RSVP hash is present, the placeholder uses `hero.noInputGreeting`.
- While the matched guest name is loading, the hero renders `Hi there,` at the start of the headline rather than showing fallback guest text.
- The hero places the wedding date above the couple names, and the ceremony/reception details render as two glow-backed text columns on desktop, collapsing to one column with extra spacing on mobile. Avoid box-like containers for these date and venue details. Ceremony/reception times live in `hero.ceremonyTime` and `hero.receptionTime` in i18n JSON.
- Section headings use plain display text without decorative `::after` underline elements.
- The hero RSVP CTA keeps `href="#rsvp"` for semantics but also calls `HeroComponent.scrollToRsvp()` so scrolling works reliably on path-param invitation URLs. When the Guest Letter section is shown, the CTA is hidden in Hero and rendered centered at the bottom of the letter instead.
- The conditional Guest Letter section uses the matched `/:rsvpHash` row. It renders only when both `letterAddress` and `letterMessage` are non-empty and the hash source is either `FullNameHash_MD5` or a related guest hash (`Guest1FullName_MD5` / `Guest2FullName_MD5`) with `letterShowForAll` set to `1`. It formats the message like a handwritten white letter with subtle burnt edges and uses `guestLetter.signatureLine` for the closing. The signature name uses `LetterSignedBy` from the sheet when present, otherwise falls back to `guestLetter.coupleName` from i18n.
- Couple names, event date, venue names/descriptions/addresses, Our Story timeline dates/titles/body copy, RSVP copy, meal labels/descriptions, Wedding Timeline event times/titles/descriptions, What to Wear copy and color-guide label, Gift Registry copy, Questions & Answers copy, footer copy, language toggle labels, and admin/export labels all live in i18n JSON.

**Animations** - Hero uses CSS `@keyframes` fade-in with staggered delays. Section headings use `FadeUpDirective` (`src/app/shared/fade-up.directive.ts`) which attaches an `IntersectionObserver` and adds `.fade-up--visible` when the element enters the viewport. The `.fade-up` / `.fade-up--visible` classes are defined globally in `src/styles.scss` (they can't be scoped because they're applied programmatically).

**Our Story photos** - Timeline images are convention-based and do not live in `APP_CONFIG`. Put files in `public/our-story/` using `Mmm_YYYY_1` for the required first image and `Mmm_YYYY_2` for the optional second image, for example `Sep_2016_1.png` and `Sep_2016_2.jpg`. Supported extensions are `.jpg`, `.jpeg`, and `.png`; filename matching is case-insensitive. The manifest generator writes `public/our-story/manifest.json`, and `OurStoryComponent` maps actual filenames from that manifest. The site renders up to two images side by side per timeline item and ignores higher image numbers. Missing images fall back to a visible placeholder. **After adding new photos, the manifest must be regenerated** - restart `npm start`/`npm run build` (their `prestart`/`prebuild` hooks run the generator automatically), or run `npm run generate-gallery` manually. Running `ng serve`/`ng build` directly skips these hooks and will not pick up new files.

- Photo captions: `ourStory.timeline.<id>.photoCaption1` / `photoCaption2` in i18n JSON (max ~50 characters; enforced by `PolaroidPhotoComponent`, which ellipsizes longer strings). One caption per photo slot, following the same `Mmm_YYYY_1`/`_2` ordering as the filenames.

**Polaroid photo component** (`src/app/shared/polaroid-photo/`) - Renders each Our Story photo as a pinned, physically-animated polaroid card. Used only by `OurStoryComponent`; inputs are `imageUrl`, `alt`, `caption` (no `seed` input - removed in favor of hash-derived physics, see below).

- **Frame sizing**: no fixed aspect-ratio. `.polaroid__frame`/`.polaroid__photo` use `width: 100%; height: auto`, so the card's height follows each photo's own natural aspect ratio (portrait, landscape, or square) rather than cropping everything to a square, like real varying-format instant-film prints.
- **Deterministic per-photo physics, not random-per-load**: `rotationDeg`, `staticOffsetPx`, `sensitivityMultiplier`, `settleDelayExtraMs`, and `springDurationS` are all derived from a FNV-1a hash (`hash01()`) of the photo's own `imageUrl`, each with a distinct salt string. Same photo always produces the same tilt/physics on every load (stable, not flickering) - adding a new photo automatically gets its own well-distributed values with zero configuration. Do not reintroduce a small index/array-based "seed" system; a short lookup table indexed by a low integer clusters similar values on nearby indices (this was tried and reverted).
- **Gravity-correct pin position**: a card pinned exactly above its own center of mass hangs straight; any resting tilt must come from the pin being offset from center (equilibrium: the pin-to-centroid line must hang vertical). `applyPinShift()` in `PolaroidPhotoComponent` measures the ACTUAL rendered card width/height (via `offsetWidth`/`offsetHeight`, after image load and on `ResizeObserver` changes) to compute this, rather than assuming fixed proportions - the card's height now varies per photo (see frame sizing above), so a hardcoded formula would be wrong. `--polaroid-pin-shift` (a CSS custom property) drives both the pin's horizontal position and the focused figure's `transform-origin: 50% 50%` override; the two must always match or the pivot point drifts from the pin's visual needle-tip position (`PIN_ANCHOR_PX` constant).
- **CSS custom properties set via `Renderer2.setStyle` must pass `RendererStyleFlags2.DashCase`** as the 4th argument, or Angular silently no-ops the write (falls back to `el.style[name] = value`, which does not work for `--`-prefixed custom properties). This bit us for `--polaroid-parallax`, `--polaroid-inertia-tilt`, and `--polaroid-pin-shift`. This gotcha only applies to `Renderer2.setStyle` - `PolaroidScrollPhysicsService` (below) uses plain `element.style.setProperty()` directly, which does not need the flag.
- **Scroll physics runs through a single shared service, not per-instance**: `PolaroidScrollPhysicsService` (`polaroid-scroll-physics.service.ts`) drives parallax and scroll-inertia tilt for every polaroid on the page from ONE `window` scroll listener and ONE `requestAnimationFrame` loop, instead of each `PolaroidPhotoComponent` running its own. Each frame it does a strict batched read-phase (every `getBoundingClientRect()` across all registered photos) then write-phase (every style/class mutation) - this was a deliberate fix for iOS Safari scroll jank, since N independent per-instance loops interleaving their own reads and writes causes layout thrashing (every write invalidates layout, forcing the next instance's read to force a synchronous recalculation). Components `register()`/`unregister()` a lightweight handle in `ngAfterViewInit`/`ngOnDestroy`. Velocity is smoothed over a rolling ~120ms window of scroll samples (computed once here, shared by all photos) rather than a single animation-frame delta, which is too noisy from real trackpad/wheel input. A `.polaroid--scrolling` class swaps in a near-instant transition while actively scrolling so the tilt visibly tracks the flick, falling back to the slower spring-back transition once removed.
- **`will-change` is scoped to only actively-animating states**, never applied permanently to the base `.polaroid` rule - with a dozen-plus photos on Our Story, permanently promoting every card to its own compositor layer wastes GPU memory even for off-screen ones. It's applied to `.polaroid--scrolling`/hover for the scroll physics, and imperatively via JS for the duration of the focus-mode FLIP transition only (see below).
- **Focus/lightbox mode is a FLIP transition (First-Last-Invert-Play), not a simple pop-in/fade**: clicking a photo doesn't just show a centered overlay - the overlay card visibly grows FROM the inline photo's exact on-page position/size/rotation into the centered focused view, and reverses symmetrically on close (shrinks back down and lands exactly where the pin re-pins it). Two signals: `focused` (drives the pin lift/reveal and inline-card concealment, flips immediately on open/close) and `overlayVisible` (controls the overlay's DOM presence, kept separate so the overlay can stay mounted for the full duration of the closing shrink animation instead of vanishing the instant close is clicked).
  - `open()` captures the inline card's `getBoundingClientRect()` + computed `rotate` BEFORE any state changes. The overlay is rendered in the component's normal tree first, then reparented to `document.body` via `Renderer2.appendChild` (triggered with `afterNextRender`) - `FadeUpDirective`'s `transform` on an ancestor would otherwise become the containing block for the overlay's `position: fixed` and clip it to that ancestor's box instead of the viewport. `playOpenFlip()` then measures the overlay's natural centered rect, computes the delta, and animates from an inverted (looks-like-inline) starting transform to identity.
  - `close()`/`playCloseFlip()` does the reverse: measures the current overlay rect and the inline card's (still-concealed-but-still-laid-out) target rect, and animates the overlay card down to match. The backdrop dims out via `background-color` alpha, NOT the overlay root's `opacity` - opacity cascades to children via compositing, which was fading the card/photo itself to transparent as a side effect of dimming the backdrop (visible as a "ghost" flash right before landing). `background-color` only affects the box's own paint, leaving the card fully solid throughout.
  - Completion is driven by the real `transitionend` event (checked against `event.propertyName === 'transform'`), not a fixed `setTimeout` matching the expected duration - a timer isn't frame-accurate against the actual CSS transition, and firing even slightly early yanks the overlay out mid-motion (a visible pop/flash right at the end). A `setTimeout` slightly longer than the expected duration remains only as a safety net in case `transitionend` never fires.
  - The animation itself is driven by a single combined `transform: translate3d(x, y, 0) rotate(deg) scale(sx, sy)` (via `flipTransform()`), NOT the individual `rotate`/`translate`/`scale` CSS properties used elsewhere in this component for the resting swing/hover physics. The individual-properties API (CSS Transforms Level 2) does not have as mature/consistent GPU-compositing support across browsers - notably Safari/WebKit - as the long-standing `transform` shorthand; switching to `translate3d` (the classic cross-browser GPU-layer-promotion trick) is what actually resolved stutter that persisted even after adding `will-change` hints and dropping `box-shadow` from the animated properties. `box-shadow` is deliberately excluded from the FLIP transition entirely (it just snaps) since it is not GPU-compositable and forces a CPU repaint every frame if animated.
  - Opening and closing use different easing: `FLIP_OPEN_EASING` (`cubic-bezier(0.22, 1, 0.36, 1)`, fast-start/long-decelerate, good for "growing into view") vs `FLIP_CLOSE_EASING` (`cubic-bezier(0.34, 1.56, 0.64, 1)`, the same spring curve used for the pin's own re-pin snap) so landing gets a slight settle/bounce rather than a flat stop, reading as one consistent character continuing into the pin re-pinning that follows it.
  - Respects `prefers-reduced-motion: reduce` via an explicit `window.matchMedia` check in JS (inline styles would otherwise override the stylesheet's own reduced-motion rules).
- Photo depth: the print is rendered as a separate recessed layer from the white card, not fused - `.polaroid__frame` has a small padding gap (slightly darker than the card) around the photo, and `.polaroid__photo` carries inset (not outward) box-shadows so it reads as sunken beneath the card's surface.
- The card's white mat has a CSS-only paper-grain texture (inline SVG `feTurbulence` data URI on `.polaroid` background) - no image asset. `numOctaves` is kept low and `stitchTiles` is dropped to limit Safari/WebKit SVG-filter rasterization cost.

**Made With Love section** (`src/app/components/made-with-love/`) - Renders after Questions & Answers, before Footer. Reuses the existing `footer.message` i18n key ("Website Made with Love by the Groom and the Bride.") rather than duplicating the copy.

- Six source images live in `public/made-with-love/` as WebP, not PNG: `eleaz1.webp`/`eleaz2.webp`/`eleaz3.webp` and `mead1.webp`/`mead2.webp`/`mead3.webp`, ~800x800px. The original PNG exports were 2380x2380px and 3-5MB each (~24MB total) - decoding six of those plus filter compositing on top caused real, reported page jank/hangs when the section scrolled into view. Any replacement images must stay web-optimized (roughly this resolution, comparable file size) - re-adding oversized source images will reintroduce the hang. Angular's built-in `NG0913` dev-console warning (oversized intrinsic image dimensions vs. rendered size) is a leading indicator if this regresses.
- The animation only starts once the section scrolls into view (`IntersectionObserver`, threshold `0.4`), not on page load - `ngAfterViewInit` observes the host element and triggers `startAnimation()` on first intersection.
- "GIF" playback is a plain `setInterval` cycling a `frameIndex` signal through 0/1/2, swapping each figure's `src` between its three frames every 550ms - no actual GIF/video asset. Both figures share the same `frameIndex`, so eleaz and mead animate in sync with the caption text centered between them.
- Plays through 5 full 3-frame loops (`LOOP_COUNT = 5`), tracked by counting how many times `frameIndex` wraps back to 0, then transitions to a `scattered` phase.
- In the `scattered` phase the caption is hidden and all 6 static frames (not just the 3 per person) render side by side in a single row with per-`nth-child` `rotate` offsets and negative margins for an overlapping "fanned deck of cards" look - this is the final resting state.
- This only plays once per page load: a `window scroll` listener resets `phase` back to `pending` (replaying the animation) only when the user scrolls back to the very top (`scrollY <= 4`) while already in the `scattered` phase - scrolling past the section again afterward does not replay it.
- Both the animating figures and the scattered deck are bottom-anchored (`align-items: flex-end`) with a breakpoint-scaled negative `margin-bottom` that pushes each image slightly past the section's own `overflow: hidden` bottom edge, cropping a small amount off the feet/hands so the images read as planted into the section rather than floating free. Keep this crop subtle (single-digit px) - an earlier, much larger crop amount cut the figures off at the shoulders and had to be walked back. `.made-with-love__text` sets `align-self: center` so the caption doesn't inherit the row's bottom alignment and sink down with the images.
- Depth comes from a single soft-blurred `filter: drop-shadow(0 4px 6px …)` (30% opacity of `--color-secondary`), shared via the `--made-with-love-sticker-shadow` custom property, applied to both the stage figures and scattered cards. `drop-shadow` (not `box-shadow`) is required here since these are transparent die-cut PNGs/WebPs - `box-shadow` is confined to the rectangular element box and would show a visible rectangle around the transparent padding, while `drop-shadow` follows the actual alpha silhouette. An earlier iteration tried building a hard sticker-style outline by stacking many crisp `drop-shadow()`s around a circle in a Sass `@for` loop; that was replaced because (a) the CSS `filter` property requires its filter functions **space-separated, not comma-separated** - joining the Sass list with `comma` silently produced an entirely invalid `filter` value that computed to `none` with no error, and (b) once fixed, a hard outline read as too heavy/thick at every thickness tried and did not match the desired soft-lift look. Don't reintroduce the multi-shadow outline approach without a specific reason; the single soft shadow is the settled direction.

**Asset paths** - i18n JSON and public assets live under `public/` (served at `/` in dev, at `/eleazmead/` in production due to `baseHref`). All fetch URLs use relative paths so they resolve correctly in both environments.

**RSVP Google Sheets integration** - RSVP is backed by two Google services:

- **Reads** (guest list): Google Sheets REST API v4 GET via `SheetsService.fetchGuestList()`.
- **Writes** (submissions): Google Apps Script Web App POST via `SheetsService.submitRsvp()`. Uses `Content-Type: text/plain` to avoid CORS preflight.
- Config lives in `src/app/config/sheets.config.ts` (`SHEETS_CONFIG`), which reads `apiKey`, `spreadsheetId`, and `gasWebAppUrl` from the environment file. Fill these into `environment.ts` locally (see "Local setup after cloning"). The spreadsheet must be shared as "Anyone with the link can view".
- RSVP lookup is invitation-link based. The public route `/:rsvpHash` reads an MD5 hash from the URL path and `GuestSearchService` (`src/app/shared/guest-search.service.ts`) matches it against `FullNameHash_MD5`, `Guest1FullName_MD5`, or `Guest2FullName_MD5` after trimming whitespace and normalizing case. The bare `/` route shows an invite-only message instead of a search form.
- **RSVP state machine**: `idle → no_invitation_link / searching → found → confirming → submitting → success / not_found / error`. Once in `success`, there is no reset.
- **rsvpRaw structure**: always keyed by `row.fullName` (primary guest), with one flat `RsvpEntry[]` covering all group members. When a related guest responds separately, their entry is merged into the existing array (preserving others). Never use separate initiator keys.
- **Meal selection**: each attending guest must pick a main course (beef or fish). `MealChoice` is stored on `RsvpEntry`. `rsvpBeefCount` / `rsvpFishCount` are sent in the submission payload and written to sheet columns F / G.
- **Meal validation**: the main-course required error is cleared whenever a guest's attendance or inclusion state changes, so the error never remains visible after a guest declines or is excluded.
- **RSVP note**: when an invitation hash is present, the RSVP section renders a configurable note from i18n, with `rsvp.deadline.date` emphasized separately from the surrounding copy. The bare `/` invite-only state does not show this note.
- **RSVP deadline gate**: `APP_CONFIG.rsvp.deadlineDate` is compared against the current Singapore date. If the current date is later than or equal to the deadline date, new RSVP submissions and updates are blocked and the RSVP section shows `rsvp.deadline.closedMessage`.
- **RSVP review reminder**: the found-state form shows `rsvp.reviewReminder` immediately above the "Review your RSVP" button. Keep this venue reminder in i18n JSON.
- **rsvpTotal** counts only `RSVP: true` entries across the merged array (not just the current submission). Computed from `mergedEntries.filter(e => e.RSVP).length` before submitting.
- **Related guests** default to `included: false` - users must explicitly include them.
- **Already-responded check** is per-guest (looks for the initiator's name in the entries array), not per-row. A related guest excluded by the initiator can still search and respond separately; they'll see other group members' responses as read-only.
- **RSVP updates**: a guest who has already RSVP-ed can use their invitation link before the deadline to update their own attendance and main course. Existing values are prefilled from `rsvpRaw`; submitting replaces that guest's entry while preserving other guests' entries.
- **Already-responded message** shows who submitted (`row.rsvpSubmittedBy`), falling back to the first key in `rsvpRaw` for older rows.
- All timestamps use SGT (UTC+8) via `nowSGT()` in `src/app/shared/utils/date.utils.ts`, producing ISO 8601 with `+08:00` offset.
- Data models: `GuestRow`, `RsvpEntry`, `MealChoice`, `RsvpRawPayload`, `RsvpSubmission` in `src/app/shared/models/guest.model.ts`; `LogRow` in `src/app/shared/models/log.model.ts`.
- Signal reactivity with Map: always create `new Map(this.selections())` when mutating - in-place Map mutations do not trigger Angular change detection.

**GuestList sheet column mapping** (enforced in `SHEETS_CONFIG.guestListColumns`):
| Col | Index | Field |
|-----|-------|-------|
| A | 0 | FullName |
| B | 1 | Guest1Name |
| C | 2 | Guest2Name |
| D | 3 | RSVP_Raw (JSON) |
| E | 4 | RSVPTotal |
| F | 5 | RSVPBeef_Count |
| G | 6 | RSVPFish_Count |
| H | 7 | RSVPSubmittedAt |
| I | 8 | RSVPSubmittedBy |
| J | 9 | FullNameHash_MD5 |
| K | 10 | Guest1FullName_MD5 |
| L | 11 | Guest2FullName_MD5 |
| M | 12 | LetterAddress |
| N | 13 | LetterMessage |
| O | 14 | LetterShowForAll |
| P | 15 | LetterSignedBy |

**Apps Script** - source of truth is `scripts/google-apps-script.js` in this repo. To deploy: copy contents into the Apps Script editor → Deploy → New deployment. Always create a new deployment version (not "Manage deployments") for changes to take effect. The deployed Web App URL goes into `SHEETS_CONFIG.gasWebAppUrl`.

- `generateMd5Hash(input)` returns a lowercase MD5 hex digest for a non-empty trimmed input string, or an empty string for blank input. Use this helper when populating per-guest hash columns in the Google Sheet.

**Admin page** (`/admin`) - Password-protected RSVP dashboard:

- Password stored in `environment.adminPassword`. Dev: `dev-admin`. Production: injected from GitHub secret at build time.
- Fetches guest list live from Sheets on login. Manual refresh button available.
- Table enumerates all individual guests (not grouped by row) with: Guest Name, Party Of, Meal Choice, RSVP badge, Date Submitted.
- The table includes a "Copy Invitation Link" button for each individual guest. It copies `window.location.origin + '/' + <guest-specific MD5 hash>` using `FullNameHash_MD5`, `Guest1FullName_MD5`, or `Guest2FullName_MD5` depending on the row.
- Summary cards: Total / Attending / Declined / Pending / Beef / Fish counts.
- Export button downloads `EleazMeadRSVP_<datetime>.xlsx` via SheetJS (`xlsx` package).

**SEO** - Dynamic tags are handled by `SeoService` (`src/app/shared/seo.service.ts`), injected eagerly from `App` (`src/app/app.ts`) so its `effect()` starts at bootstrap.

- Reacts to `TranslationService.locale()`, `TranslationService.translations()`, and the current route path. On change it updates: `<title>`, `meta[name=description]`, `meta[name=keywords]`, `meta[name=robots]`, `link[rel=canonical]`, `link[rel=alternate][hreflang=...]` (`en`, `fil`, `x-default`), and the `og:*` / `twitter:*` meta tags.
- Text templates live in i18n JSON under `seo.titleTemplate`, `seo.description`, `seo.keywords` (per locale), using `{0}`/`{1}`/`{2}` placeholders filled with `couple.name1`, `couple.name2`, `couple.weddingDate` at runtime - this keeps SEO copy translatable while sourcing facts from the existing `couple.*` keys (no duplication).
- Non-translatable SEO config (`siteUrl`, `ogImage`, `twitterCard`, `ogLocaleMap`) lives in `APP_CONFIG.seo` (`src/app/config/app.config.ts`).
- Any route other than `/` (i.e. `/admin` and `/:rsvpHash` invitation links, which expose personal guest data) gets `noindex, nofollow` and canonicalizes to the homepage. Never relax this for guest-hash routes.
- **Static fallback tags in `src/index.html`**: this is a client-rendered SPA with no SSR/prerendering. Social link-preview crawlers (WhatsApp, Facebook, X/Twitter, iMessage, Slack) do not execute JavaScript, so `SeoService`'s dynamic updates are invisible to them - they only ever see the raw HTML response. `index.html` therefore hardcodes English-default `<title>`, description, canonical, hreflang, and OG/Twitter tags as a fallback. **These must be manually kept in sync** with `public/i18n/en.json` (`seo.*`, `couple.*` keys) and `APP_CONFIG.seo` whenever the wedding date, venue, couple names, site domain, or OG image change.
- `public/og-image.jpg` (1200x630) is the image social crawlers show in link previews. Currently a center-crop of an Our Story photo as a placeholder - swap it for a deliberately composed photo when one is ready. Any replacement must stay exactly 1200x630 (or close) and be JPG/PNG, not AVIF/WebP.
- `public/CNAME` contains `eleazmead.com` - required for the custom domain (configured via Namecheap DNS + GitHub Pages) to persist across deploys. `public/` is copied verbatim into the build output, so this file travels with every deploy; without it, a GitHub-side settings refresh could silently revert Pages to serving from `eleazmead.github.io` instead.
- `public/robots.txt` disallows `/admin` and references `public/sitemap.xml`. `sitemap.xml` lists only the homepage - `/admin` and guest-hash invitation routes are intentionally excluded.
