# Rangoli Courtyard: how it works

**Status: built 2026-11-05.** One shared rangoli per party that everyone draws on together. The rules are in `packages/rangoli` and tested there; the room is the `CourtyardRoom` Durable Object.

## Drawing

- The floor is a disc. Every stroke is drawn **eight times around the centre and mirrored** (sixteen copies), so whatever people draw, the rangoli stays symmetrical. The host can start a fresh rangoli in six-, eight- or twelve-fold symmetry.
- **Tools:**
  - **Line** (freehand; a tap leaves a dot)
  - **Petal** (drag from base to tip; a tap makes a petal pointing away from the centre)
  - **Dot**
  - **Ring** (a circle around the centre through the point you tap)
- **Powders:** rice-flour white, turmeric, marigold, vermilion, rani pink, rose, peacock and teal, all from the palette, on a swept-earth floor. Three sizes: fine, medium, bold.
- **Guides** (on by default) show the symmetry lines and rings of dots, the way a kolam is laid out on a dot grid. They never appear in the saved image.
- **Keyboard:** the floor takes focus. The arrow keys move a brush (Shift for bigger steps) and Enter draws. With the line tool, Enter starts a line and Enter again finishes it; Escape cancels.

## Sharing and moderation

| Who        | Can                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Everyone   | Draw, undo their own most recent stroke (repeatedly), see who is in the courtyard, save the rangoli as a PNG                   |
| Only hosts | Remove all of one person's strokes; sweep the floor and start a fresh rangoli (both ask for confirmation, and can't be undone) |

The room enforces every rule. The page hides host tools from guests only for tidiness.

## Limits

| Limit                  | Value                                         | Why                                                  |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Strokes in one rangoli | 2,500                                         | Keeps the snapshot and redraws quick on phones       |
| Strokes per person     | 600                                           | Nobody fills the floor alone                         |
| Points in one line     | 96 (longer lines are sent as several strokes) | Keeps each message small                             |
| Rate                   | A burst of 24 strokes, then 4 a second        | A fast drawer never notices; a script can't flood it |
| Coordinates            | Integers on a disc of radius 1,000            | Small to send, exact to check                        |

## How it's built

- **Engine:** `packages/rangoli` holds the rules (validation, limits, rate limit, undo, erase, fresh) and the geometry: the symmetry group, and stroke shapes as SVG path data, which the canvas draws through `Path2D`. Pure and tested.
- **Room:** `CourtyardRoom`, one per party, stores one SQLite row per stroke, so drawing a stroke doesn't rewrite the whole rangoli.
  - On connect it sends the whole rangoli in parts of 400 strokes. Changes (drawn, erased, fresh) then follow with a sequence number.
  - The server stamps each stroke's id and author. A stroke that names its own author is refused at the schema.
- **Saving:** the browser renders a 2048 × 2048 PNG with a framed border and downloads it. Nothing is uploaded. Storing finished rangolis in R2 for the host is still planned.
- **Not built yet:** a TV view of the courtyard, R2 storage of finished rangolis, and removing a single stroke (moderation is per person).
