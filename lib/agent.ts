import { anthropic } from "@ai-sdk/anthropic";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { getInvoice, sendInvoice } from "./paypal";
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

  wrap("create_invoice", (_a, r) => {
    const s = typeof r === "string" ? r : JSON.stringify(r);
    if (s.includes('"error"')) return;
    const id = /invoices\/([A-Z0-9-]+)/.exec(s)?.[1] ?? /"id":"([^"]+)"/.exec(s)?.[1];
    addEvent("drafted", "Drafted a new invoice", id);
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
  !process.env.ANTHROPIC_API_KEY || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;

export const agentConfig = () => ({
  model: anthropic(process.env.AI_MODEL ?? "claude-sonnet-5-5"),
  system: systemPrompt(),
  tools: buildTools(),
  maxSteps: 8,
});

export const systemPrompt = () =>
  `You are Settle, an assistant that acts for a freelancer: you create, send and chase PayPal invoices (sandbox).
Today is ${new Date().toISOString().slice(0, 10)}.
- Create invoices in USD unless told otherwise.
- After drafting an invoice, always call send_invoice. Never claim an invoice was sent if send_invoice reports it was blocked; say it is waiting for approval in the dashboard.
- Reminder tone by days overdue: 1-7 friendly, 8-21 firm, over 21 final notice.
- Answer money questions from live PayPal data using the tools.
- Be concise.`;
