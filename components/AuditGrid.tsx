"use client";

import { AgGridReact, type CustomNoRowsOverlayProps } from "ag-grid-react";
import type { CellStyle, ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo, type ReactNode } from "react";
import type { AuditEntry } from "@/lib/types";
import { fmt, theme } from "@/components/InvoiceGrid";

const WHO: Record<AuditEntry["actor"], string> = { agent: "Agent", human: "You", zapier: "Zapier" };
const ACTION: Record<AuditEntry["action"], string> = {
  send_invoice: "Send invoice",
  send_reminder: "Send reminder",
  cancel_invoice: "Cancel invoice",
  change_mandate: "Change mandate",
};
export const VERDICT: Record<AuditEntry["verdict"], { label: string; bg: string; fg: string }> = {
  allowed: { label: "Allowed", bg: "--paid-bg", fg: "--paid-fg" },
  held: { label: "Held", bg: "--warn-bg", fg: "--warn-fg" },
  blocked: { label: "Blocked", bg: "--bad-bg", fg: "--bad-fg" },
};

function NoRows(props: CustomNoRowsOverlayProps) {
  void props;
  return <p className="px-4 py-6 text-sm" style={{ color: "var(--fg-2)" }}>No entries match this filter.</p>;
}

const cell = (children: ReactNode, end = false) => (
  <div className={`flex h-full items-center ${end ? "justify-end" : ""}`}>{children}</div>
);

export default function AuditGrid({ entries }: { entries: AuditEntry[] }) {
  const cols = useMemo<ColDef<AuditEntry>[]>(() => [
    {
      field: "at", headerName: "Time", width: 130, cellClass: "num",
      tooltipValueGetter: (p) => p.data?.at ?? "",
      cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && cell(new Date(data.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })),
    },
    { field: "actor", headerName: "Who", width: 90, cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && cell(WHO[data.actor] ?? data.actor) },
    { field: "action", headerName: "Action", width: 140, cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && cell(ACTION[data.action] ?? data.action) },
    {
      headerName: "Invoice", colId: "invoice", width: 170, sortable: false,
      cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && (
        <div className="flex h-full flex-col justify-center leading-tight">
          <div className="num truncate font-semibold">{data.invoiceNumber ?? ""}</div>
          <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{data.client ?? ""}</div>
        </div>
      ),
    },
    {
      field: "amount", headerName: "Amount", width: 110, type: "rightAligned", cellClass: "num",
      cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && cell(data.amount == null ? "" : fmt(data.amount, data.currency ?? "USD"), true),
    },
    {
      field: "verdict", headerName: "Verdict", width: 110,
      cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => {
        const v = data && VERDICT[data.verdict];
        return v && cell(<span className="pill" style={{ background: `var(${v.bg})`, color: `var(${v.fg})` }}>{v.label}</span>);
      },
    },
    { field: "rule", headerName: "Rule", width: 150, cellRenderer: ({ data }: ICellRendererParams<AuditEntry>) => data && cell(<span className="font-semibold">{data.rule}</span>) },
    {
      field: "detail", headerName: "Why", flex: 1, minWidth: 280, wrapText: true, autoHeight: true, tooltipField: "detail",
      cellStyle: { lineHeight: "20px", paddingTop: 12, paddingBottom: 12, minHeight: 56, display: "flex", alignItems: "center", color: "var(--fg-2)" } as CellStyle,
    },
  ], []);

  return (
    <AgGridReact<AuditEntry>
      theme={theme}
      domLayout="autoHeight"
      rowData={entries}
      columnDefs={cols}
      defaultColDef={{ sortable: true, resizable: true }}
      getRowId={(p) => p.data.id}
      noRowsOverlayComponent={NoRows}
      tooltipShowDelay={300}
      suppressCellFocus
    />
  );
}
