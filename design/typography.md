# Typography

Three families, each with full Latin **and** Devanagari coverage, so the two scripts always share a voice. All are served by `next/font/google` (self-hosted at build time) and licensed under the SIL Open Font License 1.1.

| Role         | Family                                                            | Why                                                                                                                                           | Where                                                             |
| ------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Masthead** | Rozha One (Indian Type Foundry)                                   | High-contrast display with a matched Devanagari. It has the feel of a Hindi film title or a newspaper masthead: festive without being kitsch. | Headlines ≥ 28px, room names, the wordmark.                       |
| **Story**    | Tiro Devanagari Hindi (Tiro Typeworks)                            | A literary serif with a true italic and fine Devanagari. The reading voice.                                                                   | Narrative copy, Devanagari passages, **all Devanagari numerals**. |
| **Utility**  | Anek Devanagari (Ek Type), variable `wdth` 75–125, `wght` 100–800 | One family gives both the condensed sign-painter caps of the poster references (`wdth` 75–80) and comfortable UI text (`wdth` 100).           | Body UI, labels, buttons, forms, numerals in Latin.               |

Two sister faces cover names written in other scripts, so they don't fall back to mismatched system fonts:

| Script   | Family        | Loaded                                                                         |
| -------- | ------------- | ------------------------------------------------------------------------------ |
| Gurmukhi | Tiro Gurmukhi | `preload: false`, fetched only when Gurmukhi glyphs appear (Bandi Chhor Divas) |
| Bengali  | Tiro Bangla   | `preload: false` (Kali Puja)                                                   |

Font definitions: `apps/web/src/design-system/fonts.ts`. Stacks: `--font-masthead`, `--font-story`, `--font-utility` in `globals.css`.

## Type roles

Every text element uses one of these classes (defined in `globals.css`), so hierarchy stays consistent across rooms.

| Class              | Family                           | Size                      | Line height | Notes                              |
| ------------------ | -------------------------------- | ------------------------- | ----------- | ---------------------------------- |
| `type-masthead-xl` | Rozha                            | clamp(3.75rem → 10rem)    | 1.05        | One per screen at most (दीपावली).  |
| `type-masthead-lg` | Rozha                            | clamp(2.5rem → 5.5rem)    | 1.04        | Page titles.                       |
| `type-masthead-md` | Rozha                            | clamp(1.875rem → 3.25rem) | 1.08        | Section and entry titles.          |
| `type-story-lg`    | Tiro                             | clamp(1.25rem → 1.625rem) | 1.45        | Ledes, Devanagari subtitles.       |
| `type-story`       | Tiro                             | 1.125rem                  | 1.6         | Narrative paragraphs.              |
| `type-title`       | Anek 600, wdth 88                | clamp(1.25rem → 1.625rem) | 1.2         | UI section headings.               |
| `type-label`       | Anek 600, wdth 78, caps, +0.08em | 0.9375rem                 | 1.1         | Buttons, field labels, links.      |
| `type-eyebrow`     | Anek 500, wdth 75, caps, +0.2em  | 0.8125rem                 | 1.2         | Kickers above titles.              |
| `type-small`       | Anek                             | 0.9375rem                 | 1.45        | Notes, hints.                      |
| `type-numeral`     | Anek 600, wdth 82, tabular       | inherits                  | —           | Invite codes, scores, chip counts. |

Body text is Anek at 17px (1.0625rem), line height 1.55.

## Rules

1. **Never letter-space Devanagari (or any Indic script).** Tracking breaks the shirorekha, the headline stroke that joins letters. `globals.css` resets `letter-spacing` and `text-transform` on `[lang=hi|sa|ne|bn|pa]`, so any Devanagari inside a spaced-caps eyebrow must carry `lang`.
2. **Mark the language.** Every Devanagari, Gurmukhi or Bengali run gets a `lang` attribute (`hi`, `sa`, `ne`, `pa`, `bn`). This drives the tracking reset, line height, screen-reader pronunciation and font selection.
3. **Rozha One draws Devanagari digits with Latin shapes.** It maps U+0966–096F to glyphs that look like 0–9. Use Tiro for Devanagari numerals (the Scene 2 markers do). We verified this by rendering both faces side by side.
4. **Devanagari needs vertical room.** `[lang=hi]` gets line height 1.6; display Devanagari gets at least 1.05. Never clip a Devanagari line with `overflow: hidden` at its line box.
5. **Rozha below 28px loses its hairlines.** Use Anek or Tiro instead.
6. **Pair, don't translate.** A Devanagari line under a Latin headline is a second voice ("On the darkest night…" / "अमावस की रात, एक दीया"), not a word-for-word subtitle.
7. **Don't fake Hindi.** Transliterations and translations must be checked by a fluent reader before launch. All current Devanagari strings are listed in `asset-manifest.md` § Copy for review.

## Performance

- Rozha, Tiro Devanagari and Anek are preloaded for their Latin and Devanagari subsets. Gurmukhi and Bengali are not preloaded.
- `display: swap` on all faces. Fallback stacks (`Iowan Old Style`, Georgia, `system-ui`) are chosen to keep metrics close and minimise layout shift.
- A future optimisation is to subset Rozha to the glyphs actually used in headlines, since it is used only for display.
