# Diwali Daak: how it works

**Status: built 2026-11-05.** The party's guestbook: postcards anyone at the party can write and everyone at the party can read. Unlike the other rooms, it isn't realtime. Postcards are a keepsake, so they live in Postgres behind the party service, with the same row-level security as the guest list.

## Writing a postcard

- **To:** optional, in your own words ("Nani and Nanu"). Blank means everyone at the party.
- **Message:** up to 280 characters and eight lines, in any language and script, with emoji.
- **Stamp:** one of six original designs: diya, kandil (lantern), genda (marigold), rangoli, phuljhadi (sparkler) and mithai.
- The card shows the writer's name and emblem, and a postmark with the time it was posted, in the reader's own clock.
- New postcards reach everyone's wall within about eight seconds (the page refreshes; nothing is pushed). Cards that arrive while you're looking drop onto the wall.

## Who can do what

| Who        | Can                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Everyone   | Write postcards, read the wall, take down their own postcards, print or save the wall as a PDF |
| The writer | Take their own postcard down; see it marked if the host has hidden it                          |
| The host   | Hide any postcard from the party, and show it again                                            |

- **Hidden postcards are left out by the database query**, not by the page. A guest's own request for the wall never contains a hidden card; only the host and its writer receive it.
- A guest **the host removes** takes their postcards with them. A guest who **leaves** keeps theirs on the wall, marked "(has left)".
- Nothing is ever deleted inside the party scope: taking a card down and hiding it are recorded (`withdrawn_at`, `hidden_at`), and the scope role has no `DELETE` privilege.

## Limits

| Limit                       | Value                   |
| --------------------------- | ----------------------- |
| Postcards per person        | 20 on the wall at once  |
| Postcards per party         | 500                     |
| Time between your postcards | 5 seconds               |
| Message                     | 280 characters, 8 lines |
| "To" line                   | 40 characters           |

Messages are checked like names: control characters, bidi overrides, invisible and blank look-alike characters, and stacks of combining marks are refused. Joiners inside emoji sequences and Indic conjuncts are allowed.

## Scripts

A guest's language can't be known, but their script can. A card written in Devanagari, Gurmukhi or Bengali is marked `lang="und-Deva"` (or `und-Guru`, `und-Beng`): "undetermined language, this script". It gets the right face from the story font stack and is never letter-spaced.

## The keepsake

**Print or save as PDF** prints the wall alone, straightened, with the party's name, leaving out the writing desk, the buttons and any hidden postcards. This is the host's export until the planned data-retention export exists.

## How it's built

- Table `diwali.postcards` (`supabase/migrations/20261105180000_diwali_daak.sql`):
  - row-level security on the scope role
  - a composite foreign key, so a postcard's author must be a member of its own party
  - column-level `UPDATE` grants on `withdrawn_at` and `hidden_at` only
- Service: `getDaak`, `sendPostcard`, `withdrawPostcard` and `setPostcardHidden` in `apps/web/src/server/parties/service.ts`. Each takes a `MemberContext` and re-checks membership inside its transaction.
- `GET /api/parties/:id/daak` feeds the page, with the same uniform 401 as every party endpoint. Server actions make the changes. Message text is never logged.
- **Not built yet:** photo postcards (uploads to R2, moderated by the host), postcards sent to one person privately, and editing a posted card.
