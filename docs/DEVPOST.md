# Devpost submission draft

## Name
Settle

## Tagline
The get-paid agent for freelancers: it drafts, sends and chases PayPal invoices, and asks before it moves real money.

## Inspiration
Freelancers finish the work, then lose hours writing invoices and more hours chasing late payments. Chasing is awkward, so many just wait. We wanted an agent that does the whole collections loop, not a chatbot that only suggests what to do.

## What it does
You type "Invoice Acme $450 for logo design" or a Zapier hook reports a finished job. Settle drafts a PayPal invoice and sends it if the amount is under a limit you set. Anything above the limit stays a draft until you approve it with one click. Overdue invoices get reminders through PayPal, with tone chosen by age: friendly, firm or final notice. When an invoice is paid, the dashboard updates and a Zapier hook notifies you. You can also ask "who owes me the most?" and get an answer from live PayPal data. Everything runs on the PayPal sandbox.

## How we built it
One Next.js 16 and TypeScript app. Gemini, through the Vercel AI SDK, calls PayPal Agent Toolkit tools (list, get, reminders, cancel, QR code, transactions) plus two tools we wrote: create and a gated send. Invoices live in PayPal, so there is no database. The dashboard is an AG Grid table. Paid events arrive by polling or a signature-verified PayPal webhook. Zapier provides an inbound job hook and an outbound paid hook. A Postman collection covers every route and direct sandbox calls, and a Render blueprint deploys it.

## Challenges we ran into
- The PayPal toolkit pins AI SDK v4, whose Google provider does not return Gemini 3 thought signatures. Tool calls failed on replay until we sent Google's documented skip value.
- The toolkit's create-invoice tool cannot set a due date, which the overdue chaser depends on, so we wrote our own.
- PayPal's list endpoint omits the pay link, so we rebuild it from the invoice id.
- Making the limit trustworthy: a prompt rule can be argued away, so the send tool re-reads the invoice and enforces the limit itself.
- Seeding realistic overdue invoices needed past invoice and due dates; the sandbox accepted them.

## Accomplishments that we're proud of
The agent actually transacts, and the approval gate holds even if the model is told to ignore it. The full loop (draft, approve, send, chase, paid, notify) works end to end in the sandbox and fits in a three-minute demo.

## What we learned
Put guardrails in tools, not prompts. Keep PayPal as the source of truth and the app stays small. Version pins in an SDK can quietly constrain the model you can use.

## What's next
Persistent storage for the activity log and settings, user accounts and per-client history for tone, live-mode support behind explicit review, recurring invoices, and more triggers beyond Zapier.

## Built with
Next.js, TypeScript, React, Gemini, Vercel AI SDK, PayPal Invoicing API, PayPal Agent Toolkit, PayPal Webhooks, AG Grid, Zapier, Postman, Render, Tailwind CSS, Zod
