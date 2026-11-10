import type { Invoice } from "./types";
import { addEvent, lastStatuses, paidNotified } from "./store";
import { notifyZapier } from "./zapier";

// One place that announces a payment; polling and the webhook both call it, so it fires once per invoice.
export async function handlePaid(inv: Invoice): Promise<void> {
  lastStatuses().set(inv.id, "PAID");
  if (paidNotified().has(inv.id)) return;
  paidNotified().add(inv.id);
  const text = `${inv.clientName || inv.clientEmail} paid ${inv.number || inv.id}, ${inv.currency} ${inv.amount}`;
  addEvent("paid", text, inv.id);
  await notifyZapier("invoice.paid", {
    invoiceId: inv.id,
    number: inv.number,
    client: inv.clientName,
    amount: inv.amount,
    currency: inv.currency,
    text,
  });
}

// First sight only records; a later transition into PAID fires handlePaid.
export async function detectPaid(invoices: Invoice[]): Promise<void> {
  const seen = lastStatuses();
  for (const inv of invoices) {
    const prev = seen.get(inv.id);
    if (prev !== undefined && prev !== "PAID" && inv.status === "PAID") await handlePaid(inv);
    else seen.set(inv.id, inv.status);
  }
}
