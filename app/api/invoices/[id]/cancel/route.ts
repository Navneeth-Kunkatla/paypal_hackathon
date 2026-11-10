import { cancelInvoice, getInvoice } from "@/lib/paypal";
import { addEvent } from "@/lib/store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const inv = await getInvoice(id);
    await cancelInvoice(id, inv.status);
    addEvent("info", `${inv.status === "DRAFT" ? "Deleted draft" : "Cancelled invoice"} ${inv.number || id}`, id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
