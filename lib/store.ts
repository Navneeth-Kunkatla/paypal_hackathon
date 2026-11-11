import type { ActivityEvent, AuditEntry, Settings } from "./types";

// shortcut: in-memory (settings, activity events and the audit log), lost on restart; move to a DB if this needs to persist
const g = globalThis as unknown as {
  __settle?: {
    settings: Settings;
    events: ActivityEvent[];
    audit: AuditEntry[];
    statuses: Map<string, string>;
    notified: Set<string>;
  };
};

const defaultDailyCap = () => Number(process.env.DAILY_CAP ?? 2000) || 2000;

g.__settle ??= {
  settings: {
    autoSendLimit: Number(process.env.AUTO_SEND_LIMIT ?? 500) || 500,
    dailyCap: defaultDailyCap(),
    newClientNeedsApproval: false,
    maxReminders: 1,
  },
  events: [],
  audit: [],
  statuses: new Map(),
  notified: new Set(),
};
const state = g.__settle;
// survive hot reloads where an older state object lacks these
state.audit ??= [];
state.settings.dailyCap ??= defaultDailyCap();
state.settings.newClientNeedsApproval ??= false;
state.settings.maxReminders ??= 1;
state.statuses ??= new Map();
state.notified ??= new Set();

export const getSettings = (): Settings => state.settings;

export function setSettings(s: Settings): Settings {
  state.settings = {
    autoSendLimit: s.autoSendLimit,
    dailyCap: s.dailyCap,
    newClientNeedsApproval: s.newClientNeedsApproval,
    maxReminders: s.maxReminders,
  };
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

// newest first, capped at 500
export const getAudit = (): AuditEntry[] => state.audit;

export function addAudit(e: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const a: AuditEntry = { id: crypto.randomUUID(), at: new Date().toISOString(), ...e };
  state.audit.unshift(a);
  state.audit.length = Math.min(state.audit.length, 500);
  return a;
}
