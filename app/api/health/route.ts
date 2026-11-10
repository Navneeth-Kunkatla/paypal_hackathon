import { getToken } from "@/lib/paypal";
import type { Health } from "@/lib/types";

export async function GET() {
  const ai = !!process.env.ANTHROPIC_API_KEY;
  let paypal = false;
  let ppErr = "";
  try {
    await getToken();
    paypal = true;
  } catch (e) {
    ppErr = e instanceof Error ? e.message : "PayPal unreachable";
  }
  const missing = [!paypal && ppErr, !ai && "ANTHROPIC_API_KEY not set"].filter(Boolean);
  const h: Health = { paypal, ai, message: missing.length ? missing.join("; ") : undefined };
  return Response.json(h);
}
