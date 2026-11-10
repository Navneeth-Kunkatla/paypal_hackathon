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
import { createInvoice, getInvoice, sendInvoice } from "./paypal";
import { addEvent, getSettings } from "./store";

export function buildTools(): Record<string, Tool> {
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
  delete tools.send_invoice; // only the gated version below may send

  // Log events by wrapping the toolkit tool's execute.
  const wrap = (name: string, after: (args: Record<string, unknown>, result: unknown) => void) => {
    const t = tools[name] as Tool & { execute?: (a: unknown, o: unknown) => Promise<unknown> };
    const orig = t?.execute;
    if (!orig) return;
    tools[name] = {
      ...t,
      execute: async (a: unknown, o: unknown) => {
        const r = await orig(a, o);
        try {
          after(a as Record<string, unknown>, r);
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
  wrap("send_invoice_reminder", (a, r) => {
    const s = typeof r === "string" ? r : JSON.stringify(r);
    if (s.includes('"error"')) return;
    const id = typeof a.invoice_id === "string" ? a.invoice_id : undefined;
    addEvent("reminded", "Sent a payment reminder", id);
  });

  tools.send_invoice = tool({
    description:
      "Send a drafted invoice to the client. Enforces the auto-send limit set by the user: larger invoices stay as drafts for the user to approve.",
    parameters: z.object({ invoice_id: z.string().describe("PayPal invoice id, e.g. INV2-XXXX") }),
    execute: async ({ invoice_id }) => {
      const inv = await getInvoice(invoice_id);
      const limit = getSettings().autoSendLimit;
      if (inv.amount > limit) {
        addEvent(
          "blocked",
          `Held ${inv.number || invoice_id} (${inv.currency} ${inv.amount}) for approval: over the ${limit} auto-send limit`,
          invoice_id,
        );
        return `NOT SENT. Amount ${inv.amount} exceeds the auto-send limit of ${limit}. The invoice is a draft waiting for the approval of the user in the dashboard.`;
      }
      await sendInvoice(invoice_id);
      addEvent("sent", `Sent ${inv.number || invoice_id} to ${inv.clientName || inv.clientEmail}`, invoice_id);
      return `Sent invoice ${inv.number || invoice_id}.`;
    },
  });

  return tools;
}

export const keysMissing = () =>
  !process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;

export const agentConfig = () => ({
  model: google(process.env.AI_MODEL ?? "gemini-3.5-flash-lite"),
  system: systemPrompt(),
  tools: buildTools(),
  maxSteps: 8,
});

export const systemPrompt = () =>
  `You are Settle, an assistant that acts for a freelancer: you create, send and chase PayPal invoices (sandbox).
Today is ${new Date().toISOString().slice(0, 10)}.
- Create invoices in USD unless told otherwise. Default due date is 14 days from today.
- After drafting an invoice, always call send_invoice. Never claim an invoice was sent if send_invoice reports it was blocked; say it is waiting for approval in the dashboard.
- Reminder tone by days overdue: 1-7 friendly, 8-21 firm, over 21 final notice.
- Answer money questions from live PayPal data using the tools.
- Be concise. Plain text only: no markdown, no asterisks, no backticks. Refer to invoices by number and client, not by internal id.`;
