import { prisma } from "../prisma";
import type { Order, OrderStatus, Prisma } from "@prisma/client";

/**
 * Repository layer: the only place that talks to Prisma for orders.
 * Services own the rules; this file only owns the queries.
 */

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { customer: true; mailboxes: true; auditLogs: { include: { actor: true } } };
}>;

const include = {
  customer: true,
  mailboxes: { orderBy: { address: "asc" } },
  auditLogs: { include: { actor: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export const orderRepository = {
  findById(id: string): Promise<OrderWithRelations | null> {
    return prisma.order.findUnique({ where: { id }, include });
  },

  findByIdempotencyKey(key: string): Promise<OrderWithRelations | null> {
    return prisma.order.findUnique({ where: { idempotencyKey: key }, include });
  },

  findByCustomer(customerId: string): Promise<OrderWithRelations[]> {
    return prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include,
    });
  },

  async listForAdmin(filters: {
    status?: OrderStatus;
    provider?: "GOOGLE" | "MICROSOFT";
    page: number;
    pageSize: number;
  }): Promise<{ orders: OrderWithRelations[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.provider ? { provider: filters.provider } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total };
  },

  /**
   * Atomically claim one PENDING order for a worker run. The WHERE clause is
   * the lock: two workers racing for the same order only get one row back,
   * because the claim only succeeds while the order is still unclaimed (or
   * its old claim expired). Returns the claimed order, or null.
   */
  async claimNextPending(workerId: string, claimTtlMs: number): Promise<Order | null> {
    const staleBefore = new Date(Date.now() - claimTtlMs);
    const candidate = await prisma.order.findFirst({
      where: {
        status: "PENDING",
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return null;
    const claimed = await prisma.order.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
      },
      data: { claimedAt: new Date(), claimedBy: workerId },
    });
    if (claimed.count === 0) return null; // another worker won the race
    return prisma.order.findUnique({ where: { id: candidate.id } });
  },
};
