// The mandate, as code. Pure: no I/O, so every clause is testable and nothing can talk its way past it.
import type { AuditEntry, Settings } from "./types";

type Actor = AuditEntry["actor"];
export type Decision = { verdict: "allowed" | "held" | "blocked"; rule: string; detail: string };

export function decideSend(
  i: { actor: Actor; amount: number; currency: string; isNewClient: boolean; sentTodayTotal: number },
  m: Settings,
): Decision {
  const amt = `${i.currency} ${i.amount.toFixed(2)}`;
  if (i.actor === "human") return { verdict: "allowed", rule: "Human approval", detail: `${amt} approved by you` };
  if (i.amount > m.autoSendLimit) {
    return { verdict: "held", rule: "Per-invoice limit", detail: `${amt} is over the ${m.autoSendLimit} per-invoice limit` };
  }
  if (m.newClientNeedsApproval && i.isNewClient) {
    return { verdict: "held", rule: "New client", detail: `First invoice to this client, ${amt}, needs your approval` };
  }
  const total = i.sentTodayTotal + i.amount;
  if (total > m.dailyCap) {
    return {
      verdict: "held",
      rule: "Daily cap",
      detail: `Sending ${amt} would take today's agent total to ${total.toFixed(2)}, over the ${m.dailyCap} daily cap`,
    };
  }
  return { verdict: "allowed", rule: "Within mandate", detail: `${amt} is within your mandate` };
}

export function decideReminder(i: { actor: Actor; remindersLast24h: number }, m: Settings): Decision {
  if (i.actor === "human") return { verdict: "allowed", rule: "Human action", detail: "Reminder sent by you" };
  if (i.remindersLast24h >= m.maxReminders) {
    return {
      verdict: "blocked",
      rule: "Reminder cap",
      detail: `Reminder cap of ${m.maxReminders} per invoice per 24 hours reached`,
    };
  }
  return { verdict: "allowed", rule: "Within mandate", detail: "Reminder is within your mandate" };
}
