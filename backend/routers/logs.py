"""Logs endpoints — list + CSV export."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from supabase import Client

from auth.utils import require_admin
from database import get_db
from models.schemas import PaginatedResponse, LogRead
from services.csv_service import rows_to_csv
from utils.pagination import PageParams, make_page, page_params
from utils.period import resolve_period

router = APIRouter(prefix="/logs", tags=["logs"])


def _build_query(
    db: Client,
    *,
    level: str | None,
    organisation_id: str | None,
    start_date: str | None,
    end_date: str | None,
    count: bool,
):
    if start_date or end_date:
        start_ts, end_ts = resolve_period("custom", start_date, end_date)
    else:
        start_ts = end_ts = None

    q = db.table("logs").select("*", count="exact" if count else None)
    if level:
        q = q.eq("level", level)
    if organisation_id:
        q = q.eq("organisation_id", organisation_id)
    if start_ts is not None and end_ts is not None:
        q = q.gte("created_at", start_ts.isoformat()).lt("created_at", end_ts.isoformat())
    return q


@router.get("", response_model=PaginatedResponse, dependencies=[Depends(require_admin)])
async def list_logs(
    level: Optional[str] = Query(default=None, pattern="^(info|warning|error)$"),
    organisation_id: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    pagination: PageParams = Depends(page_params),
    db: Client = Depends(get_db),
):
    q = _build_query(
        db,
        level=level,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        count=True,
    )
    res = q.order("created_at", desc=True).range(pagination.offset, pagination.range_end).execute()
    rows = res.data or []
    total = res.count or 0
    data = [LogRead.model_validate(r).model_dump(mode="json") for r in rows]
    return make_page(data, total, pagination)


@router.get("/export", dependencies=[Depends(require_admin)])
async def export_logs(
    level: Optional[str] = Query(default=None, pattern="^(info|warning|error)$"),
    organisation_id: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Client = Depends(get_db),
):
    q = _build_query(
        db,
        level=level,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        count=False,
    )
    rows = q.order("created_at", desc=True).limit(50000).execute().data or []

    cols = ["id", "level", "event", "organisation_id", "meta", "created_at"]
    csv_bytes = rows_to_csv(rows, cols)

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="logs_export.csv"'},
    )
