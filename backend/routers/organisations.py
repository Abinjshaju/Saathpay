"""Organisations router — onboarding + management."""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from supabase import Client

from auth.utils import hash_password, org_scope_admin, org_scope_any, require_admin
from database import get_db
from models.schemas import (
    BulkSendItem,
    BulkSendResponse,
    CsvImportError,
    CsvImportPreview,
    CsvImportResult,
    DueRemindersResponse,
    MemberCreate,
    MemberRead,
    MessageListResponse,
    MessageRead,
    OrganisationCreateForm,
    OrganisationDetail,
    OrganisationRead,
    OrganisationStatusUpdate,
    OrganisationUpdate,
    PaginatedResponse,
    PlanRead,
    OrgUserRead,
)
from services.csv_service import parse_members_csv
from services.log_service import log_event
from services.member_welcome import try_send_member_welcome
from services.channel_messaging import send_for_org_channels
from services.messaging import persist_message
from services.twilio_service import TwilioCreds, load_twilio_creds, send_with_fallback
from services.storage_service import (
    delete_logo,
    read_and_validate_logo,
    signed_logo_url,
    upload_logo_bytes,
)
from utils.errors import ErrorCode, api_error, forbidden, not_found
from utils.pagination import PageParams, make_page, page_params

_log = logging.getLogger("saathpay.org")

router = APIRouter(prefix="/organisations", tags=["organisations"])

EXPORT_USER_COLS = ["id", "organisation_id", "full_name", "username", "mobile", "email", "role", "created_at"]

TPL_REMINDER_TOMORROW = (
    "Hello {member_name} your monthly fee payment of inr. {amount} for {organisation_name} "
    "is due tommorow, please make the payment accordingly!"
)
TPL_REMINDER_TODAY = (
    "Hello {member_name} your monthly fee payment of inr. {amount} for {organisation_name} "
    "is due today, please make the payment to upi number {upi_number} or upi id : {upi_id}"
)

_CYCLE_DAYS = {"monthly": 30, "quarterly": 90, "annual": 365}


def _parse_iso_date(val: Any) -> date | None:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    return date.fromisoformat(str(val)[:10])


def resolve_member_due(member: dict[str, Any], plan: dict[str, Any] | None) -> date | None:
    if not plan:
        return None
    cycle = _CYCLE_DAYS.get(plan.get("billing_cycle"), 30)
    jd = _parse_iso_date(member.get("join_date"))
    if jd:
        return jd + timedelta(days=cycle)
    return _parse_iso_date(member.get("next_due_date"))


def _format_inr_amount(amount: Any) -> str:
    try:
        a = float(amount)
        if a == int(a):
            return str(int(a))
        return f"{a:.2f}"
    except (TypeError, ValueError):
        return str(amount or "0")


def _hydrate_logo(org: dict[str, Any]) -> dict[str, Any]:
    org["logo_signed_url"] = signed_logo_url(org.get("logo_url"))
    return org


def _fetch_org(db: Client, org_id: str) -> dict[str, Any]:
    res = db.table("organisations").select("*").eq("id", org_id).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise not_found(ErrorCode.ORG_NOT_FOUND, f"organisation {org_id} not found")
    return rows[0]


# -----------------------------------------------------------------------------
# CREATE — multipart with optional logo file + JSON `payload` form field
# -----------------------------------------------------------------------------

