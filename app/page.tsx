"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityEvent, Health, Invoice, Settings } from "@/lib/types";
import ActivityFeed from "@/components/ActivityFeed";
import ChatPanel from "@/components/ChatPanel";
import InvoiceGrid from "@/components/InvoiceGrid";
import StatTiles from "@/components/StatTiles";

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [limit, setLimit] = useState("");
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const limitSaved = useRef("");

  const refresh = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetch("/api/invoices"), fetch("/api/activity")]);
      if (!a.ok || !b.ok) throw new Error();
      setInvoices((await a.json()).invoices);
      setEvents((await b.json()).events);
      setOffline(false);
    } catch {
      setOffline(true); // keep last data
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([fetch("/api/health"), fetch("/api/settings")]);
        if (h.ok) setHealth(await h.json());
        if (s.ok) {
          const v = String(((await s.json()) as Settings).autoSendLimit);
          setLimit(v);
          limitSaved.current = v;
        }
      } catch {
        // header controls stay empty; polling below still flags offline
      }
    })();
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 10_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [refresh]);

  const act = useCallback(async (id: string, verb: "send" | "remind") => {
    setPending((p) => new Set(p).add(id));
    setNotice("");
    try {
      const r = await fetch(`/api/invoices/${id}/${verb}`, { method: "POST" });
      if (!r.ok) setNotice((await r.json().catch(() => ({}))).error ?? `Could not ${verb} the invoice.`);
    } catch {
      setNotice(`Could not ${verb} the invoice. Check your connection.`);
    }
    setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    refresh();
  }, [refresh]);

  const saveLimit = async () => {
    const n = Number(limit);
    if (limit === limitSaved.current || limit.trim() === "" || !Number.isFinite(n) || n < 0) return;
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendLimit: n } satisfies Settings),
      });
      if (r.ok) limitSaved.current = limit;
      else setNotice("Could not save the auto-send limit.");
    } catch {
      setNotice("Could not save the auto-send limit.");
    }
  };

  const missing = health && (!health.paypal || !health.ai);

  return (
    <div className="min-h-screen">
      <header style={{ background: "var(--surface)", color: "var(--fg)", borderBottom: "1px solid var(--hair)" }}>
        <div className="mx-auto flex w-full max-w-[1296px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28">
              <rect width="28" height="28" rx="8" fill="#0070BA" />
              <path d="M8 14.5l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 className="text-xl font-bold tracking-tight">Settle</h1>
          </div>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>The get-paid agent for freelancers</p>
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ borderColor: "var(--outline)", color: "var(--accent-hover)" }}>PayPal Sandbox</span>
          {offline && <span role="status" className="pill" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>Offline: showing last data</span>}
          <label className="ml-auto flex items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
            Agent may send up to
            <span className="inline-flex h-9 items-center rounded-lg border px-2.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
              <span aria-hidden="true" style={{ color: "var(--muted)" }}>$</span>
              <input
                type="number" min={0} inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                onBlur={saveLimit}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="num w-16 border-0 bg-transparent text-right font-semibold"
                style={{ color: "var(--fg)", outlineOffset: 4 }}
              />
            </span>
            without asking
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1296px] flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">
        {missing && (
          <div role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", borderColor: "var(--border)" }}>
            <strong>Setup needed.</strong> {health.message} Add keys to <code>.env.local</code> and restart.
          </div>
        )}
        {notice && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{notice}</div>
        )}

        <StatTiles invoices={invoices} />
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 basis-[620px]" style={{ flex: "999 1 620px" }}>
            <InvoiceGrid invoices={invoices} act={act} pending={pending} />
          </div>
          <aside aria-label="Agent" className="flex min-w-0 basis-[360px] flex-1 flex-col gap-5">
            <ChatPanel onFinish={refresh} />
            <ActivityFeed events={events} />
          </aside>
        </div>
      </main>
    </div>
  );
}
