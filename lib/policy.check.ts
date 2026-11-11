// Run: node --experimental-strip-types lib/policy.check.ts
import assert from "node:assert/strict";
// @ts-expect-error node needs the .ts extension, tsconfig forbids it
import { decideSend, decideReminder } from "./policy.ts";

const m = { autoSendLimit: 500, dailyCap: 2000, newClientNeedsApproval: true, maxReminders: 1 };
const s = (o: object) => ({ actor: "agent", amount: 100, currency: "USD", isNewClient: false, sentTodayTotal: 0, ...o }) as never;
const r = (d: { verdict: string; rule: string }) => [d.verdict, d.rule];

// every clause
assert.deepEqual(r(decideSend(s({ actor: "human", amount: 99999, isNewClient: true }), m)), ["allowed", "Human approval"]);
assert.deepEqual(r(decideSend(s({ amount: 1800 }), m)), ["held", "Per-invoice limit"]);
assert.deepEqual(r(decideSend(s({ isNewClient: true }), m)), ["held", "New client"]);
assert.deepEqual(r(decideSend(s({ amount: 300, sentTodayTotal: 1800 }), m)), ["held", "Daily cap"]);
assert.deepEqual(r(decideSend(s({}), m)), ["allowed", "Within mandate"]);
// new-client rule off
assert.equal(decideSend(s({ isNewClient: true }), { ...m, newClientNeedsApproval: false }).verdict, "allowed");
// order: limit beats new client beats cap
assert.equal(decideSend(s({ amount: 600, isNewClient: true, sentTodayTotal: 1900 }), m).rule, "Per-invoice limit");
assert.equal(decideSend(s({ isNewClient: true, sentTodayTotal: 1990 }), m).rule, "New client");
// boundaries: equal is allowed
assert.equal(decideSend(s({ amount: 500 }), m).verdict, "allowed");
assert.equal(decideSend(s({ amount: 500.01 }), m).verdict, "held");
assert.equal(decideSend(s({ amount: 300, sentTodayTotal: 1700 }), m).verdict, "allowed");
assert.equal(decideSend(s({ amount: 300, sentTodayTotal: 1700.01 }), m).verdict, "held");
// detail text
assert.equal(decideSend(s({ amount: 1800 }), m).detail, "USD 1800.00 is over the 500 per-invoice limit");
assert.equal(
  decideSend(s({ amount: 300, sentTodayTotal: 1800 }), m).detail,
  "Sending USD 300.00 would take today's agent total to 2100.00, over the 2000 daily cap",
);

// reminders
assert.deepEqual(r(decideReminder({ actor: "human", remindersLast24h: 9 }, m)), ["allowed", "Human action"]);
assert.deepEqual(r(decideReminder({ actor: "agent", remindersLast24h: 0 }, m)), ["allowed", "Within mandate"]);
assert.deepEqual(r(decideReminder({ actor: "zapier", remindersLast24h: 1 }, m)), ["blocked", "Reminder cap"]);
assert.equal(decideReminder({ actor: "agent", remindersLast24h: 1 }, m).detail, "Reminder cap of 1 per invoice per 24 hours reached");
assert.equal(decideReminder({ actor: "agent", remindersLast24h: 0 }, { ...m, maxReminders: 0 }).verdict, "blocked");
console.log("policy.check ok");
