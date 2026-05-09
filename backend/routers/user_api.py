"""User-facing API router — serves the user UI (org staff app).

All endpoints require JWT kind=user. Operations are scoped to the
authenticated user's organisation_id automatically.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field
from supabase import Client

from auth.utils import require_user
from database import get_db
from models.schemas import (
    MemberCreate,
    MemberRead,
    MemberUpdate,
    PlanRead,
)
from utils.errors import ErrorCode, api_error, not_found

_log = logging.getLogger("saathpay.user_api")

router = APIRouter(prefix="/user", tags=["user-api"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _org_id(claims: dict) -> str:
    """Extract org id from JWT claims."""
    oid = claims.get("organisation_id")
    if not oid:
        raise api_error(ErrorCode.FORBIDDEN, "no organisation in token", 403)
    return str(oid)


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

@router.get("/plans", response_model=list[PlanRead])
async def list_plans(
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)
    res = (
        db.table("plans")
        .select("*")
        .eq("organisation_id", org_id)
        .order("created_at")
        .execute()
    )
    return [PlanRead.model_validate(r).model_dump(mode="json") for r in (res.data or [])]


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/members", response_model=list[dict])
async def list_members(
    search: Optional[str] = Query(default=None),
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)
    q = (
        db.table("members")
        .select("*, plans(name, amount, billing_cycle)")
        .eq("organisation_id", org_id)
    )
    if search:
        q = q.or_(f"full_name.ilike.%{search}%,mobile.ilike.%{search}%")
    res = q.order("created_at", desc=True).execute()
    rows = res.data or []
    data = []
    for r in rows:
        plan = r.pop("plans", None)
        r["plan_name"] = (plan or {}).get("name") if isinstance(plan, dict) else None
        r["plan_amount"] = (plan or {}).get("amount") if isinstance(plan, dict) else None
        data.append(r)
    return data


@router.get("/members/{member_id}")
async def get_member(
    member_id: str,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)
    res = (
        db.table("members")
        .select("*, plans(name, amount, billing_cycle)")
        .eq("id", member_id)
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, f"member {member_id} not found")
    r = rows[0]
    plan = r.pop("plans", None)
    r["plan_name"] = (plan or {}).get("name") if isinstance(plan, dict) else None
    r["plan_amount"] = (plan or {}).get("amount") if isinstance(plan, dict) else None
    return r


@router.post("/members", status_code=status.HTTP_201_CREATED)
async def create_member(
    body: MemberCreate,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Verify plan belongs to this org
    plan_res = (
        db.table("plans")
        .select("id, name")
        .eq("id", str(body.plan_id))
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    if not (plan_res.data or []):
        raise api_error(ErrorCode.PLAN_NOT_FOUND, "plan not found for this organisation")

    insert_payload = {
        "organisation_id": org_id,
        "plan_id": str(body.plan_id),
        "full_name": body.full_name,
        "mobile": body.mobile,
        "email": body.email,
        "join_date": body.join_date.isoformat() if body.join_date else None,
        "next_due_date": body.next_due_date.isoformat() if body.next_due_date else None,
    }
    res = db.table("members").insert(insert_payload).execute()
    member = (res.data or [None])[0]
    if not member:
        raise api_error(ErrorCode.INTERNAL_ERROR, "failed to insert member", 500)
    member["plan_name"] = (plan_res.data or [{}])[0].get("name")
    return member


@router.put("/members/{member_id}")
async def update_member(
    member_id: str,
    body: MemberUpdate,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Verify member belongs to org
    existing = (
        db.table("members")
        .select("id")
        .eq("id", member_id)
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    if not (existing.data or []):
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "member not found")

    update_payload: dict[str, Any] = {}
    for field in ("full_name", "mobile", "email"):
        v = getattr(body, field)
        if v is not None:
            update_payload[field] = v
    if body.plan_id is not None:
        # Verify plan belongs to org
        plan_check = (
            db.table("plans")
            .select("id")
            .eq("id", str(body.plan_id))
            .eq("organisation_id", org_id)
            .limit(1)
            .execute()
        )
        if not (plan_check.data or []):
            raise api_error(ErrorCode.PLAN_NOT_FOUND, "plan not found")
        update_payload["plan_id"] = str(body.plan_id)
    if body.join_date is not None:
        update_payload["join_date"] = body.join_date.isoformat()
    if body.next_due_date is not None:
        update_payload["next_due_date"] = body.next_due_date.isoformat()

    if update_payload:
        db.table("members").update(update_payload).eq("id", member_id).execute()

    return await get_member(member_id, claims=claims, db=db)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    member_id: str,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)
    existing = (
        db.table("members")
        .select("id")
        .eq("id", member_id)
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    if not (existing.data or []):
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "member not found")
    db.table("members").delete().eq("id", member_id).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    member_id: UUID
    month: str = Field(..., min_length=1)
    date: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    status: str = "pending"


class PaymentBulkCreate(BaseModel):
    payments: list[PaymentCreate]


class PaymentUpdateBody(BaseModel):
    month: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None


@router.get("/payments")
async def list_payments(
    member_id: Optional[str] = Query(default=None),
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Get member ids belonging to this org
    if member_id:
        # Verify member belongs to org
        check = (
            db.table("members")
            .select("id")
            .eq("id", member_id)
            .eq("organisation_id", org_id)
            .limit(1)
            .execute()
        )
        if not (check.data or []):
            raise not_found(ErrorCode.MEMBER_NOT_FOUND, "member not found")
        res = (
            db.table("payments")
            .select("*")
            .eq("member_id", member_id)
            .order("created_at", desc=True)
            .execute()
        )
    else:
        # All payments for members of this org
        member_ids_res = (
            db.table("members")
            .select("id")
            .eq("organisation_id", org_id)
            .execute()
        )
        member_ids = [m["id"] for m in (member_ids_res.data or [])]
        if not member_ids:
            return []
        res = (
            db.table("payments")
            .select("*")
            .in_("member_id", member_ids)
            .order("created_at", desc=True)
            .execute()
        )
    return res.data or []


@router.post("/payments", status_code=status.HTTP_201_CREATED)
async def create_payments(
    body: PaymentBulkCreate,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Validate all member_ids belong to this org
    member_ids = list({str(p.member_id) for p in body.payments})
    check = (
        db.table("members")
        .select("id")
        .eq("organisation_id", org_id)
        .in_("id", member_ids)
        .execute()
    )
    valid_ids = {m["id"] for m in (check.data or [])}
    for mid in member_ids:
        if mid not in valid_ids:
            raise api_error(ErrorCode.MEMBER_NOT_FOUND, f"member {mid} not found in org")

    rows = [
        {
            "member_id": str(p.member_id),
            "month": p.month,
            "date": p.date,
            "amount": p.amount,
            "status": p.status,
        }
        for p in body.payments
    ]
    res = db.table("payments").insert(rows).execute()
    return res.data or []


@router.put("/payments/{payment_id}")
async def update_payment(
    payment_id: str,
    body: PaymentUpdateBody,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Verify payment belongs to a member in this org
    payment_res = (
        db.table("payments")
        .select("*, members(organisation_id)")
        .eq("id", payment_id)
        .limit(1)
        .execute()
    )
    rows = payment_res.data or []
    if not rows:
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "payment not found")
    member_info = rows[0].get("members") or {}
    if str(member_info.get("organisation_id", "")) != org_id:
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "payment not found")

    update_payload: dict[str, Any] = {}
    if body.month is not None:
        update_payload["month"] = body.month
    if body.date is not None:
        update_payload["date"] = body.date
    if body.amount is not None:
        update_payload["amount"] = body.amount
    if body.status is not None:
        update_payload["status"] = body.status

    if update_payload:
        db.table("payments").update(update_payload).eq("id", payment_id).execute()

    refreshed = db.table("payments").select("*").eq("id", payment_id).single().execute()
    return refreshed.data


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_members: int = 0
    total_plans: int = 0
    members_by_plan: list[dict] = []
    recent_payments: list[dict] = []
    upcoming_dues: list[dict] = []


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    # Members with plan info
    members_res = (
        db.table("members")
        .select("*, plans(name, amount, billing_cycle)")
        .eq("organisation_id", org_id)
        .execute()
    )
    members = members_res.data or []

    # Plans
    plans_res = (
        db.table("plans")
        .select("*")
        .eq("organisation_id", org_id)
        .execute()
    )
    plans = plans_res.data or []

    # Payments for this org's members
    member_ids = [m["id"] for m in members]
    payments = []
    if member_ids:
        pay_res = (
            db.table("payments")
            .select("*")
            .in_("member_id", member_ids)
            .eq("status", "paid")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        payments = pay_res.data or []

    # Members by plan
    plan_count: dict[str, int] = {}
    for m in members:
        plan = m.get("plans") or {}
        pname = plan.get("name", "No Plan") if isinstance(plan, dict) else "No Plan"
        plan_count[pname] = plan_count.get(pname, 0) + 1
    members_by_plan = [{"plan": k, "count": v} for k, v in plan_count.items()]

    # Upcoming dues (members whose next_due_date is within 30 days)
    today = date.today()
    upcoming = []
    for m in members:
        ndd = m.get("next_due_date")
        if ndd:
            try:
                dd = date.fromisoformat(str(ndd)[:10])
                diff = (dd - today).days
                if 0 <= diff <= 30:
                    plan = m.get("plans") or {}
                    upcoming.append({
                        "id": m["id"],
                        "full_name": m["full_name"],
                        "mobile": m.get("mobile"),
                        "next_due_date": str(ndd),
                        "plan_name": plan.get("name") if isinstance(plan, dict) else None,
                        "plan_amount": plan.get("amount") if isinstance(plan, dict) else None,
                    })
            except (ValueError, TypeError):
                pass
    upcoming.sort(key=lambda x: x.get("next_due_date", ""))

    # Recent payments (last 10 paid)
    recent = []
    member_map = {m["id"]: m for m in members}
    for p in payments[:10]:
        m = member_map.get(p.get("member_id", ""))
        recent.append({
            "id": p["id"],
            "member_name": m["full_name"] if m else "Unknown",
            "month": p.get("month", ""),
            "date": p.get("date", ""),
            "amount": p.get("amount", 0),
            "status": p.get("status", ""),
        })

    return DashboardStats(
        total_members=len(members),
        total_plans=len(plans),
        members_by_plan=members_by_plan,
        recent_payments=recent,
        upcoming_dues=upcoming,
    )


# ---------------------------------------------------------------------------
# Member status update (for payment workflows)
# ---------------------------------------------------------------------------

class MemberStatusUpdate(BaseModel):
    status: str
    status_label: Optional[str] = None


@router.patch("/members/{member_id}/status")
async def update_member_status(
    member_id: str,
    body: MemberStatusUpdate,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)
    existing = (
        db.table("members")
        .select("id")
        .eq("id", member_id)
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    if not (existing.data or []):
        raise not_found(ErrorCode.MEMBER_NOT_FOUND, "member not found")

    update_data: dict[str, Any] = {"status": body.status}
    if body.status_label is not None:
        update_data["status_label"] = body.status_label

    db.table("members").update(update_data).eq("id", member_id).execute()
    return {"id": member_id, "status": body.status}


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_data(
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    org_id = _org_id(claims)

    members_res = (
        db.table("members")
        .select("*, plans(name, amount)")
        .eq("organisation_id", org_id)
        .execute()
    )
    members = members_res.data or []

    member_ids = [m["id"] for m in members]
    payments = []
    if member_ids:
        pay_res = (
            db.table("payments")
            .select("*")
            .in_("member_id", member_ids)
            .order("created_at", desc=True)
            .execute()
        )
        payments = pay_res.data or []

    return {"members": members, "payments": payments}
