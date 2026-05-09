#!/usr/bin/env python3
"""End-to-end smoke test: onboard a yoga centre, add members, send due reminders.

Steps:
  1. Log in as a Saathpay **admin** (`admin_users`) — required to create an organisation.
  2. POST multipart `/api/v1/organisations` with dummy yoga-centre onboarding payload (2 org users, plan, UPI).
  3. Log in as the **organisation admin** user created in step 2.
  4. Create **two members** on the same WhatsApp test mobile (schema allows it): one with
     `next_due_date` = today, one = tomorrow. **Do not** set `join_date`, so the API’s
     `resolve_member_due` uses `next_due_date` (see `routers/organisations.py`).
     Each create also triggers a **preset welcome message** (see `MEMBER_WELCOME_*` / optional
     `TWILIO_WELCOME_WHATSAPP_CONTENT_SID` for WhatsApp templates / error 63016).
  5. POST `/api/v1/organisations/{org_id}/messages/send-due-reminders` — expect two WhatsApp
     sends (today + tomorrow templates) to that number if Twilio/sandbox allows.

Environment:
  TEST_API_BASE                  API root (default http://127.0.0.1:8000)
  TEST_SAATHPAY_ADMIN_USERNAME   Saathpay console admin username (required)
  TEST_SAATHPAY_ADMIN_PASSWORD   Saathpay console admin password (required)
  TEST_NEW_ORG_USER_PASSWORD     Password for both org users created at onboarding
                                   (default FlowTest123456)
  TEST_WHATSAPP_MOBILE           E.164 mobile for both reminder members
                                   (default +918606892615)
  TEST_ENABLE_SMS               true/false (default false) — sets org sms_enabled at onboarding
  MEMBER_WELCOME_ENABLED         true/false (default true) — welcome on member create
  TWILIO_WELCOME_WHATSAPP_CONTENT_SID   Optional approved WhatsApp template Content SID
  TWILIO_WELCOME_WHATSAPP_CONTENT_VARIABLES  Optional JSON string for template vars (see config.py)

Example:
  TEST_API_BASE=http://127.0.0.1:8001 \\
  TEST_SAATHPAY_ADMIN_USERNAME=your_admin \\
  TEST_SAATHPAY_ADMIN_PASSWORD=your_secret \\
  uv run python test.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parent
load_dotenv(_REPO_ROOT / ".env")

BASE = os.environ.get("TEST_API_BASE", "http://127.0.0.1:8000").rstrip("/")

ADMIN_USER = os.environ.get("TEST_SAATHPAY_ADMIN_USERNAME", "").strip()
ADMIN_PASSWORD = os.environ.get("TEST_SAATHPAY_ADMIN_PASSWORD", "").strip()
ORG_USERS_PASSWORD = os.environ.get("TEST_NEW_ORG_USER_PASSWORD", "FlowTest123456").strip()
WHATSAPP_MOBILE = os.environ.get("TEST_WHATSAPP_MOBILE", "+918606892615").strip()
ENABLE_SMS = os.environ.get("TEST_ENABLE_SMS", "false").strip().lower() in ("1", "true", "yes", "y", "on")


def _die(msg: str, code: int = 1) -> int:
    print(msg, file=sys.stderr, flush=True)
    return code


def _check(response: httpx.Response, step: str) -> dict[str, Any] | list[Any] | None:
    if response.status_code >= 400:
        print(f"\n[{step}] HTTP {response.status_code}", file=sys.stderr, flush=True)
        print(response.text, file=sys.stderr, flush=True)
        return None
    try:
        return response.json()
    except Exception:
        print(f"\n[{step}] non-JSON response:\n{response.text}", file=sys.stderr, flush=True)
        return None


def main() -> int:
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, OSError):
        pass

    if not ADMIN_USER or not ADMIN_PASSWORD:
        return _die(
            "Set TEST_SAATHPAY_ADMIN_USERNAME and TEST_SAATHPAY_ADMIN_PASSWORD "
            "(Saathpay admin_users credentials for POST /api/v1/organisations).",
        )

    suffix = uuid.uuid4().hex[:10]
    org_admin_username = f"yoga_owner_{suffix}"
    org_staff_username = f"yoga_frontdesk_{suffix}"
    # EmailStr rejects some TLDs (e.g. .test). Use a normal domain + unique local part.
    org_admin_email = f"yoga_owner_{suffix}@example.com"
    org_staff_email = f"yoga_staff_{suffix}@example.com"

    onboarding_payload: dict[str, Any] = {
        "name": f"Zen Flow Yoga Center (E2E {suffix})",
        "type": "Wellness",
        "custom_type": "Yoga studio",
        "address": "42 Lotus Lane, Bandra West, Mumbai 400050",
        "maps_url": "https://maps.example.com/?q=zen-flow-yoga-test",
        "upi_id": "zenflow.yoga@paytm",
        "upi_number": "919876543210",
        "whatsapp_enabled": True,
        "sms_enabled": ENABLE_SMS,
        "users": [
            {
                "full_name": "Ananya Iyer",
                "username": org_admin_username,
                "mobile": "+919811122233",
                "email": org_admin_email,
                "password": ORG_USERS_PASSWORD,
                "role": "admin",
            },
            {
                "full_name": "Vikram Menon",
                "username": org_staff_username,
                "mobile": "+919811122244",
                "email": org_staff_email,
                "password": ORG_USERS_PASSWORD,
                "role": "staff",
            },
        ],
        "plans": [
            {
                "name": "Monthly Unlimited",
                "amount": 1499.0,
                "billing_cycle": "monthly",
                "description": "E2E reminder test — monthly billing",
            },
        ],
    }

    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    with httpx.Client(base_url=BASE, timeout=180.0) as client:
        print("--- 1) Saathpay admin login ---")
        adm = client.post(
            "/api/v1/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
        )
        adm_j = _check(adm, "admin login")
        if not isinstance(adm_j, dict):
            return 1
        admin_token = adm_j["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        print("--- 2) Create organisation (onboarding) ---")
        raw_payload = json.dumps(onboarding_payload)
        cre = client.post(
            "/api/v1/organisations",
            headers=admin_headers,
            files={"payload": (None, raw_payload, "application/json")},
        )
        org_detail = _check(cre, "create organisation")
        if not isinstance(org_detail, dict):
            return 1

        org_id = str(org_detail["id"])
        plans = org_detail.get("plans") or []
        if not plans:
            return _die("Organisation created without plans — unexpected.")
        plan_id = str(plans[0]["id"])

        print(f"    organisation_id={org_id}")
        print(f"    org admin login identifier: {org_admin_email} (or username {org_admin_username})")
        print(
            f"    org channels: whatsapp_enabled={org_detail.get('whatsapp_enabled')} "
            f"sms_enabled={org_detail.get('sms_enabled')}"
        )
        if ENABLE_SMS and not org_detail.get("sms_enabled"):
            print(
                "    warning: TEST_ENABLE_SMS=true but org sms_enabled is still false. "
                "Did you apply migration 003_org_channel_toggles.sql to Supabase?",
                flush=True,
            )

        print("--- 3) Org user login (organisation admin) ---")
        usr = client.post(
            "/api/v1/users/login",
            json={"identifier": org_admin_email, "password": ORG_USERS_PASSWORD},
        )
        usr_j = _check(usr, "org user login")
        if not isinstance(usr_j, dict):
            return 1
        user_token = usr_j["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        print("--- 4) Create two members (same WhatsApp #, due today vs tomorrow) ---")
        members_spec = [
            ("Member Due Today (WA test)", today),
            ("Member Due Tomorrow (WA test)", tomorrow),
        ]
        for full_name, due_iso in members_spec:
            cm = client.post(
                f"/api/v1/organisations/{org_id}/members",
                headers=user_headers,
                json={
                    "full_name": full_name,
                    "mobile": WHATSAPP_MOBILE,
                    "plan_id": plan_id,
                    "next_due_date": due_iso,
                },
            )
            body = _check(cm, f"create member {full_name!r}")
            if body is None:
                return 1
            print(f"    created member id={body.get('id')} next_due_date={due_iso}")

        print("--- 4b) Messages log (expect 2 welcome sends from step 4) ---")
        ml = client.get(
            f"/api/v1/organisations/{org_id}/messages",
            headers=user_headers,
            params={"limit": 50, "page": 1},
        )
        if ml.status_code != 200:
            _check(ml, "list org messages")
            ml_j = None
        else:
            ml_j = ml.json()
        if isinstance(ml_j, dict):
            rows = ml_j.get("data") or []
            welcome_like = [
                r
                for r in rows
                if isinstance(r.get("body"), str) and "welcome" in r["body"].lower()
            ]
            print(f"    messages in first page: {len(rows)}")
            print(f"    bodies mentioning 'welcome': {len(welcome_like)}")
            sms_rows = [r for r in rows if r.get("channel") == "sms"]
            wa_rows = [r for r in rows if r.get("channel") == "whatsapp"]
            print(f"    channels in first page: whatsapp={len(wa_rows)} sms={len(sms_rows)}")
            if len(welcome_like) < 2:
                print(
                    "    tip: if <2, check MEMBER_WELCOME_ENABLED, Twilio creds, "
                    "or WhatsApp template env vars for error 63016.",
                    flush=True,
                )

        print("--- 5) Send due reminders (today + tomorrow buckets) ---")
        dr = client.post(
            f"/api/v1/organisations/{org_id}/messages/send-due-reminders",
            headers=user_headers,
        )
        dr_j = _check(dr, "send-due-reminders")
        if not isinstance(dr_j, dict):
            return 1

        print(json.dumps(dr_j, indent=2, default=str))

        due_today = dr_j.get("due_today") or {}
        due_tomorrow = dr_j.get("due_tomorrow") or {}
        t_sent = int(due_today.get("sent") or 0)
        m_sent = int(due_tomorrow.get("sent") or 0)
        t_fail = int(due_today.get("failed") or 0)
        m_fail = int(due_tomorrow.get("failed") or 0)

        print("\n--- Summary ---")
        print(f"  WhatsApp target (both members): {WHATSAPP_MOBILE}")
        print("  (step 4 also sent up to 2 welcome messages per MEMBER_WELCOME_ENABLED)")
        print(f"  due_today:    sent={t_sent} failed={t_fail}")
        print(f"  due_tomorrow: sent={m_sent} failed={m_fail}")
        if t_fail or m_fail:
            print(
                "  Some sends failed — check Twilio sandbox/opt-in, settings.messaging_enabled, "
                "and `results[].error` above.",
            )

        if dr.status_code != 200:
            return 1

        if t_sent < 1 or m_sent < 1:
            print(
                "\nExpected one successful send per bucket (today + tomorrow). "
                "Verify Twilio sandbox/opt-in, org UPI fields, and `results[].error` above.",
                file=sys.stderr,
                flush=True,
            )
            return 2

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
