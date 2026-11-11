# Devpost submission text

Links: live demo https://settle-8njj.onrender.com (free tier; first load can take about a minute). Video: [ADD YOUTUBE LINK]. Repo: [ADD PUBLIC REPO LINK].

## Name
Settle

## Tagline
The get-paid agent for freelancers: it drafts, sends and chases PayPal invoices, and asks before it moves real money.

## Inspiration
Freelancers finish the work, then lose hours writing invoices and more hours chasing late payments. Chasing is awkward, so many just wait. In a 2022 survey of New York freelancers by the Freelancers Union and the Authors Guild, 91% of respondents reported late or overdue wages at least once in their career (source: https://blog.freelancersunion.org/2022/05/12/over-60-of-ny-freelancers-report-not-being-paid-for-work-performed). We wanted an agent that does the whole collections loop, not a chatbot that only suggests what to do, and one a freelancer can trust with money.

## What it does
The agent may send invoices on its own only up to a limit you set (default 500 dollars). The code enforces that limit inside the send tool, not in the prompt. Anything larger stays a draft until you approve it with one click, and the agent refuses if you tell it to ignore the limit.

You type "Invoice Acme $450 for logo design", or mark a row Done in a Zapier Table. Settle drafts a PayPal invoice and sends it if it is within the limit. Overdue invoices get PayPal reminders, with tone chosen by days overdue: friendly, firm or final notice. When an invoice is paid, the dashboard updates and a Zap emails you. You can ask "who owes me the most?" and get an answer from live PayPal data. The Clients page shows per-client billed, paid, outstanding, overdue, average days to pay and a rating, and a "Summarize my clients" button asks the agent who to chase first. Everything runs on the PayPal sandbox.

## Why not just PayPal's reminders or QuickBooks?
Reminder tools send scheduled, fixed reminders for invoices you already wrote. Settle does the loop around them: it turns a finished job into an invoice, decides whether it may send it, picks the tone by how late the client is, answers money questions from live PayPal data, and summarises which clients to chase. It acts inside a limit you control, and the code enforces it. We did not compare feature lists in detail; this is what Settle does differently.

## How we built it
One Next.js 16 and TypeScript app. Gemini (default `gemini-3.5-flash-lite`), through the Vercel AI SDK v4, calls PayPal Agent Toolkit (1.11) tools for get, list, reminders, cancel, QR code and transactions, plus two tools we wrote: `create_invoice` (the toolkit's cannot set a due date) and a gated `send_invoice`. Invoices live in PayPal, so there is no database. The dashboard and Clients page use AG Grid. Paid events are detected by polling PayPal every 10 seconds while the dashboard is open; a signature-verified PayPal webhook route also exists but is not configured on the live site. A real sandbox payment was tested end to end. Hosted on Render's free tier.

## Sponsor tools
- **AG Grid:** the invoice grid (status, days overdue, next action, row actions) and the client grid.
- **Zapier:** two live Zaps. A Zapier Table "Settle Jobs" row marked Done passes a Filter, then Webhooks by Zapier posts the job to Settle. When an invoice is paid, Settle calls a Catch Hook and Email by Zapier emails the freelancer.
- **Postman:** a collection with a test script on every request, covering the Settle routes and direct PayPal sandbox calls.
- **Render:** a `render.yaml` blueprint deploys the app; the live demo runs on it.

## Challenges we ran into
- The PayPal toolkit pins AI SDK v4, whose Google provider does not return Gemini 3 thought signatures. Tool calls failed on replay until we sent Google's documented skip value.
- The toolkit's create-invoice tool cannot set a due date, which the overdue chaser depends on, so we wrote our own.
- PayPal's list endpoint omits the pay link, so we rebuild it from the invoice id.
- Making the limit trustworthy: a prompt rule can be argued away, so the send tool re-reads the invoice from PayPal and enforces the limit itself.
- PayPal limits how often an invoice can be reminded, so we could not rehearse the chaser freely.
- Webhooks by Zapier is a premium app, so Zap A needs a paid plan or the trial.

## Accomplishments that we're proud of
The agent actually transacts, and the approval gate holds against the model even when it is told to ignore it. The full loop (job done, draft, gate, send, chase, paid, notify) works end to end in the sandbox, including a real sandbox payment and a Zapier email.

## What we learned
Put guardrails in tools, not prompts. Keep PayPal as the source of truth and the app stays small. Version pins in an SDK can quietly constrain the model you can use.

## Limits, said plainly
Sandbox only. There is no user login, so anyone with the demo URL can change the limit; the gate protects against the model, not against a person using the dashboard. The activity log and limit are in memory and reset on restart. Tone is a fixed rule by days overdue.

## What's next
User accounts and persistent storage, tone learned from each client's payment history, live-mode support behind explicit review, recurring invoices, and more triggers beyond Zapier.

## Built with
Next.js, TypeScript, React, Gemini, Vercel AI SDK, PayPal Invoicing API, PayPal Agent Toolkit, PayPal Webhooks, AG Grid, Zapier, Postman, Render, Tailwind CSS, Zod
