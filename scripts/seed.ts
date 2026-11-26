import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

/**
 * Seed: demo users and two sample orders for the demo customer.
 * Safe to re-run: users are upserted by email, sample orders are only
 * created when the customer has no orders yet.
 *
 *   Admin:    admin@iyrix.test / Admin123!
 *   Customer: customer@demo.test / Customer123!
 *   Customer: sarah@demo.test / Customer123!
 */
async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@iyrix.test" },
    update: {},
    create: {
      email: "admin@iyrix.test",
      name: "Iyrix Admin",
      role: "ADMIN",
      passwordHash: await hashPassword("Admin123!"),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@demo.test" },
    update: {},
    create: {
      email: "customer@demo.test",
      name: "Demo Customer",
      role: "CUSTOMER",
      passwordHash: await hashPassword("Customer123!"),
    },
  });

  await prisma.user.upsert({
    where: { email: "sarah@demo.test" },
    update: {},
    create: {
      email: "sarah@demo.test",
      name: "Sarah Ahmed",
      role: "CUSTOMER",
      passwordHash: await hashPassword("Customer123!"),
    },
  });

  const existing = await prisma.order.count({ where: { customerId: customer.id } });
  if (existing === 0) {
    // One finished order, so the customer list is not empty on first login.
    await prisma.order.create({
      data: {
        customerId: customer.id,
        domain: "acme-corp.com",
        provider: "GOOGLE",
        mailboxCount: 5,
        status: "ACTIVE",
        idempotencyKey: "seed-active-acme-corp",
        mailboxes: {
          create: Array.from({ length: 5 }, (_, i) => ({
            address: `mailbox${i + 1}@acme-corp.com`,
            status: "PROVISIONED",
          })),
        },
        auditLogs: {
          create: [
            { fromStatus: null, toStatus: "PENDING", actorId: customer.id, reason: "Order created" },
            { fromStatus: "PENDING", toStatus: "PROVISIONING", reason: "Claimed by seed" },
            { fromStatus: "PROVISIONING", toStatus: "ACTIVE", reason: "All 5 mailboxes provisioned" },
          ],
        },
      },
    });

    // One failed order, so the admin retry button has something to retry.
    await prisma.order.create({
      data: {
        customerId: customer.id,
        domain: "globex-mail.com",
        provider: "MICROSOFT",
        mailboxCount: 3,
        status: "FAILED",
        idempotencyKey: "seed-failed-globex",
        mailboxes: {
          create: [
            { address: "mailbox1@globex-mail.com", status: "PROVISIONED" },
            { address: "mailbox2@globex-mail.com", status: "PROVISIONED" },
            {
              address: "mailbox3@globex-mail.com",
              status: "FAILED",
              error: "Mock microsoft API rejected mailbox3@globex-mail.com",
            },
          ],
        },
        auditLogs: {
          create: [
            { fromStatus: null, toStatus: "PENDING", actorId: customer.id, reason: "Order created" },
            { fromStatus: "PENDING", toStatus: "PROVISIONING", reason: "Claimed by seed" },
            {
              fromStatus: "PROVISIONING",
              toStatus: "FAILED",
              reason: "1 of 3 mailboxes failed to provision",
            },
          ],
        },
      },
    });
  }

  console.log(`Seeded admin ${admin.email} and customer ${customer.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
