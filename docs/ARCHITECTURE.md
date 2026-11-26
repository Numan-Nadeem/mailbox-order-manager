# Architecture

Mailbox Order Manager — how the pieces fit and why.

## Layered architecture

```
UI (app/ pages + components)      — renders, collects input, nothing else
  └─ API routes (app/api/...)     — authenticate, validate (zod), call a service, return JSON
      └─ Services (src/lib/services/)   — all business rules
          └─ Repositories (src/lib/repositories/) — the only Prisma queries
              └─ PostgreSQL (Prisma)
```

No business logic lives in a route handler or a component. A handler is
about 20 lines: get the user, parse the body, call the service, return
the result. That keeps the rules testable without HTTP and the UI
replaceable without touching the rules.

**Alternative rejected:** putting queries directly in route handlers.
It is faster to write, but every rule then lives in two places (the page
and the API), and the worker would need its own copy of the same logic.

## State machine — `src/lib/state-machine.ts`

Orders move through one explicit machine:

```
PENDING ──► PROVISIONING ──► ACTIVE
   │             │
   │             └──────────► FAILED ──► PENDING  (admin retry)
   └────────────────────────► FAILED
```

`ALLOWED_TRANSITIONS` is the single source of truth. `assertTransition`
throws on any illegal move, and `transitionOrder` (in `orderService.ts`)
writes the status change and the `AuditLog` row in one transaction, so a
transition without an audit record cannot exist.

**Alternative rejected:** storing the status as a free string and
checking transitions ad hoc in each handler. That scatters the rules and
lets an invalid transition slip through whichever path forgets to check.

## Strategy — `src/lib/services/providers.ts`

Provisioning is one interface, `MailboxProvider.provision(address)`, with
one implementation per provider (`GoogleMailboxProvider`,
`MicrosoftMailboxProvider`). The worker asks `getProvider(order.provider)`
for the right one and never knows which provider it is talking to.

**Alternative rejected:** a `switch (provider)` inside the worker with
inline mock calls. It works for two providers and breaks for three;
every new provider would mean editing the worker, the service and the
tests instead of adding one class.

## Repository — `src/lib/repositories/orderRepository.ts`

All order queries live here. Services call `findById`,
`findByIdempotencyKey`, `listForAdmin`, or `claimNextPending` and never
write Prisma queries themselves. The claim query is the one place where
SQL-level thinking matters (see Worker below), so it lives here too.

## Queue + worker — `src/lib/services/worker.ts`

There is no separate queue service. PostgreSQL is the queue: a PENDING
order is a job. The worker claims one order with an atomic conditional
update — `UPDATE ... WHERE status = 'PENDING' AND (claimedAt IS NULL OR
claimedAt < now - 5min)` — and only proceeds if exactly one row was
updated. Two workers racing for the same order therefore get exactly one
winner; a crashed worker's claim expires after 5 minutes and the order
is picked up again. Mailboxes already PROVISIONED are skipped on a
re-run, so a retry never provisions the same mailbox twice.

**Alternative rejected:** an in-memory queue or a Redis list. It would
add a service the reviewer has to run, and the order state would live in
two places (queue + DB) that can disagree. The DB queue is one source of
truth and survives restarts.

## Idempotency — `createOrder` in `orderService.ts`

Every order carries a unique `idempotencyKey`. The create form generates
one UUID per form instance and sends it with the request. Replaying the
same key returns the original order (`deduped: true`) instead of a
duplicate. A unique DB constraint is the backstop: if two identical
requests race, one hits the constraint and re-reads the winner's order.

## Consistent errors — `src/lib/errors.ts`

Every API route returns the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {...} } }
```

`ApiError` carries status + code; `errorResponse` maps unknown errors to
`INTERNAL_ERROR` without leaking internals. Validation failures are 422
with the zod issue tree in `details`.

## Auth — `src/lib/auth.ts`

Email + bcrypt password. Sessions are random 32-byte tokens stored as
SHA-256 hashes in the `Session` table, sent as an `httpOnly` cookie.
Stealing the DB does not give away usable session tokens, and stealing
a cookie does not reveal the stored hash. Roles are `CUSTOMER` and
`ADMIN`; admin-only routes check the role after authentication.

## Testing

- `src/lib/__tests__/state-machine.test.ts` — unit tests over every
  (from, to) pair of the state machine.
- `src/lib/__tests__/orderService.integration.test.ts` — order creation
  against a real PostgreSQL database (`mailbox_test`): creation with
  mailboxes + audit entry, idempotent replay, and validation rejects.
