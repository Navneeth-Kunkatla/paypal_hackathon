# Countersign: the guardrail layer for PayPal agents, shown on invoicing

Tagline: the agent acts inside your mandate; you countersign the rest. (Earlier working name: Settle, the get-paid agent for freelancers. Some names, such as the "Settle Jobs" table and the `x-settle-secret` header, keep it.) Deadline: Nov 12, 2026, 12:00 PT.

## Problem

Freelancers finish the work, then lose hours writing invoices and chasing late
payments. Chasing is awkward, so many just wait. Countersign runs the
collections loop for them, inside a mandate they set.

## What it does

1. **Job done.** A task is marked complete in the tool the freelancer already
   uses (a Zapier Table; Trello or Google Sheets also work). Zapier posts it to Countersign. The
   freelancer can also just type: "Invoice Acme $1,200 for the logo, due in 14
   days."
2. **Agent drafts the invoice.** Gemini, using the PayPal Agent Toolkit, builds
   a real PayPal invoice from the job details.
3. **Mandate.** One function in code (`lib/policy.ts`) checks every send and
   reminder against four clauses the freelancer sets: per-invoice limit, daily
   cap, new-client rule, reminder cap. Outside the mandate, the invoice waits
   for one click. Every attempt is recorded on the Audit trail page. Jobs from
   Zapier go through the same mandate and show as "Zapier" in the trail.
4. **Send.** PayPal sends the invoice. Countersign shows the pay link and QR code.
5. **Chase.** When an invoice goes overdue, the agent picks the reminder tone
   (friendly, firm, final) by days overdue and sends it through
   PayPal.
6. **Paid.** While the dashboard is open it polls PayPal and sees the paid
   status (a signature-verified webhook route also exists, but the live site
   uses polling). The dashboard updates, and Zapier notifies the freelancer (Slack, email or a sheet row).
7. **Ask your money.** Chat questions like "who owes me the most?" answered
   from live PayPal data.

## Why it can win

- The agent transacts, it does not just recommend (Agentic Commerce prize,
  PayPal + AI prize).
- The mandate and audit trail answer the obvious trust question, and answer the open guardrail issues in PayPal's agent toolkit repo (#82, #95, #104, #105) for the invoicing side.
- One specific audience, one specific pain, shown end to end in under 3 minutes.

## Stack

| Piece | Choice | Why |
|---|---|---|
| App | Next.js (TypeScript), one app for UI and API | One deploy, one repo |
| Agent | Vercel AI SDK + Gemini | Toolkit has a ready adapter |
| PayPal | `@paypal/agent-toolkit` (invoices, reporting, disputes), sandbox | Official, 20 invoice tools |
| Data | PayPal is the source of truth; a small in-memory activity log, mandate and audit log | No database to run |
| Dashboard | AG Grid Community (invoices, clients and audit trail) | Sponsor prize, low risk |
| Automation | Zapier: inbound "job done" hook, outbound "paid" hook | User request |
| API testing | Postman collection and environment in `postman/` | User request, Postman judge |
| Hosting | Render | Sponsor prize, gives judges a live URL |

Skipped: APIMatic, Bryntum, Channel3. Not needed and they add risk.

## Build order

Each step leaves a working app.

1. Scaffold, env config, PayPal sandbox token check.
2. Agent chat that creates and sends a sandbox invoice.
3. Dashboard grid of invoices with status and the agent's next action.
4. Mandate and audit trail (policy function, guarded send and remind).
5. Overdue reminders, with a "run the chaser now" button for the demo.
6. Paid detection: polling first, PayPal webhook once the app has a public URL.
7. Zapier inbound and outbound hooks.
8. Postman collection, README with run steps, deploy to Render.
9. Demo video and Devpost submission.

Cut line if time runs out: steps 1 to 4 plus 8 are a valid submission.

## Needed from the team

- PayPal sandbox Client ID and Secret, in `.env.local` (never committed).
- A Gemini API key (free tier) from Google AI Studio.
- A Zapier account and a Postman account.
- A Render account, at deploy time.
- Someone to record the video and submit on Devpost.
