import type { OrderWithRelations } from "./repositories/orderRepository";
import type { User } from "@prisma/client";

/** Public shapes returned by the API. Password hashes never leave the server. */

export function presentUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function presentOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    domain: order.domain,
    provider: order.provider,
    mailboxCount: order.mailboxCount,
    status: order.status,
    idempotencyKey: order.idempotencyKey,
    customer: { id: order.customer.id, email: order.customer.email, name: order.customer.name },
    mailboxes: order.mailboxes.map((m) => ({
      id: m.id,
      address: m.address,
      status: m.status,
      error: m.error,
    })),
    auditLog: order.auditLogs.map((a) => ({
      id: a.id,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      actor: a.actor ? a.actor.name : "system",
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function presentOrderSummary(order: OrderWithRelations) {
  const full = presentOrder(order);
  return {
    id: full.id,
    domain: full.domain,
    provider: full.provider,
    mailboxCount: full.mailboxCount,
    status: full.status,
    customer: full.customer,
    createdAt: full.createdAt,
  };
}
