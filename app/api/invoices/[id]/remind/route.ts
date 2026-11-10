import { getInvoice, remindInvoice } from "@/lib/paypal";
import { addEvent } from "@/lib/store";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await remindInvoice(id);
    const inv = await getInvoice(id).catch(() => null);
    addEvent("reminded", `Sent a reminder for ${inv?.number || id}`, id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
