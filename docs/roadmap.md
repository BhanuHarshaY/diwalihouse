# Roadmap

Each phase ends with a working vertical slice: deployed, tested, and honest about what is missing.

## Phase 1 · Foundations (done, 2026-11-05)

- [x] Reference analysis and art direction (`design/`)
- [x] Architecture, product spec, Teen Patti rules draft (`docs/`)
- [x] pnpm + Turborepo monorepo, strict TypeScript 6, ESLint, Prettier
- [x] Design system: tokens (closed palette), three-family type system, Frame / Stamp / Button / TextField / Dialog / Emblem / EmblemPicker / Wordmark, cusped-arch geometry
- [x] Twelve emblem medallions (guest avatars)
- [x] Homepage Scene 1 (one diya, passing the flame, camera pull-back into दीपावली), Scene 2 (eight traditions), Scene 4 (doorway with host and join)
- [x] Reduced-motion and no-JavaScript versions of the homepage
- [x] Illustration pass: arch-window gallery for the eight traditions, Scene 3 rangoli assembling on scroll, marigold toran, lanterns and petal shower at the doorway, illustrated room windows in the party hall
- [x] People: a parametric figure builder; family and friends portraits in a new "Bring your people" scene; friends-on-their-way empty state in the party hall
- [x] Party creation, invitation codes and QR, guest joining, per-party sessions
- [x] Party isolation: capability-typed service, re-checked roles, Postgres row-level security, composite FKs, uniform 401s
- [x] Host powers: rotate invite, remove guest; guests can leave
- [x] Rate limiting by failed lookup, by network (trusted header only, IPv6 /64) and by invitation
- [x] Independent security review; its findings on invitation visibility, rate limiting, name spoofing, column grants and session re-checks fixed and tested
- [x] Tests: 75 Vitest (contracts, service and isolation against real Postgres, client-network keys, geometry, palette) and 18 Playwright (desktop + phone, no-JS, reduced motion, cross-party HTTP probes)

**Known gaps carried forward:** polling instead of realtime; no CSP; no cross-device seat recovery; hosts can't leave; Scene 2 copy not yet community-reviewed; no measured performance numbers; nothing deployed yet.

## Phase 2 · Realtime foundation and Teen Patti (largely done, 2026-11-05)

- [x] Teen Patti rules signed off (all recommended defaults)
- [x] `packages/teen-patti`: pure engine, private views, 56 tests
- [x] `packages/realtime-protocol`: Ed25519 tickets, validated messages, idempotency keys
- [x] `apps/realtime`: Worker, `PartyRoom` (presence, table directory) and `TableRoom`, now `GameRoom` (authoritative game, timer alarms), with a smoke test against workerd
- [x] Web: ticket endpoint, reconnecting socket hook, "Here now" presence in the party hall
- [x] The Card Room: open tables, take a seat, deal, see, chaal and raise, show, sideshow, pack, timer, results, event log; spectators see no cards
- [x] Playing cards drawn in code (faces, arch-window court frames, card back)
- [x] Browser test: a full hand between two players through the UI
- [ ] Host top-up controls in the UI (the engine supports it)
- [ ] Archive finished hands to Postgres
- [ ] k6 load test (50 parties × 20 sockets, churn, ticket replays)
- [ ] Content-Security-Policy; non-owner DB role; host "sign out everywhere"
- [ ] Community review of the cultural copy and Indic-script strings
- [ ] First deploy (Supabase, Vercel, Cloudflare) and real-device performance measurements

## Game Bazaar (pulled forward from Phase 4, done 2026-11-05)

- [x] `packages/game-kit`: the shared engine shape (Rng, shuffle, Actor, Outcome) that Teen Patti now uses too
- [x] `GameRoom` replaces `TableRoom`: one Durable Object class for every game, with per-game adapters, action schemas and options
- [x] **Tambola**: server-generated tickets, host calling by hand or on a timer, tap-to-mark and "Mark for me", verified claims for six prizes, bogeys (`docs/games/tambola-rules.md`)
- [x] **Raja Mantri Chor Sipahi**: four players, secret chits, the Mantri's accusation, scored rounds (`docs/games/raja-mantri-rules.md`)
- [x] **Dumb Charades**: two teams, the film on the actor's phone only, typed guesses checked by the server, timer, got-it and pass (`docs/games/charades-rules.md`)
- [x] The Bazaar room in the party hall: open a game, see the games in play, join from any phone
- [x] Tests: 29 engine tests across the three games, the realtime cores, and browser tests that play each game with up to four people
- [ ] A TV caller view for Tambola and a TV timer for charades (with TV mode)
- [ ] Host-added film lists; a host "end game" control; Bazaar stall artwork (ROOM-02)
- [ ] Community review of the new Devanagari strings

