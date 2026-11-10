import { getInvoice, sendInvoice } from "@/lib/paypal";
import { addEvent } from "@/lib/store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await sendInvoice(id);
    const inv = await getInvoice(id).catch(() => null);
    addEvent("sent", `Approved and sent ${inv?.number || id}`, id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
