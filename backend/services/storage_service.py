"""Logo storage helpers backed by a private Supabase Storage bucket.

`organisations.logo_url` stores the **storage path** (e.g. "abc-123.webp").
Responses include a freshly generated signed URL.
"""

from __future__ import annotations

import logging
from typing import Final

from fastapi import UploadFile

from config import get_settings
from database import get_supabase
from utils.errors import ErrorCode, api_error

_log = logging.getLogger("saathpay.storage")

ALLOWED_MIME: Final[set[str]] = {"image/jpeg", "image/png", "image/webp"}
EXT_BY_MIME: Final[dict[str, str]] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


async def read_and_validate_logo(upload: UploadFile) -> tuple[bytes, str]:
    """Read the upload's bytes and validate type+size. Returns (bytes, ext)."""
    settings = get_settings()
    mime = (upload.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise api_error(
            ErrorCode.INVALID_FILE_TYPE,
            "logo must be image/jpeg, image/png, or image/webp",
        )
    data = await upload.read()
    if len(data) > settings.logo_max_bytes:
        raise api_error(
            ErrorCode.FILE_TOO_LARGE,
            f"logo exceeds maximum size of {settings.logo_max_bytes} bytes",
        )
    return data, EXT_BY_MIME[mime]


def upload_logo_bytes(data: bytes, path: str, content_type: str) -> str:
    """Upload bytes to the org-logos bucket. Returns the storage path."""
    settings = get_settings()
    sb = get_supabase()
    sb.storage.from_(settings.supabase_logo_bucket).upload(
        path,
        data,
        {"content-type": content_type, "upsert": "true"},
    )
    return path


def signed_logo_url(path: str | None) -> str | None:
    """Return a freshly signed URL for `path`, or None on missing/error."""
    if not path:
        return None
    settings = get_settings()
    try:
        res = (
            get_supabase()
            .storage.from_(settings.supabase_logo_bucket)
            .create_signed_url(path, settings.logo_signed_url_ttl_seconds)
        )
        return res.get("signedURL") or res.get("signed_url") or res.get("signedUrl")
    except Exception:
        _log.exception("signed_url_failed path=%s", path)
        return None


def delete_logo(path: str | None) -> None:
    if not path:
        return
    settings = get_settings()
    try:
        get_supabase().storage.from_(settings.supabase_logo_bucket).remove([path])
    except Exception:
        _log.exception("delete_logo_failed path=%s", path)
