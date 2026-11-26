# CLAUDE.md

Guidance for working in this repo with an AI coding agent.

## What this is

Mailbox Order Manager: a small internal tool for a company that sells
pre-warmed Google and Microsoft mailboxes. Customers order mailboxes;
a background worker provisions them through mocked providers; admins
watch everything and retry failed orders.

Stack: Next.js 16 (App Router, TypeScript, strict) + PostgreSQL 16 via
Prisma 7 + zod validation + Vitest. No Tailwind, plain CSS.

## Commands

```bash
npm run dev          # Next.js dev server on http://localhost:3000
npm run build        # production build
npm run start        # production server (after build)
npm run lint         # eslint
npm run test         # vitest: state-machine unit tests + order-creation integration test
npm run db:migrate   # prisma migrate dev (applies schema to DATABASE_URL)
npm run db:seed      # seed demo users + two sample orders
npm run worker       # background worker (polls for PENDING orders)
```

## Setup

```bash
cp .env.example .env
docker compose up -d            # local Postgres (or use an existing one)
npm run db:migrate
npm run db:seed
npm run dev                     # terminal 1
npm run worker                  # terminal 2
```

Demo logins: admin `admin@iyrix.test` / `Admin123!`,
customer `customer@demo.test` / `Customer123!`.

## Where the rules live

- `src/lib/state-machine.ts` — the only place that knows which order
  status transitions are legal. Every transition goes through it.
- `src/lib/services/orderService.ts` — order creation (idempotent),
  retry, and the transition helper that also writes the audit log.
- `src/lib/services/providers.ts` — the provider Strategy interface and
  the mocked Google/Microsoft implementations.
- `src/lib/services/worker.ts` — claim-and-process loop. The DB is the
  queue; the claim is an atomic conditional update (the lock).
- `src/lib/repositories/` — the only files that import Prisma directly
  for queries. Services never touch Prisma except through transactions.
- `src/lib/validation.ts` — every zod schema. Route handlers only call
  `parseBody()` with one of these.
- `src/lib/auth.ts` — session cookies (random token, SHA-256 hash stored
  in the DB) and bcrypt password checks.

## Rules for changes

- No business logic in route handlers or components. Handlers
  authenticate, validate, call a service, return JSON.
- No new order status transition without updating `state-machine.ts`
  and its tests first.
- Every status change must write an `AuditLog` row in the same
  transaction as the status update.
- Keep `docs/AI_WORKLOG.md` honest: record real prompts, real mistakes
  and real fixes, with time per phase.
- Small, meaningful commits. Never one giant commit.
- `npm test` and `npm run build` must pass before any commit that
  touches `src/`.

## Prisma 7 notes (learned the hard way)

- The datasource `url` does NOT belong in `schema.prisma` anymore.
  It lives in `prisma.config.ts` (`defineConfig` + `env("DATABASE_URL")`).
- `new PrismaClient()` needs a driver adapter:
  `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  See `src/lib/prisma.ts`.
- `prisma.config.ts` loads `.env` via `import "dotenv/config"` at the
  top, because the CLI does not reliably inject it for `env()`.
