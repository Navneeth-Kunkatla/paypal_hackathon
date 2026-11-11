import { generateText } from "ai";
import { agentConfig, keysMissing } from "@/lib/agent";
import { listClients } from "@/lib/clients";

export async function POST() {
  if (keysMissing()) {
    return Response.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY or PayPal credentials" }, { status: 503 });
  }
  let clients;
  try {
    clients = await listClients();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
  if (!clients.length) return Response.json({ summary: "No clients yet." });
  try {
    const { text } = await generateText({
      model: agentConfig().model,
      prompt: `You advise a freelancer. Client stats from their PayPal invoices (JSON; overdue and outstanding are money amounts):\n${JSON.stringify(clients)}\nWrite 2 to 3 plain-text sentences: who to chase first and why, and who is reliable. Refer to clients by name. No markdown, no lists, no asterisks.`,
    });
    return Response.json({ summary: text.trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Summary failed" }, { status: 502 });
  }
}
