# Music Mehfil: how it works

**Status: built 2026-11-05**, following the product decision for a shared YouTube queue. The rules are in `packages/mehfil` and tested there. The room is the `MehfilRoom` Durable Object.

## What people do

- **Request a song:** paste a YouTube or YouTube Music link (any of the usual forms: `watch?v=`, `youtu.be/`, `/shorts/`, `music.`) and, if you like, a dedication ("For Nani, from Meera").
- **Vote:** tap a song's vote token. The most-voted song plays next; ties go to whoever asked first. Nobody can vote for their own request.
- **Withdraw:** take back your own request. The host can remove anyone's.
- **Listen:** one device in the room is **the speaker**. It plays the music; every other phone shows "Now playing" and the queue, and stays quiet.

## The speaker

- The host taps **Play the music on this device**: a laptop by the speakers, or the TV. That tap is what lets the browser play sound. The product never starts audio on its own.
- To use the TV, the host opens the invitation on the TV, joins as a guest (say, "Living room TV"), and under **Who plays the music** lets that guest play it. The TV then taps the same button. There is one delegate at a time, and taking the role back stops that device.
- The speaker is one **browser tab**, not a person: the host's phone in their pocket doesn't play just because their laptop does. A tab that reloads needs a fresh tap ("Resume the music here").
- When a song ends, the speaker tab reports it and the next one starts. If YouTube refuses to play a song (removed, private, or not allowed outside YouTube), the speaker reports that and it is skipped, with a note on the speaker's screen.
- The host, or the speaker, can **skip** the current song.

## YouTube

- **Titles come from YouTube, not from guests.** The room asks YouTube's public oEmbed endpoint about each link (no API key, no account). That gives the title and channel and tells us when an owner has disabled playing outside YouTube, so most unplayable links are refused at the request.
- **Playback is YouTube's own embedded player**, visible on the speaker's screen, using the privacy-enhanced `youtube-nocookie.com` host. Ads can play, as on any free YouTube. The Mehfil never downloads, hosts or streams audio itself.
- **Only the speaker tab loads anything from YouTube.** Guests' phones show text only, with no thumbnails, so they make no requests to Google.
- When a Content-Security-Policy lands, the Mehfil page must allow `https://www.youtube.com/iframe_api` as a script and `https://www.youtube-nocookie.com` as a frame.

## Limits

| Limit                    | Value                   |
| ------------------------ | ----------------------- |
| Songs waiting per person | 3                       |
| Songs in the queue       | 60 (about four hours)   |
| Dedication               | 80 characters, one line |
| Recently played kept     | 10                      |

## How it's built

- **Engine:** `packages/mehfil` (`applyMehfil`, `viewMehfil`, `parseVideoId`). It covers the queue, votes, the speaker and delegate, and when songs advance. Reports about a song that has already moved on are refused, so a late "ended" can never skip the next song.
- **Room:** `MehfilRoom`, one per party. It looks up titles (`apps/realtime/src/oembed.ts`), applies the rules, and sends every tab the whole (small) Mehfil after each change, plus whether that tab is the speaker. Each tab's id comes from its connection URL, never from a message. The room honours revocation like every other room.
- **Not built yet:**
  - a TV view designed for the Mehfil
  - pause or volume shared with phones (the speaker uses YouTube's own controls)
  - searching YouTube from the request slip
  - other providers such as Spotify
