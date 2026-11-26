import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "../../lib/prisma";
import { createOrder } from "../services/orderService";

/**
 * Integration test: order creation against a real PostgreSQL database.
 * Requires TEST_DATABASE_URL (defaults to the local mailbox_test database).
 * The schema is deployed with `prisma migrate deploy` before the suite runs.
 */

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://mailbox_app:mailbox_dev@localhost:5432/mailbox_test";

let customerId: string;

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
  const customer = await prisma.user.upsert({
    where: { email: "test-customer@example.com" },
    update: {},
    create: {
      email: "test-customer@example.com",
      name: "Test Customer",
      role: "CUSTOMER",
      passwordHash: "not-a-real-hash",
    },
  });
  customerId = customer.id;
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.mailbox.deleteMany();
  await prisma.order.deleteMany();
});

describe("createOrder (integration)", () => {
  it("creates an order with mailboxes and an audit entry, in PENDING", async () => {
    const { order, deduped } = await createOrder(customerId, {
      domain: "acme.com",
      provider: "GOOGLE",
      mailboxCount: 3,
    });

    expect(deduped).toBe(false);
    expect(order.status).toBe("PENDING");
    expect(order.mailboxes).toHaveLength(3);
    expect(order.mailboxes.map((m) => m.address)).toEqual([
      "mailbox1@acme.com",
      "mailbox2@acme.com",
      "mailbox3@acme.com",
    ]);
    expect(order.mailboxes.every((m) => m.status === "PENDING")).toBe(true);
    expect(order.auditLogs).toHaveLength(1);
    expect(order.auditLogs[0].toStatus).toBe("PENDING");
  });

  it("is idempotent: replaying the same key returns the original order", async () => {
    const key = "11111111-2222-4333-8444-555555555555";
    const first = await createOrder(customerId, {
      domain: "acme.com",
      provider: "GOOGLE",
      mailboxCount: 2,
      idempotencyKey: key,
    });
    const second = await createOrder(customerId, {
      domain: "acme.com",
      provider: "GOOGLE",
      mailboxCount: 2,
      idempotencyKey: key,
    });

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects a mailbox count outside 1-50 at the validation layer", async () => {
    const { createOrderSchema } = await import("../validation");
    expect(createOrderSchema.safeParse({ domain: "acme.com", provider: "GOOGLE", mailboxCount: 0 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ domain: "acme.com", provider: "GOOGLE", mailboxCount: 51 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ domain: "not a domain", provider: "GOOGLE", mailboxCount: 5 }).success).toBe(false);
    expect(
      createOrderSchema.safeParse({ domain: "acme.com", provider: "GOOGLE", mailboxCount: 50 }).success,
    ).toBe(true);
  });
});
