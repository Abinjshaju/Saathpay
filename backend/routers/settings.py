"""Settings endpoints — single-row table; auth_token never echoed in plaintext."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from supabase import Client

from auth.utils import require_admin
from database import get_db
from models.schemas import SettingsRead, SettingsUpdate
from services.log_service import log_event
from services.twilio_service import validate_account
from utils.errors import ErrorCode, api_error

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_read(row: dict[str, Any]) -> SettingsRead:
    masked = "••••••••" if row.get("twilio_auth_token") else None
    return SettingsRead(
        id=row.get("id", 1),
        messaging_enabled=bool(row.get("messaging_enabled", True)),
        sms_fallback_enabled=bool(row.get("sms_fallback_enabled", True)),
        twilio_whatsapp_cost=float(row.get("twilio_whatsapp_cost") or 0.0),
        twilio_sms_cost=float(row.get("twilio_sms_cost") or 0.0),
        twilio_account_sid=row.get("twilio_account_sid"),
        twilio_auth_token_masked=masked,
        whatsapp_sender=row.get("whatsapp_sender"),
        sms_sender=row.get("sms_sender"),
        updated_at=row.get("updated_at"),
    )


@router.get("", response_model=SettingsRead, dependencies=[Depends(require_admin)])
async def get_settings_endpoint(db: Client = Depends(get_db)):
    res = db.table("settings").select("*").eq("id", 1).single().execute()
    return _to_read(res.data or {})


@router.put("", response_model=SettingsRead, dependencies=[Depends(require_admin)])
async def update_settings_endpoint(
    body: SettingsUpdate,
    db: Client = Depends(get_db),
):
    current_res = db.table("settings").select("*").eq("id", 1).single().execute()
    current = current_res.data or {}

    update_payload: dict[str, Any] = {}
    for field in (
        "messaging_enabled",
        "sms_fallback_enabled",
        "twilio_whatsapp_cost",
        "twilio_sms_cost",
        "twilio_account_sid",
        "twilio_auth_token",
        "whatsapp_sender",
        "sms_sender",
    ):
        v = getattr(body, field)
        if v is not None:
            update_payload[field] = v

    creds_changed = any(
        k in update_payload for k in ("twilio_account_sid", "twilio_auth_token")
    )
    if creds_changed:
        sid = update_payload.get("twilio_account_sid") or current.get("twilio_account_sid") or ""
        token = update_payload.get("twilio_auth_token") or current.get("twilio_auth_token") or ""
        if sid and token:
            if not validate_account(sid, token):
                raise api_error(
                    ErrorCode.TWILIO_CREDENTIALS_INVALID,
                    "Twilio credentials failed validation",
                )

    if update_payload:
        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.table("settings").update(update_payload).eq("id", 1).execute()

    safe_meta = {k: ("***" if "token" in k else v) for k, v in update_payload.items()}
    log_event(level="info", event="settings.updated", meta=safe_meta)

    refreshed = db.table("settings").select("*").eq("id", 1).single().execute().data or {}
    return _to_read(refreshed)
