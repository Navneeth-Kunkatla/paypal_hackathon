// Demo-data seed for Settle. Plain Node 18+, no dependencies. PayPal SANDBOX only.
//   node scripts/seed.mjs             create missing seed invoices
//   node scripts/seed.mjs --dry-run   print what would be created
//   node scripts/seed.mjs --reset     cancel (sent) / delete (draft) invoices tagged settle-seed-*
// SANDBOX FINDING (verified live): the sandbox accepts a past detail.invoice_date and a past
// payment_term.due_date (term_type DUE_ON_DATE_SPECIFIED), and sending still works; the invoice
// then reads as overdue. No workaround needed.
// Credentials come from process.env or .env.local (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET).
// No email is sent: send uses send_to_recipient/send_to_invoicer = false.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://api-m.sandbox.paypal.com";
const TAG = "settle-seed-";
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry-run");
const reset = args.has("--reset");

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

// kind: overdue | open | paid | draft. daysAgo: due date is that many days in the past.
const SEED = [
  { n: 1, kind: "overdue", client: "Northwind Studio", email: "ap@northwind-studio.test", item: "Brand identity refresh", amount: "1200.00", issued: -35, due: -5 },
  { n: 2, kind: "overdue", client: "Bluepine Labs", email: "billing@bluepine-labs.test", item: "Landing page build", amount: "850.00", issued: -55, due: -25 },
  { n: 3, kind: "open", client: "Kestrel Coffee Co", email: "hello@kestrel-coffee.test", item: "Menu and packaging design", amount: "320.00", issued: -2, due: 12 },
  { n: 4, kind: "open", client: "Harbor Yoga", email: "studio@harbor-yoga.test", item: "Monthly social media management", amount: "275.00", issued: -1, due: 14 },
  { n: 5, kind: "paid", client: "Tallow & Oak", email: "accounts@tallow-oak.test", item: "Product photography, 12 images", amount: "640.00", issued: -20, due: -6 },
  { n: 6, kind: "paid", client: "Meridian Dental", email: "office@meridian-dental.test", item: "Website copy edit", amount: "180.00", issued: -12, due: 2 },
  { n: 7, kind: "draft", client: "Foxglove Events", email: "finance@foxglove-events.test", item: "Conference identity and signage", amount: "2400.00", issued: 0, due: 14 },
];

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set (env or .env.local)");
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal auth failed (${r.status})`);
  return (await r.json()).access_token;
}

let tok;
async function pp(path, method = "GET", body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function listAll() {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const j = await pp(`/v2/invoicing/invoices?page=${page}&page_size=100&total_required=true&fields=all`);
    out.push(...(j.items ?? []));
    if (out.length >= (j.total_items ?? 0) || !(j.items ?? []).length) break;
  }
  return out;
}

const payload = (s) => ({
  detail: {
    reference: `${TAG}${s.n}`,
    currency_code: "USD",
    invoice_date: day(s.issued),
    note: "Settle demo data (sandbox).",
    payment_term: { term_type: "DUE_ON_DATE_SPECIFIED", due_date: day(s.due) },
  },
  primary_recipients: [{ billing_info: { business_name: s.client, email_address: s.email } }],
  items: [{ name: s.item, quantity: "1", unit_amount: { currency_code: "USD", value: s.amount } }],
});

async function create(s) {
  const j = await pp("/v2/invoicing/invoices", "POST", payload(s));
  const id = j.href.split("/").pop();
  if (s.kind !== "draft") {
    await pp(`/v2/invoicing/invoices/${id}/send`, "POST", { send_to_recipient: false, send_to_invoicer: false });
  }
  if (s.kind === "paid") {
    await pp(`/v2/invoicing/invoices/${id}/payments`, "POST", {
      method: "BANK_TRANSFER",
      payment_date: day(Math.min(0, s.due)),
      amount: { currency_code: "USD", value: s.amount },
    });
  }
  const inv = await pp(`/v2/invoicing/invoices/${id}`);
  return { id, number: inv.detail?.invoice_number, status: inv.status };
}

const row = (c) => c.map((v, i) => String(v ?? "").padEnd([3, 18, 8, 8, 12, 14][i])).join(" ");

async function main() {
  if (dry && !reset) {
    console.log("DRY RUN: would create (skipping any already tagged):");
    for (const s of SEED) console.log(`  ${TAG}${s.n}  ${s.kind.padEnd(7)} ${s.client.padEnd(18)} USD ${s.amount.padStart(8)}  issued ${day(s.issued)}  due ${day(s.due)}`);
    return;
  }
  tok = await token();
  const existing = (await listAll()).filter((i) => String(i.detail?.reference ?? "").startsWith(TAG));

  if (reset) {
    for (const i of existing) {
      const act = i.status === "DRAFT" ? "delete" : "cancel";
      if (dry) { console.log(`DRY RUN: would ${act} ${i.id} (${i.detail.reference}, ${i.status})`); continue; }
      try {
        if (act === "delete") await pp(`/v2/invoicing/invoices/${i.id}`, "DELETE");
        else await pp(`/v2/invoicing/invoices/${i.id}/cancel`, "POST", { send_to_recipient: false, send_to_invoicer: false });
        console.log(`${act}d ${i.id} (${i.detail.reference}, was ${i.status})`);
      } catch (e) { console.log(`could not ${act} ${i.id} (${i.detail.reference}, ${i.status}): ${e.message}`); }
    }
    if (!existing.length) console.log("No seed invoices found.");
    return;
  }

  // a CANCELLED seed invoice keeps its tag but no longer counts as present
  const have = new Set(existing.filter((i) => i.status !== "CANCELLED").map((i) => i.detail.reference));
  console.log(row(["#", "client", "kind", "action", "invoice no.", "status"]));
  for (const s of SEED) {
    const ref = `${TAG}${s.n}`;
    if (have.has(ref)) { console.log(row([s.n, s.client, s.kind, "skipped", "", "exists"])); continue; }
    try {
      const r = await create(s);
      console.log(row([s.n, s.client, s.kind, "created", r.number, r.status]));
    } catch (e) {
      console.log(row([s.n, s.client, s.kind, "FAILED", "", ""]));
      console.log(`    ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
