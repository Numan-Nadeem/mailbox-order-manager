# Mailbox Order Manager

A small internal tool for a company that sells pre-warmed Google and
Microsoft mailboxes. Built as the take-home test for Iyrix Technologies
(Full Stack Engineer).

> **Demo video (2–3 min):** [demo.mp4](DEMO_VIDEO_URL) — a customer
> creates an order, one order succeeds and one fails, an admin sees the
> audit log and retries, and the tests run.

## What it does

- **Login** with seeded users and two roles: customer (sees only their
  own orders) and admin (sees all orders).
- **Customer** creates an order: domain, provider (Google or Microsoft),
  mailbox count (1–50). Creation is idempotent: replaying the same
  submission returns the original order, never a duplicate.
- **Status flow:** `PENDING → PROVISIONING → ACTIVE`, or `FAILED` with
  an admin retry back to `PENDING`. Invalid transitions are rejected,
  and every transition is saved to an audit log.
- **Background worker** provisions mailboxes through a provider
  abstraction (mocked Google and Microsoft, a few seconds per call,
  ~20% random failure). Running it twice never processes the same order
  twice (atomic claim + 5-minute lease).
- **Screens:** customer order list, create form, order detail with
  per-mailbox status and audit log; admin list with status and provider
  filters, pagination, and a retry button.
- **Validation** with zod and one consistent error shape everywhere.

## Run it (under 10 minutes on a clean clone)

```bash
git clone <repo-url>
cd mailbox-order-manager
npm install

cp .env.example .env        # defaults point at the docker Postgres below
docker compose up -d        # local PostgreSQL 16

npm run db:migrate          # create tables
npm run db:seed             # demo users + two sample orders
npm run dev                 # app on http://localhost:3000 (terminal 1)
npm run worker              # background worker (terminal 2)
```

No Docker? Point `DATABASE_URL` in `.env` at any PostgreSQL 16 and
skip `docker compose up -d`. The rest is unchanged.

### Demo logins

| Role     | Email               | Password     |
| -------- | ------------------- | ------------ |
| Admin    | admin@iyrix.test    | Admin123!    |
| Customer | customer@demo.test  | Customer123! |
| Customer | sarah@demo.test     | Customer123! |

### Tests

```bash
npm test
```

Runs the state-machine unit tests plus an order-creation integration
test against a real PostgreSQL database. The integration test uses
`mailbox_test` (see `TEST_DATABASE_URL` in the test file, or set it in
your environment). Create it first:

```sql
CREATE DATABASE mailbox_test OWNER mailbox_app;
```

## How it is built

Next.js 16 (App Router, TypeScript strict) + PostgreSQL via Prisma 7 +
zod + Vitest. Layered: pages and components render only; API routes
authenticate, validate and call a service; services own the rules;
repositories own the queries. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the patterns (state machine, Strategy providers, repository, DB-as-queue
worker, idempotency) and the alternatives that were rejected.

`docs/AI_WORKLOG.md` records how the build actually went: planning,
key prompts, where the AI was wrong and how it was fixed, and time per
phase. `CLAUDE.md` is the working guide for the repo.

## Known limitations

- Providers are **mocked**: no real Google/Microsoft API is called.
  Swap in a real implementation of `MailboxProvider` in
  `src/lib/services/providers.ts` to go live.
- Auth is email + password with DB sessions; there is no password reset,
  no email verification, and no rate limiting on login.
- The worker polls the DB every 2 seconds (`WORKER_POLL_MS`). It is a
  single-process loop, not a horizontally scaled queue.
- `PROVIDER_FAIL_ALL=1` forces every mocked provisioning call to fail.
  It exists so the failure path can be shown deterministically in the
  demo; do not set it in production.
- Passwords in the seed are demo-only (`Admin123!` / `Customer123!`).
  Change them before any real use.
