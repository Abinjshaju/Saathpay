# Saathpay Admin Console — Backend

FastAPI + Supabase backend for the Saathpay admin console. Twilio handles WhatsApp/SMS reminders. All 28 endpoints from the brief are implemented under `/api/v1`.

## Architecture (the short version)

- **Data layer**: the Supabase Python SDK is the *only* runtime data layer — used for both DB (PostgREST) and Storage. No direct Postgres connection at runtime.
- **Auth**: bcrypt-hashed admin users in `admin_users`, JWT (HS256) bearer tokens.
- **Atomic onboarding**: org + users + plans are inserted via the Postgres function `create_organisation_with_users_plans(payload jsonb)` so the whole thing runs in one DB transaction.
- **Logos**: a private `org-logos` bucket. `organisations.logo_url` stores the storage *path*; responses include a fresh signed URL.
- **CSV import**: two-step. Rows reference a plan by **`plan_name`** (not UUID); the server resolves to `plan_id`. Upload returns an `import_id` with a 15-minute TTL and a per-row validation report; a confirm call commits the cached rows. Frontend notes: [docs/FRONTEND_CSV_IMPORT.md](docs/FRONTEND_CSV_IMPORT.md).
- **Audit log**: every state-changing endpoint writes to the `logs` table via `services/log_service.log_event(...)`.
- **Errors**: every `HTTPException` returns `{ "detail": { "code": "<CODE>", "message": "<msg>" } }`.

## Layout

```
backend_saathpay/
├── main.py                   # FastAPI app factory + global handlers
├── config.py                 # Pydantic settings
├── database.py               # Supabase client (service-role)
├── auth/
│   ├── router.py             # POST /auth/login, POST /auth/logout
│   └── utils.py              # bcrypt + PyJWT + require_auth dep
├── routers/
│   ├── organisations.py      # 13 routes — onboarding + management
│   ├── members.py            # CSV template + global member PUT/DELETE
│   ├── messages.py           # /messages/send + /messages/send-bulk
│   ├── webhooks.py           # public Twilio status callback
│   ├── analytics.py          # summary + messages/cost timeseries
│   ├── settings.py           # GET/PUT singleton settings row
│   ├── logs.py               # list + CSV export
│   └── backup.py             # POST /backup → zip of CSVs
├── services/
│   ├── log_service.py
│   ├── storage_service.py    # upload + signed URL + delete
│   ├── csv_service.py        # parse / template / serialise
│   └── twilio_service.py     # send + fallback + signature validation
├── models/
│   └── schemas.py            # all Pydantic request/response models
├── middleware/
│   └── logging.py            # request-id + structured stdout logging
├── utils/
│   ├── errors.py             # ErrorCode enum + api_error helper
│   ├── pagination.py         # PageParams + page_params dep
│   └── period.py             # period shortcut → (start, end) datetimes
├── migrations/
│   ├── 001_init.sql          # all tables + indexes + RPCs + RLS
│   └── apply.py              # `python -m migrations.apply` (psycopg)
└── scripts/
    └── seed_admin.py         # `python -m scripts.seed_admin <u> <e> <p>`
```

## Setup (one-time)

1. **Install Python 3.14 + dependencies**:

   ```bash
   uv sync
   ```

2. **Configure secrets** — copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API)
   - `DATABASE_URL` (Supabase → Project Settings → Database → Connection string). Used only by the migration runner, never by the running app.
   - `JWT_SECRET` — generate with `uv run python -c "import secrets; print(secrets.token_urlsafe(64))"`
   - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (also editable at runtime via `PUT /api/v1/settings`)
   - `CORS_ALLOWED_ORIGINS` — comma-separated list of admin frontend origins

3. **Run migrations**:

   ```bash
   uv run python -m migrations.apply
   ```

   This is idempotent. Or paste `migrations/001_init.sql` into the Supabase SQL editor.

4. **Create the private `org-logos` storage bucket** (once):

   ```bash
   uv run python -c "
   import os; from dotenv import load_dotenv; load_dotenv('.env')
   from supabase import create_client
   sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
   sb.storage.create_bucket('org-logos', options={'public': False, 'file_size_limit': 2*1024*1024,
       'allowed_mime_types': ['image/jpeg','image/png','image/webp']})
   "
   ```

5. **Seed an initial admin user**:

   ```bash
   uv run python -m scripts.seed_admin admin admin@your.domain 'StrongPassword123' 'Saathpay Admin'
   ```

## Run

