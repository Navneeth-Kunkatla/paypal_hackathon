"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/lib/types";
import ClientGrid from "@/components/ClientGrid";

export default function Clients() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [sumErr, setSumErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/clients");
        const j = await r.json().catch(() => ({}));
        if (r.ok) setClients(j.clients);
        else setError(j.error ?? "Could not load clients.");
      } catch {
        setError("Could not load clients. Check your connection.");
      }
    })();
  }, []);

  const summarize = async () => {
    setBusy(true);
    setSumErr("");
    try {
      const r = await fetch("/api/clients/summary", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setSummary(j.summary);
      else setSumErr(j.error ?? "Could not summarize.");
    } catch {
      setSumErr("Could not summarize. Check your connection.");
    }
    setBusy(false);
  };

  return (
    <main data-bg className="mx-auto flex w-full max-w-[1296px] flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">
      <h1 className="display m-0 text-2xl font-bold">Clients</h1>
      <section aria-labelledby="sum-h" className="card">
        <div className="card-h justify-between">
          <h2 id="sum-h">Agent summary</h2>
          <button className="btn" disabled={busy} aria-busy={busy} onClick={summarize}>
            {busy ? "Summarizing…" : "Summarize my clients"}
          </button>
        </div>
        <div aria-live="polite" className="px-5 py-4 text-sm">
          {sumErr ? (
            <p role="alert" className="m-0 rounded-lg px-3 py-2" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{sumErr}</p>
          ) : (
            <p className="m-0" style={{ color: summary ? "var(--fg)" : "var(--muted)" }}>{summary || "Ask the agent who to chase first and who is reliable."}</p>
          )}
        </div>
      </section>
      {error ? (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{error}</div>
      ) : clients === null ? (
        <p role="status" className="m-0 text-sm" style={{ color: "var(--muted)" }}>Loading clients…</p>
      ) : (
        <ClientGrid clients={clients} />
      )}
    </main>
  );
}
