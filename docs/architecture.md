# Architecture

Status key: **[built]** exists and is tested · **[designed]** decided, not yet built · **[open]** still to decide.

## 1. System overview

```
                         ┌──────────────────────────────────────────────┐
  Phone / laptop / TV    │  Vercel: Next.js (apps/web)                  │
  ───────────────────    │                                              │
  Browser ──HTTPS──────▶ │  App Router pages (RSC)                      │
    │  cookies:          │  Server Actions (create, join, host powers)  │
    │  dh_s_<party>      │  Route handler GET /api/parties/:id          │
    │                    │  Party service ── withPartyScope() ──┐       │
    │                    └──────────────────────────────────────┼───────┘
    │                                                           │ postgres.js
    │                                                           ▼  (Supavisor, transaction mode)
    │                    ┌──────────────────────────────────────────────┐
    │                    │  Supabase Postgres, schema `diwali`          │
    │                    │  parties · members · invites · sessions      │
    │                    │  RLS on role diwali_party_scope              │
    │                    └──────────────────────────────────────────────┘
    │
    │  WSS + short-lived ticket
    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Cloudflare Workers (apps/realtime, Phase 2)                          │
  │  Worker: verifies ticket ─▶ PartyRoom DO (one per party: presence,    │
  │                             lobby, announcements)                     │
  │                         ─▶ GameRoom DO (one per game, any kind:       │
  │                             authoritative game state in DO SQLite)    │
  │                         ─▶ CourtyardRoom DO (one per party: the       │
  │                             shared rangoli, one SQLite row a stroke)  │
  │                         ─▶ MehfilRoom DO (one per party: the music    │
  │                             queue; asks YouTube oEmbed for titles)    │
  │  Web app ─▶ signed revocation notice ─▶ closes a member's sockets     │
  │  [designed] Archives results to Postgres (server-to-server key)       │
  └──────────────────────────────────────────────────────────────────────┘
  R2: user uploads (rangoli exports, Daak images)       [designed]
```

**Status (Phase 2):** party membership, invites and the guest list live on Vercel + Postgres; the guest list still refreshes by polling every 5 seconds, and live presence ("Here now"), the Card Room, the Game Bazaar, the Rangoli Courtyard and the Music Mehfil run on the Cloudflare realtime service, which is built and runs locally under `wrangler dev`. Nothing is deployed yet.

## 2. Repository

```
apps/
  web/                 Next.js App Router: pages, server actions, design system, scenes
  realtime/            Cloudflare Worker + Durable Objects (PartyRoom, GameRoom, CourtyardRoom, MehfilRoom)
packages/
  contracts/           Zod schemas + types shared by browser and server
  realtime-protocol/   Ed25519 tickets, socket message schemas, game options
  game-kit/            Shared engine plumbing: Rng, shuffle, Actor, Outcome, applyWith
  teen-patti/          Pure engines, one per game, each with its private views
  tambola/
  raja-mantri/
  charades/
  rangoli/             The courtyard's rules (strokes, limits, moderation) and symmetry geometry
  mehfil/              The music queue's rules (requests, votes, the speaker) and YouTube links
  db/                  Postgres client factory, migration runner, test-DB reset
  tsconfig/            Shared strict TypeScript configs
supabase/migrations/   SQL migrations (Supabase CLI naming; also run by our migrator)
design/                Art direction, typography, illustration spec, asset manifest
docs/                  Architecture, product spec, roadmap, game rules
```

Packages ship TypeScript source (`exports` point at `.ts`). Next transpiles them (`transpilePackages`), Vitest runs them directly, and Node 22's type stripping runs the migration CLI without a build step. Imports inside packages use explicit `.ts` extensions and `erasableSyntaxOnly`, so that works.

Inside `apps/web/src`:

