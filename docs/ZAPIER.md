# Zapier setup

Countersign uses two Zaps, both live and tested on the demo. The Zapier table name "Settle Jobs" and the header `x-settle-secret` keep the project's working name. Webhooks by Zapier is a premium Zapier app: it needs a paid plan or works on the 14-day trial.

| Zap | Direction | Needs a public URL? |
|---|---|---|
| A. Job done -> Countersign invoice | Zapier calls Countersign (`POST /api/jobs`) | Yes. Use your Render URL (or a tunnel). |
| B. Invoice paid -> notification | Countersign calls Zapier (`ZAPIER_PAID_HOOK_URL`) | No. Works from localhost. |

Set `ZAPIER_HOOK_SECRET` in your environment first (any long random string). Countersign returns 503 if it is unset.

## Zap A: job marked done creates and sends an invoice

1. Trigger: a Zapier Table named "Settle Jobs" with fields `client_name`, `client_email`, `description`, `amount`, `due_days` and `Status`. Use the Tables trigger for an updated record, then add a Filter step: continue only if `Status` is exactly `Done`. Mark a row Done and the Zap runs.
   - Alternatives, one line each: Google Sheets "New or Updated Spreadsheet Row" with the same columns, or Trello "Card Moved to List" (list = Done, card title to `description`).
2. Action: "Webhooks by Zapier", event "POST".
   - URL: `https://<your-app>.onrender.com/api/jobs`
   - Payload Type: `json`
   - Data (map from your trigger):

     | Field | Required | Notes |
     |---|---|---|
     | `client_name` | yes | |
     | `client_email` | yes | valid email |
     | `amount` | yes | number above 0 (strings like "1200" are accepted) |
     | `description` | yes | what is being billed |
     | `due_days` | no | 0 to 120, default 14 |
     | `currency` | no | 3 letters, default USD |

   - Headers: `x-settle-secret` = the value of `ZAPIER_HOOK_SECRET`.
3. Test the action. Expected: `{"ok":true,"summary":"..."}`. A 401 means the secret does not match; a 400 lists the invalid fields.
4. Turn the Zap on. Jobs from Zapier go through the same mandate as the chat. An invoice outside it (over the per-invoice limit, over the daily cap, and so on) stays a draft for approval in the dashboard, and every attempt appears in the Audit trail with the actor "Zapier".

The same call from a terminal:

```bash
curl -X POST "$APP/api/jobs" -H "Content-Type: application/json" -H "x-settle-secret: $ZAPIER_HOOK_SECRET" \
  -d '{"client_name":"Acme Co","client_email":"billing@acme.test","amount":300,"description":"Logo design","due_days":14}'
```

## Zap B: invoice paid triggers a notification

1. Trigger: "Webhooks by Zapier", event "Catch Hook". Copy the Custom Webhook URL (`https://hooks.zapier.com/hooks/catch/...`).
2. Put that URL in `ZAPIER_PAID_HOOK_URL` (`.env.local` locally, or the Render dashboard) and restart.
3. Make Countersign send one sample: pay a sandbox invoice (see the README, "Run it locally"), or open the dashboard after paying. Back in Zapier, click "Test trigger" and pick the request.
4. Action: "Email by Zapier" is what the demo uses (to the freelancer, with `text` as the body). Others work too, for example Slack "Send Channel Message" with `text`, Gmail "Send Email", or Google Sheets "Create Spreadsheet Row".

Payload Countersign POSTs (JSON, from `lib/paid.ts` and `lib/zapier.ts`):

```json
{
  "event": "invoice.paid",
  "invoiceId": "INV2-XXXX-XXXX-XXXX-XXXX",
  "number": "0006",
  "client": "Northwind Studio",
  "amount": 1200,
  "currency": "USD",
  "text": "Northwind Studio paid 0006, USD 1200"
}
```

It fires once per invoice, when Countersign first sees it become PAID (dashboard polling every 10 seconds, or the PayPal webhook). A failed call is logged in the activity feed as "Zapier notification failed" and does not break anything. Call timeout is 5 seconds. Zapier's trial limits emails per day, so avoid "Send test event" loops.
