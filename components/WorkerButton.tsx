"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Run one worker pass on demand (admin only). Demo affordance for the
 * live deployment, where no background worker process runs. It calls the
 * existing POST /api/worker/run route and shows the result inline. The
 * background worker design itself is unchanged.
 */
export default function WorkerButton() {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRun() {
    setResult(null);
    setError(null);
    setBusy(true);
    const res = await fetch("/api/worker/run", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Worker run failed");
      return;
    }
    const r = data?.result;
    if (!r) {
      setResult("No pending orders.");
    } else {
      setResult(
        `Order ${r.orderId.slice(0, 8)}: ${r.outcome}, ${r.provisioned} provisioned, ${r.failed} failed.`
      );
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="secondary" onClick={handleRun} disabled={busy}>
        {busy ? "Running…" : "Run worker"}
      </button>
      {result && (
        <span className="muted" style={{ marginLeft: 8 }}>
          {result}
        </span>
      )}
      {error && (
        <span className="error" style={{ marginLeft: 8 }}>
          {error}
        </span>
      )}
    </>
  );
}