| Directory        | Contents                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/`           | Routes only. Pages are thin; they call the server layer and render components.                                 |
| `server/`        | Everything that touches the database or secrets. `service.ts` never imports Next.js, so it is tested directly. |
| `design-system/` | Tokens, fonts, Frame, Button, TextField, Dialog, Emblem(Picker), Wordmark, geometry.                           |
| `scenes/home/`   | The homepage story: Scene 1 (diya), Scene 2 (traditions), Scene 4 (doorway).                                   |
| `party/`         | The party hall: snapshot polling, guest list, invitation stamp, rooms.                                         |
| `realtime/`      | The reconnecting socket hook and the party-room and game-room hooks built on it.                               |
| `cards/`         | The Card Room: lobby, Teen Patti table, playing cards.                                                         |
| `games/`         | The Game Bazaar: lobby, one screen per game, and the `GameScreen` that picks by kind.                          |
| `components/`    | Page-level pieces shared across routes (PageShell, GuestCardForm, ClosedDoor).                                 |

## 3. Stack decisions and tradeoffs

| Decision                                                  | Instead of                                 | Why                                                                                                                                                                                                                                                                                                                                                       | Cost                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Postgres via `postgres.js` from the server only**       | `supabase-js` / PostgREST from the browser | Guests are anonymous with party-scoped credentials. Supabase Auth's user model doesn't fit "same person, different identity per party". A server-only data path means the browser never holds a database credential, and every query goes through one authorisation choke point. We still get Supabase's managed Postgres, pooler, backups and dashboard. | We don't use Supabase Realtime or auto-generated APIs, and RLS is driven by our own role and setting rather than `auth.uid()`. |
| **Our own guest sessions**                                | Supabase anonymous sign-in                 | Per-party credentials make cross-party isolation structural: a cookie can't open a party it wasn't issued for.                                                                                                                                                                                                                                            | We own session code. It's small, and it's tested.                                                                              |
| **Server Actions for mutations, one GET route for reads** | A REST API for everything                  | Forms work before hydration and without JavaScript (tested), and Next checks Origin on actions. The GET route exists for TanStack Query polling.                                                                                                                                                                                                          | When native clients or the realtime service need the same mutations, we add route handlers over the same service functions.    |
| **Polling (5 s) in Phase 1**                              | Shipping WebSockets now                    | Honest and simple, and it exercises the auth and isolation model first.                                                                                                                                                                                                                                                                                   | Up to 5 s of latency on the guest list. Fine for a lobby, not for games.                                                       |
| **Durable Objects for live game state** (Phase 2)         | Postgres row locks / Supabase Realtime     | One single-threaded object per table gives serialised, authoritative transitions without distributed locks. DO SQLite survives evictions, and WebSocket hibernation keeps idle tables cheap.                                                                                                                                                              | A second deploy target and a second datastore. Results are archived to Postgres.                                               |
| **Zustand: not yet**                                      | Adding it up front                         | Phase 1 has no cross-component client state that React state and TanStack Query don't already cover. It arrives with the game client (local UI state such as selected chips and animation queues).                                                                                                                                                        | None now.                                                                                                                      |
| **Rive: not yet**                                         | Shipping the runtime with no `.riv` file   | No Rive asset exists yet. The runtime arrives with the first one, lazy-loaded (`illustration-spec.md` § 5).                                                                                                                                                                                                                                               | None now.                                                                                                                      |
| **No Three.js / WebGL**                                   |                                            | The direction is 2D print illustration. Everything animates with transform and opacity on DOM and SVG layers.                                                                                                                                                                                                                                             |                                                                                                                                |

## 4. Data model [built]

Migrations: `supabase/migrations/` (party foundation, isolation hardening, Diwali Daak). Schema `diwali`, which Supabase's PostgREST does not expose. `anon`/`authenticated` are explicitly revoked.

```
parties            id uuid PK · name · status open|closed · max_members (default 50) · created_at
members            id uuid PK · party_id FK · display_name · emblem · role host|guest
                   · joined_at · left_at · removed_at          UNIQUE(party_id, id)
                   UNIQUE(party_id, lower(display_name)) WHERE active
                   UNIQUE(party_id) WHERE role = 'host'
invites            id · party_id · code (8× Crockford base32, UNIQUE) · created_by → (party_id, member)
                   · created_at · revoked_at                   UNIQUE(party_id) WHERE live
member_sessions    id · party_id · member_id → (party_id, member) · token_hash bytea(32) UNIQUE
                   · created_at · last_seen_at · expires_at · revoked_at
rate_limit_buckets key · window_start · hits                   PK(key, window_start)
postcards          id · party_id · author_id → (party_id, member) · to_line · message (≤ 280)
                   · stamp · created_at · withdrawn_at · hidden_at
