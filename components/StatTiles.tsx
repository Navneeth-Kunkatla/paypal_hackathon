import type { Invoice } from "@/lib/types";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const count = (n: number, word = "invoice") => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function StatTiles({ invoices }: { invoices: Invoice[] }) {
  const open = invoices.filter((i) => i.status === "SENT" || i.status === "PARTIALLY_PAID");
  const overdue = open.filter((i) => i.daysOverdue > 0);
  const outstanding = open.filter((i) => i.daysOverdue <= 0);
  const paid = invoices.filter((i) => i.status === "PAID");
  const drafts = invoices.filter((i) => i.status === "DRAFT");
  const sum = (l: Invoice[]) => l.reduce((s, i) => s + i.amount, 0);

  const outV = sum(outstanding), overV = sum(overdue), paidV = sum(paid);
  const total = outV + overV + paidV;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const maxDays = Math.max(0, ...overdue.map((i) => i.daysOverdue));

  const stats = [
    { label: "Outstanding", value: money(outV), sub: count(outstanding.length), key: "var(--seg-out)", color: "var(--fg)" },
    { label: "Overdue", value: money(overV), sub: overdue.length ? `${count(overdue.length)}, up to ${maxDays} days` : count(0), key: "var(--seg-over)", color: "var(--warn-text)" },
    { label: "Paid", value: money(paidV), sub: count(paid.length), key: "var(--seg-paid)", color: "var(--fg)" },
    { label: "Needs your OK", value: String(drafts.length), sub: drafts.length ? `${money(sum(drafts))} in drafts` : "nothing waiting", key: "var(--seg-draft)", color: "var(--fg)" },
  ];

  const label = total > 0
    ? `Of everything invoiced: ${Math.round(pct(paidV))} percent paid, ${Math.round(pct(outV))} percent outstanding, ${Math.round(pct(overV))} percent overdue`
    : "No invoices yet";

  return (
    <section aria-label="Money summary" className="card flex flex-wrap items-end gap-7 px-5 py-6 sm:px-7">
      <div className="min-w-0" style={{ flex: "1 1 280px" }}>
        <div className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted)" }}>You are owed</div>
        <div className="display num text-[40px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[52px]">{money(outV + overV)}</div>
        <div role="img" aria-label={label} className="mt-3.5 flex h-2.5 overflow-hidden rounded-full" style={{ background: "var(--hair)" }}>
          {total > 0 && (
            <>
              <div style={{ width: `${pct(paidV)}%`, background: "var(--seg-paid)" }} />
              <div style={{ width: `${pct(outV)}%`, background: "var(--seg-out)" }} />
              <div style={{ width: `${pct(overV)}%`, background: "var(--seg-over)" }} />
            </>
          )}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" style={{ flex: "2 1 560px" }}>
        {stats.map((s) => (
          <div key={s.label} className="py-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--muted)" }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ background: s.key }} />
              {s.label}
            </div>
            <div className="display num text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
