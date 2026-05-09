# Organisation user auth (client app)

Organisation staff/admins live in the **`users`** table (not `admin_users`). They authenticate with the same JWT mechanism as Saathpay console admins, but tokens include **`kind": "user"`** and **`organisation_id`**.

## Login

`POST /api/v1/users/login`

```json
{ "identifier": "alice_yoga", "password": "secret" }
```

`identifier` can be **username** or **email** (exact match).

**Response:**

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "full_name": "...",
    "username": "...",
    "email": "...",
    "role": "admin",
    "organisation_id": "...",
    "organisation": {
      "id": "...",
      "name": "...",
      "status": "active",
      "upi_id": "...",
      "upi_number": "..."
    }
  }
}
```

Store **`access_token`** and send on every request:

`Authorization: Bearer <access_token>`

## Logout / Me / Password

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/v1/users/logout` | Stateless; requires **`kind=user`** token |
| GET | `/api/v1/users/me` | Refresh profile + org snippet |
| POST | `/api/v1/users/me/password` | Body: `{ "current_password": "...", "new_password": "..." }` (min 6 chars) |

Saathpay console tokens (`POST /auth/login`) must **not** call `/users/logout` — use **`POST /auth/logout`** instead (requires **`kind=admin`**).

## JWT claims

| Claim | Saathpay admin | Org user |
|-------|----------------|----------|
| `kind` | `"admin"` | `"user"` |
| `sub` | admin user id | org user id |
| `role` | `superadmin` | `admin` or `staff` |
| `organisation_id` | omitted | org UUID |

Older admin tokens without `kind` are treated as **`admin`**.

## What org users can call

### Any org role (`admin` or `staff`)

- `GET /api/v1/organisations/{org_id}` — only if `{org_id}` matches JWT `organisation_id`
- `GET /api/v1/organisations/{org_id}/members`
- `GET /api/v1/organisations/{org_id}/messages`
- `POST /api/v1/organisations/{org_id}/messages/send-due-reminders`

### Org **`role=admin` only**

- `POST /api/v1/organisations/{org_id}/members`
- `POST /api/v1/organisations/{org_id}/members/import` (+ confirm)
- `PUT /api/v1/members/{member_id}`
- `DELETE /api/v1/members/{member_id}`
- `POST /api/v1/messages/send`
- `POST /api/v1/messages/send-bulk`

Staff tokens receive **403** `organisation admin role required` on those routes.

### Saathpay admin only (`kind=admin`)

Global operations: list/create/delete organisations, pause/resume, full `PUT /organisations/{id}`, analytics, settings, logs, backup. Org users always get **403** on these.

## Public (no JWT)

- `GET /api/v1/members/csv-template`
- `POST /api/v1/auth/login`, `POST /api/v1/users/login`
- `POST /api/v1/webhooks/twilio`

## Swagger / OAuth2

The built-in OAuth2 token URL points at **`/auth/login`**. To test org users in Swagger, use **Authorize** with a token obtained from **`/users/login`** (paste manually).