```

- **Permanent id vs invitation code.** `parties.id` (a UUID) never changes. Codes live in `invites` and can be rotated, which revokes the old one without touching the party. At most one live invite exists per party.
- **Composite foreign keys** `(party_id, member_id) → members(party_id, id)` make it impossible to store a session or invite that points at a member of another party.
- **Soft deletes** (`left_at`, `removed_at`, `revoked_at`, and for postcards `withdrawn_at`, `hidden_at`) keep history for moderation and archives. The scope role has no `DELETE` privilege at all.
- **Diwali Daak** lives here rather than in the realtime service, because postcards are durable party data: the guestbook is the night's keepsake (`docs/diwali-daak.md`). Hidden postcards are filtered in the query, so guests never receive them.

## 5. Identity, sessions and party isolation [built]

### Joining

1. A host creates a party, which creates the party, the host member, a live invite and a session in one transaction.
2. A guest opens `/join/<code>`. The code is normalised (Crockford folding: O→0, I/L→1), rate-limited, and resolved to a party. They see only the party name, the host's name and the member count.
3. On join, inside the party scope and holding a `FOR UPDATE` lock on the party row, we check that the invite is still live, the party is open and there is capacity. Then we insert the member and session. The lock serialises joins against each other (so capacity can't be oversubscribed: tested with 10 concurrent joins for 4 seats) and against invite rotation.

### Sessions

- Token: 32 random bytes, base64url. **Only its SHA-256 is stored**, so a database leak yields no working sessions.
- Cookie: one per party, `dh_s_<partyId>` (`__Host-` prefixed in production), `HttpOnly`, `Secure` on HTTPS, `SameSite=Lax`, `Path=/`, 30 days. A browser can be in several parties at once. Each cookie opens only its own party.
- **Recovery:** returning with the same browser restores your seat. Visiting the invite link again redirects you straight in, with no duplicate member. Cross-device recovery (a personal recovery link) is in the roadmap.
- **Revocation:** leaving or being removed revokes every session for that member immediately. Expiry is checked on every request.

### Isolation, in layers

1. **Capability-shaped API.** Every party-scoped service function requires a `MemberContext`, a branded type that only `authenticate(sql, partyId, token)` produces. You can't call `getPartySnapshot` without proving membership first.
2. **Re-check inside the operation.** Each scoped function re-reads, in its own transaction, the caller's membership, role _and the specific session they authenticated with_. A guest removed, or a session revoked, between authentication and action is refused.
3. **Row-level security in Postgres.** `withPartyScope()` opens a transaction, runs `set_config('diwali.party_id', …, true)` and `SET LOCAL ROLE diwali_party_scope`. The policies on that role hide and reject every row from any other party. Both settings are transaction-local, so nothing leaks through pooled connections. With no party set, the policy evaluates to NULL and the role sees nothing: it fails closed.
4. **Uniform failure.** Non-members, unknown party ids, malformed ids and revoked sessions all get the same 401 and the same "This door is closed" page, so ids can't be probed.

The tests prove each layer separately. `service.test.ts` includes forged contexts and unfiltered queries. A mutation test, with RLS disabled on `members`, fails exactly the three RLS tests while the application-layer tests still pass.

Operations that run **outside** the scope, each deliberately narrow: creating a party (until the party row exists), resolving an invite code, and rate limiting.

5. **Least privilege inside the scope.** The scope role has no `DELETE`, no `INSERT` on parties, and column-level `UPDATE` only on the columns the service changes (`left_at`, `removed_at`, `revoked_at`, `last_seen_at`, party `status`). Even a bug inside the scope can't promote a guest to host, extend a session, or rewrite a code (tested).

### Invitations

- **Only the host sees the live code** (snapshot, QR, link). Guests are told who to ask. Otherwise rotating the code wouldn't lock out a guest who leaked it: they would read the new code within one poll.
- **Remove and rotate** is one step in the host's remove dialog.
- **One browser, one seat.** Joining with a browser that already has a live session for that party returns it to its seat rather than minting a second identity.

### Abuse resistance

- **Invite codes** carry 40 bits and are rate-limited by _failure_: 20 failed lookups per network per 10 minutes, after which that network can't look up any code until the window ends. Successful lookups cost nothing, so a household arriving together is never locked out.
- **New identities** are capped at 40 joins per network and 60 per invitation per 10 minutes, above any real party's size. Party creation is capped at 10 per network per hour.
- **What "network" means:** we read exactly one header. On Vercel it's `x-vercel-forwarded-for`; elsewhere it's whatever `CLIENT_IP_HEADER` names, set by your own edge. Without either, all clients share one bucket, which is strict but can't be spoofed. A client-supplied `X-Forwarded-For` is never trusted. IPv6 addresses are grouped by /64. Keys are HMAC'd with `APP_SECRET`, so raw IPs are never stored (`server/client-ip.ts`, tested).
- **Display names** are NFC-normalised, whitespace-collapsed and capped at 32 code units. We reject control, private-use, surrogate and unassigned code points, _every_ format character (bidi marks, zero-width and word joiners, soft hyphens, tag characters), blank-rendering characters (Hangul fillers, Braille blank), stacks of four or more combining marks, and names without a letter or digit. ZWJ/ZWNJ are allowed only between letters of an Indic script, where they control conjuncts.
- **Name uniqueness** uses `members.name_key`: NFKC, lower-cased, shaping joiners removed. Fullwidth "Ａｓｈａ" therefore collides with "Asha".
- **CSRF:** server actions are Origin-checked by Next.js, cookies are `SameSite=Lax`, and the only GET endpoint is read-only with no CORS headers.
- **Headers:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`. A Content-Security-Policy is still open (it needs a nonce for the inline pre-paint script).

