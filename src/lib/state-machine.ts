import type { OrderStatus } from "@prisma/client";

/**
 * The order state machine. Every status change in the system goes through
 * `assertTransition`, so an illegal move is impossible by construction and
 * every legal move is recorded in the audit log by the caller.
 *
 *   PENDING ──► PROVISIONING ──► ACTIVE
 *      │             │
 *      │             └──────────► FAILED ──► PENDING  (admin retry)
 *      └────────────────────────► FAILED
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["PROVISIONING", "FAILED"],
  PROVISIONING: ["ACTIVE", "FAILED"],
  ACTIVE: [],
  FAILED: ["PENDING"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    throw new Error(`Invalid transition: order is already ${from}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} -> ${to} is not allowed`);
  }
}
