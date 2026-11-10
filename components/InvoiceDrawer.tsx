"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEvent, Invoice } from "@/lib/types";
import CopyButton from "./CopyButton";
import { fmt, StatusPill } from "./InvoiceGrid";

type Props = {
  invoice: Invoice;
  events: ActivityEvent[];
  busy: boolean;
  act: (id: string, verb: "send" | "remind") => void;
  cancel: (id: string) => Promise<void>;
  onClose: () => void;
};

export default function InvoiceDrawer({ invoice: inv, events, busy, act, cancel, onClose }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = inv.id;

  // Focus in on open; back to the row's opener on close. Background is inert while open.
  useEffect(() => {
    closeRef.current?.focus();
    const bg = document.querySelectorAll("[data-bg]");
    bg.forEach((e) => e.setAttribute("inert", ""));
    return () => {
      bg.forEach((e) => e.removeAttribute("inert"));
      (document.querySelector(`[data-open="${id}"]`) as HTMLElement | null)?.focus();
    };
  }, [id]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  const status = inv.status;
  useEffect(() => {
    let live = true;
    if (status === "DRAFT" || status === "CANCELLED") return;
    fetch(`/api/invoices/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setQr(j?.qr ?? null))
      .catch(() => {});
    return () => { live = false; };
  }, [id, status]);

  const mine = events.filter((e) => e.invoiceId === id);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--hair)" }}>
      <dt style={{ color: "var(--muted)" }}>{k}</dt>
      <dd className="m-0 min-w-0 break-words text-right font-medium">{v}</dd>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,12,40,0.45)" }} onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="drawer-h"
        className="flex h-full w-full flex-col overflow-y-auto sm:w-[460px]"
        style={{ background: "var(--surface)", color: "var(--fg)", borderLeft: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h justify-between">
          <h2 id="drawer-h">Invoice {inv.number || inv.id}</h2>
          <button ref={closeRef} className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <dl className="m-0">
            {row("Client", <>{inv.clientName}<br /><span style={{ color: "var(--muted)" }}>{inv.clientEmail}</span></>)}
            {row("Amount", <span className="num">{fmt(inv.amount, inv.currency)}</span>)}
            {row("Status", <StatusPill inv={inv} />)}
            {row("Due", inv.dueDate ?? "-")}
            {row("Days overdue", <span className="num">{inv.daysOverdue}</span>)}
            {row("Agent's next move", inv.nextAction)}
          </dl>

          {inv.payUrl && (
            <section aria-labelledby="pay-h">
              <h3 id="pay-h" className="mb-2 text-sm font-semibold">Pay link</h3>
              <p className="mb-2 break-all text-[13px]" style={{ color: "var(--fg-2)" }}>{inv.payUrl}</p>
              <div className="flex gap-2">
                <CopyButton text={inv.payUrl} label="pay link" />
                <a className="btn no-underline" href={inv.payUrl} target="_blank" rel="noopener noreferrer">Open link (new tab)</a>
              </div>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code to pay invoice ${inv.number}`} width={180} height={180} className="mt-3 rounded-lg border bg-white p-2" style={{ borderColor: "var(--border)" }} />
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {status === "DRAFT" && <button className="btn btn-primary" disabled={busy} onClick={() => act(id, "send")}>{busy ? "Sending…" : "Approve & send"}</button>}
            {status === "SENT" && <button className="btn" disabled={busy} onClick={() => act(id, "remind")}>{busy ? "Reminding…" : "Remind"}</button>}
            {(status === "DRAFT" || status === "SENT") && !confirm && <button className="btn" onClick={() => setConfirm(true)}>Cancel invoice</button>}
          </div>
          {confirm && (
            <div role="alertdialog" aria-label="Confirm cancel" className="rounded-xl p-3 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>
              <p className="mb-2">{status === "DRAFT" ? "Delete this draft? This cannot be undone." : "Cancel this invoice? The client can no longer pay it."}</p>
              <div className="flex gap-2">
                <button className="btn" disabled={cancelling} onClick={async () => { setCancelling(true); await cancel(id); setCancelling(false); }}>{cancelling ? "Working…" : "Yes, cancel invoice"}</button>
                <button className="btn" onClick={() => setConfirm(false)}>Keep it</button>
              </div>
            </div>
          )}

          <section aria-labelledby="ev-h">
            <h3 id="ev-h" className="mb-2 text-sm font-semibold">Activity</h3>
            {mine.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No activity for this invoice yet.</p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {mine.map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold capitalize">{e.kind}</span> {e.text}
                    <br />
                    <time dateTime={e.at} className="num text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
