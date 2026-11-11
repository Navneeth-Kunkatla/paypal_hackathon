"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";

const STARTERS = [
  "Invoice Acme Co (billing@acme.test) $450 for logo design, due in 14 days",
  "Who owes me the most?",
  "Chase everything that is overdue",
];

export default function ChatPanel({ onFinish }: { onFinish: () => void }) {
  const { messages, input, setInput, handleInputChange, handleSubmit, append, status, error } = useChat({
    api: "/api/chat",
    onFinish,
  });
  const busy = status === "submitted" || status === "streaming";
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: scrollIntoView can return a Promise, and an effect must return nothing or a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, status]);

  return (
    <section aria-labelledby="chat-h" className="card flex h-[34rem] max-h-[80vh] flex-col overflow-hidden">
      <div className="card-h">
        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
        <h2 id="chat-h">Ask Countersign</h2>
      </div>
      <div role="log" aria-live="polite" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Invoice a client, or ask about your money. Try one of these:</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-wrap items-start gap-1.5"}>
            {m.parts?.map((p, i) => {
              if (p.type === "text" && p.text) {
                return (
                  <p
                    key={i}
                    className={`max-w-[88%] whitespace-pre-wrap px-3.5 py-2.5 ${m.role === "user" ? "rounded-[14px_14px_4px_14px]" : "w-full rounded-[14px_14px_14px_4px]"}`}
                    style={m.role === "user"
                      ? { background: "var(--ink)", color: "var(--ink-fg)" }
                      : { background: "var(--surface-2)" }}
                  >
                    {p.text}
                  </p>
                );
              }
              if (p.type === "tool-invocation") {
                const done = p.toolInvocation.state === "result";
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--neutral-bg)", color: "var(--neutral-fg)" }}>
                    {done ? (
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg aria-hidden="true" className="spin" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.3" /><path d="M6 1.5a4.5 4.5 0 014.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                    )}
                    {p.toolInvocation.toolName}
                    {!done && <span> running</span>}
                  </span>
                );
              }
              return null;
            })}
          </div>
        ))}
        {status === "submitted" && <p className="text-sm" style={{ color: "var(--muted)" }}>Thinking…</p>}
        {error && (
          <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)" }}>
            The agent could not respond: {error.message.replace(/^{.*"error":"([^"]*)".*}$/, "$1")}
          </p>
        )}
        <div ref={end} />
      </div>
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="min-h-9 rounded-full border px-3 text-left text-[12.5px]" style={{ background: "var(--surface)", borderColor: "var(--outline)" }} onClick={() => append({ role: "user", content: s })}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => { if (input.trim()) handleSubmit(e); else e.preventDefault(); }}
        className="flex gap-2 border-t px-5 pb-4 pt-3"
        style={{ borderColor: "var(--hair)" }}
      >
        <label htmlFor="chat-input" className="sr-only">Message the agent</label>
        <input
          id="chat-input"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask or give an instruction…"
          className="h-11 min-w-0 flex-1 rounded-[10px] border px-3"
          style={{ background: "var(--surface)", borderColor: "var(--outline)" }}
          onKeyDown={(e) => e.key === "Escape" && setInput("")}
        />
        <button type="submit" className="btn btn-primary h-11 rounded-[10px] px-4" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
  );
}
