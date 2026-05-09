"""Channel-aware messaging helpers (org-level WhatsApp/SMS toggles)."""

from __future__ import annotations

from typing import Any, Optional

from supabase import Client

from services.messaging import persist_message
from services.twilio_service import SendResult, TwilioCreds, send_sms, send_whatsapp


def _org_channel_enabled(org: dict[str, Any], channel: str) -> bool:
    if channel == "whatsapp":
        return bool(org.get("whatsapp_enabled", True))
    if channel == "sms":
        return bool(org.get("sms_enabled", False))
    return False


def send_for_org_channels(
    db: Client,
    *,
    creds: TwilioCreds,
    org: dict[str, Any],
    member: dict[str, Any],
    body: str,
    organisation_status: str,
    whatsapp_content_sid: Optional[str] = None,
    whatsapp_content_variables: Optional[str] = None,
) -> list[tuple[str, dict[str, Any], SendResult]]:
    """Send on all enabled channels for this organisation.

    Returns list of tuples: (channel, saved_message_row, send_result)
    """
    out: list[tuple[str, dict[str, Any], SendResult]] = []
    to_mobile = member.get("mobile") or ""
    if not to_mobile:
        return out

    if _org_channel_enabled(org, "whatsapp"):
        result = send_whatsapp(
            creds=creds,
            organisation_status=organisation_status,
            to_mobile=to_mobile,
            body=body,
            content_sid=whatsapp_content_sid,
            content_variables=whatsapp_content_variables,
        )
        saved = persist_message(
            db,
            organisation_id=str(org["id"]),
            member_id=str(member["id"]),
            body=body,
            result=result,
        )
        out.append(("whatsapp", saved, result))

    if _org_channel_enabled(org, "sms"):
        result = send_sms(
            creds=creds,
            organisation_status=organisation_status,
            to_mobile=to_mobile,
            body=body,
        )
        saved = persist_message(
            db,
            organisation_id=str(org["id"]),
            member_id=str(member["id"]),
            body=body,
            result=result,
        )
        out.append(("sms", saved, result))

    return out

