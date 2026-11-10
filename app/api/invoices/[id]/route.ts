import { getInvoice, getQr } from "@/lib/paypal";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const invoice = await getInvoice(id);
    const qr = invoice.status === "DRAFT" || invoice.status === "CANCELLED" ? null : await getQr(id);
    return Response.json({ invoice, qr });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
