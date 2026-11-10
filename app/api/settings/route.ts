import { getSettings, setSettings } from "@/lib/store";

export async function GET() {
  return Response.json(getSettings());
}

export async function PUT(req: Request) {
  try {
    const { autoSendLimit } = await req.json();
    if (typeof autoSendLimit !== "number" || !Number.isFinite(autoSendLimit) || autoSendLimit < 0) {
      return Response.json({ error: "autoSendLimit must be a number >= 0" }, { status: 400 });
    }
    return Response.json(setSettings({ autoSendLimit }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
