export const APP_CONFIG = {
  theme: {
    colorPrimary: '#B8957E',
    colorSecondary: '#121212',
    colorAccent: '#D9A0A8',
    colorBackground: '#FBF7F2',
    colorText: '#1A1715',
    colorMuted: '#8B776B',
    fontDisplay: '"Cormorant Garamond", serif',
    fontBody: '"Jost", sans-serif',
  },
  assets: {
    heroBackdropWebm: 'hero/EleazMead_hero.webm',
    heroBackdropMp4: 'hero/hero-backdrop.mp4',
    attireGuideImage: 'attire/wedding-attire-guide.jpg',
    venuePhotos: {
      church: 'venues/st-josephs-church.jpg',
      reception: 'venues/the-lighthouse-fullerton.jpg',
    },
  },
  mealChoices: {
    options: ['beef', 'fish'] as const,
  },
  whatToWear: {
    colorGuide: {
      ladies: ['#b69883', '#d8a3a2'] as const,
      gentlemen: ['#A9A9A9','#b69883','#f6f5f5', '#d8a3a2'] as const,
    },
  },
  whereToStay: {
    hotelGroups: [
      {
        id: 'budget',
        hotels: ['hotelMi', 'vHotel', 'ibis'] as const,
      },
      {
        id: 'comfort',
        hotels: ['lyfFunan', 'carlton'] as const,
      },
    ] as const,
  },
  rsvp: {
    deadlineDate: '2026-10-31',
  },
  questionsAndAnswers: {
    items: ['plusOnes', 'kids', 'flightAccom'] as const,
  },
  contacts: {
    whatsappUrl: 'https://wa.me/6582974687',
  },
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fil'] as const,
  },
  seo: {
    // Canonical production origin - update if the custom domain changes.
    siteUrl: 'https://eleazmead.com',
    // 1200x630 recommended. JPG/PNG only - AVIF/WebP are not reliably
    // rendered by social link-preview crawlers (WhatsApp, Facebook, X).
    ogImage: 'og-image.jpg',
    twitterCard: 'summary_large_image',
    ogLocaleMap: {
      en: 'en_US',
      fil: 'fil_PH',
    },
  },
} as const;
