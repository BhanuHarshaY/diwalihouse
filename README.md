# Diwali House

A private, illustrated house party for Diwali. A host opens the house, guests join from their phones with an invitation (no accounts), and, in later phases, everyone plays Teen Patti and party games, shares a jukebox, draws a rangoli and leaves messages.

**Status: Phase 2.** The illustrated homepage story, hosting, joining, invitations, party isolation, live presence and **Teen Patti in the Card Room**, **Tambola, Raja Mantri Chor Sipahi and Dumb Charades in the Game Bazaar**, the shared **Rangoli Courtyard**, the **Music Mehfil** (a YouTube request queue) and **Diwali Daak** (the postcard guestbook) work and are tested. Nothing is deployed yet. See `docs/roadmap.md`.

| Read                              | For                                                               |
| --------------------------------- | ----------------------------------------------------------------- |
| `docs/product-spec.md`            | What we're building and what is in each phase                     |
| `docs/architecture.md`            | System design, isolation model, realtime plan, tradeoffs          |
| `docs/games/teen-patti-rules.md`  | Teen Patti rules and variants (signed off)                        |
| `docs/games/tambola-rules.md`     | Tambola rules as built                                            |
| `docs/games/raja-mantri-rules.md` | Raja Mantri Chor Sipahi rules as built                            |
| `docs/games/charades-rules.md`    | Dumb Charades rules as built                                      |
| `docs/rangoli-courtyard.md`       | How the shared rangoli works: tools, limits, moderation           |
| `docs/music-mehfil.md`            | How the music queue works: requests, votes, the speaker, YouTube  |
| `docs/diwali-daak.md`             | How the guestbook works: postcards, moderation, the keepsake      |
| `design/visual-direction.md`      | Art direction and the design system's principles                  |
| `design/asset-manifest.md`        | Every asset, its source and licence, and the artwork still needed |
| `CLAUDE.md`                       | Working rules for contributors and coding agents                  |

## Local setup

Requirements: **Node 22.12+**, **pnpm 10** (`npm i -g pnpm@10` or `corepack enable`), and **PostgreSQL 15+** running locally. Postgres.app, Homebrew, or Docker all work, for example `docker run -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17`.

```bash
pnpm install

# Configuration lives with the web app; migrations and tests read the same file.
cp apps/web/.env.example apps/web/.env.local
#   set APP_SECRET:  openssl rand -base64 48
#   adjust DATABASE_URL / DATABASE_URL_TEST if your Postgres needs a user or password,
#   e.g. postgres://postgres@localhost:5432/diwali_house

createdb diwali_house          # or: psql -c 'create database diwali_house'
pnpm db:migrate

# Realtime (Card Room, Game Bazaar, presence): a local Ed25519 key pair for tickets.
pnpm --filter @diwali/realtime-protocol keys

pnpm dev                       # web on http://localhost:3000, realtime Worker on :8787
```

The migration creates a `diwali_party_scope` role (cluster-wide) and grants it to the connecting user, so the connecting user needs `CREATEROLE`. Local superusers and Supabase's `postgres` role both have it.

### Tests

```bash
pnpm test        # Vitest: contracts, party service + RLS isolation (real Postgres), geometry
pnpm test:e2e    # Playwright: builds the app, serves on :3100 with the Worker on :8788, own database
pnpm --filter @diwali/realtime smoke   # with `pnpm dev` running: a hand over real sockets
```

Both suites create and drop their own databases (`diwali_house_test`, `diwali_house_e2e_test`). For Playwright, install the browser once with `pnpm --filter @diwali/web exec playwright install chromium`.

### Visual QA

With `pnpm dev` running:

```bash
node apps/web/scripts/capture-screens.mjs            # phone + desktop
node apps/web/scripts/capture-screens.mjs "" phone   # one size
```

Screenshots go to `apps/web/test-results/screens/`. The script creates a real party through the UI.

## Deployment

Nothing has been deployed yet. These are the steps for the first deployment; Phase 2 adds Cloudflare.

### 1. Supabase (Postgres)

1. Create a project. Note the **direct** connection string (port 5432) and the **transaction pooler** string (port 6543).
2. Apply migrations with either
   - `supabase link` then `supabase db push` (files in `supabase/migrations/` follow the CLI's naming), **or**
   - `DATABASE_URL=<direct url> pnpm db:migrate`.

   Use one migrator per database: they keep separate history tables.

3. Nothing else is needed in Supabase. The app doesn't use Supabase Auth or the auto-generated API, and the `diwali` schema is not exposed to PostgREST.

### 2. Vercel (web app)

1. Import the repository. Set **Root Directory** to `apps/web`; Vercel detects Next.js and pnpm.
2. Environment variables (Production and Preview):

   | Name               | Value                                                                                               |
   | ------------------ | --------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`     | Supabase **transaction pooler** URL (`:6543`)                                                       |
   | `DATABASE_POOLED`  | `true` (disables prepared statements, which the pooler can't hold)                                  |
   | `APP_SECRET`       | 48 random bytes, base64                                                                             |
   | `PUBLIC_APP_URL`   | `https://<your domain>`. HTTPS here turns on `Secure` and `__Host-` cookies.                        |
   | `CLIENT_IP_HEADER` | Leave unset on Vercel. When self-hosting, set it to the header your edge writes the client IP into. |

3. Put the Vercel project in the same region as the Supabase database.
4. Preview deployments should use a separate Supabase project or branch, never production data.

### 3. Cloudflare (realtime)

1. Generate a production key pair (the `keys` script writes local files; for production run it once in a scratch checkout, or generate with any Ed25519 JWK tool). Never reuse the dev keys.
2. In `apps/realtime`:
   ```bash
   pnpm exec wrangler login
   pnpm exec wrangler secret put REALTIME_PUBLIC_KEY      # the public JWK, as JSON
   pnpm exec wrangler deploy --var ALLOWED_ORIGINS:https://<your domain>
   ```
   The Durable Object classes are created by the `v1` migration in `wrangler.jsonc`.
3. On Vercel, add `REALTIME_PRIVATE_KEY` (the private JWK, as JSON) and `REALTIME_URL` (`wss://<worker>.workers.dev` or your custom domain).

Check it with `REALTIME_URL=wss://… pnpm --filter @diwali/realtime smoke` (it signs tickets with the key in `apps/web/.env.local`, so point it at a dev deployment, not production).

## Repository

```
apps/web               Next.js app: routes, server layer, design system, scenes, party hall
apps/realtime          Cloudflare Worker + Durable Objects: presence and every game room
packages/game-kit      The shared engine shape: RNG, shuffle, actors, outcomes
packages/teen-patti    Pure Teen Patti engine and private views
packages/tambola       Pure Tambola engine: tickets, calling, verified claims
packages/raja-mantri   Pure Raja Mantri Chor Sipahi engine
packages/charades      Pure Dumb Charades engine and film list
packages/rangoli       Rangoli Courtyard rules and symmetry geometry
packages/mehfil        Music Mehfil queue rules and YouTube link parsing
packages/realtime-protocol  Ed25519 tickets and socket message schemas
packages/contracts     Shared Zod schemas and types
packages/db            Postgres client, migrator, test-database helpers
packages/tsconfig      Shared TypeScript configs
supabase/migrations    SQL migrations
design/                Art direction, typography, illustration spec, asset manifest, references
docs/                  Architecture, product spec, roadmap, game rules
```
