"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

type Flags = { jobsHook: boolean; paidHook: boolean; paypalWebhook: boolean };

function Status({ on, yes, no }: { on: boolean | null; yes: string; no: string }) {
  if (on === null) return <span className="pill" style={{ background: "var(--neutral-bg)", color: "var(--neutral-fg)" }}>Checking…</span>;
  return (
    <span className="pill" style={on ? { background: "var(--info-bg)", color: "var(--info-fg)" } : { background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
      {on ? yes : no}
    </span>
  );
}

function Card({ id, title, pill, children }: { id: string; title: string; pill?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="card">
      <div className="card-h justify-between flex-wrap">
        <h2 id={id}>{title}</h2>
        {pill}
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 text-sm">{children}</div>
    </section>
  );
}

const Url = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-wrap items-center gap-2">
    <code className="min-w-0 flex-1 break-all rounded-lg px-2.5 py-2 text-[13px]" style={{ background: "var(--surface-2)" }}>{value || "…"}</code>
    <CopyButton text={value} label={label} />
  </div>
);

const input = "h-9 w-full rounded-lg border px-2.5";
const inputStyle = { background: "var(--surface)", borderColor: "var(--outline)", color: "var(--fg)" };

export default function Automations() {
  const [flags, setFlags] = useState<Flags | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [job, setJob] = useState({ client_name: "", client_email: "", amount: "", description: "", due_days: "14" });
  const [jobBusy, setJobBusy] = useState(false);
  const [jobOut, setJobOut] = useState<{ ok: boolean; text: string } | null>(null);
  const [paidBusy, setPaidBusy] = useState(false);
  const [paidOut, setPaidOut] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    fetch("/api/automations").then((r) => r.json()).then(setFlags).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((s) => setLimit(s.autoSendLimit)).catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const sendJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobBusy(true);
    setJobOut(null);
    try {
      const r = await fetch("/api/automations/test-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      const j = await r.json().catch(() => ({}));
      setJobOut(r.ok ? { ok: true, text: j.summary } : { ok: false, text: j.error ?? "Test job failed." });
    } catch {
      setJobOut({ ok: false, text: "Test job failed. Check your connection." });
    }
    setJobBusy(false);
  };

  const sendPaid = async () => {
    setPaidBusy(true);
    setPaidOut(null);
    try {
      const r = await fetch("/api/automations/test-paid", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      const text = !r.ok ? (j.error ?? "Test failed.")
        : j.result === "sent" ? "Test event delivered to your hook."
        : j.result === "unconfigured" ? "No hook URL configured. Set ZAPIER_PAID_HOOK_URL and restart."
        : "The hook URL is set but the POST failed. Check the activity feed.";
      setPaidOut({ ok: r.ok && j.result === "sent", text });
    } catch {
      setPaidOut({ ok: false, text: "Test failed. Check your connection." });
    }
    setPaidBusy(false);
  };

  const set = (k: keyof typeof job) => (e: React.ChangeEvent<HTMLInputElement>) => setJob({ ...job, [k]: e.target.value });
  const out = (o: { ok: boolean; text: string } | null) => o && (
    <div role="status" className="rounded-xl px-4 py-3" style={o.ok ? { background: "var(--info-bg)", color: "var(--info-fg)" } : { background: "var(--bad-bg)", color: "var(--bad-fg)" }}>
      <strong>{o.ok ? "Result." : "Failed."}</strong> <span className="whitespace-pre-wrap">{o.text}</span>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 pb-10 pt-7 sm:px-8">
      <h1 className="text-2xl font-bold">Automations</h1>

      <Card id="in-h" title="When a job is done, invoice it" pill={<Status on={flags && flags.jobsHook} yes="Connected-ready" no="Not configured" />}>
        <p>Zapier watches your task tool and posts each finished job to Countersign. The agent then drafts the invoice and sends it, or holds it for your approval above your limit.</p>
        <Url label="endpoint URL" value={origin && `${origin}/api/jobs`} />
        <p>Send a POST with header <code>x-settle-secret</code> (your ZAPIER_HOOK_SECRET) and JSON fields: <code>client_name</code>, <code>client_email</code>, <code>amount</code>, <code>description</code>, <code>due_days</code>, <code>currency</code>.</p>
        <form onSubmit={sendJob} className="flex flex-col gap-3" aria-label="Send a test job">
          <h3 className="text-sm font-semibold">Send a test job</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">Client name<input required className={input} style={inputStyle} value={job.client_name} onChange={set("client_name")} /></label>
            <label className="flex flex-col gap-1">Client email<input required type="email" className={input} style={inputStyle} value={job.client_email} onChange={set("client_email")} /></label>
            <label className="flex flex-col gap-1">Amount (USD)<input required type="number" min="0.01" step="0.01" className={input} style={inputStyle} value={job.amount} onChange={set("amount")} /></label>
            <label className="flex flex-col gap-1">Due in (days)<input required type="number" min="0" max="120" className={input} style={inputStyle} value={job.due_days} onChange={set("due_days")} /></label>
          </div>
          <label className="flex flex-col gap-1">Description<input required className={input} style={inputStyle} value={job.description} onChange={set("description")} /></label>
          <div><button type="submit" className="btn btn-primary" disabled={jobBusy} aria-busy={jobBusy}>{jobBusy ? "Agent is working…" : "Send test job"}</button></div>
        </form>
        {out(jobOut)}
        {jobOut?.ok && <p><Link href="/">See it on Invoices</Link></p>}
      </Card>

      <Card id="out-h" title="When an invoice is paid, tell my tools" pill={<Status on={flags && flags.paidHook} yes="Connected" no="Not configured" />}>
        <p>When PayPal reports a payment, Countersign posts JSON to your Zapier Catch Hook (ZAPIER_PAID_HOOK_URL): <code>event</code> (&quot;invoice.paid&quot;), <code>invoiceId</code>, <code>number</code>, <code>client</code>, <code>amount</code>, <code>currency</code> and <code>text</code>. Use it for Slack, email or a sheet row.</p>
        <div><button className="btn" onClick={sendPaid} disabled={paidBusy} aria-busy={paidBusy}>{paidBusy ? "Sending…" : "Send test event"}</button></div>
        {out(paidOut)}
      </Card>

      <Card id="wh-h" title="Instant payment updates" pill={<Status on={flags && flags.paypalWebhook} yes="Connected" no="Not configured" />}>
        <p>Add this URL as a webhook in your PayPal app and subscribe to <code>INVOICING.INVOICE.PAID</code>. Then payments show up the moment they happen.</p>
        <Url label="webhook URL" value={origin && `${origin}/api/webhooks/paypal`} />
        <p style={{ color: "var(--muted)" }}>Without it, Countersign still detects payment by polling every 10 seconds.</p>
      </Card>

      <Card id="rule-h" title="Approval rule">
        <p>The agent sends invoices at or below <strong className="num">{limit === null ? "…" : `$${limit}`}</strong> on its own; anything higher waits for your click. Change it in the header.</p>
      </Card>
    </main>
  );
}
