"use client";

import { AgGridReact, type CustomNoRowsOverlayProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type CellStyle, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { useMemo } from "react";
import type { Invoice, InvoiceStatus } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

// Grid colours come from the same CSS variables as the page, so light/dark follow prefers-color-scheme.
const theme = themeQuartz.withParams({
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--fg)",
  headerBackgroundColor: "var(--surface)",
  headerTextColor: "var(--muted)",
  headerFontSize: 12,
  headerFontWeight: 600,
  headerHeight: 40,
  borderColor: "var(--hair)",
  rowBorder: { style: "solid", width: 1, color: "var(--hair)" },
  headerRowBorder: { style: "solid", width: 1, color: "var(--hair)" },
  columnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  accentColor: "var(--accent)",
  oddRowBackgroundColor: "var(--surface)",
  rowHoverColor: "var(--surface-2)",
  rowHeight: 56,
  cellHorizontalPadding: 12,
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontSize: 13.5,
});

export const PILL: Record<InvoiceStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: "Draft", bg: "--draft-bg", fg: "--draft-fg" },
  SENT: { label: "Sent", bg: "--info-bg", fg: "--info-fg" },
  PAID: { label: "Paid", bg: "--paid-bg", fg: "--paid-fg" },
  PARTIALLY_PAID: { label: "Partially paid", bg: "--info-bg", fg: "--info-fg" },
  CANCELLED: { label: "Cancelled", bg: "--neutral-bg", fg: "--neutral-fg" },
  OTHER: { label: "Other", bg: "--neutral-bg", fg: "--neutral-fg" },
};

export function StatusPill({ inv }: { inv: Invoice }) {
  const s = PILL[inv.status] ?? PILL.OTHER;
  const late = inv.daysOverdue > 0 && inv.status !== "PAID" && inv.status !== "CANCELLED";
  return (
    <span className="pill" style={late ? { background: "var(--warn-bg)", color: "var(--warn-fg)" } : { background: `var(${s.bg})`, color: `var(${s.fg})` }}>
      {late ? `Overdue ${inv.daysOverdue}d` : s.label}
    </span>
  );
}

type Ctx = { act: (id: string, verb: "send" | "remind") => void; pending: Set<string>; open: (id: string) => void };
type P = ICellRendererParams<Invoice, unknown, Ctx>;

function Actions({ data, context }: P) {
  if (!data) return null;
  const busy = context.pending.has(data.id);
  return (
    <div className="flex h-full items-center justify-end gap-3 whitespace-nowrap">
      {data.status === "SENT" && data.payUrl && (
        <a href={data.payUrl} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-medium underline" aria-label={`Pay link for invoice ${data.number} (opens in new tab)`}>
          Pay link
        </a>
      )}
      {data.status === "SENT" && (
        <button className="btn" disabled={busy} aria-label={`Send reminder for invoice ${data.number}`} onClick={() => context.act(data.id, "remind")}>
          {busy ? "Reminding…" : "Remind"}
        </button>
      )}
      {data.status === "DRAFT" && (
        <button className="btn btn-primary" disabled={busy} aria-label={`Approve and send invoice ${data.number}`} onClick={() => context.act(data.id, "send")}>
          {busy ? "Sending…" : "Approve & send"}
        </button>
      )}
    </div>
  );
}

function NoRows(props: CustomNoRowsOverlayProps) {
  void props;
  const steps = [
    ["Ask the agent", "Type something like \"Invoice Acme $400 for the logo, due in 14 days.\""],
    ["Approve", "Invoices over your auto-send limit wait for one click from you."],
    ["Get paid", "Settle sends the PayPal invoice, chases late ones and tells you when it is paid."],
  ];
  return (
    <div className="px-4 py-6 text-left">
      <p className="mb-3 text-sm font-semibold">No invoices yet. Here is how it works.</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm" style={{ color: "var(--fg-2)" }}>
        {steps.map(([t, d], i) => (
          <li key={t}><span className="font-semibold">{i + 1}. {t}.</span> {d}</li>
        ))}
      </ol>
    </div>
  );
}

