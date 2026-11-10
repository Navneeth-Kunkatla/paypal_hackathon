import type { ActivityEvent, Settings } from "./types";

// shortcut: in-memory, lost on restart; move to a DB if this needs to persist
const g = globalThis as unknown as {
  __settle?: { settings: Settings; events: ActivityEvent[]; statuses: Map<string, string>; notified: Set<string> };
};

g.__settle ??= {
  settings: { autoSendLimit: Number(process.env.AUTO_SEND_LIMIT ?? 500) || 500 },
  events: [],
  statuses: new Map(),
  notified: new Set(),
};
const state = g.__settle;
// survive hot reloads where an older state object lacks these
state.statuses ??= new Map();
state.notified ??= new Set();

export const getSettings = (): Settings => state.settings;

export function setSettings(s: Settings): Settings {
  state.settings = { autoSendLimit: s.autoSendLimit };
  return state.settings;
}

// last-seen invoice status by id, and invoices whose payment was already announced
export const lastStatuses = () => state.statuses;
export const paidNotified = () => state.notified;

export const getEvents =(): ActivityEvent[] => state.events;

export function addEvent(
  kind: ActivityEvent["kind"],
  text: string,
  invoiceId?: string,
): ActivityEvent {
  const e: ActivityEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    text,
    invoiceId,
  };
  state.events.unshift(e);
  state.events.length = Math.min(state.events.length, 200);
  return e;
}
