"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Settings } from "@/lib/types";

const NAV = [
  { href: "/", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/automations", label: "Automations" },
];

export default function Header() {
  const path = usePathname();
  const [limit, setLimit] = useState("");
  const [err, setErr] = useState("");
  const saved = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings");
        if (r.ok) {
          const v = String(((await r.json()) as Settings).autoSendLimit);
          setLimit(v);
          saved.current = v;
        }
      } catch {
        // control stays empty
      }
    })();
  }, []);

  const saveLimit = async () => {
    const n = Number(limit);
    if (limit === saved.current || limit.trim() === "" || !Number.isFinite(n) || n < 0) return;
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSendLimit: n } satisfies Settings),
      });
      if (r.ok) { saved.current = limit; setErr(""); }
      else setErr("Could not save the limit.");
    } catch {
      setErr("Could not save the limit.");
    }
  };

  return (
    <header data-bg style={{ background: "var(--surface)", color: "var(--fg)", borderBottom: "1px solid var(--hair)" }}>
      <div className="mx-auto flex w-full max-w-[1296px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28">
            <rect width="28" height="28" rx="8" fill="#0070BA" />
            <path d="M8 14.5l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="display text-xl font-bold tracking-tight">Settle</span>
        </div>
        <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ borderColor: "var(--outline)", color: "var(--accent-hover)" }}>PayPal Sandbox</span>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map((n) => {
            const cur = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={cur ? "page" : undefined}
                className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold no-underline"
                style={cur ? { background: "var(--surface-2)", color: "var(--fg)", boxShadow: "inset 0 -2px 0 var(--accent)" } : { color: "var(--muted)" }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
          Agent may send up to
          <span className="inline-flex h-9 items-center rounded-lg border px-2.5" style={{ background: "var(--surface)", borderColor: "var(--outline)" }}>
            <span aria-hidden="true" style={{ color: "var(--muted)" }}>$</span>
            <input
              type="number" min={0} inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              onBlur={saveLimit}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="num w-16 border-0 bg-transparent text-right font-semibold"
              style={{ color: "var(--fg)", outlineOffset: 4 }}
            />
          </span>
          without asking
        </label>
        {err && <span role="alert" className="pill" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>{err}</span>}
      </div>
    </header>
  );
}
