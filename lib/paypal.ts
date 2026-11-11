import type { AuditEntry, Invoice, InvoiceStatus } from "./types";
import { decideReminder, decideSend } from "./policy";
import { addAudit, addEvent, getAudit, getSettings } from "./store";

const BASE = "https://api-m.sandbox.paypal.com";

let cached: { token: string; exp: number } | null = null;

export async function getToken(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

export async function pp(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const STATUS: Record<string, InvoiceStatus> = {
  DRAFT: "DRAFT",
  UNPAID: "SENT",
  SENT: "SENT",
  SCHEDULED: "SENT",
  PAYMENT_PENDING: "SENT",
  PAID: "PAID",
  MARKED_AS_PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  CANCELLED: "CANCELLED",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toInvoice(r: any): Invoice {
  const status = STATUS[r.status] ?? "OTHER";
  const due: string | null = r.detail?.payment_term?.due_date ?? null;
  let daysOverdue = 0;
  if (due && (status === "SENT" || status === "PARTIALLY_PAID")) {
    const today = new Date().toISOString().slice(0, 10);
    daysOverdue = Math.max(0, Math.floor((Date.parse(today) - Date.parse(due)) / 86_400_000));
  }
  let nextAction = "Done";
  if (status === "DRAFT") nextAction = "Waiting for your approval";
  else if (status === "SENT" || status === "PARTIALLY_PAID") {
    nextAction =
      daysOverdue === 0
        ? "Watching for payment"
        : daysOverdue <= 7
          ? "Send friendly reminder"
          : daysOverdue <= 21
            ? "Send firm reminder"
            : "Send final notice";
  }
  const billing = r.primary_recipients?.[0]?.billing_info;
  const name = billing?.name;
  return {
    id: r.id,
    number: r.detail?.invoice_number ?? "",
    clientName: name?.full_name || [name?.given_name, name?.surname].filter(Boolean).join(" ") || billing?.business_name || billing?.email_address || "",
    clientEmail: billing?.email_address ?? "",
    amount: Number(r.amount?.value ?? 0),
    currency: r.amount?.currency_code ?? r.detail?.currency_code ?? "USD",
    status,
    dueDate: due,
    // The list endpoint omits recipient_view_url, so build it the way PayPal does (id without "INV2-" and dashes).
    payUrl:
      r.detail?.metadata?.recipient_view_url ??
      (status === "DRAFT" || status === "CANCELLED"
        ? null
        : `https://www.sandbox.paypal.com/invoice/p/#${String(r.id).replace(/^INV2-/, "").replace(/-/g, "")}`),
    daysOverdue,
    nextAction,
  };
}

// Raw PayPal records: one fetch path for the invoice list and the client roll-up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listRawInvoices(): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await pp("/v2/invoicing/invoices?page_size=50&fields=all")) as any;
  return j.items ?? [];
}

export async function listInvoices(): Promise<Invoice[]> {
  return (await listRawInvoices()).map(toInvoice);
}

export async function getInvoice(id: string): Promise<Invoice> {
  return toInvoice(await pp(`/v2/invoicing/invoices/${encodeURIComponent(id)}`));
}

// Private on purpose: the only way to send or remind is guardedSend / guardedRemind below.
async function sendInvoice(id: string): Promise<void> {
  await pp(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: JSON.stringify({ send_to_recipient: true }),
  });
}

async function remindInvoice(id: string, msg: { subject?: string; note?: string } = {}): Promise<void> {
  await pp(`/v2/invoicing/invoices/${encodeURIComponent(id)}/remind`, {
    method: "POST",
    body: JSON.stringify({ send_to_recipient: true, ...msg }),
  });
}

// PayPal answers multipart/form-data with the PNG as a bare base64 block; null on any failure.
export async function getQr(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/v2/invoicing/invoices/${encodeURIComponent(id)}/generate-qr-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ width: 300, height: 300 }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const b64 = (await res.text()).match(/\r?\n\r?\n([A-Za-z0-9+/=]+)\r?\n--/)?.[1];
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch {
    return null;
  }
}

// Drafts cannot be cancelled, only deleted.
async function cancelInvoice(id: string, status: InvoiceStatus): Promise<void> {
  const path = `/v2/invoicing/invoices/${encodeURIComponent(id)}`;
  if (status === "DRAFT") await pp(path, { method: "DELETE" });
  else await pp(`${path}/cancel`, { method: "POST", body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: false }) });
}

// detail.note is shown to the client and in PayPal's invoice email (limit 4000 chars)
const NOTE =
  "Prepared by Countersign, the sender's assistant, on behalf of the sender. PayPal never asks you to call a phone number or share a password to pay or dispute an invoice.";

