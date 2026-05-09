"""Shared helpers for composing message bodies and persisting rows."""

from __future__ import annotations

from typing import Any

from supabase import Client

from services.twilio_service import SendResult

DEFAULT_BODY = (
    "Hi {full_name}, this is a friendly reminder that your subscription with "
    "{org_name} is due. Please pay at your earliest convenience. Thank you!"
)


def _format_inr_amount(amount: Any) -> str:
    try:
        a = float(amount)
        if a == int(a):
            return str(int(a))
        return f"{a:.2f}"
    except (TypeError, ValueError):
        return str(amount) if amount not in (None, "") else ""


def format_body(template: str | None, member: dict[str, Any], org: dict[str, Any]) -> str:
    body = template or DEFAULT_BODY
    amt = member.get("amount")
    amount_str = _format_inr_amount(amt) if amt is not None else ""
    try:
        return body.format(
            full_name=member.get("full_name", "Member"),
            member_name=member.get("full_name", "Member"),
            org_name=org.get("name", "your organisation"),
            organisation_name=org.get("name", "your organisation"),
            mobile=member.get("mobile", ""),
            next_due_date=member.get("next_due_date") or "",
            upi_number=org.get("upi_number") or "",
            upi_id=org.get("upi_id") or "",
            amount=amount_str,
        )
    except (KeyError, IndexError, ValueError):
        return body


def persist_message(
    db: Client,
    *,
    organisation_id: str,
    member_id: str | None,
    body: str,
    result: SendResult,
) -> dict[str, Any]:
    insert_res = (
        db.table("messages")
        .insert(
            {
                "organisation_id": organisation_id,
                "member_id": member_id,
                "channel": result.channel,
                "status": "failed" if result.status == "failed" else result.status,
                "twilio_sid": result.twilio_sid,
                "body": body,
                "error": result.error,
            }
        )
        .execute()
    )
    return (insert_res.data or [{}])[0]
