# Demo video script (target 2:40, hard limit 3:00)

Screen recording plus voiceover. Browser at 1440x900, zoom 100%. No music, no third-party logos on screen (close other tabs, hide bookmarks; the PayPal sandbox checkout is shown only briefly, which is fine).

## Pre-recording checklist

- [ ] `npm run seed -- --reset` then `npm run seed` for a clean set (2 overdue, 2 open, 2 paid, 1 draft over 500).
- [ ] Restart the app so the activity feed is empty and the limit is back to 500; confirm the header says "Agent may send up to $500".
- [ ] `/api/health` shows paypal and ai true; no "Setup needed" banner.
- [ ] Sandbox buyer (personal) account email and password ready, tested once. Have the pay link flow warmed up in a second window, logged out.
- [ ] `ZAPIER_HOOK_SECRET` set; your job Zap, or the Automations page test button, tested once.
- [ ] Do a dry run of both chat prompts so you know the model responds; then reset (the invoices you create stay in PayPal, so use client names you have not used yet, or cancel the dry-run ones).
- [ ] Notifications off, clean desktop, mic check, 1440x900 capture.

## Shots

| Time | On screen | Say (one sentence) |
|---|---|---|
| 0:00-0:10 | Title card or the dashboard, nothing moving | "Freelancers lose hours writing invoices and even more chasing them, so most just wait: Settle is an agent that does the whole collections loop." |
| 0:10-0:30 | Dashboard with seed data: stat tiles, AG Grid with the two overdue rows, the draft, the paid rows. Hover the Next action column. | "This is PayPal sandbox data in an AG Grid table, and each row shows what the agent plans to do next." |
| 0:30-1:00 | Chat. Type: `Invoice Acme Co (billing@acme.test) $450 for logo design, due in 14 days`. Tool chips run; new SENT row appears. | "Under my $500 limit the agent drafts and sends a real PayPal invoice without asking." |
| 1:00-1:35 | Chat. Type: `Invoice Juniper Films (accounts@juniper-films.test) $1,800 for a brand video edit, due in 30 days`. Agent says it is held; DRAFT row appears; activity feed shows "Held ... over the 500 auto-send limit". Click Approve & send on that row. | "Over the limit the send tool itself refuses, so the invoice waits as a draft until I approve it with one click." |
| 1:35-1:55 | Click Chase overdue (or type `Chase everything that is overdue`). Show the summary and the two "reminded" entries. | "For overdue invoices it picks the tone by age, friendly at five days and a final notice at twenty-five, and sends through PayPal." |
| 1:55-2:20 | Open a SENT invoice's pay link in a new window, log in as the sandbox buyer, pay. Switch back; within 10 seconds the row flips to PAID and the feed logs it. | "When the client pays in the sandbox, the row flips to Paid, and PayPal's webhook or polling tells Settle." |
| 2:20-2:30 | Automations page (or Zapier editor showing the Webhooks POST step). Click the test job button, or trigger the Zap; a new invoice row appears. | "A Zapier hook can create an invoice when a job is marked done in the tool I already use." |
| 2:30-2:40 | Zapier Slack or Sheets row from the paid hook, or the activity feed line "paid". | "And another hook tells me when the money lands." |
| 2:40-2:50 | Dashboard, stat tiles updated. Overlay text list, no logos needed. | "Built with Next.js, Gemini through the Vercel AI SDK, the PayPal Agent Toolkit and Invoicing API, AG Grid, Zapier, Postman, and Render." |

If you run long, cut the shot at 2:30-2:40 first, then shorten the chase shot.

## Exact prompts

1. `Invoice Acme Co (billing@acme.test) $450 for logo design, due in 14 days`
2. `Invoice Juniper Films (accounts@juniper-films.test) $1,800 for a brand video edit, due in 30 days`
3. `Chase everything that is overdue`
4. Optional if time: `Who owes me the most?`
