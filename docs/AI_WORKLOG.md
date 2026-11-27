# AI Worklog

How this repo was actually built, written honestly. The build was done by
an AI coding agent (Muse) under the user's direction, using the same
workflow the test asks for: plan, steer with prompts, review the output,
fix what was wrong, and keep small commits. The user will explain every
part in the follow-up call, so this log says what really happened.

## Planning approach

1. Read the test PDF first and treat it as the only source of truth.
2. Check the environment before writing code: Node 24, no Docker, no
   Postgres installed. Installed PostgreSQL 16 locally instead and kept
   `docker-compose.yml` as the documented path for reviewers.
3. Build in priority order from the spec: order creation + state machine,
   provider abstraction + worker, admin list with retry + audit log,
   customer views, tests.
4. Verify at each step: tests, typecheck, lint, production build, then
   the full flow end to end (create order → worker → success/failure →
   admin retry) before calling anything done.

## Key prompts

1. "Build the Iyrix take-home test app from the PDF spec in
   ~/workspace/iyrix-test/, layered Next.js + Prisma, small commits."
2. "Check whether docker and local Postgres are available; if docker is
   unavailable, use whatever Postgres is available and document the
   limitation honestly."
3. "Verify the app actually runs: run the tests, exercise the order flow
   end to end, and test the README setup steps on a clean copy."
4. "Be honest in AI_WORKLOG.md about the process actually used. Document
   real prompts, real mistakes and real fixes. Do not invent entries."
5. "Keep the code and docs clean and understandable — the user must be
   able to explain every part in a follow-up call."

## Where the AI was wrong (and how it was fixed)

### 1. Prisma 8 RC vs Prisma Client 7, and a vitest peer conflict

**What happened:** the first `npm install prisma` pulled Prisma CLI
8.0.0-rc.36 while `@prisma/client` resolved to 7.10.1. Installing
vitest then failed with an eresolve error: vitest 5 wants
`@types/node ^22`, the project had `^20`, and the Prisma 8 toolchain
dragged in conflicting vite peers.

**Fix:** pinned the CLI to `prisma@7.10.1` to match the client, pinned
`vitest@4`, and installed with `--legacy-peer-deps --ignore-scripts`.
Verified with `npx prisma --version` (7.10.1) and `npm ls`.

### 2. Prisma 7 breaking changes I wrote against first

**What happened:** I wrote the Prisma 7 schema the old way
(`url = env("DATABASE_URL")` in `schema.prisma`) and a plain
`new PrismaClient()`. Both failed: Prisma 7 moved the datasource URL
into `prisma.config.ts`, and the client now requires a driver adapter.

**Fix:** removed `url` from the schema, added `prisma.config.ts` with
`defineConfig` + `env("DATABASE_URL")`, installed `@prisma/adapter-pg`
and `pg`, and built the client with
`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
Documented in CLAUDE.md so nobody repeats it.

### 3. Prisma engine downloads kept failing (ECONNRESET)

**What happened:** `prisma migrate dev` downloads the schema-engine
binary over Node's TLS stack, and the connection reset every time
through the VM's egress proxy. Three retries all failed the same way.

**Fix:** downloaded the engine with `curl` (which worked fine),
seeded it into the Prisma cache
(`~/.cache/prisma/master/<commit>/debian-openssl-3.0.x/`) plus a
matching `.sha256` file (no trailing newline — the first attempt with a
trailing newline failed the integrity check), and copied it into
`node_modules/@prisma/engines/`. Migration then ran.

### 4. The `@/` import alias pointed at the wrong directory

**What happened:** `create-next-app --no-src-dir` generated
`tsconfig.json` with `"@/*": ["./*"]`, but the code lives in `src/`.
Typecheck and build failed on every `@/lib/...` import.

**Fix:** changed the mapping to `"@/*": ["./src/*"]` and added
`"@/components/*": ["./components/*"]` for the components at the repo
root. Typecheck and lint then passed.

### 5. The logout form navigated to a JSON response

**What happened:** the layout's sign-out was a plain HTML form posting
to `/api/auth/logout`, which returns JSON — the browser would have
shown raw JSON instead of returning to the login page.

**Fix:** replaced it with a client `LogoutButton` that fetches the
endpoint and then uses `router.push("/login")`. ESLint also flagged the
first `window.location.href` version; the router version is clean.

### 6. Postgres disappeared mid-session

**What happened:** after the first successful install, PostgreSQL was
gone from `/usr/lib/postgresql` and `/var/lib/postgresql` — the VM had
been reset, wiping everything outside the home directory. The migration
then failed with "Can't reach database server".

**Fix:** reinstalled PostgreSQL 16, recreated the `mailbox_app` user and
the `mailbox_dev` / `mailbox_test` databases, and noted the limitation
in the README: on this VM, `docker compose up -d` is the supported
path; a local apt install does not survive a VM reset.

### 7. Integration test hook timed out

**What happened:** the integration test's `beforeAll` runs
`npx prisma migrate deploy`, which takes ~26 seconds to start; the
default Vitest hook timeout is 10 seconds, so the suite failed before
any test ran.

**Fix:** set `hookTimeout: 120_000` in `vitest.config.ts`.

## What was changed by hand

- The state machine transition table and the worker claim query were
  reviewed line by line after generation and kept as written; the claim
  TTL (5 minutes) and the "skip already PROVISIONED mailboxes" rule
  were deliberate choices, not defaults.
- The seed data (two sample orders, one ACTIVE and one FAILED) was
  chosen by hand so the admin retry button has something to retry on
  first login.
- `PROVIDER_FAIL_ALL=1` was added as a documented test hook so the
  failure path can be shown deterministically in the demo video.

## Time per phase

| Phase | Time |
| ----- | ---- |
| Environment + scaffold + dependencies (incl. Prisma engine fight) | ~1 h 00 m |
| Core code: schema, services, API routes, UI | ~1 h 00 m |
| Prisma 7 fixes, tests green, typecheck/lint/build | ~1 h 00 m |
| End-to-end verification, demo video, docs, push | ~1 h 00 m |
| **Total (phase estimates)** | **~4 h 00 m** |

Phase times are rough estimates from the session, not a measured total.
The wall-clock session ran longer than the 4-hour cap once the
environment fights are counted (local Postgres vanishing after a VM
reset, the Prisma engine download failing through the proxy, and a slow
GitHub API push). The cap was not met. The Vercel deploy and the demo
video came after the build, at the user's order, and are listed below,
not in this total.

## Live deployment (after the 4-hour build)

- Deployed to Vercel (project iyrix-test) with a free Neon Postgres
  database from the Vercel Marketplace. The build VM cannot reach Neon
  over raw Postgres TCP (the sandbox network intercepts port 5432), so
  migrations and the seed run at build time on Vercel instead:
  `vercel-build` runs `prisma generate`, `prisma migrate deploy`, then
  `npm run db:seed`, then `next build`. The seed is idempotent, so
  re-running it on every deploy is safe. The `prisma generate` step
  matters: the repo has no postinstall hook, so a fresh Vercel install
  has no generated client until generate runs (the first deploy failed
  on the seed for exactly this reason).
- Added a small "Run worker" button to the admin page. It POSTs to the
  existing admin-only `/api/worker/run` route and shows the result
  inline. It is only a demo affordance for the live link, where no
  background worker process runs; the worker design itself did not
  change.
