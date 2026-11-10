// Booleans only: never return secrets or the hook URL.
export async function GET() {
  return Response.json({
    jobsHook: !!process.env.ZAPIER_HOOK_SECRET,
    paidHook: !!process.env.ZAPIER_PAID_HOOK_URL,
    paypalWebhook: !!process.env.PAYPAL_WEBHOOK_ID,
  });
}
