import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { orderRepository } from "../repositories/orderRepository";
import { transitionOrder } from "./orderService";
import { getProvider } from "./providers";

/**
 * Worker (queue + worker pattern). The database is the queue: PENDING orders
 * are the jobs. `claimNextPending` is the lock — an atomic conditional
 * update — so two worker processes can never process the same order twice,
 * and a crashed worker's claim expires after CLAIM_TTL_MS so the order is
 * picked up again. Mailboxes already PROVISIONED are skipped on a re-run,
 * so a retry never provisions the same mailbox twice.
 */

export const CLAIM_TTL_MS = 5 * 60 * 1000;

export interface WorkerResult {
  orderId: string;
  outcome: "ACTIVE" | "FAILED";
  provisioned: number;
  failed: number;
}

/** Process a single PENDING order. Returns null when there is nothing to do. */
export async function runWorkerOnce(workerId: string = `worker-${randomUUID()}`): Promise<WorkerResult | null> {
  const order = await orderRepository.claimNextPending(workerId, CLAIM_TTL_MS);
  if (!order) return null;

  await transitionOrder(order.id, "PROVISIONING", null, `Claimed by ${workerId}`);

  const provider = getProvider(order.provider);
  const mailboxes = await prisma.mailbox.findMany({
    where: { orderId: order.id },
    orderBy: { address: "asc" },
  });

  let failed = 0;
  for (const mailbox of mailboxes) {
    if (mailbox.status === "PROVISIONED") continue; // already done, never redo
    try {
      await provider.provision(mailbox.address);
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: "PROVISIONED", error: null },
      });
    } catch (err) {
      failed++;
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Provisioning failed",
        },
      });
    }
  }

  const provisioned = mailboxes.length - failed;
  const outcome = failed === 0 ? "ACTIVE" : "FAILED";
  await transitionOrder(
    order.id,
    outcome,
    null,
    outcome === "ACTIVE"
      ? `All ${mailboxes.length} mailboxes provisioned`
      : `${failed} of ${mailboxes.length} mailboxes failed to provision`,
  );
  return { orderId: order.id, outcome, provisioned, failed };
}

/** Poll forever (or until `signal` aborts), processing orders as they arrive. */
export async function runWorkerLoop(opts?: {
  pollMs?: number;
  signal?: AbortSignal;
  onResult?: (r: WorkerResult) => void;
}): Promise<void> {
  const pollMs = opts?.pollMs ?? Number(process.env.WORKER_POLL_MS ?? 2000);
  const workerId = `worker-${randomUUID()}`;
  console.log(`[${workerId}] started, polling every ${pollMs}ms`);
  while (!opts?.signal?.aborted) {
    const result = await runWorkerOnce(workerId);
    if (result) {
      console.log(
        `[${workerId}] order ${result.orderId}: ${result.outcome} (${result.provisioned} ok, ${result.failed} failed)`,
      );
      opts?.onResult?.(result);
    } else {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  console.log(`[${workerId}] stopped`);
}
