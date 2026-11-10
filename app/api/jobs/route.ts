import { timingSafeEqual } from "node:crypto";
import { keysMissing } from "@/lib/agent";
import { JobBody, runJob } from "@/lib/jobs";

export async function POST(req: Request) {
  const secret = process.env.ZAPIER_HOOK_SECRET;
  if (!secret) return Response.json({ error: "ZAPIER_HOOK_SECRET not set" }, { status: 503 });
  const given = Buffer.from(req.headers.get("x-settle-secret") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = JobBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json({ error }, { status: 400 });
  }
  if (keysMissing()) {
    return Response.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY or PayPal credentials" }, { status: 503 });
  }
  try {
    return Response.json({ ok: true, summary: await runJob(parsed.data) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Job failed" }, { status: 500 });
  }
}