@router.post(
    "",
    response_model=OrganisationDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_organisation(
    payload: str = Form(..., description="JSON body conforming to OrganisationCreateForm"),
    logo: Optional[UploadFile] = File(default=None),
    db: Client = Depends(get_db),
):
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as e:
        raise api_error(ErrorCode.INVALID_REQUEST, f"payload is not valid JSON: {e}") from e

    form = OrganisationCreateForm.model_validate(parsed)

    logo_path: str | None = None
    if logo is not None and logo.filename:
        data, ext = await read_and_validate_logo(logo)
        logo_path = f"{uuid4()}.{ext}"
        upload_logo_bytes(data, logo_path, logo.content_type or "application/octet-stream")

    rpc_payload = {
        "name": form.name,
        "type": form.type,
        "custom_type": form.custom_type,
        "logo_url": logo_path,
        "address": form.address,
        "maps_url": form.maps_url,
        "upi_id": form.upi_id,
        "upi_number": form.upi_number,
        "whatsapp_enabled": form.whatsapp_enabled,
        "sms_enabled": form.sms_enabled,
        "users": [
            {
                "full_name": u.full_name,
                "username": u.username,
                "mobile": u.mobile,
                "email": u.email,
                "password_hash": hash_password(u.password),
                "role": u.role,
            }
            for u in form.users
        ],
        "plans": [
            {
                "name": p.name,
                "amount": p.amount,
                "billing_cycle": p.billing_cycle,
                "description": p.description,
            }
            for p in form.plans
        ],
    }

    try:
        rpc = db.rpc("create_organisation_with_users_plans", {"payload": rpc_payload}).execute()
        new_org_id: str | None = rpc.data
        if not new_org_id:
            raise RuntimeError("RPC returned no organisation id")
    except Exception as e:
        if logo_path:
            delete_logo(logo_path)
        msg = str(e)
        if "USER_MIN_REQUIRED" in msg:
            raise api_error(ErrorCode.USER_MIN_REQUIRED, "at least 2 users are required") from e
        if "PLAN_LIMIT_EXCEEDED" in msg:
            raise api_error(
                ErrorCode.PLAN_LIMIT_EXCEEDED,
                "plans must contain 1 to 5 entries",
            ) from e
        if "duplicate key" in msg.lower() and "username" in msg.lower():
            raise api_error(ErrorCode.DUPLICATE_USERNAME, "username already taken") from e
        if "duplicate key" in msg.lower() and "email" in msg.lower():
            raise api_error(ErrorCode.DUPLICATE_EMAIL, "email already taken") from e
        _log.exception("organisation_create_failed")
        raise api_error(ErrorCode.INTERNAL_ERROR, "failed to create organisation", 500) from e

    log_event(level="info", event="organisation.created", organisation_id=new_org_id)
    return await get_organisation(new_org_id, db=db)


# -----------------------------------------------------------------------------
# LIST
# -----------------------------------------------------------------------------

@router.get(
    "",
    response_model=PaginatedResponse,
    dependencies=[Depends(require_admin)],
)
async def list_organisations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    pagination: PageParams = Depends(page_params),
    db: Client = Depends(get_db),
):
    res = db.rpc(
        "org_list_with_counts",
        {
            "p_status": status_filter,
            "p_search": search,
            "p_limit": pagination.limit,
            "p_offset": pagination.offset,
        },
    ).execute()

    rows = res.data or []
    total = int(rows[0]["total_count"]) if rows else 0
    data = [
        OrganisationRead.model_validate(_hydrate_logo({k: v for k, v in r.items() if k != "total_count"})).model_dump(mode="json")
        for r in rows
    ]
    return make_page(data, total, pagination)


# -----------------------------------------------------------------------------
# GET DETAIL
# -----------------------------------------------------------------------------

