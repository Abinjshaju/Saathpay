"""Best-effort welcome message when a member is created (never fails the HTTP handler)."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import HTTPException
from supabase import Client

from config import get_settings
from services.channel_messaging import send_for_org_channels
from services.log_service import log_event
from services.twilio_service import load_twilio_creds

_log = logging.getLogger("saathpay.welcome")


def try_send_member_welcome(
    db: Client,
    *,
    org: dict[str, Any],
    member: dict[str, Any],
    plan_name: str,
) -> None:
    settings = get_settings()
    if not settings.member_welcome_enabled:
        return

    mobile = (member.get("mobile") or "").strip()
    if not mobile:
        return

    full_name = member.get("full_name") or "Member"
    org_name = org.get("name") or "our organisation"

    try:
        text = settings.member_welcome_message.format(
            full_name=full_name,
            org_name=org_name,
            plan_name=plan_name,
        )
    except (KeyError, ValueError):
        text = settings.member_welcome_message

    content_sid = (settings.twilio_welcome_whatsapp_content_sid or "").strip()
    raw_vars = (settings.twilio_welcome_whatsapp_content_variables or "").strip()
    if content_sid and not raw_vars:
        raw_vars = json.dumps({"1": full_name, "2": org_name, "3": plan_name})

    creds = load_twilio_creds()
    if not creds.messaging_enabled:
        return
    if not creds.account_sid or not creds.auth_token:
        return

    org_status = org.get("status") or "active"
    try:
        sends = send_for_org_channels(
            db,
            creds=creds,
            org=org,
            member=member,
            body=text,
            organisation_status=org_status,
            whatsapp_content_sid=content_sid or None,
            whatsapp_content_variables=raw_vars or None,
        )
    except HTTPException as e:
        _log.warning(
            "member_welcome_http_error member_id=%s detail=%s",
            member.get("id"),
            getattr(e, "detail", e),
        )
        return
    except Exception as e:
        _log.warning("member_welcome_failed member_id=%s err=%s", member.get("id"), e)
        return

    for channel, saved, result in sends:
        log_event(
            level="info" if result.status != "failed" else "warning",
            event="member.welcome_sent",
            organisation_id=str(org["id"]),
            meta={
                "member_id": member.get("id"),
                "message_id": saved.get("id"),
                "channel": channel,
                "status": result.status,
                "twilio_sid": result.twilio_sid,
                "error": result.error,
                "whatsapp_template": bool(content_sid) if channel == "whatsapp" else False,
            },
        )
