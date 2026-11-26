import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { orderRepository } from "@/lib/repositories/orderRepository";
import CreateOrderForm from "@/components/CreateOrderForm";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const orders = await orderRepository.findByCustomer(user.id);

  return (
    <>
      <h1>My orders</h1>
      <div className="card">
        <h2>New order</h2>
        <CreateOrderForm />
      </div>
      <div className="card">
        <h2>Orders ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="muted">No orders yet. Create your first one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Provider</th>
                <th>Mailboxes</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`}>{o.domain}</Link>
                  </td>
                  <td>{o.provider === "GOOGLE" ? "Google" : "Microsoft"}</td>
                  <td>{o.mailboxCount}</td>
                  <td>
                    <span className={`badge badge-${o.status}`}>{o.status}</span>
                  </td>
                  <td>{o.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
