# Eleazmead

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## RSVP guest search

Guest lookup is invitation-link based. The public route `/:rsvpHash` reads an MD5 hash from the URL path and matches it against the Google Sheet `FullNameHash_MD5`, `Guest1FullName_MD5`, or `Guest2FullName_MD5` column. The bare `/` route shows an invite-only message instead of a search form.

The RSVP note and deadline are configurable in the i18n JSON files. The deadline date uses `rsvp.deadline.date` so it can be emphasized separately from the rest of the note. This note only appears when the URL contains an invitation hash.

The RSVP form shows the configurable `rsvp.reviewReminder` venue reminder immediately above the "Review your RSVP" button.

The main-course required message is cleared when a guest changes attendance or is excluded, so it only stays visible while an included attending guest still needs to choose a meal.

Guests who have already RSVP-ed can use their invitation link before the deadline to update their own attendance and main course. Existing responses are prefilled from the sheet. `APP_CONFIG.rsvp.deadlineDate` stores the machine-readable cutoff date, and the site blocks new submissions and updates once the current Singapore date is later than or equal to that date.

## Hero and event details

The first section uses `APP_CONFIG.assets.heroBackdropAvif` as the animated AVIF backdrop path, and personalizes `public/i18n/en.json` `hero.headline` by replacing `{0}` with the matched guest's first name. If the Guest Letter section is shown, the headline uses `LetterAddress` instead. If no RSVP hash is present, it uses `hero.noInputGreeting`. All display text, including couple names, event date, venues, RSVP copy, meal labels, footer copy, language toggle labels, and admin labels, lives in `public/i18n/en.json` and `public/i18n/fil.json`.

While the matched guest name is loading, the hero shows `Hi there,` instead of generic guest text.

The hero shows the wedding date above the couple names. Ceremony and reception details appear as two glow-backed text columns on desktop and collapse to one column with extra spacing on mobile, without box-like containers. Ceremony and reception times live in `hero.ceremonyTime` and `hero.receptionTime` in the i18n JSON files.

Section headings are plain display text without decorative `::after` underline elements.

The hero RSVP CTA scrolls to the RSVP section with an explicit click handler while keeping the `#rsvp` anchor href. When the Guest Letter section is shown, the CTA is hidden in the hero and appears centered at the bottom of the letter instead.

When the matched RSVP sheet row has both `LetterAddress` and `LetterMessage`, a handwritten-style Guest Letter section appears after the hero if the URL RSVP hash matches `FullNameHash_MD5`, or if it matches `Guest1FullName_MD5` / `Guest2FullName_MD5` and `LetterShowForAll` is `1`. The letter is styled as white stationery with subtle burnt edges. The closing signature name uses `LetterSignedBy` from the sheet when present, otherwise it falls back to `guestLetter.coupleName` from the i18n JSON files.

The language toggle switches the site between English and Tagalog. Keep both i18n JSON files structurally complete whenever copy changes; keep non-text settings such as theme color, backdrop AVIF path, stable option IDs, and WhatsApp URL in `src/app/config/app.config.ts`.

The global visual theme uses a subtle wedding-stationery background with warm vellum tones, lace-like linework, and blush/taupe washes behind the sections.

Public content sections use tighter mobile-first vertical spacing and expand at desktop breakpoints, so the page remains compact on phones while still feeling spacious on larger screens.

The Our Story section renders a timeline. Timeline dates, titles, and narratives live in the i18n JSON files. Timeline photos are loaded by filename from `public/our-story/`: use `Mmm_YYYY_1` for the required first image and `Mmm_YYYY_2` for the optional second image, for example `Sep_2016_1.png` and `Sep_2016_2.jpg`. Supported extensions are `.jpg`, `.jpeg`, and `.png`; matching is case-insensitive. Run `npm run generate-gallery` after adding photos, or restart the dev server, so `public/our-story/manifest.json` is updated. The site shows a maximum of two photos side by side per timeline item.

## Venues

The third section highlights the ceremony and reception venues. Venue names, descriptions, addresses, and placeholder text live in the i18n JSON files. On desktop, the two venue items render in two columns.

Venue photo paths are configured in `APP_CONFIG.assets.venuePhotos`. Put the files under `public/venues/`, for example `public/venues/st-josephs-church.jpg` and `public/venues/the-lighthouse-fullerton.jpg`. Real venue photos preserve their natural aspect ratio, are centered at 70% width within each venue item, and are not cropped.

## Wedding Timeline

The section after RSVP shows the wedding day sequence. Event times, titles, descriptions, and the stay-tuned note live in the i18n JSON files.

## What to Wear

The What to Wear section appears after the Wedding Timeline. Attire wording, the color-guide label, and the attire guide title live in the i18n JSON files. The attire guide image path is configured in `APP_CONFIG.assets.attireGuideImage`, and the ladies/gentlemen swatch colors are configured in `APP_CONFIG.whatToWear.colorGuide`. Put the image under `public/attire/`, for example `public/attire/wedding-attire-guide.jpg`. The attire guide image is centered at 70% width with a white border on stacked layouts, and appears in a second desktop column beside the attire copy.

## Gift Registry

The Gift Registry section appears after What to Wear. Its wording lives in the i18n JSON files.

## Questions & Answers

The Questions & Answers section appears after Gift Registry. Add a new Q&A by adding a stable ID to `APP_CONFIG.questionsAndAnswers.items`, then adding matching `questionsAndAnswers.items.<id>.question` and `questionsAndAnswers.items.<id>.answer` keys in the i18n JSON files.

## Google Apps Script

The deployable Google Apps Script source is `scripts/google-apps-script.js`. It includes `generateMd5Hash(input)`, which returns a lowercase MD5 hex digest for a non-empty trimmed input string and an empty string for blank input.

## Admin Dashboard

The admin table includes a configurable "Copy Invitation Link" column. Each row copies the current browser origin plus the individual guest's RSVP MD5 hash from the sheet.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
