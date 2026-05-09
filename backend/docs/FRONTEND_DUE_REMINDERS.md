# Due payment reminders (WhatsApp/SMS)

## Endpoint

`POST /api/v1/organisations/{org_id}/messages/send-due-reminders`

- **Auth:** Bearer JWT — Saathpay admin **or** organisation user (`kind=user`) whose token `organisation_id` matches `{org_id}` (staff and org admins both allowed).
- **Body:** none.

## Behaviour

1. Respects global **`settings.messaging_enabled`** — returns **403** `MESSAGING_DISABLED` if off.
2. Organisation must be **`active`** — otherwise **403** `ORG_PAUSED`.
3. Loads all members of the org with their **plan** (`billing_cycle`, `amount`).
4. For each member, computes a **due date**:
   - If **`join_date`** is set: `due = join_date + cycle_days`, where `cycle_days` is **30** (monthly), **90** (quarterly), or **365** (annual).
   - Else: Uses **`next_due_date`** from the member row.
   - Members **without a plan** are skipped (cannot compute cycle).
5. Two buckets:
   - **`due == today`** → sends the **“due today”** template (must include UPI — see below).
   - **`due == tomorrow`** → sends the **“due tomorrow”** template (no UPI required).

## UPI on organisation

Expose **`upi_id`** and **`upi_number`** on organisation create/update (`payload` JSON in multipart) and read them from **`GET /api/v1/organisations/{id}`**.

For **“due today”** rows, **at least one** of `upi_id` or `upi_number` must be set on the organisation. If **both** are empty, those rows are **not sent**; each appears in **`due_today.results`** with `success: false` and error **`UPI not configured for this organisation`**.

## Response shape

```json
{
  "organisation_id": "uuid",
  "due_today": {
    "sent": 0,
    "failed": 0,
    "results": [
      {
        "member_id": "uuid",
        "success": true,
        "channel": "whatsapp",
        "status": "queued",
        "twilio_sid": "...",
        "error": null
      }
    ]
  },
  "due_tomorrow": {
    "sent": 0,
    "failed": 0,
    "results": []
  }
}
```

Same **`BulkSendItem`** semantics as **`POST /messages/send-bulk`**.

## Template copy (fixed server-side)

- **Tomorrow:**  
  `Hello {member_name} your monthly fee payment of inr. {amount} for {organisation_name} is due tommorow, please make the payment accordingly!`

- **Today:**  
  `Hello {member_name} your monthly fee payment of inr. {amount} for {organisation_name} is due today, please make the payment to upi number {upi_number} or upi id : {upi_id}`

`{amount}` is formatted from the member’s **plan** amount (INR).

## Limitations (v1)

- **No idempotency:** clicking twice the same day can send twice.
- **First-cycle due only** when using `join_date + cycle_days` (not rolling monthly anniversaries for long-tenure members). Use **`next_due_date`** for manual alignment if needed.
