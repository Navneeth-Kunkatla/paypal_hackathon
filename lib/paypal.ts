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

async function pp(path: string, init: RequestInit = {}): Promise<unknown> {
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
function toInvoice(r: any): Invoice {
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
    clientName: name?.full_name ?? [name?.given_name, name?.surname].filter(Boolean).join(" "),
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

export async function listInvoices(): Promise<Invoice[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await pp("/v2/invoicing/invoices?page_size=50&fields=all")) as any;
  return (j.items ?? []).map(toInvoice);
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
