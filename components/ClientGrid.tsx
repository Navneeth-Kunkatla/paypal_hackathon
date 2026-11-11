"use client";

import { AgGridReact, type CustomNoRowsOverlayProps } from "ag-grid-react";
import type { CellStyle, ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo } from "react";
import type { Client, ClientRating } from "@/lib/types";
import { fmt, theme } from "@/components/InvoiceGrid";

const RATING: Record<ClientRating, { bg: string; fg: string }> = {
  "Pays on time": { bg: "--paid-bg", fg: "--paid-fg" },
  "Slow payer": { bg: "--warn-bg", fg: "--warn-fg" },
  "At risk": { bg: "--bad-bg", fg: "--bad-fg" },
  New: { bg: "--neutral-bg", fg: "--neutral-fg" },
};

function NoRows(props: CustomNoRowsOverlayProps) {
  void props;
  return <p className="px-4 py-6 text-sm" style={{ color: "var(--fg-2)" }}>No clients yet. They appear once you send an invoice.</p>;
}

const money = (k: keyof Client): Partial<ColDef<Client>> => ({
  field: k, type: "rightAligned", width: 110, cellClass: "num",
  valueFormatter: (p) => (p.data ? fmt(p.data[k] as number, p.data.currency) : ""),
});

export default function ClientGrid({ clients }: { clients: Client[] }) {
  const cols = useMemo<ColDef<Client>[]>(() => [
    {
      field: "name", headerName: "Client", flex: 1, minWidth: 150,
      cellRenderer: ({ data }: ICellRendererParams<Client>) => data && (
        <div className="flex h-full flex-col justify-center leading-tight">
          <div className="truncate font-semibold">{data.name}</div>
          <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{data.email}</div>
        </div>
      ),
    },
    { field: "invoices", headerName: "Invoices", type: "rightAligned", width: 100, cellClass: "num" },
    { ...money("billed"), headerName: "Billed" },
    { ...money("paid"), headerName: "Paid" },
    { ...money("outstanding"), headerName: "Outstanding", cellStyle: { fontWeight: 600 } as CellStyle },
    { ...money("overdue"), headerName: "Overdue" },
    { field: "avgDaysToPay", headerName: "Avg days to pay", type: "rightAligned", width: 140, cellClass: "num", valueFormatter: (p) => (p.value == null ? "n/a" : `${p.value}`) },
    {
      field: "rating", headerName: "Rating", width: 140,
      cellRenderer: ({ data }: ICellRendererParams<Client>) => data && (
        <div className="flex h-full items-center">
          <span className="pill" style={{ background: `var(${RATING[data.rating].bg})`, color: `var(${RATING[data.rating].fg})` }}>{data.rating}</span>
        </div>
      ),
    },
  ], []);

  return (
    <section aria-labelledby="cl-h" className="card overflow-hidden">
      <div className="card-h"><h2 id="cl-h">Clients</h2></div>
      <AgGridReact<Client>
        theme={theme}
        domLayout="autoHeight"
        rowData={clients}
        columnDefs={cols}
        defaultColDef={{ sortable: true, resizable: true }}
        getRowId={(p) => (p.data.email || p.data.name).toLowerCase()}
        noRowsOverlayComponent={NoRows}
        suppressCellFocus
      />
    </section>
  );
}
