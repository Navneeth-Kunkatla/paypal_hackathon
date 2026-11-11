import type { Client, ClientRating, Invoice } from "./types";

export type ClientRow = { inv: Invoice; invoiceDate: string | null; paid: number; paidDate: string | null };

const DAY = 86_400_000;

// At risk: max days overdue > 21. Slow payer: any overdue, or avg days to pay > 14.
// Pays on time: at least one PAID invoice and nothing overdue. Otherwise New.
export function rate(maxDaysOverdue: number, avgDaysToPay: number | null, hasPaid: boolean): ClientRating {
  if (maxDaysOverdue > 21) return "At risk";
  if (maxDaysOverdue > 0 || (avgDaysToPay ?? 0) > 14) return "Slow payer";
  return hasPaid ? "Pays on time" : "New";
}

export function groupClients(rows: ClientRow[]): Client[] {
  const by = new Map<string, { c: Client; days: number[]; hasPaid: boolean }>();
  for (const { inv, invoiceDate, paid, paidDate } of rows) {
    if (inv.status === "CANCELLED" || inv.status === "DRAFT") continue;
    const key = (inv.clientEmail || inv.clientName).toLowerCase();
    let g = by.get(key);
    if (!g) {
      g = {
        c: { name: inv.clientName, email: inv.clientEmail, invoices: 0, billed: 0, paid: 0, outstanding: 0, overdue: 0, maxDaysOverdue: 0, avgDaysToPay: null, currency: inv.currency, rating: "New" },
        days: [],
        hasPaid: false,
      };
      by.set(key, g);
    }
    g.c.invoices++;
    g.c.billed += inv.amount;
    g.c.paid += paid;
    if (inv.daysOverdue > 0) {
      g.c.overdue += inv.amount;
      g.c.maxDaysOverdue = Math.max(g.c.maxDaysOverdue, inv.daysOverdue);
    }
    if (inv.status === "PAID") {
      g.hasPaid = true;
      if (invoiceDate && paidDate) {
        const d = (Date.parse(paidDate) - Date.parse(invoiceDate)) / DAY;
        if (Number.isFinite(d)) g.days.push(Math.max(0, d));
      }
    }
  }
  return [...by.values()]
    .map(({ c, days, hasPaid }) => {
      c.outstanding = c.billed - c.paid;
      c.avgDaysToPay = days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null;
      c.rating = rate(c.maxDaysOverdue, c.avgDaysToPay, hasPaid);
      return c;
    })
    .sort((a, b) => b.outstanding - a.outstanding || b.billed - a.billed);
}

export async function listClients(): Promise<Client[]> {
  // Lazy import keeps the pure functions above runnable by node without bundler resolution (see clients.check.ts).
  const { listRawInvoices, toInvoice, pp } = await import("./paypal");
  const raw = await listRawInvoices();
  return groupClients(
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.map(async (r: any) => {
        const inv = toInvoice(r);
        // PAID counts in full; PARTIALLY_PAID uses payments.paid_amount when present.
        const paid = inv.status === "PAID" ? inv.amount : inv.status === "PARTIALLY_PAID" ? Number(r.payments?.paid_amount?.value ?? 0) : 0;
        let paidDate: string | null = null;
        if (inv.status === "PAID") {
          // The list endpoint omits payment dates, so read the invoice once; a paid date never changes, so cache it.
          if (!paidDates.has(inv.id)) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = (await pp(`/v2/invoicing/invoices/${encodeURIComponent(inv.id)}`)) as any;
              paidDates.set(inv.id, d.payments?.transactions?.[0]?.payment_date ?? null);
            } catch {
              // leave uncached so the next request retries; the column shows n/a meanwhile
            }
          }
          paidDate = paidDates.get(inv.id) ?? null;
        }
        return { inv, invoiceDate: r.detail?.invoice_date ?? null, paid, paidDate };
      }),
    ),
  );
}

const paidDates = new Map<string, string | null>();
