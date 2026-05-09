# Members CSV import — frontend integration

## Column change (`plan_id` → `plan_name`)

The **`GET /api/v1/members/csv-template`** endpoint and **`POST /api/v1/organisations/{org_id}/members/import`** validation now expect a **`plan_name`** column instead of **`plan_id`**.

| Before | After |
|--------|--------|
| `full_name,mobile,email,plan_id,join_date,next_due_date` | `full_name,mobile,email,plan_name,join_date,next_due_date` |

Rows are matched to plans **case-insensitively** after trimming whitespace (e.g. `"Monthly"` and `"monthly"` match the same plan).

Backend still stores **`plan_id`** in `members`; the API resolves **`plan_name` → `plan_id`** during import using this organisation’s plans list.

### What you should update in the UI

1. **Download / display template** — use the headers from **`GET /api/v1/members/csv-template`** (`X-CSV-Headers` mirrors the same order) or hard-code the six columns above with **`plan_name`**.
2. **Help copy / placeholders** — tell admins to paste the **exact plan name** shown on the organisation’s plans screen (same label as **`plans[].name`** from **`GET /api/v1/organisations/{id}`**).
3. **Validate locally (optional)** — compare entered names against the plans list already loaded for that org before upload to reduce failed rows.
4. **Legacy CSVs** — spreadsheets using **`plan_id`** (UUID) will fail validation (“missing required column **`plan_name`**”). Users must replace that column with human-readable **`plan_name`** values.

### Duplicate plan names

If two plans on the **same organisation** share the **same effective name** (same characters after trim + lowercasing), the backend treats that row as invalid with a clear error: import requires **unique plan names per organisation** for CSV matching.

### Unchanged APIs

- **`POST /api/v1/organisations/{org_id}/members`** (single member create) — still accepts **`plan_id`** (UUID) in JSON body — unchanged.
- **`PUT /api/v1/members/{id}`** — still uses **`plan_id`** when updating the member’s plan — unchanged.

Only the **CSV file format** switched to **`plan_name`**.

### Who may import CSV

Bulk member import (`POST .../members/import` and confirm) requires an **organisation admin** JWT (`kind=user` and `role=admin`) or a **Saathpay admin** JWT. **Staff** users get **403**.

### Flow (unchanged)

1. **`POST .../members/import`** with multipart field **`file`** containing the CSV → preview with **`import_id`**, **`errors`** per row.
2. **`POST .../members/import/{import_id}/confirm`** → inserts validated rows (~15 min TTL on **`import_id`**).