```bash
uv run uvicorn main:app --reload
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc:      <http://127.0.0.1:8000/redoc>
- Health:     <http://127.0.0.1:8000/health>

## Endpoints

All routes are under `/api/v1`. JWTs are either **Saathpay admin** (`kind=admin`, from `POST /auth/login`) or **organisation user** (`kind=user`, from `POST /users/login`). See [docs/FRONTEND_USER_AUTH.md](docs/FRONTEND_USER_AUTH.md) for scope rules.

Public (no JWT): `POST /auth/login`, `POST /users/login`, `POST /webhooks/twilio`, `GET /members/csv-template`, `GET /health`.

| Group         | Method | Path |
|---------------|--------|------|
| Auth (Saathpay) | POST | `/auth/login` |
|               | POST   | `/auth/logout` *(requires admin JWT)* |
| Users (org app) | POST | `/users/login` |
|               | POST   | `/users/logout` |
|               | GET    | `/users/me` |
|               | POST   | `/users/me/password` |
| Organisations | POST   | `/organisations`  *(multipart: `payload` JSON form field + optional `logo` file)* |
|               | GET    | `/organisations`  *(filters: status, search, page, limit)* |
|               | GET    | `/organisations/{id}` |
|               | PUT    | `/organisations/{id}`  *(multipart, partial)* |
|               | PATCH  | `/organisations/{id}/status`  *(active\|paused)* |
|               | DELETE | `/organisations/{id}?export=true`  *(zip on export)* |
|               | GET    | `/organisations/{id}/members` |
|               | GET    | `/organisations/{id}/messages` |
|               | POST   | `/organisations/{id}/members` |
|               | POST   | `/organisations/{id}/members/import`  *(multipart `file`; returns `{import_id, valid_rows, errors}`)* |
|               | POST   | `/organisations/{id}/members/import/{import_id}/confirm` |
|               | POST   | `/organisations/{id}/messages/send-due-reminders` *(due today / tomorrow templates)* |
| Members       | GET    | `/members/csv-template` |
|               | PUT    | `/members/{id}` |
|               | DELETE | `/members/{id}` |
| Messaging     | POST   | `/messages/send` |
|               | POST   | `/messages/send-bulk` |
|               | POST   | `/webhooks/twilio`  *(public — Twilio signature)* |
| Analytics     | GET    | `/analytics/summary` |
|               | GET    | `/analytics/messages` |
|               | GET    | `/analytics/cost` |
| Settings      | GET    | `/settings`  *(masks `twilio_auth_token`)* |
|               | PUT    | `/settings`  *(validates Twilio creds before save)* |
| Logs / Backup | GET    | `/logs` |
|               | GET    | `/logs/export` |
|               | POST   | `/backup` |

### Onboarding multipart contract

`POST /organisations` and `PUT /organisations/{id}` are multipart requests with two fields:

- `payload` — string form field containing JSON (see `OrganisationCreateForm` / `OrganisationUpdate`)
- `logo` — optional file upload (image/jpeg, image/png, image/webp; max 2 MB)

The frontend should submit the JSON as a stringified `payload` form field, not as a JSON body.

### Members CSV import (`plan_name`)

Template headers: **`full_name`**, **`mobile`**, **`email`** (optional), **`plan_name`**, **`join_date`**, **`next_due_date`**.

- **`plan_name`** must match one of this organisation’s plans (case-insensitive trim). The database still stores `plan_id`; matching happens on the server.
- **Single-member API** `POST /organisations/{id}/members` still expects **`plan_id`** (UUID) — only the bulk CSV format uses **`plan_name`**.

See **[docs/FRONTEND_CSV_IMPORT.md](docs/FRONTEND_CSV_IMPORT.md)** for CSV import, **[docs/FRONTEND_DUE_REMINDERS.md](docs/FRONTEND_DUE_REMINDERS.md)** for payment reminders, and **[docs/FRONTEND_USER_AUTH.md](docs/FRONTEND_USER_AUTH.md)** for organisation user login.

## Error envelope

Every user-facing error follows the same shape:

```json
{
  "detail": {
    "code": "PLAN_IN_USE",
    "message": "cannot remove plans that have members assigned"
  }
}
```

The full enum lives in `utils/errors.py` (`ORG_NOT_FOUND`, `MEMBER_NOT_FOUND`, `PLAN_IN_USE`, `MESSAGING_DISABLED`, `ORG_PAUSED`, `PLAN_LIMIT_EXCEEDED`, `USER_MIN_REQUIRED`, `INVALID_CREDENTIALS`, `IMPORT_EXPIRED`, `IMPORT_NOT_FOUND`, `INTERNAL_ERROR`, …).

## Things to be aware of

- **`twilio_auth_token` is never echoed in plaintext** — `GET /settings` returns `twilio_auth_token_masked: '••••••••'` if set; `PUT /settings` accepts a write-only `twilio_auth_token` and validates it against Twilio before saving.
- **`POST /webhooks/twilio` is public** but verifies `X-Twilio-Signature` against the saved auth token. It always returns `200` so Twilio doesn't retry; signature failures are logged.
- **The messaging kill switch** (`settings.messaging_enabled`) is enforced at the start of `/messages/send` and `/messages/send-bulk`. Pausing an organisation is enforced separately in `services/twilio_service.send_with_fallback`.
- **Two-step CSV import** has a 15-minute TTL — re-upload after that. Confirmation can also be triggered by the legacy `POST .../members/import?confirm=true` (returns the post-confirm result directly).
- **Backups exclude sensitive columns** — `password_hash` is omitted from `users.csv`, `twilio_auth_token` is omitted from `settings.csv`.

## Quick smoke test

```bash
# in one terminal
uv run uvicorn main:app --reload --port 8001

# in another terminal — log in and list orgs
TOKEN=$(curl -s -X POST http://127.0.0.1:8001/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"StrongPassword123"}' | jq -r .access_token)
curl -s http://127.0.0.1:8001/api/v1/organisations -H "authorization: Bearer $TOKEN" | jq
```

## Security notes

- `.env` is gitignored. Never commit it.
- The Postgres password and Supabase service-role key give full DB access. Rotate them in the Supabase dashboard if they ever leak.
- For production deploys, set `CORS_ALLOWED_ORIGINS` to the exact admin frontend origin(s); never `*`.
