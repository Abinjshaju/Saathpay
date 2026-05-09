"""Audit logging — writes a row to the `logs` table.

Failures here MUST NOT propagate; if logging breaks, the originating request
should still succeed (we just log to stderr).
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from database import get_supabase

LogLevel = Literal["info", "warning", "error"]

_log = logging.getLogger("saathpay.audit")


def log_event(
    level: LogLevel,
    event: str,
    organisation_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """Write a business event to the `logs` table.

    Best-effort: never raises.
    """
    try:
        get_supabase().table("logs").insert(
            {
                "level": level,
                "event": event,
                "organisation_id": organisation_id,
                "meta": meta,
            }
        ).execute()
    except Exception:
        _log.exception(
            "log_event_failed event=%s org_id=%s", event, organisation_id
        )
