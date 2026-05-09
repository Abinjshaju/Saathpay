"""Messaging endpoints: send single, send bulk."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from auth.utils import enforce_org_scope, require_auth
from database import get_db
from models.schemas import (
    BulkSendItem,
    BulkSendRequest,
    BulkSendResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from services.log_service import log_event
from services.channel_messaging import send_for_org_channels
from services.messaging import format_body, persist_message
from services.twilio_service import TwilioCreds, load_twilio_creds
from utils.errors import ErrorCode, forbidden, not_found

router = APIRouter(prefix="/messages", tags=["messages"])


def _attach_plan_amount(member: dict[str, Any]) -> None:
    plan_raw = member.pop("plans", None)
    if isinstance(plan_raw, list):
        plan = plan_raw[0] if plan_raw else None
    elif isinstance(plan_raw, dict):
        plan = plan_raw
    else:
        plan = None
    if plan is not None and plan.get("amount") is not None:
        member["amount"] = plan["amount"]


def _ensure_messaging_allowed(creds: TwilioCreds) -> None:
    if not creds.messaging_enabled:
        raise forbidden(ErrorCode.MESSAGING_DISABLED, "messaging is globally disabled")


@router.post("/send", response_model=SendMessageResponse)
async def send_message(
    body: SendMessageRequest,
    db: Client = Depends(get_db),
    claims: dict = Depends(require_auth),
):
    creds = load_twilio_creds()
    _ensure_messaging_allowed(creds)

    member_res = (
        db.table("members")
        .select("*, organisations(id, name, status, upi_id, upi_number), plans(amount)")
        .eq("id", str(body.member_id))
        .limit(1)
        .execute()
    )
    rows = member_res.data or []
    if not rows:
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "member not found")
    member = rows[0]
    org = member.pop("organisations", None) or {}
    _attach_plan_amount(member)
    if not org or org.get("status") != "active":
        raise forbidden(ErrorCode.ORG_PAUSED, "organisation is paused")

    enforce_org_scope(claims, str(org["id"]), min_role="admin")

    text = format_body(body.message_body, member, org)
    sends = send_for_org_channels(
        db,
        creds=creds,
        org=org,
        member=member,
        body=text,
        organisation_status=org["status"],
    )
    if not sends:
        raise forbidden(ErrorCode.FORBIDDEN, "no channels enabled for this organisation")
    channel, saved, result = sends[0]

    log_event(
        level="info" if result.status != "failed" else "warning",
        event="message.sent",
        organisation_id=org["id"],
        meta={
            "member_id": member["id"],
            "message_id": saved.get("id"),
            "channel": channel,
            "status": result.status,
            "twilio_sid": result.twilio_sid,
            "error": result.error,
        },
    )

    return SendMessageResponse(
        message_id=saved["id"],
        channel_used=channel,  # type: ignore[arg-type]
        status=saved["status"],
        twilio_sid=result.twilio_sid,
        error=result.error,
    )


@router.post("/send-bulk", response_model=BulkSendResponse)
async def send_bulk(
    body: BulkSendRequest,
    db: Client = Depends(get_db),
    claims: dict = Depends(require_auth),
):
    creds = load_twilio_creds()
    _ensure_messaging_allowed(creds)

    enforce_org_scope(claims, str(body.organisation_id), min_role="admin")

    org_res = (
        db.table("organisations")
        .select("id, name, status, upi_id, upi_number, whatsapp_enabled, sms_enabled")
        .eq("id", str(body.organisation_id))
        .limit(1)
        .execute()
    )
    org_rows = org_res.data or []
    if not org_rows:
        raise not_found(ErrorCode.ORG_NOT_FOUND, "organisation not found")
    org = org_rows[0]
    if org["status"] != "active":
        raise forbidden(ErrorCode.ORG_PAUSED, "organisation is paused")

    if body.member_ids:
        member_id_strs = [str(m) for m in body.member_ids]
        members_res = (
            db.table("members")
            .select("*, plans(amount)")
            .eq("organisation_id", org["id"])
            .in_("id", member_id_strs)
            .execute()
        )
    else:
        today = date.today().isoformat()
        members_res = (
            db.table("members")
            .select("*, plans(amount)")
            .eq("organisation_id", org["id"])
            .lte("next_due_date", today)
            .execute()
        )
    members = members_res.data or []

    sent = 0
    failed = 0
    items: list[BulkSendItem] = []
    for member in members:
        _attach_plan_amount(member)
        text = format_body(body.message_body, member, org)
        try:
            sends = send_for_org_channels(
                db,
                creds=creds,
                org=org,
                member=member,
                body=text,
                organisation_status=org["status"],
            )
            if not sends:
                failed += 1
                items.append(
                    BulkSendItem(
                        member_id=UUID(member["id"]),
                        success=False,
                        error="no channels enabled for this organisation",
                    )
                )
            for channel, saved, result in sends:
                success = result.status != "failed" and result.twilio_sid is not None
                if success:
                    sent += 1
                else:
                    failed += 1
                items.append(
                    BulkSendItem(
                        member_id=UUID(member["id"]),
                        success=success,
                        channel=channel,  # type: ignore[arg-type]
                        status=saved.get("status"),
                        twilio_sid=result.twilio_sid,
                        error=result.error,
                    )
                )
        except Exception as e:
            failed += 1
            items.append(
                BulkSendItem(
                    member_id=UUID(member["id"]),
                    success=False,
                    error=str(e),
                )
            )

    log_event(
        level="info",
        event="message.bulk_sent",
        organisation_id=org["id"],
        meta={"sent": sent, "failed": failed, "total": len(members)},
    )

    return BulkSendResponse(sent=sent, failed=failed, results=items)
