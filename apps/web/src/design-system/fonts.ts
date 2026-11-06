import {
  Anek_Devanagari,
  Rozha_One,
  Tiro_Bangla,
  Tiro_Devanagari_Hindi,
  Tiro_Gurmukhi,
} from 'next/font/google';

/**
 * Three families, each with full Latin + Devanagari coverage so the two
 * scripts always share a voice. See design/typography.md.
 */

/** Masthead: high-contrast display for titles. Never below 28px. */
export const mastheadFont = Rozha_One({
  weight: '400',
  subsets: ['latin', 'devanagari'],
  variable: '--font-rozha',
  display: 'swap',
});

/** Story: the reading voice for narrative copy and Devanagari passages. */
export const storyFont = Tiro_Devanagari_Hindi({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin', 'devanagari'],
  variable: '--font-tiro',
  display: 'swap',
});

/** Utility: UI, labels, numerals. Width axis gives the condensed sign-painter caps. */
export const utilityFont = Anek_Devanagari({
  subsets: ['latin', 'devanagari'],
  axes: ['wdth'],
  variable: '--font-anek',
  display: 'swap',
});

/**
 * Sister faces of the story voice for names written in Gurmukhi and Bengali.
 * Not preloaded: the browser fetches them only when those glyphs appear.
 */
export const gurmukhiFont = Tiro_Gurmukhi({
  weight: '400',
  subsets: ['gurmukhi'],
  variable: '--font-tiro-gurmukhi',
  display: 'swap',
  preload: false,
});

export const banglaFont = Tiro_Bangla({
  weight: '400',
  subsets: ['bengali'],
  variable: '--font-tiro-bangla',
  display: 'swap',
  preload: false,
});

export const fontVariables = [
  mastheadFont.variable,
  storyFont.variable,
  utilityFont.variable,
  gurmukhiFont.variable,
  banglaFont.variable,
].join(' ');
