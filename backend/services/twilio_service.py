"""Twilio integration: WhatsApp + SMS send with fallback, signature validation.

Credentials are read from the `settings` table at call time (so updates take
effect immediately), with `.env` values as fallback defaults.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import Request
from twilio.base.exceptions import TwilioException, TwilioRestException
from twilio.request_validator import RequestValidator
from twilio.rest import Client as TwilioClient

from config import get_settings
from database import get_supabase
from utils.errors import ErrorCode, api_error, forbidden

_log = logging.getLogger("saathpay.twilio")

WHATSAPP_PREFIX = "whatsapp:"


@dataclass
class TwilioCreds:
    account_sid: str
    auth_token: str
    whatsapp_sender: str
    sms_sender: str
    whatsapp_cost: float
    sms_cost: float
    messaging_enabled: bool
    sms_fallback_enabled: bool


def _load_settings_row() -> dict[str, Any]:
    res = get_supabase().table("settings").select("*").eq("id", 1).single().execute()
    return res.data or {}


def _effective_str(db_val: Any, env_val: str) -> str:
    """Prefer non-empty DB value; otherwise env. Whitespace-only DB values use env."""
    if db_val is not None:
        s = str(db_val).strip()
        if s:
            return s
    return (env_val or "").strip()


def load_twilio_creds() -> TwilioCreds:
    """Read effective Twilio creds: DB row overrides .env when the DB value is non-empty."""
    env = get_settings()
    row = _load_settings_row()
    return TwilioCreds(
        account_sid=_effective_str(row.get("twilio_account_sid"), env.twilio_account_sid),
        auth_token=_effective_str(row.get("twilio_auth_token"), env.twilio_auth_token),
        whatsapp_sender=_effective_str(row.get("whatsapp_sender"), env.twilio_whatsapp_sender),
        sms_sender=_effective_str(row.get("sms_sender"), env.twilio_sms_sender),
        whatsapp_cost=float(row.get("twilio_whatsapp_cost") or 0.0),
        sms_cost=float(row.get("twilio_sms_cost") or 0.0),
        messaging_enabled=bool(row.get("messaging_enabled", True)),
        sms_fallback_enabled=bool(row.get("sms_fallback_enabled", True)),
    )


def _client(creds: TwilioCreds) -> TwilioClient:
    if not creds.account_sid or not creds.auth_token:
        raise api_error(
            ErrorCode.TWILIO_NOT_CONFIGURED,
            "Twilio credentials are not configured",
        )
    return TwilioClient(creds.account_sid, creds.auth_token)


def _to_whatsapp(mobile: str) -> str:
    return mobile if mobile.startswith(WHATSAPP_PREFIX) else f"{WHATSAPP_PREFIX}{mobile}"


def _strip_whatsapp_prefix(sender: str) -> str:
    s = (sender or "").strip()
    return s[len(WHATSAPP_PREFIX) :] if s.startswith(WHATSAPP_PREFIX) else s


@dataclass
class SendResult:
    channel: str
    status: str
    twilio_sid: str | None
    error: str | None


def _ensure_can_send(creds: TwilioCreds, organisation_status: str) -> None:
    if not creds.messaging_enabled:
        raise forbidden(ErrorCode.MESSAGING_DISABLED, "messaging is globally disabled")
    if organisation_status != "active":
        raise forbidden(ErrorCode.ORG_PAUSED, "organisation is paused")


def send_whatsapp(
    *,
    creds: TwilioCreds,
    organisation_status: str,
    to_mobile: str,
    body: str,
    content_sid: str | None = None,
    content_variables: str | None = None,
) -> SendResult:
    """Send a WhatsApp message (template-capable) via Twilio."""
    _ensure_can_send(creds, organisation_status)
    client = _client(creds)

    if not creds.whatsapp_sender:
        return SendResult(
            channel="whatsapp",
            status="failed",
            twilio_sid=None,
            error="whatsapp sender not configured",
        )

    try:
        wa_kwargs: dict[str, Any] = {
            "from_": _to_whatsapp(creds.whatsapp_sender),
            "to": _to_whatsapp(to_mobile),
        }
        sid = (content_sid or "").strip()
        if sid:
            wa_kwargs["content_sid"] = sid
            vars_json = (content_variables or "").strip()
            if vars_json:
                wa_kwargs["content_variables"] = vars_json
        else:
            wa_kwargs["body"] = body

        msg = client.messages.create(**wa_kwargs)
        return SendResult(
            channel="whatsapp",
            status=str(msg.status or "queued"),
            twilio_sid=msg.sid,
            error=None,
        )
    except (TwilioRestException, TwilioException) as e:
        _log.warning("whatsapp_send_failed to=%s: %s", to_mobile, e)
        return SendResult(
            channel="whatsapp",
            status="failed",
            twilio_sid=None,
            error=str(e),
        )


def send_sms(
    *,
    creds: TwilioCreds,
    organisation_status: str,
    to_mobile: str,
    body: str,
) -> SendResult:
    """Send an SMS via Twilio."""
    _ensure_can_send(creds, organisation_status)
    client = _client(creds)

    sender = (creds.sms_sender or "").strip() or _strip_whatsapp_prefix(creds.whatsapp_sender)
    if not sender:
        return SendResult(
            channel="sms",
            status="failed",
            twilio_sid=None,
            error="sms sender not configured",
        )

    try:
        msg = client.messages.create(from_=sender, to=to_mobile, body=body)
        return SendResult(
            channel="sms",
            status=str(msg.status or "queued"),
            twilio_sid=msg.sid,
            error=None,
        )
    except (TwilioRestException, TwilioException) as e:
        _log.warning("sms_send_failed to=%s: %s", to_mobile, e)
        return SendResult(
            channel="sms",
            status="failed",
            twilio_sid=None,
            error=str(e),
        )


def send_with_fallback(
    *,
    creds: TwilioCreds,
    organisation_status: str,
    to_mobile: str,
    body: str,
    whatsapp_content_sid: str | None = None,
    whatsapp_content_variables: str | None = None,
) -> SendResult:
    """Attempt WhatsApp first, fall back to SMS if enabled and WhatsApp fails.

    For WhatsApp business-initiated messages outside the 24h session, pass
    ``whatsapp_content_sid`` (+ optional variables JSON) instead of relying on ``body`` alone.
    SMS fallback always uses ``body``.
    """
    wa = send_whatsapp(
        creds=creds,
        organisation_status=organisation_status,
        to_mobile=to_mobile,
        body=body,
        content_sid=whatsapp_content_sid,
        content_variables=whatsapp_content_variables,
    )
    if wa.status != "failed":
        return wa
    wa_error = wa.error or "whatsapp_send_failed"

    if not creds.sms_fallback_enabled:
        return SendResult(
            channel="whatsapp",
            status="failed",
            twilio_sid=None,
            error=wa_error,
        )

    sms = send_sms(
        creds=creds,
        organisation_status=organisation_status,
        to_mobile=to_mobile,
        body=body,
    )
    if sms.status != "failed":
        return sms
    return SendResult(
        channel="sms",
        status="failed",
        twilio_sid=None,
        error=f"{wa_error}; sms_failed: {sms.error}",
    )


def validate_account(account_sid: str, auth_token: str) -> bool:
    """Cheap credential validation — fetches the account."""
    try:
        TwilioClient(account_sid, auth_token).api.accounts(account_sid).fetch()
        return True
    except (TwilioRestException, TwilioException, Exception):
        return False


async def validate_signature(request: Request) -> bool:
    """Verify Twilio's X-Twilio-Signature header against the auth token."""
    creds = load_twilio_creds()
    if not creds.auth_token:
        return False
    signature = request.headers.get("X-Twilio-Signature", "")
    if not signature:
        return False
    url = str(request.url)
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    return RequestValidator(creds.auth_token).validate(url, params, signature)
