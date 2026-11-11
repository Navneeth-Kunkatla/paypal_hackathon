import type { ActivityEvent } from "@/lib/types";

const KIND: Record<ActivityEvent["kind"], { dot: string; label: string }> = {
  drafted: { dot: "var(--seg-out)", label: "Drafted" },
  sent: { dot: "var(--seg-sent)", label: "Sent" },
  reminded: { dot: "var(--seg-over)", label: "Reminder" },
  paid: { dot: "var(--seg-paid)", label: "Paid" },
  blocked: { dot: "var(--seg-draft)", label: "Held for approval" },
  info: { dot: "var(--seg-info)", label: "Info" },
};

export default function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <section aria-labelledby="activity-h" className="card flex min-h-0 flex-col px-5 py-4">
      <h2 id="activity-h" className="mb-3 text-base font-semibold">Agent activity</h2>
      {events.length === 0 ? (
        <p className="py-2 text-sm" style={{ color: "var(--muted)" }}>
          Nothing yet. Agent actions will show up here.
        </p>
      ) : (
        <ol className="m-0 flex max-h-80 list-none flex-col gap-3.5 overflow-y-auto p-0">
          {events.map((e) => {
            const k = KIND[e.kind] ?? KIND.info;
            return (
              <li key={e.id} className="flex gap-3">
                <span aria-hidden="true" className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: k.dot }} />
                <div className="min-w-0 flex-1">
                  <p>
                    {!e.text.startsWith(k.label) && <span className="font-semibold">{k.label} </span>}{e.text}
                  </p>
                  <time dateTime={e.at} className="num text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
