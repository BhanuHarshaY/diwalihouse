/**
 * The pigment list as JS values, for SVG artwork that needs literal colours.
 * Must mirror the `@theme` block in styles/globals.css; palette.test.ts
 * fails the build if the two drift apart.
 */
export const PALETTE = {
  night950: '#0a0d27',
  night900: '#12163d',
  night800: '#1a2052',
  night700: '#252d6b',
  night600: '#343e8a',
  peacock800: '#084a49',
  peacock700: '#0a5e5c',
  peacock600: '#0e7471',
  peacock500: '#138a84',
  peacock300: '#6cbcb1',
  marigold700: '#b06908',
  marigold600: '#d9850f',
  marigold500: '#f0a020',
  marigold400: '#f6b83f',
  marigold200: '#fbdc97',
  vermilion800: '#7e1f14',
  vermilion700: '#a82a1a',
  vermilion600: '#c9381f',
  vermilion500: '#e04a2c',
  ivory50: '#fbf5e6',
  ivory100: '#f4ead2',
  ivory200: '#e9dab8',
  ivory300: '#d8c59a',
  brass700: '#8c6a27',
  brass500: '#c29a48',
  brass400: '#d8b565',
  maroon900: '#3a1014',
  maroon800: '#5e1a1e',
  rani500: '#d9457a',
  jamun900: '#3b1030',
  jamun700: '#5e1a45',
  gulab400: '#ec7b8a',
  mitti100: '#f2cba6',
  mitti300: '#d9a073',
  mitti500: '#b5764e',
  mitti700: '#85523a',
  mitti900: '#573427',
} as const;

export type Pigment = keyof typeof PALETTE;
