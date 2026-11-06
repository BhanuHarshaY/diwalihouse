/**
 * Guest emblems: the illustrated medallions a guest picks when joining.
 *
 * Only the identifiers and names are shared here; the artwork lives in the
 * web app's design system. The server validates against this list, so adding
 * an emblem means adding both an entry here and its artwork.
 */

export const EMBLEMS = [
  { id: 'diya', en: 'Diya', hi: 'दीया' },
  { id: 'kamal', en: 'Lotus', hi: 'कमल' },
  { id: 'genda', en: 'Marigold', hi: 'गेंदा' },
  { id: 'ambi', en: 'Paisley', hi: 'अंबी' },
  { id: 'patang', en: 'Kite', hi: 'पतंग' },
  { id: 'anaar', en: 'Flowerpot', hi: 'अनार' },
  { id: 'chakri', en: 'Spinner', hi: 'चकरी' },
  { id: 'lattu', en: 'Spinning top', hi: 'लट्टू' },
  { id: 'machhli', en: 'Fish', hi: 'मछली' },
  { id: 'mor', en: 'Peacock feather', hi: 'मोरपंख' },
  { id: 'suraj', en: 'Sun', hi: 'सूरज' },
  { id: 'chanda', en: 'Moon', hi: 'चंदा' },
] as const;

export type EmblemId = (typeof EMBLEMS)[number]['id'];

export const EMBLEM_IDS = EMBLEMS.map((emblem) => emblem.id) as [EmblemId, ...EmblemId[]];
