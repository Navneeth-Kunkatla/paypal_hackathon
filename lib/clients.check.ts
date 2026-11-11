// Run: node --experimental-strip-types lib/clients.check.ts
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension, tsconfig forbids it
import { groupClients, rate } from "./clients.ts";

const inv = (o: object) => ({ id: "x", number: "1", clientName: "A", clientEmail: "A@x.com", amount: 100, currency: "USD", status: "SENT", dueDate: null, payUrl: null, daysOverdue: 0, nextAction: "", ...o }) as never;
const rows = [
  { inv: inv({ status: "PAID" }), invoiceDate: "2026-01-01", paid: 100, paidDate: "2026-01-11" },
  { inv: inv({ clientEmail: "a@x.com", daysOverdue: 30 }), invoiceDate: null, paid: 0, paidDate: null },
  { inv: inv({ status: "CANCELLED", amount: 999 }), invoiceDate: null, paid: 0, paidDate: null },
  { inv: inv({ clientName: "B", clientEmail: "b@x.com", status: "DRAFT" }), invoiceDate: null, paid: 0, paidDate: null },
];
const [c, ...rest] = groupClients(rows);
assert.equal(rest.length, 0);
assert.deepEqual([c.invoices, c.billed, c.paid, c.outstanding, c.overdue, c.maxDaysOverdue, c.avgDaysToPay, c.rating], [2, 200, 100, 100, 100, 30, 10, "At risk"]);
assert.equal(rate(0, null, true), "Pays on time");
assert.equal(rate(0, 15, true), "Slow payer");
assert.equal(rate(3, null, false), "Slow payer");
assert.equal(rate(0, null, false), "New");
console.log("clients.check ok");
