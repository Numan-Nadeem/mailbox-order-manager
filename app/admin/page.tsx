import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { orderRepository } from "@/lib/repositories/orderRepository";
import RetryButton from "@/components/RetryButton";
import { adminOrderListSchema } from "@/lib/validation";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/orders");

  const sp = await searchParams;
  const parsed = adminOrderListSchema.safeParse({
    status: typeof sp.status === "string" ? sp.status : undefined,
    provider: typeof sp.provider === "string" ? sp.provider : undefined,
    page: typeof sp.page === "string" ? sp.page : undefined,
    pageSize: typeof sp.pageSize === "string" ? sp.pageSize : undefined,
  });
  const filters = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 10 };
  const { orders, total } = await orderRepository.listForAdmin(filters);
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    if (filters.provider) p.set("provider", filters.provider);
    p.set("page", String(filters.page));
    p.set("pageSize", String(filters.pageSize));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") p.delete(k);
      else p.set(k, v);
    }
    return `?${p.toString()}`;
  };

  return (
    <>
      <h1>Admin — all orders</h1>
      <div className="card">
        <form method="get" className="toolbar">
          <label>
            Status{" "}
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="PROVISIONING">Provisioning</option>
              <option value="ACTIVE">Active</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
          <label>
            Provider{" "}
            <select name="provider" defaultValue={filters.provider ?? ""}>
              <option value="">All</option>
              <option value="GOOGLE">Google</option>
              <option value="MICROSOFT">Microsoft</option>
            </select>
          </label>
          <button type="submit">Filter</button>
          <span className="muted">
            {total} order{total === 1 ? "" : "s"}
          </span>
        </form>

        {orders.length === 0 ? (
          <p className="muted">No orders match these filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Customer</th>
                <th>Provider</th>
                <th>Mailboxes</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`}>{o.domain}</Link>
                  </td>
                  <td>{o.customer.email}</td>
                  <td>{o.provider === "GOOGLE" ? "Google" : "Microsoft"}</td>
                  <td>{o.mailboxCount}</td>
                  <td>
                    <span className={`badge badge-${o.status}`}>{o.status}</span>
                  </td>
                  <td>{o.createdAt.toLocaleString()}</td>
                  <td>{o.status === "FAILED" && <RetryButton orderId={o.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination">
          {filters.page > 1 && (
            <Link href={qs({ page: String(filters.page - 1) })}>← Previous</Link>
          )}
          <span className="muted">
            Page {filters.page} of {pageCount}
          </span>
          {filters.page < pageCount && (
            <Link href={qs({ page: String(filters.page + 1) })}>Next →</Link>
          )}
        </div>
      </div>
    </>
  );
}
