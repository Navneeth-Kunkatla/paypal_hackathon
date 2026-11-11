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

export type ClientRating = "Pays on time" | "Slow payer" | "At risk" | "New";

export type Client = {
  name: string;
  email: string;
  invoices: number; // non-cancelled, non-draft
  billed: number;
  paid: number;
  outstanding: number; // billed - paid
  overdue: number; // sum of invoices with daysOverdue > 0
  maxDaysOverdue: number;
  avgDaysToPay: number | null; // null when the PayPal list gives no payment date
  currency: string;
  rating: ClientRating;
};

export type ActivityEvent = {
  id: string;
  at: string; // ISO timestamp
  kind: "drafted" | "sent" | "reminded" | "paid" | "blocked" | "info";
  text: string;
  invoiceId?: string;
};

// The mandate: what the agent may do without asking. Enforced in code (lib/policy.ts), never by the prompt.
export type Settings = {
  autoSendLimit: number; // agent may send invoices at or below this amount without approval
  dailyCap: number; // most the agent may send in total per UTC day without approval
  newClientNeedsApproval: boolean; // first invoice to a client always waits for a human
  maxReminders: number; // most reminders the agent may send per invoice per 24 hours
};

// One row per money-moving action that was attempted, whoever attempted it.
export type AuditEntry = {
  id: string;
  at: string; // ISO timestamp
  actor: "agent" | "human" | "zapier";
  action: "send_invoice" | "send_reminder" | "cancel_invoice" | "change_mandate";
  verdict: "allowed" | "held" | "blocked"; // held = left as a draft for approval; blocked = refused
  rule: string; // the mandate clause that decided, e.g. "Per-invoice limit", "Human approval"
  detail: string; // plain sentence, e.g. "USD 1800.00 is over the 500 per-invoice limit"
  invoiceId?: string;
  invoiceNumber?: string;
  client?: string;
  amount?: number;
  currency?: string;
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
// GET  /api/invoices/[id]         -> { invoice: Invoice, qr: string | null }   qr is a PNG data URL, null for drafts or on failure
// POST /api/invoices/[id]/cancel  -> { ok: true }   cancels a sent invoice, deletes a DRAFT
// GET  /api/automations           -> { jobsHook: boolean, paidHook: boolean, paypalWebhook: boolean }   config flags only
// POST /api/automations/test-job  -> { ok: true, summary }   body like /api/jobs, no secret needed
// POST /api/automations/test-paid -> { ok: true, result: "sent" | "unconfigured" | "failed" }
// GET  /api/clients               -> { clients: Client[] }   per-client roll-up of PayPal invoices
// POST /api/clients/summary       -> { summary: string }   one Gemini call over the client stats (503 if keys missing, 502 on model error)
// GET  /api/audit                 -> { entries: AuditEntry[] }  newest first, capped at 500
// GET  /api/audit?format=csv      -> text/csv attachment of the same rows
// Errors: non-2xx with { error: string }
