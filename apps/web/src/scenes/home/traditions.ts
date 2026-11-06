/**
 * Scene 2 content: some of the traditions behind Diwali.
 *
 * Editorial rules (design/visual-direction.md § Cultural content):
 *  - No single account is presented as *the* meaning of Diwali.
 *  - Attribute each story to the people who tell it ("many families",
 *    "for Jains"), and hedge where practice varies.
 *  - Name each tradition in the script of the community most associated
 *    with it, when that is clear.
 *  - This copy has not yet had community review. Treat it as a draft until
 *    it has (docs/roadmap.md, Phase 2).
 */

export interface Tradition {
  id: string;
  /** Who keeps it, or where. */
  who: string;
  title: string;
  /** Native-script name and its BCP 47 language tag. */
  native: { text: string; lang: string };
  body: string;
  /**
   * Commissioned illustration, when it exists. See design/asset-manifest.md
   * (SCN2-*). Entries render without one; there are no placeholders.
   */
  illustration?: { src: string; alt: string; width: number; height: number };
}

export const TRADITIONS: Tradition[] = [
  {
    id: 'ayodhya',
    who: 'Across much of North India',
    title: 'Rama comes home',
    native: { text: 'अयोध्या', lang: 'hi' },
    body: 'Many families remember the return of Rama to Ayodhya with Sita and Lakshmana after fourteen years of exile. The lamps are often said to recall how the city lit up to welcome them home.',
  },
  {
    id: 'lakshmi',
    who: 'In homes and shops across India',
    title: 'An open door for Lakshmi',
    native: { text: 'लक्ष्मी पूजा', lang: 'hi' },
    body: 'On the new-moon night, families clean, decorate and light their homes for Lakshmi Puja, welcoming the goddess of prosperity and good fortune. For many trading communities this is also when the new account books are opened.',
  },
  {
    id: 'narakasura',
    who: 'In much of South India',
    title: 'The dawn after Narakasura',
    native: { text: 'नरक चतुर्दशी', lang: 'sa' },
    body: 'Here the celebration often centres on Naraka Chaturdashi, which marks the defeat of the demon king Narakasura by Krishna, in many tellings alongside Satyabhama. The day can begin before sunrise, with an oil bath, new clothes and the first fireworks.',
  },
  {
    id: 'kali',
    who: 'In Bengal, Assam and Odisha',
    title: 'A night for Kali',
    native: { text: 'কালী পূজা', lang: 'bn' },
    body: 'The same new moon is kept as Kali Puja, in honour of the goddess Kali. In Bengal, families often light fourteen lamps on the evening before, one for each generation of their ancestors.',
  },
  {
    id: 'mahavira',
    who: 'For Jains',
    title: 'The nirvana of Mahavira',
    native: { text: 'महावीर निर्वाण', lang: 'hi' },
    body: 'Jains mark the day on which Mahavira, the twenty-fourth Tirthankara, attained nirvana at Pavapuri. Tradition holds that when the light of his knowledge passed from the world, people lit lamps in its place.',
  },
  {
    id: 'bandi-chhor',
    who: 'For Sikhs',
    title: 'The Day of Liberation',
    native: { text: 'ਬੰਦੀ ਛੋੜ ਦਿਵਸ', lang: 'pa' },
    body: 'Sikhs celebrate Bandi Chhor Divas, remembering the release of Guru Hargobind from imprisonment in Gwalior Fort, together with fifty-two princes held there with him. The Harmandir Sahib in Amritsar is lit for the occasion.',
  },
  {
    id: 'five-days',
    who: 'Over five days',
    title: 'Many days, many names',
    native: { text: 'धनतेरस से भाई दूज', lang: 'hi' },
    body: 'Diwali is often a run of festivals rather than a single night: Dhanteras, Naraka Chaturdashi, Lakshmi Puja, then Govardhan Puja, Padwa or the new year, and Bhai Dooj. Which days are kept, and what they are called, changes from region to region and family to family.',
  },
  {
    id: 'beyond',
    who: 'Beyond India',
    title: 'Lamps around the world',
    native: { text: 'तिहार', lang: 'ne' },
    body: 'In Nepal the festival is Tihar, five days that honour crows, dogs and cows as well as brothers and sisters. And Diwali travels with its people: it is a public holiday in Fiji, Mauritius, Trinidad and Tobago, Malaysia, Singapore and Sri Lanka, and Leicester holds one of the largest celebrations outside India.',
  },
];

/** Devanagari numerals for the entry markers. */
export const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
