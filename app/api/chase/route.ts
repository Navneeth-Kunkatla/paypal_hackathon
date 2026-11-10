import { generateText } from "ai";
import { agentConfig, keysMissing } from "@/lib/agent";
import { listInvoices } from "@/lib/paypal";

export async function POST() {
  try {
    const overdue = (await listInvoices()).filter((i) => i.daysOverdue > 0);
    if (!overdue.length) return Response.json({ ok: true, reminded: 0, summary: "Nothing is overdue." });
    if (keysMissing()) {
      return Response.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY or PayPal credentials" }, { status: 503 });
    }
    const lines = overdue
      .map((i) => `- id ${i.id}, number ${i.number}, client ${i.clientName}, ${i.amount} ${i.currency}, ${i.daysOverdue} days overdue`)
      .join("\n");
    const { text } = await generateText({
      ...agentConfig(),
      prompt: `These invoices are overdue:\n${lines}\nSend each a reminder using the reminder tool with a short custom note. Tone by age: 1-7 days friendly, 8-21 firm, over 21 final notice. Then summarise what you did.`,
    });
    return Response.json({ ok: true, reminded: overdue.length, summary: text });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Chase failed" }, { status: 500 });
  }
}
