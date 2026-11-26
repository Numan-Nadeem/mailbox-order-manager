import { prisma } from "../prisma";
import { assertTransition } from "../state-machine";
import { orderRepository, type OrderWithRelations } from "../repositories/orderRepository";
import type { CreateOrderInput } from "../validation";
import type { OrderStatus } from "@prisma/client";

/**
 * Service layer: all order business rules live here. Route handlers only
 * authenticate, validate input, call one service function, and return JSON.
 */

/** Record a status change and the audit row for it, inside one transaction. */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actorId: string | null,
  reason?: string,
): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  assertTransition(order.status, to);
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: to } }),
    prisma.auditLog.create({
      data: { orderId, fromStatus: order.status, toStatus: to, actorId, reason: reason ?? null },
    }),
  ]);
  const updated = await orderRepository.findById(orderId);
  if (!updated) throw new Error("Order not found");
  return updated;
}

function mailboxAddresses(domain: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `mailbox${i + 1}@${domain}`);
}

/**
 * Create an order. Idempotent on `idempotencyKey`: replaying the same key
 * returns the original order instead of a duplicate. The unique DB
 * constraint is the backstop against concurrent duplicates.
 */
export async function createOrder(
  customerId: string,
  input: CreateOrderInput,
): Promise<{ order: OrderWithRelations; deduped: boolean }> {
  const key = input.idempotencyKey ?? crypto.randomUUID();
  const existing = await orderRepository.findByIdempotencyKey(key);
  if (existing) {
    if (existing.customerId !== customerId) {
      throw new Error("Idempotency key belongs to another customer");
    }
    return { order: existing, deduped: true };
  }
  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId,
          domain: input.domain,
          provider: input.provider,
          mailboxCount: input.mailboxCount,
          status: "PENDING",
          idempotencyKey: key,
          mailboxes: {
            create: mailboxAddresses(input.domain, input.mailboxCount).map((address) => ({
              address,
              status: "PENDING",
            })),
          },
          auditLogs: {
            create: { fromStatus: null, toStatus: "PENDING", actorId: customerId, reason: "Order created" },
          },
        },
      });
      return created;
    });
    const full = await orderRepository.findById(order.id);
    if (!full) throw new Error("Order not found after creation");
    return { order: full, deduped: false };
  } catch (err) {
    // Lost a race with an identical request: the unique constraint fired,
    // so the other request's order is the answer.
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      const raced = await orderRepository.findByIdempotencyKey(key);
      if (raced) return { order: raced, deduped: true };
    }
    throw err;
  }
}

/** Admin retry: FAILED -> PENDING, and reset its mailboxes for a fresh run. */
export async function retryOrder(
  orderId: string,
  adminId: string,
  reason?: string,
): Promise<OrderWithRelations> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  assertTransition(order.status, "PENDING");
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING", claimedAt: null, claimedBy: null },
    }),
    prisma.mailbox.updateMany({
      where: { orderId },
      data: { status: "PENDING", error: null },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "PENDING",
        actorId: adminId,
        reason: reason ?? "Admin retry",
      },
    }),
  ]);
  const updated = await orderRepository.findById(orderId);
  if (!updated) throw new Error("Order not found");
  return updated;
}
