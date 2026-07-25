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
    heroBackdropAvif: 'hero/EleazMead_hero_centered-4K-ezgif.com-video-to-avif-converter.avif',
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
      gentlemen: ['#b69883', '#d8a3a2', '#1e1e1e', '#f6f5f5'] as const,
    },
  },
  rsvp: {
    deadlineDate: '2026-10-31',
  },
  questionsAndAnswers: {
    items: ['plusOnes', 'rsvpDeadline','dressCode'] as const,
  },
  contacts: {
    whatsappUrl: 'https://wa.me/6582974687',
  },
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fil'] as const,
  },
} as const;