export const fmt = (n: number, currency: string) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
};

const fmtDue = (v: string | null) => {
  if (!v) return "-";
  const d = new Date(v + "T00:00:00");
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const rank = (i: Invoice) => (i.status === "DRAFT" ? 0 : 1);

export default function InvoiceGrid({ invoices, act, pending, open, onChase, chasing }: { invoices: Invoice[]; act: Ctx["act"]; pending: Set<string>; open: Ctx["open"]; onChase: () => void; chasing: boolean }) {
  const overdue = invoices.filter((i) => i.daysOverdue > 0).length;
  // Default order: drafts first, then most overdue. Users can re-sort via headers.
  const rows = useMemo(
    () => [...invoices].sort((a, b) => rank(a) - rank(b) || b.daysOverdue - a.daysOverdue),
    [invoices],
  );
  const cols = useMemo<ColDef<Invoice>[]>(() => [
    { field: "number", headerName: "Invoice", width: 84, cellClass: "num", cellStyle: { color: "var(--muted)" } as CellStyle },
    {
      field: "clientName", headerName: "Client", flex: 1, minWidth: 130,
      cellRenderer: ({ data, context }: P) => data && (
        <div className="flex h-full flex-col items-start justify-center leading-tight">
          <button type="button" data-open={data.id} className="max-w-full truncate text-left font-semibold" aria-label={`Open details for invoice ${data.number}, ${data.clientName}`} onClick={() => context.open(data.id)}>{data.clientName}</button>
          <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{data.clientEmail}</div>
        </div>
      ),
    },
    { field: "amount", headerName: "Amount", width: 110, type: "rightAligned", cellClass: "num", cellStyle: { fontWeight: 600 } as CellStyle, valueFormatter: (p) => (p.data ? fmt(p.data.amount, p.data.currency) : "") },
    {
      field: "status", headerName: "Status", width: 124,
      cellRenderer: ({ data }: P) => data && <div className="flex h-full items-center"><StatusPill inv={data} /></div>,
    },
    { field: "dueDate", headerName: "Due", width: 84, cellClass: "num", valueFormatter: (p) => fmtDue(p.value) },
    { field: "nextAction", headerName: "Agent's next move", flex: 1, minWidth: 130, tooltipField: "nextAction", cellStyle: { color: "var(--fg-2)" } as CellStyle },
    { headerName: "Action", colId: "actions", width: 170, pinned: "right", resizable: false, sortable: false, headerClass: "ag-right-aligned-header", cellRenderer: Actions },
  ], []);

  return (
    <section aria-labelledby="inv-h" className="card overflow-hidden">
      <div className="card-h justify-between">
        <h2 id="inv-h">Invoices</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs sm:inline" style={{ color: "var(--muted)" }}>Live from PayPal</span>
          <button className="btn" disabled={overdue === 0 || chasing} aria-busy={chasing} onClick={onChase}>
            {chasing ? "Chasing…" : overdue === 0 ? "Nothing overdue" : `Chase overdue (${overdue})`}
          </button>
        </div>
      </div>
      <AgGridReact<Invoice>
        theme={theme}
        domLayout="autoHeight"
        rowData={rows}
        columnDefs={cols}
        defaultColDef={{ sortable: true, resizable: true }}
        getRowId={(p) => p.data.id}
        getRowStyle={(p) => (p.data?.status === "DRAFT" ? { background: "var(--draft-row)" } : undefined)}
        context={{ act, pending, open } satisfies Ctx}
        onRowClicked={(e) => {
          const t = e.event?.target as HTMLElement | null;
          if (e.data && !t?.closest("button, a")) open(e.data.id);
        }}
        noRowsOverlayComponent={NoRows}
        suppressCellFocus
      />
    </section>
  );
}
