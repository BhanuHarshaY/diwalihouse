# Visual direction

**Working name: Printed Light.** Diwali House is a house made of printed things — matchbox labels, playing cards, postage stamps, cinema posters — and it is night. Light reveals it.

This document is the art direction. When a screen, illustration or component is in doubt, it should be judged against the principles here, not against general taste.

---

## 1. What the references say

Seven references live in `design/references/`. They are reference only: none of them is licensed for use, and nothing from them may be traced, sampled or shipped (see `asset-manifest.md`).

| Reference              | What it is                                                                                                                          | What we take                                                                                                                                                                                                       | What we leave                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `diwaliposter.png`     | Flat vector poster: figures making a rangoli inside a proscenium of tiered arches, bulb strings, brass lamps.                       | **Frame-within-frame** composition, bulb dots along every architectural line, strict symmetry around one central motif, cerulean + marigold + coral. Condensed display caps with a solid offset shadow.            | The cyan-heavy palette; figures drawn in a generic flat-vector style.                                                                       |
| `carddeck.png`         | Royal playing cards (Rajasthani miniature figures in gold line on teal and vermilion; arched-door card back; rangoli chips).        | **Brass linework on saturated grounds**, dot-filled textiles, an inset rule just inside every card edge, the carved door with green panels, chips as medallions. The colour pairing of peacock teal and vermilion. | The specific court-card figures, which are someone else's designs. Our Teen Patti faces must be original (see `asset-manifest.md`, CARD-*). |
| `folkposter.png`       | "Swadesi Night" poster: perforated stamp edge, truck-art vernacular lettering mixing Latin and Devanagari, cobras, elephants, eyes. | The **postage-stamp perforation** (now the invitation surface), Latin–Devanagari hybrid lettering as an idea, paper texture under print.                                                                           | The maximal density, hot magenta and purple, and the eye/cobra iconography.                                                                 |
| `rajamantrisiphai.png` | A Pahari/Rajput miniature painting: a procession on a flat chrome-yellow ground inside a vermilion border.                          | **The flat field**: no perspective, no gradients, rhythm made by repetition. The vermilion border with a thin dark rule. Figures in profile.                                                                       | Copying any part of the painting itself.                                                                                                    |
| `cracker.png`          | "The only पटाका…" — retro sunburst, risograph grain, witty bilingual copy.                                                          | **Wit in copy**, Devanagari as display type rather than translation, print grain, the sunburst (used in the doorway's tympanum).                                                                                   | The rough marker illustration style.                                                                                                        |
| `sweets.png`           | Illustrated mithai thali with an engraved brass bowl.                                                                               | Brass vessels with incised pattern; food as spot illustration for later rooms.                                                                                                                                     | Soft airbrushed shading (it does not match the flat print system).                                                                          |
| `dj.png`               | "Diwali Night" poster: a DJ in a yellow saree, baroque gold corners, vertical text bands of "GAMES • FOOD • DRINKS".                | **Text bands as borders** (labels along frames), the confidence of one large figure on a flat colour field — the direction for Music Mehfil.                                                                       | Heavy black outlines, halftone, generic starbursts.                                                                                         |

| `motif-sheet.png` | A sheet of hand-drawn Diwali elements: rangoli mandalas, marigolds, paisleys, dotted onion-arch frames, patterned diyas. | The **motif vocabulary**: concentric mandalas with solid colour bands, marigolds as units of ornament, dotted arch borders. | The coloured outlines and neon pinks and purples: we stay flat and print-like. |
| `arch-windows.png` | A grid of cusped arch windows, each holding one flat motif (diya, lantern, laddoos, footprints, elephants) on warm grounds. Stock image with a "Magnific" watermark. | The **arch-window system** used for Scene 2 and the party's rooms: one motif per window, a wall colour plus an arch colour, warm plum and rose grounds. | The specific icons, and the Om panel: we don't use religious symbols as decoration. |

`saloon.wtf` (the reference site) currently renders a minimal JavaScript shell: a "Deluxe Saloon" name, a "30 online" presence counter, a Hindi film single with an audio player, and playlist links. Its lesson is the **personality of a live room** — who is here, what is playing — rather than any visual system. We could not inspect its visuals beyond that.

### The common language

1. **Everything is framed.** Outer band → hairline rule → field. Borders carry information (bulbs, perforations, text bands); the field stays calm.
2. **Symmetry around one motif.** A lamp, an arch, a rangoli, a figure. Off-centre composition is the exception that needs a reason.
3. **Flat inks, few of them.** Four to six inks per surface, as if screen-printed. Shading is a second, darker ink of the same hue — never a gradient.
4. **Brass line on saturated grounds.** Ornament is drawn as gold/brass linework and dot fills, not as extra colour.
5. **Pattern at the edges, calm in the middle.** Dots, lozenges, scallops and toran valances live in borders and bands.
6. **Two scripts, one voice.** Devanagari is display type in its own right, not a subtitle.
7. **Print, not glass.** Paper grain, solid offset shadows, slight registration. No blur except light.

---

## 2. Principles for Diwali House

**Night is the ground.** Public and narrative surfaces sit on midnight indigo. Ivory paper is reserved for reading and forms, a printed object you hold in the dark.

**Light means live.** Marigold glow is the one effect we allow, and it has a meaning: something is happening now. A lit lamp, a live party, your turn, the song now playing. Static UI never glows. (In the party hall the only lit element is the "house is open" dot.)

**Ornament has a job.** A border marks an edge, a bulb string marks a path, a medallion marks identity. If an ornament has no job, remove it.

**One surface, one idea.** Each scene or room has one central motif. The homepage is a lamp, then a row, then a doorway.

**Windows, not cards.** Content that pairs an illustration with words sits in an arch window, a wall colour around an arch colour with one motif on the sill. Never a rounded rectangle with a drop shadow.

**Everyone belongs in the house.** People in the illustrations are varied in age, skin tone, dress and faith: grandparents and children, a friend in a dastar, a friend in a hijab. Diwali parties bring people together, and the art should look like the guests.

**Honest emptiness.** A room that is not built yet says so in a designed way. No placeholder art, no fake buttons, no lorem.

**Respect over decoration.** Cultural content is attributed to the people who keep it, hedged where practice varies, and never reduced to one story. Religious figures are not drawn as decoration.

---

## 3. Palette

The palette is closed. Tailwind's default colours are disabled (`--color-*: initial` in `apps/web/src/styles/globals.css`), so a colour outside this list cannot be used by accident. `apps/web/src/design-system/palette.ts` mirrors it for SVG artwork, and a unit test fails if the two drift.

| Pigment                     | Steps                                                                         | Role                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Night** (midnight indigo) | 950 `#0a0d27` · 900 `#12163d` · 800 `#1a2052` · 700 `#252d6b` · 600 `#343e8a` | Ground of the house. 900 is the default surface; 950 the deepest night (Scene 1); 800 raised panels. |
| **Peacock** (teal)          | 800 · 700 `#0a5e5c` · 600 `#0e7471` · 500 `#138a84` · 300 `#6cbcb1`           | Second ground, card tables, door panels, emblem fields.                                              |
| **Marigold**                | 700 `#b06908` · 600 · 500 `#f0a020` · 400 `#f6b83f` · 200 `#fbdc97`           | Light. Flames, live state, primary action on night, Devanagari display on night.                     |
| **Vermilion** (sindoor)     | 800 `#7e1f14` · 700 `#a82a1a` · 600 `#c9381f` · 500 `#e04a2c`                 | Clay, doors, primary action on paper, stamp ink.                                                     |
| **Ivory**                   | 50 `#fbf5e6` · 100 `#f4ead2` · 200 · 300 `#d8c59a`                            | Paper and text on night. 300 is muted text on night.                                                 |
| **Brass**                   | 700 `#8c6a27` · 500 `#c29a48` · 400                                           | Linework, rules, studs. Never body text.                                                             |
| **Maroon**                  | 900 · 800                                                                     | Oil, deep ink, card pips.                                                                            |
| **Rani** (festive pink)     | 500 `#d9457a`                                                                 | A seasoning. Lotus petals, the odd accent. Never a surface or a button.                              |
| **Jamun** (plum)            | 900 `#3b1030` · 700 `#5e1a45`                                                 | Warm night grounds for arch windows. Added after the arch-window reference.                          |
| **Gulab** (rose)            | 400 `#ec7b8a`                                                                 | Wall and ground colour for windows only. Never text or buttons.                                      |
| **Mitti** (earth)           | 100 `#f2cba6` · 300 `#d9a073` · 500 `#b5764e` · 700 `#85523a` · 900 `#573427` | Skin tones for people, light to deep. Illustration only.                                             |

**Pairings that work:** ivory on night (≈14:1), marigold 400 on night (≈8:1), night on ivory, vermilion 600 on ivory (buttons, stamp ink), brass on peacock (linework), marigold on peacock.

**Pairings to avoid:** brass as text on ivory (decorative contrast only), rani with vermilion as neighbours, marigold on vermilion for text, any glow on paper.

---

## 4. Surfaces and frames

Implemented in `apps/web/src/design-system/`:

- **Paper frame**: ivory with dark grain, 1.5px brass-700 outer rule, hairline inner rule at 6px, vermilion diamond studs at the inner corners, and a 6px solid night offset below. Used for forms and dialogs.
- **Night frame**: raised indigo panel with brass rules and marigold studs.
- **Stamp**: perforated edge (four intersecting CSS mask layers) around a double vermilion border. Used only for invitations.
- **Buttons are printed tabs**: flat ink, a hairline inner rule, a solid offset edge the button presses down into. Condensed caps (Anek at width 78).
- **Shadows** are solid offsets in a darker ink of the same family. There are no blurred shadows in the system.

## 5. Light and texture

- **Grain** is an SVG turbulence tile drawn _under_ content as part of the surface background, never as an overlay, so text stays sharp. `grain-light.svg` on night and `grain-dark.svg` on paper.
- **Glow** is radial gradients on composited layers, animated only with opacity and transform. Ambient light uses `mix-blend-mode: screen` so it adds light to the indigo instead of fogging it brown (an alpha-blended orange over indigo reads as mud).
- **Unlit things are dark shapes**, a silhouette in night ink with a faint brass edge. They are not translucent ghosts.

## 6. Motion

- **Cinematic only where it carries story**: Scene 1's camera pull-back, the doors opening. Everything else is quick and quiet.
- **Ease**: `--ease-print` (`cubic-bezier(0.2, 0.7, 0.1, 1)`) for UI, which settles like paper laid down. Flames use irregular keyframes on two nested layers so the loop never reads as a loop.
- **Performance rule**: animate `transform` and `opacity` only. Lamps render at their largest size and only scale _down_, so they never blur or repaint mid-animation.
- **Reduced motion** gets a complete, still composition (the lit row and both passages of copy), not a broken version of the animated one.
- **No autoplay audio, ever.** Sound, when it arrives, is opt-in per visit.

### Motion catalogue

| Where           | Motion                                                                                                                          | Mechanism                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Scene 1         | Lamp ignition, flame lean, the camera pulling back to the row                                                                   | GSAP + ScrollTrigger, transform and opacity on composited layers  |
| Scene 2 windows | Motif rises into its window on first sight, then idles: flames flicker, footprints walk in, the sun radiates, the lantern sways | CSS keyframes, paused unless the window is on screen (`Playable`) |
| Scene 3         | The rangoli assembles ring by ring with the scroll; once complete, three rings drift slowly                                     | GSAP scrub, one layer per ring; CSS rotation while visible        |
| Scene 4         | Toran strands sway; lanterns sway; doors open; a one-shot petal shower                                                          | CSS keyframes; GSAP for doors and petals                          |
| Party rooms     | The same window idles as Scene 2                                                                                                | CSS keyframes, visibility-gated                                   |

Every loop is paused off-screen and removed under reduced motion, where each illustration rests in its finished pose.

## 7. Composition by breakpoint

Phones are designed, not shrunk:

- Scene 1 uses seven lamps instead of nine and a taller, narrower arch with four foils instead of five.
- The doorway keeps its proportions; the Enter section stacks on phones and sits beside its heading from 64rem.
- In the party hall, the invitation stamp comes first on phones (a new host needs it first) and moves to a sticky sidebar on wide screens.
- The Devanagari half of the wordmark drops below 26rem wide rather than wrapping.

## 8. Cultural content

Rules for any copy about Diwali, its traditions, or the communities who keep it:

1. No single account is presented as _the_ meaning of Diwali.
2. Attribute each story to the people who tell it ("many families", "for Jains").
3. Hedge where practice varies by region or family.
4. Name a tradition in its own community's script where that is clear: Gurmukhi for Bandi Chhor Divas, Bengali for Kali Puja.
5. Deities and gurus are not drawn as decorative illustrations. Scenes about them use objects, architecture and light.
6. **All Scene 2 copy is a draft until reviewed by people from the communities described.** This is tracked in `docs/roadmap.md`.

## 9. Things we do not do

Purple gradients, glassmorphism, blurred drop shadows, emoji as illustration, stock icons, generic dashboard cards, glow on static UI, letter-spacing on Devanagari, placeholder art in shipped screens, and illustration styles that don't match the flat print system.
