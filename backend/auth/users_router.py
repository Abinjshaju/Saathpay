"""Organisation user auth — client app (JWT kind=user)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from auth.utils import create_jwt, hash_password, require_user, verify_password
from database import get_db
from models.schemas import (
    UserChangePasswordRequest,
    UserLoginRequest,
    UserMe,
    UserOrgSnippet,
    UserTokenResponse,
)
from services.log_service import log_event
from utils.errors import ErrorCode, unauthorized

router = APIRouter(prefix="/users", tags=["users"])

_SELECT_LOGIN = (
    "id, full_name, username, email, role, organisation_id, password_hash, "
    "organisations(id, name, status, upi_id, upi_number)"
)

_SELECT_ME = (
    "id, full_name, username, email, role, organisation_id, "
    "organisations(id, name, status, upi_id, upi_number)"
)


def _row_to_user_me(row: dict) -> UserMe:
    org = row.pop("organisations", None) or {}
    return UserMe(
        id=row["id"],
        full_name=row["full_name"],
        username=row["username"],
        email=row["email"],
        role=row["role"],
        organisation_id=row["organisation_id"],
        organisation=UserOrgSnippet(
            id=org["id"],
            name=org["name"],
            status=org["status"],
            upi_id=org.get("upi_id"),
            upi_number=org.get("upi_number"),
        ),
    )


@router.post("/login", response_model=UserTokenResponse)
async def user_login(body: UserLoginRequest, db: Client = Depends(get_db)):
    ident = body.identifier.strip()

    res = db.table("users").select(_SELECT_LOGIN).eq("username", ident).limit(1).execute()
    rows = res.data or []
    if not rows:
        res = db.table("users").select(_SELECT_LOGIN).eq("email", ident).limit(1).execute()
        rows = res.data or []

    user = rows[0] if rows else None
    if not user or not verify_password(body.password, user.get("password_hash") or ""):
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS, "invalid username/email or password")

    user.pop("password_hash", None)
    me = _row_to_user_me(user)

    token = create_jwt(
        subject=str(me.id),
        role=me.role,
        kind="user",
        organisation_id=str(me.organisation_id),
    )

    log_event(
        level="info",
        event="auth.user_login",
        organisation_id=str(me.organisation_id),
        meta={"user_id": str(me.id), "username": me.username},
    )

    return UserTokenResponse(access_token=token, user=me)


class LogoutResponse(BaseModel):
    message: str = "logged out"


@router.post("/logout", response_model=LogoutResponse)
async def user_logout(claims: dict = Depends(require_user)):
    log_event(
        level="info",
        event="auth.user_logout",
        organisation_id=claims.get("organisation_id"),
        meta={"user_id": claims.get("sub")},
    )
    return LogoutResponse()


@router.get("/me", response_model=UserMe)
async def user_me(claims: dict = Depends(require_user), db: Client = Depends(get_db)):
    res = (
        db.table("users")
        .select(_SELECT_ME)
        .eq("id", claims["sub"])
        .single()
        .execute()
    )
    row = res.data or {}
    if not row:
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS, "user no longer exists")
    return _row_to_user_me(row)


@router.post("/me/password")
async def user_change_password(
    body: UserChangePasswordRequest,
    claims: dict = Depends(require_user),
    db: Client = Depends(get_db),
):
    res = (
        db.table("users")
        .select("id, password_hash")
        .eq("id", claims["sub"])
        .single()
        .execute()
    )
    row = res.data or {}
    if not row:
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS, "user no longer exists")
    if not verify_password(body.current_password, row.get("password_hash") or ""):
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS, "current password is incorrect")

    db.table("users").update({"password_hash": hash_password(body.new_password)}).eq(
        "id", claims["sub"]
    ).execute()

    log_event(
        level="info",
        event="auth.user_password_changed",
        organisation_id=claims.get("organisation_id"),
        meta={"user_id": claims["sub"]},
    )
    return {"message": "password updated"}
