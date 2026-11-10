import { keysMissing } from "@/lib/agent";
import { JobBody, runJob } from "@/lib/jobs";

// Same logic as /api/jobs, minus the shared secret (which stays server-side).
export async function POST(req: Request) {
  try {
    const parsed = JobBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return Response.json({ error }, { status: 400 });
    }
    if (keysMissing()) {
      return Response.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY or PayPal credentials" }, { status: 503 });
    }
    return Response.json({ ok: true, summary: await runJob(parsed.data) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Job failed" }, { status: 500 });
  }
}
