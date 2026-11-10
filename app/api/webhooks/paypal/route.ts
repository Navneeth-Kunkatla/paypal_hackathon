import { getToken, getInvoice } from "@/lib/paypal";
import { handlePaid } from "@/lib/paid";

export async function POST(req: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return Response.json({ error: "PAYPAL_WEBHOOK_ID not set" }, { status: 503 });
  try {
    const event = await req.json();
    const h = (n: string) => req.headers.get(`paypal-${n}`);
    const res = await fetch("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: h("auth-algo"),
        cert_url: h("cert-url"),
        transmission_id: h("transmission-id"),
        transmission_sig: h("transmission-sig"),
        transmission_time: h("transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      }),
      cache: "no-store",
    });
    const v = res.ok ? ((await res.json()) as { verification_status?: string }) : null;
    if (v?.verification_status !== "SUCCESS") return Response.json({ error: "Invalid signature" }, { status: 400 });

    if (event.event_type === "INVOICING.INVOICE.PAID") {
      const id = event.resource?.invoice?.id ?? event.resource?.id;
      if (typeof id === "string") await handlePaid(await getInvoice(id));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Webhook failed" }, { status: 400 });
  }
}
