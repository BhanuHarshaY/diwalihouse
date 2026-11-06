# Product specification

## Vision

Diwali House is a private, illustrated house for one night of Diwali with your people. A host opens the house. Guests come in from their phones with an invitation, with no account and no app. Inside, the rooms of the house hold card games, party games, a shared jukebox, a rangoli everyone draws together, and a guestbook. A TV in the living room can show the whole house at once.

It should feel like walking into a beautifully printed object at night, not like opening a dashboard.

## People

| Who        | Wants                                                                                                   | Constraints                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Host**   | To set up in a minute, share one link or QR code, keep strangers out, and run games without refereeing. | Often on a phone, often while cooking.                             |
| **Guest**  | To join in seconds, be recognisable to friends, and play on their phone.                                | Never wants an account. Mixed devices, flaky Wi-Fi. Ages 10 to 80. |
| **The TV** | A shared screen showing who's here, what's playing, and the rangoli.                                    | Read-only, seen from across a room.                                |

## Principles

1. **No accounts, ever, for guests.** A name and an emblem is enough.
2. **Private by default.** A party is reachable only with its invitation. No public listing, no search.
3. **Virtual chips only.** Nothing in the product can be bought, cashed out or wagered for value.
4. **Respectful.** Diwali is many festivals for many communities. The product never claims one story.
5. **Honest software.** Features that don't exist yet are labelled, not faked.

## Phase 1 scope (built)

### Homepage, "the meaning of Diwali"

| Scene                                                                                                                   | Status                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1 · One Diya: a lamp lights in the dark, the visitor passes the flame along a row, and the row becomes दीपावली          | **Built**                                  |
| 2 · The Festival of Lights: eight traditions in illustrated arch windows, attributed and hedged, with no single account | **Built** (copy awaiting community review) |
| 3 · The Rangoli: a geometric rangoli assembles ring by ring as you scroll, with its regional names                      | **Built**                                  |
| 4 · Enter the Mehfil: the doors open onto hosting or joining                                                            | **Built**                                  |

Plus a visible "Skip to the party" link on every scroll position, a fast path for returning visitors (the lamp is lit immediately), a complete reduced-motion composition, no audio, and a fully working page without JavaScript.

### Hosting and joining

- **Host a party** (`/host`): party name, your name, your emblem. You get the party hall, an invitation link, a code and a QR code.
- **Join** (`/join/<code>` or by typing the code on the homepage): you see the party and host name, then choose a name and an emblem.
- Names are unique (case-insensitively) among the people currently in a party.
- Parties hold up to 50 people.

### The party hall (`/party/<id>`)

- The guest list, refreshing every few seconds, with emblems, the host marked, and "(you)".
- The invitation stamp, **host only**: QR code, code, copy link, native share (where the device supports it). Guests are told to ask the host. A host toggle to let guests share is a possible later option.
- **Host powers:** make a new code (the old link, code and QR stop working immediately; people already inside stay) and remove a guest (all of their sessions end immediately), optionally replacing the code in the same step.
- **Guests** can leave. Hosts can't leave yet (host handover arrives with co-hosts).
- Every room is open: the Card Room, the Game Bazaar, the Rangoli Courtyard, the Music Mehfil and Diwali Daak. Rooms not built yet are listed honestly as "Not open yet".

## Later phases

### The Card Room: Teen Patti (flagship)

Private cards, blind and seen play, show, sideshow, multiple tables per party, reconnect-safe. Rules and variants: `docs/games/teen-patti-rules.md` (signed off). **Built**, except hand history and host top-ups in the UI.

### Game Bazaar

**Built (2026-11-05)** with the recommended defaults recorded in each game's rules document. Not built yet: the TV views and host-added film lists.

| Game                        | Shape                                                              | Notes                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Tambola** (housie)        | Host or TV calls numbers; every guest holds tickets on their phone | Server-generated valid tickets; claims (early five, lines, corners, full house) verified by the server                  |
| **Bollywood dumb charades** | Teams; the actor's phone shows the film; a timer runs on the TV    | A curated list of 107 films; a host-addable custom list is planned                                                      |
| **Raja Mantri Chor Sipahi** | Four players, hidden roles, the Mantri guesses the Chor            | Short rounds and private roles, a natural fit for the realtime engine. (The reference `rajamantrisiphai.png` names it.) |

### Music Mehfil

A shared queue of songs. Guests add tracks and vote, and the host or TV plays them. **We don't host or stream music.** Tracks are links and metadata, and playback happens through the provider's own embed under its terms. **Built (2026-11-05)** for YouTube: requests with dedications, votes, one speaker device (the host's, or a device they choose, such as the TV). Details: `docs/music-mehfil.md`.

### Rangoli Courtyard

One shared rangoli on a radial grid. Each guest adds strokes in palette colours; it's symmetrical by construction. **Built (2026-11-05):** lines, petals, dots and rings in eight powders, 6-, 8- or 12-fold symmetry, undo, host moderation, and saving as a PNG on the device. Storing it in R2 and a TV view are not built yet. Details: `docs/rangoli-courtyard.md`.

### Diwali Daak

A guestbook of illustrated postcards: a short message, a stamp design and an emblem. The host can hide any card. **Built (2026-11-05):** postcards in any script with six original stamps, a "To" line, withdraw and hide, and printing the wall as a keepsake. Photo postcards (R2) are a later step. Details: `docs/diwali-daak.md`.

### Party TV mode

`/party/<id>/tv`: a large-type, read-only screen showing who's here, the active tables, the now-playing song, the rangoli and announcements from the host.

## Product decisions (2026-11-05)

| Topic                      | Decision                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Games after Teen Patti     | Tambola, then Raja Mantri Chor Sipahi, then Bollywood Dumb Charades                            |
| Music Mehfil               | A shared YouTube queue: guests add and vote, and the TV or host's device plays the embeds      |
| Card artwork               | An original court-card set drawn in code with the figure builder                               |
| Data retention             | Delete a party and its data 30 days after its last activity, with an export for the host first |
| Party size                 | Up to 50 people                                                                                |
| Sharing invitations        | Host only for now; a host toggle later                                                         |
| Co-hosts and host handover | Built alongside the Card Room                                                                  |

## Non-goals

Real-money anything; public parties or discovery; guest accounts; chat (Daak is asynchronous by design); hosting music files; native apps (the web app must be enough).

## Privacy

- We store a display name, an emblem, and hashed session tokens. No email, phone number or IP address is stored; rate limiting uses keyed hashes.
- ⚑ To decide: a retention period. Proposed: parties and their data are deleted 30 days after the last activity, with an export for the host.
