"""Analytics endpoints — backed by Postgres RPCs that aggregate server-side."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from supabase import Client

from auth.utils import require_admin
from database import get_db
from models.schemas import (
    AnalyticsSummary,
    Period,
    TimeseriesCostPoint,
    TimeseriesCostResponse,
    TimeseriesMessagesPoint,
    TimeseriesMessagesResponse,
)
from utils.period import resolve_period

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _get_costs(db: Client) -> tuple[float, float]:
    res = (
        db.table("settings")
        .select("twilio_whatsapp_cost, twilio_sms_cost")
        .eq("id", 1)
        .single()
        .execute()
    )
    row = res.data or {}
    return float(row.get("twilio_whatsapp_cost") or 0.0), float(row.get("twilio_sms_cost") or 0.0)


@router.get("/summary", response_model=AnalyticsSummary, dependencies=[Depends(require_admin)])
async def analytics_summary(
    period: Optional[Period] = Query(default="month"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Client = Depends(get_db),
):
    start_ts, end_ts = resolve_period(period, start_date, end_date)
    res = db.rpc(
        "analytics_summary",
        {"p_start": start_ts.isoformat(), "p_end": end_ts.isoformat()},
    ).execute()
    rows = res.data or [{}]
    row = rows[0] if rows else {}

    wa_cost, sms_cost = _get_costs(db)
    wa = int(row.get("whatsapp_count") or 0)
    sms = int(row.get("sms_count") or 0)
    estimated_cost = round(wa * wa_cost + sms * sms_cost, 4)

    return AnalyticsSummary(
        total_orgs=int(row.get("total_orgs") or 0),
        total_members=int(row.get("total_members") or 0),
        total_messages=int(row.get("total_messages") or 0),
        whatsapp_count=wa,
        sms_count=sms,
        estimated_cost=estimated_cost,
    )


@router.get(
    "/messages",
    response_model=TimeseriesMessagesResponse,
    dependencies=[Depends(require_admin)],
)
async def analytics_messages(
    period: Optional[Period] = Query(default="month"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    organisation_id: Optional[str] = Query(default=None),
    group_by: str = Query(default="day", pattern="^(day|week|month)$"),
    db: Client = Depends(get_db),
):
    start_ts, end_ts = resolve_period(period, start_date, end_date)
    res = db.rpc(
        "analytics_messages_timeseries",
        {
            "p_start": start_ts.isoformat(),
            "p_end": end_ts.isoformat(),
            "p_org_id": organisation_id,
            "p_bucket": group_by,
        },
    ).execute()
    rows = res.data or []
    points = [
        TimeseriesMessagesPoint(
            date=r["bucket"],
            whatsapp=int(r.get("whatsapp") or 0),
            sms=int(r.get("sms") or 0),
            total=int(r.get("total") or 0),
        )
        for r in rows
    ]
    return TimeseriesMessagesResponse(data=points)


@router.get(
    "/cost",
    response_model=TimeseriesCostResponse,
    dependencies=[Depends(require_admin)],
)
async def analytics_cost(
    period: Optional[Period] = Query(default="month"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    organisation_id: Optional[str] = Query(default=None),
    group_by: str = Query(default="day", pattern="^(day|week|month)$"),
    db: Client = Depends(get_db),
):
    start_ts, end_ts = resolve_period(period, start_date, end_date)
    wa_cost, sms_cost = _get_costs(db)

    res = db.rpc(
        "analytics_cost_timeseries",
        {
            "p_start": start_ts.isoformat(),
            "p_end": end_ts.isoformat(),
            "p_org_id": organisation_id,
            "p_bucket": group_by,
            "p_wa_cost": wa_cost,
            "p_sms_cost": sms_cost,
        },
    ).execute()
    rows = res.data or []

    points = [
        TimeseriesCostPoint(
            date=r["bucket"],
            whatsapp_count=int(r.get("whatsapp_count") or 0),
            sms_count=int(r.get("sms_count") or 0),
            whatsapp_cost=float(r.get("whatsapp_cost") or 0.0),
            sms_cost=float(r.get("sms_cost") or 0.0),
            cost=float(r.get("cost") or 0.0),
        )
        for r in rows
    ]
    return TimeseriesCostResponse(data=points)
