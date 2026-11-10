import { notifyZapier } from "@/lib/zapier";

export async function POST() {
  try {
    const result = await notifyZapier("invoice.paid", {
      test: true,
      invoiceId: "INV2-TEST-0000",
      number: "TEST",
      client: "Test Client",
      amount: 100,
      currency: "USD",
      text: "Test Client paid TEST, USD 100",
    });
    return Response.json({ ok: true, result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
