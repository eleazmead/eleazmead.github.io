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
    giftQrCodes: {
      philippines: 'gift/bdo-qr.jpg',
      singapore: 'gift/paynow-qr.png',
    },
  },
  mealChoices: {
    options: ['beef', 'fish'] as const,
  },
  whatToWear: {
    colorGuide: {
      ladies: ['#b69883', '#d8a3a2'] as const,
      gentlemen: ['#A9A9A9', '#b69883', '#f6f5f5', '#d8a3a2'] as const,
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
    deadlineDate: '2026-10-16',
  },
  questionsAndAnswers: {
    items: ['plusOnes', 'kids', 'flightAccom', 'giftBlessing'] as const,
    giftBlessing: {
      philippines: {
        accountName: 'Eleaz Mead',
        accountNumber: '0072 2009 3540',
      },
      singapore: {
        accountName: 'Umandal Mead Rose Ann Inacay',
        mobileNumber: '+65 9199 7736',
      },
    },
  },
  contacts: {
    whatsappUrl: 'https://wa.me/6582974687',
    // A static exported image/PDF has no clickable link, so the export
    // invitation's RSVP-status box needs the number as plain readable text
    // too, not just the wa.me deep link.
    whatsappDisplayNumber: '+65 8297 4687',
  },
  exportInvitation: {
    // 2:3 portrait, rasterized at html2canvas scale 1.5 (see CAPTURE_SCALE) as JPEG.
    pageWidth: 1080,
    pageHeight: 1620,
    coverStoryItemId: 'bigDay',
  },
  calendarEvent: {
    // 1:00 PM - 10:00 PM SGT (Asia/Singapore, UTC+8, no DST) on 16 Jan 2027.
    timeZone: 'Asia/Singapore',
    start: '20270116T130000',
    end: '20270116T220000',
    location: "St. Joseph's Church, 143 Victoria Street, Singapore 188020",
  },
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'fil', 'zh'] as const,
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
      zh: 'zh_SG',
    },
  },
} as const;
