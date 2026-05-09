"""CSV parsing/serialisation helpers."""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import date
from typing import Any, Iterable

CSV_HEADERS = ["full_name", "mobile", "email", "plan_name", "join_date", "next_due_date"]
_MOBILE_RE = re.compile(r"^\+?[0-9 \-]{6,20}$")


def template_csv() -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADERS)
    return buf.getvalue().encode("utf-8")


def _parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as e:
        raise ValueError(f"{field} must be ISO 8601 (YYYY-MM-DD)") from e


def _build_plan_name_index(
    org_plans: list[dict[str, Any]],
) -> tuple[dict[str, list[str]], set[str]]:
    """Map lowercased trimmed plan name → list of plan IDs.

    Returns (buckets, ambiguous_keys) where ambiguous_keys are lowercase names
    mapped to more than one distinct plan id (caller should reject those rows).
    """
    buckets: defaultdict[str, list[str]] = defaultdict(list)
    for p in org_plans:
        raw = (p.get("name") or "").strip()
        if not raw:
            continue
        key = raw.lower()
        pid = str(p.get("id", ""))
        if pid and pid not in buckets[key]:
            buckets[key].append(pid)
    ambiguous = {k for k, ids in buckets.items() if len(ids) > 1}
    return dict(buckets), ambiguous


def parse_members_csv(
    raw: bytes,
    organisation_id: str,
    org_plans: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse a members CSV.

    Each row references a plan by **plan_name** (must match a plan on this
    organisation, compared case-insensitively after trimming). The DB still
    stores `plan_id`; we resolve name → id here.

    Returns (valid_rows, errors). Each error: {row, reason}. Row indices are
    1-based and *exclude* the header row (i.e. row 1 = first data row).
    """
    valid_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    buckets, ambiguous = _build_plan_name_index(org_plans)

    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        errors.append({"row": 0, "reason": "CSV has no header row"})
        return valid_rows, errors

    missing = [h for h in ("full_name", "mobile", "plan_name") if h not in reader.fieldnames]
    if missing:
        errors.append(
            {"row": 0, "reason": f"missing required columns: {', '.join(missing)}"}
        )
        return valid_rows, errors

    for idx, row in enumerate(reader, start=1):
        try:
            full_name = (row.get("full_name") or "").strip()
            mobile = (row.get("mobile") or "").strip()
            email = (row.get("email") or "").strip() or None
            plan_name_raw = (row.get("plan_name") or "").strip()
            join_date_raw = (row.get("join_date") or "").strip()
            next_due_raw = (row.get("next_due_date") or "").strip()

            if not full_name:
                raise ValueError("full_name is required")
            if not mobile:
                raise ValueError("mobile is required")
            if not _MOBILE_RE.match(mobile):
                raise ValueError("mobile is not a valid phone number")
            if not plan_name_raw:
                raise ValueError("plan_name is required")

            key = plan_name_raw.lower()
            if key in ambiguous:
                raise ValueError(
                    "plan_name matches multiple plans — plan names must be "
                    "unique within the organisation for CSV import"
                )
            if key not in buckets:
                raise ValueError(
                    "plan_name does not exist for this organisation "
                    "(check spelling against organisation plans)"
                )

            plan_id = buckets[key][0]

            join_date = _parse_date(join_date_raw, "join_date") if join_date_raw else None
            next_due_date = (
                _parse_date(next_due_raw, "next_due_date") if next_due_raw else None
            )

            valid_rows.append(
                {
                    "organisation_id": organisation_id,
                    "full_name": full_name,
                    "mobile": mobile,
                    "email": email,
                    "plan_id": plan_id,
                    "join_date": join_date.isoformat() if join_date else None,
                    "next_due_date": next_due_date.isoformat() if next_due_date else None,
                }
            )
        except Exception as e:
            errors.append({"row": idx, "reason": str(e)})

    return valid_rows, errors


def rows_to_csv(
    rows: Iterable[dict[str, Any]],
    columns: list[str],
) -> bytes:
    """Serialise rows to a CSV byte string with the given column order."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        clean = {}
        for col in columns:
            v = row.get(col)
            if isinstance(v, (dict, list)):
                import json

                v = json.dumps(v, separators=(",", ":"), ensure_ascii=False)
            clean[col] = "" if v is None else v
        writer.writerow(clean)
    return buf.getvalue().encode("utf-8")
