import type { Invoice, InvoiceStatus } from "./types";

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

export async function sendInvoice(id: string): Promise<void> {
  await pp(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: JSON.stringify({ send_to_recipient: true }),
  });
}

export async function remindInvoice(id: string): Promise<void> {
  await pp(`/v2/invoicing/invoices/${encodeURIComponent(id)}/remind`, {
    method: "POST",
    body: JSON.stringify({ send_to_recipient: true }),
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
export async function cancelInvoice(id: string, status: InvoiceStatus): Promise<void> {
  const path = `/v2/invoicing/invoices/${encodeURIComponent(id)}`;
  if (status === "DRAFT") await pp(path, { method: "DELETE" });
  else await pp(`${path}/cancel`, { method: "POST", body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: false }) });
}

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
      detail: { currency_code: i.currency, payment_term: { due_date: i.dueDate } },
      primary_recipients: [{ billing_info: { business_name: i.clientName, email_address: i.clientEmail } }],
      items: [{ name: i.description, quantity: "1", unit_amount: { currency_code: i.currency, value: i.amount.toFixed(2) } }],
    }),
  })) as { href: string };
  return getInvoice(j.href.split("/").pop()!);
}
