// Shared contract between API routes and UI. Change both sides together.

export type InvoiceStatus =
  | "DRAFT" // created by the agent, waiting for human approval
  | "SENT"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "OTHER";

export type Invoice = {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string | null; // YYYY-MM-DD
  payUrl: string | null;
  daysOverdue: number; // 0 when not overdue
  nextAction: string; // what the agent plans to do next, plain English
};

export type ActivityEvent = {
  id: string;
  at: string; // ISO timestamp
  kind: "drafted" | "sent" | "reminded" | "paid" | "blocked" | "info";
  text: string;
  invoiceId?: string;
};

export type Settings = {
  autoSendLimit: number; // agent may send invoices at or below this amount without approval
};

export type Health = {
  paypal: boolean;
  ai: boolean;
  message?: string; // what is missing, shown in the setup banner
};

// GET  /api/invoices              -> { invoices: Invoice[] }
// POST /api/invoices/[id]/send    -> { ok: true }   human approval of a DRAFT
// POST /api/invoices/[id]/remind  -> { ok: true }
// GET  /api/activity              -> { events: ActivityEvent[] }  newest first
// GET  /api/settings              -> Settings
// PUT  /api/settings   (Settings) -> Settings
// GET  /api/health                -> Health
// POST /api/chat                  -> AI SDK v4 data stream, body { messages } from useChat
// POST /api/webhooks/paypal       -> { ok: true }   PayPal webhook, signature verified (503 if PAYPAL_WEBHOOK_ID unset)
// POST /api/jobs                  -> { ok: true, summary }   Zapier inbound, header x-settle-secret
// POST /api/chase                 -> { ok: true, reminded, summary }   remind all overdue invoices
// Errors: non-2xx with { error: string }
