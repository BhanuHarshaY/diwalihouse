# Illustration specification

A brief for anyone, in-house or commissioned, producing artwork for Diwali House. Read `visual-direction.md` first; this document turns it into construction rules.

## 1. Style in one paragraph

Flat, screen-printed illustration in the tradition of Indian matchbox labels, royal playing cards and folk miniature painting. Figures and objects are built from flat shapes in a limited set of inks, with ornament carried by brass linework and dot fills. There is no perspective beyond a gentle frontal three-quarter view, no gradients, no soft shading, and no black keylines. Compositions are symmetrical around one motif and sit inside a frame.

## 2. Construction rules

| Rule                  | Spec                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inks**              | Only pigments from the palette (`visual-direction.md` § 3). At most 5 inks per illustration, plus ivory.                                                                                            |
| **Shading**           | One darker step of the same hue, as a flat shape (e.g. vermilion 700 under vermilion 600). Never a gradient, never black.                                                                           |
| **Linework**          | Brass 400/500 or marigold 400 for ornament. On the 64-unit emblem grid lines are 1–1.6 units; on large scenes they scale to 2.4–3 units at 1×. No hairlines under 1px at the smallest display size. |
| **Dots**              | Dot fills and dot borders are the main texture. Dots are perfect circles, evenly spaced along a path.                                                                                               |
| **Outlines**          | None. Shapes are separated by ink, not by keylines. (The DJ poster's black outlines are a deliberate departure we don't follow.)                                                                    |
| **Light**             | Light is never painted into an illustration. Glow is added in code, on its own layer, so it can be animated and turned off.                                                                         |
| **Texture**           | Never baked into the artwork. Grain is applied by the surface, so the illustration stays crisp and small.                                                                                           |
| **Figures**           | Profile or frontal, after Pahari and Rajasthani miniatures: long eyes, flat garments filled with pattern. Diverse skin tones drawn from ivory 300 through vermilion 800 and maroon.                 |
| **Religious figures** | Not drawn. Scenes about Rama, Lakshmi, Krishna, Kali, Mahavira or Guru Hargobind are told with objects, architecture and light: lamps, a doorway, footprints, a fort.                               |

## 3. Deliverables

| Kind                                     | Format                                                                                                                 | Notes                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Static illustration                      | **SVG**, optimised (SVGO, precision 1–2), no embedded rasters, no `<text>`, no filters, IDs prefixed with the asset ID | Colours as hex from the palette. Groups named for parts that will animate.                     |
| Interactive illustration                 | **Rive** (`.riv`) plus the source `.rev`                                                                               | State machines named per the brief. Must also ship a static SVG fallback of the default state. |
| Photographic or painterly texture (rare) | AVIF + WebP at 1× and 2×, sRGB                                                                                         | Only where SVG can't carry it.                                                                 |

All production assets go in `apps/web/public/assets/<area>/<asset-id>.<ext>`. Every asset gets a row in `asset-manifest.md`, with source and licence, **before** it is merged.

## 4. Emblems (guest avatars): implemented

Twelve medallions in `apps/web/src/design-system/emblems/art.tsx`, drawn in code on a 64-unit grid:

- Brass rim (r 32), field (r 29.6), a dotted inner ring of 56 dots (r 27.2), and a motif within r 20 of the centre.
- At most three inks plus ivory per motif. Each field colour is distinct, so emblems stay distinguishable at 32px.
- Set: diya, kamal (lotus), genda (marigold), ambi (paisley), patang (kite), anaar (flowerpot), chakri (spinner), lattu (spinning top), machhli (fish), mor (peacock feather), suraj (sun), chanda (moon).

These are deliberately symbolic rather than portraits. Character avatars are a future commission (AV-*).

## 4b. Arch windows: implemented

`apps/web/src/illustrations/ArchWindow.tsx`, on a 200 × 250 grid:

- A **wall** colour fills the tile. A cusped arch (3 foils, spring at y 108, apex at y 16) is cut in a **ground** colour, with a dotted border of 64 dots inside it.
- The motif is drawn in a **120 × 150 box** placed at (40, 92) and clipped to the arch. Hanging things (lanterns, garlands) may extend upwards to y −64.
- Every motif is built from shared primitives (`primitives.tsx`: flame, small diya, sparkle, marigold, dotted line). That keeps flames, lamps and flowers identical across all windows.
- **Motion lives on inner groups** with CSS classes from `illustrations.module.css`. Placement stays on the outer group's `transform` attribute, so the two never fight. Loops run only while the window is on screen.

## 4c. People: implemented

`apps/web/src/illustrations/people.tsx` builds every figure from a `PersonSpec`: size, skin, hair, outfit, two arm poses, what they hold, and face details. The cast lives in `gatherings.tsx`.

- **Proportions:** 100-unit-wide box, feet on the floor line. Adults are about 6 heads tall, children about 4: chunky, after the poster references. Head radius is 15 for adults and 14 for children.
- **One face for everyone:** closed, smiling eyes, a small smile and soft cheeks, as in miniature painting. Identity comes from hair, dress, skin tone and what a person carries, never from exaggerated features.
- **Skin** uses the five _mitti_ tones only. Hair is night-950, maroon-900 or ivory-200 (grey).
- **Dress** is flat with one trim colour; pattern sits at hems, borders and the saree pallu. Supported: kurta (with Nehru jacket or shawl), saree, lehenga with dupatta, kurti with jeans, frock.
- **Head coverings** (dastar, hijab) are drawn neatly and fully, never as a costume or a joke. The beard under a dastar takes its own colour (`face.whiskers`).
- **Poses:** down, hold, raise, wave, cane, selfie. Held objects come from the shared set (sparkler, diya, thali, sweets, gift, phone, cane) and must contrast with the holder's clothes.
- **Motion:** each figure arrives in turn the first time its window is seen, then sways slightly about the feet. Children bob, a waving arm waves from the shoulder, sparklers twinkle. All of it is paused off-screen and removed under reduced motion.
- **The cast stays varied** in age, skin tone, dress and faith. New people are added as specs, not as new drawings.

## 5. Integration points

The code is built so artwork can drop in without restructuring:

- **Scene 2 traditions**: each entry in `apps/web/src/scenes/home/traditions.ts` has an optional `illustration` field (`src`, `alt`, `width`, `height`). When set, it renders under the copy via `next/image`. When absent, nothing renders. There are no placeholders.
- **Rooms**: `apps/web/src/party/RoomsOfHouse.tsx` lists the rooms. When a room ships, its entry gains an `href` and artwork.
- **Rive**: not yet a dependency. The first `.riv` asset will add `@rive-app/react-canvas`, lazy-loaded behind `next/dynamic` and with an SVG fallback for reduced motion and slow devices. We won't add it before an asset exists.

## 6. Rive briefs (for the first commissions)

| ID      | Piece                                               | State machine | Inputs                                                      |
| ------- | --------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| RIVE-01 | Hero diya flame (optional upgrade of the SVG flame) | `flame`       | `lean` (number −1…1), `ignite` (trigger), `intensity` (0…1) |
| RIVE-02 | Rangoli Courtyard brush                             | `brush`       | `colour` (number index), `stroke` (trigger)                 |
| RIVE-03 | Teen Patti dealer hands                             | `deal`        | `cards` (number), `deal` (trigger), `show` (trigger)        |

Rive pieces must hold 60fps on a mid-range Android phone (e.g. Pixel 6a) at their display size, and their artboards must use only palette colours.