**Reviewed:** an independent security review of the Phase 1 auth and data surface found no cross-party read or write path. It confirmed the scope can't leak through transaction-mode pooling. Its findings on invitations, rate limiting, names, grants and session re-checks are fixed above. The remaining items are below.

**Deferred hardening (tracked in the roadmap):**

- The app connects as the table owner, so its few _unscoped_ queries (code lookup, party creation) bypass RLS by design. The next step is a non-owner login role, with the code lookup as a `SECURITY DEFINER` function that returns only a party id. The scope stops a forgotten filter, not injected SQL. All queries are parameterised tagged templates.
- A nonce-based Content-Security-Policy with `frame-ancestors 'none'`.
- "Sign out everywhere" for hosts. Today a stolen host cookie stays valid for its 30-day lifetime.
- Cross-script look-alike names (Cyrillic "А" for Latin "A"). The fix is a UTS #39 skeleton in `name_key`.
- Failed-lookup budgets can be spent by a third-party page that makes a victim's browser request bad codes, which locks that network out for up to 10 minutes. It's a nuisance, not a breach.

## 6. Realtime and multiplayer [built]

### Connection

1. The browser asks the web app for a **realtime ticket**: `POST /api/parties/:id/ticket` (`apps/web/src/app/api/parties/[partyId]/ticket/route.ts`), authenticated by the party cookie. The claims (member, role, name, emblem) are read from Postgres, never taken from the request.
2. The web app signs `{ v, party, member, role, name, emblem, exp: now + 60 s, jti }` with Ed25519 (`packages/realtime-protocol/src/ticket.ts`). The private key lives on Vercel; the Worker holds only the public key. (Node and Workers disagree on the JWK `alg` value for Ed25519, so it is dropped on import.)
3. The browser opens `wss://realtime.…/parties/:id/connect?ticket=…` (or `/parties/:id/games/:game/connect`, `/parties/:id/courtyard/connect`, `/parties/:id/mehfil/connect?device=…`). The Worker (`apps/realtime/src/index.ts`) checks the browser origin against `ALLOWED_ORIGINS`, verifies the signature, expiry and party match, then forwards the socket with the verified identity to the room. Each room refuses a `jti` it has already seen (remembered in memory for the ticket's 60-second life; a room evicted and recreated inside that window would not remember it, which is the residual risk).
4. Tickets are party-scoped and short-lived. A ticket for party A is rejected by party B's object before any message is processed.

### Revocation

A ticket is checked only when a socket opens, so without more, a guest who leaves or is removed would keep any sockets they already have open. So, after the database change commits, the web app's remove and leave actions call `revokeRealtimeAccess` (`apps/web/src/server/realtime.ts`):

1. It signs a **revocation notice** `{ v, party, member, exp, jti }` with the ticket key. Notices use the prefix `r1.` (tickets use `v1.`), and the signature covers the prefix, so neither can stand in for the other.
2. It POSTs the notice to `/parties/:id/revoke`. The Worker verifies it for that party and hands it to `PartyRoom`, which passes it to every game in its directory, the courtyard and the Mehfil.
3. Each room records the member as revoked (persisted), sends their sockets `{ t: "revoked" }`, closes them, refuses their messages and refuses any new ticket for them. The explicit message matters: a close the room starts doesn't always finish its handshake (seen under `wrangler dev`), and the person should hear at once.
4. The browser stops reconnecting and shows "You are no longer in this party".

If the call fails it is logged (`realtime.revoke_failed`), and the member is still out of the party in Postgres. Their tickets stop being issued, but sockets they already have stay open until they close. The smoke test and a browser test cover this, and the browser test fails without it.

### Objects

- **`PartyRoom`** (one per party): presence (who's connected, from how many tabs) and the game directory (up to 12 games in play; finished games don't count). Only a member can open a game, and the room picks its id. It uses WebSocket hibernation, so idle parties cost nothing. TV-mode announcements will live here too.
- **`GameRoom`** (one per game, named `<partyId>:<gameId>`): runs one game of any kind. It persists the whole game (kind, state, profiles, sequence number, recent request ids) to its SQLite-backed storage after every change, schedules a Durable Object alarm for whatever the engine is waiting on (a Teen Patti turn, the next Tambola call, a charades turn), and reports a public summary back to `PartyRoom` for the directory. Archiving finished games to Postgres is not built yet.

- **`CourtyardRoom`** (one per party, named `<partyId>`): the Rangoli Courtyard (`docs/rangoli-courtyard.md`). It keeps one SQLite row per stroke and a small saved record (symmetry, edition, next stroke id, profiles, recent request ids). Unlike a game it sends **changes, not views**: the whole rangoli in parts of 400 strokes on connect, then `drawn` / `erased` / `fresh` messages stamped with a sequence number. Everyone sees the same rangoli, so there is no private view. The server stamps every stroke's id and author.

- **`MehfilRoom`** (one per party, named `<partyId>`): the Music Mehfil (`docs/music-mehfil.md`). Its whole state is small, so it is saved as one record and every tab gets the full view after each change, plus `you.speaker`: whether that tab plays the music. A tab's id arrives in its connection URL and is kept with the socket, so a message can't claim to be another tab. Song titles come from YouTube's oEmbed endpoint (`OEMBED_BASE`, which tests point at a local stub), never from the guest.

### Protocol rules

- Every client message is a Zod-validated envelope `{ type, requestId, seenSeq, payload }`.
- **`requestId` (UUID) gives idempotency.** The object keeps recent `(memberId, requestId) → result` and replays the result for duplicates, which covers double taps, retries and reconnect resends.
- The server stamps each accepted transition with a monotonically increasing **`seq`**. A client that sees a gap asks for a snapshot.
- **Private snapshots.** The server renders a per-member view: your own cards when you have seen them, other players' card _counts_, never the deck or anyone else's cards. Showdown reveals are explicit events. The full state never leaves the object.
- **Multiple tabs:** one member can hold several sockets. Actions from any of them are accepted (idempotency prevents double-acts), and all of them receive the same private view.
- **Reconnect:** on reconnect the client sends `seenSeq`. The object replies with a fresh private snapshot, never a diff from untrusted state.
- **Disconnect and abandonment:** a player who disconnects mid-turn gets a turn timer (configurable, default 30 s), then auto-packs. A table with no connected players for 10 minutes ends its hand (chips return to their pre-hand balance) and hibernates.
- **Host departure:** the party continues. The host role is a Postgres fact, not a socket fact. Host transfer to a co-host is planned. Tables keep running without the host.

### Game engine boundary

Every game is a pure TypeScript module with the same shape (types from `packages/game-kit`):

```ts
apply(state: S, action: A, actor: Actor, ctx: { now: number; rng: Rng }) =>
  { ok: true; state: S; events: E[] } | { ok: false; error: Violation };
view(state: S, memberId: string, host: boolean): View; // what that one person may see
```

| Game                    | Package                | Hidden from the view                                | Rules                             |
| ----------------------- | ---------------------- | --------------------------------------------------- | --------------------------------- |
| Teen Patti              | `packages/teen-patti`  | The deck; every hand but your own (until a show)    | `docs/games/teen-patti-rules.md`  |
| Tambola                 | `packages/tambola`     | The bag's order; every ticket but your own          | `docs/games/tambola-rules.md`     |
| Raja Mantri Chor Sipahi | `packages/raja-mantri` | Who holds the Chor and the Sipahi, until the reveal | `docs/games/raja-mantri-rules.md` |
| Dumb Charades           | `packages/charades`    | The deck; the film, from everyone but the actor     | `docs/games/charades-rules.md`    |

There is no I/O, no clock and no `Math.random`. The Durable Object injects `cryptoRng` (`crypto.getRandomValues` with rejection sampling); tests inject a seeded sfc32 generator. `apps/realtime/src/engines.ts` adapts each engine to `GameRoom`: it validates the client's action with that game's Zod schema, fills in the player's name from the verified ticket (names are never taken from the client), and exposes the engine's timer, view and directory summary. The web UI renders only the view. Each rules document records the defaults that were built.

**How the realtime code is tested.** Each Durable Object is thin glue around a pure core (`game-core.ts`, `party-core.ts`) tested in Node with Vitest. The Worker itself is exercised for real: `pnpm --filter @diwali/realtime smoke` plays a hand over sockets against `wrangler dev` (19 checks, including refused tickets), and the Playwright suite starts the Worker and plays Teen Patti, Tambola, Raja Mantri Chor Sipahi and Dumb Charades through the UI with up to four browsers. `@cloudflare/vitest-pool-workers` was not used because it requires Vitest 4 and this repo is on Vitest 5.

## 7. Frontend

- **Server Components by default.** Client components are the interactive leaves: scenes, forms, the party hall.
- **TanStack Query** owns server state on the party page only, so the homepage never loads it. Snapshots are parsed with the same Zod schema the server uses.
- **Motion budget:** GSAP and ScrollTrigger are used only by the homepage scenes. Motion handles guest-list layout transitions. Per-frame work in Scene 1 is direct transform writes on composited layers. React re-renders only when a lamp is lit.
- **Progressive enhancement:** the head script sets `data-js` before first paint. Without JavaScript the homepage renders a static, fully lit scene, and hosting and joining work through native forms (E2E tested with JavaScript disabled). With reduced motion, the scene renders still, with every lamp lit.
- Future **TV mode**: a route `/party/:id/tv`, joined as a member with a "screen" flag, read-only, large type, subscribed to `PartyRoom` announcements.

## 8. Observability

- **[built]** Structured single-line JSON logs (`server/log.ts`) for party lifecycle events and failures. Tokens, cookies, IPs and invite codes are never logged.
- **[designed]** Sentry (`@sentry/nextjs`, and the Cloudflare SDK for Workers) once a DSN exists, with PII scrubbing for names and invite codes. Workers will log through `console.log` JSON to Workers Logs.

## 9. Performance

- The homepage and `/host` are statically prerendered. Fonts are self-hosted with `display: swap`. The Gurmukhi and Bengali faces load only when their glyphs appear.
- Scene 1 animates only transform and opacity. Lamps never scale up. Glow layers are gradients rather than filters.
- **Not yet measured:** Core Web Vitals on real devices, and frame timing on low-end Android. The first Lighthouse and WebPageTest runs are a Phase 2 task, and no performance numbers are claimed until then.

## 10. Testing

| Layer                                                                   | Tool                                                                    | Where                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Contracts (schemas, invite codes, names)                                | Vitest                                                                  | `packages/contracts/src/*.test.ts`                                  |
| Party service, RLS isolation, rate limiting, tokens                     | Vitest against a real Postgres (`diwali_house_test`, recreated per run) | `apps/web/src/server/**/*.test.ts`                                  |
| Pure UI geometry (camera, arch), palette drift                          | Vitest                                                                  | `apps/web/src/scenes`, `design-system`                              |
| Game rules and private views (seeded RNG), rangoli rules and geometry   | Vitest                                                                  | `packages/{teen-patti,tambola,raja-mantri,charades,rangoli,mehfil}` |
| Realtime cores (dedupe, views, directory, courtyard), tickets, notices  | Vitest                                                                  | `apps/realtime/src`, `packages/realtime-protocol`                   |
| The Worker for real: hands, courtyard, refused tickets, revocation      | `pnpm --filter @diwali/realtime smoke` against `wrangler dev`           | `apps/realtime/scripts/smoke.mjs`                                   |
| User flows, isolation over HTTP, no-JS, reduced motion, phone + desktop | Playwright against a production build and `diwali_house_e2e_test`       | `apps/web/e2e/`                                                     |
| Load                                                                    | k6                                                                      | **Not yet written.**                                                |

## 11. Known limitations (Phase 1)

- The guest list itself still polls (presence is live); membership changes arrive within ~5 s.
- No cross-device seat recovery, no co-hosts, no host transfer, hosts cannot leave.
- No Content-Security-Policy yet.
- Rate limits are per network, so a large venue on one NAT shares budgets: 40 joins per 10 minutes. That's comfortable for a house party, but a large event would need per-party limits.
- See § 5 "Deferred hardening".
- Scene 2 copy has not yet been reviewed by members of the communities it describes.
- Realtime state (games, the rangoli) lives only in Durable Object storage. It is not archived to Postgres, and the planned 30-day retention will need to cover it.
