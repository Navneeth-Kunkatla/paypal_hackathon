import { addAudit, getSettings, setSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export async function GET() {
  return Response.json(getSettings());
}

const LABEL: Record<keyof Settings, string> = {
  autoSendLimit: "Per-invoice limit",
  dailyCap: "Daily cap",
  newClientNeedsApproval: "New-client approval",
  maxReminders: "Reminder cap",
};
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const bad = (error: string) => Response.json({ error }, { status: 400 });

export async function PUT(req: Request) {
  try {
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return bad("Body must be a JSON object");
    const old = getSettings();
    const next = { ...old };
    if ("autoSendLimit" in b) {
      if (!isNum(b.autoSendLimit)) return bad("autoSendLimit must be a number >= 0");
      next.autoSendLimit = b.autoSendLimit;
    }
    if ("dailyCap" in b) {
      if (!isNum(b.dailyCap)) return bad("dailyCap must be a number >= 0");
      next.dailyCap = b.dailyCap;
    }
    if ("maxReminders" in b) {
      if (!Number.isInteger(b.maxReminders) || b.maxReminders < 0 || b.maxReminders > 10) {
        return bad("maxReminders must be an integer from 0 to 10");
      }
      next.maxReminders = b.maxReminders;
    }
    if ("newClientNeedsApproval" in b) {
      if (typeof b.newClientNeedsApproval !== "boolean") return bad("newClientNeedsApproval must be a boolean");
      next.newClientNeedsApproval = b.newClientNeedsApproval;
    }
    const changes = (Object.keys(LABEL) as (keyof Settings)[])
      .filter((k) => old[k] !== next[k])
      .map((k) => `${LABEL[k]} ${old[k]} -> ${next[k]}`);
    const saved = setSettings(next);
    if (changes.length) {
      addAudit({ actor: "human", action: "change_mandate", verdict: "allowed", rule: "Mandate change", detail: changes.join("; ") });
    }
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
