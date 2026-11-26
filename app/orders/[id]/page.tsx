import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { orderRepository } from "@/lib/repositories/orderRepository";
import RetryButton from "@/components/RetryButton";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const order = await orderRepository.findById(id);
  if (!order) notFound();
  if (user.role !== "ADMIN" && order.customerId !== user.id) notFound();

  return (
    <>
      <h1>Order — {order.domain}</h1>
      <div className="card">
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            <span className={`badge badge-${order.status}`}>{order.status}</span>
          </dd>
          <dt>Provider</dt>
          <dd>{order.provider === "GOOGLE" ? "Google" : "Microsoft"}</dd>
          <dt>Mailboxes</dt>
          <dd>{order.mailboxCount}</dd>
          <dt>Customer</dt>
          <dd>
            {order.customer.name} ({order.customer.email})
          </dd>
          <dt>Created</dt>
          <dd>{order.createdAt.toLocaleString()}</dd>
          <dt>Idempotency key</dt>
          <dd>
            <code>{order.idempotencyKey}</code>
          </dd>
        </dl>
        {user.role === "ADMIN" && order.status === "FAILED" && (
          <RetryButton orderId={order.id} />
        )}
      </div>

      <div className="card">
        <h2>Mailboxes</h2>
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {order.mailboxes.map((m) => (
              <tr key={m.id}>
                <td>
                  <code>{m.address}</code>
                </td>
                <td>
                  <span className={`badge badge-${m.status}`}>{m.status}</span>
                </td>
                <td className="muted">{m.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Audit log</h2>
        {order.auditLogs.length === 0 ? (
          <p className="muted">No transitions recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Transition</th>
                <th>Actor</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {order.auditLogs.map((a) => (
                <tr key={a.id}>
                  <td>{a.createdAt.toLocaleString()}</td>
                  <td>
                    {a.fromStatus ?? "—"} → {a.toStatus}
                  </td>
                  <td>{a.actor ? a.actor.name : "system"}</td>
                  <td className="muted">{a.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
