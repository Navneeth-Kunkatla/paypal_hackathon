# Settle

Demo video: [ADD YOUTUBE LINK]
Live demo: https://settle-8njj.onrender.com (free tier: the first load can take about a minute)

Freelancers finish the work, then lose hours writing invoices and chasing late payments. Chasing is awkward, so many just wait. Settle is an agent that runs the whole collections loop and actually transacts: it drafts a PayPal invoice from a plain sentence or a "job done" event, sends it within a spending limit you set, holds anything bigger for one-click approval, chases overdue invoices with the right tone, and tells you when you are paid. Everything runs against the PayPal sandbox.

## What it does

The loop: job done -> draft -> approval gate -> send -> chase -> paid -> notify.

1. **Job done.** Type "Invoice Acme $450 for logo design" in the chat, or let a Zapier Zap post a finished job to `POST /api/jobs`.
2. **Draft.** Gemini calls tools to create a PayPal invoice (client, line item, amount, due date).
3. **Approval gate.** "Agent may send up to $X without asking" (default 500). At or under the limit the invoice is sent. Over it, the invoice stays a draft and the dashboard shows it waiting for your approval.
4. **Send.** PayPal issues the invoice; the grid links the pay page.
5. **Chase.** Overdue invoices get a reminder through PayPal, tone chosen by age (1-7 days friendly, 8-21 firm, over 21 final notice). Trigger it with the chase route or by asking the chat.
6. **Paid.** Settle notices the PAID status (dashboard polling, or PayPal's webhook), updates the grid and logs it.
7. **Notify.** Settle calls your Zapier Catch Hook so Slack, email or a spreadsheet row can follow.

**Clients page.** `/clients` rolls invoices up per client (billed, paid, outstanding, overdue, rating) with a one-click agent summary of who to chase first.

**Ask your money.** The chat answers from live PayPal data: "Who owes me the most?", "What is overdue?".

## How PayPal is used

All calls go to `https://api-m.sandbox.paypal.com` with OAuth client credentials. Sandbox only.

- **Invoicing v2 REST:** create, send, remind, cancel, QR code, list and get invoices. Settle's own client (`lib/paypal.ts`) does create, get, list, send and remind. Cancel and QR code reach the agent through the toolkit.
- **PayPal Agent Toolkit** (`@paypal/agent-toolkit`, AI SDK adapter), enabled in `lib/agent.ts`: invoice `create`, `get`, `list`, `sendReminder`, `cancel`, `generateQRC`, and transactions `list`. The toolkit's `send_invoice` is removed and its create tool is replaced by Settle's own (see Limitations).
- **Webhook:** `POST /api/webhooks/paypal` verifies the signature with PayPal's `verify-webhook-signature` endpoint before acting on `INVOICING.INVOICE.PAID`. It returns 503 until `PAYPAL_WEBHOOK_ID` is set.

## How AI is used

- **Gemini via the Vercel AI SDK** (`ai` v4, `@ai-sdk/google`), default model `gemini-3.5-flash-lite`, multi-step tool calling (up to 8 steps per request).
- **Guardrail in the tool, not the prompt.** The only `send_invoice` the model can call re-reads the invoice from PayPal, compares the amount with the current limit and refuses to send if it is over. A prompt can be argued with; the tool still says no. Held invoices are logged as "blocked".
- **Tone by age.** The system prompt maps days overdue to friendly, firm or final notice; the dashboard shows the planned next action using the same thresholds.
- The same agent serves the chat, the Zapier job route and the chase route.

## Sponsor tools

- **AG Grid:** the invoice table (`components/InvoiceGrid.tsx`) with status, days overdue, next action and per-row actions.
- **Zapier:** inbound job-complete hook (`POST /api/jobs`, shared-secret header) and outbound paid hook. See [docs/ZAPIER.md](docs/ZAPIER.md).
- **Postman:** [postman/](postman/) holds a collection covering every Settle route plus direct PayPal sandbox calls, and a local environment.
- **Render:** deploy with [render.yaml](render.yaml).

## Architecture

```
 Zapier --POST /api/jobs--> +---------------------------+     +------------------------+
 Browser (AG Grid + chat) ->|  Next.js app (one deploy) |---->| PayPal sandbox         |
        ^  polls every 10s  |  API routes + Gemini agent|<----| Invoicing v2 + webhook |
        +-------------------|  in-memory activity log   |     +------------------------+
                            +---------------------------+--POST--> Zapier Catch Hook
```

PayPal is the source of truth for invoices; there is no database.

| Path | Purpose |
|---|---|
| `app/page.tsx` | Dashboard: stat tiles, invoice grid, chat, activity feed, limit control |
| `app/api/*` | Route handlers (table below) |
| `components/` | `InvoiceGrid`, `ChatPanel`, `ActivityFeed`, `StatTiles` |
| `lib/agent.ts` | Toolkit setup, gated `send_invoice`, own `create_invoice`, system prompt |
| `lib/paypal.ts` | Sandbox REST client and invoice mapping |
| `lib/paid.ts`, `lib/zapier.ts` | Paid detection (fires once per invoice) and the outbound hook |
| `lib/store.ts` | In-memory settings and activity log |
| `scripts/seed.mjs` | Demo data seeder |
| `postman/` | Collection and environment |
| `docs/` | Zapier guide, demo script, Devpost draft |

## Run it locally

Requires Node 20.9 or newer (developed on Node 26) and npm.

```bash
git clone <this repo> && cd paypal_hackathon
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
```

Fill in `.env.local`:

1. **PayPal sandbox keys.** At https://developer.paypal.com/dashboard/ open Apps & Credentials, Sandbox, create an app (or use the default one) and copy Client ID and Secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. The app must have the **Invoicing** feature enabled; without it the invoice calls fail with 401/403.
2. **Gemini key.** Free at https://aistudio.google.com/apikey, into `GOOGLE_GENERATIVE_AI_API_KEY`.
3. Optional: `ZAPIER_HOOK_SECRET` (needed for `/api/jobs`), `PAYPAL_WEBHOOK_ID`, `ZAPIER_PAID_HOOK_URL`.

Then:

```bash
npm run dev
npm run seed        # creates 7 demo invoices in your sandbox, sends no email
```

Open http://localhost:3000. A "Setup needed" banner appears if a key is missing or wrong. `npm run seed -- --dry-run` previews; `npm run seed -- --reset` cancels or deletes only invoices tagged `settle-seed-*`. Re-running the seed skips invoices that already exist.

The seed creates 2 overdue invoices (about 5 and 25 days), 2 sent and not yet due, 2 paid, and 1 draft over 500 USD. Clients are fictional `.test` addresses.

## Try it

1. **Under the limit.** In the chat, click the first starter or type `Invoice Acme Co (billing@acme.test) $450 for logo design, due in 14 days`. Tool chips run, then the invoice appears as SENT.
2. **Over the limit.** Type `Invoice Juniper Films (accounts@juniper-films.test) $1,800 for a brand video edit, due in 30 days`. The agent says it is waiting for approval and the grid shows a DRAFT. Approve it from its row. Change "Agent may send up to" in the header to move the line.
3. **Chase overdue.** Click Chase overdue above the grid, or type `Chase everything that is overdue`. The 5-day invoice gets a friendly note, the 25-day one a final notice; the activity feed logs each reminder.
4. **Get paid.** Open a SENT invoice's pay link, log in at the sandbox checkout with a sandbox *personal* (buyer) account from the developer dashboard (Testing Tools, Sandbox Accounts), and pay. Within about 10 seconds the row flips to PAID and the activity feed logs it (instantly if the webhook is configured).
5. **Zapier job route.**
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" -H "x-settle-secret: <your ZAPIER_HOOK_SECRET>" \
     -d '{"client_name":"Acme Co","client_email":"billing@acme.test","amount":300,"description":"Logo design","due_days":14}'
   ```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PAYPAL_CLIENT_ID` | yes | PayPal sandbox app client ID |
| `PAYPAL_CLIENT_SECRET` | yes | PayPal sandbox app secret |
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini API key |
| `AI_MODEL` | no | Gemini model id, default `gemini-3.5-flash-lite` |
| `AUTO_SEND_LIMIT` | no | Starting auto-send limit, default `500` (editable in the UI, resets on restart) |
| `PAYPAL_WEBHOOK_ID` | no | Enables `/api/webhooks/paypal` |
| `ZAPIER_HOOK_SECRET` | for `/api/jobs` | Value Zapier sends as `x-settle-secret` |
| `ZAPIER_PAID_HOOK_URL` | no | Zapier Catch Hook called when an invoice is paid |

## API

| Route | Method | What it does |
|---|---|---|
| `/api/health` | GET | PayPal auth and Gemini key check |
| `/api/invoices` | GET | List invoices (also detects newly paid ones) |
| `/api/invoices/[id]` | GET | One invoice, used by the detail drawer (pay link, QR code) |
| `/api/invoices/[id]/send` | POST | Human approval: send a draft |
| `/api/invoices/[id]/remind` | POST | Send a PayPal reminder |
| `/api/invoices/[id]/cancel` | POST | Cancel an invoice |
| `/api/clients` | GET | Per-client roll-up of PayPal invoices: billed, paid, outstanding, overdue, rating |
| `/api/clients/summary` | POST | One Gemini call: who to chase first, who is reliable (no tools) |
| `/api/activity` | GET | Activity log, newest first |
| `/api/settings` | GET, PUT | Read or set `{ "autoSendLimit": number }` |
| `/api/chat` | POST | Agent chat (AI SDK data stream) |
| `/api/chase` | POST | Agent reminds every overdue invoice |
| `/api/jobs` | POST | Zapier inbound: create and send an invoice (header `x-settle-secret`) |
| `/api/automations` | GET | Automation status for the `/automations` page |
| `/api/automations/test-job` | POST | Fire a sample job through the job flow |
| `/api/automations/test-paid` | POST | Fire a sample paid notification |
| `/api/webhooks/paypal` | POST | PayPal webhook, signature verified |

Errors return non-2xx with `{ "error": string }`.

## Zapier setup

1. Set `ZAPIER_HOOK_SECRET`.
2. Zap A: your trigger (Sheets row Status = Done, Trello card moved to Done) -> Webhooks by Zapier POST to `https://<app>/api/jobs` with the `x-settle-secret` header. Needs a public URL.
3. Zap B: Webhooks by Zapier Catch Hook -> Slack, Gmail or Sheets. Put the hook URL in `ZAPIER_PAID_HOOK_URL`. Works from localhost.

Full steps and payload fields: [docs/ZAPIER.md](docs/ZAPIER.md).

## PayPal webhook setup

1. Needs a public URL (your Render URL, or a tunnel to localhost).
2. Developer dashboard -> your sandbox app -> Webhooks -> Add webhook. URL `https://<app>/api/webhooks/paypal`, event `INVOICING.INVOICE.PAID`.
3. Copy the Webhook ID into `PAYPAL_WEBHOOK_ID` and restart. Without a webhook, dashboard polling still detects payments.

## Postman

1. Postman -> Import -> select `postman/Settle.postman_collection.json` and `postman/Settle.local.postman_environment.json`.
2. Choose the "Settle local" environment. Set `baseUrl` (local or your Render URL), `settleSecret` (same as `ZAPIER_HOOK_SECRET`) and, for the direct PayPal folder, `paypalClientId` and `paypalClientSecret`. Do not share an export that contains secrets.
3. Run "Health", then "List invoices", then copy an invoice id into `invoiceId` for send and remind. In "PayPal Sandbox (direct)" run "Get OAuth token" first. The Collection Runner works too.

## Deploy to Render

1. Push the repo to GitHub.
2. Render -> New -> Blueprint -> pick the repo. [render.yaml](render.yaml) defines one free Node web service (build `npm ci && npm run build`, start `npm run start`, health check `/api/health`, Node 22).
3. Enter the secret values when prompted (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`, `PAYPAL_WEBHOOK_ID`, `ZAPIER_HOOK_SECRET`, `ZAPIER_PAID_HOOK_URL`). Leave optional ones blank.
4. `next start` binds to the `PORT` Render provides. After deploy, point the PayPal webhook and Zap A at the new URL. Free instances sleep when idle, so the first request is slow.

## Limitations

- Sandbox only. There is no live-mode switch.
- The activity log and the auto-send limit live in memory and reset on restart. Invoices live in PayPal and persist.
- Single user, no authentication. Do not deploy with live credentials; anyone with the URL can use the agent.
- The free Gemini tier is rate limited; chat, chase and jobs can fail with a quota error under load.
- Workarounds in the code: the PayPal toolkit pins AI SDK v4, whose Google provider does not round-trip Gemini 3 thought signatures, so `lib/agent.ts` sends Google's documented skip value. The toolkit's create tool cannot set a due date, so Settle supplies its own. PayPal's list endpoint omits the pay link, so `lib/paypal.ts` builds it from the invoice id.
- Paid detection by polling only fires for invoices first seen as unpaid.

## License

Apache-2.0, see [LICENSE](LICENSE).
