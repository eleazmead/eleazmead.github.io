export const GRATITUDE_GROUPS = [
  { note: 'withGratitude.parentsNote', items: ['groomsParents', 'bridesParents'] },
  { note: 'withGratitude.weddingPartyNote', items: ['witnesses', 'ringBearer'] },
] as const;

export type GratitudeItemId = (typeof GRATITUDE_GROUPS)[number]['items'][number];
