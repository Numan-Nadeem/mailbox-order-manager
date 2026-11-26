"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRetry() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Admin retry from the admin list" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Retry failed");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="secondary" onClick={handleRetry} disabled={busy}>
        {busy ? "Retrying…" : "Retry"}
      </button>
      {error && <span className="error" style={{ marginLeft: 8 }}>{error}</span>}
    </>
  );
}
