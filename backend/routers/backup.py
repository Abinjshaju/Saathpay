"""Full data backup as a downloadable zip of CSVs."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, Response
from supabase import Client

from auth.utils import require_admin
from database import get_db
from services.csv_service import rows_to_csv
from services.log_service import log_event

router = APIRouter(prefix="/backup", tags=["backup"])


_COLUMN_ALLOWLIST: dict[str, list[str]] = {
    "organisations": [
        "id", "name", "type", "custom_type", "logo_url", "address",
        "maps_url", "status", "created_at",
    ],
    "users": [
        "id", "organisation_id", "full_name", "username", "mobile",
        "email", "role", "created_at",
    ],
    "plans": [
        "id", "organisation_id", "name", "amount", "billing_cycle",
        "description", "created_at",
    ],
    "members": [
        "id", "organisation_id", "plan_id", "full_name", "mobile", "email",
        "join_date", "next_due_date", "created_at",
    ],
    "messages": [
        "id", "organisation_id", "member_id", "channel", "status",
        "twilio_sid", "body", "error", "sent_at",
    ],
    "settings": [
        "id", "messaging_enabled", "sms_fallback_enabled",
        "twilio_whatsapp_cost", "twilio_sms_cost", "twilio_account_sid",
        "whatsapp_sender", "sms_sender", "updated_at",
    ],
    "logs": ["id", "level", "event", "organisation_id", "meta", "created_at"],
}


def _fetch_all(db: Client, table: str, columns: list[str]) -> list[dict[str, Any]]:
    select_str = ", ".join(columns)
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            db.table(table)
            .select(select_str)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


@router.post("", dependencies=[Depends(require_admin)])
async def create_backup(db: Client = Depends(get_db)):
    buf = BytesIO()
    summary: dict[str, int] = {}
    with ZipFile(buf, "w", ZIP_DEFLATED) as z:
        for table, cols in _COLUMN_ALLOWLIST.items():
            rows = _fetch_all(db, table, cols)
            summary[table] = len(rows)
            z.writestr(f"{table}.csv", rows_to_csv(rows, cols))

    log_event(level="info", event="backup.created", meta=summary)

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="saathpay_backup_{ts}.zip"'},
    )