## Rangoli Courtyard (pulled forward from Phase 6, done 2026-11-05)

- [x] `packages/rangoli`: stroke rules, limits and rate limit, undo, host erase and fresh start, the symmetry group, stroke shapes as path data (12 tests)
- [x] `CourtyardRoom`: one per party, a SQLite row per stroke, the whole rangoli in parts on connect, then changes in order
- [x] The courtyard page: freehand lines, petals, dots and rings in eight powders and three sizes, 6-, 8- or 12-fold mirrored symmetry, kolam guides, keyboard drawing, who's here, save as a PNG
- [x] Host moderation: remove one person's strokes, sweep and start afresh
- [x] **Revocation for every room:** removing a guest, or a guest leaving, now closes their open sockets in the party, its games and the courtyard (signed notice from the web app)
- [x] Tests: engine, protocol and core tests; smoke checks against workerd; browser tests for mirrored drawing, undo, moderation, the image download and revocation
- [ ] Store finished rangolis in R2 for the host; a TV view of the courtyard
- [ ] Removing a single stroke (moderation is per person today)
- [ ] Courtyard floor artwork beyond the framed earth floor (ROOM-04)

## Music Mehfil (pulled forward from Phase 5, done 2026-11-05)

- [x] `packages/mehfil`: requests, votes, withdraw and remove, the speaker tab and the host's delegate, advancing songs, YouTube link parsing (13 tests)
- [x] `MehfilRoom`: titles from YouTube's oEmbed (no API key), per-tab speaker, revocation
- [x] The Mehfil page: a turntable "Now playing" stage, a paper request slip with dedications, the queue with votes, recently played, and YouTube's own player on the speaker tab only
- [x] Tests: engine, protocol, core and lookup tests; smoke checks; browser tests with a stand-in for YouTube (requests, refusals, votes, the speaker, songs ending and failing, skip, revocation)
- [ ] A TV view of the Mehfil (with TV mode)
- [ ] Searching YouTube from the request slip; other providers

## Diwali Daak (pulled forward from Phase 6, done 2026-11-05)

- [x] `diwali.postcards` with row-level security, a composite author key, and column grants for withdraw and hide only
- [x] Service functions with per-person, per-party and time limits; hidden cards filtered in the query
- [x] The Daak page: a writing desk with six original stamps, a wall of postcards with postmarks, script tags for Indic text, print or save as PDF
- [x] Tests: contract tests (messages in any script, refused disguises), 10 service tests (including isolation and RLS), browser tests (posting, hiding seen through the API, withdrawing, strangers refused, removal)
- [ ] Photo postcards (R2) and private postcards

### Original Phase 2 plan

Goal: two phones at the same party see each other arrive instantly, and a complete Teen Patti hand can be played by the engine in tests.

1. **Sign off the Teen Patti rules** (every ⚑ in `docs/games/teen-patti-rules.md`).
2. `packages/teen-patti`: a pure engine with a seeded RNG, private views, and deterministic rule tests covering every rule, variant and fairness requirement in the rules doc.
3. `packages/realtime-protocol`: Zod message envelopes, `requestId` idempotency, `seq`, and Ed25519 ticket sign/verify (tested in Node and in workerd).
4. `apps/realtime`: a Worker plus the `PartyRoom` Durable Object (presence, hibernation), tested with `@cloudflare/vitest-pool-workers`.
5. Web: `POST /api/parties/:id/ticket`; the guest list switches from polling to presence, with polling kept as a fallback.
6. k6 script: 50 parties × 20 sockets, join/leave churn, ticket replay attempts.
7. Security follow-ups from the Phase 1 review: a non-owner DB login role with a `SECURITY DEFINER` code lookup, a nonce-based CSP, host "sign out everywhere", and UTS #39 look-alike folding for names.
8. Community review of the Scene 2 copy, and of every Devanagari string (`design/asset-manifest.md` § Copy for review).
9. First deploy: Supabase project, Vercel, Cloudflare. Measure Core Web Vitals on a mid-range Android phone.

## Phase 3 · Card Room polish

Court-card figures drawn with the figure builder; seated-people poses at the table; chip animations; co-hosts and host handover; hand history.

## Phase 4 · Game Bazaar

Built early; see "Game Bazaar" above. What remains moves to Phase 5 (TV views) and Phase 7 (polish).

## Phase 5 · TV mode

`/party/:id/tv`, showing the house, the active tables, the Mehfil and the rangoli. The Music Mehfil was built early; see above.

## Phase 6 · R2 storage

Photo postcards in the Daak and finished rangolis, stored in R2 and moderated by the host. The Rangoli Courtyard and Diwali Daak were built early; see above.

## Phase 7 · Launch readiness

Co-hosts and host transfer, cross-device recovery links, data retention and export, Sentry, accessibility audit, load test at target scale, and the commissioned illustration set.
