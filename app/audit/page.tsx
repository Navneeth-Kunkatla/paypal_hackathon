"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import AuditGrid from "@/components/AuditGrid";
import MandateCard from "@/components/MandateCard";

type Filter = "all" | AuditEntry["verdict"];
const CHIPS: [Filter, string][] = [["all", "All"], ["allowed", "Allowed"], ["held", "Held"], ["blocked", "Blocked"]];

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/audit");
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(j.entries)) throw new Error(j.error ?? "Could not load the audit trail.");
      setEntries(j.entries);
      setError("");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not load the audit trail. Check your connection.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 10_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  const n = (v: AuditEntry["verdict"]) => (entries ?? []).filter((e) => e.verdict === v).length;
  const tiles: [string, number][] = [["Allowed", n("allowed")], ["Held for you", n("held")], ["Blocked", n("blocked")]];
  const rows = (entries ?? []).filter((e) => filter === "all" || e.verdict === filter);

  return (
    <main data-bg className="mx-auto flex w-full max-w-[1296px] flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">
      <div>
        <h1 className="display m-0 text-2xl font-bold">Audit trail</h1>
        <p className="m-0 mt-1 text-sm" style={{ color: "var(--muted)" }}>Every action that can move money, who tried it, and the rule that decided.</p>
      </div>
      <MandateCard />
      <section aria-label="Decision summary" className="card grid grid-cols-3 gap-3 px-5 py-4">
        {tiles.map(([label, v]) => (
          <div key={label}>
            <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{label}</div>
            <div className="display num text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>
      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{error}</div>}
      {entries === null ? (
        !error && <p role="status" className="m-0 text-sm" style={{ color: "var(--muted)" }}>Loading audit trail…</p>
      ) : (
        <section aria-labelledby="log-h" className="card overflow-hidden">
          <div className="card-h flex-wrap justify-between">
            <h2 id="log-h">Decisions</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Filter by verdict" className="flex flex-wrap gap-2">
                {CHIPS.map(([k, label]) => (
                  <button
                    key={k} type="button" className={`btn ${filter === k ? "btn-primary" : ""}`}
                    aria-pressed={filter === k} onClick={() => setFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <a href="/api/audit?format=csv" download className="btn no-underline">Download CSV</a>
            </div>
          </div>
          {entries.length === 0 ? (
            <p className="m-0 px-5 py-6 text-sm" style={{ color: "var(--fg-2)" }}>
              Nothing yet. Ask the agent to invoice someone, or mark a job Done in Zapier, and each decision will appear here.
            </p>
          ) : (
            <AuditGrid entries={rows} />
          )}
        </section>
      )}
    </main>
  );
}
