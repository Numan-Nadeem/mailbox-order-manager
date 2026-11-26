"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateOrderForm() {
  const router = useRouter();
  // One idempotency key per form instance: double-clicking submit or
  // re-sending the same form returns the same order, never a duplicate.
  const keyRef = useRef<string>(crypto.randomUUID());
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState<"GOOGLE" | "MICROSOFT">("GOOGLE");
  const [mailboxCount, setMailboxCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        provider,
        mailboxCount,
        idempotencyKey: keyRef.current,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Could not create the order");
      return;
    }
    if (data.deduped) {
      setNotice("This order was already created (same submission key). Showing the original.");
    }
    router.push(`/orders/${data.order.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="row">
        <div>
          <label htmlFor="domain">Domain</label>
          <input
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            required
          />
        </div>
        <div>
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "GOOGLE" | "MICROSOFT")}
          >
            <option value="GOOGLE">Google</option>
            <option value="MICROSOFT">Microsoft</option>
          </select>
        </div>
        <div>
          <label htmlFor="count">Mailboxes (1–50)</label>
          <input
            id="count"
            type="number"
            min={1}
            max={50}
            value={mailboxCount}
            onChange={(e) => setMailboxCount(Number(e.target.value))}
            required
          />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}
      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create order"}
      </button>
    </form>
  );
}
