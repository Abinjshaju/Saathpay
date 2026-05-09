"""Members router — global member edit/delete + CSV template download."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Response, status
from supabase import Client

from auth.utils import enforce_org_scope, require_auth
from database import get_db
from models.schemas import MemberRead, MemberUpdate
from services.csv_service import CSV_HEADERS, template_csv
from services.log_service import log_event
from utils.errors import ErrorCode, api_error, not_found

router = APIRouter(tags=["members"])


@router.get(
    "/members/csv-template",
    response_class=Response,
    summary="Download an empty members.csv template",
)
async def download_csv_template():
    return Response(
        content=template_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="members_template.csv"',
            "X-CSV-Headers": ",".join(CSV_HEADERS),
        },
    )


def _fetch_member(db: Client, member_id: str) -> dict[str, Any]:
    res = db.table("members").select("*").eq("id", member_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, f"member {member_id} not found")
    return rows[0]


@router.put(
    "/members/{member_id}",
    response_model=MemberRead,
    dependencies=[Depends(require_auth)],
)
async def update_member(
    member_id: str,
    body: MemberUpdate,
    db: Client = Depends(get_db),
    claims: dict = Depends(require_auth),
):
    member = _fetch_member(db, member_id)
    enforce_org_scope(claims, str(member["organisation_id"]), min_role="admin")

    if body.plan_id is not None:
        plan = (
            db.table("plans")
            .select("id, organisation_id, name")
            .eq("id", str(body.plan_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not plan or plan[0]["organisation_id"] != member["organisation_id"]:
            raise api_error(
                ErrorCode.PLAN_NOT_FOUND,
                "plan does not belong to this member's organisation",
            )

    update_payload: dict[str, Any] = {}
    for field in ("full_name", "mobile", "email"):
        v = getattr(body, field)
        if v is not None:
            update_payload[field] = v
    if body.plan_id is not None:
        update_payload["plan_id"] = str(body.plan_id)
    if body.join_date is not None:
        update_payload["join_date"] = body.join_date.isoformat()
    if body.next_due_date is not None:
        update_payload["next_due_date"] = body.next_due_date.isoformat()

    if update_payload:
        db.table("members").update(update_payload).eq("id", member_id).execute()

    refreshed_res = (
        db.table("members")
        .select("*, plans(name)")
        .eq("id", member_id)
        .limit(1)
        .execute()
    )
    refreshed = (refreshed_res.data or [None])[0]
    if refreshed:
        plan = refreshed.pop("plans", None)
        refreshed["plan_name"] = (plan or {}).get("name") if isinstance(plan, dict) else None

    log_event(
        level="info",
        event="member.updated",
        organisation_id=member["organisation_id"],
        meta={"member_id": member_id, "fields": list(update_payload.keys())},
    )
    return MemberRead.model_validate(refreshed).model_dump(mode="json")


@router.delete(
    "/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_auth)],
)
async def delete_member(
    member_id: str,
    db: Client = Depends(get_db),
    claims: dict = Depends(require_auth),
):
    member = _fetch_member(db, member_id)
    enforce_org_scope(claims, str(member["organisation_id"]), min_role="admin")
    db.table("members").delete().eq("id", member_id).execute()
    log_event(
        level="info",
        event="member.deleted",
        organisation_id=member["organisation_id"],
        meta={"member_id": member_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
