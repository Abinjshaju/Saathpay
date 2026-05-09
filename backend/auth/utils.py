"""Auth utilities: password hashing, JWT issue/verify, FastAPI dependency."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from config import get_settings
from utils.errors import ErrorCode, forbidden, unauthorized

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def token_kind(claims: dict[str, Any]) -> str:
    """JWTs issued before `kind` existed are treated as Saathpay admin."""
    return claims.get("kind") or "admin"


def create_jwt(
    subject: str,
    role: str = "superadmin",
    *,
    kind: Literal["admin", "user"] = "admin",
    organisation_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expiry_minutes)).timestamp()),
    }
    if organisation_id is not None:
        payload["organisation_id"] = organisation_id
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_jwt(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


async def require_auth(token: str | None = Depends(oauth2_scheme)) -> dict[str, Any]:
    if not token:
        raise unauthorized(ErrorCode.UNAUTHORIZED, "missing bearer token")
    payload = verify_jwt(token)
    if not payload or "sub" not in payload:
        raise unauthorized(ErrorCode.UNAUTHORIZED, "invalid or expired token")
    return payload


async def require_admin(claims: dict = Depends(require_auth)) -> dict[str, Any]:
    if token_kind(claims) != "admin":
        raise forbidden(ErrorCode.FORBIDDEN, "Saathpay admin access required")
    return claims


async def require_user(claims: dict = Depends(require_auth)) -> dict[str, Any]:
    if claims.get("kind") != "user":
        raise forbidden(ErrorCode.FORBIDDEN, "organisation user access required")
    return claims


def enforce_org_scope(
    claims: dict[str, Any],
    organisation_id: str,
    *,
    min_role: Literal["any", "admin"] = "any",
) -> None:
    """Raise 403 unless caller may act on this organisation."""
    if token_kind(claims) == "admin":
        return
    if claims.get("kind") != "user":
        raise forbidden(ErrorCode.FORBIDDEN, "invalid token for this resource")
    sid = str(claims.get("organisation_id") or "")
    if sid != str(organisation_id):
        raise forbidden(ErrorCode.FORBIDDEN, "out of scope for this organisation")
    if min_role == "admin" and claims.get("role") != "admin":
        raise forbidden(ErrorCode.FORBIDDEN, "organisation admin role required")


async def org_scope_any(org_id: str, claims: dict = Depends(require_auth)) -> dict[str, Any]:
    enforce_org_scope(claims, org_id, min_role="any")
    return claims


async def org_scope_admin(org_id: str, claims: dict = Depends(require_auth)) -> dict[str, Any]:
    enforce_org_scope(claims, org_id, min_role="admin")
    return claims


CurrentAdmin = dict[str, Any]
