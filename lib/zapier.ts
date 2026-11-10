import { addEvent } from "./store";

// Never throws. Returns what happened so the test button can report it.
export async function notifyZapier(event: string, payload: object): Promise<"sent" | "unconfigured" | "failed"> {
  const url = process.env.ZAPIER_PAID_HOOK_URL;
  if (!url) return "unconfigured";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return "sent";
  } catch (e) {
    addEvent("info", `Zapier notification failed: ${e instanceof Error ? e.message : "error"}`);
    return "failed";
  }
}