@router.get(
    "/{org_id}",
    response_model=OrganisationDetail,
    dependencies=[Depends(org_scope_any)],
)
async def get_organisation(org_id: str, db: Client = Depends(get_db)):
    org = _fetch_org(db, org_id)

    users = (
        db.table("users")
        .select("id, organisation_id, full_name, username, mobile, email, role, created_at")
        .eq("organisation_id", org_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    plans = (
        db.table("plans")
        .select("*")
        .eq("organisation_id", org_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    member_count = (
        db.table("members")
        .select("id", count="exact", head=True)
        .eq("organisation_id", org_id)
        .execute()
        .count
        or 0
    )

    org["member_count"] = member_count
    org["message_count_month"] = None
    detail = _hydrate_logo(org)
    detail["users"] = [OrgUserRead.model_validate(u).model_dump(mode="json") for u in users]
    detail["plans"] = [PlanRead.model_validate(p).model_dump(mode="json") for p in plans]
    return detail


# -----------------------------------------------------------------------------
# UPDATE
# -----------------------------------------------------------------------------

@router.put(
    "/{org_id}",
    response_model=OrganisationDetail,
    dependencies=[Depends(require_admin)],
)
async def update_organisation(
    org_id: str,
    payload: str = Form(..., description="JSON body conforming to OrganisationUpdate"),
    logo: Optional[UploadFile] = File(default=None),
    db: Client = Depends(get_db),
):
    org = _fetch_org(db, org_id)

    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as e:
        raise api_error(ErrorCode.INVALID_REQUEST, f"payload is not valid JSON: {e}") from e

    form = OrganisationUpdate.model_validate(parsed)

    update_fields: dict[str, Any] = {}
    for k in (
        "name",
        "type",
        "custom_type",
        "address",
        "maps_url",
        "upi_id",
        "upi_number",
        "whatsapp_enabled",
        "sms_enabled",
    ):
        v = getattr(form, k)
        if v is not None:
            update_fields[k] = v

    new_logo_path: str | None = None
    old_logo_path: str | None = org.get("logo_url")
    if logo is not None and logo.filename:
        data, ext = await read_and_validate_logo(logo)
        new_logo_path = f"{uuid4()}.{ext}"
        upload_logo_bytes(data, new_logo_path, logo.content_type or "application/octet-stream")
        update_fields["logo_url"] = new_logo_path

    if form.plans is not None:
        existing_plans = (
            db.table("plans").select("id").eq("organisation_id", org_id).execute().data or []
        )
        existing_plan_ids = {p["id"] for p in existing_plans}
        members_with_plan = (
            db.table("members")
            .select("id, plan_id")
            .eq("organisation_id", org_id)
            .execute()
            .data
            or []
        )
        in_use_plan_ids = {m["plan_id"] for m in members_with_plan if m.get("plan_id")}
        plans_in_use_to_remove = in_use_plan_ids & existing_plan_ids
        if plans_in_use_to_remove:
            if new_logo_path:
                delete_logo(new_logo_path)
            raise api_error(
                ErrorCode.PLAN_IN_USE,
                "cannot remove plans that have members assigned",
            )

    try:
        if update_fields:
            db.table("organisations").update(update_fields).eq("id", org_id).execute()

        if form.users is not None:
            db.table("users").delete().eq("organisation_id", org_id).execute()
            db.table("users").insert(
                [
                    {
                        "organisation_id": org_id,
                        "full_name": u.full_name,
                        "username": u.username,
                        "mobile": u.mobile,
                        "email": u.email,
                        "password_hash": hash_password(u.password),
                        "role": u.role,
                    }
                    for u in form.users
                ]
            ).execute()

        if form.plans is not None:
            db.table("plans").delete().eq("organisation_id", org_id).execute()
            db.table("plans").insert(
                [
                    {
                        "organisation_id": org_id,
                        "name": p.name,
                        "amount": p.amount,
                        "billing_cycle": p.billing_cycle,
                        "description": p.description,
                    }
                    for p in form.plans
                ]
            ).execute()
    except Exception:
        if new_logo_path:
            delete_logo(new_logo_path)
        raise

    if new_logo_path and old_logo_path and old_logo_path != new_logo_path:
        delete_logo(old_logo_path)

    log_event(level="info", event="organisation.updated", organisation_id=org_id)
    return await get_organisation(org_id, db=db)


# -----------------------------------------------------------------------------
# STATUS
# -----------------------------------------------------------------------------

@router.patch(
    "/{org_id}/status",
    dependencies=[Depends(require_admin)],
)
async def update_organisation_status(
    org_id: str,
    body: OrganisationStatusUpdate,
    db: Client = Depends(get_db),
):
    _fetch_org(db, org_id)
    db.table("organisations").update({"status": body.status}).eq("id", org_id).execute()
    log_event(
        level="info",
        event=f"organisation.{body.status}",
        organisation_id=org_id,
        meta={"status": body.status},
    )
    return {"id": org_id, "status": body.status}


# -----------------------------------------------------------------------------
# DELETE (with optional ZIP export)
# -----------------------------------------------------------------------------

@router.delete(
    "/{org_id}",
    dependencies=[Depends(require_admin)],
)
async def delete_organisation(
    org_id: str,
    export: bool = Query(default=False),
    db: Client = Depends(get_db),
):
    org = _fetch_org(db, org_id)

    if export:
        from io import BytesIO
        from zipfile import ZIP_DEFLATED, ZipFile

        from services.csv_service import rows_to_csv

        members = (
            db.table("members").select("*").eq("organisation_id", org_id).execute().data or []
        )
        msgs = (
            db.table("messages").select("*").eq("organisation_id", org_id).execute().data or []
        )

        buf = BytesIO()
        with ZipFile(buf, "w", ZIP_DEFLATED) as z:
            z.writestr(
                "members.csv",
                rows_to_csv(
                    members,
                    [
                        "id", "organisation_id", "plan_id", "full_name", "mobile",
                        "email", "join_date", "next_due_date", "created_at",
                    ],
                ),
            )
            z.writestr(
                "messages.csv",
                rows_to_csv(
                    msgs,
                    [
                        "id", "organisation_id", "member_id", "channel", "status",
                        "twilio_sid", "body", "error", "sent_at",
                    ],
                ),
            )

        if org.get("logo_url"):
            delete_logo(org["logo_url"])
        db.table("organisations").delete().eq("id", org_id).execute()
        log_event(
            level="info",
            event="organisation.deleted",
            organisation_id=org_id,
            meta={"exported": True},
        )

        from datetime import datetime, timezone

        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return Response(
            content=buf.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="organisation_{org_id}_{ts}.zip"'
            },
        )

    if org.get("logo_url"):
        delete_logo(org["logo_url"])
    db.table("organisations").delete().eq("id", org_id).execute()
    log_event(level="info", event="organisation.deleted", organisation_id=org_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# MEMBERS within an organisation
# -----------------------------------------------------------------------------

@router.get(
    "/{org_id}/members",
    response_model=PaginatedResponse,
    dependencies=[Depends(org_scope_any)],
)
async def list_org_members(
    org_id: str,
    plan_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    pagination: PageParams = Depends(page_params),
    db: Client = Depends(get_db),
):
    _fetch_org(db, org_id)

    q = (
        db.table("members")
        .select("*, plans(name)", count="exact")
        .eq("organisation_id", org_id)
    )
    if plan_id:
        q = q.eq("plan_id", plan_id)
    if search:
        q = q.or_(f"full_name.ilike.%{search}%,mobile.ilike.%{search}%")

    res = q.order("created_at", desc=True).range(pagination.offset, pagination.range_end).execute()
    rows = res.data or []
    total = res.count or 0

    data: list[dict[str, Any]] = []
    for r in rows:
        plan = r.pop("plans", None)
        r["plan_name"] = (plan or {}).get("name") if isinstance(plan, dict) else None
        data.append(MemberRead.model_validate(r).model_dump(mode="json"))

    return make_page(data, total, pagination)


@router.post(
    "/{org_id}/members",
    response_model=MemberRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(org_scope_admin)],
)
async def add_org_member(
    org_id: str,
    body: MemberCreate,
    db: Client = Depends(get_db),
):
    org = _fetch_org(db, org_id)

    plan = (
        db.table("plans")
        .select("id, name")
        .eq("id", str(body.plan_id))
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not plan:
        raise api_error(ErrorCode.PLAN_NOT_FOUND, "plan does not belong to this organisation")

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

    member["plan_name"] = plan[0]["name"]
    log_event(
        level="info",
        event="member.created",
        organisation_id=org_id,
        meta={"member_id": member["id"]},
    )
    try_send_member_welcome(db, org=org, member=member, plan_name=plan[0]["name"])
    return MemberRead.model_validate(member).model_dump(mode="json")


# -----------------------------------------------------------------------------
# CSV import — two-step
# -----------------------------------------------------------------------------

@router.post(
    "/{org_id}/members/import",
    response_model=CsvImportPreview,
)
async def upload_members_csv(
    org_id: str,
    file: UploadFile = File(...),
    confirm: bool = Query(default=False),
    db: Client = Depends(get_db),
    claims: dict = Depends(org_scope_admin),
):
    _fetch_org(db, org_id)

    plans_res = db.table("plans").select("id, name").eq("organisation_id", org_id).execute()
    org_plans = plans_res.data or []

    raw = await file.read()
    valid_rows, errors = parse_members_csv(raw, org_id, org_plans)

    # admin_user_id FK targets admin_users only — omit for org-user imports
    admin_uid = claims.get("sub") if claims.get("kind") == "admin" else None

    insert_res = (
        db.table("member_imports")
        .insert(
            {
                "organisation_id": org_id,
                "admin_user_id": admin_uid,
                "rows": valid_rows,
                "errors": errors,
                "status": "pending",
            }
        )
        .execute()
    )
    rec = (insert_res.data or [None])[0]
    if not rec:
        raise api_error(ErrorCode.INTERNAL_ERROR, "failed to stage import", 500)

    log_event(
        level="info",
        event="members.import.uploaded",
        organisation_id=org_id,
        meta={
            "import_id": rec["id"],
            "valid_rows": len(valid_rows),
            "error_rows": len(errors),
        },
    )

    if confirm:
        return await confirm_members_import(org_id, rec["id"], db=db)  # type: ignore[return-value]

    return CsvImportPreview(
        import_id=rec["id"],
        organisation_id=org_id,
        valid_rows=len(valid_rows),
        error_rows=len(errors),
        errors=[CsvImportError(**e) for e in errors],
        expires_at=rec["expires_at"],
    )


@router.post(
    "/{org_id}/members/import/{import_id}/confirm",
    response_model=CsvImportResult,
    dependencies=[Depends(org_scope_admin)],
)
async def confirm_members_import(
    org_id: str,
    import_id: str,
    db: Client = Depends(get_db),
):
    res = (
        db.table("member_imports")
        .select("*")
        .eq("id", import_id)
        .eq("organisation_id", org_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise not_found(ErrorCode.IMPORT_NOT_FOUND, f"import {import_id} not found")
    rec = rows[0]
    if rec["status"] == "confirmed":
        raise api_error(ErrorCode.IMPORT_ALREADY_CONFIRMED, "import has already been confirmed")

    from datetime import datetime, timezone

    expires_at = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        db.table("member_imports").update({"status": "expired"}).eq("id", import_id).execute()
        raise api_error(ErrorCode.IMPORT_EXPIRED, "import has expired; please re-upload")

    valid_rows: list[dict[str, Any]] = rec.get("rows") or []
    errors: list[dict[str, Any]] = rec.get("errors") or []

    imported = 0
    if valid_rows:
        ins = db.table("members").insert(valid_rows).execute()
        imported = len(ins.data or [])

    db.table("member_imports").update({"status": "confirmed"}).eq("id", import_id).execute()

    log_event(
        level="info",
        event="members.import.confirmed",
        organisation_id=org_id,
        meta={"import_id": import_id, "imported": imported, "skipped": len(errors)},
    )

    return CsvImportResult(
        imported=imported,
        skipped=len(errors),
        errors=[CsvImportError(**e) for e in errors],
    )


# -----------------------------------------------------------------------------
# MESSAGES within an organisation
# -----------------------------------------------------------------------------

@router.get(
    "/{org_id}/messages",
    response_model=MessageListResponse,
    dependencies=[Depends(org_scope_any)],
)
async def list_org_messages(
    org_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    pagination: PageParams = Depends(page_params),
    db: Client = Depends(get_db),
):
    from utils.period import resolve_period

    _fetch_org(db, org_id)

    if start_date or end_date:
        start_ts, end_ts = resolve_period("custom", start_date, end_date)
    else:
        start_ts, end_ts = resolve_period("month", None, None)

    q = (
        db.table("messages")
        .select("*", count="exact")
        .eq("organisation_id", org_id)
        .gte("sent_at", start_ts.isoformat())
        .lt("sent_at", end_ts.isoformat())
    )
    if channel and channel != "all":
        q = q.eq("channel", channel)

    res = q.order("sent_at", desc=True).range(pagination.offset, pagination.range_end).execute()
    rows = res.data or []
    total = res.count or 0

    wa_count = (
        db.table("messages")
        .select("id", count="exact", head=True)
        .eq("organisation_id", org_id)
        .eq("channel", "whatsapp")
        .gte("sent_at", start_ts.isoformat())
        .lt("sent_at", end_ts.isoformat())
        .execute()
        .count
        or 0
    )
    sms_count = (
        db.table("messages")
        .select("id", count="exact", head=True)
        .eq("organisation_id", org_id)
        .eq("channel", "sms")
        .gte("sent_at", start_ts.isoformat())
        .lt("sent_at", end_ts.isoformat())
        .execute()
        .count
        or 0
    )

    return MessageListResponse(
        data=[MessageRead.model_validate(r) for r in rows],
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        whatsapp_count=wa_count,
        sms_count=sms_count,
    )


def _run_reminder_bucket(
    db: Client,
    creds: TwilioCreds,
    org: dict[str, Any],
    org_id: str,
    bucket: list[tuple[dict[str, Any], dict[str, Any]]],
    template: str,
    *,
    require_upi: bool,
) -> BulkSendResponse:
    sent = 0
    failed = 0
    results: list[BulkSendItem] = []
    upi_ok = bool(org.get("upi_id")) or bool(org.get("upi_number"))

    for member, plan in bucket:
        mid = member["id"]
        if require_upi and not upi_ok:
            failed += 1
            results.append(
                BulkSendItem(
                    member_id=UUID(mid),
                    success=False,
                    error="UPI not configured for this organisation",
                )
            )
            continue

        text = template.format(
            member_name=member.get("full_name", "Member"),
            amount=_format_inr_amount(plan.get("amount")),
            organisation_name=org.get("name", ""),
            upi_number=org.get("upi_number") or "",
            upi_id=org.get("upi_id") or "",
        )
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
                results.append(
                    BulkSendItem(
                        member_id=UUID(mid),
                        success=False,
                        error="no channels enabled for this organisation",
                    )
                )
            for channel, saved, result in sends:
                ok = result.status != "failed" and result.twilio_sid is not None
                if ok:
                    sent += 1
                else:
                    failed += 1
                results.append(
                    BulkSendItem(
                        member_id=UUID(mid),
                        success=ok,
                        channel=channel,  # type: ignore[arg-type]
                        status=saved.get("status"),
                        twilio_sid=result.twilio_sid,
                        error=result.error,
                    )
                )
        except Exception as e:
            failed += 1
            results.append(BulkSendItem(member_id=UUID(mid), success=False, error=str(e)))

    return BulkSendResponse(sent=sent, failed=failed, results=results)


@router.post(
    "/{org_id}/messages/send-due-reminders",
    response_model=DueRemindersResponse,
    dependencies=[Depends(org_scope_any)],
)
async def send_due_reminders(org_id: str, db: Client = Depends(get_db)):
    creds = load_twilio_creds()
    if not creds.messaging_enabled:
        raise forbidden(ErrorCode.MESSAGING_DISABLED, "messaging is globally disabled")

    org = _fetch_org(db, org_id)
    if org.get("status") != "active":
        raise forbidden(ErrorCode.ORG_PAUSED, "organisation is paused")

    mres = (
        db.table("members")
        .select("*, plans(billing_cycle, amount, name)")
        .eq("organisation_id", org_id)
        .execute()
    )
    rows = mres.data or []

    today = date.today()
    tomorrow = today + timedelta(days=1)

    bucket_today: list[tuple[dict[str, Any], dict[str, Any]]] = []
    bucket_tomorrow: list[tuple[dict[str, Any], dict[str, Any]]] = []

    for row in rows:
        plan_raw = row.pop("plans", None)
        if isinstance(plan_raw, list):
            plan = plan_raw[0] if plan_raw else None
        elif isinstance(plan_raw, dict):
            plan = plan_raw
        else:
            plan = None

        due = resolve_member_due(row, plan)
        if due is None or not plan:
            continue
        if due == today:
            bucket_today.append((row, plan))
        elif due == tomorrow:
            bucket_tomorrow.append((row, plan))

    due_today_resp = _run_reminder_bucket(
        db,
        creds,
        org,
        org_id,
        bucket_today,
        TPL_REMINDER_TODAY,
        require_upi=True,
    )
    due_tomorrow_resp = _run_reminder_bucket(
        db,
        creds,
        org,
        org_id,
        bucket_tomorrow,
        TPL_REMINDER_TOMORROW,
        require_upi=False,
    )

    log_event(
        level="info",
        event="message.due_reminders",
        organisation_id=org_id,
        meta={
            "today_sent": due_today_resp.sent,
            "today_failed": due_today_resp.failed,
            "tomorrow_sent": due_tomorrow_resp.sent,
            "tomorrow_failed": due_tomorrow_resp.failed,
        },
    )

    return DueRemindersResponse(
        organisation_id=UUID(org_id),
        due_today=due_today_resp,
        due_tomorrow=due_tomorrow_resp,
    )
