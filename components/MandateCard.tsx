"use client";

import { useEffect, useRef, useState } from "react";
import type { Settings } from "@/lib/types";

// Missing fields (older API) fall back to these.
const DEFAULTS: Settings = { autoSendLimit: 500, dailyCap: 2000, newClientNeedsApproval: false, maxReminders: 1 };

type NumKey = "autoSendLimit" | "dailyCap" | "maxReminders";

const box = "num h-9 rounded-lg border px-2.5 text-right font-semibold";
const boxStyle = { background: "var(--surface)", borderColor: "var(--outline)", color: "var(--fg)" };

export default function MandateCard() {
  const saved = useRef<Settings>(DEFAULTS);
  const timers = useRef<Partial<Record<NumKey, ReturnType<typeof setTimeout>>>>({});
  const note = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [draft, setDraft] = useState<Record<NumKey, string>>({
    autoSendLimit: String(DEFAULTS.autoSendLimit),
    dailyCap: String(DEFAULTS.dailyCap),
    maxReminders: String(DEFAULTS.maxReminders),
  });
  const [ask, setAsk] = useState(DEFAULTS.newClientNeedsApproval);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const show = (s: Settings) => {
    saved.current = s;
    setDraft({ autoSendLimit: String(s.autoSendLimit), dailyCap: String(s.dailyCap), maxReminders: String(s.maxReminders) });
    setAsk(s.newClientNeedsApproval);
  };

  useEffect(() => {
    const t = timers.current;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const j = await r.json().catch(() => ({}));
        if (r.ok) show({ ...DEFAULTS, ...j });
        else setErr(j.error ?? "Could not load your mandate.");
      } catch {
        setErr("Could not load your mandate. Check your connection.");
      }
    })();
    return () => { Object.values(t).forEach(clearTimeout); clearTimeout(note.current); };
  }, []);

  // Sends only the changed field. On any failure the last saved value comes back.
  const save = async (key: keyof Settings, value: number | boolean) => {
    if (saved.current[key] === value) return;
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value } satisfies Partial<Settings>),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not save your mandate.");
      saved.current = { ...saved.current, [key]: value };
      setErr("");
      setMsg("Saved");
      clearTimeout(note.current);
      note.current = setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      show(saved.current);
      setMsg("");
      setErr(e instanceof Error ? e.message : "Could not save your mandate. Check your connection.");
    }
  };

  const commit = (key: NumKey, raw: string) => {
    clearTimeout(timers.current[key]);
    const n = Number(raw);
    const bad = raw.trim() === "" || !Number.isFinite(n) || n < 0 || (key === "maxReminders" && (!Number.isInteger(n) || n > 10));
    if (bad) {
      setDraft((d) => ({ ...d, [key]: String(saved.current[key]) }));
      setErr(key === "maxReminders" ? "Reminders must be a whole number from 0 to 10." : "Enter an amount of 0 or more.");
      return;
    }
    save(key, n);
  };

  const num = (key: NumKey, id: string, w: string, max?: number) => (
    <input
      id={id} type="number" min={0} max={max} step={max ? 1 : "any"} inputMode={max ? "numeric" : "decimal"}
      value={draft[key]}
      onChange={(e) => {
        const v = e.target.value;
        setDraft((d) => ({ ...d, [key]: v }));
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(() => commit(key, v), 800);
      }}
      onBlur={(e) => commit(key, e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`${box} ${w}`} style={boxStyle}
    />
  );

  const row = "flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm";

  return (
    <section aria-labelledby="mandate-h" className="card">
      <div className="card-h flex-wrap justify-between">
        <div>
          <h2 id="mandate-h">Your mandate</h2>
          <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>Enforced in code. The agent cannot change or skip it.</p>
        </div>
        <div aria-live="polite" className="text-[13px] font-semibold" style={{ color: "var(--info-fg)" }}>{msg}</div>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        {err && <p role="alert" className="m-0 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{err}</p>}
        <div className={row}>
          <label htmlFor="m-limit">Send without asking, up to</label>
          {num("autoSendLimit", "m-limit", "w-28")}
          <span>per invoice</span>
        </div>
        <div className={row}>
          <label htmlFor="m-cap">Send at most</label>
          {num("dailyCap", "m-cap", "w-28")}
          <span>in total per day</span>
        </div>
        <div className={row}>
          <input
            id="m-new" type="checkbox" checked={ask} className="h-4 w-4"
            onChange={(e) => { setAsk(e.target.checked); save("newClientNeedsApproval", e.target.checked); }}
          />
          <label htmlFor="m-new">Always ask me before the first invoice to a new client</label>
        </div>
        <div className={row}>
          <label htmlFor="m-rem">Remind a client at most</label>
          {num("maxReminders", "m-rem", "w-20", 10)}
          <span>time(s) per invoice per day</span>
        </div>
      </div>
    </section>
  );
}
