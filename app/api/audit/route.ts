import { getAudit } from "@/lib/store";

const HEAD = ["at", "actor", "action", "verdict", "rule", "detail", "invoiceNumber", "client", "amount", "currency", "invoiceId"] as const;

// Quote for CSV, and neutralise spreadsheet formulas (client names come from users).
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export async function GET(req: Request) {
  const entries = getAudit();
  if (new URL(req.url).searchParams.get("format") !== "csv") return Response.json({ entries });
  const rows = [HEAD.join(","), ...entries.map((e) => HEAD.map((k) => cell(e[k])).join(","))];
  return new Response(rows.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="countersign-audit.csv"',
    },
  });
}
