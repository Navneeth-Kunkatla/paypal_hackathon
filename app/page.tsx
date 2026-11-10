"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityEvent, Health, Invoice } from "@/lib/types";
import ActivityFeed from "@/components/ActivityFeed";
import ChatPanel from "@/components/ChatPanel";
import InvoiceDrawer from "@/components/InvoiceDrawer";
import InvoiceGrid from "@/components/InvoiceGrid";
import StatTiles from "@/components/StatTiles";

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [chaseNote, setChaseNote] = useState("");
  const [chasing, setChasing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

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
        const h = await fetch("/api/health");
        if (h.ok) setHealth(await h.json());
      } catch {
        // polling below still flags offline
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

  const cancel = useCallback(async (id: string) => {
    setNotice("");
    try {
      const r = await fetch(`/api/invoices/${id}/cancel`, { method: "POST" });
      if (r.ok) setOpenId(null);
      else setNotice((await r.json().catch(() => ({}))).error ?? "Could not cancel the invoice.");
    } catch {
      setNotice("Could not cancel the invoice. Check your connection.");
    }
    refresh();
  }, [refresh]);

  const chase = useCallback(async () => {
    setChasing(true);
    setNotice("");
    setChaseNote("");
    try {
      const r = await fetch("/api/chase", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setChaseNote(j.summary ?? "Done.");
      else setNotice(j.error ?? "Chase failed.");
    } catch {
      setNotice("Chase failed. Check your connection.");
    }
    setChasing(false);
    refresh();
  }, [refresh]);

  const missing = health && (!health.paypal || !health.ai);
  const open = invoices.find((i) => i.id === openId);

  return (
    <>
      <main data-bg className="mx-auto flex w-full max-w-[1296px] flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">
        <h1 className="sr-only">Invoices</h1>
        {offline && <div role="status" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>Offline: showing last data</div>}
        {missing && (
          <div role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", borderColor: "var(--border)" }}>
            <strong>Setup needed.</strong> {health.message} Add keys to <code>.env.local</code> and restart.
          </div>
        )}
        {notice && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{notice}</div>
        )}
        {chaseNote && (
          <div role="status" className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}>
            <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap"><strong>Chaser finished.</strong> {chaseNote}</p>
            <button className="btn" onClick={() => setChaseNote("")}>Dismiss</button>
          </div>
        )}

        <StatTiles invoices={invoices} />
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 basis-[620px]" style={{ flex: "999 1 620px" }}>
            <InvoiceGrid invoices={invoices} act={act} pending={pending} open={setOpenId} onChase={chase} chasing={chasing} />
          </div>
          <aside aria-label="Agent" className="flex min-w-0 basis-[360px] flex-1 flex-col gap-5">
            <ChatPanel onFinish={refresh} />
            <ActivityFeed events={events} />
          </aside>
        </div>
      </main>
      {open && (
        <InvoiceDrawer key={open.id} invoice={open} events={events} busy={pending.has(open.id)} act={act} cancel={cancel} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
