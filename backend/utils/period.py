"""Period / date-range resolution.

Converts the API's `period` shortcut (today|week|month|year|custom) plus
optional ISO `start_date` / `end_date` into a concrete (start, end) timestamp
pair (UTC, end-exclusive).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from .errors import ErrorCode, api_error

Period = Literal["today", "week", "month", "year", "custom"]


def _parse_iso_date(value: str | None, field: str) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as e:
        raise api_error(
            ErrorCode.INVALID_REQUEST,
            f"{field} must be ISO 8601 (YYYY-MM-DD)",
        ) from e


def resolve_period(
    period: Period | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> tuple[datetime, datetime]:
    """Resolve a period spec to a (start_utc, end_utc) datetime pair.

    `end` is exclusive (i.e. `messages.sent_at < end`). If nothing is provided,
    defaults to the current month.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    if period == "custom" or (period is None and (start_date or end_date)):
        s = _parse_iso_date(start_date, "start_date")
        e = _parse_iso_date(end_date, "end_date")
        if s is None or e is None:
            raise api_error(
                ErrorCode.INVALID_REQUEST,
                "custom period requires both start_date and end_date",
            )
        if e < s:
            raise api_error(
                ErrorCode.INVALID_REQUEST,
                "end_date must be on or after start_date",
            )
        start = datetime.combine(s, time.min, tzinfo=timezone.utc)
        end = datetime.combine(e + timedelta(days=1), time.min, tzinfo=timezone.utc)
        return start, end

    if period == "today":
        start = datetime.combine(today, time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end

    if period == "week":
        start_d = today - timedelta(days=today.weekday())
        start = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=7)
        return start, end

    if period == "year":
        start = datetime(today.year, 1, 1, tzinfo=timezone.utc)
        end = datetime(today.year + 1, 1, 1, tzinfo=timezone.utc)
        return start, end

    start = datetime(today.year, today.month, 1, tzinfo=timezone.utc)
    if today.month == 12:
        end = datetime(today.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(today.year, today.month + 1, 1, tzinfo=timezone.utc)
    return start, end
