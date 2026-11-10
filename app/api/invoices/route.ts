import { listInvoices } from "@/lib/paypal";
import { detectPaid } from "@/lib/paid";

export async function GET() {
  try {
    const invoices = await listInvoices();
    await detectPaid(invoices);
    return Response.json({ invoices });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
