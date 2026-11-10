import { addEvent } from "./store";

export async function notifyZapier(event: string, payload: object): Promise<void> {
  const url = process.env.ZAPIER_PAID_HOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    addEvent("info", `Zapier notification failed: ${e instanceof Error ? e.message : "error"}`);
  }
}
