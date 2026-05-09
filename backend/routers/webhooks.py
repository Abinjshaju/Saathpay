"""Public webhooks (no JWT — Twilio signature is the auth)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response
from supabase import Client

from database import get_db
from services.log_service import log_event
from services.twilio_service import validate_signature

_log = logging.getLogger("saathpay.webhooks")
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


_TWILIO_TO_INTERNAL = {
    "queued": "queued",
    "sent": "sent",
    "delivered": "delivered",
    "undelivered": "undelivered",
    "failed": "failed",
    "read": "read",
}


@router.post("/twilio")
async def twilio_status_callback(request: Request, db: Client = Depends(get_db)):
    if not await validate_signature(request):
        _log.warning("twilio_signature_invalid")
        return Response(status_code=200)

    form = await request.form()
    sid = (form.get("MessageSid") or "").strip()
    twilio_status = (form.get("MessageStatus") or "").lower().strip()
    error_code = form.get("ErrorCode")

    if not sid:
        return Response(status_code=200)

    new_status = _TWILIO_TO_INTERNAL.get(twilio_status, twilio_status or "sent")

    update: dict = {"status": new_status}
    if error_code:
        update["error"] = f"twilio_error_code={error_code}"

    res = (
        db.table("messages")
        .update(update)
        .eq("twilio_sid", sid)
        .execute()
    )

    org_id = None
    if res.data:
        org_id = (res.data[0] or {}).get("organisation_id")

    log_event(
        level="info",
        event="message.status_callback",
        organisation_id=org_id,
        meta={
            "twilio_sid": sid,
            "twilio_status": twilio_status,
            "internal_status": new_status,
            "error_code": error_code,
        },
    )

    return Response(status_code=200)