export async function createInvoice(i: {
  clientName: string;
  clientEmail: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string; // YYYY-MM-DD
}): Promise<Invoice> {
  const j = (await pp("/v2/invoicing/invoices", {
    method: "POST",
    body: JSON.stringify({
      detail: { currency_code: i.currency, payment_term: { due_date: i.dueDate }, note: NOTE },
      primary_recipients: [{ billing_info: { business_name: i.clientName, email_address: i.clientEmail } }],
      items: [{ name: i.description, quantity: "1", unit_amount: { currency_code: i.currency, value: i.amount.toFixed(2) } }],
    }),
  })) as { href: string };
  return getInvoice(j.href.split("/").pop()!);
}

type Actor = AuditEntry["actor"];
const short = (e: unknown) => (e instanceof Error ? e.message : "Failed").slice(0, 160);

// The single enforcement path: every send, reminder and cancel goes through these three, and each attempt is audited.
// An "allowed" send is audited after PayPal succeeds; a PayPal failure is audited as blocked / "PayPal error" and rethrown.
export async function guardedSend(id: string, actor: Actor) {
  const inv = await getInvoice(id);
  const m = getSettings();
  let isNewClient = false;
  if (m.newClientNeedsApproval) {
    const email = inv.clientEmail.toLowerCase();
    isNewClient = !(await listInvoices()).some(
      (o) => o.id !== id && o.clientEmail.toLowerCase() === email && o.status !== "DRAFT" && o.status !== "CANCELLED",
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const sentTodayTotal = getAudit()
    .filter((a) => a.action === "send_invoice" && a.verdict === "allowed" && a.actor !== "human" && a.at.startsWith(today))
    .reduce((t, a) => t + (a.amount ?? 0), 0);
  const d = decideSend({ actor, amount: inv.amount, currency: inv.currency, isNewClient, sentTodayTotal }, m);
  const entry = {
    actor, action: "send_invoice" as const, invoiceId: id, invoiceNumber: inv.number,
    client: inv.clientName || inv.clientEmail, amount: inv.amount, currency: inv.currency,
  };
  const label = inv.number || id;
  if (d.verdict !== "allowed") {
    addAudit({ ...entry, ...d });
    addEvent("blocked", `Held ${label} (${inv.currency} ${inv.amount}) for approval: ${d.rule}. ${d.detail}`, id);
    return { ...d, invoice: inv };
  }
  try {
    await sendInvoice(id);
  } catch (e) {
    addAudit({ ...entry, verdict: "blocked", rule: "PayPal error", detail: short(e) });
    throw e;
  }
  addAudit({ ...entry, ...d });
  addEvent("sent", actor === "human" ? `Approved and sent ${label}` : `Sent ${label} to ${entry.client}`, id);
  return { ...d, invoice: inv };
}

export async function guardedRemind(id: string, actor: Actor, msg: { subject?: string; note?: string } = {}) {
  const inv = await getInvoice(id);
  const since = Date.now() - 86_400_000;
  const remindersLast24h = getAudit().filter(
    (a) => a.invoiceId === id && a.action === "send_reminder" && a.verdict === "allowed" && Date.parse(a.at) >= since,
  ).length;
  const d = decideReminder({ actor, remindersLast24h }, getSettings());
  const entry = {
    actor, action: "send_reminder" as const, invoiceId: id, invoiceNumber: inv.number,
    client: inv.clientName || inv.clientEmail, amount: inv.amount, currency: inv.currency,
  };
  const label = inv.number || id;
  if (d.verdict !== "allowed") {
    addAudit({ ...entry, ...d });
    addEvent("blocked", `Reminder for ${label} not sent: ${d.rule}. ${d.detail}`, id);
    return { ...d, invoice: inv };
  }
  try {
    await remindInvoice(id, msg);
  } catch (e) {
    addAudit({ ...entry, verdict: "blocked", rule: "PayPal error", detail: short(e) });
    throw e;
  }
  addAudit({ ...entry, ...d });
  addEvent("reminded", actor === "human" ? `Sent a reminder for ${label}` : "Sent a payment reminder", id);
  return { ...d, invoice: inv };
}

// No policy clause: cancelling moves no money out. Recorded so the trail is complete.
export async function guardedCancel(id: string, actor: Actor) {
  const inv = await getInvoice(id);
  await cancelInvoice(id, inv.status);
  addAudit({
    actor, action: "cancel_invoice", verdict: "allowed",
    rule: actor === "human" ? "Human action" : "Within mandate",
    detail: `${inv.status === "DRAFT" ? "Deleted draft" : "Cancelled invoice"} ${inv.number || id}`,
    invoiceId: id, invoiceNumber: inv.number, client: inv.clientName || inv.clientEmail, amount: inv.amount, currency: inv.currency,
  });
  addEvent("info", `${inv.status === "DRAFT" ? "Deleted draft" : "Cancelled invoice"} ${inv.number || id}`, id);
  return inv;
}
