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
  // Getting to each venue. Stop codes/services come from LTA bus data (bus services can change: re-check
  // before the wedding); walking times are estimates. Line colours follow the official MRT map.
  transport: {
    mrtLineColors: {
      EW: '#009645',
      NS: '#d42e12',
      NE: '#9900aa',
      CC: '#fa9e0d',
      DT: '#005ec4',
      TE: '#9d5b25',
    },
    venues: {
      church: {
        mrt: [
          { name: 'Bencoolen', walkMinutes: 4, exit: 'B', codes: [{ line: 'DT', number: 21 }] },
          {
            name: 'Bugis',
            walkMinutes: 8,
            exit: 'C',
            codes: [
              { line: 'EW', number: 12 },
              { line: 'DT', number: 14 },
            ],
          },
        ],
        bus: [
          {
            name: "St. Joseph's Church",
            code: '01013',
            services: ['130', '133', '145', '197', '851', '851e', '960', '960e'],
          },
        ],
      },
      reception: {
        mrt: [
          {
            name: 'Raffles Place',
            walkMinutes: 5,
            exit: 'I',
            codes: [
              { line: 'NS', number: 26 },
              { line: 'EW', number: 14 },
            ],
          },
        ],
        bus: [
          {
            name: 'Fullerton Square',
            code: '03011',
            services: ['10', '10e', '57', '70', '100', '107', '130', '131', '167', '196', '196e'],
          },
        ],
      },
    },
  },
  rsvp: {
    // Fallback last day to RSVP (inclusive, SGT). The live value is the RSVP_DEADLINE script property.
    deadlineDate: '2026-12-16',
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
