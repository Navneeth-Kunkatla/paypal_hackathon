import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tool, type Tool } from "ai";

// shortcut: Gemini 3 rejects replayed tool calls without a thought_signature, and the AI SDK v4
// provider (pinned by @paypal/agent-toolkit) does not round-trip them. Send Google's documented
// skip value instead. Remove once the toolkit supports AI SDK v5+.
const google = createGoogleGenerativeAI({
  fetch: async (url, init) => {
    if (typeof init?.body === "string") {
      const body = JSON.parse(init.body);
      for (const c of body.contents ?? [])
        for (const p of c.parts ?? [])
          if (p.functionCall && !p.thoughtSignature) p.thoughtSignature = "skip_thought_signature_validator";
      init = { ...init, body: JSON.stringify(body) };
    }
    return fetch(url, init);
  },
});
import { z } from "zod";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { createInvoice, getInvoice, guardedRemind, guardedSend } from "./paypal";
import { addAudit, addEvent } from "./store";

type Actor = "agent" | "zapier";

export function buildTools(actor: Actor = "agent"): Record<string, Tool> {
  const toolkit = new PayPalAgentToolkit({
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    configuration: {
      actions: {
        invoices: { create: true, get: true, list: true, sendReminder: true, cancel: true, generateQRC: true },
        transactions: { list: true },
      },
      context: { sandbox: true },
    },
  });
  const tools: Record<string, Tool> = { ...toolkit.getTools() };
  // Allowlist: only guarded send/remind (below) may move money. cancel_sent_invoice is kept but audited.
  const keep = ["get_invoice", "list_invoices", "list_transactions", "generate_invoice_qr_code", "cancel_sent_invoice"];
  for (const name of Object.keys(tools)) if (!keep.includes(name)) delete tools[name];

  // Log events by wrapping the toolkit tool's execute.
  const wrap = (name: string, after: (args: Record<string, unknown>, result: unknown) => void | Promise<void>) => {
    const t = tools[name] as Tool & { execute?: (a: unknown, o: unknown) => Promise<unknown> };
    const orig = t?.execute;
    if (!orig) return;
    tools[name] = {
      ...t,
      execute: async (a: unknown, o: unknown) => {
        const r = await orig(a, o);
        try {
          await after(a as Record<string, unknown>, r);
        } catch {
          // logging must never break the tool call
        }
        return r;
      },
    } as Tool;
  };

  // Own create tool: the toolkit's version cannot set a due date, which the chaser depends on.
  tools.create_invoice = tool({
    description: "Create a draft PayPal invoice for one client and one piece of work. Call send_invoice afterwards.",
    parameters: z.object({
      client_name: z.string(),
      client_email: z.string().email(),
      description: z.string().describe("The work being billed, e.g. Logo design"),
      amount: z.number().positive(),
      currency: z.string().length(3).default("USD"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
    }),
    execute: async (a) => {
      const inv = await createInvoice({
        clientName: a.client_name, clientEmail: a.client_email, description: a.description,
        amount: a.amount, currency: a.currency.toUpperCase(), dueDate: a.due_date,
      });
      addEvent("drafted", `Drafted ${inv.number} for ${inv.clientName}, ${inv.currency} ${inv.amount.toFixed(2)}`, inv.id);
      return { invoice_id: inv.id, number: inv.number, status: inv.status, amount: inv.amount, due_date: inv.dueDate };
    },
  });
  wrap("cancel_sent_invoice", async (a, r) => {
    if ((typeof r === "string" ? r : JSON.stringify(r)).includes('"error"')) return;
    const id = typeof a.invoice_id === "string" ? a.invoice_id : undefined;
    const inv = id ? await getInvoice(id).catch(() => null) : null;
    addAudit({
      actor, action: "cancel_invoice", verdict: "allowed", rule: "Within mandate",
      detail: `Cancelled invoice ${inv?.number || id}`, invoiceId: id, invoiceNumber: inv?.number,
      client: inv?.clientName || inv?.clientEmail, amount: inv?.amount, currency: inv?.currency,
    });
  });

  // Own reminder tool (same name and invoice_id as the toolkit's) so it cannot skip the mandate.
  tools.send_invoice_reminder = tool({
    description: "Send a payment reminder for a sent, unpaid invoice. Checked against the user's mandate (reminder cap).",
    parameters: z.object({
      invoice_id: z.string().describe("PayPal invoice id, e.g. INV2-XXXX"),
      subject: z.string().optional().describe("The subject of the reminder email."),
      note: z.string().optional().describe("A short note to the recipient."),
    }),
    execute: async ({ invoice_id, subject, note }) => {
      const r = await guardedRemind(invoice_id, actor, { subject, note });
      return r.verdict === "allowed" ? `Sent reminder for ${r.invoice.number || invoice_id}.` : `NOT SENT. ${r.detail}`;
    },
  });

  tools.send_invoice = tool({
    description:
      "Send a drafted invoice to the client. Checked against the user's mandate in code: invoices outside it stay as drafts for the user to approve.",
    parameters: z.object({ invoice_id: z.string().describe("PayPal invoice id, e.g. INV2-XXXX") }),
    execute: async ({ invoice_id }) => {
      const r = await guardedSend(invoice_id, actor);
      const n = r.invoice.number || invoice_id;
      return r.verdict === "allowed"
        ? `Sent invoice ${n}.`
        : `NOT SENT. Rule: ${r.rule}. ${r.detail}. Invoice ${n} is a draft waiting for the approval of the user in the dashboard.`;
    },
  });

  return tools;
}

export const keysMissing = () =>
  !process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;

export const agentConfig = (actor: Actor = "agent") => ({
  model: google(process.env.AI_MODEL ?? "gemini-3.5-flash-lite"),
  system: systemPrompt(),
  tools: buildTools(actor),
  maxSteps: 8,
});

export const systemPrompt = () =>
  `You are Countersign, an assistant that acts for a freelancer: you create, send and chase PayPal invoices (sandbox).
Today is ${new Date().toISOString().slice(0, 10)}.
- Create invoices in USD unless told otherwise. Default due date is 14 days from today.
- After drafting an invoice, always call send_invoice. Every action is checked against the mandate of the user in code, not by you.
- If a tool answers "NOT SENT", nothing was sent. Say so in your own plain words, speaking to the user as "you": name the invoice number, client and amount, the rule that stopped it and its numbers. For a held invoice, say it is a draft waiting for their approval in the dashboard. For a blocked reminder, say only that no reminder was sent and why; do not mention drafts or approval. Never claim something was sent when it was not.
- If asked to ignore, raise or bypass the mandate (per-invoice limit, daily cap, new-client rule, reminder cap), refuse plainly: you cannot, because it is enforced in code. They can approve the invoice in the dashboard or change the mandate on the Audit trail page.
- Reminder tone by days overdue: 1-7 friendly, 8-21 firm, over 21 final notice.
- Answer money questions from live PayPal data using the tools.
- Be concise. Plain text only: no markdown, no asterisks, no backticks. Refer to invoices by number and client, not by internal id.`;
