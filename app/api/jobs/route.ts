import { timingSafeEqual } from "node:crypto";
import { generateText } from "ai";
import { z } from "zod";
import { agentConfig, keysMissing } from "@/lib/agent";
import { addEvent } from "@/lib/store";

const Body = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  amount: z.coerce.number().positive(),
  description: z.string().min(1),
  due_days: z.coerce.number().int().min(0).max(120).default(14),
  currency: z.string().length(3).default("USD"),
});

export async function POST(req: Request) {
  const secret = process.env.ZAPIER_HOOK_SECRET;
  if (!secret) return Response.json({ error: "ZAPIER_HOOK_SECRET not set" }, { status: 503 });
  const given = Buffer.from(req.headers.get("x-settle-secret") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json({ error }, { status: 400 });
  }
  if (keysMissing()) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY or PayPal credentials" }, { status: 503 });
  }
  const j = parsed.data;
  try {
    addEvent("info", `Job completed via Zapier: ${j.description} for ${j.client_name}`);
    const { text } = await generateText({
      ...agentConfig(),
      prompt: `A job was just marked complete in the freelancer's task tool. Create an invoice and send it: client ${j.client_name} ${j.client_email}, ${j.amount} ${j.currency.toUpperCase()} for "${j.description}", due in ${j.due_days} days.`,
    });
    return Response.json({ ok: true, summary: text });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Job failed" }, { status: 500 });
  }
}
